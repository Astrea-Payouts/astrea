// Package api is core-go's HTTP surface: router, the service-auth
// middleware, and (from #185 PR 2 onward) the release-path handlers.
package api

import (
	"net/http"

	"github.com/stellar/go/xdr"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

// Deps are New's dependencies.
type Deps struct {
	ServiceToken string
	Store        store.Store
	// RPC, Contract, NetworkPassphrase and EscrowCfg are what the release
	// handlers (release.go) need to simulate and submit release_reward
	// calls -- see main.go for how they're built from Config.
	RPC               escrow.RPCClient
	Contract          xdr.ScAddress
	NetworkPassphrase string
	EscrowCfg         escrow.Config
	// USDCContractID is the USDC SAC's contract address, derived once at
	// boot from cfg.USDCIssuer -- deposit_funds needs it as the token
	// argument (see main.go).
	USDCContractID string
}

// New mounts the service's HTTP surface. GET /healthz is the only
// unauthenticated route; everything else goes through RequireAuth.
func New(deps Deps) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealthz)

	authed := http.NewServeMux()
	authed.HandleFunc("POST /events/{id}/release/build", handleReleaseBuild(deps))
	authed.HandleFunc("POST /events/{id}/release/submit", handleReleaseSubmit(deps))
	authed.HandleFunc("GET /wallets/{address}/balance", handleWalletBalance(deps))
	authed.HandleFunc("POST /wallets/{address}/deposit/build", handleDepositBuild(deps))
	authed.HandleFunc("POST /wallets/{address}/deposit/submit", handleDepositSubmit(deps))
	authed.HandleFunc("POST /events/{id}/create/build", handleCreateBuild(deps))
	authed.HandleFunc("POST /events/{id}/create/submit", handleCreateSubmit(deps))
	authed.HandleFunc("GET /events/{id}/start/quote", handleStartQuote(deps))
	authed.HandleFunc("POST /events/{id}/start/build", handleStartBuild(deps))
	authed.HandleFunc("POST /events/{id}/start/submit", handleStartSubmit(deps))
	mux.Handle("/", RequireAuth(deps.ServiceToken)(authed))

	return mux
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}
