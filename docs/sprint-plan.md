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

> **Resolved 2026-09-24:** GrantFox's payout criteria have now been read against this DoD — see [definition-of-done.md](definition-of-done.md)'s "GrantFox payout conditions" section for the full list and what changed. One new checkbox was added (the exact `Closes #ISSUE_NUMBER` line GrantFox's own payment tracking requires); everything else GrantFox requires was either already covered or is a GrantFox-platform-side condition (contributor registration, wallet setup, campaign budget) that no repo-side checklist can enforce.

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
| [#118](https://github.com/Astrea-Payouts/astrea/issues/118) | Prepare + publish the 2026-09-15 GrantFox campaign slate | Christopher — administrative, needs GrantFox account access |

Dereck: 6 items. Christopher: 8 items, weighted up per his own request since Dereck is loaded elsewhere this month.

**Honest feasibility note:** even with the scope cut, this is 14 items across 8 calendar days for two people, several of them size-M contract/backend work. Treat 2026-09-13 as the date to *inspect* progress against, not a guarantee — if it slips, the campaign can still open on the 15th on whatever is real by then; do not quietly redefine "MVP proven" to match whatever happened to land.

### Increment 2 — Campaign window (2026-09-14 → 2026-09-30)

| Issue | Task | Status |
| --- | --- | --- |
| [#121](https://github.com/Astrea-Payouts/astrea/issues/121) | Submit the SCF interest form (Round #46) | Christopher — the lighter first step, waits for Increment 1's MVP as evidence rather than going out unprepared |
| [#22](https://github.com/Astrea-Payouts/astrea/issues/22) | E01d contract — dispute / resolve-dispute | Done — `resolve_dispute` merged to develop |
| [#26](https://github.com/Astrea-Payouts/astrea/issues/26) | Go EscrowClient — dispute wrapper + emergency withdraw | Done — see `services/core-go/README.md` |
| [#12](https://github.com/Astrea-Payouts/astrea/issues/12) | E04 — real-time tracking (full push, beyond Increment 1's polling) | Deferred, unassigned |

Plus whatever the campaign slate (#118) actually publishes — that work belongs to contributors, not a named maintainer, per this document's own two-lane model.

**#108 (the full SCF Build Award application) has been deliberately pulled out of this Sprint entirely** — see the 2026-09-06 revision note above. It now targets a later Sprint, well ahead of the 2026-11-08 real deadline, once the interest form (#121) has actually been invited to submit and the campaign's results give the application more to point at.

**Not scheduled into this Sprint, deliberately:** #107 (L01a, threat model) — it gates the Audit Bank stage *after* an SCF award, not the application itself. #105 (deploy `services/core-go` + seed a demo event) is a strong candidate for evidence in a future SCF submission if capacity opens up, but isn't assigned to anyone yet — don't assume it'll happen without naming an owner.

## Sprint 1 Review — pre-review as of 2026-09-24

**This is a pre-review, not the Sprint Review.** Sprint 1 ends 2026-09-30; everything below is drawn from `gh` and `git log` on 2026-09-24, six days early, so the maintainer lane's three still-open issues (#10, #13, #14) and the campaign's contributor pipeline both have runway left. Re-run this section at the real Sprint Review and replace the numbers rather than layering a second set on top — `TODO(Lamberti): refresh every figure below on 2026-09-30`.

### Increment 1 — MVP proven (2026-09-06 → 2026-09-13)

| Issue | Task | Status | Evidence |
| --- | --- | --- | --- |
| [#6](https://github.com/Astrea-Payouts/astrea/issues/6) | S02 — Go CI | Done | Closed 2026-09-08, same day PR #153 ("ci: add build/vet/test job for services/core-go") merged. Not GitHub-linked (no `Closes #6` in the PR), so this is a same-day correlation, not an auto-close. |
| [#20](https://github.com/Astrea-Payouts/astrea/issues/20) | E01b contract — cancel/withdraw | Done | GitHub-linked to PR #171. |
| [#4](https://github.com/Astrea-Payouts/astrea/issues/4) | E02 — contract test suite | Done | Closed 2026-09-09, same day PR #165 ("test(event-escrow): cover unauthorized-caller paths") merged; PR #155 the day before covers the same E02 scope. Not GitHub-linked. |
| [#5](https://github.com/Astrea-Payouts/astrea/issues/5) | E03 — contract-only vertical slice | Done | GitHub-linked to PR #151. |
| [#25](https://github.com/Astrea-Payouts/astrea/issues/25) | Go EscrowClient — cancel/close wrapper | Done | GitHub-linked to PR #177. |
| [#14](https://github.com/Astrea-Payouts/astrea/issues/14) | E06 — trustline verification | **Open** | No closing PR. |
| [#8](https://github.com/Astrea-Payouts/astrea/issues/8) | S04 — env config | Done | GitHub-linked to PR #180. |
| [#23](https://github.com/Astrea-Payouts/astrea/issues/23) | Go EscrowClient — core tx pipeline | Done | GitHub-linked to PR #156. |
| [#24](https://github.com/Astrea-Payouts/astrea/issues/24) | Go EscrowClient — wallet balance + event creation | Done | GitHub-linked to PR #166. |
| [#10](https://github.com/Astrea-Payouts/astrea/issues/10) | E02 — Go build-sign-submit pipeline, OpLog | **Open** | No closing PR. |
| [#11](https://github.com/Astrea-Payouts/astrea/issues/11) | E03 — event/prize state machine | Done | Closed 2026-09-17, coincides with PR #205 ("organizer path PR 2 — go-live", merged 09-15) and the PR #196/#197/#204 series. Not GitHub-linked. |
| [#13](https://github.com/Astrea-Payouts/astrea/issues/13) | E05 — reconciliation | **Open** | No closing PR. |
| [#15](https://github.com/Astrea-Payouts/astrea/issues/15) | E07 — vertical slice demo | Done | Closed 2026-09-17, coincides with PR #207 ("vertical slice PR B2", merged 09-16) and PR #197/#204. Not GitHub-linked. |
| [#118](https://github.com/Astrea-Payouts/astrea/issues/118) | Prepare + publish the 2026-09-15 campaign slate | Closed, **but unverified** | Closed 2026-09-20 with zero comments and no linked PR — nothing in the issue records which issues were actually published to a live GrantFox campaign. See the Sprint Goal verdict below; this is the load-bearing uncertainty in this whole review. |

10 of 14 done by evidence, 3 genuinely open (#10, #13, #14), 1 closed on the tracker but not verifiable as actually completed (#118). Worth flagging on its own: #15 (E07, "the whole money path through the app on testnet") is marked done while #10, #13 and #14 — three items its own scope list depends on for anything beyond the happy path — are still open. Either #15's actual demo didn't need OpLog/reconciliation/trustline-checking to work once, or the closure was premature. `TODO(Lamberti): confirm which of the two it was before calling Increment 1 done.`

### Increment 2 — Campaign window (2026-09-14 → 2026-09-30)

| Issue | Task | Status | Evidence |
| --- | --- | --- | --- |
| [#121](https://github.com/Astrea-Payouts/astrea/issues/121) | Submit the SCF interest form (Round #46) | **Open** | Assigned to Christopher, zero comments as of 2026-09-24 — not yet submitted. |
| [#22](https://github.com/Astrea-Payouts/astrea/issues/22) | E01d contract — dispute/resolve-dispute | Done | PR #178 ("add resolver-signed resolve_dispute after judging deadline") merged 2026-09-13. The PR never used a closing keyword; closed by hand 2026-09-24. |
| [#26](https://github.com/Astrea-Payouts/astrea/issues/26) | Go EscrowClient — dispute wrapper + emergency withdraw | Done | PR #182 ("resolve_dispute, two-signature emergency_withdraw, go-live transitions") merged 2026-09-14. Same missing closing keyword as #22; closed by hand 2026-09-24. |
| [#12](https://github.com/Astrea-Payouts/astrea/issues/12) | E04 — real-time tracking | Open | Deferred as planned, not a gap. |

**#22 and #26 are the same "check the code, not the tracker" mistake this document already documented for S01** (see "Backlog gaps" below). Both were closed by hand on 2026-09-24, linking PR #178 and #182.

### Was the Sprint Goal met?

*"Prove the MVP's happy-path payout loop end-to-end on testnet, and open the 2026-09-15 campaign on top of it."* Two halves, two different answers:

- **The payout loop:** substantially yes, with the #10/#13/#14 caveat above. The core create → fund → register → start → track → assign → release → confirm path has closed issues and merged PRs behind every step except reconciliation, trustline verification, and the OpLog-backed submit pipeline — none of which block a payout from completing once, all three the kind of thing that block it from completing *reliably*.
- **Opening the campaign:** **not verifiably true, and the evidence leans toward "no."** No `grantfox-campaign*` or similar label exists anywhere in the repo (`gh label list --search grantfox` returns only the unrelated `phase: launch` label). Issue #118, the administrative "prepare and publish" task, closed with no comments and no linked PR. Most directly: on 2026-09-16 and 2026-09-17 — *after* the campaign was supposed to be live — Christopher told three separate contributors (#200, #203, #211) "we are not yet offering rewards for this issue. We are going to try entering the GrantFox programme... get rewarded once Astrea is accepted." `docs/business/competitive-analysis.md` (already committed) independently lists Astrea's GrantFox listing status as "Not published." Taken together, this reads as: the *issues* were likely published on GitHub as a slate, but Astrea itself had not been accepted onto GrantFox as a paying project, so no campaign went live in the sense the Sprint Goal meant — contributors could work, but not be paid through GrantFox. Christopher confirmed on 2026-09-24 that Astrea's acceptance on GrantFox is still pending.

**Honest verdict: partially met.** The maintainer-lane half of the Sprint Goal (the payout loop) is close to true. The campaign half was not met: Astrea is not yet an accepted GrantFox project, so no paid campaign could go live by the 09-15 target, whatever administrative prep happened around it.

### The three inspection metrics

1. **S-equivalents published vs. completed for the 2026-09-15 campaign slate: not applicable this Sprint.** GrantFox acceptance is still pending (see above), so no paid campaign existed to measure. #118 also records no list of the issues published on GitHub, which is worth fixing before the next slate so this metric can be computed at all.
2. **Time from contributor PR opened to first maintainer review: median 3.97 hours, worst 44.17 hours.** Computed from all 36 contributor PRs opened this Sprint (`gh pr view --json createdAt,reviews,comments` per PR); every one of the 36 got a maintainer response of some kind (review or comment), so the metric is "how fast," not "whether." The worst case, PR #149 (bilhokista, opened 2026-09-06, first response 44.17h later), sits inside a burst of ~17 same-day PRs from one contributor, of which only 3 (#139, #141, #149) were eventually merged — the median is a better read on ordinary contributor experience than the worst case, which reflects a review-queue spike rather than typical neglect.
3. **Did the Sprint Goal hold without contributor delivery? Yes, on the maintainer lane's own terms.** None of the Increment 1 or Increment 2 work depended on contributor delivery: the items that shipped were maintainer-lane work, #12 (E04) was deferred and is still unassigned, and the #10/#13/#14 gaps and the #118 uncertainty are maintainer-side, not a case of the Goal depending on contributor work that didn't land. That is the intended design (see "Two lanes" above) and it held.

### What to update in the capacity hypotheses

- The 8-S-equivalents-per-campaign baseline (from the 2026-08-21 → 2026-09-02 window) still cannot be extended to a second data point, because there was no second paid campaign (see metric 1). Keep treating 8 as the only real number until GrantFox's acceptance status is resolved.
- The PR-review-time number (median 3.97h) is a genuinely new, good data point: the "one maintainer's review capacity" constraint the capacity section already names as binding is currently being met comfortably, not strained — no evidence yet that it needs the slate cut down from the stated 10–14 range.
- Add a new hypothesis this Sprint surfaced: **closed-on-GitHub is not evidence of done, and done is not evidence of published.** Sprint 1 produced two independent instances of the same failure mode in two different directions — #22/#26 closed-in-spirit-but-open-on-GitHub, and #118 closed-on-GitHub-but-not-verifiably-done. Both should be checked by hand at every future Sprint Review, not assumed from issue state.

## Beyond Sprint 1

Not planned in detail yet, on purpose — per the Guide, only the next Sprint gets planned in detail, at the Sprint Review of the one before it. What's already known to be waiting: the deferred items above, U02/U06/U10/U03/U04 contributor-facing UI work once a real backend exists, and K05d/e wallet work. Sprint 2 resumes the normal 15-day-per-campaign cadence.

## Sprint 2 — 2026-10-01 to 2026-10-15 (proposed — PO to confirm)

The 15-day-per-campaign cadence resumes here, per the Cadence section above. **Next campaign open date: `TODO(Lamberti)` — not findable via `gh`.** No open issue or PR references a specific date for the campaign after 2026-09-15 (`gh issue list --search "campaign in:body"` returns only #118); the date depends on GrantFox accepting Astrea as a project, still pending as of 2026-09-24.

### Proposed Sprint Goal

> **Get Astrea's SCF Build Award (#46) interest form submitted and, once invited, the full application in progress — using the shipped MVP and whatever the 2026-09-15 campaign actually produced as evidence.**

**Why this and not a UI or business-validation goal:** the real SCF Build Submission deadline is 2026-11-08 ([SCF #46](https://communityfund.stellar.org/awards/recxrSMYwAl8vcglg)) — four weeks past this Sprint's end, which is close enough that a Sprint spent elsewhere leaves one 15-day Sprint of margin, not two. #121 (the interest form) has been assigned to Christopher since 2026-09-06 and is still open with zero comments as of this writing — it is the lightest, most overdue maintainer-lane item with a hard external date attached, and per this document's own Product Goal ("ready to enter the SCF → Audit Bank chain"), it is the longest-lead item in the entire plan. A UI or standing-demo goal (#105, #12) is real work but has no external deadline forcing it into this specific Sprint; a customer-validation goal (see below) is worth doing but is exploratory, not achievable-and-checkable the way a Scrum Goal should be.

Other candidates considered and why they were not chosen as the Goal itself (they remain in the maintainer-lane table below):

- **#105 — deploy `services/core-go` and seed a standing demo event.** Strong *evidence* for the eventual SCF application, but a demo deployment is not itself the Goal; it is a task that serves it.
- **Docs synced with the shipped contract.** README, architecture, product flows and the stale L01a checkbox in `docs/contracts-build-plan.md` are handled in PR #243. A correction, not a Sprint Goal.
- **Validating the fee and dispute-resolver model with real organizer interviews.** The kit is in PR #244 (`docs/business/customer-interviews.md`, BRL 5). It sits outside the GitHub-sourced maintainer lane this document tracks and is exploratory rather than a Sprint-checkable Increment, so it runs alongside the Goal, not as it.

### Maintainer lane

| Issue / task | Proposed assignee | Reasoning |
| --- | --- | --- |
| [#121](https://github.com/Astrea-Payouts/astrea/issues/121) — submit SCF interest form | Christopher | Already assigned to him since 2026-09-06; blocks the Sprint Goal; carries over from Sprint 1 where it did not get done. |
| [#108](https://github.com/Astrea-Payouts/astrea/issues/108) — full SCF Build Award application | Christopher | Follows #121 directly; per the 2026-09-06 revision note, this was deliberately pulled out of Sprint 1 for exactly this later Sprint. Only starts once #121 gets a response. |
| [#105](https://github.com/Astrea-Payouts/astrea/issues/105) — deploy `services/core-go`, seed a standing demo event | Christopher | His recent commit history is deploy/infra-heavy (`fix(core-go): use pgx exec mode instead of describe_exec behind the pooler`, `fix(core-go): correct the pgbouncer boot error's remedy`, the site-url fallback fix) — he already owns this surface. Its own dependency (#15) is closed. |
| Follow up on GrantFox project acceptance (pending as of 2026-09-24) and get the next campaign date | Christopher | He holds the GrantFox relationship (per the #200/#203/#211 comment thread); this gates whether a campaign slate can be published at all this Sprint. |

### Proposed campaign slate — proposed, PO to confirm

**Publishing this slate waits on GrantFox accepting Astrea** — publishing issues to a campaign that cannot yet pay out repeats Sprint 1's #118 problem. Candidates below are open, unassigned, and dependency-verified against actual merged code (not just issue state), per the campaign slate rules:

| Issue | Task | Size | S-eq | Prerequisite, verified |
| --- | --- | --- | --- | --- |
| [#206](https://github.com/Astrea-Payouts/astrea/issues/206) | E11 — `op_log` FAILED-write-can't-overwrite-SUCCEEDED guard | S | 1 | Depends on #205, merged 2026-09-15. |
| [#201](https://github.com/Astrea-Payouts/astrea/issues/201) | U19 — public participation card (SVG) | S | 1 | Depends on #200, closed (merged, Rodrigoue9). |
| [#109](https://github.com/Astrea-Payouts/astrea/issues/109) | T01a — dispute deadline-check job | S | 1 | Depends on #22/#26, both closed (PR #178, #182). |
| [#18](https://github.com/Astrea-Payouts/astrea/issues/18) | K03 — wallet compat: xBull, LOBSTR | S | 1 | No dependency; harness already built. |
| [#37](https://github.com/Astrea-Payouts/astrea/issues/37) | K05a — wallet compat: Rabet, Hana, Klever | S | 1 | No dependency. Only one of #37–#40 included — see slate rule 4; #38–#40 held back to keep the slate varied. |
| [#12](https://github.com/Astrea-Payouts/astrea/issues/12) | E04 — real-time tracking | M | 3 | Depends on #7 and #11, both closed. |
| [#168](https://github.com/Astrea-Payouts/astrea/issues/168) | E08 — off-chain prize breakdown, persistence + Go enforcement | M | 3 | Depends on #24/#25, both closed. **Data gap found while building this slate: the issue body states `Size: M` but has no `size:` label on GitHub, so it was invisible to a label-based search — add the label before publishing.** Money-path (`security` label, testnet tx required at review). |

**11 S-equivalents across 7 issues** — inside the 10–14 range and the "typically 6–8 issues" guidance, and spread across `escrow-core` (3, counting #168 by its E08 task code since it has no phase label either), `product-ui` (1), `trust-edge-cases` (1) and wallet-compat `spike` (2: #18 and #37) rather than repeating Sprint 1's near-identical-wallet-issues problem.

Left out despite being open and unassigned: #202, #193, #106, #58, #75, #74, #110–#112 (each has at least one unbuilt dependency — #66, #62, #65, #54, #13, #74 itself, or the T01b/T01a chain); #44 (U16 i18n QA) explicitly states in its own body it's best picked up once more Phase 3 UI work has landed, which it largely hasn't yet.

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

**Found while writing the 2026-09-24 Sprint 1 Review and Sprint 2 plan:**

- **#22 and #26 are the S01 mistake again, in the opposite direction.** Both were merged in code (PR #178, #182) but stayed open on GitHub because neither PR used a closing keyword — closed-in-code is not the same failure as S01's closed-in-tracker-but-not-in-code, but it's the same root cause: trusting one signal (tracker state) over the other (actual merged code). Both closed by hand on 2026-09-24.
- **#168 (E08) has `Size: M` written into its own issue body but no `size:` label on GitHub**, so it does not show up in any label-based query for sizing or slate-building — it was only found by reading unsized open issues individually. Worth a pass over open issues checking body-stated size against the actual label, since a slate built by label search alone would silently skip it.

## What to inspect at each Sprint Review

Two numbers and one question. Resist adding more.

1. **S-equivalents published vs. completed** on the campaign slate. After two campaigns this replaces every estimate in this document.
2. **Time from PR opened to first maintainer review.** This is the constraint; if it grows, cut the slate rather than asking contributors to wait.
3. **Did the Sprint Goal hold without contributor delivery?** If a missed Sprint Goal traces back to a contributor who did not finish, the Goal was drawn from the wrong lane.

Velocity is a forecasting aid for the team that produced it. It is not a target, and the moment it becomes one the honest response is to inflate it.
