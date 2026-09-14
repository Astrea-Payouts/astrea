// Package store is core-go's only path to Postgres. Prisma (apps/web) owns
// every migration; this package only reads and writes rows through
// hand-written SQL — no ORM, no code generator (see AGENTS.md and #185).
package store

import (
	"context"
	"errors"
)

// ErrNotFound is returned when a lookup finds no matching row.
var ErrNotFound = errors.New("store: not found")

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

// Store is the read surface PR 2's handlers are built against. Writes
// (OpLog, Prize/Event status transitions, Payout) come with PR 2, once a
// real handler exists to design them against.
type Store interface {
	// LoadEventForRelease returns ErrNotFound if eventID does not match any
	// event.
	LoadEventForRelease(ctx context.Context, eventID string) (*EventForRelease, error)
}
