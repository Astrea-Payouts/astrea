# Astrea — Contracts Build Plan

The escrow contract, on its own: a custom Soroban smart contract (Rust), the on-chain guarantee the rest of the product is built on top of. See [docs/architecture.md](architecture.md) for the ADRs behind the role model, and [docs/build-plan.md](build-plan.md) for the frontend/backend that calls this contract.

Phased plan with coded tasks. Each task becomes one GitHub issue with its code in the title (e.g., `[E01] Multi-milestone escrow contract`). Sizes: S (≤half day), M (1–2 days), L (3+ days, should be split before assignment). `GFI` = good first issue candidate.

## Phase 0 — Spike (de-risk before anything else)

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| K01 | ✅ **Done (2026-08-06)** — Escrow contract spike: initialize → fund → approve → release → dispute → resolve, end-to-end on testnet. Validated the role model: judge acts as both `approver` and `release_signer`; the funder cannot withdraw funded amounts once escrowed; the winner's address is supplied at release time | L → split | **Gates the whole plan.** Findings in [spikes/k01-soroban-escrow](../spikes/k01-soroban-escrow/README.md) — contract `CBFPD4YFURBDQ3MQ7EMT3HPP2K34W5H6QCVWGCEP43MPHFO5XG5ONCUG`. 8 unit tests + a real testnet run, both negative paths (unauthorized release, double release) rejected as expected |
| K06 | ✅ **Done (2026-08)** — Multi-release resource budget spike: can `close_event()` pay N winners (one token transfer each) in a single call without hitting Stellar Mainnet's per-invocation resource limits? | S | Confirmed clean up to 25 winners in one call (~1.2% of the instruction budget) — no separate contract needed for category/multi-winner events, see ADR-002/ADR-006. Findings in [spikes/k06-multi-release-budget](../spikes/k06-multi-release-budget/README.md) |

## Phase 1 — Production contract

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| E01 | Multi-milestone escrow contract: a single shared contract holding a per-organizer balance (`AdminWallet`, ADR-006) instead of K01's one-contract-per-event shape. Organizer deposits/withdraws against their own balance; `create_event` reserves a list of N independently payable prizes from it (ADR-002); `cancel_event` (pre-launch only) and `close_event` (pays 1..N winners, validated by K06) plus dispute/resolve-dispute round it out | L → split | Lives in `smart-contracts/astrea/contracts/event-escrow`. K01 proved the role model; this POC (deposit/withdraw/create_event already working) is the production shape's actual starting point, not K01's contract-per-event design |
| E02 | Contract unit + integration test suite: role-model checks (organizer cannot move funds, judge as approver+release_signer), every negative path (unauthorized release, double release, release-before-approve, dispute blocks release), multi-milestone independence (one prize's dispute doesn't block another's release) | M | `soroban-sdk` testutils, in-process — fast, no network. Expand K01's 8 tests to cover multi-milestone paths |
| E03 | Testnet vertical-slice demo for the contract alone: deploy → fund N milestones → approve/release/dispute a mix across them → confirm independence | S | Mirrors K01's driver script, scoped to the multi-milestone contract |

## Phase 2 — Hardening (before mainnet)

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| L01 | Security pass: contract review (ideally an external audit, or at minimum a careful internal review against known Soroban contract pitfalls — reentrancy, integer overflow, auth bypass), treasury/signer key custody review | M | **Not optional to skip** — a homegrown contract handling real funds has no third-party liability backstop the way a third-party escrow provider would. This gates any mainnet deployment |
| L02 | Formal verification or fuzz testing of the release/dispute paths, if the team has the resources for it | M | Stretch goal — proportionate to how much value the contract will hold at mainnet |

**L01 running findings log** (fixed as found, not deferred to a single audit pass at the end):
- **Fixed (2026-09-01):** `create_event` didn't reject a negative `reward` — `AdminWallet.balance -= reward` with a negative value inflated the caller's balance with no deposit, drainable via `withdraw_funds`. Same class of missing guard added to `withdraw_funds` (`amount > 0`, matching `deposit_funds`'s existing check). `release_reward` now caps `winners.len()` at 25 (K06's validated bound) to prevent a malformed winners list from blowing the transaction's resource budget mid-release.
- **Open decision, documented not fixed:** token whitelist (`TokenWhitelistEnabled`) is default-deny-disabled — any SEP-41 token is accepted until the emergency admin explicitly enables the whitelist. Intentional for the testnet/pilot phase; **must be flipped to an explicit allowlist (e.g. USDC only) before accepting real funds.** See the doc comment on `is_token_allowed_internal` in `lib.rs`.
- **Still open, tracked separately:** #20 (two-signature pre-launch emergency withdraw, resolver field), #22 (dispute/resolve_dispute — no path exists yet to unwind an `InProgress` event). Both explicitly block accepting real (non-testnet) funds — see their issue descriptions.

## Sequencing rules

1. K01 before everything — if the spike falsifies the role-model assumption, this doc changes while changing docs is still cheap.
2. E01 (multi-milestone) is a real rewrite of K01's contract shape, not an incremental patch — budget for it as such.
3. L01 (security pass) is mandatory before any mainnet deployment, regardless of how much testnet usage has accumulated by then.
