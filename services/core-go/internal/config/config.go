// Package config validates core-go's boot-time environment configuration.
// A service that starts successfully with broken config is worse than one
// that fails fast (issue #8 / S04) — Load is meant to be called once, from
// main, before the HTTP server starts accepting requests.
package config

import (
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stellar/go/network"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
)

const (
	NetworkTestnet = "testnet"
	NetworkMainnet = "mainnet"

	// No free public mainnet Soroban RPC exists, so there is no mainnet
	// equivalent of this default — SOROBAN_RPC_URL becomes required instead.
	defaultTestnetSorobanRPCURL = "https://soroban-testnet.stellar.org"

	defaultPort = "8080"

	// minServiceTokenBytes is a floor, not a recommendation — generate the
	// real value with `openssl rand -hex 32` (see README.md).
	minServiceTokenBytes = 32
)

// Config is the validated result of Load. Deliberately holds no signing
// key: this service holds none — see README.md's Configuration section.
type Config struct {
	Network           string
	NetworkPassphrase string
	SorobanRPCURL     string
	EscrowContractID  string
	AllowMainnet      bool
	Port              string
	DatabaseURL       string
	// ServiceToken is never logged — see README.md's Configuration section.
	ServiceToken string
}

// Load reads and validates every environment variable core-go needs at
// boot, through getenv rather than os.Getenv directly so tests never touch
// the real environment. It collects every problem instead of stopping at
// the first one — an operator fixes a broken .env in one pass, not one
// restart per variable — and returns them joined into a single error, one
// line per variable.
func Load(getenv func(string) string) (Config, error) {
	var problems []string

	stellarNetwork := getenv("STELLAR_NETWORK")
	if stellarNetwork == "" {
		stellarNetwork = NetworkTestnet
	}
	if stellarNetwork != NetworkTestnet && stellarNetwork != NetworkMainnet {
		problems = append(problems, fmt.Sprintf(
			"STELLAR_NETWORK: must be %q or %q, got %q",
			NetworkTestnet, NetworkMainnet, stellarNetwork,
		))
	}

	allowMainnet, err := parseAllowMainnet(getenv("ALLOW_MAINNET"))
	if err != nil {
		problems = append(problems, err.Error())
	}
	// Explicit gate, mirroring apps/web/src/lib/env.ts's ALLOW_MAINNET check:
	// STELLAR_NETWORK=mainnet alone is not enough.
	if stellarNetwork == NetworkMainnet && !allowMainnet {
		problems = append(problems, "ALLOW_MAINNET: must be \"true\" to run with STELLAR_NETWORK=mainnet — "+
			"this is a deliberate gate, not a bug")
	}

	rpcURL := getenv("SOROBAN_RPC_URL")
	if rpcURL == "" {
		if stellarNetwork == NetworkMainnet {
			problems = append(problems, "SOROBAN_RPC_URL: required when STELLAR_NETWORK=mainnet — "+
				"there is no free public mainnet Soroban RPC to default to")
		} else {
			rpcURL = defaultTestnetSorobanRPCURL
		}
	}

	contractID := getenv("ESCROW_CONTRACT_ID")
	if contractID == "" {
		problems = append(problems, "ESCROW_CONTRACT_ID: required")
	} else if _, err := escrow.ContractAddress(contractID); err != nil {
		problems = append(problems, fmt.Sprintf("ESCROW_CONTRACT_ID: invalid contract address %q: %v", contractID, err))
	}

	port := getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	databaseURL := getenv("DATABASE_URL")
	if databaseURL == "" {
		problems = append(problems, "DATABASE_URL: required")
	} else if poolCfg, err := pgxpool.ParseConfig(databaseURL); err != nil {
		problems = append(problems, fmt.Sprintf("DATABASE_URL: invalid: %v", err))
	} else if poolCfg.ConnConfig.Config.RuntimeParams["pgbouncer"] == "true" {
		// pgx forwards unrecognized query params (like pgbouncer) as server
		// runtime settings, and Postgres refuses to SET a parameter named
		// "pgbouncer" — this is also apps/web/.env.example's pooled
		// (port 6543) URL, which is the single most likely operator mistake.
		problems = append(problems, "DATABASE_URL: must not carry pgbouncer=true — "+
			"use the direct (port 5432) connection here, not the pooled one "+
			"apps/web uses. The transaction-mode pooler also breaks pgx's "+
			"prepared statements")
	}

	serviceToken := getenv("CORE_GO_SERVICE_TOKEN")
	if serviceToken == "" {
		problems = append(problems, "CORE_GO_SERVICE_TOKEN: required")
	} else if len(serviceToken) < minServiceTokenBytes {
		problems = append(problems, fmt.Sprintf(
			"CORE_GO_SERVICE_TOKEN: must be at least %d bytes, got %d — "+
				"generate one with `openssl rand -hex 32`",
			minServiceTokenBytes, len(serviceToken),
		))
	}

	if len(problems) > 0 {
		return Config{}, fmt.Errorf("invalid environment configuration:\n  - %s", strings.Join(problems, "\n  - "))
	}

	// Derived from the network, never a separate variable — the same
	// drift argument as apps/web/src/lib/stellar-network.ts not letting the
	// passphrase be configured independently of the network name.
	passphrase := network.TestNetworkPassphrase
	if stellarNetwork == NetworkMainnet {
		passphrase = network.PublicNetworkPassphrase
	}

	return Config{
		Network:           stellarNetwork,
		NetworkPassphrase: passphrase,
		SorobanRPCURL:     rpcURL,
		EscrowContractID:  contractID,
		AllowMainnet:      allowMainnet,
		Port:              port,
		DatabaseURL:       databaseURL,
		ServiceToken:      serviceToken,
	}, nil
}

func parseAllowMainnet(raw string) (bool, error) {
	switch raw {
	case "", "false":
		return false, nil
	case "true":
		return true, nil
	default:
		return false, fmt.Errorf("ALLOW_MAINNET: must be \"true\" or \"false\", got %q", raw)
	}
}
