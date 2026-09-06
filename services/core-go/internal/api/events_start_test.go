package api_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/api"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/eventstate"
)

func TestHandleStartEvent(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC()

	t.Run("POST /events/:id/start happy path", func(w *testing.T) {
		store := eventstate.NewMemoryEventStore()
		condTime := now.Add(-5 * time.Minute)
		ev := &eventstate.Event{
			ID:              "evt-ready-1",
			Name:            "Hackathon Payouts",
			Status:          eventstate.StatusStandby,
			ConditionsMetAt: &condTime,
			Funded:          true,
		}
		_ = store.SaveEvent(ctx, ev)

		sm := eventstate.NewStateMachine(store)
		handler := api.NewEventsHandler(sm)
		mux := http.NewServeMux()
		handler.RegisterRoutes(mux)

		req := httptest.NewRequest(http.MethodPost, "/events/evt-ready-1/start", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			w.Fatalf("expected HTTP 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		var resp eventstate.Event
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			w.Fatalf("failed to decode response JSON: %v", err)
		}

		if resp.Status != eventstate.StatusActive {
			w.Errorf("expected status 'active', got %q", resp.Status)
		}
	})

	t.Run("POST /events/:id/start double call returns 409 Conflict already started", func(w *testing.T) {
		store := eventstate.NewMemoryEventStore()
		condTime := now.Add(-5 * time.Minute)
		ev := &eventstate.Event{
			ID:              "evt-ready-2",
			Status:          eventstate.StatusStandby,
			ConditionsMetAt: &condTime,
			Funded:          true,
		}
		_ = store.SaveEvent(ctx, ev)

		sm := eventstate.NewStateMachine(store)
		handler := api.NewEventsHandler(sm)
		mux := http.NewServeMux()
		handler.RegisterRoutes(mux)

		// First call succeeds
		req1 := httptest.NewRequest(http.MethodPost, "/events/evt-ready-2/start", nil)
		rec1 := httptest.NewRecorder()
		mux.ServeHTTP(rec1, req1)
		if rec1.Code != http.StatusOK {
			w.Fatalf("expected first call to return 200, got %d", rec1.Code)
		}

		// Second call must return 409 Conflict
		req2 := httptest.NewRequest(http.MethodPost, "/events/evt-ready-2/start", nil)
		rec2 := httptest.NewRecorder()
		mux.ServeHTTP(rec2, req2)

		if rec2.Code != http.StatusConflict {
			w.Fatalf("expected second call to return 409 Conflict, got %d", rec2.Code)
		}

		var errResp api.ErrorResponse
		_ = json.NewDecoder(rec2.Body).Decode(&errResp)
		if errResp.Error != "already started" {
			w.Errorf("expected error 'already started', got %q", errResp.Error)
		}
	})

	t.Run("POST /events/:id/start on non-existent event returns 404", func(w *testing.T) {
		store := eventstate.NewMemoryEventStore()
		sm := eventstate.NewStateMachine(store)
		handler := api.NewEventsHandler(sm)
		mux := http.NewServeMux()
		handler.RegisterRoutes(mux)

		req := httptest.NewRequest(http.MethodPost, "/events/missing-id/start", nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			w.Errorf("expected 404 Not Found, got %d", rec.Code)
		}
	})

	t.Run("POST /events/:id/start concurrent HTTP requests", func(w *testing.T) {
		store := eventstate.NewMemoryEventStore()
		condTime := now.Add(-5 * time.Minute)
		ev := &eventstate.Event{
			ID:              "evt-race-http",
			Status:          eventstate.StatusStandby,
			ConditionsMetAt: &condTime,
			Funded:          true,
		}
		_ = store.SaveEvent(ctx, ev)

		sm := eventstate.NewStateMachine(store)
		handler := api.NewEventsHandler(sm)
		mux := http.NewServeMux()
		handler.RegisterRoutes(mux)

		const concurrency = 15
		var wg sync.WaitGroup
		var okCount int32
		var conflictCount int32

		startCh := make(chan struct{})

		for i := 0; i < concurrency; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				<-startCh

				req := httptest.NewRequest(http.MethodPost, "/events/evt-race-http/start", nil)
				rec := httptest.NewRecorder()
				mux.ServeHTTP(rec, req)

				if rec.Code == http.StatusOK {
					atomic.AddInt32(&okCount, 1)
				} else if rec.Code == http.StatusConflict {
					atomic.AddInt32(&conflictCount, 1)
				}
			}()
		}

		close(startCh)
		wg.Wait()

		if okCount != 1 {
			w.Fatalf("expected exactly 1 OK response (200), got %d", okCount)
		}
		if conflictCount != concurrency-1 {
			w.Fatalf("expected %d conflict responses (409), got %d", concurrency-1, conflictCount)
		}
	})
}
