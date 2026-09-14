package api

import (
	"context"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/stellar/go/strkey"
)

type contextKey int

const walletContextKey contextKey = iota

// RequireAuth enforces the shared service bearer token and the caller's
// wallet header. apps/web already authenticated the session (SEP-0043);
// this middleware only authorizes the service-to-service call — whether
// the wallet is allowed to do what it's asking (e.g. is the event's judge)
// is each handler's job, not this one's.
func RequireAuth(serviceToken string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !validBearer(r.Header.Get("Authorization"), serviceToken) {
				writeError(w, http.StatusUnauthorized, "unauthorized", "missing or invalid bearer token")
				return
			}

			wallet := r.Header.Get("X-Astrea-Wallet")
			if _, err := strkey.Decode(strkey.VersionByteAccountID, wallet); err != nil {
				writeError(w, http.StatusBadRequest, "invalid_wallet", "X-Astrea-Wallet must be a valid Stellar account address")
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), walletContextKey, wallet)))
		})
	}
}

// validBearer uses a constant-time compare so response timing never
// leaks how much of the token a guess got right.
func validBearer(header, token string) bool {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	got := header[len(prefix):]
	return subtle.ConstantTimeCompare([]byte(got), []byte(token)) == 1
}

// WalletFrom returns the caller's wallet address set by RequireAuth, and
// whether one was present — false outside a request the middleware handled.
func WalletFrom(ctx context.Context) (string, bool) {
	wallet, ok := ctx.Value(walletContextKey).(string)
	return wallet, ok
}
