// Package store is core-go's only path to Postgres. Prisma (apps/web) owns
// every migration; this package only reads and writes rows through
// hand-written SQL — no ORM, no code generator (see AGENTS.md and #185).
package store

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound is returned when a lookup finds no matching row.
var ErrNotFound = errors.New("store: not found")

// ErrAlreadySucceeded is returned by SaveReleaseBuild when the event's
// release op_log row has already reached SUCCEEDED — rebuilding a release
// that already paid out must never be possible (#185 decision 4's
// idempotency key is what makes this check exact).
var ErrAlreadySucceeded = errors.New("store: release already succeeded")

// ErrReleaseNotPending is returned by MarkReleaseSucceeded when the
// event's release op_log row is not currently PENDING (missing, already
// SUCCEEDED, or FAILED).
var ErrReleaseNotPending = errors.New("store: release op is not pending")

// ErrCreateBuildReplaced is returned by MarkCreateSucceeded when the
// create_event op_log row it tried to confirm is no longer the build this
// call is confirming -- either because it is not PENDING at all (missing,
// already SUCCEEDED, or FAILED), or because a later /create/build call
// overwrote it with a fresh escrowEventId while this call's RPC submission
// was still in flight. Either way, writing the confirmation now would
// attach the wrong on-chain event id to the events row, so the caller must
// not retry blindly -- see MarkCreateSucceeded's own doc comment.
var ErrCreateBuildReplaced = errors.New("create build was replaced while the submit was in flight")

// ErrDepositNotPending is returned by MarkDepositSucceeded when the
// deposit's op_log row is not currently PENDING (missing, already
// SUCCEEDED, or FAILED).
var ErrDepositNotPending = errors.New("store: deposit op is not pending")

// Release op_log statuses, mirroring the OpStatus enum (schema.prisma).
const (
	OpStatusPending   = "PENDING"
	OpStatusSucceeded = "SUCCEEDED"
	OpStatusFailed    = "FAILED"
)

// Prize is one position of an event, as PR 2's release/build handler needs
// it. Amount stays the exact Decimal(18,7) text Postgres returns — the
// Decimal-to-i128 conversion belongs to PR 2, not to this package.
type Prize struct {
	ID     string
	Rank   int
	Amount string
}

// Member is one TeamMember, carrying the wallet address the release
// handler pays rather than a walletId a second query would have to
// resolve.
type Member struct {
	ID               string
	Ordinal          int
	ShareBasisPoints int
	WalletAddress    string
}

// Team is one event entrant with its members, ordered by Ordinal.
type Team struct {
	ID      string
	Members []Member
}

// EventForRelease is everything the release/build handler needs about one
// event, loaded in a single round trip per table.
type EventForRelease struct {
	ID            string
	Status        string
	EscrowEventID *string
	// Judges holds every ACTIVE judge's wallet address. The store reports
	// facts; the handler decides what len(Judges) != 1 means (see #185's
	// "two ACTIVE judges" pitfall — this package does not pick one).
	Judges []string
	// Prizes is ordered by rank.
	Prizes []Prize
	Teams  []Team
}

// ReleaseWinner is one paid line of a release build: an escrow.Winner
// enriched with the row ids the write side (Prize/Payout) needs and that
// AllocateWinners's own output doesn't carry. Amount is in stroops — the
// same unit escrow.Winner.Amount uses — converted to the payouts.amount
// Decimal(18,7) text only at MarkReleaseSucceeded time.
type ReleaseWinner struct {
	PrizeID      string `json:"prizeId"`
	TeamID       string `json:"teamId"`
	TeamMemberID string `json:"teamMemberId"`
	Address      string `json:"address"`
	Stroops      int64  `json:"stroops"`
	Rank         int    `json:"rank"`
}

// ReleaseBuild is exactly what SaveReleaseBuild persists as the op_log
// row's JSON payload — enough for LoadReleaseOp to hand /submit the built
// host function XDR to compare against (#185 decision 3) and, on success,
// for MarkReleaseSucceeded to write one Payout per winner without
// re-deriving anything from Postgres or the contract.
type ReleaseBuild struct {
	HostFunctionXDR string          `json:"hostFunctionXdr"`
	SourceAccount   string          `json:"sourceAccount"`
	Winners         []ReleaseWinner `json:"winners"`
}

// ReleaseOp is the op_log row LoadReleaseOp reads back: its current status
// plus the ReleaseBuild payload from the last successful /build.
type ReleaseOp struct {
	Status string
	Build  ReleaseBuild
}

// EventForCreate is everything the organizer path's create/build|submit
// handlers need about one event, loaded in a single round trip per table —
// the create_event counterpart of EventForRelease.
type EventForCreate struct {
	ID                     string
	Status                 string
	EscrowEventID          *string
	OrganizerWalletAddress string
	// Judges holds every ACTIVE judge's wallet address (see EventForRelease's
	// same "facts, not decisions" doc comment — the handler decides what
	// len(Judges) != 1 means).
	Judges []string
	// Prizes is ordered by rank; create_event's reward is sum(Prizes.Amount)
	// (issue #11 decision 2 — the client never supplies an amount here).
	Prizes []Prize
}

// CreateBuild is exactly what SaveCreateBuild persists as the op_log row's
// JSON payload — enough for LoadCreateOp to hand /submit the built host
// function XDR to compare against, and for MarkCreateSucceeded to learn the
// on-chain event id create_event was built with, without re-deriving
// anything from Postgres or the contract. A rebuilt (still-PENDING) op
// overwrites this with a new EscrowEventID — reusing the old one across a
// rebuild is exactly the mistake issue #11 calls out as a risk.
type CreateBuild struct {
	HostFunctionXDR string `json:"hostFunctionXdr"`
	SourceAccount   string `json:"sourceAccount"`
	EscrowEventID   string `json:"escrowEventId"`
	Reward          int64  `json:"reward"`
}

// CreateOp is the op_log row LoadCreateOp reads back: its current status
// plus the CreateBuild payload from the last successful /build.
type CreateOp struct {
	Status string
	Build  CreateBuild
}

// DepositBuild is exactly what SaveDepositBuild persists as its op_log
// row's JSON payload. Unlike CreateBuild, a DepositBuild's op_log row is
// never reused across builds — deposits repeat (issue #11 decision 5), so
// every /deposit/build creates a brand new row with its own opId.
type DepositBuild struct {
	HostFunctionXDR string `json:"hostFunctionXdr"`
	SourceAccount   string `json:"sourceAccount"`
	Amount          int64  `json:"amount"`
}

// DepositOp is the op_log row LoadDepositOp reads back: its current status
// plus the DepositBuild payload /build persisted.
type DepositOp struct {
	Status string
	Build  DepositBuild
}

// Store is the read/write surface PR 2's handlers are built against.
type Store interface {
	// LoadEventForRelease returns ErrNotFound if eventID does not match any
	// event.
	LoadEventForRelease(ctx context.Context, eventID string) (*EventForRelease, error)

	// SaveReleaseBuild upserts the event's release op_log row
	// (idempotencyKey = "<eventId>:release_reward") to PENDING with build
	// as its payload, and sets winnerTeamId/status=ASSIGNED on every prize
	// build.Winners names — all in one transaction. Returns
	// ErrAlreadySucceeded, unchanged, if the op_log row is already
	// SUCCEEDED.
	SaveReleaseBuild(ctx context.Context, eventID string, build ReleaseBuild) error

	// LoadReleaseOp returns the event's release op_log row, or ErrNotFound
	// if none exists yet.
	LoadReleaseOp(ctx context.Context, eventID string) (*ReleaseOp, error)

	// MarkReleaseSucceeded transitions a PENDING release op_log row to
	// SUCCEEDED, marks every one of its prizes RELEASED with txHash/paidAt,
	// writes one Payout per winner (all sharing txHash), and sets the
	// event's status to COMPLETED — all in one transaction. Returns
	// ErrReleaseNotPending if the op_log row is not currently PENDING.
	MarkReleaseSucceeded(ctx context.Context, eventID, txHash string, paidAt time.Time) error

	// MarkReleaseFailed transitions the release op_log row to FAILED and
	// merges reason into its payload under "lastError". Prizes and the
	// event are left untouched, so a new /build can overwrite. Returns
	// ErrNotFound if no release op_log row exists for eventID.
	MarkReleaseFailed(ctx context.Context, eventID, reason string) error

	// --- organizer path: create_event ------------------------------------

	// LoadEventForCreate returns ErrNotFound if eventID does not match any
	// event.
	LoadEventForCreate(ctx context.Context, eventID string) (*EventForCreate, error)

	// SaveCreateBuild upserts the event's create_event op_log row
	// (idempotencyKey = "<eventId>:create_event") to PENDING with build as
	// its payload — one row per event, ever, like release (issue #11
	// decision 5). Re-validates, inside its own transaction, that the event
	// is still DRAFT with no escrowEventId — closing the same read-then-write
	// race SaveReleaseBuild closes. Returns ErrAlreadySucceeded, unchanged,
	// if the op_log row is already SUCCEEDED.
	SaveCreateBuild(ctx context.Context, eventID string, build CreateBuild) error

	// LoadCreateOp returns the event's create_event op_log row, or
	// ErrNotFound if none exists yet.
	LoadCreateOp(ctx context.Context, eventID string) (*CreateOp, error)

	// MarkCreateSucceeded transitions a PENDING create_event op_log row to
	// SUCCEEDED and, in the same transaction, sets the event's
	// escrowEventId (the caller's own, already verified against the signed
	// envelope -- see handleCreateSubmit), moves status DRAFT -> CREATED
	// via a conditional update, and stamps conditionsMetAt — "startable",
	// never itself LIVE (issue #11 decision 4). The op_log UPDATE is
	// conditioned on the row's payload still naming escrowEventID: a
	// rebuild (a fresh /create/build call) can overwrite that PENDING row
	// with a different escrowEventId while this call's RPC submission was
	// in flight, and confirming against the wrong one would silently
	// attach an unconfirmed on-chain event id to the events row. Returns
	// ErrCreateBuildReplaced if the row no longer matches -- not PENDING
	// at all, or PENDING for a different build.
	MarkCreateSucceeded(ctx context.Context, eventID, escrowEventID string, confirmedAt time.Time) error

	// MarkCreateFailed transitions the create_event op_log row to FAILED and
	// merges reason into its payload under "lastError". The event is left
	// untouched, so a new /build can overwrite with a fresh on-chain event
	// id. Returns ErrNotFound if no create_event op_log row exists for
	// eventID.
	MarkCreateFailed(ctx context.Context, eventID, reason string) error

	// --- organizer path: deposit_funds -----------------------------------

	// SaveDepositBuild inserts a new PENDING op_log row with build as its
	// payload and returns the generated opId — always an INSERT, never an
	// upsert, since deposits repeat and every /deposit/build is its own
	// logical operation (issue #11 decision 5).
	SaveDepositBuild(ctx context.Context, build DepositBuild) (opID string, err error)

	// LoadDepositOp returns the deposit op_log row for opID, or ErrNotFound
	// if none exists.
	LoadDepositOp(ctx context.Context, opID string) (*DepositOp, error)

	// MarkDepositSucceeded transitions a PENDING deposit op_log row to
	// SUCCEEDED. Returns ErrDepositNotPending if it is not currently
	// PENDING.
	MarkDepositSucceeded(ctx context.Context, opID string) error

	// MarkDepositFailed transitions the deposit op_log row to FAILED and
	// merges reason into its payload under "lastError". Returns ErrNotFound
	// if no deposit op_log row exists for opID.
	MarkDepositFailed(ctx context.Context, opID, reason string) error
}
