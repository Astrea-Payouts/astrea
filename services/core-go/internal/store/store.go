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
}
