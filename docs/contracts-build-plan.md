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
| L01 | Security pass: contract review (ideally an external audit, or at minimum a careful internal review against known Soroban contract pitfalls — reentrancy, integer overflow, auth bypass), treasury/signer key custody review | M | **Not optional to skip** — a homegrown contract handling real funds has no third-party liability backstop the way a third-party escrow provider would. This gates any mainnet deployment. **Funding path: the Soroban Audit Bank — see below** |
| L02 | Formal verification or fuzz testing of the release/dispute paths, if the team has the resources for it | M | Stretch goal — proportionate to how much value the contract will hold at mainnet. The Audit Bank also offers formal verification at later traction milestones, so this may not have to be self-funded either |

### Funding L01: the Soroban Audit Bank

The Stellar Development Foundation funds security audits for Soroban contracts through the **Soroban Audit Bank**, which changes L01 from a cost we absorb to a cost the ecosystem largely covers. It is **not** open to any Soroban project, and the conditions drive our sequencing.

**The chain is fixed: SCF award → Audit Bank → mainnet.** The Audit Bank only accepts projects that already hold a Stellar Community Fund award; there is no way to apply while an SCF application is still under review. An SCF application is therefore a prerequisite of L01, not a parallel track.

**What the Audit Bank checks before it accepts you (the "readiness" assessment):** eligibility, **threat modeling**, documentation completeness, and codebase maturity. The bar is explicit — the code is expected to be *nearly mainnet-ready*, with extensive tests and a testnet deployment already in place. Two consequences:

- **We do not have a threat model document.** ADRs, the findings log below and the test suite are not the same thing as a written threat model. This is a concrete, currently-missing L01 deliverable — see the checklist below.
- E03 (testnet vertical-slice demo) stops being a nice-to-have and becomes an entry requirement.

**Cost:** 5% of the initial audit cost, paid upfront, fully refunded if critical, high and medium findings are remediated within **20 business days** counted from the audit firm's or SDF's verification following the report. No extension is defined in the rules, though they ask to be notified before the window expires. Treat that window as a hard scheduling constraint: team availability has to be booked for the period right after the audit lands, not fitted in afterwards.

**Timeline, end to end.** The SCF Build process itself typically runs **3–6 months**, with no fixed round dates published. Audit Bank intake and readiness assessment then takes **1–4 weeks** before the audit begins, plus the audit and the 20-day remediation window. Realistically, **from SCF application to an audited contract is on the order of half a year**, so mainnet planning should start from that number rather than from when the code feels finished.

**Follow-up audits are complimentary at traction milestones** ($10M and $100M TVL), including formal verification and competitive audits — the likely route for L02 without self-funding it.

#### L01 readiness checklist (derived from the Audit Bank criteria)

- [ ] SCF Build Award applied for — everything else is downstream of this
- [ ] **Threat model written down** — assets, actors, trust boundaries, attack scenarios and mitigations. Currently missing entirely
- [ ] Testnet deployment live (E03)
- [ ] Test suite covering the money paths and their negative cases (largely done — see the findings log)
- [ ] Contract documentation complete enough for an external reader with no context
- [ ] Open money-path gaps closed: #20 and #22
- [ ] Team availability reserved for the 20 business days after the audit report

Sources: [Soroban Audit Bank](https://stellar.org/grants-and-funding/soroban-audit-bank) · [Audit Bank Official Rules](https://stellar.gitbook.io/scf-handbook/supporting-programs/audit-bank/official-rules) · [Build Award](https://stellar.gitbook.io/scf-handbook/scf-awards/build-award) · [Stellar Community Fund](https://communityfund.stellar.org/)

### Other ecosystem funding relevant to this plan

**SCF Build Award** — up to $150,000 in XLM. Evaluated on ecosystem value, technical feasibility, roadmap clarity and team capability. A testnet-functional project can apply provided it is "ready to build" with a clear architecture and visible preparation for mainnet. **No registered company is required** — individuals can apply, with KYC/KYB depending on the case.

**Instawards** — $1,000–$5,000 typical, up to $15,000 aggregate, for clearly scoped **30-day** work with a concrete deliverable. Not an open application: they are distributed through local Stellar Ambassador Chapters ([chapter list](https://stellar.gitbook.io/ambassador-program)). They are explicitly *"often a first step"* and are **not exclusive** with a later Build Award. The 30-day scoped shape maps almost exactly onto a sprint, which makes this the most realistic near-term funding route for contributor work.

**Practical consequence for sequencing:** the running findings log below stays the way we work day to day — fixing issues as they are found rather than saving them for one audit. The Audit Bank is the external check on top of that, and the cheapest way to reach it is to keep the contract in a state where an SCF application is credible.

**L01 running findings log** (fixed as found, not deferred to a single audit pass at the end):
- **Fixed (2026-09-01):** `create_event` didn't reject a negative `reward` — `AdminWallet.balance -= reward` with a negative value inflated the caller's balance with no deposit, drainable via `withdraw_funds`. Same class of missing guard added to `withdraw_funds` (`amount > 0`, matching `deposit_funds`'s existing check). `release_reward` now caps `winners.len()` at 25 (K06's validated bound) to prevent a malformed winners list from blowing the transaction's resource budget mid-release.
- **Open decision, documented not fixed:** token whitelist (`TokenWhitelistEnabled`) is default-deny-disabled — any SEP-41 token is accepted until the emergency admin explicitly enables the whitelist. Intentional for the testnet/pilot phase; **must be flipped to an explicit allowlist (e.g. USDC only) before accepting real funds.** See the doc comment on `is_token_allowed_internal` in `lib.rs`.
- **Still open, tracked separately:** #20 (two-signature pre-launch emergency withdraw, resolver field), #22 (dispute/resolve_dispute — no path exists yet to unwind an `InProgress` event). Both explicitly block accepting real (non-testnet) funds — see their issue descriptions.

## Sequencing rules

1. K01 before everything — if the spike falsifies the role-model assumption, this doc changes while changing docs is still cheap.
2. E01 (multi-milestone) is a real rewrite of K01's contract shape, not an incremental patch — budget for it as such.
3. L01 (security pass) is mandatory before any mainnet deployment, regardless of how much testnet usage has accumulated by then.
