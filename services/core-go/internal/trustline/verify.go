// Package trustline checks that a Stellar wallet can receive the prize asset.
//
// It is used at two points (ADR-004): participant registration, and again at
// winner assignment right before the release is built. A wallet whose account
// does not exist on the ledger yet (no XLM) is an expected case and is
// classified as "no trustline", never as an error.
package trustline

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

// Status is the outcome of classifying one wallet.
//
// The zero value is StatusUnknown on purpose: if a caller ignores an error and
// uses the zero Status, it must not read as "ok" (fail closed).
type Status int

const (
	StatusUnknown     Status = iota // not classified (a lookup error occurred)
	StatusOK                        // account exists and holds the trustline
	StatusNoAccount                 // account is not on the ledger yet (no XLM)
	StatusNoTrustline               // account exists but has no trustline for the asset
)

// HasTrustline reports whether the wallet can receive the asset.
func (s Status) HasTrustline() bool { return s == StatusOK }

func (s Status) String() string {
	switch s {
	case StatusOK:
		return "ok"
	case StatusNoAccount:
		return "no_account"
	case StatusNoTrustline:
		return "no_trustline"
	default:
		return "unknown"
	}
}

var (
	// ErrAccountNotFound is what an AccountSource returns when the ledger has no
	// account for the address (Horizon 404). Verify turns it into
	// StatusNoAccount; it never reaches callers of Verify.
	ErrAccountNotFound = errors.New("trustline: account not found on ledger")

	// ErrInvalidAddress means the input is not a classic Stellar public key
	// (G...). It is a caller error, distinct from "no trustline".
	ErrInvalidAddress = errors.New("trustline: invalid stellar address")

	// ErrNoTrustline is matched (errors.Is) by the *MissingError that Require
	// returns, so handlers can map it to a single clear API error.
	ErrNoTrustline = errors.New("trustline: wallet cannot receive the prize asset")
)

// Asset identifies the prize asset (a credit asset, e.g. USDC + its issuer).
type Asset struct {
	Code   string
	Issuer string
}

func (a Asset) String() string { return a.Code + ":" + a.Issuer }

// Balance is the subset of a Horizon balance line this package needs.
type Balance struct {
	Code   string
	Issuer string
	Native bool
}

// AccountSource loads the balances of an account. Implementations must return
// ErrAccountNotFound (and only that) when the account does not exist.
type AccountSource interface {
	Balances(ctx context.Context, address string) ([]Balance, error)
}

// Verifier classifies wallets against one prize asset.
type Verifier struct {
	src   AccountSource
	asset Asset
}

// NewVerifier builds a Verifier. The asset must come from config (issuer
// differs between testnet and mainnet), never be hardcoded.
func NewVerifier(src AccountSource, asset Asset) (*Verifier, error) {
	if src == nil {
		return nil, errors.New("trustline: nil account source")
	}
	if asset.Code == "" || asset.Issuer == "" {
		return nil, errors.New("trustline: asset code and issuer are required")
	}
	return &Verifier{src: src, asset: asset}, nil
}

// Asset returns the asset this Verifier checks for.
func (v *Verifier) Asset() Asset { return v.asset }

// Verify classifies one wallet.
//
//   - no account on the ledger          -> StatusNoAccount,   nil
//   - account without the trustline     -> StatusNoTrustline, nil
//   - account with the trustline        -> StatusOK,          nil
//   - invalid address / Horizon failure -> StatusUnknown,     error
//
// Horizon timeouts, 5xx and rate limits are returned as errors and are NOT
// classified as "no trustline": an outage must not look like a user problem.
func (v *Verifier) Verify(ctx context.Context, address string) (Status, error) {
	if !validAddress(address) {
		return StatusUnknown, fmt.Errorf("%w: %q", ErrInvalidAddress, address)
	}
	balances, err := v.src.Balances(ctx, address)
	if err != nil {
		if errors.Is(err, ErrAccountNotFound) {
			return StatusNoAccount, nil // expected case, not an error
		}
		return StatusUnknown, fmt.Errorf("trustline: load account %s: %w", address, err)
	}
	for _, b := range balances {
		// Match code AND issuer: a same-code asset from another issuer is a
		// different asset and cannot receive the prize.
		if !b.Native && b.Code == v.asset.Code && b.Issuer == v.asset.Issuer {
			return StatusOK, nil
		}
	}
	return StatusNoTrustline, nil
}

// Result is the classification of one wallet in a batch.
type Result struct {
	Address string
	Status  Status
}

// VerifyAll classifies several wallets (e.g. every member of every winning
// team). Duplicates are checked once; order of first appearance is kept. It
// stops at the first real error.
func (v *Verifier) VerifyAll(ctx context.Context, addresses []string) ([]Result, error) {
	seen := make(map[string]struct{}, len(addresses))
	results := make([]Result, 0, len(addresses))
	for _, addr := range addresses {
		if _, dup := seen[addr]; dup {
			continue
		}
		seen[addr] = struct{}{}
		st, err := v.Verify(ctx, addr)
		if err != nil {
			return nil, err
		}
		results = append(results, Result{Address: addr, Status: st})
	}
	return results, nil
}

// MissingError lists the wallets that cannot receive the asset. It matches
// ErrNoTrustline via errors.Is.
type MissingError struct {
	Asset   Asset
	Wallets []Result // only the wallets that failed
}

func (e *MissingError) Error() string {
	addrs := make([]string, len(e.Wallets))
	for i, w := range e.Wallets {
		addrs[i] = fmt.Sprintf("%s (%s)", w.Address, w.Status)
	}
	return fmt.Sprintf("%s: %s: %s", ErrNoTrustline, e.Asset, strings.Join(addrs, ", "))
}

func (e *MissingError) Is(target error) bool { return target == ErrNoTrustline }

// Require is the winner-assignment guard: it returns nil only if every wallet
// can receive the asset. If any cannot, it returns a *MissingError naming them
// all (so the judge sees every problem at once); a lookup failure is returned
// as-is. Never cache between registration and this call: the second check
// exists to catch changes made after registering.
func (v *Verifier) Require(ctx context.Context, addresses ...string) error {
	results, err := v.VerifyAll(ctx, addresses)
	if err != nil {
		return err
	}
	var missing []Result
	for _, r := range results {
		if !r.Status.HasTrustline() {
			missing = append(missing, r)
		}
	}
	if len(missing) > 0 {
		return &MissingError{Asset: v.asset, Wallets: missing}
	}
	return nil
}

// validAddress is a cheap shape check for a classic account address (G + 55
// base32 chars). It does not verify the checksum; Horizon rejects a bad
// checksum with a 400, which surfaces as a lookup error, not "no trustline".
// Muxed (M...) and contract (C...) addresses are rejected: payouts go to G
// accounts.
func validAddress(s string) bool {
	if len(s) != 56 || s[0] != 'G' {
		return false
	}
	for i := 1; i < len(s); i++ {
		c := s[i]
		if !(c >= 'A' && c <= 'Z') && !(c >= '2' && c <= '7') {
			return false
		}
	}
	return true
}
