# Astrea — Definition of Done

Astrea already has strong quality gates — CI config, the PR template, CONTRIBUTING.md's code-quality section — but they have never been written down as one artifact a contributor can check against before asking for review. That gap is expensive once contributors are paid per issue: **a payment dispute is almost always an unwritten Definition of Done.** This document is that artifact.

An item is **Done** only when every applicable box below is true. If a Product Backlog item does not meet this, it is not part of the Increment — it is not shown at Sprint Review, and it is not eligible for payment, no matter how complete it looks.

## Every item

- [ ] CI is green: lint, typecheck, test, build, Conventional Commits, and knowledge-graph drift (`Knowledge graph in sync (code)`)
- [ ] Contract tests and the wasm build pass, if `smart-contracts/` was touched
- [ ] Scoped to the linked issue — an unrelated fix found along the way becomes its own issue, not extra commits riding on this PR
- [ ] Docs updated wherever the change contradicts a doc or ADR (a stale doc is worse than no doc — CONTRIBUTING.md)
- [ ] The PR description says specifically how it was verified — "it builds" is not verification

## UI items additionally

- [ ] **A desktop screenshot and a mobile (375px) screenshot, both attached to the PR.** One width does not show whether the change is actually responsive — this is the single most common gap found in review.
- [ ] No horizontal overflow at 375px
- [ ] Every new user-facing string is added to **both** `apps/web/messages/en.json` and `es.json` — an English placeholder in `es.json` is acceptable (U16 sweeps and corrects these later); a missing key is not, because it renders a raw key or crashes on `/es`

## Money-path items additionally

*(anything under `E0*`, escrow calls, signing, or reconciliation)*

- [ ] Executed end-to-end on **testnet** with a real transaction — the tx hash or contract ID is in the PR description
- [ ] The `security` label is applied to the PR
- [ ] At least one negative path is exercised, not only the happy path (unauthorized action, double-submit, race on a state transition — whatever applies)

## What "not Done" looks like

- CI is green but the PR describes no manual verification beyond "it builds"
- A UI change with one screenshot, or a screenshot at only one width
- A money-path PR with no tx hash and no `security` label
- Scope has quietly grown to include a second, unrelated fix
- A doc that now contradicts the code, left as it was

Any of these sends the item back to the Product Backlog for rework — it is never "Done enough to merge and Done for real later."

## Where this comes from, and where it doesn't

This DoD is derived from CI configuration, the PR template, and CONTRIBUTING.md as they already exist — it does not invent new requirements, it collects the ones already enforced and states them in one place a contributor can check against *before* asking for review, not discover during it.

**What it deliberately does not yet include:** GrantFox's own payout criteria for an issue. Those have not been reviewed against this document. Before the next campaign opens, whatever GrantFox requires for payment must be folded in here — a contributor should never discover a payment condition for the first time at review.

See [sprint-plan.md](sprint-plan.md) for how this DoD fits into the campaign/Sprint cadence, and [CONTRIBUTING.md](../CONTRIBUTING.md) for local setup and how to open a PR.
