// postgres_release.go implements the release path's writes: SaveReleaseBuild
// (op_log upsert + prize assignment), LoadReleaseOp (a read), and
// MarkReleaseSucceeded/MarkReleaseFailed (op_log + prize/event/payout
// transitions). Each write method opens and closes its own transaction —
// see txBeginner's doc comment in postgres.go for why that's a separate
// interface from the read-only querier db uses.
package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
)

// releaseIdempotencyKey is the op_log idempotencyKey for an event's release
// op — one row per event, ever (#185 decision 4).
func releaseIdempotencyKey(eventID string) string {
	return eventID + ":release_reward"
}

// SaveReleaseBuild re-validates, inside its own transaction, the two facts
// the handler already checked against a possibly-stale read
// (LoadEventForRelease): that the event is still JUDGING, and that every
// prize build.Winners names still belongs to this event. That closes the
// read-then-write race without leaking a transaction into the handler.
func (p *Postgres) SaveReleaseBuild(ctx context.Context, eventID string, build ReleaseBuild) error {
	tx, err := p.begin.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Checked before the event status: a successful release moves the event
	// to COMPLETED, so checking "is JUDGING" first would mask a rebuild
	// attempt after success behind the generic not-JUDGING error instead of
	// ErrAlreadySucceeded.
	var opStatus string
	err = tx.QueryRow(ctx, `SELECT status::text FROM op_log WHERE "idempotencyKey" = $1`, releaseIdempotencyKey(eventID)).Scan(&opStatus)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("store: load release op status: %w", err)
	}
	if opStatus == "SUCCEEDED" {
		return ErrAlreadySucceeded
	}

	var status string
	err = tx.QueryRow(ctx, `SELECT status::text FROM events WHERE id = $1 FOR UPDATE`, eventID).Scan(&status)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrNotFound
		}
		return fmt.Errorf("store: load event status: %w", err)
	}
	if status != "JUDGING" {
		return fmt.Errorf("store: event %s is not JUDGING (got %s)", eventID, status)
	}

	payload, err := json.Marshal(build)
	if err != nil {
		return fmt.Errorf("store: marshal release build payload: %w", err)
	}

	var opID string
	err = tx.QueryRow(ctx, `
		INSERT INTO op_log (id, "idempotencyKey", operation, payload, status, "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, 'release_reward', $2::jsonb, 'PENDING', now(), now())
		ON CONFLICT ("idempotencyKey") DO UPDATE
			SET payload = EXCLUDED.payload, status = 'PENDING', "updatedAt" = now()
			WHERE op_log.status <> 'SUCCEEDED'
		RETURNING id
	`, releaseIdempotencyKey(eventID), payload).Scan(&opID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrAlreadySucceeded
		}
		return fmt.Errorf("store: upsert release op_log: %w", err)
	}

	// One UPDATE per distinct prize (a team's several members share one
	// prizeId) so the affected-row-count assertion below means exactly
	// "this prize belongs to this event", not "this winner's prize was
	// touched N times".
	seenPrize := make(map[string]bool, len(build.Winners))
	for _, w := range build.Winners {
		if seenPrize[w.PrizeID] {
			continue
		}
		seenPrize[w.PrizeID] = true

		tag, err := tx.Exec(ctx, `
			UPDATE prizes SET "winnerTeamId" = $1, status = 'ASSIGNED', "updatedAt" = now()
			WHERE id = $2 AND "eventId" = $3
		`, w.TeamID, w.PrizeID, eventID)
		if err != nil {
			return fmt.Errorf("store: assign prize %s: %w", w.PrizeID, err)
		}
		if tag.RowsAffected() != 1 {
			return fmt.Errorf("store: prize %s does not belong to event %s", w.PrizeID, eventID)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit: %w", err)
	}
	return nil
}

// LoadReleaseOp is a plain read — it never needs its own transaction, so it
// runs through p.db like LoadEventForRelease does.
func (p *Postgres) LoadReleaseOp(ctx context.Context, eventID string) (*ReleaseOp, error) {
	var status string
	var payload []byte
	err := p.db.QueryRow(ctx,
		`SELECT status::text, payload FROM op_log WHERE "idempotencyKey" = $1`,
		releaseIdempotencyKey(eventID),
	).Scan(&status, &payload)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("store: load release op: %w", err)
	}

	var build ReleaseBuild
	if err := json.Unmarshal(payload, &build); err != nil {
		return nil, fmt.Errorf("store: decode release op payload: %w", err)
	}
	return &ReleaseOp{Status: status, Build: build}, nil
}

// MarkReleaseSucceeded reads the PENDING op_log row's own payload to learn
// the winners it needs to write Payout rows for, rather than taking them as
// a parameter — the payload SaveReleaseBuild persisted is the only place
// those TeamMemberID/PrizeID pairings live.
func (p *Postgres) MarkReleaseSucceeded(ctx context.Context, eventID, txHash string, paidAt time.Time) error {
	tx, err := p.begin.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var payload []byte
	err = tx.QueryRow(ctx, `
		UPDATE op_log SET status = 'SUCCEEDED', "updatedAt" = now()
		WHERE "idempotencyKey" = $1 AND status = 'PENDING'
		RETURNING payload
	`, releaseIdempotencyKey(eventID)).Scan(&payload)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrReleaseNotPending
		}
		return fmt.Errorf("store: mark release op succeeded: %w", err)
	}

	var build ReleaseBuild
	if err := json.Unmarshal(payload, &build); err != nil {
		return fmt.Errorf("store: decode release op payload: %w", err)
	}

	seenPrize := make(map[string]bool, len(build.Winners))
	for _, w := range build.Winners {
		if !seenPrize[w.PrizeID] {
			seenPrize[w.PrizeID] = true
			if _, err := tx.Exec(ctx, `
				UPDATE prizes SET status = 'RELEASED', "releaseTxHash" = $1, "releasedAt" = $2, "updatedAt" = now()
				WHERE id = $3
			`, txHash, paidAt, w.PrizeID); err != nil {
				return fmt.Errorf("store: mark prize %s released: %w", w.PrizeID, err)
			}
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO payouts (id, "prizeId", "teamMemberId", "txHash", amount, "confirmedAt")
			VALUES (gen_random_uuid(), $1, $2, $3, $4::numeric, now())
		`, w.PrizeID, w.TeamMemberID, txHash, escrow.StroopsToAmount(w.Stroops)); err != nil {
			return fmt.Errorf("store: insert payout for team member %s: %w", w.TeamMemberID, err)
		}
	}

	if _, err := tx.Exec(ctx, `UPDATE events SET status = 'COMPLETED', "updatedAt" = now() WHERE id = $1`, eventID); err != nil {
		return fmt.Errorf("store: mark event %s completed: %w", eventID, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit: %w", err)
	}
	return nil
}

// MarkReleaseFailed merges reason into the existing payload with jsonb's ||
// operator rather than reading, decoding, and rewriting the whole payload —
// simpler and race-free.
func (p *Postgres) MarkReleaseFailed(ctx context.Context, eventID, reason string) error {
	tx, err := p.begin.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE op_log
		SET status = 'FAILED', payload = payload || jsonb_build_object('lastError', $2::text), "updatedAt" = now()
		WHERE "idempotencyKey" = $1
	`, releaseIdempotencyKey(eventID), reason)
	if err != nil {
		return fmt.Errorf("store: mark release op failed: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit: %w", err)
	}
	return nil
}
