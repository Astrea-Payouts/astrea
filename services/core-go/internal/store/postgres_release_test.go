package store

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// TestPostgres_ReleaseWrites exercises SaveReleaseBuild, LoadReleaseOp,
// MarkReleaseSucceeded and MarkReleaseFailed together, gated on
// TEST_DATABASE_URL exactly like postgres_test.go. It seeds two events
// inside one outer transaction rolled back at the end; each write method
// opens its own nested transaction (a real Postgres SAVEPOINT, since
// Postgres.begin is set to the very pgx.Tx this test already holds — see
// txBeginner's doc comment in postgres.go), so every write below is
// visible to the next step without ever being committed to the database.
func TestPostgres_ReleaseWrites(t *testing.T) {
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
		userID  = "61111111-1111-1111-1111-111111111111"
		orgWlt  = "62222222-2222-2222-2222-222222222222"
		judgeW1 = "GJUDGERELEASEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

		// Event RS1: happy path through SUCCEEDED, then a refused rebuild.
		eventRS1 = "63333333-3333-3333-3333-333333333333"
		prize1a  = "64444444-4444-4444-4444-444444444441"
		prize1b  = "64444444-4444-4444-4444-444444444442"
		teamA    = "65555555-5555-5555-5555-555555555551"
		teamB    = "65555555-5555-5555-5555-555555555552"
		walletA1 = "6a111111-0000-0000-0000-000000000001"
		walletA2 = "6a111111-0000-0000-0000-000000000002"
		walletB1 = "6b111111-0000-0000-0000-000000000001"
		memberA1 = "6c111111-0000-0000-0000-000000000001"
		memberA2 = "6c111111-0000-0000-0000-000000000002"
		memberB1 = "6c111111-0000-0000-0000-000000000003"

		// Event RS2: FAILED, then a successful rebuild.
		eventRS2 = "66666666-6666-6666-6666-666666666666"
		prize2a  = "67777777-7777-7777-7777-777777777771"
		teamC    = "68888888-8888-8888-8888-888888888881"
		walletC1 = "6d111111-0000-0000-0000-000000000001"
		memberC1 = "6e111111-0000-0000-0000-000000000001"
	)

	exec(`INSERT INTO users (id) VALUES ($1)`, userID)
	exec(`INSERT INTO wallets (id, "userId", address) VALUES ($1, $2, $3)`, orgWlt, userID, "GORGRELEASEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
	walletAddresses := map[string]string{
		walletA1: "GWALLETA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		walletA2: "GWALLETA2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		walletB1: "GWALLETB1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		walletC1: "GWALLETC1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
	}
	for id, address := range walletAddresses {
		exec(`INSERT INTO wallets (id, "userId", address) VALUES ($1, $2, $3)`, id, userID, address)
	}

	seedJudgingEvent := func(eventID, escrowID string) {
		exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "escrowEventId", "updatedAt")
		      VALUES ($1, $2, $3, 'Release Test Event', 'LIVE', $4, now())`,
			eventID, userID, orgWlt, escrowID)
		exec(`INSERT INTO judges (id, "eventId", "walletAddress", "displayName", status)
		      VALUES (gen_random_uuid(), $1, $2, 'Judge', 'ACTIVE')`, eventID, judgeW1)
	}

	// --- Event RS1: two prizes, two teams -----------------------------
	seedJudgingEvent(eventRS1, "aaaa0000000000000000000000000001")
	exec(`INSERT INTO prizes (id, "eventId", rank, amount, "updatedAt") VALUES ($1, $2, 1, '100.0000000', now())`, prize1a, eventRS1)
	exec(`INSERT INTO prizes (id, "eventId", rank, amount, "updatedAt") VALUES ($1, $2, 2, '50.0000000', now())`, prize1b, eventRS1)
	exec(`INSERT INTO teams (id, "eventId", name, "submissionUrl", "updatedAt") VALUES ($1, $2, 'Team A', 'https://a.example', now())`, teamA, eventRS1)
	exec(`INSERT INTO teams (id, "eventId", name, "submissionUrl", "updatedAt") VALUES ($1, $2, 'Team B', 'https://b.example', now())`, teamB, eventRS1)
	exec(`INSERT INTO team_members (id, "teamId", "eventId", "walletId", "shareBasisPoints", ordinal) VALUES ($1, $2, $3, $4, 5000, 0)`, memberA1, teamA, eventRS1, walletA1)
	exec(`INSERT INTO team_members (id, "teamId", "eventId", "walletId", "shareBasisPoints", ordinal) VALUES ($1, $2, $3, $4, 5000, 1)`, memberA2, teamA, eventRS1, walletA2)
	exec(`INSERT INTO team_members (id, "teamId", "eventId", "walletId", "shareBasisPoints", ordinal) VALUES ($1, $2, $3, $4, 10000, 0)`, memberB1, teamB, eventRS1, walletB1)
	exec(`UPDATE events SET status = 'JUDGING' WHERE id = $1`, eventRS1)

	pg := &Postgres{db: tx, begin: tx}

	buildV1 := ReleaseBuild{
		HostFunctionXDR: "xdr-v1",
		SourceAccount:   judgeW1,
		Winners: []ReleaseWinner{
			{PrizeID: prize1a, TeamID: teamA, TeamMemberID: memberA1, Address: "addrA1", Stroops: 500_000_000, Rank: 1},
			{PrizeID: prize1a, TeamID: teamA, TeamMemberID: memberA2, Address: "addrA2", Stroops: 500_000_000, Rank: 1},
			{PrizeID: prize1b, TeamID: teamB, TeamMemberID: memberB1, Address: "addrB1", Stroops: 500_000_000, Rank: 2},
		},
	}
	if err := pg.SaveReleaseBuild(ctx, eventRS1, buildV1); err != nil {
		t.Fatalf("SaveReleaseBuild(v1): %v", err)
	}

	assertOpLogRowCount(t, ctx, tx, eventRS1, 1)
	assertPrizeAssignment(t, ctx, tx, prize1a, teamA, "ASSIGNED")
	assertPrizeAssignment(t, ctx, tx, prize1b, teamB, "ASSIGNED")

	// Re-running /build overwrites the payload, still exactly one row.
	buildV2 := buildV1
	buildV2.HostFunctionXDR = "xdr-v2"
	if err := pg.SaveReleaseBuild(ctx, eventRS1, buildV2); err != nil {
		t.Fatalf("SaveReleaseBuild(v2, overwrite): %v", err)
	}
	assertOpLogRowCount(t, ctx, tx, eventRS1, 1)

	op, err := pg.LoadReleaseOp(ctx, eventRS1)
	if err != nil {
		t.Fatalf("LoadReleaseOp: %v", err)
	}
	if op.Status != OpStatusPending {
		t.Errorf("op.Status = %q, want %q", op.Status, OpStatusPending)
	}
	if op.Build.HostFunctionXDR != "xdr-v2" {
		t.Errorf("op.Build.HostFunctionXDR = %q, want %q (the overwritten build)", op.Build.HostFunctionXDR, "xdr-v2")
	}
	if len(op.Build.Winners) != 3 {
		t.Fatalf("len(op.Build.Winners) = %d, want 3", len(op.Build.Winners))
	}

	paidAt := time.Now().UTC().Truncate(time.Microsecond)
	if err := pg.MarkReleaseSucceeded(ctx, eventRS1, "rs1-tx-hash", paidAt); err != nil {
		t.Fatalf("MarkReleaseSucceeded: %v", err)
	}

	var opStatus string
	if err := tx.QueryRow(ctx, `SELECT status::text FROM op_log WHERE "idempotencyKey" = $1`, releaseIdempotencyKey(eventRS1)).Scan(&opStatus); err != nil {
		t.Fatalf("query op_log status: %v", err)
	}
	if opStatus != OpStatusSucceeded {
		t.Errorf("op_log status = %q, want %q", opStatus, OpStatusSucceeded)
	}

	for _, prizeID := range []string{prize1a, prize1b} {
		var status, txHash string
		var releasedAt *time.Time
		if err := tx.QueryRow(ctx, `SELECT status::text, "releaseTxHash", "releasedAt" FROM prizes WHERE id = $1`, prizeID).Scan(&status, &txHash, &releasedAt); err != nil {
			t.Fatalf("query prize %s: %v", prizeID, err)
		}
		if status != "RELEASED" {
			t.Errorf("prize %s status = %q, want RELEASED", prizeID, status)
		}
		if txHash != "rs1-tx-hash" {
			t.Errorf("prize %s releaseTxHash = %q, want %q", prizeID, txHash, "rs1-tx-hash")
		}
		if releasedAt == nil {
			t.Errorf("prize %s releasedAt is nil, want set", prizeID)
		}
	}

	var payoutCount int
	var distinctHashes int
	if err := tx.QueryRow(ctx, `SELECT count(*), count(DISTINCT "txHash") FROM payouts WHERE "prizeId" IN ($1, $2)`, prize1a, prize1b).Scan(&payoutCount, &distinctHashes); err != nil {
		t.Fatalf("query payouts: %v", err)
	}
	if payoutCount != 3 {
		t.Errorf("payout count = %d, want 3 (one per winner)", payoutCount)
	}
	if distinctHashes != 1 {
		t.Errorf("distinct payout tx hashes = %d, want 1 (every payout from one release shares a hash)", distinctHashes)
	}

	var eventStatus string
	if err := tx.QueryRow(ctx, `SELECT status::text FROM events WHERE id = $1`, eventRS1).Scan(&eventStatus); err != nil {
		t.Fatalf("query event status: %v", err)
	}
	if eventStatus != "COMPLETED" {
		t.Errorf("event status = %q, want COMPLETED", eventStatus)
	}

	// A build after success must refuse, unchanged.
	if err := pg.SaveReleaseBuild(ctx, eventRS1, buildV1); err != ErrAlreadySucceeded {
		t.Errorf("SaveReleaseBuild after success: err = %v, want ErrAlreadySucceeded", err)
	}
	// A second success-marking must also refuse.
	if err := pg.MarkReleaseSucceeded(ctx, eventRS1, "rs1-tx-hash-2", time.Now()); err != ErrReleaseNotPending {
		t.Errorf("MarkReleaseSucceeded twice: err = %v, want ErrReleaseNotPending", err)
	}

	// --- Event RS2: FAILED, then a successful rebuild -------------------
	seedJudgingEvent(eventRS2, "bbbb0000000000000000000000000002")
	exec(`INSERT INTO prizes (id, "eventId", rank, amount, "updatedAt") VALUES ($1, $2, 1, '10.0000000', now())`, prize2a, eventRS2)
	exec(`INSERT INTO teams (id, "eventId", name, "submissionUrl", "updatedAt") VALUES ($1, $2, 'Team C', 'https://c.example', now())`, teamC, eventRS2)
	exec(`INSERT INTO team_members (id, "teamId", "eventId", "walletId", "shareBasisPoints", ordinal) VALUES ($1, $2, $3, $4, 10000, 0)`, memberC1, teamC, eventRS2, walletC1)
	exec(`UPDATE events SET status = 'JUDGING' WHERE id = $1`, eventRS2)

	buildA := ReleaseBuild{
		HostFunctionXDR: "xdr-rs2-a",
		SourceAccount:   judgeW1,
		Winners: []ReleaseWinner{
			{PrizeID: prize2a, TeamID: teamC, TeamMemberID: memberC1, Address: "addrC1", Stroops: 100_000_000, Rank: 1},
		},
	}
	if err := pg.SaveReleaseBuild(ctx, eventRS2, buildA); err != nil {
		t.Fatalf("SaveReleaseBuild(RS2, a): %v", err)
	}

	if err := pg.MarkReleaseFailed(ctx, eventRS2, "simulated submission failure"); err != nil {
		t.Fatalf("MarkReleaseFailed: %v", err)
	}

	var rs2Status string
	var lastError *string
	if err := tx.QueryRow(ctx, `SELECT status::text, payload->>'lastError' FROM op_log WHERE "idempotencyKey" = $1`, releaseIdempotencyKey(eventRS2)).Scan(&rs2Status, &lastError); err != nil {
		t.Fatalf("query RS2 op_log: %v", err)
	}
	if rs2Status != OpStatusFailed {
		t.Errorf("RS2 op_log status = %q, want %q", rs2Status, OpStatusFailed)
	}
	if lastError == nil || *lastError != "simulated submission failure" {
		t.Errorf("RS2 op_log lastError = %v, want %q", lastError, "simulated submission failure")
	}

	// Prizes stay ASSIGNED after a failure -- a new /build can overwrite.
	assertPrizeAssignment(t, ctx, tx, prize2a, teamC, "ASSIGNED")

	buildB := buildA
	buildB.HostFunctionXDR = "xdr-rs2-b"
	if err := pg.SaveReleaseBuild(ctx, eventRS2, buildB); err != nil {
		t.Fatalf("SaveReleaseBuild(RS2, b, rebuild after failure): %v", err)
	}
	op2, err := pg.LoadReleaseOp(ctx, eventRS2)
	if err != nil {
		t.Fatalf("LoadReleaseOp(RS2): %v", err)
	}
	if op2.Status != OpStatusPending {
		t.Errorf("RS2 op.Status after rebuild = %q, want %q", op2.Status, OpStatusPending)
	}
	if op2.Build.HostFunctionXDR != "xdr-rs2-b" {
		t.Errorf("RS2 op.Build.HostFunctionXDR = %q, want %q", op2.Build.HostFunctionXDR, "xdr-rs2-b")
	}

	// MarkReleaseFailed against an event with no release op at all.
	if err := pg.MarkReleaseFailed(ctx, "99999999-9999-9999-9999-999999999999", "n/a"); err != ErrNotFound {
		t.Errorf("MarkReleaseFailed(no op): err = %v, want ErrNotFound", err)
	}
	// LoadReleaseOp against an event with no release op at all.
	if _, err := pg.LoadReleaseOp(ctx, "99999999-9999-9999-9999-999999999999"); err != ErrNotFound {
		t.Errorf("LoadReleaseOp(no op): err = %v, want ErrNotFound", err)
	}

	// SaveReleaseBuild against an event that does not exist at all.
	if err := pg.SaveReleaseBuild(ctx, "99999999-9999-9999-9999-999999999999", buildA); err != ErrNotFound {
		t.Errorf("SaveReleaseBuild(unknown event): err = %v, want ErrNotFound", err)
	}

	// --- Event RS3: not JUDGING, never built -- the plain "not JUDGING"
	// error, distinct from ErrAlreadySucceeded (no op_log row at all here).
	const eventRS3 = "69999999-9999-9999-9999-999999999993"
	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "escrowEventId", "updatedAt")
	      VALUES ($1, $2, $3, 'Release Test Event RS3', 'LIVE', $4, now())`,
		eventRS3, userID, orgWlt, "cccc0000000000000000000000000003")
	err = pg.SaveReleaseBuild(ctx, eventRS3, buildA)
	if err == nil || err == ErrAlreadySucceeded || err == ErrNotFound || !strings.Contains(err.Error(), "is not JUDGING") {
		t.Errorf("SaveReleaseBuild(RS3, not JUDGING): err = %v, want a not-JUDGING error", err)
	}

	// --- Event RS4: JUDGING, but the build names a prize from RS1 -- the
	// "prize does not belong to event" guard.
	const eventRS4 = "6a999999-9999-9999-9999-999999999994"
	seedJudgingEvent(eventRS4, "dddd0000000000000000000000000004")
	exec(`UPDATE events SET status = 'JUDGING' WHERE id = $1`, eventRS4)
	buildWrongPrize := ReleaseBuild{
		HostFunctionXDR: "xdr-rs4",
		SourceAccount:   judgeW1,
		Winners: []ReleaseWinner{
			{PrizeID: prize1a, TeamID: teamA, TeamMemberID: memberA1, Address: "addrA1", Stroops: 100_000_000, Rank: 1},
		},
	}
	err = pg.SaveReleaseBuild(ctx, eventRS4, buildWrongPrize)
	if err == nil || err == ErrAlreadySucceeded || err == ErrNotFound || !strings.Contains(err.Error(), "does not belong to event") {
		t.Errorf("SaveReleaseBuild(RS4, prize from another event): err = %v, want a does-not-belong-to-event error", err)
	}

	// LoadReleaseOp against a payload that fails to decode as ReleaseBuild.
	const eventRS5 = "6b999999-9999-9999-9999-999999999995"
	exec(`INSERT INTO op_log (id, "idempotencyKey", operation, payload, status, "createdAt", "updatedAt")
	      VALUES (gen_random_uuid(), $1, 'release_reward', '"not-an-object"'::jsonb, 'PENDING', now(), now())`,
		releaseIdempotencyKey(eventRS5))
	if _, err := pg.LoadReleaseOp(ctx, eventRS5); err == nil || err == ErrNotFound {
		t.Errorf("LoadReleaseOp(malformed payload): err = %v, want a decode error", err)
	}

	// MarkReleaseSucceeded against a PENDING op_log row whose payload fails
	// to decode as ReleaseBuild.
	const eventRS6 = "6c999999-9999-9999-9999-999999999996"
	exec(`INSERT INTO op_log (id, "idempotencyKey", operation, payload, status, "createdAt", "updatedAt")
	      VALUES (gen_random_uuid(), $1, 'release_reward', '"not-an-object"'::jsonb, 'PENDING', now(), now())`,
		releaseIdempotencyKey(eventRS6))
	if err := pg.MarkReleaseSucceeded(ctx, eventRS6, "rs6-tx-hash", time.Now()); err == nil {
		t.Errorf("MarkReleaseSucceeded(malformed payload): err = nil, want a decode error")
	}

	// MarkReleaseSucceeded against a PENDING op_log row naming a
	// teamMemberId that doesn't exist -- the payouts insert's FK must
	// surface as an error, not silently drop the payout.
	const eventRS7 = "6d999999-9999-9999-9999-999999999997"
	seedJudgingEvent(eventRS7, "eeee0000000000000000000000000007")
	exec(`UPDATE events SET status = 'JUDGING' WHERE id = $1`, eventRS7)
	prize7 := "6e999999-9999-9999-9999-999999999998"
	exec(`INSERT INTO prizes (id, "eventId", rank, amount, "updatedAt") VALUES ($1, $2, 1, '10.0000000', now())`, prize7, eventRS7)
	buildRS7 := ReleaseBuild{
		HostFunctionXDR: "xdr-rs7",
		SourceAccount:   judgeW1,
		Winners: []ReleaseWinner{
			{PrizeID: prize7, TeamID: teamC, TeamMemberID: "6f999999-9999-9999-9999-999999999999", Address: "addrGhost", Stroops: 100_000_000, Rank: 1},
		},
	}
	if err := pg.SaveReleaseBuild(ctx, eventRS7, buildRS7); err != nil {
		t.Fatalf("SaveReleaseBuild(RS7): %v", err)
	}
	if err := pg.MarkReleaseSucceeded(ctx, eventRS7, "rs7-tx-hash", time.Now()); err == nil {
		t.Errorf("MarkReleaseSucceeded(nonexistent teamMemberId): err = nil, want a foreign key error")
	}
}

func assertOpLogRowCount(t *testing.T, ctx context.Context, tx pgx.Tx, eventID string, want int) {
	t.Helper()
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM op_log WHERE "idempotencyKey" = $1`, releaseIdempotencyKey(eventID)).Scan(&count); err != nil {
		t.Fatalf("count op_log rows: %v", err)
	}
	if count != want {
		t.Errorf("op_log row count for event %s = %d, want %d", eventID, count, want)
	}
}

func assertPrizeAssignment(t *testing.T, ctx context.Context, tx pgx.Tx, prizeID, wantTeamID, wantStatus string) {
	t.Helper()
	var teamID, status string
	if err := tx.QueryRow(ctx, `SELECT "winnerTeamId", status::text FROM prizes WHERE id = $1`, prizeID).Scan(&teamID, &status); err != nil {
		t.Fatalf("query prize %s: %v", prizeID, err)
	}
	if teamID != wantTeamID {
		t.Errorf("prize %s winnerTeamId = %q, want %q", prizeID, teamID, wantTeamID)
	}
	if status != wantStatus {
		t.Errorf("prize %s status = %q, want %q", prizeID, status, wantStatus)
	}
}
