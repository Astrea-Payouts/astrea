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

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

// testResolverAddressStr is a real, verified testnet strkey (reused from
// escrow/lifecycle_test.go's testResolverAddress) -- used here purely as a
// well-formed default-resolver return value; none of these tests touch the
// network.
const testResolverAddressStr = "GDCYCXUVREFDIJGGVCLSFQLMB7GQLX7MNLBMIAXDVVWPRUA66HOVMR5L"

func newCreateDeps(t *testing.T, fs *fakeStore, rpc *mockRPC) Deps {
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

// happyCreateMockRPC returns a mock whose simulateFn always answers with a
// well-formed Address ScVal -- valid both as GetDefaultResolver's own
// return value and as CreateEventHostFunction's (BuildUnsigned doesn't
// care what type a build-time return value is).
func happyCreateMockRPC(t *testing.T) *mockRPC {
	t.Helper()
	resolverVal, err := escrow.EncodeAddress(testResolverAddressStr)
	if err != nil {
		t.Fatalf("EncodeAddress: %v", err)
	}
	return happyMockRPC(t, resolverVal)
}

// baseCreateEvent builds a DRAFT, not-yet-on-chain event with two prizes
// and one ACTIVE judge -- create_event's reward is sum(Prizes.Amount)
// (issue #11 decision 2), so the two prizes exist to prove that summation.
func baseCreateEvent(t *testing.T, organizer string) *store.EventForCreate {
	t.Helper()
	return &store.EventForCreate{
		ID:                     testEventID,
		Status:                 "DRAFT",
		EscrowEventID:          nil,
		OrganizerWalletAddress: organizer,
		Judges:                 []string{mustRandomAddress(t)},
		Prizes: []store.Prize{
			{ID: testPrize1ID, Rank: 1, Amount: "50.0000000"},
			{ID: testPrize2ID, Rank: 2, Amount: "25.5000000"},
		},
	}
}

func buildCreateOp(t *testing.T, router http.Handler, event *store.EventForCreate) createBuildResponse {
	t.Helper()
	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/build", event.OrganizerWalletAddress, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("build status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var body createBuildResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode build response: %v", err)
	}
	return body
}

// --- /create/build: path validation and preconditions ---------------------

func TestCreateBuild_EventNotFound(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	organizer := mustRandomAddress(t)

	t.Run("malformed id", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/events/not-a-uuid/create/build", organizer, nil)
		assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
	})
	t.Run("unknown id", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/events/"+testEventID+"/create/build", organizer, nil)
		assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
	})
}

func TestCreateBuild_Preconditions(t *testing.T) {
	cases := []struct {
		name           string
		mutate         func(*store.EventForCreate)
		useOtherWallet bool
		wantStatus     int
		wantCode       string
	}{
		{name: "not draft", mutate: func(e *store.EventForCreate) { e.Status = "LIVE" }, wantStatus: http.StatusConflict, wantCode: "event_not_draft"},
		{name: "already on chain", mutate: func(e *store.EventForCreate) { id := testEscrowEventIDHex; e.EscrowEventID = &id }, wantStatus: http.StatusConflict, wantCode: "event_already_on_chain"},
		{name: "no prizes", mutate: func(e *store.EventForCreate) { e.Prizes = nil }, wantStatus: http.StatusConflict, wantCode: "no_prizes"},
		{name: "no judges", mutate: func(e *store.EventForCreate) { e.Judges = nil }, wantStatus: http.StatusConflict, wantCode: "judge_ambiguous"},
		{name: "two judges", mutate: func(e *store.EventForCreate) { e.Judges = append(e.Judges, e.Judges[0]) }, wantStatus: http.StatusConflict, wantCode: "judge_ambiguous"},
		{name: "wrong wallet", mutate: func(e *store.EventForCreate) {}, useOtherWallet: true, wantStatus: http.StatusForbidden, wantCode: "not_organizer"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			organizer := mustRandomAddress(t)
			event := baseCreateEvent(t, organizer)
			tc.mutate(event)
			fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
			router := New(Deps{ServiceToken: testServiceToken, Store: fs})

			wallet := organizer
			if tc.useOtherWallet {
				wallet = mustRandomAddress(t)
			}
			rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/build", wallet, nil)
			assertErrorStatus(t, rec, tc.wantStatus, tc.wantCode)
		})
	}
}

func TestCreateBuild_LoadEventInternalError(t *testing.T) {
	organizer := mustRandomAddress(t)
	fs := &fakeStore{loadEventForCreateErr: errors.New("connection reset")}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+testEventID+"/create/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestCreateBuild_ResolverSimulationFailed(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	rpc := happyCreateMockRPC(t)
	rpc.simulateFn = func(_ context.Context, _ protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #7)"}, nil
	}
	router := New(newCreateDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusBadGateway, "simulation_failed")
}

func TestCreateBuild_CreateEventSimulationFailed(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	rpc := happyCreateMockRPC(t)
	calls := 0
	rpc.simulateFn = func(_ context.Context, req protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		calls++
		if calls == 1 {
			// The GetDefaultResolver read succeeds...
			resolverVal, err := escrow.EncodeAddress(testResolverAddressStr)
			if err != nil {
				t.Fatalf("EncodeAddress: %v", err)
			}
			return happyMockRPC(t, resolverVal).simulateFn(context.Background(), req)
		}
		// ...but the create_event build itself fails.
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #3)"}, nil
	}
	router := New(newCreateDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusBadGateway, "simulation_failed")
}

func TestCreateBuild_SaveCreateBuildInternalError(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}, saveCreateBuildErr: errors.New("connection reset")}
	router := New(newCreateDeps(t, fs, happyCreateMockRPC(t)))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestCreateBuild_AlreadySucceeded(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}, saveCreateBuildErr: store.ErrAlreadySucceeded}
	router := New(newCreateDeps(t, fs, happyCreateMockRPC(t)))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusConflict, "create_already_succeeded")
}

func TestCreateBuild_Success(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	router := New(newCreateDeps(t, fs, happyCreateMockRPC(t)))

	built := buildCreateOp(t, router, event)
	if built.Reward != 75_500_0000 {
		t.Errorf("reward = %d, want %d (50 + 25.5 in stroops)", built.Reward, 75_500_0000)
	}
	if len(built.EscrowEventID) != 32 {
		t.Errorf("escrowEventId = %q, want 32 hex characters", built.EscrowEventID)
	}
	if built.UnsignedTransactionXDR == "" {
		t.Errorf("unsignedTransactionXdr is empty")
	}
	op, ok := fs.createOps[event.ID]
	if !ok {
		t.Fatalf("no create op persisted for event %s", event.ID)
	}
	if op.Status != store.OpStatusPending {
		t.Errorf("op status = %q, want PENDING", op.Status)
	}
	if op.Build.EscrowEventID != built.EscrowEventID {
		t.Errorf("persisted escrowEventId = %q, want %q", op.Build.EscrowEventID, built.EscrowEventID)
	}
}

func TestCreateBuild_RebuildGeneratesNewEventID(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	router := New(newCreateDeps(t, fs, happyCreateMockRPC(t)))

	first := buildCreateOp(t, router, event)
	second := buildCreateOp(t, router, event)

	if first.EscrowEventID == second.EscrowEventID {
		t.Errorf("rebuilding a still-PENDING create op must generate a new escrowEventId, got the same one twice: %q", first.EscrowEventID)
	}
	if fs.createOps[event.ID].Build.EscrowEventID != second.EscrowEventID {
		t.Errorf("persisted escrowEventId = %q, want the latest build's %q", fs.createOps[event.ID].Build.EscrowEventID, second.EscrowEventID)
	}
}

// --- /create/submit: path validation, preconditions, request validation --

func TestCreateSubmit_EventNotFound(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	organizer := mustRandomAddress(t)

	rec := doJSON(t, router, http.MethodPost, "/events/not-a-uuid/create/submit", organizer, nil)
	assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
}

func TestCreateSubmit_Preconditions(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	event.Status = "LIVE"
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer, createSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusConflict, "event_not_draft")
}

func TestCreateSubmit_InvalidRequest(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	t.Run("bad json", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/events/"+event.ID+"/create/submit", strings.NewReader("{not json"))
		req.Header.Set("Authorization", "Bearer "+testServiceToken)
		req.Header.Set("X-Astrea-Wallet", organizer)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
	t.Run("empty xdr", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer, createSubmitRequest{SignedTransactionXDR: ""})
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
}

func TestCreateSubmit_NoPendingCreate(t *testing.T) {
	organizer := mustRandomAddress(t)

	t.Run("never built", func(t *testing.T) {
		event := baseCreateEvent(t, organizer)
		fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
		router := New(Deps{ServiceToken: testServiceToken, Store: fs})
		rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer, createSubmitRequest{SignedTransactionXDR: "AAAA"})
		assertErrorStatus(t, rec, http.StatusConflict, "no_pending_create")
	})
	t.Run("previous attempt failed", func(t *testing.T) {
		event := baseCreateEvent(t, organizer)
		fs := &fakeStore{
			createEvents: map[string]*store.EventForCreate{event.ID: event},
			createOps:    map[string]*store.CreateOp{event.ID: {Status: store.OpStatusFailed, Build: store.CreateBuild{SourceAccount: organizer}}},
		}
		router := New(Deps{ServiceToken: testServiceToken, Store: fs})
		rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer, createSubmitRequest{SignedTransactionXDR: "AAAA"})
		assertErrorStatus(t, rec, http.StatusConflict, "no_pending_create")
	})
}

func TestCreateSubmit_AlreadySucceeded(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	fs := &fakeStore{
		createEvents: map[string]*store.EventForCreate{event.ID: event},
		createOps:    map[string]*store.CreateOp{event.ID: {Status: store.OpStatusSucceeded, Build: store.CreateBuild{SourceAccount: organizer}}},
	}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer, createSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusConflict, "create_already_succeeded")
}

func TestCreateSubmit_LoadCreateOpInternalError(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}, loadCreateOpErr: errors.New("connection reset")}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer, createSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestCreateSubmit_UnexpectedOpStatus(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseCreateEvent(t, organizer)
	fs := &fakeStore{
		createEvents: map[string]*store.EventForCreate{event.ID: event},
		createOps:    map[string]*store.CreateOp{event.ID: {Status: "SOMETHING_ELSE"}},
	}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer, createSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestCreateSubmit_EnvelopeMismatch(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseCreateEvent(t, organizer.Address())
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	rpc := happyCreateMockRPC(t)
	router := New(newCreateDeps(t, fs, rpc))

	buildCreateOp(t, router, event) // populates fs's PENDING op with the real host function XDR

	contract := testContractScAddress(t)
	altEventID, err := escrow.NewEventID()
	if err != nil {
		t.Fatalf("NewEventID: %v", err)
	}
	altUnsigned, err := escrow.BuildCreateEvent(context.Background(), rpc, contract, organizer.Address(), event.Judges[0], testResolverAddressStr, testUSDCContractAddressStr, 999, altEventID, escrow.Config{})
	if err != nil {
		t.Fatalf("BuildCreateEvent (alt): %v", err)
	}
	signedXDR := signTx(t, altUnsigned.XDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer.Address(), createSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusConflict, "envelope_mismatch")
}

func TestCreateSubmit_SubmissionFailed(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseCreateEvent(t, organizer.Address())
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	rpc := happyCreateMockRPC(t)
	router := New(newCreateDeps(t, fs, rpc))

	built := buildCreateOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rpc.sendFn = func(_ context.Context, _ protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error) {
		return protocol.SendTransactionResponse{Status: stellarcore.TXStatusError, ErrorResultXDR: "boom"}, nil
	}

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer.Address(), createSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusBadGateway, "submission_failed")
	if len(fs.createFailedCalls) != 1 || fs.createFailedCalls[0].eventID != event.ID {
		t.Errorf("MarkCreateFailed calls = %+v, want exactly one for event %s", fs.createFailedCalls, event.ID)
	}
	if fs.createOps[event.ID].Status != store.OpStatusFailed {
		t.Errorf("op status = %q, want FAILED", fs.createOps[event.ID].Status)
	}
	if event.Status != "DRAFT" {
		t.Errorf("event status = %q, want DRAFT (a failed submit must not move the event)", event.Status)
	}
}

func TestCreateSubmit_OnChainFailed(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseCreateEvent(t, organizer.Address())
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	rpc := happyCreateMockRPC(t)
	router := New(newCreateDeps(t, fs, rpc))

	built := buildCreateOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		return protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusFailed}}, nil
	}

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer.Address(), createSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusBadGateway, "on_chain_failed")
	if len(fs.createFailedCalls) != 1 || fs.createFailedCalls[0].eventID != event.ID {
		t.Errorf("MarkCreateFailed calls = %+v, want exactly one for event %s", fs.createFailedCalls, event.ID)
	}
}

func TestCreateSubmit_Timeout(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseCreateEvent(t, organizer.Address())
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	rpc := happyCreateMockRPC(t)
	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		return protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusNotFound}}, nil
	}
	deps := newCreateDeps(t, fs, rpc)
	deps.EscrowCfg = escrow.Config{PollTimeout: 20 * time.Millisecond, PollInterval: 5 * time.Millisecond, MaxPollInterval: 5 * time.Millisecond}
	router := New(deps)

	built := buildCreateOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer.Address(), createSubmitRequest{SignedTransactionXDR: signedXDR})
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202; body: %s", rec.Code, rec.Body.String())
	}
	var body createSubmitResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "pending" {
		t.Errorf("status = %q, want %q", body.Status, "pending")
	}
	if fs.createOps[event.ID].Status != store.OpStatusPending {
		t.Errorf("op status = %q, want PENDING (a timeout must not mark the op failed or succeeded)", fs.createOps[event.ID].Status)
	}
	if len(fs.createFailedCalls) != 0 {
		t.Errorf("MarkCreateFailed must not be called on timeout, got %+v", fs.createFailedCalls)
	}
	if event.Status != "DRAFT" {
		t.Errorf("event status = %q, want DRAFT (a timeout must not move the event)", event.Status)
	}
}

func TestCreateSubmit_MarkCreateSucceededInternalError(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseCreateEvent(t, organizer.Address())
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}, markCreateSucceededErr: errors.New("connection reset")}
	rpc := happyCreateMockRPC(t)
	router := New(newCreateDeps(t, fs, rpc))

	built := buildCreateOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer.Address(), createSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestCreateSubmit_Success(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseCreateEvent(t, organizer.Address())
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	rpc := happyCreateMockRPC(t)
	router := New(newCreateDeps(t, fs, rpc))

	built := buildCreateOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer.Address(), createSubmitRequest{SignedTransactionXDR: signedXDR})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var body createSubmitResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "succeeded" {
		t.Errorf("status = %q, want %q", body.Status, "succeeded")
	}
	if body.EscrowEventID != built.EscrowEventID {
		t.Errorf("escrowEventId = %q, want %q", body.EscrowEventID, built.EscrowEventID)
	}
	if len(fs.createSucceededCalls) != 1 || fs.createSucceededCalls[0].eventID != event.ID {
		t.Errorf("MarkCreateSucceeded calls = %+v, want exactly one for event %s", fs.createSucceededCalls, event.ID)
	}
	if fs.createOps[event.ID].Status != store.OpStatusSucceeded {
		t.Errorf("op status = %q, want SUCCEEDED", fs.createOps[event.ID].Status)
	}
	// Issue #11 decision 4: a successful create_event moves the event to
	// CREATED ("startable"), never straight to LIVE -- only PR 2's
	// /start/submit does that.
	if event.Status != "CREATED" {
		t.Errorf("event status = %q, want CREATED (never LIVE)", event.Status)
	}
	if event.EscrowEventID == nil || *event.EscrowEventID != built.EscrowEventID {
		t.Errorf("event.EscrowEventID = %v, want %q", event.EscrowEventID, built.EscrowEventID)
	}
}

// TestCreateSubmit_BuildReplacedWhileSubmitInFlight reproduces the race
// MarkCreateSucceeded guards against: build A, start submitting it against a
// slow RPC, and while that submission is still polling for confirmation, a
// rebuild (build B) lands and overwrites the event's single create_event
// op_log row. When A's slow poll finally reports success, confirming must
// fail -- the row it would confirm is no longer A's build -- leaving the
// event in DRAFT and the op_log row PENDING with B's data untouched.
func TestCreateSubmit_BuildReplacedWhileSubmitInFlight(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseCreateEvent(t, organizer.Address())
	fs := &fakeStore{createEvents: map[string]*store.EventForCreate{event.ID: event}}
	rpc := happyCreateMockRPC(t)
	router := New(newCreateDeps(t, fs, rpc))

	buildA := buildCreateOp(t, router, event)
	signedA := signTx(t, buildA.UnsignedTransactionXDR, organizer)

	var buildB createBuildResponse
	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		// A's confirmation poll is "slow" -- while it's still in flight, a
		// rebuild happens and overwrites the shared op_log row.
		buildB = buildCreateOp(t, router, event)
		return protocol.GetTransactionResponse{
			TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusSuccess},
		}, nil
	}

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/create/submit", organizer.Address(), createSubmitRequest{SignedTransactionXDR: signedA})
	assertErrorStatus(t, rec, http.StatusConflict, "create_build_replaced")

	if buildB.EscrowEventID == "" || buildB.EscrowEventID == buildA.EscrowEventID {
		t.Fatalf("build B did not produce a fresh escrowEventId distinct from A's: A=%q B=%q", buildA.EscrowEventID, buildB.EscrowEventID)
	}
	if len(fs.createSucceededCalls) != 0 {
		t.Errorf("MarkCreateSucceeded must not have recorded a success, got %+v", fs.createSucceededCalls)
	}
	if event.Status != "DRAFT" {
		t.Errorf("event status = %q, want DRAFT (A's stale confirmation must not move it)", event.Status)
	}
	if event.EscrowEventID != nil {
		t.Errorf("event.EscrowEventID = %v, want nil", event.EscrowEventID)
	}

	op, ok := fs.createOps[event.ID]
	if !ok {
		t.Fatalf("no create op left for event %s", event.ID)
	}
	if op.Status != store.OpStatusPending {
		t.Errorf("op status = %q, want PENDING (still B's unconfirmed build)", op.Status)
	}
	if op.Build.EscrowEventID != buildB.EscrowEventID {
		t.Errorf("op.Build.EscrowEventID = %q, want B's %q", op.Build.EscrowEventID, buildB.EscrowEventID)
	}
}
