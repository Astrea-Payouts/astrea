// postgres_organizer.go implements the organizer path's reads and writes
// (issue #11 PR 1): LoadEventForCreate, the create_event op_log lifecycle
// (SaveCreateBuild/LoadCreateOp/MarkCreateSucceeded/MarkCreateFailed), and
// the deposit_funds op_log lifecycle (SaveDepositBuild/LoadDepositOp/
// MarkDepositSucceeded/MarkDepositFailed). create_event's writes mirror
// postgres_release.go's shape (one op_log row per event, ever, re-validated
// inside its own transaction); deposit_funds' writes are simpler — every
// build is a brand new row, so no re-validation transaction is needed.
package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// createIdempotencyKey is the op_log idempotencyKey for an event's
// create_event op — one row per event, ever (issue #11 decision 5, mirroring
// #185 decision 4's release_reward key).
func createIdempotencyKey(eventID string) string {
	return eventID + ":create_event"
}

// depositIdempotencyKey is the op_log idempotencyKey for one deposit
// attempt. Unlike createIdempotencyKey, opID is generated fresh by
// newOpID() for every /deposit/build call — deposits repeat, so this key
// never collides across builds and never needs an upsert.
func depositIdempotencyKey(opID string) string {
	return "deposit_funds:" + opID
}

// startIdempotencyKey is the op_log idempotencyKey for an event's
// set_event_in_progress (go-live) op — one row per event, ever, mirroring
// createIdempotencyKey.
func startIdempotencyKey(eventID string) string {
	return eventID + ":set_event_in_progress"
}

// newOpID generates a random operation id for one deposit attempt —
// returned to the client at /build time and taken back at /submit (issue
// #11 decision 5). 16 bytes of CSPRNG output, hex-encoded, the same shape
// as escrow.EventID.String() produces.
func newOpID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("store: generating operation id: %w", err)
	}
	return hex.EncodeToString(b[:]), nil
}

// LoadEventForCreate is a plain read, like LoadEventForRelease — it never
// needs its own transaction.
func (p *Postgres) LoadEventForCreate(ctx context.Context, eventID string) (*EventForCreate, error) {
	event := &EventForCreate{ID: eventID}
	err := p.db.QueryRow(ctx, `
		SELECT e.status::text, e."escrowEventId", w.address
		FROM events e
		JOIN wallets w ON w.id = e."organizerWalletId"
		WHERE e.id = $1
	`, eventID).Scan(&event.Status, &event.EscrowEventID, &event.OrganizerWalletAddress)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("store: load event: %w", err)
	}

	event.Judges, event.Prizes, err = loadJudgesAndPrizes(ctx, p.db, eventID)
	if err != nil {
		return nil, err
	}

	return event, nil
}

// SaveCreateBuild re-validates, inside its own transaction, that the event
// is still DRAFT with no escrowEventId yet — the same read-then-write race
// guard SaveReleaseBuild applies to JUDGING.
func (p *Postgres) SaveCreateBuild(ctx context.Context, eventID string, build CreateBuild) error {
	tx, err := p.begin.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Checked before the event status, same reasoning as SaveReleaseBuild:
	// a successful create_event moves escrowEventId off null, so checking
	// "is DRAFT" first would mask a rebuild attempt after success behind
	// the generic not-DRAFT error instead of ErrAlreadySucceeded.
	var opStatus string
	err = tx.QueryRow(ctx, `SELECT status::text FROM op_log WHERE "idempotencyKey" = $1`, createIdempotencyKey(eventID)).Scan(&opStatus)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("store: load create op status: %w", err)
	}
	if opStatus == "SUCCEEDED" {
		return ErrAlreadySucceeded
	}

	var status string
	var escrowEventID *string
	err = tx.QueryRow(ctx, `SELECT status::text, "escrowEventId" FROM events WHERE id = $1 FOR UPDATE`, eventID).Scan(&status, &escrowEventID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrNotFound
		}
		return fmt.Errorf("store: load event status: %w", err)
	}
	if status != "DRAFT" {
		return fmt.Errorf("store: event %s is not DRAFT (got %s)", eventID, status)
	}
	if escrowEventID != nil {
		return fmt.Errorf("store: event %s already has an escrowEventId", eventID)
	}

	payload, err := json.Marshal(build)
	if err != nil {
		return fmt.Errorf("store: marshal create build payload: %w", err)
	}

	var opID string
	err = tx.QueryRow(ctx, `
		INSERT INTO op_log (id, "idempotencyKey", operation, payload, status, "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, 'create_event', $2::jsonb, 'PENDING', now(), now())
		ON CONFLICT ("idempotencyKey") DO UPDATE
			SET payload = EXCLUDED.payload, status = 'PENDING', "updatedAt" = now()
			WHERE op_log.status <> 'SUCCEEDED'
		RETURNING id
	`, createIdempotencyKey(eventID), payload).Scan(&opID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrAlreadySucceeded
		}
		return fmt.Errorf("store: upsert create op_log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit: %w", err)
	}
	return nil
}

// LoadCreateOp is a plain read — it never needs its own transaction.
func (p *Postgres) LoadCreateOp(ctx context.Context, eventID string) (*CreateOp, error) {
	var status string
	var payload []byte
	err := p.db.QueryRow(ctx,
		`SELECT status::text, payload FROM op_log WHERE "idempotencyKey" = $1`,
		createIdempotencyKey(eventID),
	).Scan(&status, &payload)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("store: load create op: %w", err)
	}

	var build CreateBuild
	if err := json.Unmarshal(payload, &build); err != nil {
		return nil, fmt.Errorf("store: decode create op payload: %w", err)
	}
	return &CreateOp{Status: status, Build: build}, nil
}

// MarkCreateSucceeded confirms the op_log row for escrowEventID specifically
// -- not just whatever's currently PENDING. A rebuild (/create/build called
// again while an earlier submit's RPC call is still in flight) overwrites
// the same row with a new escrowEventId, so matching on status alone would
// let a slow, stale submit confirm a build that was never the one it
// verified against the signed envelope. See ErrCreateBuildReplaced.
func (p *Postgres) MarkCreateSucceeded(ctx context.Context, eventID, escrowEventID string, confirmedAt time.Time) error {
	tx, err := p.begin.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE op_log SET status = 'SUCCEEDED', "updatedAt" = now()
		WHERE "idempotencyKey" = $1 AND status = 'PENDING' AND payload->>'escrowEventId' = $2
	`, createIdempotencyKey(eventID), escrowEventID)
	if err != nil {
		return fmt.Errorf("store: mark create op succeeded: %w", err)
	}
	if tag.RowsAffected() != 1 {
		return ErrCreateBuildReplaced
	}

	// Conditional on status = 'DRAFT': every status transition reports
	// whether it matched rather than silently no-opping (issue #11 scope).
	tag, err = tx.Exec(ctx, `
		UPDATE events
		SET "escrowEventId" = $1, status = 'CREATED', "conditionsMetAt" = $2, "updatedAt" = now()
		WHERE id = $3 AND status = 'DRAFT'
	`, escrowEventID, confirmedAt, eventID)
	if err != nil {
		return fmt.Errorf("store: mark event %s created: %w", eventID, err)
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("store: event %s was not DRAFT when create_event confirmed (race)", eventID)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit: %w", err)
	}
	return nil
}

// MarkCreateFailed merges reason into the existing payload with jsonb's ||
// operator, the same as MarkReleaseFailed.
func (p *Postgres) MarkCreateFailed(ctx context.Context, eventID, reason string) error {
	tx, err := p.begin.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE op_log
		SET status = 'FAILED', payload = payload || jsonb_build_object('lastError', $2::text), "updatedAt" = now()
		WHERE "idempotencyKey" = $1
	`, createIdempotencyKey(eventID), reason)
	if err != nil {
		return fmt.Errorf("store: mark create op failed: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit: %w", err)
	}
	return nil
}

// SaveDepositBuild is always an INSERT, never an upsert: deposits repeat,
// so every /deposit/build call is its own logical operation with a fresh
// opId, not a rebuild of a shared row the way create_event's is. A single
// statement is atomic on its own, so — unlike the create_event and release
// writes above — this needs no explicit transaction.
func (p *Postgres) SaveDepositBuild(ctx context.Context, build DepositBuild) (string, error) {
	opID, err := newOpID()
	if err != nil {
		return "", err
	}

	payload, err := json.Marshal(build)
	if err != nil {
		return "", fmt.Errorf("store: marshal deposit build payload: %w", err)
	}

	var rowID string
	err = p.db.QueryRow(ctx, `
		INSERT INTO op_log (id, "idempotencyKey", operation, payload, status, "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, 'deposit_funds', $2::jsonb, 'PENDING', now(), now())
		RETURNING id::text
	`, depositIdempotencyKey(opID), payload).Scan(&rowID)
	if err != nil {
		return "", fmt.Errorf("store: insert deposit op_log: %w", err)
	}
	return opID, nil
}

// LoadDepositOp is a plain read — it never needs its own transaction.
func (p *Postgres) LoadDepositOp(ctx context.Context, opID string) (*DepositOp, error) {
	var status string
	var payload []byte
	err := p.db.QueryRow(ctx,
		`SELECT status::text, payload FROM op_log WHERE "idempotencyKey" = $1`,
		depositIdempotencyKey(opID),
	).Scan(&status, &payload)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("store: load deposit op: %w", err)
	}

	var build DepositBuild
	if err := json.Unmarshal(payload, &build); err != nil {
		return nil, fmt.Errorf("store: decode deposit op payload: %w", err)
	}
	return &DepositOp{Status: status, Build: build}, nil
}

// MarkDepositSucceeded is a single conditional UPDATE — there is no other
// table to reconcile the way release's prizes/payouts or create_event's
// event row need.
func (p *Postgres) MarkDepositSucceeded(ctx context.Context, opID string) error {
	var rowID string
	err := p.db.QueryRow(ctx, `
		UPDATE op_log SET status = 'SUCCEEDED', "updatedAt" = now()
		WHERE "idempotencyKey" = $1 AND status = 'PENDING'
		RETURNING id::text
	`, depositIdempotencyKey(opID)).Scan(&rowID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrDepositNotPending
		}
		return fmt.Errorf("store: mark deposit op succeeded: %w", err)
	}
	return nil
}

// MarkDepositFailed merges reason into the existing payload with jsonb's ||
// operator, the same as MarkReleaseFailed/MarkCreateFailed.
func (p *Postgres) MarkDepositFailed(ctx context.Context, opID, reason string) error {
	var rowID string
	err := p.db.QueryRow(ctx, `
		UPDATE op_log
		SET status = 'FAILED', payload = payload || jsonb_build_object('lastError', $2::text), "updatedAt" = now()
		WHERE "idempotencyKey" = $1
		RETURNING id::text
	`, depositIdempotencyKey(opID), reason).Scan(&rowID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrNotFound
		}
		return fmt.Errorf("store: mark deposit op failed: %w", err)
	}
	return nil
}

// LoadEventForStart is a plain read, like LoadEventForCreate — it never
// needs its own transaction.
func (p *Postgres) LoadEventForStart(ctx context.Context, eventID string) (*EventForStart, error) {
	event := &EventForStart{ID: eventID}
	err := p.db.QueryRow(ctx, `
		SELECT e.status::text, e."escrowEventId", e."judgingDeadlineAt", w.address
		FROM events e
		JOIN wallets w ON w.id = e."organizerWalletId"
		WHERE e.id = $1
	`, eventID).Scan(&event.Status, &event.EscrowEventID, &event.JudgingDeadlineAt, &event.OrganizerWalletAddress)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("store: load event: %w", err)
	}
	return event, nil
}

// SaveStartBuild re-validates, inside its own transaction, that the event
// is still CREATED with an escrowEventId set — the same read-then-write
// race guard SaveCreateBuild applies to DRAFT.
func (p *Postgres) SaveStartBuild(ctx context.Context, eventID string, build StartBuild) error {
	tx, err := p.begin.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Checked before the event status, same reasoning as SaveCreateBuild: a
	// successful go-live is the terminal state for this op_log row, so
	// checking "is CREATED" first would mask a rebuild attempt after
	// success behind the generic not-CREATED error instead of
	// ErrAlreadySucceeded.
	var opStatus string
	err = tx.QueryRow(ctx, `SELECT status::text FROM op_log WHERE "idempotencyKey" = $1`, startIdempotencyKey(eventID)).Scan(&opStatus)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("store: load start op status: %w", err)
	}
	if opStatus == "SUCCEEDED" {
		return ErrAlreadySucceeded
	}

	var status string
	var escrowEventID *string
	err = tx.QueryRow(ctx, `SELECT status::text, "escrowEventId" FROM events WHERE id = $1 FOR UPDATE`, eventID).Scan(&status, &escrowEventID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrNotFound
		}
		return fmt.Errorf("store: load event status: %w", err)
	}
	if status != "CREATED" {
		return fmt.Errorf("store: event %s is not CREATED (got %s)", eventID, status)
	}
	if escrowEventID == nil {
		return fmt.Errorf("store: event %s has no escrowEventId", eventID)
	}

	payload, err := json.Marshal(build)
	if err != nil {
		return fmt.Errorf("store: marshal start build payload: %w", err)
	}

	var opID string
	err = tx.QueryRow(ctx, `
		INSERT INTO op_log (id, "idempotencyKey", operation, payload, status, "createdAt", "updatedAt")
		VALUES (gen_random_uuid(), $1, 'set_event_in_progress', $2::jsonb, 'PENDING', now(), now())
		ON CONFLICT ("idempotencyKey") DO UPDATE
			SET payload = EXCLUDED.payload, status = 'PENDING', "updatedAt" = now()
			WHERE op_log.status <> 'SUCCEEDED'
		RETURNING id
	`, startIdempotencyKey(eventID), payload).Scan(&opID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrAlreadySucceeded
		}
		return fmt.Errorf("store: upsert start op_log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit: %w", err)
	}
	return nil
}

// LoadStartOp is a plain read — it never needs its own transaction.
func (p *Postgres) LoadStartOp(ctx context.Context, eventID string) (*StartOp, error) {
	var status string
	var payload []byte
	err := p.db.QueryRow(ctx,
		`SELECT status::text, payload FROM op_log WHERE "idempotencyKey" = $1`,
		startIdempotencyKey(eventID),
	).Scan(&status, &payload)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("store: load start op: %w", err)
	}

	var build StartBuild
	if err := json.Unmarshal(payload, &build); err != nil {
		return nil, fmt.Errorf("store: decode start op payload: %w", err)
	}
	return &StartOp{Status: status, Build: build}, nil
}

// MarkStartSucceeded confirms the op_log row for hostFunctionXDR
// specifically — not just whatever's currently PENDING. A rebuild
// (/start/build called again, e.g. with a different judging deadline,
// while an earlier submit's RPC call is still in flight) overwrites the
// same row with a new host function, so matching on status alone would let
// a slow, stale submit move the event LIVE for a deadline it never
// actually agreed to. See ErrStartBuildReplaced. The events UPDATE just
// below is the only place in the service that moves an event to LIVE
// (issue #11 decision 6) — see TestOnlyOneSQLStatementWritesLive in
// internal/api for the repo-wide check that backs that claim.
func (p *Postgres) MarkStartSucceeded(ctx context.Context, eventID, hostFunctionXDR string, confirmedAt time.Time) error {
	tx, err := p.begin.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE op_log SET status = 'SUCCEEDED', "updatedAt" = now()
		WHERE "idempotencyKey" = $1 AND status = 'PENDING' AND payload->>'hostFunctionXdr' = $2
	`, startIdempotencyKey(eventID), hostFunctionXDR)
	if err != nil {
		return fmt.Errorf("store: mark start op succeeded: %w", err)
	}
	if tag.RowsAffected() != 1 {
		return ErrStartBuildReplaced
	}

	// Conditional on status = 'CREATED': every status transition reports
	// whether it matched rather than silently no-opping (issue #11 scope).
	tag, err = tx.Exec(ctx, `
		UPDATE events SET status = 'LIVE', "updatedAt" = $1
		WHERE id = $2 AND status = 'CREATED'
	`, confirmedAt, eventID)
	if err != nil {
		return fmt.Errorf("store: mark event %s live: %w", eventID, err)
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("store: event %s was not CREATED when set_event_in_progress confirmed (race)", eventID)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit: %w", err)
	}
	return nil
}

// MarkStartFailed merges reason into the existing payload with jsonb's ||
// operator, the same as MarkReleaseFailed/MarkCreateFailed/MarkDepositFailed.
func (p *Postgres) MarkStartFailed(ctx context.Context, eventID, reason string) error {
	tx, err := p.begin.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE op_log
		SET status = 'FAILED', payload = payload || jsonb_build_object('lastError', $2::text), "updatedAt" = now()
		WHERE "idempotencyKey" = $1
	`, startIdempotencyKey(eventID), reason)
	if err != nil {
		return fmt.Errorf("store: mark start op failed: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit: %w", err)
	}
	return nil
}
