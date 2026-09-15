// wallet.go implements the organizer path's wallet endpoints: GET
// .../balance (a read-only simulate, no op_log row) and the deposit_funds
// build/submit pair, following the same trust boundary as release.go and
// create.go -- /build simulates and persists the host function XDR,
// /submit compares the signed envelope against it before ever calling the
// RPC (see envelope.go).
package api

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strconv"

	"github.com/stellar/go/strkey"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

// maxDepositStroops caps a single deposit at 1,000,000 USDC (issue #11:
// "positive, <= sane cap, 7 decimals max") -- deposit_funds is the one
// organizer-path call where the amount comes from the client rather than
// being derived from Prize rows, so this is the floor of trust it gets.
const maxDepositStroops = 1_000_000 * 10_000_000

// opIDPattern matches the shape newOpID() (store/postgres_organizer.go)
// generates: 16 CSPRNG bytes, hex-encoded. Rejecting anything else before
// it reaches LoadDepositOp or a log line is what keeps a junk opId a 400
// instead of a store lookup (or a log entry) built from raw client input.
var opIDPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)

type walletBalanceResponse struct {
	Address string `json:"address"`
	Balance string `json:"balance"`
}

type depositBuildRequest struct {
	Amount string `json:"amount"`
}

type depositBuildResponse struct {
	OpID                   string `json:"opId"`
	UnsignedTransactionXDR string `json:"unsignedTransactionXdr"`
}

type depositSubmitRequest struct {
	OpID                 string `json:"opId"`
	SignedTransactionXDR string `json:"signedTransactionXdr"`
}

type depositSubmitResponse struct {
	TxHash string `json:"txHash"`
	Status string `json:"status"`
}

// checkWalletOwnership validates that address is a well-formed Stellar
// account address and that the caller's wallet (RequireAuth's
// X-Astrea-Wallet) is that same address -- every wallet endpoint's shared
// precondition. Writes the appropriate error response and returns
// ok=false on the first check that fails.
func checkWalletOwnership(w http.ResponseWriter, r *http.Request, address string) bool {
	if _, err := strkey.Decode(strkey.VersionByteAccountID, address); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_wallet", "address must be a valid Stellar account address")
		return false
	}
	wallet, _ := WalletFrom(r.Context())
	if wallet != address {
		writeError(w, http.StatusForbidden, "not_wallet_owner", "caller does not match the requested wallet address")
		return false
	}
	return true
}

// handleWalletBalance reads an organizer's AdminWallet balance via
// simulation only -- no op_log row, since nothing is built or submitted.
func handleWalletBalance(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		address := r.PathValue("address")
		if !checkWalletOwnership(w, r, address) {
			return
		}

		balance, err := escrow.GetBalance(r.Context(), deps.RPC, deps.Contract, address, deps.EscrowCfg)
		if err != nil {
			var simErr *escrow.SimulationError
			if errors.As(err, &simErr) {
				writeError(w, http.StatusBadGateway, "simulation_failed", simErr.Error())
				return
			}
			log.Printf("api: wallet %s: GetBalance: %v", address, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(walletBalanceResponse{Address: address, Balance: strconv.FormatInt(balance, 10)})
	}
}

// handleDepositBuild simulates deposit_funds and persists the result as a
// brand new PENDING op_log row -- deposits repeat, so unlike create_event
// there is no existing row to upsert (issue #11 decision 5).
func handleDepositBuild(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		address := r.PathValue("address")
		if !checkWalletOwnership(w, r, address) {
			return
		}

		var req depositBuildRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_request", "body is not valid JSON")
			return
		}
		amount, err := escrow.AmountToStroops(req.Amount)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_amount", err.Error())
			return
		}
		if amount > maxDepositStroops {
			writeError(w, http.StatusBadRequest, "invalid_amount", "amount exceeds the maximum allowed deposit")
			return
		}

		unsignedTx, err := escrow.BuildDepositFunds(r.Context(), deps.RPC, deps.Contract, address, deps.USDCContractID, amount, deps.EscrowCfg)
		if err != nil {
			var simErr *escrow.SimulationError
			if errors.As(err, &simErr) {
				writeError(w, http.StatusBadGateway, "simulation_failed", simErr.Error())
				return
			}
			log.Printf("api: wallet %s: BuildDepositFunds: %v", address, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		hostFunctionXDR, err := hostFunctionXDRFrom(unsignedTx.XDR)
		if err != nil {
			log.Printf("api: wallet %s: %v", address, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		opID, err := deps.Store.SaveDepositBuild(r.Context(), store.DepositBuild{
			HostFunctionXDR: hostFunctionXDR,
			SourceAccount:   address,
			Amount:          amount,
		})
		if err != nil {
			log.Printf("api: wallet %s: SaveDepositBuild: %v", address, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(depositBuildResponse{OpID: opID, UnsignedTransactionXDR: unsignedTx.XDR})
	}
}

// handleDepositSubmit re-derives and compares the signed envelope against
// the deposit build named by opId (#185 decision 3, via envelope.go) before
// ever calling the RPC, then submits it and reconciles the op_log row with
// the on-chain outcome.
func handleDepositSubmit(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		address := r.PathValue("address")
		if !checkWalletOwnership(w, r, address) {
			return
		}

		var req depositSubmitRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SignedTransactionXDR == "" {
			writeError(w, http.StatusBadRequest, "invalid_request", "body must be JSON with a non-empty opId and signedTransactionXdr")
			return
		}
		if !opIDPattern.MatchString(req.OpID) {
			writeError(w, http.StatusBadRequest, "invalid_request", "opId is not a value this service issued")
			return
		}

		op, err := deps.Store.LoadDepositOp(r.Context(), req.OpID)
		if err != nil {
			if err == store.ErrNotFound {
				writeError(w, http.StatusNotFound, "deposit_not_found", "no deposit build with that opId")
				return
			}
			log.Printf("api: wallet %s: LoadDepositOp: %v", address, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}
		switch op.Status {
		case store.OpStatusSucceeded:
			writeError(w, http.StatusConflict, "deposit_already_succeeded", "this deposit already succeeded")
			return
		case store.OpStatusFailed:
			writeError(w, http.StatusConflict, "no_pending_deposit", "the last deposit attempt failed -- build again before submitting")
			return
		case store.OpStatusPending:
			// proceed
		default:
			log.Printf("api: wallet %s: LoadDepositOp: unexpected status %q", address, op.Status)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		if op.Build.SourceAccount != address {
			writeError(w, http.StatusForbidden, "not_wallet_owner", "this deposit was not built for the caller's wallet")
			return
		}

		if err := verifySignedEnvelope(req.SignedTransactionXDR, op.Build.SourceAccount, op.Build.HostFunctionXDR); err != nil {
			writeError(w, http.StatusConflict, "envelope_mismatch", err.Error())
			return
		}

		// From here on the transaction may already be on the network -- see
		// handleReleaseSubmit's identical reasoning in release.go.
		ctx := context.WithoutCancel(r.Context())
		outcome, ok := submitAndClassify(ctx, w, deps.RPC, req.SignedTransactionXDR, deps.EscrowCfg, "wallet "+address, func(err error) {
			markDepositFailedBestEffort(ctx, deps.Store, req.OpID, err)
		})
		if !ok {
			return
		}
		if outcome.PendingHash != "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			json.NewEncoder(w).Encode(depositSubmitResponse{TxHash: outcome.PendingHash, Status: "pending"})
			return
		}
		result := outcome.Result

		if err := deps.Store.MarkDepositSucceeded(ctx, req.OpID); err != nil {
			log.Printf("api: wallet %s: MarkDepositSucceeded (tx %s): %v", address, result.Hash, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(depositSubmitResponse{TxHash: result.Hash, Status: "succeeded"})
	}
}

// markDepositFailedBestEffort records reason against the deposit's op_log
// row. Its own failure is logged, not surfaced -- see
// markReleaseFailedBestEffort's identical reasoning in release.go.
func markDepositFailedBestEffort(ctx context.Context, st store.Store, opID string, reason error) {
	if err := st.MarkDepositFailed(ctx, opID, reason.Error()); err != nil {
		log.Printf("api: deposit %s: MarkDepositFailed: %v", opID, err)
	}
}
