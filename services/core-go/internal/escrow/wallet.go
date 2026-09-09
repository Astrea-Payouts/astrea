// wallet.go wraps the event-escrow contract calls that manage an
// organizer's AdminWallet -- deposit_funds, withdraw_funds, create_event,
// and the read-only get_balance -- on top of the pipeline in pipeline.go.
//
// See smart-contracts/astrea/contracts/event-escrow/src/lib.rs for the
// authoritative signatures. Notably: create_event takes a single
// reward: i128 and a caller-supplied event_id -- the contract does not
// generate the id, and there is no multi-prize list here (that belongs to
// release_reward, a later issue).
package escrow

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math"

	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/xdr"
)

// EventID is the caller-supplied 16-byte identifier for a new event.
// create_event does not generate this: the caller picks it, passes it in,
// and the contract simply echoes it back and uses it as the on-chain
// storage key (see create_event_internal in lib.rs).
type EventID [16]byte

// NewEventID generates a random EventID from a CSPRNG.
func NewEventID() (EventID, error) {
	var id EventID
	if _, err := rand.Read(id[:]); err != nil {
		return EventID{}, fmt.Errorf("escrow: generating event id: %w", err)
	}
	return id, nil
}

// String renders the EventID as lowercase hex, matching the convention used
// throughout the contract's testnet proof (e.g. `ea5e62c0...` in
// smart-contracts/astrea/contracts/event-escrow/README.md).
func (id EventID) String() string {
	return hex.EncodeToString(id[:])
}

func (id EventID) scVal() xdr.ScVal {
	b := xdr.ScBytes(append([]byte(nil), id[:]...))
	return xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &b}
}

// EventIDFromScVal decodes an EventID from a BytesN<16> ScVal, such as
// create_event's echoed return value.
func EventIDFromScVal(v xdr.ScVal) (EventID, error) {
	b, ok := v.GetBytes()
	if !ok {
		return EventID{}, fmt.Errorf("escrow: expected a Bytes ScVal for an event id, got %v", v.Type)
	}
	if len(b) != len(EventID{}) {
		return EventID{}, fmt.Errorf("escrow: expected a %d-byte event id, got %d bytes", len(EventID{}), len(b))
	}
	var id EventID
	copy(id[:], b)
	return id, nil
}

// EncodeI128 builds a Soroban ScVal i128 argument from an int64, sign-
// extending it into the high 64 bits the way two's-complement i128 requires.
// Every i128 argument in this contract (amount, reward) is asserted > 0
// on-chain, but this helper itself makes no such assumption.
func EncodeI128(v int64) xdr.ScVal {
	hi := int64(0)
	if v < 0 {
		hi = -1
	}
	return xdr.ScVal{
		Type: xdr.ScValTypeScvI128,
		I128: &xdr.Int128Parts{Hi: xdr.Int64(hi), Lo: xdr.Uint64(uint64(v))},
	}
}

// DecodeI128ToInt64 decodes a Soroban ScVal i128 return value into an
// int64, erroring rather than truncating if the value doesn't fit -- every
// balance and reward this contract deals with does today, but this makes
// that an explicit checked assumption instead of a silent one.
func DecodeI128ToInt64(v xdr.ScVal) (int64, error) {
	parts, ok := v.GetI128()
	if !ok {
		return 0, fmt.Errorf("escrow: expected an I128 ScVal, got %v", v.Type)
	}
	if parts.Hi != 0 {
		return 0, fmt.Errorf("escrow: i128 value does not fit in int64 (hi=%d lo=%d)", parts.Hi, parts.Lo)
	}
	if uint64(parts.Lo) > math.MaxInt64 {
		return 0, fmt.Errorf("escrow: i128 value does not fit in int64 (lo=%d)", parts.Lo)
	}
	return int64(parts.Lo), nil
}

func invokeContractHF(contract xdr.ScAddress, fn string, args ...xdr.ScVal) xdr.HostFunction {
	return xdr.HostFunction{
		Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
		InvokeContract: &xdr.InvokeContractArgs{
			ContractAddress: contract,
			FunctionName:    xdr.ScSymbol(fn),
			Args:            args,
		},
	}
}

// DepositFundsHostFunction builds the host function for
// deposit_funds(admin, token, amount). admin is always a G-address
// (Stellar account); token is a SEP-41 token contract address -- a
// C-address, e.g. the native XLM SAC -- so both are run through
// EncodeAddress rather than assumed to be one kind or the other. That
// exact G/C mix is what broke K02's `initialize` call.
func DepositFundsHostFunction(contract xdr.ScAddress, admin, token string, amount int64) (xdr.HostFunction, error) {
	adminArg, err := EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding admin address: %w", err)
	}
	tokenArg, err := EncodeAddress(token)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding token address: %w", err)
	}
	return invokeContractHF(contract, "deposit_funds", adminArg, tokenArg, EncodeI128(amount)), nil
}

// WithdrawFundsHostFunction builds the host function for
// withdraw_funds(admin, amount).
func WithdrawFundsHostFunction(contract xdr.ScAddress, admin string, amount int64) (xdr.HostFunction, error) {
	adminArg, err := EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding admin address: %w", err)
	}
	return invokeContractHF(contract, "withdraw_funds", adminArg, EncodeI128(amount)), nil
}

// GetBalanceHostFunction builds the host function for get_balance(admin).
func GetBalanceHostFunction(contract xdr.ScAddress, admin string) (xdr.HostFunction, error) {
	adminArg, err := EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding admin address: %w", err)
	}
	return invokeContractHF(contract, "get_balance", adminArg), nil
}

// CreateEventHostFunction builds the host function for
// create_event(admin, judge, token, reward, event_id). One event carries
// exactly one reward: the winners list is supplied later, to
// release_reward, not here. judge is deliberately distinct from admin --
// it is judge's auth, not admin's, that release_reward will require later
// (see lib.rs's Event.judge doc comment and ADR-003).
func CreateEventHostFunction(contract xdr.ScAddress, admin, judge, token string, reward int64, eventID EventID) (xdr.HostFunction, error) {
	adminArg, err := EncodeAddress(admin)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding admin address: %w", err)
	}
	judgeArg, err := EncodeAddress(judge)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding judge address: %w", err)
	}
	tokenArg, err := EncodeAddress(token)
	if err != nil {
		return xdr.HostFunction{}, fmt.Errorf("escrow: encoding token address: %w", err)
	}
	return invokeContractHF(contract, "create_event", adminArg, judgeArg, tokenArg, EncodeI128(reward), eventID.scVal()), nil
}

// BuildDepositFunds simulates deposit_funds and returns an unsigned
// transaction for the organizer's own wallet to sign. This service never
// holds or needs the organizer's key: Astrea is non-custodial.
func BuildDepositFunds(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, admin, token string, amount int64, cfg Config) (UnsignedTx, error) {
	hf, err := DepositFundsHostFunction(contract, admin, token, amount)
	if err != nil {
		return UnsignedTx{}, err
	}
	return BuildUnsigned(ctx, rpc, admin, hf, cfg)
}

// BuildWithdrawFunds simulates withdraw_funds and returns an unsigned
// transaction for the organizer's own wallet to sign.
func BuildWithdrawFunds(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, admin string, amount int64, cfg Config) (UnsignedTx, error) {
	hf, err := WithdrawFundsHostFunction(contract, admin, amount)
	if err != nil {
		return UnsignedTx{}, err
	}
	return BuildUnsigned(ctx, rpc, admin, hf, cfg)
}

// BuildCreateEvent simulates create_event and returns an unsigned
// transaction for the organizer's own wallet to sign.
func BuildCreateEvent(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, admin, judge, token string, reward int64, eventID EventID, cfg Config) (UnsignedTx, error) {
	hf, err := CreateEventHostFunction(contract, admin, judge, token, reward, eventID)
	if err != nil {
		return UnsignedTx{}, err
	}
	return BuildUnsigned(ctx, rpc, admin, hf, cfg)
}

// GetBalance reads an organizer's current AdminWallet balance via
// simulation only -- it never builds an auth entry, never signs, and never
// submits anything. The contract deducts a new event's reward from the
// wallet at create_event time (see create_event_internal in lib.rs), so
// this is already the organizer's free/available balance; there is no
// separate "reserved" figure to subtract.
func GetBalance(ctx context.Context, rpc RPCClient, contract xdr.ScAddress, admin string, cfg Config) (int64, error) {
	cfg = cfg.withDefaults()

	hf, err := GetBalanceHostFunction(contract, admin)
	if err != nil {
		return 0, err
	}

	account, err := rpc.LoadAccount(ctx, admin)
	if err != nil {
		return 0, fmt.Errorf("escrow: loading admin account: %w", err)
	}
	simTx, err := buildTx(account, admin, hf, nil, nil, cfg.TxTimeout)
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
		return 0, fmt.Errorf("escrow: get_balance simulation returned no value")
	}

	var returnVal xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(*simResp.Results[0].ReturnValueXDR, &returnVal); err != nil {
		return 0, fmt.Errorf("escrow: decoding simulated return value: %w", err)
	}
	return DecodeI128ToInt64(returnVal)
}
