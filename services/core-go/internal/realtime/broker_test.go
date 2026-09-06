package realtime

import (
	"encoding/json"
	"testing"
	"time"
)

func TestBroker_SubscribeAndPublish(t *testing.T) {
	broker := NewBroker()
	defer broker.Close()

	ch1, unsub1 := broker.Subscribe("event-100")
	defer unsub1()

	ch2, unsub2 := broker.Subscribe("event-100")
	defer unsub2()

	chOther, unsubOther := broker.Subscribe("event-200")
	defer unsubOther()

	if count := broker.SubscriberCount("event-100"); count != 2 {
		t.Fatalf("expected 2 subscribers for event-100, got %d", count)
	}
	if count := broker.SubscriberCount("event-200"); count != 1 {
		t.Fatalf("expected 1 subscriber for event-200, got %d", count)
	}

	payload, _ := json.Marshal(map[string]any{"progress": 75})
	msg := EventMessage{
		Type:      EventParticipantProgress,
		EventID:   "event-100",
		EntityID:  "part-1",
		Payload:   payload,
		Timestamp: time.Now().UTC(),
	}

	broker.Publish(msg)

	// Check ch1
	select {
	case received := <-ch1:
		if received.EventID != "event-100" || received.EntityID != "part-1" {
			t.Fatalf("ch1 received unexpected message: %+v", received)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for message on ch1")
	}

	// Check ch2
	select {
	case received := <-ch2:
		if received.EventID != "event-100" || received.EntityID != "part-1" {
			t.Fatalf("ch2 received unexpected message: %+v", received)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for message on ch2")
	}

	// chOther should NOT receive anything
	select {
	case received := <-chOther:
		t.Fatalf("chOther unexpectedly received a message: %+v", received)
	case <-time.After(50 * time.Millisecond):
		// Expected: nothing received
	}
}

func TestBroker_Unsubscribe(t *testing.T) {
	broker := NewBroker()
	defer broker.Close()

	ch, unsub := broker.Subscribe("event-300")
	if count := broker.SubscriberCount("event-300"); count != 1 {
		t.Fatalf("expected 1 subscriber, got %d", count)
	}

	unsub()

	if count := broker.SubscriberCount("event-300"); count != 0 {
		t.Fatalf("expected 0 subscribers after unsub, got %d", count)
	}

	// Channel should be closed
	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("expected channel to be closed upon unsubscribe")
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatal("timed out waiting for channel close")
	}

	// Calling unsub again should be safe (idempotent)
	unsub()
}

func TestBroker_SlowConsumerDoesNotBlock(t *testing.T) {
	broker := NewBroker()
	defer broker.Close()

	_, unsub := broker.Subscribe("event-slow")
	defer unsub()

	// Fill buffer past capacity
	msg := EventMessage{
		Type:      EventParticipantProgress,
		EventID:   "event-slow",
		Timestamp: time.Now().UTC(),
	}

	done := make(chan struct{})
	go func() {
		for i := 0; i < DefaultSubscriberBufferSize*3; i++ {
			broker.Publish(msg)
		}
		close(done)
	}()

	select {
	case <-done:
		// Succeeded promptly without blocking
	case <-time.After(500 * time.Millisecond):
		t.Fatal("broker blocked on saturated subscriber channel")
	}
}

func TestNotificationDispatcher_DispatchPayload(t *testing.T) {
	broker := NewBroker()
	defer broker.Close()

	dispatcher := NewNotificationDispatcher(broker)

	ch, unsub := broker.Subscribe("evt-abc")
	defer unsub()

	rawJSON := `{"type":"judge.score","eventId":"evt-abc","entityId":"judge-9","payload":{"score":92}}`
	err := dispatcher.DispatchPayload(DefaultChannel, rawJSON)
	if err != nil {
		t.Fatalf("failed to dispatch valid payload: %v", err)
	}

	select {
	case msg := <-ch:
		if msg.Type != EventJudgeScore || msg.EventID != "evt-abc" || msg.EntityID != "judge-9" {
			t.Fatalf("unexpected message content: %+v", msg)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for dispatched message")
	}

	// Invalid JSON should return error
	if err := dispatcher.DispatchPayload(DefaultChannel, "invalid-json"); err == nil {
		t.Fatal("expected error on invalid JSON payload")
	}

	// Missing event ID should return error
	if err := dispatcher.DispatchPayload(DefaultChannel, `{"type":"ping"}`); err == nil {
		t.Fatal("expected error on missing eventId")
	}
}
