// create.go implements the organizer path's create_event endpoints: POST
// .../create/build reads the contract's default resolver, sums the
// event's prizes into its reward, and simulates create_event; POST
// .../create/submit re-derives and compares the signed envelope against
// that build (see envelope.go) before ever calling the RPC, then submits
// it and moves the event DRAFT -> CREATED (issue #11 decision 4:
// "startable", never itself LIVE -- only PR 2's /start/submit does that).
package api

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

type createBuildResponse struct {
	UnsignedTransactionXDR string `json:"unsignedTransactionXdr"`
	Reward                 int64  `json:"reward"`
	EscrowEventID          string `json:"escrowEventId"`
}

type createSubmitRequest struct {
	SignedTransactionXDR string `json:"signedTransactionXdr"`
}

type createSubmitResponse struct {
	TxHash        string `json:"txHash"`
	Status        string `json:"status"`
	EscrowEventID string `json:"escrowEventId"`
}

// checkCreatePreconditions runs the checks both create endpoints share. The
// organizer check runs immediately after the load, before any check that
// would otherwise leak the event's internal state (DRAFT/on-chain/prize/judge
// counts) to a caller who isn't even allowed to act on this event.
func checkCreatePreconditions(w http.ResponseWriter, r *http.Request, st store.Store, eventID string) (event *store.EventForCreate, ok bool) {
	event, err := st.LoadEventForCreate(r.Context(), eventID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return nil, false
		}
		log.Printf("api: event %s: LoadEventForCreate: %v", eventID, err)
		writeError(w, http.StatusInternalServerError, "internal", "internal error")
		return nil, false
	}

	wallet, _ := WalletFrom(r.Context())
	if wallet != event.OrganizerWalletAddress {
		writeError(w, http.StatusForbidden, "not_organizer", "caller is not this event's organizer")
		return nil, false
	}

	if event.Status != "DRAFT" {
		writeError(w, http.StatusConflict, "event_not_draft", "event is not in the DRAFT state")
		return nil, false
	}
	if event.EscrowEventID != nil {
		writeError(w, http.StatusConflict, "event_already_on_chain", "event already has an on-chain escrow event id")
		return nil, false
	}
	if len(event.Prizes) == 0 {
		writeError(w, http.StatusConflict, "no_prizes", "event has no prizes")
		return nil, false
	}
	if len(event.Judges) != 1 {
		writeError(w, http.StatusConflict, "judge_ambiguous", "event does not have exactly one ACTIVE judge")
		return nil, false
	}

	return event, true
}

// handleCreateBuild reads the contract's default resolver, sums the
// event's prizes into its reward (issue #11 decision 2: the client never
// supplies this amount), simulates create_event against a fresh on-chain
// event id, and persists the result as the event's PENDING create_event
// op_log row -- the payload /submit will later compare a signed envelope
// against. Re-running while PENDING generates a new event id and
// overwrites the previous build, never reusing a stale one.
func handleCreateBuild(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventID := r.PathValue("id")
		if !uuidPattern.MatchString(eventID) {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return
		}

		event, ok := checkCreatePreconditions(w, r, deps.Store, eventID)
		if !ok {
			return
		}

		var reward int64
		for _, p := range event.Prizes {
			stroops, err := escrow.AmountToStroops(p.Amount)
			if err != nil {
				log.Printf("api: event %s: prize %s has an unconvertible amount %q: %v", eventID, p.ID, p.Amount, err)
				writeError(w, http.StatusInternalServerError, "internal", "internal error")
				return
			}
			reward += stroops
		}

		eid, err := escrow.NewEventID()
		if err != nil {
			log.Printf("api: event %s: NewEventID: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		resolver, err := escrow.GetDefaultResolver(r.Context(), deps.RPC, deps.Contract, event.OrganizerWalletAddress, deps.EscrowCfg)
		if err != nil {
			var simErr *escrow.SimulationError
			if errors.As(err, &simErr) {
				writeError(w, http.StatusBadGateway, "simulation_failed", simErr.Error())
				return
			}
			log.Printf("api: event %s: GetDefaultResolver: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		unsignedTx, err := escrow.BuildCreateEvent(r.Context(), deps.RPC, deps.Contract, event.OrganizerWalletAddress, event.Judges[0], resolver, deps.USDCContractID, reward, eid, deps.EscrowCfg)
		if err != nil {
			var simErr *escrow.SimulationError
			if errors.As(err, &simErr) {
				writeError(w, http.StatusBadGateway, "simulation_failed", simErr.Error())
				return
			}
			log.Printf("api: event %s: BuildCreateEvent: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		hostFunctionXDR, err := hostFunctionXDRFrom(unsignedTx.XDR)
		if err != nil {
			log.Printf("api: event %s: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		err = deps.Store.SaveCreateBuild(r.Context(), eventID, store.CreateBuild{
			HostFunctionXDR: hostFunctionXDR,
			SourceAccount:   event.OrganizerWalletAddress,
			EscrowEventID:   eid.String(),
			Reward:          reward,
		})
		if err != nil {
			switch {
			case err == store.ErrAlreadySucceeded:
				writeError(w, http.StatusConflict, "create_already_succeeded", "this event's create_event already succeeded")
			case err == store.ErrNotFound:
				writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			default:
				log.Printf("api: event %s: SaveCreateBuild: %v", eventID, err)
				writeError(w, http.StatusInternalServerError, "internal", "internal error")
			}
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(createBuildResponse{
			UnsignedTransactionXDR: unsignedTx.XDR,
			Reward:                 reward,
			EscrowEventID:          eid.String(),
		})
	}
}

// handleCreateSubmit re-derives and compares the signed envelope an
// organizer's wallet returns against the last successful /build for this
// event (see envelope.go) before ever calling the RPC, then submits it and
// moves the event DRAFT -> CREATED.
func handleCreateSubmit(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventID := r.PathValue("id")
		if !uuidPattern.MatchString(eventID) {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return
		}

		_, ok := checkCreatePreconditions(w, r, deps.Store, eventID)
		if !ok {
			return
		}

		var req createSubmitRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SignedTransactionXDR == "" {
			writeError(w, http.StatusBadRequest, "invalid_request", "body must be JSON with a non-empty signedTransactionXdr")
			return
		}

		op, err := deps.Store.LoadCreateOp(r.Context(), eventID)
		if err != nil {
			if err == store.ErrNotFound {
				writeError(w, http.StatusConflict, "no_pending_create", "no create_event has been built for this event yet")
				return
			}
			log.Printf("api: event %s: LoadCreateOp: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}
		switch op.Status {
		case store.OpStatusSucceeded:
			writeError(w, http.StatusConflict, "create_already_succeeded", "this event's create_event already succeeded")
			return
		case store.OpStatusFailed:
			writeError(w, http.StatusConflict, "no_pending_create", "the last create_event attempt failed -- build again before submitting")
			return
		case store.OpStatusPending:
			// proceed
		default:
			log.Printf("api: event %s: LoadCreateOp: unexpected status %q", eventID, op.Status)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
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
			markCreateFailedBestEffort(ctx, deps.Store, eventID, err)
		})
		if !ok {
			return
		}
		if outcome.PendingHash != "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			json.NewEncoder(w).Encode(createSubmitResponse{TxHash: outcome.PendingHash, Status: "pending", EscrowEventID: op.Build.EscrowEventID})
			return
		}
		result := outcome.Result

		if err := deps.Store.MarkCreateSucceeded(ctx, eventID, op.Build.EscrowEventID, time.Now().UTC()); err != nil {
			if err == store.ErrCreateBuildReplaced {
				log.Printf("api: event %s: MarkCreateSucceeded: build replaced while submit was in flight (escrowEventId %s, tx %s)", eventID, op.Build.EscrowEventID, result.Hash)
				writeError(w, http.StatusConflict, "create_build_replaced", err.Error())
				return
			}
			log.Printf("api: event %s: MarkCreateSucceeded (tx %s): %v", eventID, result.Hash, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(createSubmitResponse{TxHash: result.Hash, Status: "succeeded", EscrowEventID: op.Build.EscrowEventID})
	}
}

// markCreateFailedBestEffort records reason against the event's
// create_event op_log row. Its own failure is logged, not surfaced -- see
// markReleaseFailedBestEffort's identical reasoning in release.go.
func markCreateFailedBestEffort(ctx context.Context, st store.Store, eventID string, reason error) {
	if err := st.MarkCreateFailed(ctx, eventID, reason.Error()); err != nil {
		log.Printf("api: event %s: MarkCreateFailed: %v", eventID, err)
	}
}
