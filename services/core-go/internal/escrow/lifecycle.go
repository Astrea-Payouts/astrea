// lifecycle.go wraps the four contract calls that end an event for good:
// set_event_cancelled (pre-launch refund), expire_event (deadline refund),
// release_reward (judge pays 1..N winners atomically) and
// release_compensation (admin pays back participants after a
// cancellation). Built on the same #24 BuildUnsigned path as wallet.go.
//
// See smart-contracts/astrea/contracts/event-escrow/src/lifecycle.rs and
// rewards.rs for the authoritative signatures. The signer differs per
// call: set_event_cancelled and release_compensation are organizer
// (admin)-authorized, release_reward is judge-authorized (ADR-003 keeps
// the organizer out of the payout path), and expire_event has no signer at
// all -- it is permissionless.
package escrow

import (
	"context"
	"fmt"

	"github.com/stellar/go/xdr"
)

// maxWinners mirrors rewards.rs:20's MAX_WINNERS. It is duplicated here
// (Go cannot import a Rust const) purely so an oversized winners list fails
// before it costs a simulation round trip -- the contract's own assert is
// still the actual guarantee (see release_reward in rewards.rs), not this
// check.
const maxWinners = 25

// Winner mirrors the contract's Winner struct (types.rs): one payout line
// in a release_reward call. place is off-chain metadata only -- the
// contract never reads, validates, or emits it, and duplicate places are
// accepted (rewards.rs never inspects it) -- but a wrong amount mispays a
// person, so get that field right above all.
type Winner struct {
	Place   uint32
	Amount  int64
	Address string
}

// Participant mirrors one element of the contract's Vec<Participants>
// (types.rs's Participants struct, despite its plural name describing a
// single entry): one compensation payout line in a release_compensation
// call.
type Participant struct {
	Address            string
	AmountCompensation int64
}

// SetEventCancelledHostFunction builds the host function for
// set_event_cancelled(admin, event_id). Organizer-authorized. The contract
// rejects this once the event reaches InProgress -- cancelling a live event
// with an automatic refund would let an organizer extract participants'
// already-invested work for free (ADR-006; see lifecycle.rs).
func SetEventCancelledHostFunction(contract xdr.ScAddress, admin string, eventID EventID) (xdr.HostFunction, error) {
	adminArg, err := EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding admin address: %w", err)
	}
	return invokeContractHF(contract, "set_event_cancelled", adminArg, eventID.scVal()), nil
}

// ExpireEventHostFunction builds the host function for
// expire_event(event_id). Unlike every other call in this file,
// expire_event takes no signer at all -- it is permissionless, and it is
// the one call in the contract that works even while globally paused
// (lifecycle.rs never calls assert_not_paused for it).
func ExpireEventHostFunction(contract xdr.ScAddress, eventID EventID) xdr.HostFunction {
	return invokeContractHF(contract, "expire_event", eventID.scVal())
}

// ReleaseRewardHostFunction builds the host function for
// release_reward(judge, event_id, winners). judge -- not admin -- is the
// signer: the organizer is never in the payout path (ADR-003). winners is
// capped defensively at maxWinners before this ever reaches simulation, so
// an obviously oversized list fails fast instead of costing a wasted RPC
// round trip; the contract's own assert is still the actual guarantee,
// including the exact-sum-to-event.reward check this function cannot
// itself validate without knowing the event's reward (AllocateWinners in
// allocate.go is what guarantees that, when winners come from there).
func ReleaseRewardHostFunction(contract xdr.ScAddress, judge string, eventID EventID, winners []Winner) (xdr.HostFunction, error) {
	if len(winners) == 0 {
		return xdr.HostFunction{}, fmt.Errorf("escrow: release_reward requires at least one winner")
	}
	if len(winners) > maxWinners {
		return xdr.HostFunction{}, fmt.Errorf("escrow: %d winners exceeds the contract's MAX_WINNERS (%d)", len(winners), maxWinners)
	}
	judgeArg, err := EncodeAddress(judge)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding judge address: %w", err)
	}
	winnersArg, err := winnersScVal(winners)
	if err != nil {
		return xdr.HostFunction{}, err
	}
	return invokeContractHF(contract, "release_reward", judgeArg, eventID.scVal(), winnersArg), nil
}

// ReleaseCompensationHostFunction builds the host function for
// release_compensation(admin, event_id, participants). admin -- the
// organizer -- is the signer here, unlike release_reward.
func ReleaseCompensationHostFunction(contract xdr.ScAddress, admin string, eventID EventID, participants []Participant) (xdr.HostFunction, error) {
	if len(participants) == 0 {
		return xdr.HostFunction{}, fmt.Errorf("escrow: release_compensation requires at least one participant")
	}
	adminArg, err := EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding admin address: %w", err)
	}
	participantsArg, err := participantsScVal(participants)
	if err != nil {
		return xdr.HostFunction{}, err
	}
	return invokeContractHF(contract, "release_compensation", adminArg, eventID.scVal(), participantsArg), nil
}

// BuildSetEventCancelled simulates set_event_cancelled and returns an
// unsigned transaction for the organizer's own wallet to sign.
func BuildSetEventCancelled(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, admin string, eventID EventID, cfg Config) (UnsignedTx, error) {
	hf, err := SetEventCancelledHostFunction(contract, admin, eventID)
	if err != nil {
		return UnsignedTx{}, err
	}
	return BuildUnsigned(ctx, rpc, admin, hf, cfg)
}

// BuildExpireEvent simulates expire_event and returns an unsigned
// transaction for feePayer to sign and submit.
//
// expire_event requires no on-chain auth -- it is permissionless -- so
// feePayer is deliberately NOT required to be the event's admin, judge, or
// anyone else recorded on the event; its only job is to source the
// transaction and pay its network fee. The intended caller of this
// function is Astrea's own operational account (e.g. a keeper/cron job
// that sweeps expired events), not an organizer's wallet -- unlike every
// other Build... function in this file, no external signer hand-off is
// implied by this choice, since anyone with a funded Stellar account may
// legally submit this call.
func BuildExpireEvent(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, feePayer string, eventID EventID, cfg Config) (UnsignedTx, error) {
	hf := ExpireEventHostFunction(contract, eventID)
	return BuildUnsigned(ctx, rpc, feePayer, hf, cfg)
}

// BuildReleaseReward simulates release_reward and returns an unsigned
// transaction for the judge's own wallet to sign -- never the organizer's
// (ADR-003).
func BuildReleaseReward(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, judge string, eventID EventID, winners []Winner, cfg Config) (UnsignedTx, error) {
	hf, err := ReleaseRewardHostFunction(contract, judge, eventID, winners)
	if err != nil {
		return UnsignedTx{}, err
	}
	return BuildUnsigned(ctx, rpc, judge, hf, cfg)
}

// BuildReleaseCompensation simulates release_compensation and returns an
// unsigned transaction for the organizer's own wallet to sign.
func BuildReleaseCompensation(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, admin string, eventID EventID, participants []Participant, cfg Config) (UnsignedTx, error) {
	hf, err := ReleaseCompensationHostFunction(contract, admin, eventID, participants)
	if err != nil {
		return UnsignedTx{}, err
	}
	return BuildUnsigned(ctx, rpc, admin, hf, cfg)
}

// --- #[contracttype] struct encoding ----------------------------------
//
// Soroban's default encoding for a #[contracttype] struct is NOT an
// ScVec: it is an ScMap keyed by ScSymbol, with entries in the struct
// fields' *sorted* key order -- not their declaration order in the Rust
// source. Winner is declared {place, amount, address} in types.rs but
// must be encoded {address, amount, place}; Participants is declared
// {address, amount_compensation}, which happens to already be sorted.
// Getting this wrong doesn't produce a decodable Go error: simulation
// rejects it with an opaque host error, so the key order below is
// exercised directly by lifecycle_test.go rather than left implicit.

func scSymbol(name string) xdr.ScVal {
	sym := xdr.ScSymbol(name)
	return xdr.ScVal{Type: xdr.ScValTypeScvSymbol, Sym: &sym}
}

func scU32(v uint32) xdr.ScVal {
	u := xdr.Uint32(v)
	return xdr.ScVal{Type: xdr.ScValTypeScvU32, U32: &u}
}

func scMap(entries xdr.ScMap) xdr.ScVal {
	m := &entries
	return xdr.ScVal{Type: xdr.ScValTypeScvMap, Map: &m}
}

func scVec(vals xdr.ScVec) xdr.ScVal {
	v := &vals
	return xdr.ScVal{Type: xdr.ScValTypeScvVec, Vec: &v}
}

// winnerScVal encodes a single Winner as the sorted-key ScMap
// {address, amount, place} the contract's Winner struct requires.
func winnerScVal(w Winner) (xdr.ScVal, error) {
	addrArg, err := EncodeAddress(w.Address)
	if err != nil {
		return xdr.ScVal{}, fmt.Errorf("escrow: encoding winner address: %w", err)
	}
	return scMap(xdr.ScMap{
		{Key: scSymbol("address"), Val: addrArg},
		{Key: scSymbol("amount"), Val: EncodeI128(w.Amount)},
		{Key: scSymbol("place"), Val: scU32(w.Place)},
	}), nil
}

func winnersScVal(winners []Winner) (xdr.ScVal, error) {
	vec := make(xdr.ScVec, 0, len(winners))
	for i, w := range winners {
		wv, err := winnerScVal(w)
		if err != nil {
			return xdr.ScVal{}, fmt.Errorf("escrow: encoding winner %d: %w", i, err)
		}
		vec = append(vec, wv)
	}
	return scVec(vec), nil
}

// participantScVal encodes a single Participant as the sorted-key ScMap
// {address, amount_compensation} the contract's Participants struct
// requires.
func participantScVal(p Participant) (xdr.ScVal, error) {
	addrArg, err := EncodeAddress(p.Address)
	if err != nil {
		return xdr.ScVal{}, fmt.Errorf("escrow: encoding participant address: %w", err)
	}
	return scMap(xdr.ScMap{
		{Key: scSymbol("address"), Val: addrArg},
		{Key: scSymbol("amount_compensation"), Val: EncodeI128(p.AmountCompensation)},
	}), nil
}

func participantsScVal(participants []Participant) (xdr.ScVal, error) {
	vec := make(xdr.ScVec, 0, len(participants))
	for i, p := range participants {
		pv, err := participantScVal(p)
		if err != nil {
			return xdr.ScVal{}, fmt.Errorf("escrow: encoding participant %d: %w", i, err)
		}
		vec = append(vec, pv)
	}
	return scVec(vec), nil
}
