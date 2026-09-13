package config

import (
	"strings"
	"testing"
)

// validContractID passes strkey's checksum validation (unlike a
// pattern-only check) — generated from 32 arbitrary bytes with
// strkey.Encode(strkey.VersionByteContract, ...).
const validContractID = "CAAACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6N4O"

// lookup builds a getenv func from a map, returning "" for anything unset
// — the same behavior as os.Getenv, without touching the real environment.
func lookup(vars map[string]string) func(string) string {
	return func(key string) string {
		return vars[key]
	}
}

func TestLoad_ValidTestnetConfig(t *testing.T) {
	cfg, err := Load(lookup(map[string]string{
		"ESCROW_CONTRACT_ID": validContractID,
	}))
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if cfg.Network != NetworkTestnet {
		t.Errorf("Network = %q, want %q", cfg.Network, NetworkTestnet)
	}
	if cfg.SorobanRPCURL != defaultTestnetSorobanRPCURL {
		t.Errorf("SorobanRPCURL = %q, want default %q", cfg.SorobanRPCURL, defaultTestnetSorobanRPCURL)
	}
	if cfg.EscrowContractID != validContractID {
		t.Errorf("EscrowContractID = %q, want %q", cfg.EscrowContractID, validContractID)
	}
	if cfg.Port != defaultPort {
		t.Errorf("Port = %q, want default %q", cfg.Port, defaultPort)
	}
	if cfg.AllowMainnet {
		t.Errorf("AllowMainnet = true, want false")
	}
}

func TestLoad_ValidMainnetConfig(t *testing.T) {
	cfg, err := Load(lookup(map[string]string{
		"STELLAR_NETWORK":    NetworkMainnet,
		"ALLOW_MAINNET":      "true",
		"SOROBAN_RPC_URL":    "https://mainnet.sorobanrpc.example",
		"ESCROW_CONTRACT_ID": validContractID,
		"PORT":               "9090",
	}))
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if cfg.NetworkPassphrase != "Public Global Stellar Network ; September 2015" {
		t.Errorf("unexpected mainnet passphrase: %q", cfg.NetworkPassphrase)
	}
	if cfg.SorobanRPCURL != "https://mainnet.sorobanrpc.example" {
		t.Errorf("SorobanRPCURL = %q, want the explicit override", cfg.SorobanRPCURL)
	}
	if cfg.Port != "9090" {
		t.Errorf("Port = %q, want 9090", cfg.Port)
	}
}

func TestLoad_MissingEscrowContractID(t *testing.T) {
	_, err := Load(lookup(map[string]string{}))
	assertErrorNames(t, err, "ESCROW_CONTRACT_ID")
}

func TestLoad_MalformedEscrowContractID(t *testing.T) {
	_, err := Load(lookup(map[string]string{
		"ESCROW_CONTRACT_ID": "not-a-contract-id",
	}))
	assertErrorNames(t, err, "ESCROW_CONTRACT_ID")
}

func TestLoad_MainnetWithoutAllowMainnetGate(t *testing.T) {
	_, err := Load(lookup(map[string]string{
		"STELLAR_NETWORK":    NetworkMainnet,
		"SOROBAN_RPC_URL":    "https://mainnet.sorobanrpc.example",
		"ESCROW_CONTRACT_ID": validContractID,
	}))
	assertErrorNames(t, err, "ALLOW_MAINNET")
}

func TestLoad_MainnetWithoutSorobanRPCURL(t *testing.T) {
	_, err := Load(lookup(map[string]string{
		"STELLAR_NETWORK":    NetworkMainnet,
		"ALLOW_MAINNET":      "true",
		"ESCROW_CONTRACT_ID": validContractID,
	}))
	assertErrorNames(t, err, "SOROBAN_RPC_URL")
}

func TestLoad_MalformedAllowMainnet(t *testing.T) {
	_, err := Load(lookup(map[string]string{
		"ALLOW_MAINNET":      "yes-please",
		"ESCROW_CONTRACT_ID": validContractID,
	}))
	assertErrorNames(t, err, "ALLOW_MAINNET")
}

func TestLoad_MalformedStellarNetwork(t *testing.T) {
	_, err := Load(lookup(map[string]string{
		"STELLAR_NETWORK":    "devnet",
		"ESCROW_CONTRACT_ID": validContractID,
	}))
	assertErrorNames(t, err, "STELLAR_NETWORK")
}

// TestLoad_CollectsEveryProblemAtOnce is the multi-error case the issue
// asks for: an operator fixing a broken .env should see every problem in
// one error, not discover them one restart at a time.
func TestLoad_CollectsEveryProblemAtOnce(t *testing.T) {
	_, err := Load(lookup(map[string]string{
		"STELLAR_NETWORK": NetworkMainnet,
		// ALLOW_MAINNET, SOROBAN_RPC_URL, ESCROW_CONTRACT_ID all left unset.
	}))
	assertErrorNames(t, err, "ALLOW_MAINNET", "SOROBAN_RPC_URL", "ESCROW_CONTRACT_ID")
}

func assertErrorNames(t *testing.T, err error, names ...string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected an error naming %v, got nil", names)
	}
	msg := err.Error()
	for _, name := range names {
		if !strings.Contains(msg, name) {
			t.Errorf("error message does not mention %q:\n%s", name, msg)
		}
	}
}
