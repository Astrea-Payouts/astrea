package config

import (
	"strings"
	"testing"
)

// validContractID passes strkey's checksum validation (unlike a
// pattern-only check) — generated from 32 arbitrary bytes with
// strkey.Encode(strkey.VersionByteContract, ...).
const validContractID = "CAAACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6N4O"

// validDatabaseURL is a direct (non-pooled, port 5432) connection string —
// the shape config.Load requires.
const validDatabaseURL = "postgresql://postgres:postgres@localhost:5432/postgres"

// validServiceToken is exactly the 32-byte floor — the floor, not a real
// secret.
const validServiceToken = "01234567890123456789012345678901"

// validVars is the base set every test below builds on, so each test only
// overrides or deletes what it means to exercise.
func validVars() map[string]string {
	return map[string]string{
		"ESCROW_CONTRACT_ID":    validContractID,
		"DATABASE_URL":          validDatabaseURL,
		"CORE_GO_SERVICE_TOKEN": validServiceToken,
	}
}

// withVars returns validVars() with overrides applied; a "" value deletes
// the key so a test can exercise a missing variable.
func withVars(overrides map[string]string) map[string]string {
	vars := validVars()
	for k, v := range overrides {
		if v == "" {
			delete(vars, k)
			continue
		}
		vars[k] = v
	}
	return vars
}

// lookup builds a getenv func from a map, returning "" for anything unset
// — the same behavior as os.Getenv, without touching the real environment.
func lookup(vars map[string]string) func(string) string {
	return func(key string) string {
		return vars[key]
	}
}

func TestLoad_ValidTestnetConfig(t *testing.T) {
	cfg, err := Load(lookup(validVars()))
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
	if cfg.DatabaseURL != validDatabaseURL {
		t.Errorf("DatabaseURL = %q, want %q", cfg.DatabaseURL, validDatabaseURL)
	}
	if cfg.ServiceToken != validServiceToken {
		t.Errorf("ServiceToken = %q, want %q", cfg.ServiceToken, validServiceToken)
	}
}

func TestLoad_ValidMainnetConfig(t *testing.T) {
	cfg, err := Load(lookup(withVars(map[string]string{
		"STELLAR_NETWORK": NetworkMainnet,
		"ALLOW_MAINNET":   "true",
		"SOROBAN_RPC_URL": "https://mainnet.sorobanrpc.example",
		"PORT":            "9090",
	})))
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
	_, err := Load(lookup(withVars(map[string]string{"ESCROW_CONTRACT_ID": ""})))
	assertErrorNames(t, err, "ESCROW_CONTRACT_ID")
}

func TestLoad_MalformedEscrowContractID(t *testing.T) {
	_, err := Load(lookup(withVars(map[string]string{"ESCROW_CONTRACT_ID": "not-a-contract-id"})))
	assertErrorNames(t, err, "ESCROW_CONTRACT_ID")
}

func TestLoad_MainnetWithoutAllowMainnetGate(t *testing.T) {
	_, err := Load(lookup(withVars(map[string]string{
		"STELLAR_NETWORK": NetworkMainnet,
		"SOROBAN_RPC_URL": "https://mainnet.sorobanrpc.example",
	})))
	assertErrorNames(t, err, "ALLOW_MAINNET")
}

func TestLoad_MainnetWithoutSorobanRPCURL(t *testing.T) {
	_, err := Load(lookup(withVars(map[string]string{
		"STELLAR_NETWORK": NetworkMainnet,
		"ALLOW_MAINNET":   "true",
	})))
	assertErrorNames(t, err, "SOROBAN_RPC_URL")
}

func TestLoad_MalformedAllowMainnet(t *testing.T) {
	_, err := Load(lookup(withVars(map[string]string{"ALLOW_MAINNET": "yes-please"})))
	assertErrorNames(t, err, "ALLOW_MAINNET")
}

func TestLoad_MalformedStellarNetwork(t *testing.T) {
	_, err := Load(lookup(withVars(map[string]string{"STELLAR_NETWORK": "devnet"})))
	assertErrorNames(t, err, "STELLAR_NETWORK")
}

func TestLoad_MissingDatabaseURL(t *testing.T) {
	_, err := Load(lookup(withVars(map[string]string{"DATABASE_URL": ""})))
	assertErrorNames(t, err, "DATABASE_URL")
}

func TestLoad_MalformedDatabaseURL(t *testing.T) {
	_, err := Load(lookup(withVars(map[string]string{"DATABASE_URL": "not-a-url ::: broken"})))
	assertErrorNames(t, err, "DATABASE_URL")
}

// TestLoad_RejectsPooledDatabaseURL is the operator mistake the issue calls
// out by name: apps/web/.env.example's pooled Supabase URL is exactly this
// shape, and pgx forwards pgbouncer=true to Postgres as a runtime param,
// which the server refuses.
func TestLoad_RejectsPooledDatabaseURL(t *testing.T) {
	_, err := Load(lookup(withVars(map[string]string{
		"DATABASE_URL": "postgresql://postgres.project:pw@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
	})))
	assertErrorNames(t, err, "DATABASE_URL")
	if err == nil || !strings.Contains(err.Error(), "direct") {
		t.Errorf("expected the error to point at the direct (5432) connection, got: %v", err)
	}
}

func TestLoad_MissingServiceToken(t *testing.T) {
	_, err := Load(lookup(withVars(map[string]string{"CORE_GO_SERVICE_TOKEN": ""})))
	assertErrorNames(t, err, "CORE_GO_SERVICE_TOKEN")
}

func TestLoad_ShortServiceToken(t *testing.T) {
	_, err := Load(lookup(withVars(map[string]string{"CORE_GO_SERVICE_TOKEN": "too-short"})))
	assertErrorNames(t, err, "CORE_GO_SERVICE_TOKEN")
}

// TestLoad_CollectsEveryProblemAtOnce is the multi-error case the issue
// asks for: an operator fixing a broken .env should see every problem in
// one error, not discover them one restart at a time.
func TestLoad_CollectsEveryProblemAtOnce(t *testing.T) {
	_, err := Load(lookup(map[string]string{
		"STELLAR_NETWORK": NetworkMainnet,
		// ALLOW_MAINNET, SOROBAN_RPC_URL, ESCROW_CONTRACT_ID, DATABASE_URL,
		// CORE_GO_SERVICE_TOKEN all left unset.
	}))
	assertErrorNames(t, err,
		"ALLOW_MAINNET", "SOROBAN_RPC_URL", "ESCROW_CONTRACT_ID",
		"DATABASE_URL", "CORE_GO_SERVICE_TOKEN",
	)
}

// validChainVars is the base set LoadChain's own tests build on — narrower
// than validVars() since LoadChain never looks at DATABASE_URL or
// CORE_GO_SERVICE_TOKEN.
func validChainVars() map[string]string {
	return map[string]string{"ESCROW_CONTRACT_ID": validContractID}
}

func withChainVars(overrides map[string]string) map[string]string {
	vars := validChainVars()
	for k, v := range overrides {
		if v == "" {
			delete(vars, k)
			continue
		}
		vars[k] = v
	}
	return vars
}

func TestLoadChain_ValidTestnetConfig(t *testing.T) {
	chain, err := LoadChain(lookup(validChainVars()))
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if chain.Network != NetworkTestnet {
		t.Errorf("Network = %q, want %q", chain.Network, NetworkTestnet)
	}
	if chain.NetworkPassphrase != "Test SDF Network ; September 2015" {
		t.Errorf("unexpected testnet passphrase: %q", chain.NetworkPassphrase)
	}
	if chain.SorobanRPCURL != defaultTestnetSorobanRPCURL {
		t.Errorf("SorobanRPCURL = %q, want default %q", chain.SorobanRPCURL, defaultTestnetSorobanRPCURL)
	}
	if chain.EscrowContractID != validContractID {
		t.Errorf("EscrowContractID = %q, want %q", chain.EscrowContractID, validContractID)
	}
	if chain.AllowMainnet {
		t.Errorf("AllowMainnet = true, want false")
	}
}

func TestLoadChain_ValidMainnetConfig(t *testing.T) {
	chain, err := LoadChain(lookup(withChainVars(map[string]string{
		"STELLAR_NETWORK": NetworkMainnet,
		"ALLOW_MAINNET":   "true",
		"SOROBAN_RPC_URL": "https://mainnet.sorobanrpc.example",
	})))
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if chain.NetworkPassphrase != "Public Global Stellar Network ; September 2015" {
		t.Errorf("unexpected mainnet passphrase: %q", chain.NetworkPassphrase)
	}
	if chain.SorobanRPCURL != "https://mainnet.sorobanrpc.example" {
		t.Errorf("SorobanRPCURL = %q, want the explicit override", chain.SorobanRPCURL)
	}
}

func TestLoadChain_MissingEscrowContractID(t *testing.T) {
	_, err := LoadChain(lookup(withChainVars(map[string]string{"ESCROW_CONTRACT_ID": ""})))
	assertErrorNames(t, err, "ESCROW_CONTRACT_ID")
}

func TestLoadChain_MalformedEscrowContractID(t *testing.T) {
	_, err := LoadChain(lookup(withChainVars(map[string]string{"ESCROW_CONTRACT_ID": "not-a-contract-id"})))
	assertErrorNames(t, err, "ESCROW_CONTRACT_ID")
}

func TestLoadChain_MainnetWithoutAllowMainnetGate(t *testing.T) {
	_, err := LoadChain(lookup(withChainVars(map[string]string{
		"STELLAR_NETWORK": NetworkMainnet,
		"SOROBAN_RPC_URL": "https://mainnet.sorobanrpc.example",
	})))
	assertErrorNames(t, err, "ALLOW_MAINNET")
}

func TestLoadChain_MainnetWithoutSorobanRPCURL(t *testing.T) {
	_, err := LoadChain(lookup(withChainVars(map[string]string{
		"STELLAR_NETWORK": NetworkMainnet,
		"ALLOW_MAINNET":   "true",
	})))
	assertErrorNames(t, err, "SOROBAN_RPC_URL")
}

func TestLoadChain_MalformedAllowMainnet(t *testing.T) {
	_, err := LoadChain(lookup(withChainVars(map[string]string{"ALLOW_MAINNET": "yes-please"})))
	assertErrorNames(t, err, "ALLOW_MAINNET")
}

func TestLoadChain_MalformedStellarNetwork(t *testing.T) {
	_, err := LoadChain(lookup(withChainVars(map[string]string{"STELLAR_NETWORK": "devnet"})))
	assertErrorNames(t, err, "STELLAR_NETWORK")
}

// TestLoadChain_CollectsEveryProblemAtOnce mirrors
// TestLoad_CollectsEveryProblemAtOnce for the chain-only subset — LoadChain
// never touches DATABASE_URL or CORE_GO_SERVICE_TOKEN, so a harness running
// with only chain vars set still gets every chain problem in one error.
func TestLoadChain_CollectsEveryProblemAtOnce(t *testing.T) {
	_, err := LoadChain(lookup(map[string]string{
		"STELLAR_NETWORK": NetworkMainnet,
		// ALLOW_MAINNET, SOROBAN_RPC_URL, ESCROW_CONTRACT_ID all left unset.
	}))
	assertErrorNames(t, err, "ALLOW_MAINNET", "SOROBAN_RPC_URL", "ESCROW_CONTRACT_ID")
}

// TestLoadChain_NoDatabaseOrServiceTokenRequired is the harness's actual
// precondition (issue: config.Load requiring DATABASE_URL/
// CORE_GO_SERVICE_TOKEN broke a tool that needs neither) — LoadChain must
// succeed with only chain vars set, database and service-token env left
// completely unset.
func TestLoadChain_NoDatabaseOrServiceTokenRequired(t *testing.T) {
	getenv := func(key string) string {
		if key == "ESCROW_CONTRACT_ID" {
			return validContractID
		}
		return ""
	}
	if _, err := LoadChain(getenv); err != nil {
		t.Fatalf("expected no error with only ESCROW_CONTRACT_ID set, got: %v", err)
	}
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
