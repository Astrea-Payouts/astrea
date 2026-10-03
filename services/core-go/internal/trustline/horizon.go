package trustline

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/stellar/go/clients/horizonclient"
)

// HorizonSource is the production AccountSource, backed by Horizon.
//
// Its one critical job is the 404 mapping: Horizon answers 404 for an account
// that is not on the ledger yet, and that must become ErrAccountNotFound (an
// expected case), not a generic error that surfaces as a 500.
type HorizonSource struct {
	Client horizonclient.ClientInterface
}

func (h HorizonSource) Balances(ctx context.Context, address string) ([]Balance, error) {
	// AccountDetail is not context-aware; bound it with the HTTP client's
	// Timeout. We still honor an already-cancelled context.
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	acc, err := h.Client.AccountDetail(horizonclient.AccountRequest{AccountID: address})
	if err != nil {
		var herr *horizonclient.Error
		if errors.As(err, &herr) && herr.Problem.Status == http.StatusNotFound {
			return nil, ErrAccountNotFound
		}
		return nil, fmt.Errorf("horizon account detail: %w", err)
	}
	out := make([]Balance, 0, len(acc.Balances))
	for _, b := range acc.Balances {
		out = append(out, Balance{
			Code:   b.Asset.Code,
			Issuer: b.Asset.Issuer,
			Native: b.Asset.Type == "native",
		})
	}
	return out, nil
}
