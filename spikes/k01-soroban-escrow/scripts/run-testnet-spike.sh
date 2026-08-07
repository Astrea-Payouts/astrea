#!/usr/bin/env bash
# K01 (server-build-plan.md) — real testnet run. See ../README.md.
set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK=testnet
WASM=target/wasm32v1-none/release/k01_soroban_escrow.wasm
AMOUNT=100000000 # 10 XLM at 7 decimals — spike uses wrapped native XLM, not real USDC

echo "[1/8] Generating + funding testnet identities (friendbot)..."
for name in organizer judge resolver winner; do
	stellar keys generate "k01-$name" --fund --overwrite --network "$NETWORK"
done

ORGANIZER=$(stellar keys address k01-organizer)
JUDGE=$(stellar keys address k01-judge)
RESOLVER=$(stellar keys address k01-resolver)
WINNER=$(stellar keys address k01-winner)
echo "  organizer: $ORGANIZER"
echo "  judge:     $JUDGE  (both approver and release_signer — the role model this spike is testing)"
echo "  resolver:  $RESOLVER"
echo "  winner:    $WINNER  (unknown to the contract until release — the ADR-007 fix)"

echo "[2/8] Deriving the native-XLM asset contract id (already deployed globally on testnet — not production USDC)..."
TOKEN_ID=$(stellar contract id asset --asset native --network "$NETWORK")
echo "  token: $TOKEN_ID"

echo "[3/8] Building the contract (wasm32v1-none, release)..."
cargo build --target wasm32v1-none --release

echo "[4/8] Deploying the escrow contract..."
CONTRACT_ID=$(stellar contract deploy --wasm "$WASM" --source-account k01-organizer --network "$NETWORK")
echo "  contract: $CONTRACT_ID"

echo "[5/8] initialize + fund + approve..."
stellar contract invoke --id "$CONTRACT_ID" --source-account k01-organizer --network "$NETWORK" -- \
	initialize --organizer "$ORGANIZER" --approver "$JUDGE" --release_signer "$JUDGE" \
	--resolver "$RESOLVER" --token "$TOKEN_ID" --amount "$AMOUNT"
stellar contract invoke --id "$CONTRACT_ID" --source-account k01-organizer --network "$NETWORK" -- fund
stellar contract invoke --id "$CONTRACT_ID" --source-account k01-judge --network "$NETWORK" -- approve

echo "[6/8] NEG-1: organizer attempts release directly (must be rejected — no auth from release_signer)..."
if stellar contract invoke --id "$CONTRACT_ID" --source-account k01-organizer --network "$NETWORK" -- \
	release --winner "$ORGANIZER" >/tmp/k01-neg1.log 2>&1; then
	echo "  UNEXPECTED-PASS — organizer moved escrowed funds. ADR-003 guarantee broken, stop and investigate."
	exit 1
fi
echo "  rejected as expected: $(tail -1 /tmp/k01-neg1.log)"

echo "[7/8] Judge releases to the winner (late-bound address)..."
stellar contract invoke --id "$CONTRACT_ID" --source-account k01-judge --network "$NETWORK" -- \
	release --winner "$WINNER"

echo "[8/8] NEG-2: releasing again must fail (already released, not a fresh authorization bypass)..."
if stellar contract invoke --id "$CONTRACT_ID" --source-account k01-judge --network "$NETWORK" -- \
	release --winner "$WINNER" >/tmp/k01-neg2.log 2>&1; then
	echo "  UNEXPECTED-PASS — double release succeeded. Investigate before trusting this contract with real funds."
	exit 1
fi
echo "  rejected as expected: $(tail -1 /tmp/k01-neg2.log)"

echo
echo "Winner balance:"
stellar contract invoke --id "$TOKEN_ID" --source-account k01-organizer --network "$NETWORK" -- \
	balance --id "$WINNER"

echo
echo "contract: $CONTRACT_ID"
echo "token:    $TOKEN_ID"
echo "K01 (server-build-plan.md) spike complete."
