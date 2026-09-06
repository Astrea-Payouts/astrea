package realtime

import (
	"encoding/json"
	"fmt"
	"time"
)

// EventType defines the classification of real-time events.
type EventType string

const (
	EventParticipantProgress EventType = "participant.progress"
	EventJudgeScore          EventType = "judge.score"
	EventStateChanged        EventType = "event.state_changed"
	EventKeepAlive           EventType = "ping"
)

// EventMessage represents a real-time message broadcast to clients.
type EventMessage struct {
	Type      EventType       `json:"type"`
	EventID   string          `json:"eventId"`
	EntityID  string          `json:"entityId,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp time.Time       `json:"timestamp"`
}

// NewMessage creates a timestamped EventMessage with marshaled payload.
func NewMessage(eventType EventType, eventID, entityID string, payload any) (EventMessage, error) {
	var rawPayload json.RawMessage
	if payload != nil {
		bytes, err := json.Marshal(payload)
		if err != nil {
			return EventMessage{}, fmt.Errorf("failed to marshal payload: %w", err)
		}
		rawPayload = bytes
	}

	return EventMessage{
		Type:      eventType,
		EventID:   eventID,
		EntityID:  entityID,
		Payload:   rawPayload,
		Timestamp: time.Now().UTC(),
	}, nil
}

// FormatSSE formats the message as a standard Server-Sent Event chunk.
func (m EventMessage) FormatSSE() []byte {
	data, err := json.Marshal(m)
	if err != nil {
		data = []byte("{}")
	}
	return []byte(fmt.Sprintf("event: %s\ndata: %s\n\n", m.Type, string(data)))
}
