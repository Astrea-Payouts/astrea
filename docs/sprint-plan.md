# Astrea — Sprint Plan

[build-plan.md](build-plan.md) says *what* gets built and in what order. This document says *when*, *by whom*, and *how we know it is finished* — the operating layer between that plan and the GrantFox campaign cycle.

Read [build-plan.md](build-plan.md) first; every task code below (`E01a`, `U03`, …) is defined there or in [contracts-build-plan.md](contracts-build-plan.md).

## The team, honestly

Scrum needs the Scrum Team named, and getting this wrong is what makes campaign planning feel impossible.

| Who | Accountability | Evidence |
| --- | --- | --- |
| Christopher | Product Owner **and** Developer | 119 commits in the last 30 days |
| Dereck | Developer | 14 commits in the last 30 days |
| GrantFox contributors | **Not Scrum Team members** | 6 commits in the last 30 days, across 3 people who came and went |

**Contributors are a supply of variable capacity, not Developers committed to a Sprint Goal.** They claim an issue, may finish it, may not, and owe the Sprint nothing. Every planning decision below follows from that: a Sprint Goal must be achievable by the two maintainers alone, and contributor output is upside rather than plan.

The Product Owner and a Developer being the same person is a real risk, not a technicality — the person deciding what is most valuable is the person who has to build it. Watch for the Backlog quietly reordering itself toward what is pleasant to build.

## Cadence: one Sprint per campaign

**Sprint length: 15 days, aligned to the GrantFox campaign.** This is valid Scrum — the Guide requires a fixed length of one month or less, and shorter Sprints generate more learning cycles and limit risk to a smaller time frame.

Why align rather than run an independent cadence:

- The campaign close is already a real inspection point with money attached. A second, unrelated Sprint boundary would mean two review rhythms and two sets of "are we done?" conversations.
- The Sprint Review lands exactly when payment decisions are being made, which is when stakeholder attention is highest and cheapest to get.

**The trade being accepted, stated plainly:** the Sprint boundary is now set by an external commercial calendar we do not control. Scrum says Sprint length is fixed, and only the Product Owner may cancel a Sprint — and only when the Sprint Goal becomes obsolete.

**So: if a campaign moves, the Sprint does not.** Sprint length stays 15 days and the campaign slate slips to the next Sprint. Breaking that once turns Sprint length into a negotiable variable and destroys any ability to compare one Sprint to the next.

**Sprint 1 is a stated, one-time exception to that rule**, decided by the Product Owner on 2026-09-06: it runs the full month of September rather than 15 days, because the next campaign (2026-09-15) and the SCF Build Award application (targeted for 2026-09-30) both land inside it, and splitting them into two separate 15-day Sprints would have meant planning the SCF application before knowing whether the campaign's own results were worth citing as evidence. A full-month Sprint is still valid Scrum — the Guide's limit is "one month or less." The 15-day-per-campaign cadence resumes at Sprint 2.

## Two lanes inside one Sprint

| Lane | Owner | Commitment level |
| --- | --- | --- |
| **Maintainer lane** | Christopher + Dereck | The Sprint Goal. Achievable without any contributor. |
| **Campaign slate** | GrantFox contributors | A published offer. Forecast, never a commitment. |

The Sprint Goal is only ever drawn from the maintainer lane. Contributor work that lands is added to the Increment; contributor work that does not land costs the Sprint nothing.

## Capacity: count size, not issues

"How many issues per campaign" is the wrong unit — six `S` issues and six `M` issues are not the same amount of work. Budget in **S-equivalents**, using the size labels the repo already has:

| Label | Definition (from build-plan.md) | S-equivalents |
| --- | --- | --- |
| `size: S` | ≤ half a day | 1 |
| `size: M` | 1–2 days | 3 |
| `size: L` | 3+ days | **Never published.** Split first. |

### What one campaign actually absorbed

The window 2026-08-21 → 2026-09-02 (≈12 days, roughly one campaign) is the only real evidence we have:

| Contributor | Delivered | S-equivalents |
| --- | --- | --- |
| `ghzhost` | #16 (U07, S), #17 (U09, S), #32 (U15, M) | 5 |
| `meridianmindx` | #68 (U08, M) — stalled, needed maintainer intervention to land | 3 |
| **Total completed** | **4 issues** | **8** |

Also in flight during that window and *not* completed: #79 (S07) sat in `CHANGES_REQUESTED` for over a week, and #28 was claimed but is blocked (see below). Roughly **4 of 7 started items converted**.

### The slate size that follows

- **Publish 10–14 S-equivalents per campaign** — typically 6–8 issues.
- **Expect 6–9 S-equivalents to complete.** Anything more is a pleasant surprise, not a plan.
- **Cap concurrent open contributor PRs at 4.**

The cap matters more than the slate size. The binding constraint is not contributor supply — it is **one maintainer's review capacity**, and both contributor PRs that reached `main` in the last campaign needed substantial maintainer work to get there. An unreviewed PR is worse than an unpublished issue: the contributor cannot be paid, and the delay is visible on their GrantFox record.

Treat every number here as a hypothesis to inspect at Sprint Review. Two campaigns of real data beats any of them.

## Definition of Done

Moved to its own document: **[definition-of-done.md](definition-of-done.md)**. It is the exact checklist a contributor's PR is checked against — separated out here because a DoD buried inside a planning doc is a DoD nobody links to from a PR description.

The one thing worth repeating in this document: it now requires **a desktop screenshot and a mobile (375px) screenshot** for every UI item, not one screenshot at an arbitrary width. That requirement has been added to the issue template, the PR template, and commented onto every currently-open UI issue.

> **Resolved (Issue #118):** GrantFox's criteria for paying out an issue have been audited and folded directly into [definition-of-done.md](definition-of-done.md) under "GrantFox Campaign & Payout Criteria additionally". See [campaign-slate-2026-09-15.md](campaign-slate-2026-09-15.md) for the active September 15 campaign slate.

## Campaign slate rules

Rules that exist because each one has already cost something:

1. **No `size: L` on a slate.** L means 3+ days and "should be split before assignment". This was already true of #52 (U01), correctly split into #62/#54/#57 before this document's first draft claimed otherwise — that claim was wrong and is corrected here. #70 (T01) genuinely *was* unsplit and has now been split into #109/#110/#111/#112.
2. **No issue whose dependency is unbuilt.** #28 (U11, QR code) has been assigned since 2026-08-21 and claimed with `/attempt` on 2026-08-28. It depends on #64 (U03), which is open and unassigned. A contributor has been holding an unbuildable issue for longer than a full campaign.
3. **Every slate item names its prerequisites and states they are met.** The issue template already has the field; the gate is that someone checks it before publishing.
4. **Keep the slate varied.** The four genuinely-ready good-first-issues today (#18, #37, #38, #39) are all near-identical wallet-compatibility tests. That is a slate one person can take in a day, not a campaign for four people.
5. **A claimed issue that is silent for 5 days gets a comment; at 8 days it is unassigned** — stated on the issue when it is published, so it is a known rule rather than a surprise.

## The Product Goal

> **An organizer can run a real prize payout end to end on testnet, and the contract is ready to enter the SCF → Audit Bank chain.**

One Product Goal at a time, per the Guide. Everything below serves this one; it is fulfilled at E07 plus a submitted SCF application.

**Why this and not the UI:** [contracts-build-plan.md](contracts-build-plan.md) establishes that mainnet is gated on an audit, the audit is gated on an SCF award, and SCF Build takes **3–6 months** with Audit Bank intake and remediation on top — on the order of half a year. It is the longest-lead item in the entire plan, it has no issue, and nothing about it gets faster by starting later. Meanwhile the Phase 3 UI backlog cannot advance far regardless: U02 needs E03, and U03/U04/U05/U06 all need a backend that does not exist yet.

## Sprint 1 — 2026-09-06 to 2026-09-30

Configured live in the GitHub Project ([Astrea Build Plan](https://github.com/orgs/Astrea-Payouts/projects/2)) as a **Sprint** iteration field with two increments, rather than left as prose only — a plan that only exists in a doc is exactly the kind of drift this document has already caught twice (S01, the Audit Bank docs). Assignments below were made by verified context (git history), not by asking preference: Dereck authored `ad9717c`, the commit that added the contract's pause/whitelist/expire/compensation surface, so contract-adjacent work is his; Christopher ran the original K02 Go↔contract spike, so the Go tx-pipeline core is his. Christopher deliberately carries more items — Dereck is at capacity elsewhere this month.

**Sprint Goal:** *Prove the MVP's happy-path payout loop end-to-end on testnet, and open the 2026-09-15 campaign on top of it.*

**Revised 2026-09-06:** the Sprint Goal originally also named "submit the SCF Build Award application by month's end." That deadline was an estimate made from campaign timing pressure before checking the actual round page. Having now checked it directly ([SCF #46](https://communityfund.stellar.org/awards/recxrSMYwAl8vcglg)), Build Submission closes 2026-11-08 — real breathing room, not something needing to be forced into September. The Product Owner's call: relax the full application to that real margin rather than hold an invented internal deadline. See Increment 2 below for what replaced it.

### Increment 1 — MVP proven (2026-09-06 → 2026-09-13)

Scope was deliberately cut on 2026-09-06 to make this deadline realistic: **happy path only** — create → fund → register → admin starts → track → assign winner → release → confirm on Horizon. Full real-time push (E04) and the entire dispute flow (#22, #26, #109–#112) are explicitly **out** of this increment; they don't block a payout from working, only the edge cases around it.

| Issue | Task | Assignee |
| --- | --- | --- |
| [#6](https://github.com/Astrea-Payouts/astrea/issues/6) | S02 — Go CI (build/vet/test) | Dereck |
| [#20](https://github.com/Astrea-Payouts/astrea/issues/20) | E01b contract — `cancel_event` + pre-launch withdraw | Dereck — **likely already satisfied by `set_event_cancelled`, flagged on the issue; verify before building** |
| [#4](https://github.com/Astrea-Payouts/astrea/issues/4) | E02 — contract test suite | Dereck — 78 tests already exist; only the milestone-independence criterion is unconfirmed, flagged on the issue |
| [#5](https://github.com/Astrea-Payouts/astrea/issues/5) | E03 — contract-only testnet vertical-slice demo | Dereck |
| [#25](https://github.com/Astrea-Payouts/astrea/issues/25) | Go EscrowClient — `cancel_event` + `close_event` wrapper | Dereck — wraps functions he just built |
| [#14](https://github.com/Astrea-Payouts/astrea/issues/14) | E06 — trustline verification | Dereck |
| [#8](https://github.com/Astrea-Payouts/astrea/issues/8) | S04 — env config (network, contract ID, treasury signer) | Christopher |
| [#23](https://github.com/Astrea-Payouts/astrea/issues/23) | Go EscrowClient — core tx pipeline (simulate→sign→submit→poll) | Christopher — foundational, everything else in `core-go` depends on it |
| [#24](https://github.com/Astrea-Payouts/astrea/issues/24) | Go EscrowClient — wallet balance + event creation | Christopher |
| [#10](https://github.com/Astrea-Payouts/astrea/issues/10) | E02 — build-sign-submit pipeline, OpLog | Christopher |
| [#11](https://github.com/Astrea-Payouts/astrea/issues/11) | E03 — event/prize state machine (manual-start rule) | Christopher |
| [#13](https://github.com/Astrea-Payouts/astrea/issues/13) | E05 — reconciliation | Christopher |
| [#15](https://github.com/Astrea-Payouts/astrea/issues/15) | E07 — vertical slice demo (the integration finale) | Christopher |
| [#118](https://github.com/Astrea-Payouts/astrea/issues/118) | Prepare + publish the 2026-09-15 GrantFox campaign slate | Prepared & verified — see [campaign-slate-2026-09-15.md](campaign-slate-2026-09-15.md) |

Dereck: 6 items. Christopher: 8 items, weighted up per his own request since Dereck is loaded elsewhere this month.

**Honest feasibility note:** even with the scope cut, this is 14 items across 8 calendar days for two people, several of them size-M contract/backend work. Treat 2026-09-13 as the date to *inspect* progress against, not a guarantee — if it slips, the campaign can still open on the 15th on whatever is real by then; do not quietly redefine "MVP proven" to match whatever happened to land.

### Increment 2 — Campaign window (2026-09-14 → 2026-09-30)

| Issue | Task | Status |
| --- | --- | --- |
| [#121](https://github.com/Astrea-Payouts/astrea/issues/121) | Submit the SCF interest form (Round #46) | Christopher — the lighter first step, waits for Increment 1's MVP as evidence rather than going out unprepared |
| [#22](https://github.com/Astrea-Payouts/astrea/issues/22) | E01d contract — dispute / resolve-dispute | Deferred from Increment 1, unassigned — pick up if capacity allows once Increment 1 lands |
| [#26](https://github.com/Astrea-Payouts/astrea/issues/26) | Go EscrowClient — dispute wrapper + emergency withdraw | Deferred, unassigned — blocked on #22 regardless |
| [#12](https://github.com/Astrea-Payouts/astrea/issues/12) | E04 — real-time tracking (full push, beyond Increment 1's polling) | Deferred, unassigned |

Plus whatever the campaign slate (#118) actually publishes — see [campaign-slate-2026-09-15.md](campaign-slate-2026-09-15.md) for the active September 15 slate (7 issues, 11 S-equivalents). That work belongs to contributors, not a named maintainer, per this document's own two-lane model.

**#108 (the full SCF Build Award application) has been deliberately pulled out of this Sprint entirely** — see the 2026-09-06 revision note above. It now targets a later Sprint, well ahead of the 2026-11-08 real deadline, once the interest form (#121) has actually been invited to submit and the campaign's results give the application more to point at.

**Not scheduled into this Sprint, deliberately:** #107 (L01a, threat model) — it gates the Audit Bank stage *after* an SCF award, not the application itself. #105 (deploy `services/core-go` + seed a demo event) is a strong candidate for evidence in a future SCF submission if capacity opens up, but isn't assigned to anyone yet — don't assume it'll happen without naming an owner.

## Beyond Sprint 1

Not planned in detail yet, on purpose — per the Guide, only the next Sprint gets planned in detail, at the Sprint Review of the one before it. What's already known to be waiting: the deferred items above, U02/U06/U10/U03/U04 contributor-facing UI work once a real backend exists, and K05d/e wallet work. Sprint 2 resumes the normal 15-day-per-campaign cadence.

## Backlog gaps found while writing this, now filed

Build-plan tasks that had no GitHub issue when this document was first drafted:

- ~~**S01** (monorepo scaffold / `services/core-go`)~~ → filed as #104, then **closed as a duplicate**. `services/core-go` was already scaffolded in commit `98ec2f7` on 2026-08-18, three weeks before this issue was checked for. The error: I verified there was no *open GitHub issue* for S01 and treated that as "not done" — I should have checked the actual filesystem/git history for the deliverable first. Left here as a record of the mistake, not just silently fixed.
- **L01** (deploy + seed a demo event) → [#105](https://github.com/Astrea-Payouts/astrea/issues/105), **narrowed** on the same discovery: `apps/web` is already deployed (`astrea-payouts.vercel.app`, referenced in ADR-007). Only `services/core-go`'s deployment and the seeded demo event remain open.
- **K04** (fold K03's results into ADR-005) → [#106](https://github.com/Astrea-Payouts/astrea/issues/106) — verified still needed; ADR-005 already has a preliminary note ("Freighter and Albedo confirmed so far") waiting on K03's remaining two wallets.
- **L01a**, the threat model named as missing in contracts-build-plan.md → [#107](https://github.com/Astrea-Payouts/astrea/issues/107) — verified `docs/threat-model.md` does not exist.
- **L01b**, the SCF Build Award application — the 3–6 month item gating mainnet that had no task anywhere → [#108](https://github.com/Astrea-Payouts/astrea/issues/108) — no evidence of a submission found in the repo, but this one can only be confirmed by asking directly, not by grepping files.

**The general lesson, not just about S01:** everything in this document was checked against *GitHub issues and PRs*, not against the actual state of the code and deployments. Those can and did drift apart — contracts-build-plan.md's own Audit Bank sections (#100–#103) landed on `develop` while this document was being written, and `services/core-go` existed in the tree for three weeks with no issue ever tracking it. Before trusting any "gap" this document identifies, check the filesystem and `git log`, not just the issue tracker.

Also worth noting: **the code `L01` means different things in the two build-plan docs**, and `L02` does too. build-plan.md's L01 is "deploy + seed a demo" (Milestone phase, #105); build-plan.md's L02/L03 are "security pass on the Go service" and "observability" (Phase 5 Hardening, `phase: launch`, #74/#75). contracts-build-plan.md's L01/L02 are "security audit of the *contract*" and "formal verification" (Phase 2 Hardening). This collision predates this document and was not renamed here to avoid touching the titles of already-filed issues — but anyone searching issues by a bare `L01`/`L02` code should check which build plan they mean. `L01a`/`L01b` (#107, #108) only exist in the contracts plan, so those two are unambiguous.

And #70 (T01) is no longer unsplit — see the Campaign slate rules section above.

## What to inspect at each Sprint Review

Two numbers and one question. Resist adding more.

1. **S-equivalents published vs. completed** on the campaign slate. After two campaigns this replaces every estimate in this document.
2. **Time from PR opened to first maintainer review.** This is the constraint; if it grows, cut the slate rather than asking contributors to wait.
3. **Did the Sprint Goal hold without contributor delivery?** If a missed Sprint Goal traces back to a contributor who did not finish, the Goal was drawn from the wrong lane.

Velocity is a forecasting aid for the team that produced it. It is not a target, and the moment it becomes one the honest response is to inflate it.
