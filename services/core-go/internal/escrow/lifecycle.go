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

	protocol "github.com/stellar/go/protocols/rpc"
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

// SetEventWaitingForStartHostFunction builds the host function for
// set_event_waiting_for_start(admin, event_id). Organizer-authorized --
// this is the first of the two go-live transitions (Created ->
// WaitingForStart), and unlike set_event_in_progress it charges no fee.
func SetEventWaitingForStartHostFunction(contract xdr.ScAddress, admin string, eventID EventID) (xdr.HostFunction, error) {
	adminArg, err := EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding admin address: %w", err)
	}
	return invokeContractHF(contract, "set_event_waiting_for_start", adminArg, eventID.scVal()), nil
}

// BuildSetEventWaitingForStart simulates set_event_waiting_for_start and
// returns an unsigned transaction for the organizer's own wallet to sign.
func BuildSetEventWaitingForStart(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, admin string, eventID EventID, cfg Config) (UnsignedTx, error) {
	hf, err := SetEventWaitingForStartHostFunction(contract, admin, eventID)
	if err != nil {
		return UnsignedTx{}, err
	}
	return BuildUnsigned(ctx, rpc, admin, hf, cfg)
}

// SetEventInProgressHostFunction builds the host function for
// set_event_in_progress(admin, event_id, judging_deadline). Organizer-
// authorized. judgingDeadline is a Unix timestamp (u64 seconds) past which
// resolve_dispute becomes callable (lifecycle.rs) -- it MUST encode as
// ScvU64, not ScvU32: the contract's own parameter is a u64, and simulation
// rejects a mismatched Soroban type outright. This call also charges the
// go-live fee (quote it first with QuoteGoLiveFee) from admin's free
// balance to the governance treasury; the contract fails closed if a
// nonzero fee is configured but no treasury has been set (governance.rs).
func SetEventInProgressHostFunction(contract xdr.ScAddress, admin string, eventID EventID, judgingDeadline uint64) (xdr.HostFunction, error) {
	adminArg, err := EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding admin address: %w", err)
	}
	return invokeContractHF(contract, "set_event_in_progress", adminArg, eventID.scVal(), scU64(judgingDeadline)), nil
}

// BuildSetEventInProgress simulates set_event_in_progress and returns an
// unsigned transaction for the organizer's own wallet to sign.
func BuildSetEventInProgress(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, admin string, eventID EventID, judgingDeadline uint64, cfg Config) (UnsignedTx, error) {
	hf, err := SetEventInProgressHostFunction(contract, admin, eventID, judgingDeadline)
	if err != nil {
		return UnsignedTx{}, err
	}
	return BuildUnsigned(ctx, rpc, admin, hf, cfg)
}

// QuoteGoLiveFee simulates quote_go_live_fee(event_id) -- a read-only call
// (lib.rs's own signature takes no signer at all) -- and returns the go-live
// fee set_event_in_progress will charge the organizer, without ever
// submitting anything. source only sources the simulated transaction (any
// funded, existing account works, since quote_go_live_fee needs no
// authorization); it is never charged or signed for. Modeled on
// GetBalance's simulate-and-decode pattern in wallet.go.
func QuoteGoLiveFee(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, eventID EventID, source string, cfg Config) (int64, error) {
	cfg = cfg.withDefaults()

	hf := invokeContractHF(contract, "quote_go_live_fee", eventID.scVal())

	account, err := rpc.LoadAccount(ctx, source)
	if err != nil {
		return 0, fmt.Errorf("escrow: loading source account: %w", err)
	}
	simTx, err := buildTx(account, source, hf, nil, nil, cfg.TxTimeout)
	if err != nil {
		return 0, fmt.Errorf("escrow: building simulation transaction: %w", err)
	}
	simB64, err := simTx.Base64()
	if err != nil {
		return 0, fmt.Errorf("escrow: encoding simulation transaction: %w", err)
	}

	simResp, err := rpc.SimulateTransaction(ctx, protocol.SimulateTransactionRequest{Transaction: simB64})
	if err != nil {
		return 0, fmt.Errorf("escrow: calling simulateTransaction: %w", err)
	}
	if simResp.Error != "" {
		return 0, &SimulationError{Message: simResp.Error}
	}
	if len(simResp.Results) == 0 || simResp.Results[0].ReturnValueXDR == nil {
		return 0, fmt.Errorf("escrow: quote_go_live_fee simulation returned no value")
	}

	var returnVal xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(*simResp.Results[0].ReturnValueXDR, &returnVal); err != nil {
		return 0, fmt.Errorf("escrow: decoding simulated return value: %w", err)
	}
	return DecodeI128ToInt64(returnVal)
}

// GetDefaultResolver simulates get_default_resolver() -- a read-only call,
// same as QuoteGoLiveFee -- and returns the contract's governance-set
// DefaultResolver address, without ever submitting anything. source only
// sources the simulated transaction; it is never charged or signed for.
// create_event's build step calls this to fill the resolver argument
// whenever the organizer path doesn't ask for a per-event custom resolver
// (out of scope for #11 PR 1). Modeled on QuoteGoLiveFee's exact pattern.
func GetDefaultResolver(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, source string, cfg Config) (string, error) {
	cfg = cfg.withDefaults()

	hf := invokeContractHF(contract, "get_default_resolver")

	account, err := rpc.LoadAccount(ctx, source)
	if err != nil {
		return "", fmt.Errorf("escrow: loading source account: %w", err)
	}
	simTx, err := buildTx(account, source, hf, nil, nil, cfg.TxTimeout)
	if err != nil {
		return "", fmt.Errorf("escrow: building simulation transaction: %w", err)
	}
	simB64, err := simTx.Base64()
	if err != nil {
		return "", fmt.Errorf("escrow: encoding simulation transaction: %w", err)
	}

	simResp, err := rpc.SimulateTransaction(ctx, protocol.SimulateTransactionRequest{Transaction: simB64})
	if err != nil {
		return "", fmt.Errorf("escrow: calling simulateTransaction: %w", err)
	}
	if simResp.Error != "" {
		return "", &SimulationError{Message: simResp.Error}
	}
	if len(simResp.Results) == 0 || simResp.Results[0].ReturnValueXDR == nil {
		return "", fmt.Errorf("escrow: get_default_resolver simulation returned no value")
	}

	var returnVal xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(*simResp.Results[0].ReturnValueXDR, &returnVal); err != nil {
		return "", fmt.Errorf("escrow: decoding simulated return value: %w", err)
	}
	return DecodeAddressToString(returnVal)
}

// ResolveDisputeHostFunction builds the host function for
// resolve_dispute(resolver, event_id, winners). resolver -- named on the
// event at create_event time, defaulting to Astrea's own governance
// DefaultResolver -- is the signer; neither admin nor judge may call this.
// The contract only accepts it while the event is InProgress and past its
// judging_deadline (lifecycle.rs), i.e. after the judge has missed its
// window to call release_reward. winners reuses the exact Winner shape and
// sum-validation contract as release_reward: this is AllocateWinners'
// second consumer, and the exact-sum-to-event.reward assertion still lives
// entirely in the contract.
func ResolveDisputeHostFunction(contract xdr.ScAddress, resolver string, eventID EventID, winners []Winner) (xdr.HostFunction, error) {
	if len(winners) == 0 {
		return xdr.HostFunction{}, fmt.Errorf("escrow: resolve_dispute requires at least one winner")
	}
	if len(winners) > maxWinners {
		return xdr.HostFunction{}, fmt.Errorf("escrow: %d winners exceeds the contract's MAX_WINNERS (%d)", len(winners), maxWinners)
	}
	resolverArg, err := EncodeAddress(resolver)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding resolver address: %w", err)
	}
	winnersArg, err := winnersScVal(winners)
	if err != nil {
		return xdr.HostFunction{}, err
	}
	return invokeContractHF(contract, "resolve_dispute", resolverArg, eventID.scVal(), winnersArg), nil
}

// BuildResolveDispute simulates resolve_dispute and returns an unsigned
// transaction for the resolver's own wallet to sign -- never the
// organizer's or judge's key (README, S04: the resolver's key never enters
// this service).
func BuildResolveDispute(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, resolver string, eventID EventID, winners []Winner, cfg Config) (UnsignedTx, error) {
	hf, err := ResolveDisputeHostFunction(contract, resolver, eventID, winners)
	if err != nil {
		return UnsignedTx{}, err
	}
	return BuildUnsigned(ctx, rpc, resolver, hf, cfg)
}

// EmergencyWithdrawHostFunction builds the host function for
// emergency_withdraw(admin, resolver, event_id, amount) -- note admin
// before resolver, the contract's own argument order (lifecycle.rs), which
// this function preserves exactly rather than reordering to match its own
// (source, admin, resolver, ...) parameter list. The call requires BOTH
// admin's and resolver's authorization (a genuine two-signature Soroban
// auth, unlike every other call in this package) and only succeeds
// pre-launch (Created or WaitingForStart) -- it exists as a governance
// escape hatch before participants have committed real work.
func EmergencyWithdrawHostFunction(contract xdr.ScAddress, admin, resolver string, eventID EventID, amount int64) (xdr.HostFunction, error) {
	adminArg, err := EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding admin address: %w", err)
	}
	resolverArg, err := EncodeAddress(resolver)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding resolver address: %w", err)
	}
	return invokeContractHF(contract, "emergency_withdraw", adminArg, resolverArg, eventID.scVal(), EncodeI128(amount)), nil
}

// BuildEmergencyWithdraw simulates emergency_withdraw and returns an
// unsigned transaction sourced by source, which MUST be either admin or
// resolver -- the contract requires both of their authorizations, and one
// of them has to be the transaction's source account to pay its fee and
// implicitly satisfy its own SOROBAN_CREDENTIALS_SOURCE_ACCOUNT auth entry.
// The OTHER party's SOROBAN_CREDENTIALS_ADDRESS entry comes back in the
// result's PendingAuth (BuildUnsigned already surfaces any such entry
// generically -- see pipeline.go) and must be signed separately with
// SignAuthEntry and folded back in with AttachSignedAuth before this
// transaction can be submitted. Whichever party is NOT source signs via
// SignAuthEntry entirely client-side: this service never holds the
// resolver's key (README, S04).
func BuildEmergencyWithdraw(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, source, admin, resolver string, eventID EventID, amount int64, cfg Config) (UnsignedTx, error) {
	if source != admin && source != resolver {
		return UnsignedTx{}, fmt.Errorf("escrow: emergency_withdraw source must be admin or resolver, got %q", source)
	}
	hf, err := EmergencyWithdrawHostFunction(contract, admin, resolver, eventID, amount)
	if err != nil {
		return UnsignedTx{}, err
	}
	return BuildUnsigned(ctx, rpc, source, hf, cfg)
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

func scU64(v uint64) xdr.ScVal {
	u := xdr.Uint64(v)
	return xdr.ScVal{Type: xdr.ScValTypeScvU64, U64: &u}
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
