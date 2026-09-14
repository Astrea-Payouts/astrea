// release.go implements the judge release path: POST .../release/build
// simulates release_reward and hands back an unsigned transaction for the
// judge's wallet to sign; POST .../release/submit re-derives and compares
// the signed envelope against what /build produced (#185 decision 3) before
// ever calling the RPC, then submits and reconciles op_log/prizes/payouts
// with the on-chain outcome.
package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"time"

	"github.com/stellar/go/xdr"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

// uuidPattern matches a standard 8-4-4-4-12 hex UUID, case-insensitive.
// Validating the path id against this before ever calling the store is
// what keeps a junk id a 404 instead of a 500: PR1's raw `WHERE id = $1`
// against a `uuid` column raises a Postgres syntax error for anything else.
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type releaseAssignment struct {
	Rank   int    `json:"rank"`
	TeamID string `json:"teamId"`
}

type releaseBuildRequest struct {
	Assignments []releaseAssignment `json:"assignments"`
}

type releaseBuildWinner struct {
	Rank         int    `json:"rank"`
	TeamID       string `json:"teamId"`
	TeamMemberID string `json:"teamMemberId"`
	Address      string `json:"address"`
}

type releaseBuildResponse struct {
	EventID                string               `json:"eventId"`
	UnsignedTransactionXDR string               `json:"unsignedTransactionXdr"`
	Winners                []releaseBuildWinner `json:"winners"`
}

type releaseSubmitRequest struct {
	SignedTransactionXDR string `json:"signedTransactionXdr"`
}

type releaseSubmitResponse struct {
	TxHash string `json:"txHash"`
	Status string `json:"status"`
}

// handleReleaseBuild allocates winners from the caller's assignments,
// simulates release_reward, and persists the result as the event's
// PENDING release op_log row -- the payload /submit will later compare a
// signed envelope against.
func handleReleaseBuild(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventID := r.PathValue("id")
		if !uuidPattern.MatchString(eventID) {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return
		}

		event, judge, ok := checkReleasePreconditions(w, r, deps.Store, eventID)
		if !ok {
			return
		}

		var req releaseBuildRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_request", "body is not valid JSON")
			return
		}
		if len(req.Assignments) == 0 {
			writeError(w, http.StatusBadRequest, "invalid_request", "assignments must not be empty")
			return
		}

		if err := validateAssignments(req.Assignments, event); err != nil {
			writeError(w, http.StatusConflict, "assignments_invalid", err.Error())
			return
		}

		positions, winningTeams, reward, err := buildAllocationInput(event, req.Assignments)
		if err != nil {
			log.Printf("api: event %s: building allocation input: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		winners, err := escrow.AllocateWinners(reward, positions, winningTeams)
		if err != nil {
			var allocErr *escrow.AllocationError
			if errors.As(err, &allocErr) {
				writeError(w, http.StatusConflict, "allocation_failed", allocErr.Error())
				return
			}
			log.Printf("api: event %s: AllocateWinners: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		releaseWinners, err := mapWinners(event, winners)
		if err != nil {
			log.Printf("api: event %s: mapping winners: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		eid, err := escrow.ParseEventID(*event.EscrowEventID)
		if err != nil {
			log.Printf("api: event %s: parsing escrowEventId: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		unsignedTx, err := escrow.BuildReleaseReward(r.Context(), deps.RPC, deps.Contract, judge, eid, winners, deps.EscrowCfg)
		if err != nil {
			var simErr *escrow.SimulationError
			if errors.As(err, &simErr) {
				writeError(w, http.StatusBadGateway, "simulation_failed", simErr.Error())
				return
			}
			log.Printf("api: event %s: BuildReleaseReward: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		_, op, err := escrow.DecodeSingleOpInvokeHostFunction(unsignedTx.XDR)
		if err != nil {
			log.Printf("api: event %s: decoding built unsigned tx: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}
		hostFunctionXDR, err := xdr.MarshalBase64(op.HostFunction)
		if err != nil {
			log.Printf("api: event %s: marshaling built host function: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		err = deps.Store.SaveReleaseBuild(r.Context(), eventID, store.ReleaseBuild{
			HostFunctionXDR: hostFunctionXDR,
			SourceAccount:   judge,
			Winners:         releaseWinners,
		})
		if err != nil {
			switch {
			case err == store.ErrAlreadySucceeded:
				writeError(w, http.StatusConflict, "release_already_succeeded", "this event's release already succeeded")
			case err == store.ErrNotFound:
				writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			default:
				log.Printf("api: event %s: SaveReleaseBuild: %v", eventID, err)
				writeError(w, http.StatusInternalServerError, "internal", "internal error")
			}
			return
		}

		respWinners := make([]releaseBuildWinner, len(releaseWinners))
		for i, rw := range releaseWinners {
			respWinners[i] = releaseBuildWinner{Rank: rw.Rank, TeamID: rw.TeamID, TeamMemberID: rw.TeamMemberID, Address: rw.Address}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(releaseBuildResponse{
			EventID:                eventID,
			UnsignedTransactionXDR: unsignedTx.XDR,
			Winners:                respWinners,
		})
	}
}

// handleReleaseSubmit re-derives and compares the signed envelope a judge's
// wallet returns against the last successful /build for this event (#185
// decision 3) before ever calling the RPC, then submits it and reconciles
// op_log/prizes/payouts with the on-chain outcome.
func handleReleaseSubmit(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventID := r.PathValue("id")
		if !uuidPattern.MatchString(eventID) {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return
		}

		_, _, ok := checkReleasePreconditions(w, r, deps.Store, eventID)
		if !ok {
			return
		}

		var req releaseSubmitRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SignedTransactionXDR == "" {
			writeError(w, http.StatusBadRequest, "invalid_request", "body must be JSON with a non-empty signedTransactionXdr")
			return
		}

		op, err := deps.Store.LoadReleaseOp(r.Context(), eventID)
		if err != nil {
			if err == store.ErrNotFound {
				writeError(w, http.StatusConflict, "no_pending_release", "no release has been built for this event yet")
				return
			}
			log.Printf("api: event %s: LoadReleaseOp: %v", eventID, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}
		switch op.Status {
		case store.OpStatusSucceeded:
			writeError(w, http.StatusConflict, "release_already_succeeded", "this event's release already succeeded")
			return
		case store.OpStatusFailed:
			writeError(w, http.StatusConflict, "no_pending_release", "the last release attempt failed -- build again before submitting")
			return
		case store.OpStatusPending:
			// proceed
		default:
			log.Printf("api: event %s: LoadReleaseOp: unexpected status %q", eventID, op.Status)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		if err := verifySignedEnvelope(req.SignedTransactionXDR, op.Build); err != nil {
			writeError(w, http.StatusConflict, "envelope_mismatch", err.Error())
			return
		}

		result, err := escrow.SubmitSigned(r.Context(), deps.RPC, req.SignedTransactionXDR, deps.EscrowCfg)
		if err != nil {
			var submissionErr *escrow.SubmissionError
			var onChainErr *escrow.OnChainError
			var timeoutErr *escrow.TimeoutError
			switch {
			case errors.As(err, &submissionErr):
				markReleaseFailedBestEffort(r, deps.Store, eventID, err)
				writeError(w, http.StatusBadGateway, "submission_failed", submissionErr.Error())
			case errors.As(err, &onChainErr):
				markReleaseFailedBestEffort(r, deps.Store, eventID, err)
				writeError(w, http.StatusBadGateway, "on_chain_failed", onChainErr.Error())
			case errors.As(err, &timeoutErr):
				// Op stays PENDING -- the outcome is unknown, not failed; a
				// later /submit retry (or manual reconciliation) still has
				// a PENDING row to work with.
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusAccepted)
				json.NewEncoder(w).Encode(releaseSubmitResponse{TxHash: timeoutErr.Hash, Status: "pending"})
			default:
				log.Printf("api: event %s: SubmitSigned: %v", eventID, err)
				writeError(w, http.StatusInternalServerError, "internal", "internal error")
			}
			return
		}

		if err := deps.Store.MarkReleaseSucceeded(r.Context(), eventID, result.Hash, time.Now().UTC()); err != nil {
			log.Printf("api: event %s: MarkReleaseSucceeded (tx %s): %v", eventID, result.Hash, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(releaseSubmitResponse{TxHash: result.Hash, Status: "succeeded"})
	}
}

// markReleaseFailedBestEffort records reason against the event's release
// op_log row. Its own failure is logged, not surfaced: the RPC-side error
// that triggered it is already what the caller sees.
func markReleaseFailedBestEffort(r *http.Request, st store.Store, eventID string, reason error) {
	if err := st.MarkReleaseFailed(r.Context(), eventID, reason.Error()); err != nil {
		log.Printf("api: event %s: MarkReleaseFailed: %v", eventID, err)
	}
}

// checkReleasePreconditions runs the checks both release endpoints share,
// in the order the underlying facts can actually be resolved: whether the
// event is JUDGING, whether it has gone on-chain, whether it has exactly
// one ACTIVE judge, and finally whether the caller's wallet is that judge.
// It writes the appropriate error response and returns ok=false on the
// first check that fails.
func checkReleasePreconditions(w http.ResponseWriter, r *http.Request, st store.Store, eventID string) (event *store.EventForRelease, judge string, ok bool) {
	event, err := st.LoadEventForRelease(r.Context(), eventID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "event_not_found", "no event with that id")
			return nil, "", false
		}
		log.Printf("api: event %s: LoadEventForRelease: %v", eventID, err)
		writeError(w, http.StatusInternalServerError, "internal", "internal error")
		return nil, "", false
	}

	if event.Status != "JUDGING" {
		writeError(w, http.StatusConflict, "event_not_judging", "event is not in the JUDGING state")
		return nil, "", false
	}
	if event.EscrowEventID == nil {
		writeError(w, http.StatusConflict, "event_not_on_chain", "event has no on-chain escrow event id")
		return nil, "", false
	}
	if len(event.Judges) != 1 {
		writeError(w, http.StatusConflict, "judge_ambiguous", "event does not have exactly one ACTIVE judge")
		return nil, "", false
	}
	judge = event.Judges[0]

	wallet, _ := WalletFrom(r.Context())
	if wallet != judge {
		writeError(w, http.StatusForbidden, "not_judge", "caller is not this event's judge")
		return nil, "", false
	}

	return event, judge, true
}

// validateAssignments checks the preconditions listed in #185: every prize
// rank assigned exactly once, every assignment naming a rank that actually
// exists on this event, every team belonging to this event, and no team
// assigned to more than one prize.
func validateAssignments(assignments []releaseAssignment, event *store.EventForRelease) error {
	validRanks := make(map[int]bool, len(event.Prizes))
	for _, p := range event.Prizes {
		validRanks[p.Rank] = true
	}
	validTeams := make(map[string]bool, len(event.Teams))
	for _, t := range event.Teams {
		validTeams[t.ID] = true
	}

	rankSeen := make(map[int]bool, len(assignments))
	teamSeen := make(map[string]bool, len(assignments))
	for _, a := range assignments {
		if !validRanks[a.Rank] {
			return fmt.Errorf("rank %d does not match any prize on this event", a.Rank)
		}
		if rankSeen[a.Rank] {
			return fmt.Errorf("rank %d is assigned more than once", a.Rank)
		}
		rankSeen[a.Rank] = true

		if !validTeams[a.TeamID] {
			return fmt.Errorf("team %s does not belong to this event", a.TeamID)
		}
		if teamSeen[a.TeamID] {
			return fmt.Errorf("team %s is assigned to more than one prize", a.TeamID)
		}
		teamSeen[a.TeamID] = true
	}

	if len(rankSeen) != len(event.Prizes) {
		return fmt.Errorf("every prize rank must be assigned exactly once (%d assigned, %d prizes)", len(rankSeen), len(event.Prizes))
	}
	return nil
}

// buildAllocationInput converts event's prizes and the caller's validated
// assignments into AllocateWinners' input shape, converting each prize's
// Decimal(18,7) amount to stroops (#185 decision 2) along the way.
func buildAllocationInput(event *store.EventForRelease, assignments []releaseAssignment) ([]escrow.Position, []escrow.WinningTeam, int64, error) {
	rankToTeamID := make(map[int]string, len(assignments))
	for _, a := range assignments {
		rankToTeamID[a.Rank] = a.TeamID
	}
	teamByID := make(map[string]store.Team, len(event.Teams))
	for _, t := range event.Teams {
		teamByID[t.ID] = t
	}

	positions := make([]escrow.Position, len(event.Prizes))
	winningTeams := make([]escrow.WinningTeam, len(event.Prizes))
	var reward int64
	for i, p := range event.Prizes {
		stroops, err := escrow.AmountToStroops(p.Amount)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("prize %s has an unconvertible amount %q: %w", p.ID, p.Amount, err)
		}
		positions[i] = escrow.Position{Place: uint32(p.Rank), Amount: stroops}
		reward += stroops

		team := teamByID[rankToTeamID[p.Rank]]
		members := make([]escrow.Member, len(team.Members))
		for j, m := range team.Members {
			members[j] = escrow.Member{Address: m.WalletAddress, Ordinal: m.Ordinal, ShareBasisPoints: m.ShareBasisPoints}
		}
		winningTeams[i] = escrow.WinningTeam{Place: uint32(p.Rank), Members: members}
	}
	return positions, winningTeams, reward, nil
}

// mapWinners joins AllocateWinners' flat output back to the row ids
// SaveReleaseBuild and, later, MarkReleaseSucceeded need -- by Place
// (-> Prize) and Address (-> Team/TeamMember), since a wallet address is
// unique per event (schema.prisma's [eventId, walletId] constraint).
func mapWinners(event *store.EventForRelease, winners []escrow.Winner) ([]store.ReleaseWinner, error) {
	prizeIDByRank := make(map[int]string, len(event.Prizes))
	for _, p := range event.Prizes {
		prizeIDByRank[p.Rank] = p.ID
	}
	type memberInfo struct {
		TeamID       string
		TeamMemberID string
	}
	memberByAddress := make(map[string]memberInfo)
	for _, t := range event.Teams {
		for _, m := range t.Members {
			memberByAddress[m.WalletAddress] = memberInfo{TeamID: t.ID, TeamMemberID: m.ID}
		}
	}

	out := make([]store.ReleaseWinner, len(winners))
	for i, w := range winners {
		info, ok := memberByAddress[w.Address]
		if !ok {
			return nil, fmt.Errorf("winner address %s does not match any team member on this event", w.Address)
		}
		prizeID, ok := prizeIDByRank[int(w.Place)]
		if !ok {
			return nil, fmt.Errorf("winner place %d does not match any prize on this event", w.Place)
		}
		out[i] = store.ReleaseWinner{
			PrizeID:      prizeID,
			TeamID:       info.TeamID,
			TeamMemberID: info.TeamMemberID,
			Address:      w.Address,
			Stroops:      w.Amount,
			Rank:         int(w.Place),
		}
	}
	return out, nil
}

// verifySignedEnvelope is #185 decision 3's guard: it decodes signedXDR,
// requires a V1 single-op InvokeHostFunction envelope with at least one
// signature and a source account matching the judge who built this
// release, and requires its host function to marshal to exactly the bytes
// SaveReleaseBuild stored. Any failure here means the signed transaction a
// judge's wallet returned is not the one /build asked it to sign, and the
// caller must map it to 409 envelope_mismatch -- never call the RPC on it.
func verifySignedEnvelope(signedXDR string, build store.ReleaseBuild) error {
	envelope, op, err := escrow.DecodeSingleOpInvokeHostFunction(signedXDR)
	if err != nil {
		return err
	}
	if envelope.V1 == nil || len(envelope.V1.Signatures) < 1 {
		return fmt.Errorf("escrow: signed envelope has no signatures")
	}
	source, err := envelope.V1.Tx.SourceAccount.GetAddress()
	if err != nil {
		return fmt.Errorf("escrow: reading envelope source account: %w", err)
	}
	if source != build.SourceAccount {
		return fmt.Errorf("escrow: envelope source account %s does not match the judge who built this release", source)
	}
	gotHostFunctionXDR, err := xdr.MarshalBase64(op.HostFunction)
	if err != nil {
		return fmt.Errorf("escrow: marshaling signed host function: %w", err)
	}
	if gotHostFunctionXDR != build.HostFunctionXDR {
		return fmt.Errorf("escrow: signed host function does not match the one /build produced")
	}
	return nil
}
