package realtime

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// HandlerConfig configures the SSE streaming HTTP handler.
type HandlerConfig struct {
	PingInterval time.Duration
}

// DefaultHandlerConfig returns recommended production SSE configuration.
func DefaultHandlerConfig() HandlerConfig {
	return HandlerConfig{
		PingInterval: 15 * time.Second,
	}
}

// SSEHandler creates an HTTP handler for streaming real-time event updates to clients.
func SSEHandler(broker *Broker, cfg HandlerConfig) http.HandlerFunc {
	if cfg.PingInterval <= 0 {
		cfg.PingInterval = 15 * time.Second
	}

	return func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported by response writer", http.StatusInternalServerError)
			return
		}

		eventID := r.PathValue("id")
		if eventID == "" {
			http.Error(w, "Missing event ID in path", http.StatusBadRequest)
			return
		}

		// SSE required headers
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache, no-transform")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		// Subscribe to event updates
		eventChan, unsubscribe := broker.Subscribe(eventID)
		defer unsubscribe()

		// Initial connection confirmation event
		connData, _ := json.Marshal(map[string]any{
			"status":    "connected",
			"eventId":   eventID,
			"timestamp": time.Now().UTC(),
		})
		fmt.Fprintf(w, "event: connected\ndata: %s\n\n", string(connData))
		flusher.Flush()

		ticker := time.NewTicker(cfg.PingInterval)
		defer ticker.Stop()

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				fmt.Fprint(w, ": keepalive\n\n")
				flusher.Flush()
			case msg, ok := <-eventChan:
				if !ok {
					return
				}
				w.Write(msg.FormatSSE())
				flusher.Flush()
			}
		}
	}
}
