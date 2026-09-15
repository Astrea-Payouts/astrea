package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/protocols/stellarcore"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

// A real deployed contract id (smart-contracts/astrea/contracts/event-escrow),
// used here purely as a well-formed strkey -- none of these tests touch the
// network.
const testContractAddressStr = "CAD5IOA2FFSUTRIHEK6YQ2BPO2JVDPXYRXBVMPBBWFQEWRWKFRG36TQH"

// testEscrowEventIDHex is 32 lowercase hex characters -- the shape
// Event.escrowEventId is stored as (schema.prisma) and escrow.ParseEventID
// accepts.
const testEscrowEventIDHex = "0123456789abcdef0123456789abcdef"

const (
	testEventID    = "10000000-0000-0000-0000-000000000001"
	testPrize1ID   = "10000000-0000-0000-0000-000000000011"
	testPrize2ID   = "10000000-0000-0000-0000-000000000012"
	testPrize3ID   = "10000000-0000-0000-0000-000000000013"
	testTeam1ID    = "10000000-0000-0000-0000-000000000021"
	testTeam2ID    = "10000000-0000-0000-0000-000000000022"
	testTeam3ID    = "10000000-0000-0000-0000-000000000023"
	testMember1ID  = "10000000-0000-0000-0000-000000000031"
	testMember2aID = "10000000-0000-0000-0000-000000000032"
	testMember2bID = "10000000-0000-0000-0000-000000000033"
	testMember2cID = "10000000-0000-0000-0000-000000000034"
	testMember3aID = "10000000-0000-0000-0000-000000000035"
	testMember3bID = "10000000-0000-0000-0000-000000000036"
)

// --- fakeStore ----------------------------------------------------------

// fakeStore is a minimal in-memory store.Store, replacing Postgres entirely
// for these handler-level tests. SaveReleaseBuild/MarkReleaseSucceeded/
// MarkReleaseFailed mutate releaseOps the same way the real transactions
// do, so a /build followed by a /submit through the real router sees
// consistent state without touching a database.
type fakeStore struct {
	events map[string]*store.EventForRelease

	releaseOps  map[string]*store.ReleaseOp
	savedBuilds map[string]store.ReleaseBuild

	loadEventErr        error
	loadReleaseOpErr    error
	saveReleaseBuildErr error
	markSucceededErr    error
	markFailedErr       error

	succeededCalls []succeededCall
	failedCalls    []failedCall

	// --- organizer path: create_event ------------------------------------

	createEvents map[string]*store.EventForCreate
	createOps    map[string]*store.CreateOp

	loadEventForCreateErr  error
	saveCreateBuildErr     error
	loadCreateOpErr        error
	markCreateSucceededErr error
	markCreateFailedErr    error

	createSucceededCalls []createSucceededCall
	createFailedCalls    []failedCall

	// --- organizer path: deposit_funds -----------------------------------

	depositOps       map[string]*store.DepositOp
	depositOpCounter int

	saveDepositBuildErr     error
	loadDepositOpErr        error
	markDepositSucceededErr error
	markDepositFailedErr    error

	depositSucceededCalls []string
	depositFailedCalls    []depositFailedCall
}

type succeededCall struct {
	eventID string
	txHash  string
	paidAt  time.Time
}

type failedCall struct {
	eventID string
	reason  string
}

type createSucceededCall struct {
	eventID     string
	confirmedAt time.Time
}

type depositFailedCall struct {
	opID   string
	reason string
}

func (f *fakeStore) LoadEventForRelease(_ context.Context, eventID string) (*store.EventForRelease, error) {
	if f.loadEventErr != nil {
		return nil, f.loadEventErr
	}
	ev, ok := f.events[eventID]
	if !ok {
		return nil, store.ErrNotFound
	}
	return ev, nil
}

func (f *fakeStore) SaveReleaseBuild(_ context.Context, eventID string, build store.ReleaseBuild) error {
	if f.saveReleaseBuildErr != nil {
		return f.saveReleaseBuildErr
	}
	if f.savedBuilds == nil {
		f.savedBuilds = map[string]store.ReleaseBuild{}
	}
	if f.releaseOps == nil {
		f.releaseOps = map[string]*store.ReleaseOp{}
	}
	f.savedBuilds[eventID] = build
	f.releaseOps[eventID] = &store.ReleaseOp{Status: store.OpStatusPending, Build: build}
	return nil
}

func (f *fakeStore) LoadReleaseOp(_ context.Context, eventID string) (*store.ReleaseOp, error) {
	if f.loadReleaseOpErr != nil {
		return nil, f.loadReleaseOpErr
	}
	op, ok := f.releaseOps[eventID]
	if !ok {
		return nil, store.ErrNotFound
	}
	return op, nil
}

func (f *fakeStore) MarkReleaseSucceeded(_ context.Context, eventID, txHash string, paidAt time.Time) error {
	if f.markSucceededErr != nil {
		return f.markSucceededErr
	}
	f.succeededCalls = append(f.succeededCalls, succeededCall{eventID: eventID, txHash: txHash, paidAt: paidAt})
	if op, ok := f.releaseOps[eventID]; ok {
		op.Status = store.OpStatusSucceeded
	}
	return nil
}

func (f *fakeStore) MarkReleaseFailed(_ context.Context, eventID, reason string) error {
	if f.markFailedErr != nil {
		return f.markFailedErr
	}
	f.failedCalls = append(f.failedCalls, failedCall{eventID: eventID, reason: reason})
	if op, ok := f.releaseOps[eventID]; ok {
		op.Status = store.OpStatusFailed
	}
	return nil
}

// --- fakeStore: organizer path (create_event) ----------------------------

func (f *fakeStore) LoadEventForCreate(_ context.Context, eventID string) (*store.EventForCreate, error) {
	if f.loadEventForCreateErr != nil {
		return nil, f.loadEventForCreateErr
	}
	ev, ok := f.createEvents[eventID]
	if !ok {
		return nil, store.ErrNotFound
	}
	return ev, nil
}

func (f *fakeStore) SaveCreateBuild(_ context.Context, eventID string, build store.CreateBuild) error {
	if f.saveCreateBuildErr != nil {
		return f.saveCreateBuildErr
	}
	if op, ok := f.createOps[eventID]; ok && op.Status == store.OpStatusSucceeded {
		return store.ErrAlreadySucceeded
	}
	if f.createOps == nil {
		f.createOps = map[string]*store.CreateOp{}
	}
	f.createOps[eventID] = &store.CreateOp{Status: store.OpStatusPending, Build: build}
	return nil
}

func (f *fakeStore) LoadCreateOp(_ context.Context, eventID string) (*store.CreateOp, error) {
	if f.loadCreateOpErr != nil {
		return nil, f.loadCreateOpErr
	}
	op, ok := f.createOps[eventID]
	if !ok {
		return nil, store.ErrNotFound
	}
	return op, nil
}

func (f *fakeStore) MarkCreateSucceeded(_ context.Context, eventID string, confirmedAt time.Time) error {
	if f.markCreateSucceededErr != nil {
		return f.markCreateSucceededErr
	}
	op, ok := f.createOps[eventID]
	if !ok || op.Status != store.OpStatusPending {
		return store.ErrCreateNotPending
	}
	op.Status = store.OpStatusSucceeded
	f.createSucceededCalls = append(f.createSucceededCalls, createSucceededCall{eventID: eventID, confirmedAt: confirmedAt})
	if ev, ok := f.createEvents[eventID]; ok {
		escrowEventID := op.Build.EscrowEventID
		ev.EscrowEventID = &escrowEventID
		ev.Status = "CREATED"
	}
	return nil
}

func (f *fakeStore) MarkCreateFailed(_ context.Context, eventID, reason string) error {
	if f.markCreateFailedErr != nil {
		return f.markCreateFailedErr
	}
	f.createFailedCalls = append(f.createFailedCalls, failedCall{eventID: eventID, reason: reason})
	if op, ok := f.createOps[eventID]; ok {
		op.Status = store.OpStatusFailed
	}
	return nil
}

// --- fakeStore: organizer path (deposit_funds) ----------------------------

func (f *fakeStore) SaveDepositBuild(_ context.Context, build store.DepositBuild) (string, error) {
	if f.saveDepositBuildErr != nil {
		return "", f.saveDepositBuildErr
	}
	if f.depositOps == nil {
		f.depositOps = map[string]*store.DepositOp{}
	}
	f.depositOpCounter++
	opID := fmt.Sprintf("test-op-%d", f.depositOpCounter)
	f.depositOps[opID] = &store.DepositOp{Status: store.OpStatusPending, Build: build}
	return opID, nil
}

func (f *fakeStore) LoadDepositOp(_ context.Context, opID string) (*store.DepositOp, error) {
	if f.loadDepositOpErr != nil {
		return nil, f.loadDepositOpErr
	}
	op, ok := f.depositOps[opID]
	if !ok {
		return nil, store.ErrNotFound
	}
	return op, nil
}

func (f *fakeStore) MarkDepositSucceeded(_ context.Context, opID string) error {
	if f.markDepositSucceededErr != nil {
		return f.markDepositSucceededErr
	}
	op, ok := f.depositOps[opID]
	if !ok || op.Status != store.OpStatusPending {
		return store.ErrDepositNotPending
	}
	op.Status = store.OpStatusSucceeded
	f.depositSucceededCalls = append(f.depositSucceededCalls, opID)
	return nil
}

func (f *fakeStore) MarkDepositFailed(_ context.Context, opID, reason string) error {
	if f.markDepositFailedErr != nil {
		return f.markDepositFailedErr
	}
	f.depositFailedCalls = append(f.depositFailedCalls, depositFailedCall{opID: opID, reason: reason})
	if op, ok := f.depositOps[opID]; ok {
		op.Status = store.OpStatusFailed
	}
	return nil
}

// --- mockRPC (copied from escrow/pipeline_test.go's pattern; unexported,
// package-local, not shared with escrow) --------------------------------

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

// happyMockRPC returns a mock that would carry a build+submit all the way
// to a successful confirmation with hash "deadbeef"; individual tests
// override only the one stage they're exercising.
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

// --- fixtures and helpers -------------------------------------------------

// baseEvent builds a 3-prize, mixed-team-size event: rank 1 has a
// single-member team, rank 2 a three-member team whose shares (3334/3333/
// 3333 bp) don't divide its prize evenly -- proving the remainder rule --
// and rank 3 an even two-member split. event.Prizes[i] is always won by
// event.Teams[i]; baseAssignments relies on that parallel order.
func baseEvent(t *testing.T, judge string) *store.EventForRelease {
	t.Helper()
	escrowID := testEscrowEventIDHex

	return &store.EventForRelease{
		ID:            testEventID,
		Status:        "JUDGING",
		EscrowEventID: &escrowID,
		Judges:        []string{judge},
		Prizes: []store.Prize{
			{ID: testPrize1ID, Rank: 1, Amount: "50.0000000"},
			{ID: testPrize2ID, Rank: 2, Amount: "100.0000003"},
			{ID: testPrize3ID, Rank: 3, Amount: "25.0000000"},
		},
		Teams: []store.Team{
			{ID: testTeam1ID, Members: []store.Member{
				{ID: testMember1ID, Ordinal: 0, ShareBasisPoints: 10000, WalletAddress: mustRandomAddress(t)},
			}},
			{ID: testTeam2ID, Members: []store.Member{
				{ID: testMember2aID, Ordinal: 0, ShareBasisPoints: 3334, WalletAddress: mustRandomAddress(t)},
				{ID: testMember2bID, Ordinal: 1, ShareBasisPoints: 3333, WalletAddress: mustRandomAddress(t)},
				{ID: testMember2cID, Ordinal: 2, ShareBasisPoints: 3333, WalletAddress: mustRandomAddress(t)},
			}},
			{ID: testTeam3ID, Members: []store.Member{
				{ID: testMember3aID, Ordinal: 0, ShareBasisPoints: 5000, WalletAddress: mustRandomAddress(t)},
				{ID: testMember3bID, Ordinal: 1, ShareBasisPoints: 5000, WalletAddress: mustRandomAddress(t)},
			}},
		},
	}
}

// baseAssignments assigns event.Teams[i] to event.Prizes[i]'s rank, the
// parallel order baseEvent builds them in.
func baseAssignments(event *store.EventForRelease) []releaseAssignment {
	out := make([]releaseAssignment, len(event.Prizes))
	for i, p := range event.Prizes {
		out[i] = releaseAssignment{Rank: p.Rank, TeamID: event.Teams[i].ID}
	}
	return out
}

func mustRandomKeypair(t *testing.T) *keypair.Full {
	t.Helper()
	kp, err := keypair.Random()
	if err != nil {
		t.Fatalf("keypair.Random: %v", err)
	}
	return kp
}

func mustRandomAddress(t *testing.T) string {
	t.Helper()
	return mustRandomKeypair(t).Address()
}

func testContractScAddress(t *testing.T) xdr.ScAddress {
	t.Helper()
	addr, err := escrow.ContractAddress(testContractAddressStr)
	if err != nil {
		t.Fatalf("ContractAddress: %v", err)
	}
	return addr
}

// signTx parses unsignedXDR back into a signable transaction, signs it
// with signer, and returns the resulting envelope's base64 XDR -- what a
// judge's wallet would hand back to /submit.
func signTx(t *testing.T, unsignedXDR string, signer *keypair.Full) string {
	t.Helper()
	generic, err := txnbuild.TransactionFromXDR(unsignedXDR)
	if err != nil {
		t.Fatalf("TransactionFromXDR: %v", err)
	}
	tx, ok := generic.Transaction()
	if !ok {
		t.Fatalf("expected a simple transaction, not a fee-bump")
	}
	signed, err := tx.Sign(network.TestNetworkPassphrase, signer)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	signedXDR, err := signed.Base64()
	if err != nil {
		t.Fatalf("Base64: %v", err)
	}
	return signedXDR
}

// doJSON sends method/path through router with a Bearer token and, if
// wallet is non-empty, the X-Astrea-Wallet header. body is JSON-marshaled
// as the request body; pass nil for no body at all.
func doJSON(t *testing.T, router http.Handler, method, path, wallet string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
		reader = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Authorization", "Bearer "+testServiceToken)
	if wallet != "" {
		req.Header.Set("X-Astrea-Wallet", wallet)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

// buildReleaseOp POSTs /release/build for event through router and returns
// the unsigned transaction XDR, failing the test on anything but 200.
func buildReleaseOp(t *testing.T, router http.Handler, event *store.EventForRelease, judgeAddr string) string {
	t.Helper()
	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/build", judgeAddr, releaseBuildRequest{Assignments: baseAssignments(event)})
	if rec.Code != http.StatusOK {
		t.Fatalf("build status = %d, body %s", rec.Code, rec.Body.String())
	}
	var resp releaseBuildResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode build response: %v", err)
	}
	return resp.UnsignedTransactionXDR
}

func newReleaseDeps(t *testing.T, fs *fakeStore, rpc *mockRPC) Deps {
	t.Helper()
	return Deps{
		ServiceToken:      testServiceToken,
		Store:             fs,
		RPC:               rpc,
		Contract:          testContractScAddress(t),
		NetworkPassphrase: network.TestNetworkPassphrase,
	}
}

// --- /release/build: shared middleware and path validation ---------------

func TestReleaseBuild_Unauthorized(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	req := httptest.NewRequest(http.MethodPost, "/events/"+testEventID+"/release/build", nil)
	req.Header.Set("X-Astrea-Wallet", validWallet(t))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assertErrorStatus(t, rec, http.StatusUnauthorized, "unauthorized")
}

func TestReleaseBuild_InvalidWallet(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	req := httptest.NewRequest(http.MethodPost, "/events/"+testEventID+"/release/build", nil)
	req.Header.Set("Authorization", "Bearer "+testServiceToken)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_wallet")
}

func TestReleaseBuild_EventNotFound(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	judge := mustRandomAddress(t)

	t.Run("malformed id", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/events/not-a-uuid/release/build", judge, nil)
		assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
	})
	t.Run("unknown id", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/events/"+testEventID+"/release/build", judge, nil)
		assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
	})
}

// --- /release/build: preconditions ---------------------------------------

func TestReleaseBuild_Preconditions(t *testing.T) {
	cases := []struct {
		name           string
		mutate         func(*store.EventForRelease)
		useOtherWallet bool
		wantStatus     int
		wantCode       string
	}{
		{name: "not judging", mutate: func(e *store.EventForRelease) { e.Status = "LIVE" }, wantStatus: http.StatusConflict, wantCode: "event_not_judging"},
		{name: "not on chain", mutate: func(e *store.EventForRelease) { e.EscrowEventID = nil }, wantStatus: http.StatusConflict, wantCode: "event_not_on_chain"},
		{name: "no judges", mutate: func(e *store.EventForRelease) { e.Judges = nil }, wantStatus: http.StatusConflict, wantCode: "judge_ambiguous"},
		{name: "two judges", mutate: func(e *store.EventForRelease) { e.Judges = append(e.Judges, e.Judges[0]) }, wantStatus: http.StatusConflict, wantCode: "judge_ambiguous"},
		{name: "wrong wallet", mutate: func(e *store.EventForRelease) {}, useOtherWallet: true, wantStatus: http.StatusForbidden, wantCode: "not_judge"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			judge := mustRandomAddress(t)
			event := baseEvent(t, judge)
			tc.mutate(event)
			fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
			router := New(Deps{ServiceToken: testServiceToken, Store: fs})

			wallet := judge
			if tc.useOtherWallet {
				wallet = mustRandomAddress(t)
			}
			rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/build", wallet, nil)
			assertErrorStatus(t, rec, tc.wantStatus, tc.wantCode)
		})
	}
}

// --- /release/build: request validation -----------------------------------

func TestReleaseBuild_InvalidRequest(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	t.Run("bad json", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/events/"+event.ID+"/release/build", strings.NewReader("{not json"))
		req.Header.Set("Authorization", "Bearer "+testServiceToken)
		req.Header.Set("X-Astrea-Wallet", judge)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
	t.Run("empty assignments", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/build", judge, releaseBuildRequest{Assignments: nil})
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
}

func TestReleaseBuild_AssignmentsInvalid(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})
	base := baseAssignments(event)

	cases := []struct {
		name        string
		assignments []releaseAssignment
	}{
		{"missing rank", base[:2]},
		{"duplicated rank", []releaseAssignment{base[0], base[0], base[2]}},
		{"unknown rank", []releaseAssignment{{Rank: 99, TeamID: event.Teams[0].ID}, base[1], base[2]}},
		{"team from another event", []releaseAssignment{{Rank: 1, TeamID: "ffffffff-ffff-ffff-ffff-ffffffffffff"}, base[1], base[2]}},
		{"team assigned twice", []releaseAssignment{{Rank: 1, TeamID: event.Teams[0].ID}, {Rank: 2, TeamID: event.Teams[0].ID}, base[2]}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/build", judge, releaseBuildRequest{Assignments: tc.assignments})
			assertErrorStatus(t, rec, http.StatusConflict, "assignments_invalid")
		})
	}
}

func TestReleaseBuild_AllocationFailed(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	event.Teams[0].Members[0].ShareBasisPoints = 4000 // sole member of a 1-member team must carry all 10000 bp
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/build", judge, releaseBuildRequest{Assignments: baseAssignments(event)})
	assertErrorStatus(t, rec, http.StatusConflict, "allocation_failed")
}

func TestReleaseBuild_AlreadySucceeded(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}, saveReleaseBuildErr: store.ErrAlreadySucceeded}
	router := New(newReleaseDeps(t, fs, happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/build", judge, releaseBuildRequest{Assignments: baseAssignments(event)})
	assertErrorStatus(t, rec, http.StatusConflict, "release_already_succeeded")
}

func TestReleaseBuild_SimulationFailed(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	rpc.simulateFn = func(_ context.Context, _ protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error) {
		return protocol.SimulateTransactionResponse{Error: "HostError: Error(Contract, #7)"}, nil
	}
	router := New(newReleaseDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/build", judge, releaseBuildRequest{Assignments: baseAssignments(event)})
	assertErrorStatus(t, rec, http.StatusBadGateway, "simulation_failed")
}

func TestReleaseBuild_LoadEventInternalError(t *testing.T) {
	judge := mustRandomAddress(t)
	fs := &fakeStore{loadEventErr: errors.New("connection reset")}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+testEventID+"/release/build", judge, releaseBuildRequest{Assignments: []releaseAssignment{{Rank: 1, TeamID: testTeam1ID}}})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestReleaseBuild_SaveReleaseBuildInternalError(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}, saveReleaseBuildErr: errors.New("connection reset")}
	router := New(newReleaseDeps(t, fs, happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/build", judge, releaseBuildRequest{Assignments: baseAssignments(event)})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

// --- /release/submit: shared middleware, path validation, preconditions --

func TestReleaseSubmit_EventNotFound(t *testing.T) {
	router := New(Deps{ServiceToken: testServiceToken, Store: &fakeStore{}})
	judge := mustRandomAddress(t)

	rec := doJSON(t, router, http.MethodPost, "/events/not-a-uuid/release/submit", judge, nil)
	assertErrorStatus(t, rec, http.StatusNotFound, "event_not_found")
}

func TestReleaseSubmit_Preconditions(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	event.Status = "LIVE"
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge, releaseSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusConflict, "event_not_judging")
}

func TestReleaseSubmit_InvalidRequest(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	t.Run("bad json", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/events/"+event.ID+"/release/submit", strings.NewReader("{not json"))
		req.Header.Set("Authorization", "Bearer "+testServiceToken)
		req.Header.Set("X-Astrea-Wallet", judge)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
	t.Run("empty xdr", func(t *testing.T) {
		rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge, releaseSubmitRequest{SignedTransactionXDR: ""})
		assertErrorStatus(t, rec, http.StatusBadRequest, "invalid_request")
	})
}

func TestReleaseSubmit_NoPendingRelease(t *testing.T) {
	judge := mustRandomAddress(t)

	t.Run("never built", func(t *testing.T) {
		event := baseEvent(t, judge)
		fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
		router := New(Deps{ServiceToken: testServiceToken, Store: fs})
		rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge, releaseSubmitRequest{SignedTransactionXDR: "AAAA"})
		assertErrorStatus(t, rec, http.StatusConflict, "no_pending_release")
	})
	t.Run("previous attempt failed", func(t *testing.T) {
		event := baseEvent(t, judge)
		fs := &fakeStore{
			events:     map[string]*store.EventForRelease{event.ID: event},
			releaseOps: map[string]*store.ReleaseOp{event.ID: {Status: store.OpStatusFailed, Build: store.ReleaseBuild{SourceAccount: judge}}},
		}
		router := New(Deps{ServiceToken: testServiceToken, Store: fs})
		rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge, releaseSubmitRequest{SignedTransactionXDR: "AAAA"})
		assertErrorStatus(t, rec, http.StatusConflict, "no_pending_release")
	})
}

func TestReleaseSubmit_AlreadySucceeded(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	fs := &fakeStore{
		events:     map[string]*store.EventForRelease{event.ID: event},
		releaseOps: map[string]*store.ReleaseOp{event.ID: {Status: store.OpStatusSucceeded, Build: store.ReleaseBuild{SourceAccount: judge}}},
	}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge, releaseSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusConflict, "release_already_succeeded")
}

func TestReleaseSubmit_EnvelopeMismatch(t *testing.T) {
	judge := mustRandomKeypair(t)
	event := baseEvent(t, judge.Address())
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	contract := testContractScAddress(t)
	router := New(newReleaseDeps(t, fs, rpc))

	buildReleaseOp(t, router, event, judge.Address()) // populates fs's PENDING op with the real host function XDR

	eid, err := escrow.ParseEventID(testEscrowEventIDHex)
	if err != nil {
		t.Fatalf("ParseEventID: %v", err)
	}
	altWinners := []escrow.Winner{{Place: 1, Amount: 999, Address: event.Teams[0].Members[0].WalletAddress}}
	altUnsigned, err := escrow.BuildReleaseReward(context.Background(), rpc, contract, judge.Address(), eid, altWinners, escrow.Config{})
	if err != nil {
		t.Fatalf("BuildReleaseReward (alt): %v", err)
	}
	signedXDR := signTx(t, altUnsigned.XDR, judge)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge.Address(), releaseSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusConflict, "envelope_mismatch")
}

func TestReleaseSubmit_SubmissionFailed(t *testing.T) {
	judge := mustRandomKeypair(t)
	event := baseEvent(t, judge.Address())
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	router := New(newReleaseDeps(t, fs, rpc))

	unsignedXDR := buildReleaseOp(t, router, event, judge.Address())
	signedXDR := signTx(t, unsignedXDR, judge)

	rpc.sendFn = func(_ context.Context, _ protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error) {
		return protocol.SendTransactionResponse{Status: stellarcore.TXStatusError, ErrorResultXDR: "boom"}, nil
	}

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge.Address(), releaseSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusBadGateway, "submission_failed")
	if len(fs.failedCalls) != 1 || fs.failedCalls[0].eventID != event.ID {
		t.Errorf("MarkReleaseFailed calls = %+v, want exactly one for event %s", fs.failedCalls, event.ID)
	}
	if fs.releaseOps[event.ID].Status != store.OpStatusFailed {
		t.Errorf("op status = %q, want FAILED", fs.releaseOps[event.ID].Status)
	}
}

func TestReleaseSubmit_OnChainFailed(t *testing.T) {
	judge := mustRandomKeypair(t)
	event := baseEvent(t, judge.Address())
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	router := New(newReleaseDeps(t, fs, rpc))

	unsignedXDR := buildReleaseOp(t, router, event, judge.Address())
	signedXDR := signTx(t, unsignedXDR, judge)

	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		return protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusFailed}}, nil
	}

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge.Address(), releaseSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusBadGateway, "on_chain_failed")
	if len(fs.failedCalls) != 1 || fs.failedCalls[0].eventID != event.ID {
		t.Errorf("MarkReleaseFailed calls = %+v, want exactly one for event %s", fs.failedCalls, event.ID)
	}
}

func TestReleaseSubmit_Timeout(t *testing.T) {
	judge := mustRandomKeypair(t)
	event := baseEvent(t, judge.Address())
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	rpc.getFn = func(_ context.Context, _ protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error) {
		return protocol.GetTransactionResponse{TransactionDetails: protocol.TransactionDetails{Status: protocol.TransactionStatusNotFound}}, nil
	}
	deps := newReleaseDeps(t, fs, rpc)
	deps.EscrowCfg = escrow.Config{PollTimeout: 20 * time.Millisecond, PollInterval: 5 * time.Millisecond, MaxPollInterval: 5 * time.Millisecond}
	router := New(deps)

	unsignedXDR := buildReleaseOp(t, router, event, judge.Address())
	signedXDR := signTx(t, unsignedXDR, judge)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge.Address(), releaseSubmitRequest{SignedTransactionXDR: signedXDR})
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202; body: %s", rec.Code, rec.Body.String())
	}
	var body releaseSubmitResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "pending" {
		t.Errorf("status = %q, want %q", body.Status, "pending")
	}
	if body.TxHash == "" {
		t.Errorf("txHash is empty, want the submitted tx hash")
	}
	if fs.releaseOps[event.ID].Status != store.OpStatusPending {
		t.Errorf("op status = %q, want PENDING (a timeout must not mark the op failed or succeeded)", fs.releaseOps[event.ID].Status)
	}
	if len(fs.failedCalls) != 0 {
		t.Errorf("MarkReleaseFailed must not be called on timeout, got %+v", fs.failedCalls)
	}
}

func TestReleaseSubmit_LoadReleaseOpInternalError(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}, loadReleaseOpErr: errors.New("connection reset")}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge, releaseSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestReleaseSubmit_UnexpectedOpStatus(t *testing.T) {
	judge := mustRandomAddress(t)
	event := baseEvent(t, judge)
	fs := &fakeStore{
		events:     map[string]*store.EventForRelease{event.ID: event},
		releaseOps: map[string]*store.ReleaseOp{event.ID: {Status: "SOMETHING_ELSE"}},
	}
	router := New(Deps{ServiceToken: testServiceToken, Store: fs})

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge, releaseSubmitRequest{SignedTransactionXDR: "AAAA"})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

func TestReleaseSubmit_MarkReleaseSucceededInternalError(t *testing.T) {
	judge := mustRandomKeypair(t)
	event := baseEvent(t, judge.Address())
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}, markSucceededErr: errors.New("connection reset")}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	router := New(newReleaseDeps(t, fs, rpc))

	unsignedXDR := buildReleaseOp(t, router, event, judge.Address())
	signedXDR := signTx(t, unsignedXDR, judge)

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge.Address(), releaseSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusInternalServerError, "internal")
}

// A submission-side failure that also fails to record itself (markFailedErr)
// must still surface the original submission_failed to the caller --
// markReleaseFailedBestEffort's own error is logged, never surfaced.
func TestReleaseSubmit_MarkReleaseFailedBestEffort_DoesNotOverrideSubmissionError(t *testing.T) {
	judge := mustRandomKeypair(t)
	event := baseEvent(t, judge.Address())
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}, markFailedErr: errors.New("op_log row vanished")}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	router := New(newReleaseDeps(t, fs, rpc))

	unsignedXDR := buildReleaseOp(t, router, event, judge.Address())
	signedXDR := signTx(t, unsignedXDR, judge)

	rpc.sendFn = func(_ context.Context, _ protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error) {
		return protocol.SendTransactionResponse{Status: stellarcore.TXStatusError, ErrorResultXDR: "boom"}, nil
	}

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge.Address(), releaseSubmitRequest{SignedTransactionXDR: signedXDR})
	assertErrorStatus(t, rec, http.StatusBadGateway, "submission_failed")
}

// --- happy path, remainder rule, and the FAILED -> rebuild -> succeeds
// sequence --------------------------------------------------------------

func TestReleaseBuildSubmit_HappyPathWithRemainder(t *testing.T) {
	judge := mustRandomKeypair(t)
	event := baseEvent(t, judge.Address())
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	router := New(newReleaseDeps(t, fs, rpc))

	rec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/build", judge.Address(), releaseBuildRequest{Assignments: baseAssignments(event)})
	if rec.Code != http.StatusOK {
		t.Fatalf("build status = %d, body %s", rec.Code, rec.Body.String())
	}
	var buildResp releaseBuildResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &buildResp); err != nil {
		t.Fatalf("decode build response: %v", err)
	}
	if buildResp.EventID != event.ID {
		t.Errorf("eventId = %q, want %q", buildResp.EventID, event.ID)
	}
	if len(buildResp.Winners) != 6 {
		t.Fatalf("len(Winners) = %d, want 6 (1 + 3 + 2 members)", len(buildResp.Winners))
	}

	// Remainder rule (#185): prize 2's amount (100.0000003 -> 1,000,000,003
	// stroops) split 3334/3333/3333 bp doesn't divide evenly; the 2-stroop
	// remainder must land on the lowest-ordinal member (testMember2aID),
	// not get dropped or spread across the team.
	saved := fs.savedBuilds[event.ID]
	stroopsByMember := make(map[string]int64, len(saved.Winners))
	for _, w := range saved.Winners {
		stroopsByMember[w.TeamMemberID] = w.Stroops
	}
	if got, want := stroopsByMember[testMember2aID], int64(333_400_003); got != want {
		t.Errorf("member2a (lowest ordinal) stroops = %d, want %d (floor 333,400,001 + remainder 2)", got, want)
	}
	if got, want := stroopsByMember[testMember2bID], int64(333_300_000); got != want {
		t.Errorf("member2b stroops = %d, want %d", got, want)
	}
	if got, want := stroopsByMember[testMember2cID], int64(333_300_000); got != want {
		t.Errorf("member2c stroops = %d, want %d", got, want)
	}
	if got, want := stroopsByMember[testMember1ID], int64(500_000_000); got != want {
		t.Errorf("member1 (sole winner of rank 1) stroops = %d, want %d", got, want)
	}

	signedXDR := signTx(t, buildResp.UnsignedTransactionXDR, judge)
	submitRec := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge.Address(), releaseSubmitRequest{SignedTransactionXDR: signedXDR})
	if submitRec.Code != http.StatusOK {
		t.Fatalf("submit status = %d, body %s", submitRec.Code, submitRec.Body.String())
	}
	var submitResp releaseSubmitResponse
	if err := json.Unmarshal(submitRec.Body.Bytes(), &submitResp); err != nil {
		t.Fatalf("decode submit response: %v", err)
	}
	if submitResp.Status != "succeeded" {
		t.Errorf("status = %q, want %q", submitResp.Status, "succeeded")
	}
	if submitResp.TxHash == "" {
		t.Errorf("txHash is empty")
	}
	if len(fs.succeededCalls) != 1 || fs.succeededCalls[0].eventID != event.ID || fs.succeededCalls[0].txHash != submitResp.TxHash {
		t.Errorf("MarkReleaseSucceeded calls = %+v, want one for event %s with hash %s", fs.succeededCalls, event.ID, submitResp.TxHash)
	}
}

func TestReleaseFlow_FailedThenRebuildSucceeds(t *testing.T) {
	judge := mustRandomKeypair(t)
	event := baseEvent(t, judge.Address())
	fs := &fakeStore{events: map[string]*store.EventForRelease{event.ID: event}}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	router := New(newReleaseDeps(t, fs, rpc))

	unsignedXDR1 := buildReleaseOp(t, router, event, judge.Address())
	signedXDR1 := signTx(t, unsignedXDR1, judge)

	rpc.sendFn = func(_ context.Context, _ protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error) {
		return protocol.SendTransactionResponse{Status: stellarcore.TXStatusError, ErrorResultXDR: "first attempt failed"}, nil
	}
	rec1 := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge.Address(), releaseSubmitRequest{SignedTransactionXDR: signedXDR1})
	assertErrorStatus(t, rec1, http.StatusBadGateway, "submission_failed")
	if fs.releaseOps[event.ID].Status != store.OpStatusFailed {
		t.Fatalf("op status after first attempt = %q, want FAILED", fs.releaseOps[event.ID].Status)
	}

	// Rebuilding is allowed: the previous attempt is FAILED, not SUCCEEDED.
	rpc.sendFn = happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid}).sendFn
	unsignedXDR2 := buildReleaseOp(t, router, event, judge.Address())
	signedXDR2 := signTx(t, unsignedXDR2, judge)

	rec2 := doJSON(t, router, http.MethodPost, "/events/"+event.ID+"/release/submit", judge.Address(), releaseSubmitRequest{SignedTransactionXDR: signedXDR2})
	if rec2.Code != http.StatusOK {
		t.Fatalf("second submit status = %d, body %s", rec2.Code, rec2.Body.String())
	}
	if fs.releaseOps[event.ID].Status != store.OpStatusSucceeded {
		t.Errorf("op status after rebuild = %q, want SUCCEEDED", fs.releaseOps[event.ID].Status)
	}
	if len(fs.succeededCalls) != 1 {
		t.Errorf("MarkReleaseSucceeded calls = %d, want exactly 1", len(fs.succeededCalls))
	}
}

// --- verifySignedEnvelope: focused, non-HTTP coverage of decision 3's
// guard (used for the required red/green proof: comment out the host
// function comparison, confirm "host function mismatch" below fails,
// restore it, confirm it passes again) ------------------------------------

func TestVerifySignedEnvelope(t *testing.T) {
	judge := mustRandomKeypair(t)
	contract := testContractScAddress(t)
	eid, err := escrow.ParseEventID(testEscrowEventIDHex)
	if err != nil {
		t.Fatalf("ParseEventID: %v", err)
	}
	rpc := happyMockRPC(t, xdr.ScVal{Type: xdr.ScValTypeScvVoid})
	winners := []escrow.Winner{{Place: 1, Amount: 100, Address: mustRandomAddress(t)}}

	unsigned, err := escrow.BuildReleaseReward(context.Background(), rpc, contract, judge.Address(), eid, winners, escrow.Config{})
	if err != nil {
		t.Fatalf("BuildReleaseReward: %v", err)
	}
	_, op, err := escrow.DecodeSingleOpInvokeHostFunction(unsigned.XDR)
	if err != nil {
		t.Fatalf("DecodeSingleOpInvokeHostFunction: %v", err)
	}
	wantHF, err := xdr.MarshalBase64(op.HostFunction)
	if err != nil {
		t.Fatalf("MarshalBase64: %v", err)
	}
	wantSource := judge.Address()
	signedXDR := signTx(t, unsigned.XDR, judge)

	t.Run("matches", func(t *testing.T) {
		if err := verifySignedEnvelope(signedXDR, wantSource, wantHF); err != nil {
			t.Errorf("verifySignedEnvelope = %v, want nil", err)
		}
	})

	t.Run("wrong source account", func(t *testing.T) {
		other := mustRandomKeypair(t)
		otherUnsigned, err := escrow.BuildReleaseReward(context.Background(), rpc, contract, other.Address(), eid, winners, escrow.Config{})
		if err != nil {
			t.Fatalf("BuildReleaseReward: %v", err)
		}
		otherSigned := signTx(t, otherUnsigned.XDR, other)
		if err := verifySignedEnvelope(otherSigned, wantSource, wantHF); err == nil {
			t.Error("verifySignedEnvelope = nil, want an error for a mismatched source account")
		}
	})

	t.Run("no signatures", func(t *testing.T) {
		if err := verifySignedEnvelope(unsigned.XDR, wantSource, wantHF); err == nil {
			t.Error("verifySignedEnvelope = nil, want an error for an unsigned envelope")
		}
	})

	t.Run("host function mismatch", func(t *testing.T) {
		if err := verifySignedEnvelope(signedXDR, wantSource, "AAAAAQAAAAA="); err == nil {
			t.Error("verifySignedEnvelope = nil, want an error for a mismatched host function")
		}
	})

	t.Run("malformed xdr", func(t *testing.T) {
		if err := verifySignedEnvelope("not-valid-xdr", wantSource, wantHF); err == nil {
			t.Error("verifySignedEnvelope = nil, want an error for malformed XDR")
		}
	})
}
