# Smart contracts

Rust/Soroban. The escrow contract lives at
[`astrea/contracts/event-escrow`](astrea/contracts/event-escrow) — a single
shared contract holding a per-organizer balance (`AdminWallet`), not one
instance deployed per event. See [ADR-006](../docs/architecture.md) for why,
and [docs/contracts-build-plan.md](../docs/contracts-build-plan.md) for the
task breakdown (K01/K06 done, E01 in progress).

## Do you need to run this?

Only if you are changing the contract. The app does not talk to a local
contract: `apps/web` and `services/core-go` call the instance already deployed
on Stellar testnet through the public Soroban RPC. To run the web app or the Go
service locally, set these and skip the rest of this page:

```bash
# apps/web/.env
NEXT_PUBLIC_ESCROW_CONTRACT_ID=CCNAQ6MC3LZMT3U3RHVS62HEXCHTHDACSGSDKUTJUQWHGPYSAD7NFQZD

# services/core-go/.env
ESCROW_CONTRACT_ID=CCNAQ6MC3LZMT3U3RHVS62HEXCHTHDACSGSDKUTJUQWHGPYSAD7NFQZD
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

That id, its deploy transactions and the governance init sequence are in
[`event-escrow/README.md`](astrea/contracts/event-escrow/README.md) under
"Current testnet deployment". If it ever changes, that table is the source of
truth, not this page.

## Working on it

Prerequisites, once:

```bash
# Rust stable via rustup (https://rustup.rs). On Windows, rustup asks for the
# Visual Studio C++ build tools; cargo test needs them, the wasm build does not.
rustup target add wasm32v1-none
```

`wasm32v1-none` is the target soroban-sdk 22+ builds for (the workspace pins
soroban-sdk 27). You do not need the Stellar CLI to build or test; it is only
for deploying, see below.

All commands run from `astrea/` (the Cargo workspace root):

```bash
cd smart-contracts/astrea

cargo test                                   # unit tests, in-process, no network, no keys
cargo build --release --target wasm32v1-none # the deployable artifact
cargo clippy --all-targets -- -D warnings    # CI fails on any warning
cargo fmt --all --check                      # CI fails on unformatted code
```

The same four steps run in CI on every PR ("Test + build (contracts)"). The
tests use the Soroban test environment, so a failing test never touches
testnet and needs no account.

## Deploying your own instance

Needed only when you want an instance you control (a fork, a new governance
set, a contract change you want to exercise from the app). Install the
[Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli), create
an identity with `stellar keys generate <name> --fund --network testnet`, then:

```bash
cd smart-contracts/astrea
EMERGENCY_ADMIN_KEY=<name> DEFAULT_RESOLVER=G... TREASURY=G... \
  contracts/event-escrow/scripts/deploy-testnet.sh
```

The script builds, deploys and runs the three `initialize_*` calls in the
order the contract enforces (emergency admin first). Point the two env vars
above at the new id. `run-testnet-proof.sh` in the same folder exercises the
full event lifecycle against a fresh deployment and is what the README tables
were produced with.

## Money-path rules

The contract holds real funds, so two invariants are not negotiable and both
are enforced by tests — read [ADR-003 and ADR-006](../docs/architecture.md)
before changing anything in the payout path:

- **The organizer is never in the payout path.** `release_reward` requires the
  event's `judge`, never `admin`.
- **A live event cannot be cancelled for a refund.** `set_event_cancelled`
  accepts only pre-launch states; unwinding a started event goes through
  `resolve_dispute` (resolver-signed, only after `judging_deadline` passes —
  issue #22, done).

Validate every amount that moves: a missing `> 0` check on a value used in
`balance -= value` inflates a wallet balance with no deposit. That bug reached
`develop` twice; the running log is under "L01" in
[docs/contracts-build-plan.md](../docs/contracts-build-plan.md).
