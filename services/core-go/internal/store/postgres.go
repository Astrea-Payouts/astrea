package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// querier is the subset of *pgxpool.Pool (and of pgx.Tx / *pgx.Conn) that
// LoadEventForRelease needs. Narrow on purpose: it lets postgres_test.go
// point Postgres at an open transaction instead of the pool, so a row
// seeded on that transaction is visible to the very query path under test
// and never actually committed.
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Postgres is the pgx-backed Store. Tables are snake_case (Prisma's
// @@map), but columns are camelCase and Prisma never renames them, so
// every identifier below is double-quoted — an unquoted eventid is a
// different, nonexistent column to Postgres.
type Postgres struct {
	pool *pgxpool.Pool // owns the connection lifecycle; Close() releases it
	db   querier       // what queries actually run against
}

// New opens a pool against databaseURL and pings it, so a bad connection
// string or an unreachable database fails at boot rather than on the first
// request.
func New(ctx context.Context, databaseURL string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("store: open pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("store: ping: %w", err)
	}
	return &Postgres{pool: pool, db: pool}, nil
}

// Close releases every connection in the pool.
func (p *Postgres) Close() {
	p.pool.Close()
}

func (p *Postgres) LoadEventForRelease(ctx context.Context, eventID string) (*EventForRelease, error) {
	event := &EventForRelease{ID: eventID}
	err := p.db.QueryRow(ctx,
		// status::text: EventStatus is a Postgres enum, an OID pgx has no
		// built-in codec for — casting it to text avoids depending on
		// runtime type registration to scan it into a plain Go string.
		`SELECT status::text, "escrowEventId" FROM events WHERE id = $1`,
		eventID,
	).Scan(&event.Status, &event.EscrowEventID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("store: load event: %w", err)
	}

	judgeRows, err := p.db.Query(ctx,
		`SELECT "walletAddress" FROM judges WHERE "eventId" = $1 AND status = 'ACTIVE'`,
		eventID,
	)
	if err != nil {
		return nil, fmt.Errorf("store: load judges: %w", err)
	}
	event.Judges, err = pgx.CollectRows(judgeRows, pgx.RowTo[string])
	if err != nil {
		return nil, fmt.Errorf("store: scan judges: %w", err)
	}

	// id::text, amount::text: both are Postgres types (uuid, numeric) that
	// pgx's binary codecs can't scan directly into a plain Go string —
	// casting in the SELECT list is what gets an ordinary string back out.
	// amount also keeps the exact Decimal(18,7) text Postgres renders, on
	// purpose: the Decimal->i128 conversion is PR 2's job, not this one's.
	prizeRows, err := p.db.Query(ctx,
		`SELECT id::text, rank, amount::text FROM prizes WHERE "eventId" = $1 ORDER BY rank`,
		eventID,
	)
	if err != nil {
		return nil, fmt.Errorf("store: load prizes: %w", err)
	}
	event.Prizes, err = pgx.CollectRows(prizeRows, pgx.RowToStructByPos[Prize])
	if err != nil {
		return nil, fmt.Errorf("store: scan prizes: %w", err)
	}

	// One join for teams + members + wallet address, ordered so members of
	// the same team arrive together — avoids an N+1 per team.
	memberRows, err := p.db.Query(ctx,
		`SELECT t.id::text, tm.id::text, tm.ordinal, tm."shareBasisPoints", w.address
		 FROM teams t
		 JOIN team_members tm ON tm."teamId" = t.id
		 JOIN wallets w ON w.id = tm."walletId"
		 WHERE t."eventId" = $1
		 ORDER BY t.id, tm.ordinal`,
		eventID,
	)
	if err != nil {
		return nil, fmt.Errorf("store: load teams: %w", err)
	}
	event.Teams, err = collectTeams(memberRows)
	if err != nil {
		return nil, fmt.Errorf("store: scan teams: %w", err)
	}

	return event, nil
}

// collectTeams groups the flat team/member join rows into Team{Members}
// slices, preserving the query's team-then-ordinal order.
func collectTeams(rows pgx.Rows) ([]Team, error) {
	defer rows.Close()

	var teams []Team
	var current *Team
	for rows.Next() {
		var teamID string
		var member Member
		if err := rows.Scan(&teamID, &member.ID, &member.Ordinal, &member.ShareBasisPoints, &member.WalletAddress); err != nil {
			return nil, err
		}
		if current == nil || current.ID != teamID {
			teams = append(teams, Team{ID: teamID})
			current = &teams[len(teams)-1]
		}
		current.Members = append(current.Members, member)
	}
	return teams, rows.Err()
}
