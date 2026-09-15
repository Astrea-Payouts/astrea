package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	rpcclient "github.com/stellar/go/clients/rpcclient"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/api"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/config"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/store"
)

func main() {
	// Fails fast, at boot, before the mux is even built — a validator that
	// exists but isn't called before ListenAndServe doesn't satisfy #8/S04.
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		log.Fatalf("invalid configuration: %v", err)
	}

	// New pings the pool itself, so a bad DATABASE_URL or an unreachable
	// database fails boot here too, not on the first request.
	ctx, cancelBoot := context.WithTimeout(context.Background(), 10*time.Second)
	pg, err := store.New(ctx, cfg.DatabaseURL)
	cancelBoot()
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pg.Close()

	contract, err := escrow.ContractAddress(cfg.EscrowContractID)
	if err != nil {
		// config.Load already validates ESCROW_CONTRACT_ID, so this would
		// mean that validation and this decoding have drifted apart.
		log.Fatalf("escrow contract address: %v", err)
	}

	usdcContractID, err := escrow.ClassicAssetContractID("USDC", cfg.USDCIssuer, cfg.NetworkPassphrase)
	if err != nil {
		// config.Load already validates USDC_ISSUER, so this would mean
		// that validation and this derivation have drifted apart.
		log.Fatalf("usdc contract address: %v", err)
	}

	mux := api.New(api.Deps{
		ServiceToken:      cfg.ServiceToken,
		Store:             pg,
		RPC:               rpcclient.NewClient(cfg.SorobanRPCURL, nil),
		Contract:          contract,
		NetworkPassphrase: cfg.NetworkPassphrase,
		EscrowCfg:         escrow.Config{},
		USDCContractID:    usdcContractID,
	})

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	go func() {
		log.Printf("core-go listening on :%s (network=%s)", cfg.Port, cfg.Network)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown error: %v", err)
	}
	log.Println("core-go stopped")
}
