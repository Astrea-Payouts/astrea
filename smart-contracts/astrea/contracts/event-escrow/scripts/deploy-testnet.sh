#!/usr/bin/env bash
# Issue #8 (S04) — deploys the event-escrow contract to Stellar testnet and
# runs the full governance init sequence (emergency admin -> default
# resolver -> treasury), so the stale pre-#20/pre-treasury testnet
# deployment can be replaced by anyone holding the governance keys. See
# ../README.md for the contract's overall model and run-testnet-proof.sh
# for the reference functional proof (this script only covers deploy +
# governance init, not the event lifecycle).
#
# The order below is not optional: initialize_default_resolver and
# initialize_treasury both assert the caller is the emergency admin
# (src/governance.rs), so the emergency admin must be initialized first.
set -euo pipefail
cd "$(dirname "$0")/../../.."  # -> smart-contracts/astrea (the cargo workspace root)

NETWORK=testnet
WASM=target/wasm32v1-none/release/event_escrow.wasm

usage() {
	cat >&2 <<EOF
Usage: EMERGENCY_ADMIN_KEY=<stellar-keys-name> DEFAULT_RESOLVER=<G...> TREASURY=<G...> $0

Required environment variables (all must be set):
  EMERGENCY_ADMIN_KEY   Name of a 'stellar keys' identity that will sign as
                         the emergency admin (a name, not a secret — the
                         script never sees the key material itself).
  DEFAULT_RESOLVER       G-address for the default dispute resolver.
  TREASURY               G-address for the go-live fee treasury (receive-only;
                         this script and the deployed services never hold its key).
EOF
	exit 1
}

if [ -z "${EMERGENCY_ADMIN_KEY:-}" ] || [ -z "${DEFAULT_RESOLVER:-}" ] || [ -z "${TREASURY:-}" ]; then
	echo "Missing one or more required environment variables." >&2
	usage
fi

# Extracts the last "Signing transaction: <hash>" line from a stellar-cli
# invocation's combined output — the CLI prints the tx hash to stderr, not
# stdout (stdout carries the function's return value, if any).
last_tx_hash() {
	sed -n 's/.*Signing transaction: \([0-9a-f]*\).*/\1/p' | tail -1
}

EMERGENCY_ADMIN=$(stellar keys address "$EMERGENCY_ADMIN_KEY")
echo "emergency admin key: $EMERGENCY_ADMIN_KEY ($EMERGENCY_ADMIN)"
echo "default resolver:    $DEFAULT_RESOLVER"
echo "treasury:             $TREASURY"

echo "[1/7] Building the contract (wasm32v1-none, release)..."
stellar contract build

echo "[2/7] Deploying the event-escrow contract (source = emergency admin key)..."
DEPLOY_OUTPUT=$(stellar contract deploy --wasm "$WASM" --source-account "$EMERGENCY_ADMIN_KEY" --network "$NETWORK" 2>&1)
echo "$DEPLOY_OUTPUT"
CONTRACT_ID=$(echo "$DEPLOY_OUTPUT" | tail -1)
TX_DEPLOY=$(echo "$DEPLOY_OUTPUT" | last_tx_hash)
echo "  contract: $CONTRACT_ID"
echo "  deploy tx: $TX_DEPLOY"

echo "[3/7] initialize_emergency_admin — self-signed, must run before the next two calls..."
OUT_EMERGENCY_ADMIN=$(stellar contract invoke --id "$CONTRACT_ID" --source-account "$EMERGENCY_ADMIN_KEY" --network "$NETWORK" --send yes -- \
	initialize_emergency_admin --emergency_admin "$EMERGENCY_ADMIN" 2>&1)
echo "$OUT_EMERGENCY_ADMIN"
TX_EMERGENCY_ADMIN=$(echo "$OUT_EMERGENCY_ADMIN" | last_tx_hash)

echo "[4/7] initialize_default_resolver — requires the emergency admin's auth..."
OUT_DEFAULT_RESOLVER=$(stellar contract invoke --id "$CONTRACT_ID" --source-account "$EMERGENCY_ADMIN_KEY" --network "$NETWORK" --send yes -- \
	initialize_default_resolver --caller "$EMERGENCY_ADMIN" --default_resolver "$DEFAULT_RESOLVER" 2>&1)
echo "$OUT_DEFAULT_RESOLVER"
TX_DEFAULT_RESOLVER=$(echo "$OUT_DEFAULT_RESOLVER" | last_tx_hash)

echo "[5/7] initialize_treasury — requires the emergency admin's auth..."
OUT_TREASURY=$(stellar contract invoke --id "$CONTRACT_ID" --source-account "$EMERGENCY_ADMIN_KEY" --network "$NETWORK" --send yes -- \
	initialize_treasury --caller "$EMERGENCY_ADMIN" --treasury "$TREASURY" 2>&1)
echo "$OUT_TREASURY"
TX_TREASURY=$(echo "$OUT_TREASURY" | last_tx_hash)

echo "[6/7] Reading back get_default_resolver, get_treasury, get_fee_bps (read-only, no transaction submitted)..."
READBACK_RESOLVER=$(stellar contract invoke --id "$CONTRACT_ID" --source-account "$EMERGENCY_ADMIN_KEY" --network "$NETWORK" --send no -- get_default_resolver)
READBACK_TREASURY=$(stellar contract invoke --id "$CONTRACT_ID" --source-account "$EMERGENCY_ADMIN_KEY" --network "$NETWORK" --send no -- get_treasury)
READBACK_FEE_BPS=$(stellar contract invoke --id "$CONTRACT_ID" --source-account "$EMERGENCY_ADMIN_KEY" --network "$NETWORK" --send no -- get_fee_bps)
echo "  get_default_resolver: $READBACK_RESOLVER"
echo "  get_treasury:         $READBACK_TREASURY"
echo "  get_fee_bps:          $READBACK_FEE_BPS (default until set_fee_bps is called)"

echo "[7/7] Done. README-ready block below (paste into ../README.md's testnet trail when this is the real governance-key run):"

cat <<MARKDOWN

---

**Testnet deployment ($(date -u +%Y-%m-%d))**

| Field | Value |
|-------|-------|
| Contract ID | \`$CONTRACT_ID\` |
| Emergency admin | \`$EMERGENCY_ADMIN\` |
| Default resolver | \`$DEFAULT_RESOLVER\` |
| Treasury | \`$TREASURY\` |
| Fee (bps) | $READBACK_FEE_BPS |

| Call | Tx hash |
|------|---------|
| \`deploy\` | \`$TX_DEPLOY\` |
| \`initialize_emergency_admin\` | \`$TX_EMERGENCY_ADMIN\` |
| \`initialize_default_resolver\` | \`$TX_DEFAULT_RESOLVER\` |
| \`initialize_treasury\` | \`$TX_TREASURY\` |

---
MARKDOWN
