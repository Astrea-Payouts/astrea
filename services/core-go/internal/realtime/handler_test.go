package realtime

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSSEHandler_HeadersAndInitialEvent(t *testing.T) {
	broker := NewBroker()
	defer broker.Close()

	handler := SSEHandler(broker, HandlerConfig{PingInterval: 1 * time.Second})

	req := httptest.NewRequest(http.MethodGet, "/events/evt-test/live", nil)
	req.SetPathValue("id", "evt-test")

	ctx, cancel := context.WithCancel(req.Context())
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		handler(rec, req)
		close(done)
	}()

	// Wait briefly for initial flush
	time.Sleep(30 * time.Millisecond)
	cancel()
	<-done

	if rec.Header().Get("Content-Type") != "text/event-stream" {
		t.Fatalf("expected text/event-stream, got %s", rec.Header().Get("Content-Type"))
	}
	if !strings.Contains(rec.Header().Get("Cache-Control"), "no-cache") {
		t.Fatalf("expected Cache-Control no-cache, got %s", rec.Header().Get("Cache-Control"))
	}

	body := rec.Body.String()
	if !strings.Contains(body, "event: connected") {
		t.Fatalf("expected initial connected event, got body: %s", body)
	}
	if !strings.Contains(body, `"eventId":"evt-test"`) {
		t.Fatalf("expected eventId in initial connected body, got: %s", body)
	}
}

func TestSSEHandler_StreamsPublishedEvents(t *testing.T) {
	broker := NewBroker()
	defer broker.Close()

	handler := SSEHandler(broker, HandlerConfig{PingInterval: 1 * time.Second})

	req := httptest.NewRequest(http.MethodGet, "/events/evt-stream/live", nil)
	req.SetPathValue("id", "evt-stream")

	ctx, cancel := context.WithCancel(req.Context())
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()

	go handler(rec, req)

	// Wait for handler to register subscription
	time.Sleep(20 * time.Millisecond)
	if broker.SubscriberCount("evt-stream") != 1 {
		t.Fatalf("expected 1 subscriber, got %d", broker.SubscriberCount("evt-stream"))
	}

	payload, _ := json.Marshal(map[string]any{"progress": 100})
	msg := EventMessage{
		Type:      EventParticipantProgress,
		EventID:   "evt-stream",
		EntityID:  "p-123",
		Payload:   payload,
		Timestamp: time.Now().UTC(),
	}
	broker.Publish(msg)

	time.Sleep(30 * time.Millisecond)
	cancel()

	body := rec.Body.String()
	if !strings.Contains(body, "event: participant.progress") {
		t.Fatalf("expected participant.progress event in body, got: %s", body)
	}
	if !strings.Contains(body, "p-123") {
		t.Fatalf("expected entity ID p-123 in body, got: %s", body)
	}
}

func TestSSEHandler_KeepAlivePing(t *testing.T) {
	broker := NewBroker()
	defer broker.Close()

	// 20ms ping interval for fast test
	handler := SSEHandler(broker, HandlerConfig{PingInterval: 20 * time.Millisecond})

	req := httptest.NewRequest(http.MethodGet, "/events/evt-ping/live", nil)
	req.SetPathValue("id", "evt-ping")

	ctx, cancel := context.WithCancel(req.Context())
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()

	go handler(rec, req)

	// Wait enough for at least one ping
	time.Sleep(50 * time.Millisecond)
	cancel()

	body := rec.Body.String()
	if !strings.Contains(body, ": keepalive\n\n") {
		t.Fatalf("expected keepalive comment in body, got: %s", body)
	}
}

func TestSSEHandler_ClientDisconnectCleansUp(t *testing.T) {
	broker := NewBroker()
	defer broker.Close()

	handler := SSEHandler(broker, HandlerConfig{PingInterval: 1 * time.Second})

	req := httptest.NewRequest(http.MethodGet, "/events/evt-cleanup/live", nil)
	req.SetPathValue("id", "evt-cleanup")

	ctx, cancel := context.WithCancel(req.Context())
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		handler(rec, req)
		close(done)
	}()

	time.Sleep(20 * time.Millisecond)
	if count := broker.SubscriberCount("evt-cleanup"); count != 1 {
		t.Fatalf("expected 1 subscriber before cancel, got %d", count)
	}

	cancel()
	<-done

	if count := broker.SubscriberCount("evt-cleanup"); count != 0 {
		t.Fatalf("expected 0 subscribers after context cancel, got %d", count)
	}
}

// Ensure scanner parses SSE chunks accurately
func parseSSEChunks(raw string) []string {
	var chunks []string
	scanner := bufio.NewScanner(strings.NewReader(raw))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "event:") || strings.HasPrefix(line, "data:") {
			chunks = append(chunks, line)
		}
	}
	return chunks
}
