package realtime

import (
	"sync"
)

const (
	// DefaultSubscriberBufferSize is the channel capacity for each SSE subscriber.
	DefaultSubscriberBufferSize = 64
)

// Broker handles multi-tenant event subscriptions and message fan-out.
type Broker struct {
	mu          sync.RWMutex
	subscribers map[string]map[chan EventMessage]struct{}
	closed      bool
}

// NewBroker initializes an empty realtime pub/sub broker.
func NewBroker() *Broker {
	return &Broker{
		subscribers: make(map[string]map[chan EventMessage]struct{}),
	}
}

// Subscribe registers a new subscriber for a given event ID.
// Returns a read-only channel for events and an unsubscribe cleanup function.
func (b *Broker) Subscribe(eventID string) (<-chan EventMessage, func()) {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(chan EventMessage, DefaultSubscriberBufferSize)
	if b.closed {
		close(ch)
		return ch, func() {}
	}

	if _, ok := b.subscribers[eventID]; !ok {
		b.subscribers[eventID] = make(map[chan EventMessage]struct{})
	}
	b.subscribers[eventID][ch] = struct{}{}

	var once sync.Once
	unsubscribe := func() {
		once.Do(func() {
			b.mu.Lock()
			defer b.mu.Unlock()

			if subs, ok := b.subscribers[eventID]; ok {
				if _, present := subs[ch]; present {
					delete(subs, ch)
					close(ch)
				}
				if len(subs) == 0 {
					delete(b.subscribers, eventID)
				}
			}
		})
	}

	return ch, unsubscribe
}

// Publish distributes an event message to all active subscribers of msg.EventID.
// Slow subscribers with full channel buffers will have the message dropped
// to ensure zero head-of-line blocking for other clients.
func (b *Broker) Publish(msg EventMessage) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.closed {
		return
	}

	subs, ok := b.subscribers[msg.EventID]
	if !ok || len(subs) == 0 {
		return
	}

	for ch := range subs {
		select {
		case ch <- msg:
		default:
			// Non-blocking send: drop message if subscriber is saturated
		}
	}
}

// SubscriberCount returns the number of active subscribers for a specific event.
func (b *Broker) SubscriberCount(eventID string) int {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if subs, ok := b.subscribers[eventID]; ok {
		return len(subs)
	}
	return 0
}

// Close unsubscribes and closes all active subscriber channels.
func (b *Broker) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.closed {
		return
	}
	b.closed = true

	for eventID, subs := range b.subscribers {
		for ch := range subs {
			close(ch)
		}
		delete(b.subscribers, eventID)
	}
}
