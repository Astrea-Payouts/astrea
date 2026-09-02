# Smart contracts

Rust/Soroban. The escrow contract lives at
[`astrea/contracts/event-escrow`](astrea/contracts/event-escrow) — a single
shared contract holding a per-organizer balance (`AdminWallet`), not one
instance deployed per event. See [ADR-006](../docs/architecture.md) for why,
and [docs/contracts-build-plan.md](../docs/contracts-build-plan.md) for the
task breakdown (K01/K06 done, E01 in progress).

## Working on it

All commands run from `astrea/` (the Cargo workspace root):

```bash
cd smart-contracts/astrea

cargo test                                   # 78 unit tests, in-process, no network
cargo build --release --target wasm32v1-none # the deployable artifact
cargo fmt --all                              # keep this clean, CI doesn't gate it yet
```

`wasm32v1-none` is the target soroban-sdk 22+ builds for. Install it once with
`rustup target add wasm32v1-none`. Both commands above run in CI on every PR
("Test + build (contracts)").

## Money-path rules

The contract holds real funds, so two invariants are not negotiable and both
are enforced by tests — read [ADR-003 and ADR-006](../docs/architecture.md)
before changing anything in the payout path:

- **The organizer is never in the payout path.** `release_reward` requires the
  event's `judge`, never `admin`.
- **A live event cannot be cancelled for a refund.** `set_event_cancelled`
  accepts only pre-launch states; unwinding a started event goes through the
  dispute flow (not implemented yet — issue #22).

Validate every amount that moves: a missing `> 0` check on a value used in
`balance -= value` inflates a wallet balance with no deposit. That bug reached
`develop` twice; the running log is under "L01" in
[docs/contracts-build-plan.md](../docs/contracts-build-plan.md).
