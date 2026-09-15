package store

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// TestMarkStartSucceeded_RealConcurrency exercises the genuine DB-level
// race issue #11 calls out: two /start/submit calls confirming the very
// same PENDING build against real, concurrent transactions. Every other
// gated integration test in this package shares one outer pgx.Tx and runs
// each write as a nested SAVEPOINT, which serializes all access through a
// single connection and can never reproduce two transactions genuinely
// racing each other -- so this test opens its own pool and a separate raw
// connection, seeds and commits real rows, and cleans them up explicitly
// at the end since nothing here rolls back.
//
// Postgres's own MVCC semantics make the outcome deterministic rather than
// a coin flip: the second UPDATE blocks on the first's row lock, then
// re-evaluates its WHERE clause once that lock releases -- by then the row
// is already SUCCEEDED, so the conditional UPDATE affects zero rows and
// MarkStartSucceeded returns ErrStartBuildReplaced.
func TestMarkStartSucceeded_RealConcurrency(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping Postgres integration test")
	}

	ctx := context.Background()
	pg, err := New(ctx, dbURL)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	defer pg.Close()

	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)

	const (
		userID          = "91111111-1111-1111-1111-111111111111"
		orgWlt          = "92222222-2222-2222-2222-222222222222"
		orgAddr         = "GORGRACEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
		eventID         = "93333333-3333-3333-3333-333333333333"
		escrowEventID   = "dddd4444444444444444444444444444"
		hostFunctionXDR = "xdr-race"
	)

	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := conn.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("seed %q: %v", sql, err)
		}
	}
	defer func() {
		// Explicit cleanup, in dependency order -- this test commits for
		// real, so there is no rollback to rely on.
		if _, err := conn.Exec(ctx, `DELETE FROM op_log WHERE "idempotencyKey" = $1`, startIdempotencyKey(eventID)); err != nil {
			t.Errorf("cleanup op_log: %v", err)
		}
		if _, err := conn.Exec(ctx, `DELETE FROM events WHERE id = $1`, eventID); err != nil {
			t.Errorf("cleanup events: %v", err)
		}
		if _, err := conn.Exec(ctx, `DELETE FROM wallets WHERE id = $1`, orgWlt); err != nil {
			t.Errorf("cleanup wallets: %v", err)
		}
		if _, err := conn.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID); err != nil {
			t.Errorf("cleanup users: %v", err)
		}
	}()

	exec(`INSERT INTO users (id) VALUES ($1)`, userID)
	exec(`INSERT INTO wallets (id, "userId", address) VALUES ($1, $2, $3)`, orgWlt, userID, orgAddr)
	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "escrowEventId", "judgingDeadlineAt", "updatedAt")
	      VALUES ($1, $2, $3, 'Race Test Event', 'CREATED', $4, now() + interval '48 hours', now())`,
		eventID, userID, orgWlt, escrowEventID)

	build := StartBuild{HostFunctionXDR: hostFunctionXDR, SourceAccount: orgAddr, JudgingDeadline: time.Now().Add(48 * time.Hour).Unix(), Fee: 500}
	if err := pg.SaveStartBuild(ctx, eventID, build); err != nil {
		t.Fatalf("SaveStartBuild: %v", err)
	}

	const n = 2
	errs := make([]error, n)
	var ready, start sync.WaitGroup
	ready.Add(n)
	start.Add(1)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			ready.Done()
			start.Wait()
			errs[i] = pg.MarkStartSucceeded(ctx, eventID, hostFunctionXDR, time.Now().UTC())
		}(i)
	}
	ready.Wait()
	start.Done()
	wg.Wait()

	var okCount, replacedCount int
	for _, err := range errs {
		switch err {
		case nil:
			okCount++
		case ErrStartBuildReplaced:
			replacedCount++
		default:
			t.Errorf("MarkStartSucceeded: unexpected error %v", err)
		}
	}
	if okCount != 1 || replacedCount != 1 {
		t.Fatalf("MarkStartSucceeded race: %d succeeded, %d replaced (errs=%v), want exactly 1 and 1", okCount, replacedCount, errs)
	}

	var eventStatus string
	if err := conn.QueryRow(ctx, `SELECT status::text FROM events WHERE id = $1`, eventID).Scan(&eventStatus); err != nil {
		t.Fatalf("query event: %v", err)
	}
	if eventStatus != "LIVE" {
		t.Errorf("event status = %q, want LIVE", eventStatus)
	}

	var opStatus string
	if err := conn.QueryRow(ctx, `SELECT status::text FROM op_log WHERE "idempotencyKey" = $1`, startIdempotencyKey(eventID)).Scan(&opStatus); err != nil {
		t.Fatalf("query op_log: %v", err)
	}
	if opStatus != OpStatusSucceeded {
		t.Errorf("op_log status = %q, want SUCCEEDED", opStatus)
	}

	var succeededCount int
	if err := conn.QueryRow(ctx, `SELECT count(*) FROM op_log WHERE "idempotencyKey" = $1 AND status = 'SUCCEEDED'`, startIdempotencyKey(eventID)).Scan(&succeededCount); err != nil {
		t.Fatalf("count succeeded op_log rows: %v", err)
	}
	if succeededCount != 1 {
		t.Errorf("SUCCEEDED op_log row count = %d, want 1", succeededCount)
	}
}
