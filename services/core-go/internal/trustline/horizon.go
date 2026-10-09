package trustline

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/stellar/go/amount"
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
		bal := Balance{
			Code:   b.Asset.Code,
			Issuer: b.Asset.Issuer,
			Native: b.Asset.Type == "native",
		}
		if !bal.Native && b.Asset.Type != "liquidity_pool_shares" {
			// A missing is_authorized reads as false (fail closed).
			bal.Authorized = b.IsAuthorized != nil && *b.IsAuthorized
			headroom, err := trustlineHeadroom(b.Limit, b.Balance, b.BuyingLiabilities)
			if err != nil {
				return nil, fmt.Errorf("horizon balance %s:%s: %w", b.Asset.Code, b.Asset.Issuer, err)
			}
			bal.Headroom = headroom
		}
		out = append(out, bal)
	}
	return out, nil
}

// trustlineHeadroom is limit - balance - buyingLiabilities in stroops, never
// negative. Horizon sends all three as 7-decimal strings; an empty
// liabilities field means zero.
func trustlineHeadroom(limit, balance, buyingLiabilities string) (int64, error) {
	var vals [3]int64
	for i, s := range []string{limit, balance, buyingLiabilities} {
		if s == "" {
			continue
		}
		n, err := amount.ParseInt64(s)
		if err != nil {
			return 0, fmt.Errorf("parse amount %q: %w", s, err)
		}
		vals[i] = n
	}
	return max(vals[0]-vals[1]-vals[2], 0), nil
}
