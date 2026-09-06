package eventstate_test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/eventstate"
)

func TestLegalTransitions(t *testing.T) {
	tests := []struct {
		from  eventstate.EventStatus
		to    eventstate.EventStatus
		valid bool
	}{
		// Legal happy path
		{eventstate.StatusDraft, eventstate.StatusStandby, true},
		{eventstate.StatusStandby, eventstate.StatusActive, true},
		{eventstate.StatusActive, eventstate.StatusFinished, true},

		// Legal cancellations
		{eventstate.StatusDraft, eventstate.StatusCancelled, true},
		{eventstate.StatusStandby, eventstate.StatusCancelled, true},
		{eventstate.StatusActive, eventstate.StatusCancelled, true},

		// Illegal transitions (skipping states or terminal escapes)
		{eventstate.StatusDraft, eventstate.StatusActive, false}, // manual-start rule: cannot jump draft -> active
		{eventstate.StatusDraft, eventstate.StatusFinished, false},
		{eventstate.StatusStandby, eventstate.StatusFinished, false},
		{eventstate.StatusFinished, eventstate.StatusActive, false},
		{eventstate.StatusFinished, eventstate.StatusStandby, false},
		{eventstate.StatusCancelled, eventstate.StatusActive, false},
		{eventstate.StatusCancelled, eventstate.StatusStandby, false},
	}

	for _, tt := range tests {
		got := eventstate.CanTransition(tt.from, tt.to)
		if got != tt.valid {
			t.Errorf("CanTransition(%q, %q) = %v, expected %v", tt.from, tt.to, got, tt.valid)
		}
	}
}

func TestEvaluateConditions_ManualStartRule(t *testing.T) {
	now := time.Now().UTC()

	t.Run("conditions not met when unconfirmed funding", func(t *testing.T) {
		ev := &eventstate.Event{
			ID:                "evt-1",
			Status:            eventstate.StatusDraft,
			Funded:            false,
			ParticipantsCount: 5,
			MinParticipants:   2,
		}

		met, updated := eventstate.EvaluateConditions(ev, now)
		if met || updated {
			t.Errorf("expected conditions not met, got met=%v, updated=%v", met, updated)
		}
		if ev.ConditionsMetAt != nil {
			t.Errorf("conditionsMetAt should remain nil, got %v", ev.ConditionsMetAt)
		}
		if ev.Status != eventstate.StatusDraft {
			t.Errorf("status should remain draft, got %q", ev.Status)
		}
	})

	t.Run("conditions not met when insufficient participants", func(t *testing.T) {
		ev := &eventstate.Event{
			ID:                "evt-2",
			Status:            eventstate.StatusDraft,
			Funded:            true,
			ParticipantsCount: 1,
			MinParticipants:   3,
		}

		met, updated := eventstate.EvaluateConditions(ev, now)
		if met || updated {
			t.Errorf("expected conditions not met, got met=%v, updated=%v", met, updated)
		}
		if ev.ConditionsMetAt != nil {
			t.Errorf("conditionsMetAt should remain nil, got %v", ev.ConditionsMetAt)
		}
	})

	t.Run("conditions met sets conditionsMetAt and moves to standby, NEVER active", func(t *testing.T) {
		ev := &eventstate.Event{
			ID:                "evt-3",
			Status:            eventstate.StatusDraft,
			Funded:            true,
			ParticipantsCount: 3,
			MinParticipants:   2,
		}

		met, updated := eventstate.EvaluateConditions(ev, now)
		if !met || !updated {
			t.Fatalf("expected conditions met and updated, got met=%v, updated=%v", met, updated)
		}

		if ev.ConditionsMetAt == nil {
			t.Fatalf("expected conditionsMetAt to be set, got nil")
		}

		// CRITICAL RULE CHECK:
		// conditionsMetAt being set never by itself changes status to 'active'.
		// It moves to 'standby' (Ready to start), never 'active'.
		if ev.Status == eventstate.StatusActive {
			t.Fatalf("VIOLATION OF E03 MANUAL-START RULE: conditions met set status to active!")
		}
		if ev.Status != eventstate.StatusStandby {
			t.Errorf("expected status to be standby, got %q", ev.Status)
		}
	})
}

func TestStateMachine_StartEvent(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()

	t.Run("successful start from standby with conditions met", func(t *testing.T) {
		store := eventstate.NewMemoryEventStore()
		condTime := now.Add(-10 * time.Minute)
		ev := &eventstate.Event{
			ID:              "evt-10",
			Status:          eventstate.StatusStandby,
			ConditionsMetAt: &condTime,
			Funded:          true,
		}
		if err := store.SaveEvent(ctx, ev); err != nil {
			t.Fatal(err)
		}

		sm := eventstate.NewStateMachine(store)
		started, err := sm.StartEvent(ctx, "evt-10", now)
		if err != nil {
			t.Fatalf("StartEvent failed: %v", err)
		}

		if started.Status != eventstate.StatusActive {
			t.Errorf("expected status active, got %q", started.Status)
		}
	})

	t.Run("rejects starting unready draft event", func(t *testing.T) {
		store := eventstate.NewMemoryEventStore()
		ev := &eventstate.Event{
			ID:     "evt-11",
			Status: eventstate.StatusDraft,
		}
		_ = store.SaveEvent(ctx, ev)

		sm := eventstate.NewStateMachine(store)
		_, err := sm.StartEvent(ctx, "evt-11", now)
		if !errors.Is(err, eventstate.ErrInvalidTransition) {
			t.Errorf("expected ErrInvalidTransition, got %v", err)
		}
	})

	t.Run("rejects already started active event", func(t *testing.T) {
		store := eventstate.NewMemoryEventStore()
		ev := &eventstate.Event{
			ID:              "evt-12",
			Status:          eventstate.StatusActive,
			ConditionsMetAt: &now,
		}
		_ = store.SaveEvent(ctx, ev)

		sm := eventstate.NewStateMachine(store)
		_, err := sm.StartEvent(ctx, "evt-12", now)
		if !errors.Is(err, eventstate.ErrEventAlreadyStarted) {
			t.Errorf("expected ErrEventAlreadyStarted, got %v", err)
		}
	})
}

// TestStateMachine_ConcurrentStart satisfies the core acceptance criteria:
// "Two concurrent /start calls on the same event: exactly one succeeds, the other
// gets a clear 'already started' response, no corrupted state."
func TestStateMachine_ConcurrentStart(t *testing.T) {
	ctx := context.Background()
	store := eventstate.NewMemoryEventStore()
	now := time.Now().UTC()

	ev := &eventstate.Event{
		ID:              "evt-race",
		Status:          eventstate.StatusStandby,
		ConditionsMetAt: &now,
		Funded:          true,
	}
	if err := store.SaveEvent(ctx, ev); err != nil {
		t.Fatal(err)
	}

	sm := eventstate.NewStateMachine(store)

	const concurrency = 20
	var wg sync.WaitGroup
	var successCount int32
	var alreadyStartedCount int32
	var otherErrors int32

	startSignal := make(chan struct{})

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-startSignal // sync launch

			_, err := sm.StartEvent(ctx, "evt-race", time.Now().UTC())
			if err == nil {
				atomic.AddInt32(&successCount, 1)
			} else if errors.Is(err, eventstate.ErrEventAlreadyStarted) || errors.Is(err, eventstate.ErrStateConflict) {
				atomic.AddInt32(&alreadyStartedCount, 1)
			} else {
				atomic.AddInt32(&otherErrors, 1)
			}
		}()
	}

	close(startSignal) // fire all simultaneously
	wg.Wait()

	if successCount != 1 {
		t.Fatalf("RACE CONDITION SAFETY VIOLATION: expected exactly 1 successful start, got %d", successCount)
	}

	if alreadyStartedCount != concurrency-1 {
		t.Errorf("expected %d already started errors, got %d (other errors: %d)", concurrency-1, alreadyStartedCount, otherErrors)
	}

	finalEv, err := store.GetEvent(ctx, "evt-race")
	if err != nil {
		t.Fatal(err)
	}
	if finalEv.Status != eventstate.StatusActive {
		t.Errorf("final event status corrupted: expected active, got %q", finalEv.Status)
	}
}
