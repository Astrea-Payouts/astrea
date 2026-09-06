package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/eventstate"
)

// EventsHandler handles event lifecycle HTTP endpoints.
type EventsHandler struct {
	sm *eventstate.StateMachine
}

func NewEventsHandler(sm *eventstate.StateMachine) *EventsHandler {
	return &EventsHandler{sm: sm}
}

// RegisterRoutes registers all API endpoints on the provided ServeMux.
func (h *EventsHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /events/{id}/start", h.HandleStartEvent)
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// HandleStartEvent handles POST /events/{id}/start.
// It is the ONLY code path that can move an event from 'standby' to 'active'.
func (h *EventsHandler) HandleStartEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, ErrorResponse{Error: "method not allowed"})
		return
	}

	id := r.PathValue("id")
	if id == "" {
		// Fallback extraction for compatibility
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(parts) >= 3 && parts[0] == "events" && parts[2] == "start" {
			id = parts[1]
		}
	}

	if id == "" {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "missing event id"})
		return
	}

	now := time.Now().UTC()
	updated, err := h.sm.StartEvent(r.Context(), id, now)
	if err != nil {
		switch {
		case errors.Is(err, eventstate.ErrEventNotFound):
			writeJSON(w, http.StatusNotFound, ErrorResponse{Error: "event not found"})
		case errors.Is(err, eventstate.ErrEventAlreadyStarted):
			writeJSON(w, http.StatusConflict, ErrorResponse{Error: "already started"})
		case errors.Is(err, eventstate.ErrConditionsNotMet):
			writeJSON(w, http.StatusPreconditionFailed, ErrorResponse{
				Error:   "conditions not met",
				Details: "event funding and minimum participants must be satisfied before starting",
			})
		case errors.Is(err, eventstate.ErrInvalidTransition):
			writeJSON(w, http.StatusConflict, ErrorResponse{Error: err.Error()})
		case errors.Is(err, eventstate.ErrStateConflict):
			writeJSON(w, http.StatusConflict, ErrorResponse{Error: "already started"})
		default:
			writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "internal server error"})
		}
		return
	}

	writeJSON(w, http.StatusOK, updated)
}
