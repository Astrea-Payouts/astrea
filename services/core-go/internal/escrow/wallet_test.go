package escrow

import (
	"context"
	"errors"
	"testing"

	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

// Real testnet strkeys from the event-escrow contract's own reference run
// (smart-contracts/astrea/contracts/event-escrow/README.md), reused here
// purely as well-formed addresses -- none of these tests touch the network.
const (
	testJudgeAddress = "GDCYCXUVREFDIJGGVCLSFQLMB7GQLX7MNLBMIAXDVVWPRUA66HOVMR5L"
	testTokenAddress = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
)

// --- argument encoding ---------------------------------------------------

func TestDepositFundsHostFunction(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}

	hf, err := DepositFundsHostFunction(contract, testAccountAddress, testTokenAddress, 10_000_000)
	if err != nil {
		t.Fatalf("DepositFundsHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "deposit_funds" {
		t.Fatalf("function name = %q, want %q", got, "deposit_funds")
	}
	args := hf.InvokeContract.Args
	if len(args) != 3 {
		t.Fatalf("got %d args, want 3", len(args))
	}

	// admin: a G-address, so it must encode as an account ScAddress.
	assertAccountAddress(t, args[0], testAccountAddress)
	// token: the native XLM SAC, a C-address -- this is the exact mix that
	// broke K02's `initialize` call when every Address was assumed to be an
	// account.
	assertContractAddress(t, args[1], testTokenAddress)

	assertI128(t, args[2], 10_000_000)
}

func TestWithdrawFundsHostFunction(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}

	hf, err := WithdrawFundsHostFunction(contract, testAccountAddress, 5_000_000)
	if err != nil {
		t.Fatalf("WithdrawFundsHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "withdraw_funds" {
		t.Fatalf("function name = %q, want %q", got, "withdraw_funds")
	}
	args := hf.InvokeContract.Args
	if len(args) != 2 {
		t.Fatalf("got %d args, want 2", len(args))
	}
	assertAccountAddress(t, args[0], testAccountAddress)
	assertI128(t, args[1], 5_000_000)
}

func TestGetBalanceHostFunction(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}

	hf, err := GetBalanceHostFunction(contract, testAccountAddress)
	if err != nil {
		t.Fatalf("GetBalanceHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "get_balance" {
		t.Fatalf("function name = %q, want %q", got, "get_balance")
	}
	args := hf.InvokeContract.Args
	if len(args) != 1 {
		t.Fatalf("got %d args, want 1", len(args))
	}
	assertAccountAddress(t, args[0], testAccountAddress)
}

// TestCreateEventHostFunction_SinglePrize is the regression test for this
// task's core scope correction: create_event carries exactly one reward and
// a caller-supplied event id, never a Prize/winners list (issue #24's
// BuildCreateEvent(admin, prizes []Prize) matches no signature in lib.rs).
// It also covers the same G/C address mix as deposit_funds: admin and judge
// are G-addresses, token is the C-address native XLM SAC.
func TestCreateEventHostFunction_SinglePrize(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	eventID, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}

	hf, err := CreateEventHostFunction(contract, testAccountAddress, testJudgeAddress, testTokenAddress, 30_000_000, eventID)
	if err != nil {
		t.Fatalf("CreateEventHostFunction returned error: %v", err)
	}

	if got := string(hf.InvokeContract.FunctionName); got != "create_event" {
		t.Fatalf("function name = %q, want %q", got, "create_event")
	}
	args := hf.InvokeContract.Args
	if len(args) != 5 {
		t.Fatalf("got %d args, want 5 (admin, judge, token, reward, event_id) -- a Prize/winners list does not belong here, see AGENTS.md", len(args))
	}

	assertAccountAddress(t, args[0], testAccountAddress)
	assertAccountAddress(t, args[1], testJudgeAddress)
	assertContractAddress(t, args[2], testTokenAddress)
	assertI128(t, args[3], 30_000_000)

	gotID, err := EventIDFromScVal(args[4])
	if err != nil {
		t.Fatalf("decoding event_id arg: %v", err)
	}
	if gotID != eventID {
		t.Fatalf("event_id arg = %x, want %x", gotID, eventID)
	}
}

// --- assertion helpers ----------------------------------------------------

func assertAccountAddress(t *testing.T, arg xdr.ScVal, want string) {
	t.Helper()
	if arg.Type != xdr.ScValTypeScvAddress || arg.Address == nil {
		t.Fatalf("arg = %+v, want an ScvAddress", arg)
	}
	if arg.Address.Type != xdr.ScAddressTypeScAddressTypeAccount || arg.Address.AccountId == nil {
		t.Fatalf("arg address = %+v, want an account address (G-address) for %q", arg.Address, want)
	}
	if got := arg.Address.AccountId.Address(); got != want {
		t.Fatalf("account address = %q, want %q", got, want)
	}
}

func assertContractAddress(t *testing.T, arg xdr.ScVal, want string) {
	t.Helper()
	if arg.Type != xdr.ScValTypeScvAddress || arg.Address == nil {
		t.Fatalf("arg = %+v, want an ScvAddress", arg)
	}
	if arg.Address.Type != xdr.ScAddressTypeScAddressTypeContract || arg.Address.ContractId == nil {
		t.Fatalf("arg address = %+v, want a contract address (C-address) for %q", arg.Address, want)
	}
	wantAddr, err := ContractAddress(want)
	if err != nil {
		t.Fatalf("ContractAddress(%q): %v", want, err)
	}
	if !arg.Address.Equals(wantAddr) {
		t.Fatalf("contract address = %+v, want %+v", *arg.Address, wantAddr)
	}
}

func assertI128(t *testing.T, arg xdr.ScVal, want int64) {
	t.Helper()
	got, err := DecodeI128ToInt64(arg)
	if err != nil {
		t.Fatalf("decoding i128 arg: %v", err)
	}
	if got != want {
		t.Fatalf("i128 arg = %d, want %d", got, want)
	}
}

// --- EventID ---------------------------------------------------------------

func TestNewEventID_Length(t *testing.T) {
	id, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	if len(id) != 16 {
		t.Fatalf("len(id) = %d, want 16", len(id))
	}
}

func TestNewEventID_Random(t *testing.T) {
	a, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	b, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	if a == b {
		t.Fatalf("two calls to NewEventID produced the same id: %x", a)
	}
}

func TestEventIDFromScVal_RoundTrip(t *testing.T) {
	id, err := NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	got, err := EventIDFromScVal(id.scVal())
	if err != nil {
		t.Fatalf("EventIDFromScVal: %v", err)
	}
	if got != id {
		t.Fatalf("round-tripped id = %x, want %x", got, id)
	}
}

func TestEventIDFromScVal_WrongType(t *testing.T) {
	_, err := EventIDFromScVal(xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	if err == nil {
		t.Fatal("expected an error decoding a non-Bytes ScVal as an event id, got nil")
	}
}

func TestEventIDFromScVal_WrongLength(t *testing.T) {
	short := xdr.ScBytes([]byte{1, 2, 3})
	_, err := EventIDFromScVal(xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &short})
	if err == nil {
		t.Fatal("expected an error decoding a non-16-byte value as an event id, got nil")
	}
}

// --- i128 -------------------------------------------------------------------

func TestDecodeI128ToInt64_DoesNotFit(t *testing.T) {
	v := xdr.ScVal{Type: xdr.ScValTypeScvI128, I128: &xdr.Int128Parts{Hi: 1, Lo: 0}}
	_, err := DecodeI128ToInt64(v)
	if err == nil {
		t.Fatal("expected an error for an i128 that doesn't fit in int64, got nil")
	}
}

func TestDecodeI128ToInt64_WrongType(t *testing.T) {
	_, err := DecodeI128ToInt64(xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	if err == nil {
		t.Fatal("expected an error decoding a non-I128 ScVal, got nil")
	}
}

// --- BuildUnsigned / SubmitSigned -------------------------------------------

// TestBuildDepositFunds_ReturnsUnsignedEnvelope proves BuildDepositFunds
// hands back a transaction with no signatures attached -- the whole point
// of the build-only path is that this service never signs, because it
// never holds the organizer's key.
func TestBuildDepositFunds_ReturnsUnsignedEnvelope(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})

	unsigned, err := BuildDepositFunds(context.Background(), rpc, contract, testAccountAddress, testTokenAddress, 10_000_000, Config{})
	if err != nil {
		t.Fatalf("BuildDepositFunds returned error: %v", err)
	}
	if unsigned.XDR == "" {
		t.Fatal("BuildDepositFunds returned an empty XDR envelope")
	}

	generic, err := txnbuild.TransactionFromXDR(unsigned.XDR)
	if err != nil {
		t.Fatalf("parsing unsigned envelope: %v", err)
	}
	tx, ok := generic.Transaction()
	if !ok {
		t.Fatal("unsigned envelope is not a simple transaction")
	}
	if n := len(tx.Signatures()); n != 0 {
		t.Fatalf("unsigned envelope has %d signatures, want 0", n)
	}
}

func TestBuildDepositFunds_SimulationError(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	rpc.simulateFn = func(_ context.Context, _ protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #6)"}, nil
	}

	_, err = BuildDepositFunds(context.Background(), rpc, contract, testAccountAddress, testTokenAddress, 10_000_000, Config{})
	var simErr *SimulationError
	if !errors.As(err, &simErr) {
		t.Fatalf("BuildDepositFunds error = %v (%T), want *SimulationError", err, err)
	}
}

// TestSubmitSigned_Success proves the submit-only half of the non-custodial
// path against the shared mockRPC: given a transaction already signed
// elsewhere, SubmitSigned should submit it and poll for confirmation
// exactly like Submit's second half does.
func TestSubmitSigned_Success(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})

	hf, err := GetBalanceHostFunction(contract, testAccountAddress)
	if err != nil {
		t.Fatalf("GetBalanceHostFunction: %v", err)
	}
	unsigned, err := BuildUnsigned(context.Background(), rpc, testAccountAddress, hf, Config{})
	if err != nil {
		t.Fatalf("BuildUnsigned: %v", err)
	}

	source, err := keypair.Random()
	if err != nil {
		t.Fatalf("generating test keypair: %v", err)
	}
	generic, err := txnbuild.TransactionFromXDR(unsigned.XDR)
	if err != nil {
		t.Fatalf("parsing unsigned envelope: %v", err)
	}
	tx, ok := generic.Transaction()
	if !ok {
		t.Fatal("unsigned envelope is not a simple transaction")
	}
	signed, err := tx.Sign(network.TestNetworkPassphrase, source)
	if err != nil {
		t.Fatalf("signing transaction: %v", err)
	}
	signedB64, err := signed.Base64()
	if err != nil {
		t.Fatalf("encoding signed transaction: %v", err)
	}

	result, err := SubmitSigned(context.Background(), rpc, signedB64, Config{})
	if err != nil {
		t.Fatalf("SubmitSigned returned error: %v", err)
	}
	if result.Hash != "deadbeef" {
		t.Fatalf("result.Hash = %q, want %q", result.Hash, "deadbeef")
	}
}

// --- GetBalance --------------------------------------------------------------

func TestGetBalance_NeverSubmits(t *testing.T) {
	contract, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	sorobanDataB64, err := xdr.MarshalBase64(xdr.SorobanTransactionData{})
	if err != nil {
		t.Fatalf("marshaling empty SorobanTransactionData: %v", err)
	}
	returnValB64, err := xdr.MarshalBase64(xdr.ScVal{Type: xdr.ScValTypeScvI128, I128: &xdr.Int128Parts{Hi: 0, Lo: 12345}})
	if err != nil {
		t.Fatalf("marshaling test return value: %v", err)
	}

	rpc := &mockRPC{
		loadAccountFn: func(_ context.Context, address string) (txnbuild.Account, error) {
			return &txnbuild.SimpleAccount{AccountID: address, Sequence: 1}, nil
		},
		simulateFn: func(_ context.Context, _ protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
			return protocol.SimulateTransactionResponse{
				TransactionDataXDR: sorobanDataB64,
				MinResourceFee:     100,
				Results: []protocol.SimulateHostFunctionResult{
					{ReturnValueXDR: &returnValB64},
				},
			}, nil
		},
		// sendFn and getFn are deliberately left nil: GetBalance must never
		// call SendTransaction or GetTransaction. A regression that made it
		// submit would panic here on the nil function value instead of
		// silently passing.
	}

	balance, err := GetBalance(context.Background(), rpc, contract, testAccountAddress, Config{})
	if err != nil {
		t.Fatalf("GetBalance returned error: %v", err)
	}
	if balance != 12345 {
		t.Fatalf("balance = %d, want 12345", balance)
	}
}
