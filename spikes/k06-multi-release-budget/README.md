# K06 — multi-release `close_event()` resource budget spike

De-risks the Council's next-step #1 on the multi-milestone/category-winner
contract redesign: can `close_event()` pay out N winners (one token transfer
each) in a **single contract invocation** without blowing Stellar Mainnet's
per-invocation resource limits?

Scope is deliberately narrow — no `AdminWallet`, no `DataKey::Event`, no
state machine. Just the thing in question: N `token::Client::transfer` calls
in one function, measured against `InvocationResourceLimits::mainnet()`
(soroban-sdk 27's hardcoded 2026-07-10 snapshot of the real network limits).

## Result

| N winners | instructions | % of 400M limit | mem_bytes | % of ~42MB limit | write_entries |
| --- | --- | --- | --- | --- | --- |
| 1  | 171,814   | 0.0% | 21,581  | 0.1% | 2  |
| 3  | 499,903   | 0.1% | 61,791  | 0.1% | 4  |
| 5  | 836,587   | 0.2% | 103,561 | 0.2% | 6  |
| 10 | 1,760,479 | 0.4% | 214,811 | 0.5% | 11 |
| 25 | 4,868,777 | 1.2% | 607,061 | 1.4% | 26 |

Cost scales linearly at ~168k instructions per additional winner. Even at 25
winners in one call — far more than any realistic hackathon prize-category
count — usage is ~1.2% of the instruction budget and ~1.4% of the memory
budget. **No concern for any realistic N.**

## The N=50 failure (and why it doesn't count)

Running N=50 panics with `HostError: Error(Budget, ExceededLimit)` inside
`soroban-env-host`'s `auth.rs` (`get_authenticated_authorizations`). This
looked at first like a real Mainnet-limit problem — it is not:

- The panic happens at the exact same N=50 **even with
  `disable_resource_limits()`** (Mainnet enforcement fully off) — see
  `budget_report_beyond_mainnet_limits_disabled`.
- `get_authenticated_authorizations` is a `#[cfg(any(test, feature =
  "testutils"))]`-only helper that `mock_all_auths()` uses internally to let
  tests inspect `env.auths()`. Its own bookkeeping is metered against a
  separate, always-on "shadow" budget that isn't affected by
  `enforce_resource_limits()`/`disable_resource_limits()` at all.
- Conclusion: this is a **testutils-only artifact** of how `mock_all_auths`
  tracks authorizations for test inspection, not a signal about what a real
  `close_event()` invocation costs on Mainnet. Not worth chasing further —
  no real Astrea event needs 50 prize categories in one call.

## Running it

```bash
cargo test -- --nocapture
```

## Answer to the Council's question

**Extend `EventEscrow` with a list of prizes instead of forking a separate
contract for multi-winner events.** The one open technical risk the Council
flagged (Soroban resource limits) is not a blocker — confirmed clean up to
25 winners in a single `close_event()` call, which covers any realistic
event shape by a wide margin.
