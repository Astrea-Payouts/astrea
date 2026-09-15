package api

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stellar/go/network"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/protocols/stellarcore"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

func newStartDeps(t *testing.T, fs *fakeStore, rpc *mockRPC) Deps {
	t.Helper()
	return Deps{
		ServiceToken:      testServiceToken,
		Store:             fs,
		RPC:               rpc,
		Contract:          testContractScAddress(t),
		NetworkPassphrase: network.TestNetworkPassphrase,
	}
}

// baseStartEvent builds a CREATED, on-chain event with a judging deadline
// well in the future -- go-live's three preconditions (issue #11 PR 2).
func baseStartEvent(t *testing.T, organizer string) *store.EventForStart {
	t.Helper()
	escrowID := testEscrowEventIDHex
	deadline := time.Now().Add(48 * time.Hour).UTC()
	return &store.EventForStart{
		ID:                     testEventID,
		Status:                 "CREATED",
		EscrowEventID:          &escrowID,
		JudgingDeadlineAt:      &deadline,
		OrganizerWalletAddress: organizer,
	}
}

// happyStartMockRPC answers the first simulate call (QuoteGoLiveFee) with
// fee, the second (GetBalance) with balance, and any further call (the
// set_event_in_progress build itself, whose return value nothing decodes)
// with fee again -- mirroring happyCreateMockRPC's counter pattern for
// GetDefaultResolver vs. the create_event build itself.
func happyStartMockRPC(t *testing.T, fee, balance int64) *mockRPC {
	t.Helper()
	rpc := happyMockRPC(t, escrow.EncodeI128(fee))
	calls := 0
	rpc.simulateFn = func(ctx context.Context, req protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		calls++
		val := fee
		if calls == 2 {
			val = balance
		}
		return happyMockRPC(t, escrow.EncodeI128(val)).simulateFn(ctx, req)
	}
	return rpc
}

func buildStartOp(t *testing.T, router http.Handler, event *store.EventForStart) startBuildResponse {
	t.Helper()
	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/build", event.OrganizerWalletAddress, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("build status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var body startBuildResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode build response: %v", err)
	}
	return body
}

// TestStartEndpoints_WrongBearer confirms the three new routes sit behind
// the same RequireAuth middleware as every other authed route: a wrong
// service token is rejected before any handler runs.
func TestStartEndpoints_WrongBearer(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	wallet := mustRandomAddress(t)

	reqs := []*http.Request{
		httptest.NewRequest(http.MethodGet, "/events/"+testEventID+"/start/quote", nil),
		httptest.NewRequest(http.MethodPost, "/events/"+testEventID+"/start/build", nil),
		httptest.NewRequest(http.MethodPost, "/events/"+testEventID+"/start/submit", strings.NewReader(`{"signedTransactionXdr":"AAAA"}`)),
	}
	for _, req := range reqs {
		req.Header.Set("Authorization", "Bearer wrong-token")
		req.Header.Set("X-Astrea-Wallet", wallet)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		assertErrorStatus(t, rec, http.StatusUnauthorized, "unauthorized")
	}
}

// TestStartPreconditions_NonOrganizerBeforeConflict enforces issue #11's
// explicit ordering: the caller's identity is checked right after the
// event loads, before any state-based 409 -- a non-organizer must get 403
// even when the event also fails a later precondition, so a stranger can
// never learn the event's state from the response.
func TestStartPreconditions_NonOrganizerBeforeConflict(t *testing.T) {
	organizer := mustRandomAddress(t)
	stranger := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	event.Status = "LIVE"     // would independently 409 event_not_created
	event.EscrowEventID = nil // would independently 409 event_not_on_chain
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	quoteRec := doJSON(t, router, http.MethodGet, "/events/"+event.ID+"/start/quote", stranger, nil)
	assertErrorStatus(t, quoteRec, http.StatusForbidden, "not_organizer")

	buildRec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/build", stranger, nil)
	assertErrorStatus(t, buildRec, http.StatusForbidden, "not_organizer")

	submitRec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", stranger, startSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, submitRec, http.StatusForbidden, "not_organizer")
}

// --- GET /events/{id}/start/quote -----------------------------------------

func TestStartQuote_EventNotFound(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	organizer := mustRandomAddress(t)

	t.Run("malformed id", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodGet, "/events/not-a-uuid/start/quote", organizer, nil)
		assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
	})
	t.Run("unknown id", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodGet, "/events/"+testEventID+"/start/quote", organizer, nil)
		assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
	})
}

func TestStartQuote_Preconditions(t *testing.T) {
	cases := []struct {
		name           string
		mutate         func(*store.EventForStart)
		useOtherWallet bool
		wantStatus     int
		wantCode       string
	}{
		{name: "not created", mutate: func(e *store.EventForStart) { e.Status = "LIVE" }, wantStatus: http.StatusConflict, wantCode: "event_not_created"},
		{name: "not on chain", mutate: func(e *store.EventForStart) { e.EscrowEventID = nil }, wantStatus: http.StatusConflict, wantCode: "event_not_on_chain"},
		{name: "wrong wallet", mutate: func(e *store.EventForStart) {}, useOtherWallet: true, wantStatus: http.StatusForbidden, wantCode: "not_organizer"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			organizer := mustRandomAddress(t)
			event := baseStartEvent(t, organizer)
			tc.mutate(event)
			fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
			router := New(Deps{ServiceToken: testServiceToken, Store: fs})

			wallet := organizer
			if tc.useOtherWallet {
				wallet = mustRandomAddress(t)
			}
			rec := doJSON(t, router, http.MethodGet, "/events/"+event.ID+"/start/quote", wallet, nil)
			assertErrorStatus(t, rec, tc.wantStatus, tc.wantCode)
		})
	}
}

func TestStartQuote_LoadEventInternalError(t *testing.T) {
	organizer := mustRandomAddress(t)
	fs := &fakeStore{loadEventForStartErr: errors.New("connection reset")}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodGet, "/events/"+testEventID+"/start/quote", organizer, nil)
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestStartQuote_FeeSimulationFailed(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	rpc.simulateFn = func(_ context.Context, _ protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #7)"}, nil
	}
	router := New(newStartDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodGet, "/events/"+event.ID+"/start/quote", organizer, nil)
	assertErrorStatus(t, rec, http.StatusBadGateway, "simulation_failed")
}

func TestStartQuote_BalanceSimulationFailed(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	calls := 0
	rpc.simulateFn = func(ctx context.Context, req protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		calls++
		if calls == 1 {
			return happyMockRPC(t, escrow.EncodeI128(100)).simulateFn(ctx, req)
		}
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #7)"}, nil
	}
	router := New(newStartDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodGet, "/events/"+event.ID+"/start/quote", organizer, nil)
	assertErrorStatus(t, rec, http.StatusBadGateway, "simulation_failed")
}

func TestStartQuote_Success(t *testing.T) {
	cases := []struct {
		name          string
		fee, balance  int64
		wantShortfall string
	}{
		{"balance short of fee", 500, 200, "300"},
		{"balance covers fee", 500, 500, "0"},
		{"balance exceeds fee", 200, 500, "0"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			organizer := mustRandomAddress(t)
			event := baseStartEvent(t, organizer)
			fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
			rpc := happyStartMockRPC(t, tc.fee, tc.balance)
			router := New(newStartDeps(t, fs, rpc))

			rec := doJSON(t, router, http.MethodGet, "/events/"+event.ID+"/start/quote", organizer, nil)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
			}
			var body startQuoteResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if body.Fee != itoa(tc.fee) {
				t.Errorf("fee = %q, want %q", body.Fee, itoa(tc.fee))
			}
			if body.Balance != itoa(tc.balance) {
				t.Errorf("balance = %q, want %q", body.Balance, itoa(tc.balance))
			}
			if body.Shortfall != tc.wantShortfall {
				t.Errorf("shortfall = %q, want %q", body.Shortfall, tc.wantShortfall)
			}
		})
	}
}

func itoa(v int64) string {
	return strconv.FormatInt(v, 10)
}

// --- POST /events/{id}/start/build ----------------------------------------

func TestStartBuild_EventNotFound(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	organizer := mustRandomAddress(t)

	t.Run("malformed id", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/events/not-a-uuid/start/build", organizer, nil)
		assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
	})
	t.Run("unknown id", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/events/"+testEventID+"/start/build", organizer, nil)
		assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
	})
}

func TestStartBuild_Preconditions(t *testing.T) {
	cases := []struct {
		name           string
		mutate         func(*store.EventForStart)
		useOtherWallet bool
		wantStatus     int
		wantCode       string
	}{
		{name: "not created", mutate: func(e *store.EventForStart) { e.Status = "LIVE" }, wantStatus: http.StatusConflict, wantCode: "event_not_created"},
		{name: "not on chain", mutate: func(e *store.EventForStart) { e.EscrowEventID = nil }, wantStatus: http.StatusConflict, wantCode: "event_not_on_chain"},
		{name: "wrong wallet", mutate: func(e *store.EventForStart) {}, useOtherWallet: true, wantStatus: http.StatusForbidden, wantCode: "not_organizer"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			organizer := mustRandomAddress(t)
			event := baseStartEvent(t, organizer)
			tc.mutate(event)
			fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
			router := New(Deps{ServiceToken: testServiceToken, Store: fs})

			wallet := organizer
			if tc.useOtherWallet {
				wallet = mustRandomAddress(t)
			}
			rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/build", wallet, nil)
			assertErrorStatus(t, rec, tc.wantStatus, tc.wantCode)
		})
	}
}

func TestStartBuild_DeadlineMissing(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	event.JudgingDeadlineAt = nil
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusConflict, "deadline_missing")
}

func TestStartBuild_DeadlinePast(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	past := time.Now().Add(-1 * time.Hour).UTC()
	event.JudgingDeadlineAt = &past
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusConflict, "deadline_past")
}

func TestStartBuild_FeeSimulationFailed(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	rpc.simulateFn = func(_ context.Context, _ protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #7)"}, nil
	}
	router := New(newStartDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusBadGateway, "simulation_failed")
}

func TestStartBuild_InsufficientBalance(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 500, 200) // fee 500 > balance 200
	router := New(newStartDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusConflict, "insufficient_balance")
}

func TestStartBuild_BuildSimulationFailed(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	calls := 0
	rpc.simulateFn = func(ctx context.Context, req protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		calls++
		if calls <= 2 {
			val := int64(100)
			if calls == 2 {
				val = 200
			}
			return happyMockRPC(t, escrow.EncodeI128(val)).simulateFn(ctx, req)
		}
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #3)"}, nil
	}
	router := New(newStartDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusBadGateway, "simulation_failed")
}

func TestStartBuild_SaveStartBuildInternalError(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}, saveStartBuildErr: errors.New("connection reset")}
	router := New(newStartDeps(t, fs, happyStartMockRPC(t, 100, 200)))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestStartBuild_AlreadySucceeded(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}, saveStartBuildErr: store.ErrAlreadySucceeded}
	router := New(newStartDeps(t, fs, happyStartMockRPC(t, 100, 200)))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/build", organizer, nil)
	assertErrorStatus(t, rec, http.StatusConflict, "start_already_succeeded")
}

func TestStartBuild_Success(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	router := New(newStartDeps(t, fs, rpc))

	built := buildStartOp(t, router, event)
	if built.Fee != 100 {
		t.Errorf("fee = %d, want %d", built.Fee, 100)
	}
	if built.JudgingDeadline != event.JudgingDeadlineAt.Unix() {
		t.Errorf("judgingDeadline = %d, want %d", built.JudgingDeadline, event.JudgingDeadlineAt.Unix())
	}
	if built.UnsignedTransactionXDR == "" {
		t.Errorf("unsignedTransactionXdr is empty")
	}
	op, ok := fs.startOps[event.ID]
	if !ok {
		t.Fatalf("no start op persisted for event %s", event.ID)
	}
	if op.Status != store.OpStatusPending {
		t.Errorf("op status = %q, want PENDING", op.Status)
	}
	if op.Build.Fee != 100 {
		t.Errorf("persisted fee = %d, want 100", op.Build.Fee)
	}
}

// --- POST /events/{id}/start/submit ---------------------------------------

func TestStartSubmit_EventNotFound(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	organizer := mustRandomAddress(t)

	rec := doJSON(t, router, http.MethodPost, "/events/not-a-uuid/start/submit", organizer, nil)
	assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
}

func TestStartSubmit_Preconditions(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	event.Status = "LIVE"
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer, startSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusConflict, "event_not_created")
}

func TestStartSubmit_InvalidRequest(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{
		startEvents: map[string]*store.EventForStart{event.ID: event},
		startOps:    map[string]*store.StartOp{event.ID: {Status: store.OpStatusPending, Build: store.StartBuild{SourceAccount: organizer}}},
	}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	t.Run("bad json", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/events/"+event.ID+"/start/submit", strings.NewReader("{not json"))
		req.Header.Set("Authorization", "Bearer "+testServiceToken)
		req.Header.Set("X-Astrea-Wallet", organizer)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
	t.Run("empty xdr", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer, startSubmitRequest{SignedTransactionXDR: ""})
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
}

func TestStartSubmit_NoPendingStart(t *testing.T) {
	organizer := mustRandomAddress(t)

	t.Run("never built", func(t *testing.T) {
		event := baseStartEvent(t, organizer)
		fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
		router := New(Deps{ServiceToken: testServiceToken, Store: fs})
		rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer, startSubmitRequest{SignedTransactionXDR: "AAAA"})
		assertErrorStatus(t, rec, http.StatusConflict, "no_pending_start")
	})
	t.Run("previous attempt failed", func(t *testing.T) {
		event := baseStartEvent(t, organizer)
		fs := &fakeStore{
			startEvents: map[string]*store.EventForStart{event.ID: event},
			startOps:    map[string]*store.StartOp{event.ID: {Status: store.OpStatusFailed, Build: store.StartBuild{SourceAccount: organizer}}},
		}
		router := New(Deps{ServiceToken: testServiceToken, Store: fs})
		rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer, startSubmitRequest{SignedTransactionXDR: "AAAA"})
		assertErrorStatus(t, rec, http.StatusConflict, "no_pending_start")
	})
}

func TestStartSubmit_AlreadySucceeded(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{
		startEvents: map[string]*store.EventForStart{event.ID: event},
		startOps:    map[string]*store.StartOp{event.ID: {Status: store.OpStatusSucceeded, Build: store.StartBuild{SourceAccount: organizer}}},
	}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer, startSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusConflict, "start_already_succeeded")
}

func TestStartSubmit_LoadStartOpInternalError(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}, loadStartOpErr: errors.New("connection reset")}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer, startSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestStartSubmit_UnexpectedOpStatus(t *testing.T) {
	organizer := mustRandomAddress(t)
	event := baseStartEvent(t, organizer)
	fs := &fakeStore{
		startEvents: map[string]*store.EventForStart{event.ID: event},
		startOps:    map[string]*store.StartOp{event.ID: {Status: "SOMETHING_ELSE"}},
	}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer, startSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestStartSubmit_EnvelopeMismatch(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseStartEvent(t, organizer.Address())
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	router := New(newStartDeps(t, fs, rpc))

	buildStartOp(t, router, event) // populates fs's PENDING op with the real host function XDR

	contract := testContractScAddress(t)
	eid, err := escrow.ParseEventID(testEscrowEventIDHex)
	if err != nil {
		t.Fatalf("ParseEventID: %v", err)
	}
	altDeadline := uint64(event.JudgingDeadlineAt.Unix()) + 1000
	altUnsigned, err := escrow.BuildSetEventInProgress(context.Background(), rpc, contract, organizer.Address(), eid, altDeadline, escrow.Config{})
	if err != nil {
		t.Fatalf("BuildSetEventInProgress (alt): %v", err)
	}
	signedXDR := signTx(t, altUnsigned.XDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer.Address(), startSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusConflict, "envelope_mismatch")
}

func TestStartSubmit_SubmissionFailed(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseStartEvent(t, organizer.Address())
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	router := New(newStartDeps(t, fs, rpc))

	built := buildStartOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rpc.sendFn = func(_ context.Context, _ protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error) {
		return protocol.SendTransactionResponse{Status: stellarcore.TXStatusError, ErrorResultXDR: "boom"}, nil
	}

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer.Address(), startSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusBadGateway, "submission_failed")
	if len(fs.startFailedCalls) != 1 || fs.startFailedCalls[0].eventID != event.ID {
		t.Errorf("MarkStartFailed calls = %+v, want exactly one for event %s", fs.startFailedCalls, event.ID)
	}
	if fs.startOps[event.ID].Status != store.OpStatusFailed {
		t.Errorf("op status = %q, want FAILED", fs.startOps[event.ID].Status)
	}
	if event.Status != "CREATED" {
		t.Errorf("event status = %q, want CREATED (a failed submit must not move the event)", event.Status)
	}
}

func TestStartSubmit_OnChainFailed(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseStartEvent(t, organizer.Address())
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	router := New(newStartDeps(t, fs, rpc))

	built := buildStartOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		return protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusFailed}}, nil
	}

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer.Address(), startSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusBadGateway, "on_chain_failed")
	if len(fs.startFailedCalls) != 1 || fs.startFailedCalls[0].eventID != event.ID {
		t.Errorf("MarkStartFailed calls = %+v, want exactly one for event %s", fs.startFailedCalls, event.ID)
	}
}

func TestStartSubmit_Timeout(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseStartEvent(t, organizer.Address())
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		return protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusNotFound}}, nil
	}
	deps := newStartDeps(t, fs, rpc)
	deps.EscrowCfg = escrow.Config{PollTimeout: 20 * time.Millisecond, PollInterval: 5 * time.Millisecond, MaxPollInterval: 5 * time.Millisecond}
	router := New(deps)

	built := buildStartOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer.Address(), startSubmitRequest{SignedTransactionXDR: signedXDR})
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202; body: %s", rec.Code, rec.Body.String())
	}
	var body startSubmitResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "pending" {
		t.Errorf("status = %q, want %q", body.Status, "pending")
	}
	if fs.startOps[event.ID].Status != store.OpStatusPending {
		t.Errorf("op status = %q, want PENDING (a timeout must not mark the op failed or succeeded)", fs.startOps[event.ID].Status)
	}
	if len(fs.startFailedCalls) != 0 {
		t.Errorf("MarkStartFailed must not be called on timeout, got %+v", fs.startFailedCalls)
	}
	if event.Status != "CREATED" {
		t.Errorf("event status = %q, want CREATED (a timeout must not move the event)", event.Status)
	}
}

func TestStartSubmit_MarkStartSucceededInternalError(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseStartEvent(t, organizer.Address())
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}, markStartSucceededErr: errors.New("connection reset")}
	rpc := happyStartMockRPC(t, 100, 200)
	router := New(newStartDeps(t, fs, rpc))

	built := buildStartOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer.Address(), startSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestStartSubmit_Success(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseStartEvent(t, organizer.Address())
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	router := New(newStartDeps(t, fs, rpc))

	built := buildStartOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer.Address(), startSubmitRequest{SignedTransactionXDR: signedXDR})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var body startSubmitResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "succeeded" {
		t.Errorf("status = %q, want %q", body.Status, "succeeded")
	}
	if len(fs.startSucceededCalls) != 1 || fs.startSucceededCalls[0].eventID != event.ID {
		t.Errorf("MarkStartSucceeded calls = %+v, want exactly one for event %s", fs.startSucceededCalls, event.ID)
	}
	if fs.startOps[event.ID].Status != store.OpStatusSucceeded {
		t.Errorf("op status = %q, want SUCCEEDED", fs.startOps[event.ID].Status)
	}
	// Issue #11 decision 6: /start/submit is the only writer of LIVE.
	if event.Status != "LIVE" {
		t.Errorf("event status = %q, want LIVE", event.Status)
	}
}

// TestStartSubmit_SequentialRace reproduces the conditional-update race the
// issue calls out: two /start/submit calls for the same PENDING build, one
// after the other. The first confirms and moves the event LIVE; the
// second must see the op_log row already SUCCEEDED (via LoadStartOp,
// exactly like create/release's own already-succeeded pre-checks) and
// refuse with 409 before ever re-verifying the envelope or resubmitting --
// it must never call MarkStartSucceeded a second time.
func TestStartSubmit_SequentialRace(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseStartEvent(t, organizer.Address())
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	router := New(newStartDeps(t, fs, rpc))

	built := buildStartOp(t, router, event)
	signedXDR := signTx(t, built.UnsignedTransactionXDR, organizer)

	rec1 := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer.Address(), startSubmitRequest{SignedTransactionXDR: signedXDR})
	if rec1.Code != http.StatusOK {
		t.Fatalf("first submit status = %d, want 200; body: %s", rec1.Code, rec1.Body.String())
	}

	rec2 := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/start/submit", organizer.Address(), startSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec2, http.StatusConflict, "start_already_succeeded")

	if len(fs.startSucceededCalls) != 1 {
		t.Errorf("MarkStartSucceeded calls = %d, want exactly 1 (the second submit must not call it again)", len(fs.startSucceededCalls))
	}
	if event.Status != "LIVE" {
		t.Errorf("event status = %q, want LIVE", event.Status)
	}
}

// TestOnlyStartSubmitMovesEventLive is issue #11's acceptance criterion
// "status = LIVE is written by exactly one code path": with every other
// precondition satisfied (CREATED, escrowEventId set, a future judging
// deadline, a sufficient balance), running /start/quote and /start/build
// must never move the event off CREATED -- only a successful
// /start/submit does that (TestStartSubmit_Success above).
func TestOnlyStartSubmitMovesEventLive(t *testing.T) {
	organizer := mustRandomKeypair(t)
	event := baseStartEvent(t, organizer.Address())
	fs := &fakeStore{startEvents: map[string]*store.EventForStart{event.ID: event}}
	rpc := happyStartMockRPC(t, 100, 200)
	router := New(newStartDeps(t, fs, rpc))

	quoteRec := doJSON(t, router, http.MethodGet, "/events/"+event.ID+"/start/quote", organizer.Address(), nil)
	if quoteRec.Code != http.StatusOK {
		t.Fatalf("quote status = %d, want 200; body: %s", quoteRec.Code, quoteRec.Body.String())
	}
	if event.Status != "CREATED" {
		t.Fatalf("event status after /start/quote = %q, want CREATED", event.Status)
	}

	buildStartOp(t, router, event)
	if event.Status != "CREATED" {
		t.Fatalf("event status after /start/build = %q, want CREATED", event.Status)
	}
}

// TestOnlyOneSQLStatementWritesLive backs the same acceptance criterion
// from the other direction: a repo-wide, grep-style scan of every
// non-test .go file under internal/ for the literal SQL string 'LIVE'
// (single-quoted, as it appears inside a SQL statement -- not the many
// "LIVE" Go string literals test fixtures use as a store.EventForStart /
// store.EventForCreate .Status value) must find exactly one occurrence:
// postgres_organizer.go's MarkStartSucceeded. Test files are excluded on
// purpose -- the gated integration tests seed non-CREATED/LIVE rows
// directly with raw SQL, which is fixture setup, not a service write path.
func TestOnlyOneSQLStatementWritesLive(t *testing.T) {
	root := ".." // internal/, one level up from internal/api
	var hits []string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		if n := strings.Count(string(data), "'LIVE'"); n > 0 {
			for i := 0; i < n; i++ {
				hits = append(hits, path)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walking %s: %v", root, err)
	}
	if len(hits) != 1 {
		t.Fatalf("found %d non-test occurrence(s) of the SQL literal 'LIVE' under internal/, want exactly 1 (MarkStartSucceeded, the only writer of LIVE): %v", len(hits), hits)
	}
}
