package escrow

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

type mockRPC struct {
	account        txnbuild.Account
	loadErr        error
	sim            protocol.SimulateTransactionResponse
	simErr         error
	send           protocol.SendTransactionResponse
	sendErr        error
	get            protocol.GetTransactionResponse
	getErr         error
	getCalls       int
	neverConfirm   bool
}

func (m *mockRPC) LoadAccount(ctx context.Context, address string) (txnbuild.Account, error) {
	if m.loadErr != nil {
		return nil, m.loadErr
	}
	if m.account != nil {
		return m.account, nil
	}
	return &txnbuild.SimpleAccount{AccountID: address, Sequence: 1}, nil
}

func (m *mockRPC) SimulateTransaction(ctx context.Context, req protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
	return m.sim, m.simErr
}

func (m *mockRPC) SendTransaction(ctx context.Context, req protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error) {
	return m.send, m.sendErr
}

func (m *mockRPC) GetTransaction(ctx context.Context, req protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
	m.getCalls++
	if m.neverConfirm {
		return protocol.GetTransactionResponse{
			TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusNotFound},
		}, m.getErr
	}
	return m.get, m.getErr
}

func nopSleep(ctx context.Context, d time.Duration) error { return nil }

func testKey(t *testing.T) *keypair.Full {
	t.Helper()
	kp, err := keypair.Random()
	if err != nil {
		t.Fatal(err)
	}
	return kp
}

func emptyHostFn() xdr.HostFunction {
	wasm := []byte{0x00}
	return xdr.HostFunction{
		Type: xdr.HostFunctionTypeHostFunctionTypeUploadContractWasm,
		Wasm: &wasm,
	}
}

func mustSorobanDataXDR(t *testing.T) string {
	t.Helper()
	var data xdr.SorobanTransactionData
	b64, err := xdr.MarshalBase64(data)
	if err != nil {
		t.Fatal(err)
	}
	return b64
}

func readySim(t *testing.T) protocol.SimulateTransactionResponse {
	t.Helper()
	return protocol.SimulateTransactionResponse{
		TransactionDataXDR: mustSorobanDataXDR(t),
		MinResourceFee:     100,
	}
}

func TestSubmitSimulationErrorFromRPC(t *testing.T) {
	t.Parallel()
	p := &Pipeline{
		RPC:               &mockRPC{simErr: errors.New("rpc down")},
		NetworkPassphrase: network.TestNetworkPassphrase,
		Sleep:             nopSleep,
	}
	_, err := p.Submit(context.Background(), testKey(t), emptyHostFn())
	var simErr *SimulateError
	if !errors.As(err, &simErr) {
		t.Fatalf("got %T %v, want *SimulateError", err, err)
	}
	var subErr *SubmitError
	if errors.As(err, &subErr) {
		t.Fatal("simulation failure must not also be *SubmitError")
	}
}

func TestSubmitSimulationErrorFromResponse(t *testing.T) {
	t.Parallel()
	p := &Pipeline{
		RPC: &mockRPC{sim: protocol.SimulateTransactionResponse{Error: "HostError: #7"}},
		NetworkPassphrase: network.TestNetworkPassphrase,
		Sleep:             nopSleep,
	}
	_, err := p.Submit(context.Background(), testKey(t), emptyHostFn())
	var simErr *SimulateError
	if !errors.As(err, &simErr) {
		t.Fatalf("got %T %v, want *SimulateError", err, err)
	}
}

func TestSubmitRejected(t *testing.T) {
	t.Parallel()
	p := &Pipeline{
		RPC: &mockRPC{
			sim:  readySim(t),
			send: protocol.SendTransactionResponse{Status: "ERROR", ErrorResultXDR: "txMALFORMED"},
		},
		NetworkPassphrase: network.TestNetworkPassphrase,
		Sleep:             nopSleep,
	}
	_, err := p.Submit(context.Background(), testKey(t), emptyHostFn())
	var subErr *SubmitError
	if !errors.As(err, &subErr) {
		t.Fatalf("got %T %v, want *SubmitError", err, err)
	}
	var simErr *SimulateError
	if errors.As(err, &simErr) {
		t.Fatal("submission failure must not also be *SimulateError")
	}
}

func TestSubmitPollTimeout(t *testing.T) {
	t.Parallel()
	p := &Pipeline{
		RPC: &mockRPC{
			sim:          readySim(t),
			send:         protocol.SendTransactionResponse{Status: "PENDING", Hash: "deadbeef"},
			neverConfirm: true,
		},
		NetworkPassphrase: network.TestNetworkPassphrase,
		PollInterval:      time.Millisecond,
		PollTimeout:       15 * time.Millisecond,
		Sleep:             nopSleep,
	}
	_, err := p.Submit(context.Background(), testKey(t), emptyHostFn())
	var to *ConfirmTimeoutError
	if !errors.As(err, &to) {
		t.Fatalf("got %T %v, want *ConfirmTimeoutError", err, err)
	}
	if to.Hash != "deadbeef" {
		t.Fatalf("hash = %s", to.Hash)
	}
	var simErr *SimulateError
	var subErr *SubmitError
	if errors.As(err, &simErr) || errors.As(err, &subErr) {
		t.Fatalf("timeout must be distinct from simulate/submit: %v", err)
	}
}

func TestSubmitSuccess(t *testing.T) {
	t.Parallel()
	p := &Pipeline{
		RPC: &mockRPC{
			sim:  readySim(t),
			send: protocol.SendTransactionResponse{Status: "PENDING", Hash: "okhash"},
			get: protocol.GetTransactionResponse{
				TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusSuccess},
			},
		},
		NetworkPassphrase: network.TestNetworkPassphrase,
		Sleep:             nopSleep,
	}
	if _, err := p.Submit(context.Background(), testKey(t), emptyHostFn()); err != nil {
		t.Fatal(err)
	}
}

func TestErrorTypesAreDistinct(t *testing.T) {
	t.Parallel()
	sim := error(&SimulateError{Msg: "x"})
	sub := error(&SubmitError{Msg: "y"})
	to := error(&ConfirmTimeoutError{Hash: "z"})

	var simE *SimulateError
	var subE *SubmitError
	var toE *ConfirmTimeoutError
	if !errors.As(sim, &simE) || errors.As(sim, &subE) || errors.As(sim, &toE) {
		t.Fatal("SimulateError must only match *SimulateError")
	}
	if !errors.As(sub, &subE) || errors.As(sub, &simE) || errors.As(sub, &toE) {
		t.Fatal("SubmitError must only match *SubmitError")
	}
	if !errors.As(to, &toE) || errors.As(to, &simE) || errors.As(to, &subE) {
		t.Fatal("ConfirmTimeoutError must only match *ConfirmTimeoutError")
	}
}
