package eventstate

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

// EventStatus represents the explicit lifecycle states of an Astrea event.
type EventStatus string

const (
	StatusDraft     EventStatus = "draft"
	StatusStandby   EventStatus = "standby"
	StatusActive    EventStatus = "active"
	StatusFinished  EventStatus = "finished"
	StatusCancelled EventStatus = "cancelled"
)

var (
	ErrInvalidTransition   = errors.New("invalid event state transition")
	ErrConditionsNotMet    = errors.New("event conditions not met for standby")
	ErrEventAlreadyStarted = errors.New("already started")
	ErrEventNotFound       = errors.New("event not found")
	ErrStateConflict       = errors.New("state transition conflict: status modified concurrently")
)

// LegalTransitions defines the explicit state transition table per E03 specification.
var LegalTransitions = map[EventStatus]map[EventStatus]bool{
	StatusDraft: {
		StatusStandby:   true,
		StatusCancelled: true,
	},
	StatusStandby: {
		StatusActive:    true,
		StatusCancelled: true,
	},
	StatusActive: {
		StatusFinished:  true,
		StatusCancelled: true,
	},
	StatusFinished:  {}, // terminal
	StatusCancelled: {}, // terminal
}

// CanTransition validates whether moving from 'from' to 'to' is allowed by the state table.
func CanTransition(from, to EventStatus) bool {
	targets, ok := LegalTransitions[from]
	if !ok {
		return false
	}
	return targets[to]
}

// Event mirrors the database event record for the state machine.
type Event struct {
	ID                string      `json:"id"`
	Name              string      `json:"name"`
	Status            EventStatus `json:"status"`
	ConditionsMetAt   *time.Time  `json:"conditionsMetAt,omitempty"`
	Funded            bool        `json:"funded"`
	ParticipantsCount int         `json:"participantsCount"`
	MinParticipants   int         `json:"minParticipants"`
	CreatedAt         time.Time   `json:"createdAt"`
	UpdatedAt         time.Time   `json:"updatedAt"`
}

// EvaluateConditions computes and sets conditionsMetAt once when both funding and
// participant count prerequisites are satisfied.
//
// CRITICAL MANUAL-START RULE (E03):
// Setting conditionsMetAt NEVER by itself moves the status to 'active'.
// When conditions are met, an event in 'draft' status transitions only to 'standby'
// ("Ready to start"). The event never auto-activates.
func EvaluateConditions(e *Event, now time.Time) (conditionsMet bool, updated bool) {
	if e == nil {
		return false, false
	}

	met := e.Funded && e.ParticipantsCount >= e.MinParticipants
	if met {
		if e.ConditionsMetAt == nil {
			t := now.UTC()
			e.ConditionsMetAt = &t
			updated = true
		}
		if e.Status == StatusDraft {
			e.Status = StatusStandby
			e.UpdatedAt = now.UTC()
			updated = true
		}
		return true, updated
	}

	return false, false
}

// EventStore abstracts atomic state persistence with conditional updates.
type EventStore interface {
	GetEvent(ctx context.Context, id string) (*Event, error)
	SaveEvent(ctx context.Context, event *Event) error
	// UpdateStatusAtomic performs a race-safe transition:
	// UPDATE events SET status = $to, updated_at = $now WHERE id = $id AND status = $expectedFrom
	UpdateStatusAtomic(ctx context.Context, id string, expectedFrom, to EventStatus, now time.Time) (*Event, error)
}

// MemoryEventStore provides a thread-safe in-memory store for unit and concurrency tests.
type MemoryEventStore struct {
	mu     sync.RWMutex
	events map[string]*Event
}

func NewMemoryEventStore() *MemoryEventStore {
	return &MemoryEventStore{
		events: make(map[string]*Event),
	}
}

func (s *MemoryEventStore) SaveEvent(ctx context.Context, event *Event) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := *event
	s.events[event.ID] = &cp
	return nil
}

func (s *MemoryEventStore) GetEvent(ctx context.Context, id string) (*Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ev, ok := s.events[id]
	if !ok {
		return nil, ErrEventNotFound
	}
	cp := *ev
	return &cp, nil
}

func (s *MemoryEventStore) UpdateStatusAtomic(ctx context.Context, id string, expectedFrom, to EventStatus, now time.Time) (*Event, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	ev, ok := s.events[id]
	if !ok {
		return nil, ErrEventNotFound
	}

	if ev.Status != expectedFrom {
		return nil, fmt.Errorf("%w: current status %q does not match expected %q", ErrStateConflict, ev.Status, expectedFrom)
	}

	if !CanTransition(expectedFrom, to) {
		return nil, fmt.Errorf("%w: %q -> %q", ErrInvalidTransition, expectedFrom, to)
	}

	ev.Status = to
	ev.UpdatedAt = now.UTC()

	cp := *ev
	return &cp, nil
}

// StateMachine coordinates lifecycle operations and enforces the manual-start rule.
type StateMachine struct {
	store EventStore
}

func NewStateMachine(store EventStore) *StateMachine {
	return &StateMachine{store: store}
}

// StartEvent executes the manual-start transition: standby -> active.
// POST /events/:id/start is the ONLY code path allowed to move an event to 'active'.
func (sm *StateMachine) StartEvent(ctx context.Context, eventID string, now time.Time) (*Event, error) {
	ev, err := sm.store.GetEvent(ctx, eventID)
	if err != nil {
		return nil, err
	}
	if ev == nil {
		return nil, ErrEventNotFound
	}

	if ev.Status == StatusActive {
		return nil, ErrEventAlreadyStarted
	}

	if ev.Status != StatusStandby {
		return nil, fmt.Errorf("%w: cannot start event with status %q (must be in standby)", ErrInvalidTransition, ev.Status)
	}

	if ev.ConditionsMetAt == nil {
		return nil, ErrConditionsNotMet
	}

	// Conditional atomic update (WHERE status = 'standby')
	updated, err := sm.store.UpdateStatusAtomic(ctx, eventID, StatusStandby, StatusActive, now)
	if err != nil {
		if errors.Is(err, ErrStateConflict) {
			// Check if another concurrent request already activated it
			fresh, checkErr := sm.store.GetEvent(ctx, eventID)
			if checkErr == nil && fresh != nil && fresh.Status == StatusActive {
				return nil, ErrEventAlreadyStarted
			}
		}
		return nil, err
	}

	return updated, nil
}
