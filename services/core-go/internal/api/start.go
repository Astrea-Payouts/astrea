// start.go implements the organizer's go-live path: GET .../start/quote
// reads the fee/balance/shortfall with no op_log row; POST .../start/build
// simulates set_event_in_progress and persists it as the event's single
// set_event_in_progress op_log row; POST .../start/submit re-derives and
// compares the signed envelope against that build (#185 decision 3) before
// ever calling the RPC, then submits and is the only code path that moves
// an event CREATED -> LIVE (issue #11 decision 6).
package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

type startQuoteResponse struct {
	Fee       string `json:"fee"`
	Balance   string `json:"balance"`
	Shortfall string `json:"shortfall"`
}

type startBuildResponse struct {
	UnsignedTransactionXDR string `json:"unsignedTransactionXdr"`
	JudgingDeadline        int64  `json:"judgingDeadline"`
	Fee                    int64  `json:"fee"`
}

type startSubmitRequest struct {
	SignedTransactionXDR string `json:"signedTransactionXdr"`
}

type startSubmitResponse struct {
	TxHash string `json:"txHash"`
	Status string `json:"status"`
}

// checkStartPreconditions runs the checks every go-live endpoint shares, in
// the order issue #11 requires: the caller's identity is verified right
// after the event loads, before either state check below -- a non-organizer
// gets 403 without learning whether the event is even eligible to start.
func checkStartPreconditions(w http.ResponseWriter, r *http.Request, st store.Store, eventID string) (event *store.EventForStart, ok bool) {
	event, err := st.LoadEventForStart(r.Context(), eventID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return nil, false
		}
		log.Printf("api: event %s: LoadEventForStart: %v", eventID, err)
		writeError(w, http.StatusInternalServerError, "internal", "internal error")
		return nil, false
	}

	wallet, _ := WalletFrom(r.Context())
	if wallet != event.OrganizerWalletAddress {
		writeError(w, http.StatusForbidden, "not_organizer", "caller is not this event's organizer")
		return nil, false
	}

	if event.Status != "CREATED" {
		writeError(w, http.StatusConflict, "event_not_created", "event is not in the CREATED state")
		return nil, false
	}
	if event.EscrowEventID == nil {
		writeError(w, http.StatusConflict, "event_not_on_chain", "event has no on-chain escrow event id")
		return nil, false
	}

	return event, true
}

// handleStartQuote reads the go-live fee and the organizer's free balance
// via simulation only -- no op_log row, since nothing is built or submitted.
func handleStartQuote(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventID := r.PathValue("id")
		if !uuidPattern.MatchString(eventID) {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return
		}

		event, ok := checkStartPreconditions(w, r, deps.Store, eventID)
		if !ok {
			return
		}

		eid, err := escrow.ParseEventID(*event.EscrowEventID)
		if err != nil {
			log.Printf("api: event %s: parsing escrowEventId: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		fee, ok := quoteGoLiveFee(w, deps, r.Context(), eventID, eid, event.OrganizerWalletAddress)
		if !ok {
			return
		}
		balance, ok := getOrganizerBalance(w, deps, r.Context(), eventID, event.OrganizerWalletAddress)
		if !ok {
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(startQuoteResponse{
			Fee:       strconv.FormatInt(fee, 10),
			Balance:   strconv.FormatInt(balance, 10),
			Shortfall: strconv.FormatInt(shortfall(fee, balance), 10),
		})
	}
}

// handleStartBuild simulates set_event_in_progress and persists the result
// as the event's PENDING set_event_in_progress op_log row -- the payload
// /submit will later compare a signed envelope against.
func handleStartBuild(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventID := r.PathValue("id")
		if !uuidPattern.MatchString(eventID) {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return
		}

		event, ok := checkStartPreconditions(w, r, deps.Store, eventID)
		if !ok {
			return
		}

		if event.JudgingDeadlineAt == nil {
			writeError(w, http.StatusConflict, "deadline_missing", "event has no judging deadline set")
			return
		}
		if !event.JudgingDeadlineAt.After(time.Now()) {
			writeError(w, http.StatusConflict, "deadline_past", "judging deadline is in the past")
			return
		}

		eid, err := escrow.ParseEventID(*event.EscrowEventID)
		if err != nil {
			log.Printf("api: event %s: parsing escrowEventId: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		fee, ok := quoteGoLiveFee(w, deps, r.Context(), eventID, eid, event.OrganizerWalletAddress)
		if !ok {
			return
		}
		balance, ok := getOrganizerBalance(w, deps, r.Context(), eventID, event.OrganizerWalletAddress)
		if !ok {
			return
		}
		if balance < fee {
			writeError(w, http.StatusConflict, "insufficient_balance", fmt.Sprintf(
				"balance %d is short of the quoted fee %d by %d", balance, fee, shortfall(fee, balance)))
			return
		}

		judgingDeadline := event.JudgingDeadlineAt.Unix()

		unsignedTx, err := escrow.BuildSetEventInProgress(r.Context(), deps.RPC, deps.Contract, event.OrganizerWalletAddress, eid, uint64(judgingDeadline), deps.EscrowCfg)
		if err != nil {
			var simErr *escrow.SimulationError
			if errors.As(err, &simErr) {
				writeError(w, http.StatusBadGateway, "simulation_failed", simErr.Error())
				return
			}
			log.Printf("api: event %s: BuildSetEventInProgress: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		hostFunctionXDR, err := hostFunctionXDRFrom(unsignedTx.XDR)
		if err != nil {
			log.Printf("api: event %s: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		err = deps.Store.SaveStartBuild(r.Context(), eventID, store.StartBuild{
			HostFunctionXDR: hostFunctionXDR,
			SourceAccount:   event.OrganizerWalletAddress,
			JudgingDeadline: judgingDeadline,
			Fee:             fee,
		})
		if err != nil {
			switch {
			case err == store.ErrAlreadySucceeded:
				writeError(w, http.StatusConflict, "start_already_succeeded", "this event has already gone live")
			case err == store.ErrNotFound:
				writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			default:
				log.Printf("api: event %s: SaveStartBuild: %v", eventID, err)
				writeError(w, http.StatusInternalServerError, "internal", "internal error")
			}
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(startBuildResponse{
			UnsignedTransactionXDR: unsignedTx.XDR,
			JudgingDeadline:        judgingDeadline,
			Fee:                    fee,
		})
	}
}

// checkStartSubmitPreconditions runs /start/submit's own precondition
// order, distinct from checkStartPreconditions above: the caller's identity
// is still verified right after load, but a SUCCEEDED op_log row takes
// priority over the event's now-LIVE status -- that combination is exactly
// what a second, redundant /submit for an already-confirmed build looks
// like (the conditional-update race in issue #11), and it must report
// start_already_succeeded rather than the generic event_not_created a
// stranger sees.
func checkStartSubmitPreconditions(w http.ResponseWriter, r *http.Request, st store.Store, eventID string) (event *store.EventForStart, op *store.StartOp, ok bool) {
	event, err := st.LoadEventForStart(r.Context(), eventID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return nil, nil, false
		}
		log.Printf("api: event %s: LoadEventForStart: %v", eventID, err)
		writeError(w, http.StatusInternalServerError, "internal", "internal error")
		return nil, nil, false
	}

	wallet, _ := WalletFrom(r.Context())
	if wallet != event.OrganizerWalletAddress {
		writeError(w, http.StatusForbidden, "not_organizer", "caller is not this event's organizer")
		return nil, nil, false
	}

	op, err = st.LoadStartOp(r.Context(), eventID)
	if err != nil && err != store.ErrNotFound {
		log.Printf("api: event %s: LoadStartOp: %v", eventID, err)
		writeError(w, http.StatusInternalServerError, "internal", "internal error")
		return nil, nil, false
	}
	if op != nil && op.Status == store.OpStatusSucceeded {
		writeError(w, http.StatusConflict, "start_already_succeeded", "this event has already gone live")
		return nil, nil, false
	}

	if event.Status != "CREATED" {
		writeError(w, http.StatusConflict, "event_not_created", "event is not in the CREATED state")
		return nil, nil, false
	}
	if event.EscrowEventID == nil {
		writeError(w, http.StatusConflict, "event_not_on_chain", "event has no on-chain escrow event id")
		return nil, nil, false
	}

	if op == nil {
		writeError(w, http.StatusConflict, "no_pending_start", "no go-live build exists for this event yet")
		return nil, nil, false
	}
	switch op.Status {
	case store.OpStatusFailed:
		writeError(w, http.StatusConflict, "no_pending_start", "the last go-live attempt failed -- build again before submitting")
		return nil, nil, false
	case store.OpStatusPending:
		// proceed
	default:
		log.Printf("api: event %s: LoadStartOp: unexpected status %q", eventID, op.Status)
		writeError(w, http.StatusInternalServerError, "internal", "internal error")
		return nil, nil, false
	}

	return event, op, true
}

// handleStartSubmit re-derives and compares the signed envelope against the
// last successful /start/build for this event (#185 decision 3) before
// ever calling the RPC, then submits it and, on confirmation, is the only
// code path that moves the event CREATED -> LIVE (issue #11 decision 6).
func handleStartSubmit(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventID := r.PathValue("id")
		if !uuidPattern.MatchString(eventID) {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return
		}

		_, op, ok := checkStartSubmitPreconditions(w, r, deps.Store, eventID)
		if !ok {
			return
		}

		var req startSubmitRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SignedTransactionXDR == "" {
			writeError(w, http.StatusBadRequest, "invalid_request", "body must be JSON with a non-empty signedTransactionXdr")
			return
		}

		if err := verifySignedEnvelope(req.SignedTransactionXDR, op.Build.SourceAccount, op.Build.HostFunctionXDR); err != nil {
			writeError(w, http.StatusConflict, "envelope_mismatch", err.Error())
			return
		}

		// From here on the transaction may already be on the network -- see
		// handleReleaseSubmit's identical reasoning in release.go.
		ctx := context.WithoutCancel(r.Context())
		outcome, ok := submitAndClassify(ctx, w, deps.RPC, req.SignedTransactionXDR, deps.EscrowCfg, "event "+eventID, func(err error) {
			markStartFailedBestEffort(ctx, deps.Store, eventID, err)
		})
		if !ok {
			return
		}
		if outcome.PendingHash != "" {
			// Op stays PENDING -- the outcome is unknown, not failed; a
			// later /submit retry still has a PENDING row to work with.
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			json.NewEncoder(w).Encode(startSubmitResponse{TxHash: outcome.PendingHash, Status: "pending"})
			return
		}
		result := outcome.Result

		if err := deps.Store.MarkStartSucceeded(ctx, eventID, op.Build.HostFunctionXDR, time.Now().UTC()); err != nil {
			if err == store.ErrStartBuildReplaced {
				writeError(w, http.StatusConflict, "start_build_replaced", "the go-live build changed while this submission was in flight")
				return
			}
			log.Printf("api: event %s: MarkStartSucceeded (tx %s): %v", eventID, result.Hash, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(startSubmitResponse{TxHash: result.Hash, Status: "succeeded"})
	}
}

// markStartFailedBestEffort records reason against the event's
// set_event_in_progress op_log row. Its own failure is logged, not
// surfaced -- see markReleaseFailedBestEffort's identical reasoning in
// release.go.
func markStartFailedBestEffort(ctx context.Context, st store.Store, eventID string, reason error) {
	if err := st.MarkStartFailed(ctx, eventID, reason.Error()); err != nil {
		log.Printf("api: event %s: MarkStartFailed: %v", eventID, err)
	}
}

// quoteGoLiveFee wraps escrow.QuoteGoLiveFee with the error handling every
// go-live endpoint needs identically. ok is false once the response has
// already been written.
func quoteGoLiveFee(w http.ResponseWriter, deps Deps, ctx context.Context, eventID string, eid escrow.EventID, organizer string) (fee int64, ok bool) {
	fee, err := escrow.QuoteGoLiveFee(ctx, deps.RPC, deps.Contract, eid, organizer, deps.EscrowCfg)
	if err != nil {
		var simErr *escrow.SimulationError
		if errors.As(err, &simErr) {
			writeError(w, http.StatusBadGateway, "simulation_failed", simErr.Error())
			return 0, false
		}
		log.Printf("api: event %s: QuoteGoLiveFee: %v", eventID, err)
		writeError(w, http.StatusInternalServerError, "internal", "internal error")
		return 0, false
	}
	return fee, true
}

// getOrganizerBalance wraps escrow.GetBalance with the same error handling
// as quoteGoLiveFee above.
func getOrganizerBalance(w http.ResponseWriter, deps Deps, ctx context.Context, eventID string, organizer string) (balance int64, ok bool) {
	balance, err := escrow.GetBalance(ctx, deps.RPC, deps.Contract, organizer, deps.EscrowCfg)
	if err != nil {
		var simErr *escrow.SimulationError
		if errors.As(err, &simErr) {
			writeError(w, http.StatusBadGateway, "simulation_failed", simErr.Error())
			return 0, false
		}
		log.Printf("api: event %s: GetBalance: %v", eventID, err)
		writeError(w, http.StatusInternalServerError, "internal", "internal error")
		return 0, false
	}
	return balance, true
}

// shortfall is how much more the organizer's balance needs to cover fee, or
// 0 if it already does.
func shortfall(fee, balance int64) int64 {
	if balance >= fee {
		return 0
	}
	return fee - balance
}
