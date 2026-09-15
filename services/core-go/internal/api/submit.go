// submit.go holds the two pieces every build/submit handler pair
// (release.go, create.go, wallet.go) needs identically: turning a freshly
// built transaction into the HostFunctionXDR a build row persists, and
// classifying what escrow.SubmitSigned reports back into the response a
// /submit endpoint must write.
package api

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/stellar/go/xdr"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
)

// hostFunctionXDRFrom decodes a /build step's own freshly simulated,
// unsigned transaction back into the marshaled HostFunctionXDR every
// SaveXBuild call persists -- the same bytes /submit later compares a
// signed envelope's host function against (see verifySignedEnvelope).
func hostFunctionXDRFrom(unsignedXDR string) (string, error) {
	_, op, err := escrow.DecodeSingleOpInvokeHostFunction(unsignedXDR)
	if err != nil {
		return "", fmt.Errorf("decoding built unsigned tx: %w", err)
	}
	hostFunctionXDR, err := xdr.MarshalBase64(op.HostFunction)
	if err != nil {
		return "", fmt.Errorf("marshaling built host function: %w", err)
	}
	return hostFunctionXDR, nil
}

// submitOutcome is what submitAndClassify hands a /submit handler once the
// response is either already decided or still needs the caller to persist
// success. Result is set on confirmation; PendingHash is set on a poll
// timeout, where the op_log row stays PENDING because the outcome is
// unknown, not failed (see handleReleaseSubmit's doc comment). Exactly one
// is set when ok is true.
type submitOutcome struct {
	Result      *escrow.Result
	PendingHash string
}

// submitAndClassify submits a signed transaction and classifies the
// outcome the same way every /submit handler needs to: SubmissionError and
// OnChainError both call markFailed and write the matching error response
// themselves, since the caller has nothing left to decide for those;
// anything unrecognized logs against logCtx (e.g. "event <id>" or
// "wallet <address>", matching each handler's own log prefix) and writes
// 500. ok is false whenever the response has already been written and the
// caller should just return.
func submitAndClassify(ctx context.Context, w http.ResponseWriter, rpc escrow.RPCClient, signedXDR string, cfg escrow.Config, logCtx string, markFailed func(error)) (submitOutcome, bool) {
	result, err := escrow.SubmitSigned(ctx, rpc, signedXDR, cfg)
	if err != nil {
		var submissionErr *escrow.SubmissionError
		var onChainErr *escrow.OnChainError
		var timeoutErr *escrow.TimeoutError
		switch {
		case errors.As(err, &submissionErr):
			markFailed(err)
			writeError(w, http.StatusBadGateway, "submission_failed", submissionErr.Error())
		case errors.As(err, &onChainErr):
			markFailed(err)
			writeError(w, http.StatusBadGateway, "on_chain_failed", onChainErr.Error())
		case errors.As(err, &timeoutErr):
			return submitOutcome{PendingHash: timeoutErr.Hash}, true
		default:
			log.Printf("api: %s: SubmitSigned: %v", logCtx, err)
			writeError(w, http.StatusInternalServerError, "internal", "internal error")
		}
		return submitOutcome{}, false
	}
	return submitOutcome{Result: &result}, true
}
