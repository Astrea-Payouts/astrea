package escrow

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/protocols/stellarcore"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

// Real testnet addresses (smart-contracts/astrea/contracts/event-escrow/README.md's
// reference run) and a real deployed contract id, used here purely as
// well-formed strkeys — none of these tests touch the network.
const (
	testAccountAddress  = "GCRN2BZIQPZ3AYMJUWB2FTQQD2BFQYCFS6UF7ELWIC2RRDTDXND4XI23"
	testContractAddress = "CAD5IOA2FFSUTRIHEK6YQ2BPO2JVDPXYRXBVMPBBWFQEWRWKFRG36TQH"
)

// --- address.go -------------------------------------------------------

func TestEncodeAddress_AccountAddress(t *testing.T) {
	scVal, err := EncodeAddress(testAccountAddress)
	if err != nil {
		t.Fatalf("EncodeAddress(%q) returned error: %v", testAccountAddress, err)
	}
	if scVal.Type != xdr.ScValTypeScvAddress {
		t.Fatalf("expected ScvAddress, got %v", scVal.Type)
	}
	addr := scVal.Address
	if addr == nil || addr.Type != xdr.ScAddressTypeScAddressTypeAccount || addr.AccountId == nil {
		t.Fatalf("expected an account ScAddress, got %+v", addr)
	}
	if got := addr.AccountId.Address(); got != testAccountAddress {
		t.Fatalf("round-tripped account address = %q, want %q", got, testAccountAddress)
	}
}

// TestEncodeAddress_ContractAddress is the regression test for K02 finding
// 3: naively assuming every Address argument is a G... account address
// breaks on a C... contract address (K02's `token` argument to
// `initialize`). This test fails red if EncodeAddress's fallback to the
// contract encoding is ever removed or short-circuited — see this task's
// PR description for the actual before/after `go test` output proving it.
func TestEncodeAddress_ContractAddress(t *testing.T) {
	scVal, err := EncodeAddress(testContractAddress)
	if err != nil {
		t.Fatalf("EncodeAddress(%q) returned error: %v", testContractAddress, err)
	}
	if scVal.Type != xdr.ScValTypeScvAddress {
		t.Fatalf("expected ScvAddress, got %v", scVal.Type)
	}
	addr := scVal.Address
	if addr == nil || addr.Type != xdr.ScAddressTypeScAddressTypeContract || addr.ContractId == nil {
		t.Fatalf("expected a contract ScAddress, got %+v", addr)
	}

	want, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("ContractAddress(%q) returned error: %v", testContractAddress, err)
	}
	if !reflect.DeepEqual(*addr, want) {
		t.Fatalf("round-tripped contract ScAddress = %+v, want %+v", *addr, want)
	}
}

func TestEncodeAddress_Invalid(t *testing.T) {
	_, err := EncodeAddress("not-a-real-strkey")
	if err == nil {
		t.Fatal("expected an error for a malformed address, got nil")
	}
}

// --- pipeline.go --------------------------------------------------------

// mockRPC is a network-free stand-in for RPCClient. Each field defaults to
// a happy-path response; tests override only what they need to exercise.
type mockRPC struct {
	loadAccountFn func(ctx context.Context, address string) (txnbuild.Account, error)
	simulateFn    func(ctx context.Context, req protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error)
	sendFn        func(ctx context.Context, req protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error)
	getFn         func(ctx context.Context, req protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error)
}

func (m *mockRPC) LoadAccount(ctx context.Context, address string) (txnbuild.Account, error) {
	return m.loadAccountFn(ctx, address)
}

func (m *mockRPC) SimulateTransaction(ctx context.Context, req protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
	return m.simulateFn(ctx, req)
}

func (m *mockRPC) SendTransaction(ctx context.Context, req protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error) {
	return m.sendFn(ctx, req)
}

func (m *mockRPC) GetTransaction(ctx context.Context, req protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
	return m.getFn(ctx, req)
}

func testHostFunction(t *testing.T) xdr.HostFunction {
	t.Helper()
	contractAddr, err := ContractAddress(testContractAddress)
	if err != nil {
		t.Fatalf("building test host function: %v", err)
	}
	return xdr.HostFunction{
		Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
		InvokeContract: &xdr.InvokeContractArgs{
			ContractAddress: contractAddr,
			FunctionName:    xdr.ScSymbol("get_balance"),
		},
	}
}

// happyMockRPC returns a mock that would carry a Submit call all the way to
// a successful confirmation, so individual tests only need to override the
// one stage they're exercising.
func happyMockRPC(t *testing.T, returnVal xdr.ScVal) *mockRPC {
	t.Helper()

	sorobanDataB64, err := xdr.MarshalBase64(xdr.SorobanTransactionData{})
	if err != nil {
		t.Fatalf("marshaling empty SorobanTransactionData: %v", err)
	}
	returnValB64, err := xdr.MarshalBase64(returnVal)
	if err != nil {
		t.Fatalf("marshaling test return value: %v", err)
	}

	return &mockRPC{
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
		sendFn: func(_ context.Context, _ protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error) {
			return protocol.SendTransactionResponse{Status: stellarcore.TXStatusPending, Hash: "deadbeef"}, nil
		},
		getFn: func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
			return protocol.GetTransactionResponse{
				TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusSuccess},
			}, nil
		},
	}
}

func TestSubmit_Success(t *testing.T) {
	source, err := keypair.Random()
	if err != nil {
		t.Fatalf("generating test keypair: %v", err)
	}
	wantReturn := xdr.ScVal{Type: xdr.ScValTypeScvI128, I128: &xdr.Int128Parts{Hi: 0, Lo: 42}}
	rpc := happyMockRPC(t, wantReturn)

	result, err := Submit(context.Background(), rpc, source, network.TestNetworkPassphrase, testHostFunction(t), Config{})
	if err != nil {
		t.Fatalf("Submit returned error: %v", err)
	}
	if result.Hash != "deadbeef" {
		t.Errorf("result.Hash = %q, want %q", result.Hash, "deadbeef")
	}
	if !reflect.DeepEqual(result.ReturnValue, wantReturn) {
		t.Errorf("result.ReturnValue = %+v, want %+v", result.ReturnValue, wantReturn)
	}
}

func TestSubmit_SimulationError(t *testing.T) {
	source, err := keypair.Random()
	if err != nil {
		t.Fatalf("generating test keypair: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	rpc.simulateFn = func(_ context.Context, _ protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #7)"}, nil
	}

	_, err = Submit(context.Background(), rpc, source, network.TestNetworkPassphrase, testHostFunction(t), Config{})

	var simErr *SimulationError
	if !errors.As(err, &simErr) {
		t.Fatalf("Submit error = %v (%T), want *SimulationError", err, err)
	}
}

func TestSubmit_SubmissionError(t *testing.T) {
	source, err := keypair.Random()
	if err != nil {
		t.Fatalf("generating test keypair: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	rpc.sendFn = func(_ context.Context, _ protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error) {
		return protocol.SendTransactionResponse{Status: stellarcore.TXStatusError, ErrorResultXDR: "some-error-xdr"}, nil
	}

	_, err = Submit(context.Background(), rpc, source, network.TestNetworkPassphrase, testHostFunction(t), Config{})

	var subErr *SubmissionError
	if !errors.As(err, &subErr) {
		t.Fatalf("Submit error = %v (%T), want *SubmissionError", err, err)
	}
}

func TestSubmit_OnChainError(t *testing.T) {
	source, err := keypair.Random()
	if err != nil {
		t.Fatalf("generating test keypair: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		return protocol.GetTransactionResponse{
			TransactionDetails: protocol.TransactionDetails{
				Status:    protocol.TransactionStatusFailed,
				ResultXDR: "some-failure-xdr",
			},
		}, nil
	}

	_, err = Submit(context.Background(), rpc, source, network.TestNetworkPassphrase, testHostFunction(t), Config{})

	var chainErr *OnChainError
	if !errors.As(err, &chainErr) {
		t.Fatalf("Submit error = %v (%T), want *OnChainError", err, err)
	}
}

// TestSubmit_PollTimeout proves the poll loop is bounded: an RPC client
// that reports the transaction as perpetually pending must still produce a
// *TimeoutError within Config.PollTimeout, not hang. The bound is set in
// milliseconds specifically so this test runs in well under a second.
func TestSubmit_PollTimeout(t *testing.T) {
	source, err := keypair.Random()
	if err != nil {
		t.Fatalf("generating test keypair: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		// Neither SUCCESS nor FAILED - simulates a transaction that never
		// confirms (e.g. stuck as NOT_FOUND/PENDING forever).
		return protocol.GetTransactionResponse{
			TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusNotFound},
		}, nil
	}

	cfg := Config{
		PollTimeout:     150 * time.Millisecond,
		PollInterval:    20 * time.Millisecond,
		MaxPollInterval: 40 * time.Millisecond,
	}

	start := time.Now()
	_, err = Submit(context.Background(), rpc, source, network.TestNetworkPassphrase, testHostFunction(t), cfg)
	elapsed := time.Since(start)

	var timeoutErr *TimeoutError
	if !errors.As(err, &timeoutErr) {
		t.Fatalf("Submit error = %v (%T), want *TimeoutError", err, err)
	}
	if elapsed > 5*time.Second {
		t.Fatalf("Submit took %s to time out, want well under 5s (bound was %s)", elapsed, cfg.PollTimeout)
	}
}
