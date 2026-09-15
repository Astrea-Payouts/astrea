package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stellar/go/network"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/protocols/stellarcore"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

// testUSDCContractAddressStr is a real, verified testnet USDC SAC id
// (internal/escrow/asset_test.go's TestClassicAssetContractID vector) --
// used here purely as a well-formed token address; none of these tests
// touch the network.
const testUSDCContractAddressStr = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

func newWalletDeps(t *testing.T, fs *fakeStore, rpc *mockRPC) Deps {
	t.Helper()
	return Deps{
		ServiceToken:      testServiceToken,
		Store:             fs,
		RPC:               rpc,
		Contract:          testContractScAddress(t),
		NetworkPassphrase: network.TestNetworkPassphrase,
		USDCContractID:    testUSDCContractAddressStr,
	}
}

// --- GET /wallets/{address}/balance ---------------------------------------

func TestWalletBalance_MalformedAddress(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	req := httptest.NewRequest(http.MethodGet, "/wallets/not-an-address/balance", nil)
	req.Header.Set("Authorization", "Bearer "+testServiceToken)
	req.Header.Set("X-Astrea-Wallet", validWallet(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_wallet")
}

func TestWalletBalance_WalletMismatch(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	address := mustRandomAddress(t)
	other := mustRandomAddress(t)

	rec := doJSON(t, router, http.MethodGet, "/wallets/"+address+"/balance", other, nil)
	assertErrorStatus(t, rec, http.StatusForbidden, "not_wallet_owner")
}

func TestWalletBalance_SimulationFailed(t *testing.T) {
	address := mustRandomAddress(t)
	rpc := happyMockRPC(t, escrow.EncodeI128(0))
	rpc.simulateFn = func(_ context.Context, _ protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #7)"}, nil
	}
	router := New(newWalletDeps(t, &fakeStore{}, rpc))

	rec := doJSON(t, router, http.MethodGet, "/wallets/"+address+"/balance", address, nil)
	assertErrorStatus(t, rec, http.StatusBadGateway, "simulation_failed")
}

func TestWalletBalance_InternalError(t *testing.T) {
	address := mustRandomAddress(t)
	rpc := happyMockRPC(t, escrow.EncodeI128(0))
	rpc.loadAccountFn = func(_ context.Context, _ string) (txnbuild.Account, error) {
		return nil, errors.New("connection reset")
	}
	router := New(newWalletDeps(t, &fakeStore{}, rpc))

	rec := doJSON(t, router, http.MethodGet, "/wallets/"+address+"/balance", address, nil)
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestWalletBalance_Success(t *testing.T) {
	address := mustRandomAddress(t)
	rpc := happyMockRPC(t, escrow.EncodeI128(123_456_789))
	router := New(newWalletDeps(t, &fakeStore{}, rpc))

	rec := doJSON(t, router, http.MethodGet, "/wallets/"+address+"/balance", address, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var body walletBalanceResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Address != address {
		t.Errorf("address = %q, want %q", body.Address, address)
	}
	if body.Balance != "123456789" {
		t.Errorf("balance = %q, want %q", body.Balance, "123456789")
	}
}

// --- POST /wallets/{address}/deposit/build --------------------------------

func TestDepositBuild_WalletMismatch(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	address := mustRandomAddress(t)
	other := mustRandomAddress(t)

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/build", other, depositBuildRequest{Amount: "10.0000000"})
	assertErrorStatus(t, rec, http.StatusForbidden, "not_wallet_owner")
}

func TestDepositBuild_InvalidRequest(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	address := mustRandomAddress(t)

	req := httptest.NewRequest(http.MethodPost, "/wallets/"+address+"/deposit/build", strings.NewReader("{not json"))
	req.Header.Set("Authorization", "Bearer "+testServiceToken)
	req.Header.Set("X-Astrea-Wallet", address)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
}

func TestDepositBuild_InvalidAmount(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	address := mustRandomAddress(t)

	cases := []struct {
		name   string
		amount string
	}{
		{"empty", ""},
		{"negative", "-10.0000000"},
		{"zero", "0"},
		{"too many decimals", "1.00000001"},
		{"not a number", "abc"},
		{"exceeds cap", "1000001"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/build", address, depositBuildRequest{Amount: tc.amount})
			assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_amount")
		})
	}
}

func TestDepositBuild_SimulationFailed(t *testing.T) {
	address := mustRandomAddress(t)
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	rpc.simulateFn = func(_ context.Context, _ protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #7)"}, nil
	}
	router := New(newWalletDeps(t, &fakeStore{}, rpc))

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/build", address, depositBuildRequest{Amount: "10.0000000"})
	assertErrorStatus(t, rec, http.StatusBadGateway, "simulation_failed")
}

func TestDepositBuild_SaveDepositBuildInternalError(t *testing.T) {
	address := mustRandomAddress(t)
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	fs := &fakeStore{saveDepositBuildErr: errors.New("connection reset")}
	router := New(newWalletDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/build", address, depositBuildRequest{Amount: "10.0000000"})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestDepositBuild_Success(t *testing.T) {
	address := mustRandomAddress(t)
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	fs := &fakeStore{}
	router := New(newWalletDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/build", address, depositBuildRequest{Amount: "10.0000000"})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var body depositBuildResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.OpID == "" {
		t.Errorf("opId is empty")
	}
	if body.UnsignedTransactionXDR == "" {
		t.Errorf("unsignedTransactionXdr is empty")
	}
	op, ok := fs.depositOps[body.OpID]
	if !ok {
		t.Fatalf("no deposit op persisted for opId %q", body.OpID)
	}
	if op.Status != store.OpStatusPending {
		t.Errorf("op status = %q, want PENDING", op.Status)
	}
	if op.Build.SourceAccount != address {
		t.Errorf("op source account = %q, want %q", op.Build.SourceAccount, address)
	}
	if op.Build.Amount != 100_000_000 {
		t.Errorf("op amount = %d, want %d", op.Build.Amount, 100_000_000)
	}
}

// --- POST /wallets/{address}/deposit/submit -------------------------------

func buildDepositOp(t *testing.T, router http.Handler, address string) depositBuildResponse {
	t.Helper()
	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/build", address, depositBuildRequest{Amount: "10.0000000"})
	if rec.Code != http.StatusOK {
		t.Fatalf("build status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var body depositBuildResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode build response: %v", err)
	}
	return body
}

func TestDepositSubmit_WalletMismatch(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	address := mustRandomAddress(t)
	other := mustRandomAddress(t)

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/submit", other, depositSubmitRequest{OpID: "op-1", SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusForbidden, "not_wallet_owner")
}

func TestDepositSubmit_InvalidRequest(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	address := mustRandomAddress(t)

	t.Run("bad json", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/wallets/"+address+"/deposit/submit", strings.NewReader("{not json"))
		req.Header.Set("Authorization", "Bearer "+testServiceToken)
		req.Header.Set("X-Astrea-Wallet", address)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
	t.Run("missing opId", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/submit", address, depositSubmitRequest{SignedTransactionXDR: "AAAA"})
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
	t.Run("missing signed xdr", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/submit", address, depositSubmitRequest{OpID: "op-1"})
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
}

func TestDepositSubmit_DepositNotFound(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	address := mustRandomAddress(t)

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/submit", address, depositSubmitRequest{OpID: "does-not-exist", SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusNotFound, "deposit_not_found")
}

func TestDepositSubmit_AlreadySucceeded(t *testing.T) {
	address := mustRandomAddress(t)
	fs := &fakeStore{depositOps: map[string]*store.DepositOp{
		"op-1": {Status: store.OpStatusSucceeded, Build: store.DepositBuild{SourceAccount: address}},
	}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/submit", address, depositSubmitRequest{OpID: "op-1", SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusConflict, "deposit_already_succeeded")
}

func TestDepositSubmit_PreviousAttemptFailed(t *testing.T) {
	address := mustRandomAddress(t)
	fs := &fakeStore{depositOps: map[string]*store.DepositOp{
		"op-1": {Status: store.OpStatusFailed, Build: store.DepositBuild{SourceAccount: address}},
	}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/submit", address, depositSubmitRequest{OpID: "op-1", SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusConflict, "no_pending_deposit")
}

func TestDepositSubmit_OpBuiltForOtherWallet(t *testing.T) {
	address := mustRandomAddress(t)
	otherAddress := mustRandomAddress(t)
	fs := &fakeStore{depositOps: map[string]*store.DepositOp{
		"op-1": {Status: store.OpStatusPending, Build: store.DepositBuild{SourceAccount: otherAddress}},
	}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/submit", address, depositSubmitRequest{OpID: "op-1", SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusForbidden, "not_wallet_owner")
}

func TestDepositSubmit_UnexpectedOpStatus(t *testing.T) {
	address := mustRandomAddress(t)
	fs := &fakeStore{depositOps: map[string]*store.DepositOp{
		"op-1": {Status: "SOMETHING_ELSE", Build: store.DepositBuild{SourceAccount: address}},
	}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/submit", address, depositSubmitRequest{OpID: "op-1", SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestDepositSubmit_LoadDepositOpInternalError(t *testing.T) {
	address := mustRandomAddress(t)
	fs := &fakeStore{loadDepositOpErr: errors.New("connection reset")}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+address+"/deposit/submit", address, depositSubmitRequest{OpID: "op-1", SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestDepositSubmit_EnvelopeMismatch(t *testing.T) {
	organizer := mustRandomKeypair(t)
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	fs := &fakeStore{}
	router := New(newWalletDeps(t, fs, rpc))

	built := buildDepositOp(t, router, organizer.Address())

	contract := testContractScAddress(t)
	altUnsigned, err := escrow.BuildDepositFunds(context.Background(), rpc, contract, organizer.Address(), testUSDCContractAddressStr, 999, escrow.Config{})
	if err != nil {
		t.Fatalf("BuildDepositFunds (alt): %v", err)
	}
	signedXDR := signTx(t, altUnsigned.XDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+organizer.Address()+"/deposit/submit", organizer.Address(), depositSubmitRequest{OpID: built.OpID, SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusConflict, "envelope_mismatch")
}

func TestDepositSubmit_SubmissionFailed(t *testing.T) {
	organizer := mustRandomKeypair(t)
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	fs := &fakeStore{}
	router := New(newWalletDeps(t, fs, rpc))

	built := buildDepositOp(t, router, organizer.Address())
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rpc.sendFn = func(_ context.Context, _ protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error) {
		return protocol.SendTransactionResponse{Status: stellarcore.TXStatusError, ErrorResultXDR: "boom"}, nil
	}

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+organizer.Address()+"/deposit/submit", organizer.Address(), depositSubmitRequest{OpID: built.OpID, SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusBadGateway, "submission_failed")
	if len(fs.depositFailedCalls) != 1 || fs.depositFailedCalls[0].opID != built.OpID {
		t.Errorf("MarkDepositFailed calls = %+v, want exactly one for op %s", fs.depositFailedCalls, built.OpID)
	}
	if fs.depositOps[built.OpID].Status != store.OpStatusFailed {
		t.Errorf("op status = %q, want FAILED", fs.depositOps[built.OpID].Status)
	}
}

func TestDepositSubmit_OnChainFailed(t *testing.T) {
	organizer := mustRandomKeypair(t)
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	fs := &fakeStore{}
	router := New(newWalletDeps(t, fs, rpc))

	built := buildDepositOp(t, router, organizer.Address())
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		return protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusFailed}}, nil
	}

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+organizer.Address()+"/deposit/submit", organizer.Address(), depositSubmitRequest{OpID: built.OpID, SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusBadGateway, "on_chain_failed")
	if len(fs.depositFailedCalls) != 1 || fs.depositFailedCalls[0].opID != built.OpID {
		t.Errorf("MarkDepositFailed calls = %+v, want exactly one for op %s", fs.depositFailedCalls, built.OpID)
	}
}

func TestDepositSubmit_Timeout(t *testing.T) {
	organizer := mustRandomKeypair(t)
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		return protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusNotFound}}, nil
	}
	fs := &fakeStore{}
	deps := newWalletDeps(t, fs, rpc)
	deps.EscrowCfg = escrow.Config{PollTimeout: 20 * time.Millisecond, PollInterval: 5 * time.Millisecond, MaxPollInterval: 5 * time.Millisecond}
	router := New(deps)

	built := buildDepositOp(t, router, organizer.Address())
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+organizer.Address()+"/deposit/submit", organizer.Address(), depositSubmitRequest{OpID: built.OpID, SignedTransactionXDR: signedXDR})
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202; body: %s", rec.Code, rec.Body.String())
	}
	var body depositSubmitResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "pending" {
		t.Errorf("status = %q, want %q", body.Status, "pending")
	}
	if body.TxHash == "" {
		t.Errorf("txHash is empty, want the submitted tx hash")
	}
	if fs.depositOps[built.OpID].Status != store.OpStatusPending {
		t.Errorf("op status = %q, want PENDING (a timeout must not mark the op failed or succeeded)", fs.depositOps[built.OpID].Status)
	}
	if len(fs.depositFailedCalls) != 0 {
		t.Errorf("MarkDepositFailed must not be called on timeout, got %+v", fs.depositFailedCalls)
	}
}

func TestDepositSubmit_MarkDepositSucceededInternalError(t *testing.T) {
	organizer := mustRandomKeypair(t)
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	fs := &fakeStore{markDepositSucceededErr: errors.New("connection reset")}
	router := New(newWalletDeps(t, fs, rpc))

	built := buildDepositOp(t, router, organizer.Address())
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+organizer.Address()+"/deposit/submit", organizer.Address(), depositSubmitRequest{OpID: built.OpID, SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestDepositSubmit_Success(t *testing.T) {
	organizer := mustRandomKeypair(t)
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	fs := &fakeStore{}
	router := New(newWalletDeps(t, fs, rpc))

	built := buildDepositOp(t, router, organizer.Address())
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/wallets/"+organizer.Address()+"/deposit/submit", organizer.Address(), depositSubmitRequest{OpID: built.OpID, SignedTransactionXDR: signedXDR})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var body depositSubmitResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "succeeded" {
		t.Errorf("status = %q, want %q", body.Status, "succeeded")
	}
	if body.TxHash == "" {
		t.Errorf("txHash is empty")
	}
	if len(fs.depositSucceededCalls) != 1 || fs.depositSucceededCalls[0] != built.OpID {
		t.Errorf("MarkDepositSucceeded calls = %+v, want exactly one for op %s", fs.depositSucceededCalls, built.OpID)
	}
	if fs.depositOps[built.OpID].Status != store.OpStatusSucceeded {
		t.Errorf("op status = %q, want SUCCEEDED", fs.depositOps[built.OpID].Status)
	}
}
