package store

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// TestPostgres_LoadEventForRelease is gated on TEST_DATABASE_URL so `go
// test ./...` stays green with no database available (see CI's core-go
// job, which sets it against the Postgres service container). It seeds
// the exact shape PR 2's happy path needs — one event, one ACTIVE judge,
// three prizes, two teams (three members and one member) — entirely
// inside one transaction on one connection, rolled back at the end, and
// points Postgres.db at that transaction directly so the seeded rows are
// visible to the very query path under test without ever being committed.
func TestPostgres_LoadEventForRelease(t *testing.T) {
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

	const (
		userID      = "11111111-1111-1111-1111-111111111111"
		orgWalletID = "22222222-2222-2222-2222-222222222222"
		eventID     = "33333333-3333-3333-3333-333333333333"
		teamAID     = "44444444-4444-4444-4444-444444444444"
		teamBID     = "55555555-5555-5555-5555-555555555555"
		walletA1    = "aaaaaaaa-0000-0000-0000-000000000001"
		walletA2    = "aaaaaaaa-0000-0000-0000-000000000002"
		walletA3    = "aaaaaaaa-0000-0000-0000-000000000003"
		walletB1    = "bbbbbbbb-0000-0000-0000-000000000001"
		judgeWallet = "GJUDGEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
		escrowID    = "0123456789abcdef0123456789abcdef"
	)

	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := tx.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("seed %q: %v", sql, err)
		}
	}

	exec(`INSERT INTO users (id) VALUES ($1)`, userID)
	exec(`INSERT INTO wallets (id, "userId", address) VALUES ($1, $2, $3)`,
		orgWalletID, userID, "GORGANIZERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
	exec(`INSERT INTO wallets (id, "userId", address) VALUES ($1, $2, $3)`, walletA1, userID, "GWALLETA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
	exec(`INSERT INTO wallets (id, "userId", address) VALUES ($1, $2, $3)`, walletA2, userID, "GWALLETA2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
	exec(`INSERT INTO wallets (id, "userId", address) VALUES ($1, $2, $3)`, walletA3, userID, "GWALLETA3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
	exec(`INSERT INTO wallets (id, "userId", address) VALUES ($1, $2, $3)`, walletB1, userID, "GWALLETB1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")

	exec(`INSERT INTO events (id, "organizerId", "organizerWalletId", name, status, "escrowEventId", "updatedAt")
	      VALUES ($1, $2, $3, 'Integration Test Event', 'LIVE', $4, now())`,
		eventID, userID, orgWalletID, escrowID)

	exec(`INSERT INTO judges (id, "eventId", "walletAddress", "displayName", status)
	      VALUES (gen_random_uuid(), $1, $2, 'Judge One', 'ACTIVE')`,
		eventID, judgeWallet)
	// A REMOVED judge must never show up in Judges — proves the ACTIVE
	// filter, not just that the query runs.
	exec(`INSERT INTO judges (id, "eventId", "walletAddress", "displayName", status)
	      VALUES (gen_random_uuid(), $1, 'GREMOVEDJUDGEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Removed Judge', 'REMOVED')`,
		eventID)

	exec(`INSERT INTO prizes (id, "eventId", rank, amount, "updatedAt") VALUES (gen_random_uuid(), $1, 1, $2, now())`, eventID, "150.1234500")
	exec(`INSERT INTO prizes (id, "eventId", rank, amount, "updatedAt") VALUES (gen_random_uuid(), $1, 2, $2, now())`, eventID, "75.0000001")
	exec(`INSERT INTO prizes (id, "eventId", rank, amount, "updatedAt") VALUES (gen_random_uuid(), $1, 3, $2, now())`, eventID, "25.9999999")

	exec(`INSERT INTO teams (id, "eventId", name, "submissionUrl", "updatedAt") VALUES ($1, $2, 'Team A', 'https://a.example', now())`, teamAID, eventID)
	exec(`INSERT INTO teams (id, "eventId", name, "submissionUrl", "updatedAt") VALUES ($1, $2, 'Team B', 'https://b.example', now())`, teamBID, eventID)

	// Team A: three members, an uneven split (remainder rule territory,
	// though allocating it is PR 2's job — this test only proves the raw
	// shares round-trip). Team B: one member, the full 10000 bp.
	exec(`INSERT INTO team_members (id, "teamId", "eventId", "walletId", "shareBasisPoints", ordinal) VALUES (gen_random_uuid(), $1, $2, $3, 3334, 0)`, teamAID, eventID, walletA1)
	exec(`INSERT INTO team_members (id, "teamId", "eventId", "walletId", "shareBasisPoints", ordinal) VALUES (gen_random_uuid(), $1, $2, $3, 3333, 1)`, teamAID, eventID, walletA2)
	exec(`INSERT INTO team_members (id, "teamId", "eventId", "walletId", "shareBasisPoints", ordinal) VALUES (gen_random_uuid(), $1, $2, $3, 3333, 2)`, teamAID, eventID, walletA3)
	exec(`INSERT INTO team_members (id, "teamId", "eventId", "walletId", "shareBasisPoints", ordinal) VALUES (gen_random_uuid(), $1, $2, $3, 10000, 0)`, teamBID, eventID, walletB1)

	// Only now, after every team_members write, does the event leave
	// {DRAFT, CREATED, LIVE} — team_members_enforce_freeze_trigger
	// (20260910080000_replace_participants_with_teams, FUNDED dropped in
	// 20260925120000_drop_funded_event_status) rejects membership
	// writes once judging has started.
	exec(`UPDATE events SET status = 'JUDGING' WHERE id = $1`, eventID)

	pg := &Postgres{db: tx}
	got, err := pg.LoadEventForRelease(ctx, eventID)
	if err != nil {
		t.Fatalf("LoadEventForRelease: %v", err)
	}

	if got.ID != eventID {
		t.Errorf("ID = %q, want %q", got.ID, eventID)
	}
	if got.Status != "JUDGING" {
		t.Errorf("Status = %q, want JUDGING", got.Status)
	}
	if got.EscrowEventID == nil || *got.EscrowEventID != escrowID {
		t.Errorf("EscrowEventID = %v, want %q", got.EscrowEventID, escrowID)
	}

	if len(got.Judges) != 1 || got.Judges[0] != judgeWallet {
		t.Errorf("Judges = %v, want exactly [%q]", got.Judges, judgeWallet)
	}

	wantAmounts := []string{"150.1234500", "75.0000001", "25.9999999"}
	if len(got.Prizes) != 3 {
		t.Fatalf("len(Prizes) = %d, want 3", len(got.Prizes))
	}
	for i, prize := range got.Prizes {
		if prize.Rank != i+1 {
			t.Errorf("Prizes[%d].Rank = %d, want %d", i, prize.Rank, i+1)
		}
		if prize.Amount != wantAmounts[i] {
			t.Errorf("Prizes[%d].Amount = %q, want exact text %q", i, prize.Amount, wantAmounts[i])
		}
	}

	if len(got.Teams) != 2 {
		t.Fatalf("len(Teams) = %d, want 2", len(got.Teams))
	}
	teamA, teamB := got.Teams[0], got.Teams[1]
	if teamA.ID != teamAID || teamB.ID != teamBID {
		t.Fatalf("team ids = [%s, %s], want [%s, %s]", teamA.ID, teamB.ID, teamAID, teamBID)
	}
	if len(teamA.Members) != 3 {
		t.Fatalf("len(Team A.Members) = %d, want 3", len(teamA.Members))
	}
	wantSharesA := []int{3334, 3333, 3333}
	wantWalletsA := []string{"GWALLETA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "GWALLETA2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "GWALLETA3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}
	for i, m := range teamA.Members {
		if m.Ordinal != i {
			t.Errorf("Team A.Members[%d].Ordinal = %d, want %d", i, m.Ordinal, i)
		}
		if m.ShareBasisPoints != wantSharesA[i] {
			t.Errorf("Team A.Members[%d].ShareBasisPoints = %d, want %d", i, m.ShareBasisPoints, wantSharesA[i])
		}
		if m.WalletAddress != wantWalletsA[i] {
			t.Errorf("Team A.Members[%d].WalletAddress = %q, want %q", i, m.WalletAddress, wantWalletsA[i])
		}
	}
	if len(teamB.Members) != 1 || teamB.Members[0].ShareBasisPoints != 10000 || teamB.Members[0].WalletAddress != "GWALLETB1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" {
		t.Errorf("Team B.Members = %+v, want one 10000bp member at GWALLETB1...", teamB.Members)
	}
}

// TestNew_ConnectsAndPings exercises the real pool lifecycle New/Close
// wrap — the seeded-transaction tests above bypass New entirely by
// pointing Postgres.db at a pgx.Tx, so this is the only test that proves
// New actually opens a working pool against a real database.
func TestNew_ConnectsAndPings(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping Postgres integration test")
	}

	pg, err := New(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	defer pg.Close()

	if pg.pool == nil {
		t.Error("pool = nil, want an open pool")
	}
	if _, err := pg.LoadEventForRelease(context.Background(), "99999999-9999-9999-9999-999999999999"); err != ErrNotFound {
		t.Errorf("LoadEventForRelease through the real pool: err = %v, want ErrNotFound", err)
	}
}

// TestNew_MalformedURL doesn't need TEST_DATABASE_URL — pgxpool.New fails
// on a malformed connection string before ever touching the network.
func TestNew_MalformedURL(t *testing.T) {
	_, err := New(context.Background(), "not-a-connection-string")
	if err == nil {
		t.Fatal("expected an error for a malformed DATABASE_URL, got nil")
	}
}

// TestNew_PingFails doesn't need TEST_DATABASE_URL either -- the URL is
// well-formed but names a port nothing listens on, so pgxpool.New succeeds
// (it doesn't connect eagerly) and the failure surfaces from Ping.
func TestNew_PingFails(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_, err := New(ctx, "postgres://postgres@127.0.0.1:1/nonexistent?sslmode=disable&connect_timeout=1")
	if err == nil {
		t.Fatal("expected an error for an unreachable database, got nil")
	}
}

func TestPostgres_LoadEventForRelease_NotFound(t *testing.T) {
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

	pg := &Postgres{db: tx}
	_, err = pg.LoadEventForRelease(ctx, "99999999-9999-9999-9999-999999999999")
	if err != ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}
