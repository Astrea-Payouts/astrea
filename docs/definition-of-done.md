# Astrea — Definition of Done

Astrea already has strong quality gates — CI config, the PR template, CONTRIBUTING.md's code-quality section — but they have never been written down as one artifact a contributor can check against before asking for review. That gap is expensive once contributors are paid per issue: **a payment dispute is almost always an unwritten Definition of Done.** This document is that artifact.

An item is **Done** only when every applicable box below is true. If a Product Backlog item does not meet this, it is not part of the Increment — it is not shown at Sprint Review, and it is not eligible for payment, no matter how complete it looks.

## Every item

- [ ] CI is green: lint, typecheck, test, build, Conventional Commits, and knowledge-graph drift (`Knowledge graph in sync (code)`)
- [ ] Contract tests and the wasm build pass, if `smart-contracts/` was touched
- [ ] Scoped to the linked issue — an unrelated fix found along the way becomes its own issue, not extra commits riding on this PR
- [ ] Docs updated wherever the change contradicts a doc or ADR (a stale doc is worse than no doc — CONTRIBUTING.md)
- [ ] The PR description says specifically how it was verified — "it builds" is not verification
- [ ] The PR description contains the exact line `Closes #<issue-number>` when it delivers a GrantFox-tracked issue — GrantFox's payment tracking only recognizes this literal syntax, not a prose mention of the issue number

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

### GrantFox payout conditions

Read directly from GrantFox's own docs (docs.grantfox.xyz, checked 2026-09-24) and mapped against the checklist above. Where GrantFox requires something a PR review can actually enforce and this document didn't already cover it, a checkbox was added; everything else is either already covered or lives entirely on GrantFox's platform, outside what a repo-side DoD can check.

| GrantFox condition | Source | Maps to |
| --- | --- | --- |
| A PR must contain the exact line `Closes #ISSUE_NUMBER` in its description for GrantFox to recognize it as the delivery for that issue | [Linking your pull request to the issue](https://docs.grantfox.xyz/user-manual-guides/oss-contributions-guide/contributor-guide/linking-your-pull-request-to-the-issue.md) | **New checkbox above.** CONTRIBUTING.md and the PR template already suggest "Closes #123" as informal GitHub convention, but neither enforces the literal syntax GrantFox's payment tracking depends on — that gap is what the new checkbox closes. |
| The contribution must be accepted by the maintainer; GrantFox may reject, adjust, reduce, or hold rewards if quality standards aren't met | [Key concepts: Rewards](https://docs.grantfox.xyz/key-concepts/rewards) | Already covered — the entire "Every item" checklist plus "What 'not Done' looks like" is exactly this bar, stated in repo-specific terms instead of GrantFox's general ones. |
| Maintainers may flag substandard code, misaligned submissions, or **unreviewed AI-generated submissions**; only GrantFox Admins can strike or ban | [Flagging & strikes](https://docs.grantfox.xyz/key-concepts/flagging-and-strikes.md) | Already covered — "the PR description says specifically how it was verified" is the existing guard against exactly this; no new checkbox needed, but worth naming here so it isn't silently missed. |
| Rewards can only be requested once a Campaign has ended, and only once per Campaign; the issue must belong to the active Campaign and have a PR that is properly linked | [Requesting budget rewards](https://docs.grantfox.xyz/user-manual-guides/oss-contributions-guide/maintainer-guide/maintaining-your-project/requesting-budget-rewards.md) | Not a per-PR DoD item — this is a maintainer-side process step at campaign close, tracked in [sprint-plan.md](sprint-plan.md)'s campaign slate rules instead. |
| Campaign budgets are limited; not every accepted contribution gets paid | [Key concepts: Rewards](https://docs.grantfox.xyz/key-concepts/rewards) | Not a DoD item — a capacity constraint, already reflected in sprint-plan.md's S-equivalents budgeting. |
| A contributor's paid-issue cap per Campaign is set by their GrantFox Tier (FoxPoints/Score) | [Tier system](https://docs.grantfox.xyz/oss-contributions/tier-system.md) | Not a DoD item — governs how many issues a given contributor can be paid for, not whether a given PR is Done. Relevant to slate planning, not review. |
| Reward payment requires a valid, non-custodial Stellar wallet with a USDC trustline and no memo requirement, registered on the contributor's GrantFox profile | [Wallets & payments](https://docs.grantfox.xyz/key-concepts/wallets-and-payments.md) | Not a DoD item — entirely on the contributor's GrantFox profile, not verifiable from a PR. |
| Whether campaign-to-issue attachment uses GitHub labels, and what exact-match rule governs it | [Campaigns](https://docs.grantfox.xyz/oss-contributions/campaigns.md) | **Not stated in GrantFox docs (checked 2026-09-24).** The page confirms issues need "the correct Campaign tag" but does not say whether that tag is a GitHub label; the repo currently has no `grantfox-campaign*` label at all (see sprint-plan.md's Sprint 1 Review), so this should be confirmed directly with GrantFox before the next slate is published rather than assumed either way. |
| Submissions must not look like farming/abuse; after maintainer selection, GrantFox Admins review each reward request before payment | [Key concepts: Rewards](https://docs.grantfox.xyz/key-concepts/rewards) | Not a DoD item — the first is a platform-conduct rule about the contributor's behavior across GrantFox generally, not a single PR's content; the second is GrantFox's own approval step, after this checklist's job is already done. |

This list does not invent GrantFox requirements beyond what its docs state; where a page did not say something, that is written above rather than guessed.

See [sprint-plan.md](sprint-plan.md) for how this DoD fits into the campaign/Sprint cadence, and [CONTRIBUTING.md](../CONTRIBUTING.md) for local setup and how to open a PR.
