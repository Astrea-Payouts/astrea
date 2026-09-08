#!/usr/bin/env bash
# Issue #5 (corrected scope) — deploys the real event-escrow contract to
# Stellar testnet and proves its atomic multi-winner reward split with real,
# verifiable transactions. See ../README.md for the results table and for
# why this reflects a different (and simpler) data model than issue #5's
# original "N milestones" wording.
#
# Model under test (src/lib.rs): one shared contract, a per-organizer
# AdminWallet{token, balance}. create_event reserves a single `reward: i128`
# from that balance. release_reward pays a Vec<Winner> whose amounts must
# sum exactly to `reward`, in ONE atomic call. There is no dispute mechanism
# and no per-milestone independence in the shipped contract.
set -euo pipefail
cd "$(dirname "$0")/../../.."  # -> smart-contracts/astrea (the cargo workspace root)

NETWORK=testnet
WASM=target/wasm32v1-none/release/event_escrow.wasm
DEPOSIT=1000000000   # 100 XLM (7 decimals) into the organizer's AdminWallet
REWARD_A=300000000   # 30 XLM reward for the multi-winner event
WIN1_AMOUNT=200000000 # 20 XLM to winner1
WIN2_AMOUNT=100000000 # 10 XLM to winner2 (200000000 + 100000000 == REWARD_A)
REWARD_B=100000000    # 10 XLM reward for the cancel/refund event

echo "[1/9] Generating + funding testnet identities (friendbot)..."
for name in escrow-organizer escrow-judge escrow-winner1 escrow-winner2; do
	stellar keys generate "$name" --fund --overwrite --network "$NETWORK"
done

ORGANIZER=$(stellar keys address escrow-organizer)
JUDGE=$(stellar keys address escrow-judge)
WINNER1=$(stellar keys address escrow-winner1)
WINNER2=$(stellar keys address escrow-winner2)
echo "  organizer: $ORGANIZER"
echo "  judge:     $JUDGE  (release_reward requires the judge's auth, never the organizer's — see ADR-003)"
echo "  winner1:   $WINNER1"
echo "  winner2:   $WINNER2"

echo "[2/9] Deriving the native-XLM SAC contract id (already deployed globally on testnet)..."
TOKEN=$(stellar contract id asset --asset native --network "$NETWORK")
echo "  token: $TOKEN"

echo "[3/9] Building the contract (wasm32v1-none, release)..."
stellar contract build

echo "[4/9] Deploying the event-escrow contract..."
CONTRACT_ID=$(stellar contract deploy --wasm "$WASM" --source-account escrow-organizer --network "$NETWORK")
echo "  contract: $CONTRACT_ID"

echo "[5/9] deposit_funds — organizer funds their AdminWallet with 100 XLM..."
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-organizer --network "$NETWORK" -- \
	deposit_funds --admin "$ORGANIZER" --token "$TOKEN" --amount "$DEPOSIT"

EVENT_A=$(openssl rand -hex 16)
echo "[6/9] Scenario A — create_event ($EVENT_A, reward=30 XLM) -> waiting_for_start -> in_progress..."
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-organizer --network "$NETWORK" -- \
	create_event --admin "$ORGANIZER" --judge "$JUDGE" --token "$TOKEN" --reward "$REWARD_A" --event_id "$EVENT_A"
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-organizer --network "$NETWORK" -- \
	set_event_waiting_for_start --admin "$ORGANIZER" --event_id "$EVENT_A"
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-organizer --network "$NETWORK" -- \
	set_event_in_progress --admin "$ORGANIZER" --event_id "$EVENT_A"

echo "[7/9] release_reward — ONE atomic call splits the 30 XLM reward between two winners..."
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-judge --network "$NETWORK" -- \
	release_reward --judge "$JUDGE" --event_id "$EVENT_A" \
	--winners "[{\"address\":\"$WINNER1\",\"amount\":\"$WIN1_AMOUNT\",\"place\":1},{\"address\":\"$WINNER2\",\"amount\":\"$WIN2_AMOUNT\",\"place\":2}]"

EVENT_B=$(openssl rand -hex 16)
echo "[8/9] Scenario B — create_event ($EVENT_B, reward=10 XLM) -> waiting_for_start -> set_event_cancelled (refund path)..."
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-organizer --network "$NETWORK" -- \
	create_event --admin "$ORGANIZER" --judge "$JUDGE" --token "$TOKEN" --reward "$REWARD_B" --event_id "$EVENT_B"
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-organizer --network "$NETWORK" -- \
	set_event_waiting_for_start --admin "$ORGANIZER" --event_id "$EVENT_B"
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-organizer --network "$NETWORK" -- \
	set_event_cancelled --admin "$ORGANIZER" --event_id "$EVENT_B"

echo "[9/9] Final balances and event states (read-only, no transaction submitted)..."
echo "  organizer AdminWallet balance (expect $((DEPOSIT - REWARD_A - REWARD_B + REWARD_B)) stroops):"
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-organizer --network "$NETWORK" --send no -- \
	get_balance --admin "$ORGANIZER"
echo "  winner1 native balance:"
stellar contract invoke --id "$TOKEN" --source-account escrow-organizer --network "$NETWORK" --send no -- \
	balance --id "$WINNER1"
echo "  winner2 native balance:"
stellar contract invoke --id "$TOKEN" --source-account escrow-organizer --network "$NETWORK" --send no -- \
	balance --id "$WINNER2"

# Balances alone do not prove the events reached their terminal states — a
# partial payout followed by a stuck event would still move the right amounts.
# EventState is a plain enum (src/lib.rs): Ended = 3, Cancelled = 99.
echo "  event A state (expect \"state\": 3 = Ended):"
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-organizer --network "$NETWORK" --send no -- \
	get_event --event_id "$EVENT_A"
echo "  event B state (expect \"state\": 99 = Cancelled):"
stellar contract invoke --id "$CONTRACT_ID" --source-account escrow-organizer --network "$NETWORK" --send no -- \
	get_event --event_id "$EVENT_B"

echo
echo "contract: $CONTRACT_ID"
echo "token:    $TOKEN"
echo "event A (atomic multi-winner release): $EVENT_A"
echo "event B (cancel + refund):             $EVENT_B"
echo "Issue #5 (corrected scope) testnet proof complete. See README.md for the tx hash table from the reference run."
