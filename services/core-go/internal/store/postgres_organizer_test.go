package store

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// --- LoadEventForCreate: fake-querier error-wrapping branches, mirroring
// postgres_unit_test.go's LoadEventForRelease coverage -------------------

func TestLoadEventForCreate_EventQueryError(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{row: fakeRow{scanErr: errBoom}}}
	_, err := pg.LoadEventForCreate(context.Background(), "e1")
	if err == nil || err == ErrNotFound {
		t.Fatalf("err = %v, want a wrapped non-ErrNotFound error", err)
	}
}

func TestLoadEventForCreate_NoRows(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{row: fakeRow{scanErr: pgx.ErrNoRows}}}
	_, err := pg.LoadEventForCreate(context.Background(), "e1")
	if err != ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestLoadEventForCreate_JudgesQueryError(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{
		row:       fakeRow{},
		queryErrs: map[string]error{"FROM judges": errBoom},
	}}
	_, err := pg.LoadEventForCreate(context.Background(), "e1")
	if err == nil {
		t.Fatal("expected an error from the judges query")
	}
}

func TestLoadEventForCreate_PrizesQueryError(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{
		row:       fakeRow{},
		queryErrs: map[string]error{"FROM prizes": errBoom},
	}}
	_, err := pg.LoadEventForCreate(context.Background(), "e1")
	if err == nil {
		t.Fatal("expected an error from the prizes query")
	}
}

func TestLoadEventForCreate_PrizesScanError(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{
		row:       fakeRow{},
		queryRows: map[string]pgx.Rows{"FROM prizes": &fakeRows{scanErr: errBoom}},
	}}
	_, err := pg.LoadEventForCreate(context.Background(), "e1")
	if err == nil {
		t.Fatal("expected an error from scanning prize rows")
	}
}

// --- TestPostgres_OrganizerWrites: gated integration test, mirroring
// postgres_release_test.go's TestPostgres_ReleaseWrites -------------------

func TestPostgres_OrganizerWrites(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping Postgres integration test")
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)

	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() {
		if err := tx.Rollback(ctx); err != nil && err != pgx.ErrTxClosed {
			t.Errorf("rollback: %v", err)
		}
	}()

	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := tx.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("seed %q: %v", sql, err)
		}
	}

	const (
		userID  = "71111111-1111-1111-1111-111111111111"
		orgWlt  = "72222222-2222-2222-2222-222222222222"
		orgAddr = "GORGCREATEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
		judgeW1 = "GJUDGECREATEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

		// Event OC1: happy path through CREATED, then a refused rebuild.
		eventOC1 = "73333333-3333-3333-3333-333333333333"
		prizeOC1 = "74444444-4444-4444-4444-444444444441"

		// Event OC2: FAILED, then a successful rebuild.
		eventOC2 = "75555555-5555-5555-5555-555555555555"
		prizeOC2 = "76666666-6666-6666-6666-666666666661"
	)

	exec(`INSERT INTO users (id) VALUES ($1)`, userID)
	exec(`INSERT INTO wallets (id, "userId", address) VALUES ($1, $2, $3)`, orgWlt, userID, orgAddr)

	seedDraftEvent := func(eventID string) {
		exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "updatedAt")
		      VALUES ($1, $2, $3, 'Organizer Test Event', 'DRAFT', now())`,
			eventID, userID, orgWlt)
		exec(`INSERT INTO judges (id, "eventId", "walletAddress", "displayName", status)
		      VALUES (gen_random_uuid(), $1, $2, 'Judge', 'ACTIVE')`, eventID, judgeW1)
	}

	pg := &Postgres{db: tx, begin: tx}

	// --- Event OC1: happy path -------------------------------------------
	seedDraftEvent(eventOC1)
	exec(`INSERT INTO prizes (id, "eventId", rank, amount, "updatedAt") VALUES ($1, $2, 1, '150.0000000', now())`, prizeOC1, eventOC1)

	ev, err := pg.LoadEventForCreate(ctx, eventOC1)
	if err != nil {
		t.Fatalf("LoadEventForCreate(OC1): %v", err)
	}
	if ev.Status != "DRAFT" || ev.OrganizerWalletAddress != orgAddr || len(ev.Judges) != 1 || len(ev.Prizes) != 1 {
		t.Fatalf("LoadEventForCreate(OC1) = %+v, want DRAFT/orgAddr/1 judge/1 prize", ev)
	}

	buildV1 := CreateBuild{HostFunctionXDR: "xdr-v1", SourceAccount: orgAddr, EscrowEventID: "aaaa0000000000000000000000000001", Reward: 1_500_000_000}
	if err := pg.SaveCreateBuild(ctx, eventOC1, buildV1); err != nil {
		t.Fatalf("SaveCreateBuild(v1): %v", err)
	}
	assertCreateOpRowCount(t, ctx, tx, eventOC1, 1)

	// Re-running /build overwrites the payload (and its escrowEventId) --
	// still exactly one row (issue #11's "new id per rebuild" risk note).
	buildV2 := buildV1
	buildV2.HostFunctionXDR = "xdr-v2"
	buildV2.EscrowEventID = "bbbb0000000000000000000000000002"
	if err := pg.SaveCreateBuild(ctx, eventOC1, buildV2); err != nil {
		t.Fatalf("SaveCreateBuild(v2, overwrite): %v", err)
	}
	assertCreateOpRowCount(t, ctx, tx, eventOC1, 1)

	op, err := pg.LoadCreateOp(ctx, eventOC1)
	if err != nil {
		t.Fatalf("LoadCreateOp: %v", err)
	}
	if op.Status != OpStatusPending || op.Build.EscrowEventID != "bbbb0000000000000000000000000002" {
		t.Errorf("LoadCreateOp = %+v, want PENDING with the overwritten escrowEventId", op)
	}

	confirmedAt := time.Now().UTC().Truncate(time.Microsecond)
	if err := pg.MarkCreateSucceeded(ctx, eventOC1, buildV2.EscrowEventID, confirmedAt); err != nil {
		t.Fatalf("MarkCreateSucceeded: %v", err)
	}

	var eventStatus, escrowEventID string
	var conditionsMetAt *time.Time
	if err := tx.QueryRow(ctx, `SELECT status::text, "escrowEventId", "conditionsMetAt" FROM events WHERE id = $1`, eventOC1).Scan(&eventStatus, &escrowEventID, &conditionsMetAt); err != nil {
		t.Fatalf("query event OC1: %v", err)
	}
	if eventStatus != "CREATED" {
		t.Errorf("event OC1 status = %q, want CREATED", eventStatus)
	}
	if escrowEventID != "bbbb0000000000000000000000000002" {
		t.Errorf("event OC1 escrowEventId = %q, want the last build's id", escrowEventID)
	}
	if conditionsMetAt == nil {
		t.Errorf("event OC1 conditionsMetAt is nil, want set")
	}

	// A build after success must refuse, unchanged.
	if err := pg.SaveCreateBuild(ctx, eventOC1, buildV1); err != ErrAlreadySucceeded {
		t.Errorf("SaveCreateBuild after success: err = %v, want ErrAlreadySucceeded", err)
	}
	// A second success-marking must also refuse.
	if err := pg.MarkCreateSucceeded(ctx, eventOC1, buildV2.EscrowEventID, time.Now()); err != ErrCreateBuildReplaced {
		t.Errorf("MarkCreateSucceeded twice: err = %v, want ErrCreateBuildReplaced", err)
	}

	// --- Event OC2: FAILED, then a successful rebuild --------------------
	seedDraftEvent(eventOC2)
	exec(`INSERT INTO prizes (id, "eventId", rank, amount, "updatedAt") VALUES ($1, $2, 1, '10.0000000', now())`, prizeOC2, eventOC2)

	buildA := CreateBuild{HostFunctionXDR: "xdr-oc2-a", SourceAccount: orgAddr, EscrowEventID: "cccc0000000000000000000000000003", Reward: 100_000_000}
	if err := pg.SaveCreateBuild(ctx, eventOC2, buildA); err != nil {
		t.Fatalf("SaveCreateBuild(OC2, a): %v", err)
	}
	if err := pg.MarkCreateFailed(ctx, eventOC2, "simulated submission failure"); err != nil {
		t.Fatalf("MarkCreateFailed: %v", err)
	}

	var oc2Status string
	var lastError *string
	if err := tx.QueryRow(ctx, `SELECT status::text, payload->>'lastError' FROM op_log WHERE "idempotencyKey" = $1`, createIdempotencyKey(eventOC2)).Scan(&oc2Status, &lastError); err != nil {
		t.Fatalf("query OC2 op_log: %v", err)
	}
	if oc2Status != OpStatusFailed {
		t.Errorf("OC2 op_log status = %q, want %q", oc2Status, OpStatusFailed)
	}
	if lastError == nil || *lastError != "simulated submission failure" {
		t.Errorf("OC2 op_log lastError = %v, want %q", lastError, "simulated submission failure")
	}

	buildB := buildA
	buildB.HostFunctionXDR = "xdr-oc2-b"
	if err := pg.SaveCreateBuild(ctx, eventOC2, buildB); err != nil {
		t.Fatalf("SaveCreateBuild(OC2, b, rebuild after failure): %v", err)
	}
	op2, err := pg.LoadCreateOp(ctx, eventOC2)
	if err != nil {
		t.Fatalf("LoadCreateOp(OC2): %v", err)
	}
	if op2.Status != OpStatusPending || op2.Build.HostFunctionXDR != "xdr-oc2-b" {
		t.Errorf("OC2 op after rebuild = %+v, want PENDING xdr-oc2-b", op2)
	}

	// MarkCreateFailed / LoadCreateOp against an event with no create op at
	// all.
	if err := pg.MarkCreateFailed(ctx, "99999999-9999-9999-9999-999999999999", "n/a"); err != ErrNotFound {
		t.Errorf("MarkCreateFailed(no op): err = %v, want ErrNotFound", err)
	}
	if _, err := pg.LoadCreateOp(ctx, "99999999-9999-9999-9999-999999999999"); err != ErrNotFound {
		t.Errorf("LoadCreateOp(no op): err = %v, want ErrNotFound", err)
	}

	// SaveCreateBuild against an event that does not exist at all.
	if err := pg.SaveCreateBuild(ctx, "99999999-9999-9999-9999-999999999999", buildA); err != ErrNotFound {
		t.Errorf("SaveCreateBuild(unknown event): err = %v, want ErrNotFound", err)
	}

	// --- Event OC3: not DRAFT, never built -- the plain "not DRAFT" error.
	const eventOC3 = "79999999-9999-9999-9999-999999999993"
	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "escrowEventId", "updatedAt")
	      VALUES ($1, $2, $3, 'Organizer Test Event OC3', 'LIVE', $4, now())`,
		eventOC3, userID, orgWlt, "dddd0000000000000000000000000004")
	err = pg.SaveCreateBuild(ctx, eventOC3, buildA)
	if err == nil || err == ErrAlreadySucceeded || err == ErrNotFound {
		t.Errorf("SaveCreateBuild(OC3, not DRAFT): err = %v, want a not-DRAFT error", err)
	}

	// --- Event OC4: DRAFT but already has an escrowEventId (shouldn't
	// happen through the handler, but the store must still refuse it).
	const eventOC4 = "7a999999-9999-9999-9999-999999999994"
	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "escrowEventId", "updatedAt")
	      VALUES ($1, $2, $3, 'Organizer Test Event OC4', 'DRAFT', $4, now())`,
		eventOC4, userID, orgWlt, "eeee0000000000000000000000000005")
	err = pg.SaveCreateBuild(ctx, eventOC4, buildA)
	if err == nil || err == ErrAlreadySucceeded || err == ErrNotFound {
		t.Errorf("SaveCreateBuild(OC4, already has escrowEventId): err = %v, want a guard error", err)
	}

	// LoadCreateOp against a payload that fails to decode as CreateBuild.
	const eventOC5 = "7b999999-9999-9999-9999-999999999995"
	exec(`INSERT INTO op_log (id, "idempotencyKey", operation, payload, status, "createdAt", "updatedAt")
	      VALUES (gen_random_uuid(), $1, 'create_event', '"not-an-object"'::jsonb, 'PENDING', now(), now())`,
		createIdempotencyKey(eventOC5))
	if _, err := pg.LoadCreateOp(ctx, eventOC5); err == nil || err == ErrNotFound {
		t.Errorf("LoadCreateOp(malformed payload): err = %v, want a decode error", err)
	}

	// MarkCreateSucceeded against a PENDING op_log row whose event is no
	// longer DRAFT (race) -- the conditional UPDATE's RowsAffected guard.
	const eventOC6 = "7c999999-9999-9999-9999-999999999996"
	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "updatedAt")
	      VALUES ($1, $2, $3, 'Organizer Test Event OC6', 'LIVE', now())`,
		eventOC6, userID, orgWlt)
	buildOC6 := CreateBuild{HostFunctionXDR: "xdr-oc6", SourceAccount: orgAddr, EscrowEventID: "ffff0000000000000000000000000006", Reward: 10_000_000}
	payloadOC6, err := json.Marshal(buildOC6)
	if err != nil {
		t.Fatalf("marshal buildOC6: %v", err)
	}
	exec(`INSERT INTO op_log (id, "idempotencyKey", operation, payload, status, "createdAt", "updatedAt")
	      VALUES (gen_random_uuid(), $1, 'create_event', $2::jsonb, 'PENDING', now(), now())`,
		createIdempotencyKey(eventOC6), payloadOC6)
	if err := pg.MarkCreateSucceeded(ctx, eventOC6, buildOC6.EscrowEventID, time.Now()); err == nil {
		t.Errorf("MarkCreateSucceeded(event not DRAFT, race): err = nil, want a race error")
	}

	// ======================================================================
	// deposit_funds writes
	// ======================================================================

	depositBuild1 := DepositBuild{HostFunctionXDR: "xdr-dep-1", SourceAccount: orgAddr, Amount: 500_000_000}
	opID1, err := pg.SaveDepositBuild(ctx, depositBuild1)
	if err != nil {
		t.Fatalf("SaveDepositBuild(1): %v", err)
	}
	if opID1 == "" {
		t.Fatal("SaveDepositBuild(1) returned an empty opId")
	}

	depositBuild2 := DepositBuild{HostFunctionXDR: "xdr-dep-2", SourceAccount: orgAddr, Amount: 250_000_000}
	opID2, err := pg.SaveDepositBuild(ctx, depositBuild2)
	if err != nil {
		t.Fatalf("SaveDepositBuild(2): %v", err)
	}
	if opID2 == opID1 {
		t.Fatalf("SaveDepositBuild returned the same opId twice: %q", opID1)
	}

	depOp1, err := pg.LoadDepositOp(ctx, opID1)
	if err != nil {
		t.Fatalf("LoadDepositOp(1): %v", err)
	}
	if depOp1.Status != OpStatusPending || depOp1.Build.HostFunctionXDR != "xdr-dep-1" {
		t.Errorf("LoadDepositOp(1) = %+v, want PENDING xdr-dep-1", depOp1)
	}

	if err := pg.MarkDepositSucceeded(ctx, opID1); err != nil {
		t.Fatalf("MarkDepositSucceeded(1): %v", err)
	}
	depOp1After, err := pg.LoadDepositOp(ctx, opID1)
	if err != nil {
		t.Fatalf("LoadDepositOp(1, after succeeded): %v", err)
	}
	if depOp1After.Status != OpStatusSucceeded {
		t.Errorf("deposit op 1 status = %q, want SUCCEEDED", depOp1After.Status)
	}
	// A second success-marking must refuse.
	if err := pg.MarkDepositSucceeded(ctx, opID1); err != ErrDepositNotPending {
		t.Errorf("MarkDepositSucceeded twice: err = %v, want ErrDepositNotPending", err)
	}

	if err := pg.MarkDepositFailed(ctx, opID2, "simulated timeout"); err != nil {
		t.Fatalf("MarkDepositFailed(2): %v", err)
	}
	var dep2Status string
	var dep2LastError *string
	if err := tx.QueryRow(ctx, `SELECT status::text, payload->>'lastError' FROM op_log WHERE "idempotencyKey" = $1`, depositIdempotencyKey(opID2)).Scan(&dep2Status, &dep2LastError); err != nil {
		t.Fatalf("query deposit op 2: %v", err)
	}
	if dep2Status != OpStatusFailed {
		t.Errorf("deposit op 2 status = %q, want FAILED", dep2Status)
	}
	if dep2LastError == nil || *dep2LastError != "simulated timeout" {
		t.Errorf("deposit op 2 lastError = %v, want %q", dep2LastError, "simulated timeout")
	}

	// Every deposit op against an unknown opId.
	if _, err := pg.LoadDepositOp(ctx, "no-such-op"); err != ErrNotFound {
		t.Errorf("LoadDepositOp(unknown): err = %v, want ErrNotFound", err)
	}
	if err := pg.MarkDepositSucceeded(ctx, "no-such-op"); err != ErrDepositNotPending {
		t.Errorf("MarkDepositSucceeded(unknown): err = %v, want ErrDepositNotPending", err)
	}
	if err := pg.MarkDepositFailed(ctx, "no-such-op", "n/a"); err != ErrNotFound {
		t.Errorf("MarkDepositFailed(unknown): err = %v, want ErrNotFound", err)
	}
}

// --- TestPostgres_StartWrites: gated integration test for the go-live
// path, mirroring TestPostgres_OrganizerWrites' create_event coverage above.

func TestPostgres_StartWrites(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping Postgres integration test")
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)

	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() {
		if err := tx.Rollback(ctx); err != nil && err != pgx.ErrTxClosed {
			t.Errorf("rollback: %v", err)
		}
	}()

	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := tx.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("seed %q: %v", sql, err)
		}
	}

	const (
		userID  = "81111111-1111-1111-1111-111111111111"
		orgWlt  = "82222222-2222-2222-2222-222222222222"
		orgAddr = "GORGSTARTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

		// Event OS1: happy path CREATED -> LIVE, then refused rebuild/re-mark.
		eventOS1       = "83333333-3333-3333-3333-333333333333"
		escrowEventOS1 = "aaaa1111111111111111111111111111"

		// Event OS2: FAILED, then a successful rebuild.
		eventOS2       = "85555555-5555-5555-5555-555555555555"
		escrowEventOS2 = "bbbb2222222222222222222222222222"
	)

	exec(`INSERT INTO users (id) VALUES ($1)`, userID)
	exec(`INSERT INTO wallets (id, "userId", address) VALUES ($1, $2, $3)`, orgWlt, userID, orgAddr)

	pg := &Postgres{db: tx, begin: tx}

	// --- Event OS1: happy path --------------------------------------------
	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "escrowEventId", "judgingDeadlineAt", "updatedAt")
	      VALUES ($1, $2, $3, 'Start Test Event OS1', 'CREATED', $4, now() + interval '48 hours', now())`,
		eventOS1, userID, orgWlt, escrowEventOS1)

	ev, err := pg.LoadEventForStart(ctx, eventOS1)
	if err != nil {
		t.Fatalf("LoadEventForStart(OS1): %v", err)
	}
	if ev.Status != "CREATED" || ev.OrganizerWalletAddress != orgAddr || ev.EscrowEventID == nil || *ev.EscrowEventID != escrowEventOS1 {
		t.Fatalf("LoadEventForStart(OS1) = %+v, want CREATED/orgAddr/escrowEventOS1", ev)
	}
	if ev.JudgingDeadlineAt == nil {
		t.Fatalf("LoadEventForStart(OS1).JudgingDeadlineAt is nil, want set")
	}

	buildV1 := StartBuild{HostFunctionXDR: "xdr-start-v1", SourceAccount: orgAddr, JudgingDeadline: ev.JudgingDeadlineAt.Unix(), Fee: 500}
	if err := pg.SaveStartBuild(ctx, eventOS1, buildV1); err != nil {
		t.Fatalf("SaveStartBuild(v1): %v", err)
	}
	assertStartOpRowCount(t, ctx, tx, eventOS1, 1)

	// Re-running /build overwrites the payload -- still exactly one row.
	buildV2 := buildV1
	buildV2.HostFunctionXDR = "xdr-start-v2"
	if err := pg.SaveStartBuild(ctx, eventOS1, buildV2); err != nil {
		t.Fatalf("SaveStartBuild(v2, overwrite): %v", err)
	}
	assertStartOpRowCount(t, ctx, tx, eventOS1, 1)

	op, err := pg.LoadStartOp(ctx, eventOS1)
	if err != nil {
		t.Fatalf("LoadStartOp: %v", err)
	}
	if op.Status != OpStatusPending || op.Build.HostFunctionXDR != "xdr-start-v2" {
		t.Errorf("LoadStartOp = %+v, want PENDING with the overwritten host function", op)
	}

	confirmedAt := time.Now().UTC().Truncate(time.Microsecond)
	if err := pg.MarkStartSucceeded(ctx, eventOS1, buildV2.HostFunctionXDR, confirmedAt); err != nil {
		t.Fatalf("MarkStartSucceeded: %v", err)
	}

	var eventStatus, escrowEventID string
	if err := tx.QueryRow(ctx, `SELECT status::text, "escrowEventId" FROM events WHERE id = $1`, eventOS1).Scan(&eventStatus, &escrowEventID); err != nil {
		t.Fatalf("query event OS1: %v", err)
	}
	if eventStatus != "LIVE" {
		t.Errorf("event OS1 status = %q, want LIVE", eventStatus)
	}
	if escrowEventID != escrowEventOS1 {
		t.Errorf("event OS1 escrowEventId = %q, want unchanged %q", escrowEventID, escrowEventOS1)
	}

	// A build after success must refuse, unchanged.
	if err := pg.SaveStartBuild(ctx, eventOS1, buildV1); err != ErrAlreadySucceeded {
		t.Errorf("SaveStartBuild after success: err = %v, want ErrAlreadySucceeded", err)
	}
	// A second confirmation (the sequential half of the conditional-update
	// race, issue #11) must refuse -- the op_log row is no longer PENDING.
	if err := pg.MarkStartSucceeded(ctx, eventOS1, buildV2.HostFunctionXDR, time.Now()); err != ErrStartBuildReplaced {
		t.Errorf("MarkStartSucceeded twice: err = %v, want ErrStartBuildReplaced", err)
	}

	// --- Event OS2: FAILED, then a successful rebuild ---------------------
	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "escrowEventId", "judgingDeadlineAt", "updatedAt")
	      VALUES ($1, $2, $3, 'Start Test Event OS2', 'CREATED', $4, now() + interval '48 hours', now())`,
		eventOS2, userID, orgWlt, escrowEventOS2)

	buildA := StartBuild{HostFunctionXDR: "xdr-os2-a", SourceAccount: orgAddr, JudgingDeadline: time.Now().Add(48 * time.Hour).Unix(), Fee: 200}
	if err := pg.SaveStartBuild(ctx, eventOS2, buildA); err != nil {
		t.Fatalf("SaveStartBuild(OS2, a): %v", err)
	}
	// A hostFunctionXDR mismatch (a rebuild happened, then the stale
	// submit's confirmation arrives) must refuse without touching the row.
	if err := pg.MarkStartSucceeded(ctx, eventOS2, "xdr-does-not-match", time.Now()); err != ErrStartBuildReplaced {
		t.Errorf("MarkStartSucceeded(OS2, mismatched xdr): err = %v, want ErrStartBuildReplaced", err)
	}
	if err := pg.MarkStartFailed(ctx, eventOS2, "simulated submission failure"); err != nil {
		t.Fatalf("MarkStartFailed(OS2): %v", err)
	}

	var os2Status string
	var os2LastError *string
	if err := tx.QueryRow(ctx, `SELECT status::text, payload->>'lastError' FROM op_log WHERE "idempotencyKey" = $1`, startIdempotencyKey(eventOS2)).Scan(&os2Status, &os2LastError); err != nil {
		t.Fatalf("query OS2 op_log: %v", err)
	}
	if os2Status != OpStatusFailed {
		t.Errorf("OS2 op_log status = %q, want %q", os2Status, OpStatusFailed)
	}
	if os2LastError == nil || *os2LastError != "simulated submission failure" {
		t.Errorf("OS2 op_log lastError = %v, want %q", os2LastError, "simulated submission failure")
	}

	buildB := buildA
	buildB.HostFunctionXDR = "xdr-os2-b"
	if err := pg.SaveStartBuild(ctx, eventOS2, buildB); err != nil {
		t.Fatalf("SaveStartBuild(OS2, b, rebuild after failure): %v", err)
	}
	op2, err := pg.LoadStartOp(ctx, eventOS2)
	if err != nil {
		t.Fatalf("LoadStartOp(OS2): %v", err)
	}
	if op2.Status != OpStatusPending || op2.Build.HostFunctionXDR != "xdr-os2-b" {
		t.Errorf("OS2 op after rebuild = %+v, want PENDING xdr-os2-b", op2)
	}

	// MarkStartFailed / LoadStartOp against an event with no start op at all.
	const noOpEvent = "89999999-9999-9999-9999-999999999999"
	if err := pg.MarkStartFailed(ctx, noOpEvent, "n/a"); err != ErrNotFound {
		t.Errorf("MarkStartFailed(no op): err = %v, want ErrNotFound", err)
	}
	if _, err := pg.LoadStartOp(ctx, noOpEvent); err != ErrNotFound {
		t.Errorf("LoadStartOp(no op): err = %v, want ErrNotFound", err)
	}

	// SaveStartBuild against an event that does not exist at all.
	if err := pg.SaveStartBuild(ctx, noOpEvent, buildA); err != ErrNotFound {
		t.Errorf("SaveStartBuild(unknown event): err = %v, want ErrNotFound", err)
	}

	// --- Event OS3: not CREATED, never built -- the plain "not CREATED" guard.
	const eventOS3 = "8a999999-9999-9999-9999-999999999993"
	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "escrowEventId", "updatedAt")
	      VALUES ($1, $2, $3, 'Start Test Event OS3', 'LIVE', $4, now())`,
		eventOS3, userID, orgWlt, "cccc3333333333333333333333333333")
	if err := pg.SaveStartBuild(ctx, eventOS3, buildA); err == nil || err == ErrAlreadySucceeded || err == ErrNotFound {
		t.Errorf("SaveStartBuild(OS3, not CREATED): err = %v, want a not-CREATED error", err)
	}

	// --- Event OS4: CREATED but no escrowEventId -- the store's own guard,
	// independent of the handler's own precondition check.
	const eventOS4 = "8b999999-9999-9999-9999-999999999994"
	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "updatedAt")
	      VALUES ($1, $2, $3, 'Start Test Event OS4', 'CREATED', now())`,
		eventOS4, userID, orgWlt)
	if err := pg.SaveStartBuild(ctx, eventOS4, buildA); err == nil || err == ErrAlreadySucceeded || err == ErrNotFound {
		t.Errorf("SaveStartBuild(OS4, no escrowEventId): err = %v, want a guard error", err)
	}

	// LoadStartOp against a payload that fails to decode as StartBuild.
	const eventOS5 = "8c999999-9999-9999-9999-999999999995"
	exec(`INSERT INTO op_log (id, "idempotencyKey", operation, payload, status, "createdAt", "updatedAt")
	      VALUES (gen_random_uuid(), $1, 'set_event_in_progress', '"not-an-object"'::jsonb, 'PENDING', now(), now())`,
		startIdempotencyKey(eventOS5))
	if _, err := pg.LoadStartOp(ctx, eventOS5); err == nil || err == ErrNotFound {
		t.Errorf("LoadStartOp(malformed payload): err = %v, want a decode error", err)
	}

	// MarkStartSucceeded against a PENDING op_log row whose event is no
	// longer CREATED (race) -- the events conditional UPDATE's RowsAffected
	// guard, independent of the op_log UPDATE's own guard above.
	const eventOS6 = "8d999999-9999-9999-9999-999999999996"
	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "updatedAt")
	      VALUES ($1, $2, $3, 'Start Test Event OS6', 'LIVE', now())`,
		eventOS6, userID, orgWlt)
	buildOS6 := StartBuild{HostFunctionXDR: "xdr-os6", SourceAccount: orgAddr, JudgingDeadline: time.Now().Add(48 * time.Hour).Unix(), Fee: 300}
	payloadOS6, err := json.Marshal(buildOS6)
	if err != nil {
		t.Fatalf("marshal buildOS6: %v", err)
	}
	exec(`INSERT INTO op_log (id, "idempotencyKey", operation, payload, status, "createdAt", "updatedAt")
	      VALUES (gen_random_uuid(), $1, 'set_event_in_progress', $2::jsonb, 'PENDING', now(), now())`,
		startIdempotencyKey(eventOS6), payloadOS6)
	if err := pg.MarkStartSucceeded(ctx, eventOS6, buildOS6.HostFunctionXDR, time.Now()); err == nil {
		t.Errorf("MarkStartSucceeded(event not CREATED, race): err = nil, want a race error")
	}
}

func assertStartOpRowCount(t *testing.T, ctx context.Context, tx pgx.Tx, eventID string, want int) {
	t.Helper()
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM op_log WHERE "idempotencyKey" = $1`, startIdempotencyKey(eventID)).Scan(&count); err != nil {
		t.Fatalf("count op_log rows: %v", err)
	}
	if count != want {
		t.Errorf("op_log row count for event %s = %d, want %d", eventID, count, want)
	}
}

func assertCreateOpRowCount(t *testing.T, ctx context.Context, tx pgx.Tx, eventID string, want int) {
	t.Helper()
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM op_log WHERE "idempotencyKey" = $1`, createIdempotencyKey(eventID)).Scan(&count); err != nil {
		t.Fatalf("count op_log rows: %v", err)
	}
	if count != want {
		t.Errorf("op_log row count for event %s = %d, want %d", eventID, count, want)
	}
}
