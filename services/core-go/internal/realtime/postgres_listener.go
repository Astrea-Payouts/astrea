package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

const (
	// DefaultChannel is the PostgreSQL LISTEN/NOTIFY channel name.
	DefaultChannel = "astrea_realtime"
)

// InboundNotification represents the raw payload emitted by pg_notify.
type InboundNotification struct {
	Type     EventType       `json:"type"`
	EventID  string          `json:"eventId"`
	EntityID string          `json:"entityId,omitempty"`
	Payload  json.RawMessage `json:"payload,omitempty"`
}

// NotificationDispatcher takes incoming PostgreSQL notifications and dispatches to the broker.
type NotificationDispatcher struct {
	broker *Broker
}

// NewNotificationDispatcher creates a new dispatcher linked to a broker.
func NewNotificationDispatcher(broker *Broker) *NotificationDispatcher {
	return &NotificationDispatcher{broker: broker}
}

// DispatchPayload parses an incoming notification string and publishes it through the broker.
func (d *NotificationDispatcher) DispatchPayload(channel, payloadStr string) error {
	if channel != DefaultChannel && channel != "" {
		// Filter non-matching channels if specified
	}

	var inbound InboundNotification
	if err := json.Unmarshal([]byte(payloadStr), &inbound); err != nil {
		return fmt.Errorf("failed to parse notification JSON: %w", err)
	}

	if inbound.EventID == "" {
		return fmt.Errorf("missing eventId in notification payload")
	}

	msg := EventMessage{
		Type:      inbound.Type,
		EventID:   inbound.EventID,
		EntityID:  inbound.EntityID,
		Payload:   inbound.Payload,
		Timestamp: time.Now().UTC(),
	}

	d.broker.Publish(msg)
	return nil
}

// SQLTriggerTemplate returns the idempotent SQL trigger setup for PostgreSQL LISTEN/NOTIFY.
func SQLTriggerTemplate() string {
	return `
-- PostgreSQL LISTEN/NOTIFY Trigger for Participant Progress and Judging Scores
CREATE OR REPLACE FUNCTION notify_astrea_realtime() RETURNS trigger AS $$
DECLARE
    notification_payload json;
BEGIN
    notification_payload := json_build_object(
        'type', TG_ARGV[0],
        'eventId', NEW.event_id,
        'entityId', NEW.id,
        'payload', row_to_json(NEW)
    );
    PERFORM pg_notify('astrea_realtime', notification_payload::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`
}

// SimulatedPostgresWorker simulates receiving PostgreSQL notifications (useful for tests and dev).
type SimulatedPostgresWorker struct {
	dispatcher *NotificationDispatcher
}

// NewSimulatedPostgresWorker creates a simulated worker.
func NewSimulatedPostgresWorker(dispatcher *NotificationDispatcher) *SimulatedPostgresWorker {
	return &SimulatedPostgresWorker{dispatcher: dispatcher}
}

// Broadcast sends a simulated message directly into the dispatcher.
func (w *SimulatedPostgresWorker) Broadcast(ctx context.Context, notif InboundNotification) error {
	bytes, err := json.Marshal(notif)
	if err != nil {
		return err
	}
	log.Printf("[realtime-pg] Emitting simulated notification for event %s", notif.EventID)
	return w.dispatcher.DispatchPayload(DefaultChannel, string(bytes))
}
