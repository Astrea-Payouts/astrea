// Package api is core-go's HTTP surface: router, the service-auth
// middleware, and (from #185 PR 2 onward) the release-path handlers.
package api

import (
	"encoding/json"
	"net/http"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

// Deps are New's dependencies. Store is unused by any handler in this PR
// — there are none yet, see #185 PR 2 — but wiring it in now means PR 2
// only adds handlers, not router plumbing.
type Deps struct {
	ServiceToken string
	Store        store.Store
}

// New mounts the service's HTTP surface. GET /healthz is the only
// unauthenticated route; everything else goes through RequireAuth.
func New(deps Deps) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealthz)

	authed := http.NewServeMux()
	// /whoami exists only to exercise RequireAuth end to end through a
	// real mux and to give PR 2 a working handler to copy from — PR 2 may
	// delete it once the real release endpoints land.
	authed.HandleFunc("GET /whoami", handleWhoami)
	mux.Handle("/", RequireAuth(deps.ServiceToken)(authed))

	return mux
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}

func handleWhoami(w http.ResponseWriter, r *http.Request) {
	wallet, _ := WalletFrom(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"wallet": wallet})
}
