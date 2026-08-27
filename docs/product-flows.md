# Astrea — Product Flows

This document defines the roles, core user journeys, and the escrow lifecycle. It is the product contract the build plan implements.

## Roles

| Role | Who they are | What they can do |
| --- | --- | --- |
| **Organizer** | Hackathon host, community lead, bounty sponsor | Creates events, defines prizes, funds the escrow, manages judges |
| **Judge** | Trusted reviewer appointed by the organizer | Reviews submissions, approves and releases prizes |
| **Participant** | Builder competing in the event | Registers wallet, submits entry, receives prize on win |
| **Dispute Resolver** | Neutral third party defined at escrow creation | Resolves disputes (e.g., absent judges, contested results) |

Escrow role mapping:

- Organizer → funder (not in the payout path — see ADR-003). No function callable by the organizer moves escrowed funds anywhere.
- Judges → `approver` and `release_signer`. For a panel of multiple judges, that address is a Stellar multisig account they co-sign (see ADR-003); approval and release are two separate judge-signed transactions. The winner's address is supplied directly at release — the contract pays the winner in the same transaction the judge releases, no intermediate step.
- Winner wallet → receives the release directly from the escrow contract.
- Dispute resolver → resolves disputes, published on the event page before the event starts. Defaults to Astrea's own resolver address (recommended as a multisig, not a single key) unless the organizer names a third party at event creation.

## Flow 1 — Organizer creates an event

There's a single shared escrow contract, not one deployed per event — the organizer holds a balance inside it (`AdminWallet`) and creates events against that balance (see ADR-006). No contract deploy happens per event.

The wizard is a 5-step horizontal stepper (U01) — completed steps marked, the current one highlighted, later ones muted, and the organizer can go back to any completed step without losing what they entered later. Draft state autosaves between steps (nothing here moves money yet, so this can be fully optimistic — see the UX principles below); only the last step is money-moving.

1. **Details.** Organizer connects a Stellar wallet (Stellar Wallets Kit). Name, description, dates (registration close, submission deadline, judging deadline) — the lightest step, deliberately first.
2. **Prizes.** The organizer chooses how many positions pay out — 1st place only, up through 5th, or more — and the amount for each. There's no fixed 1st/2nd/3rd template; any organizer-chosen list of amounts becomes the event's prize list (ADR-002's corollary: ranked prizes and category prizes are the same list, just labeled differently). The running total and the organizer's current `AdminWallet` free balance are both shown live, so a shortfall surfaces here — not as a surprise on the last step.
3. **Judges & Resolver.** Judge wallet addresses + display names (with guidance toward a shared Stellar multisig if there's more than one — see ADR-003). Optionally, name a non-default dispute resolver; if left blank, Astrea's own resolver address applies, stated plainly here, not buried later.
4. **Participants.** A toggle, off by default, for whether participants answer any custom questions at registration (U17) — off means the one-click registration in Flow 3 stays exactly as-is.
5. **Review & Sign.** Full summary of every step above. Then the actual money-moving action: if the `AdminWallet` balance needs a top-up first, that's shown explicitly as its own signed step ("1 of 2: deposit" → "2 of 2: create event"), never hidden inside a single click. This step signs `create_event`, which reserves the prize total from the `AdminWallet` free balance — no separate deploy transaction, no separate fund transaction afterward, one call does both.

An event cannot be created unless the organizer's free balance covers the full prize total. That's the core product guarantee, and it's exact — no fee disclosure needed, because there isn't one to disclose.

## Flow 2 — Organizer publishes the event

1. The moment `create_event` confirms, the public event page shows a **"Prizes verified on-chain"** badge with a link to the shared contract and this event's reserved balance — funding already happened as part of creation, there's no separate `FUNDED` wait.
2. Organizer publishes (`LIVE`) once ready — participant registration opens.
3. Before `LIVE`, the organizer can still get out cleanly: `cancel_event()` for a full, automatic refund back to `AdminWallet`, or — for a partial or conditional exit — a two-signature emergency withdraw co-signed by the resolver (ADR-006). Once `LIVE`, neither exists; unwinding an event from here on requires a resolver-adjudicated dispute instead (Flow 5).

## Flow 3 — Participants join and submit

1. Participant connects wallet and registers for the event. By default this is one click — no form. If the organizer enabled custom registration questions for this event (U17), they answer those here; most events won't have any.
2. System checks the wallet has a **USDC trustline**; if missing, guides the user to create it now — not at payout time.
3. Participant submits their entry (link to repo/demo) before the deadline.
4. Submissions are visible to judges when the event closes (`JUDGING`).

## Flow 4 — Judging and payout

1. Judges review submissions and select winners per prize.
2. Winner assignment re-validates the winner wallet + trustline.
3. Judge signs two transactions per decided prize — **approve**, then **release** (winner's address supplied as an argument to `release`). The organizer is not in this path (ADR-003).
4. **Release**: USDC lands directly in the winner's wallet — the contract pays the winner in the same transaction the judge signs, no intermediate custody, no second signing step.
5. Event page updates: winner, amount, transaction hash, explorer link. When all prizes are released the event is `COMPLETED`.

## Flow 5 — Dispute and fallback paths

Triggers: a judge is unresponsive past the event's `judging_deadline`, a result is contested, or the organizer needs to cancel an event that's already `LIVE`.

1. Any involved party — organizer, judge, a participant, or an automated deadline check — opens a dispute on the affected event/milestone. The dispute resolver cannot open a dispute on their own escrow.
2. Milestone enters `DISPUTED`; the normal approve/release path (Flow 4) is bypassed for that prize.
3. The dispute resolver reviews the situation and resolves it directly:
   - **Judge never signed:** releases the prize(s) to whichever winner(s) were already recorded off-chain, or the resolver's own read of the submissions if none was recorded — the winner doesn't need the judge to do anything further.
   - **Organizer wants to cancel a `LIVE` event:** the resolver decides the distribution — a full refund only if genuinely nothing happened yet, otherwise some split with participants who already invested real work. Never an automatic, unconditional refund to the organizer (see ADR-006) — that would let an organizer extract free labor with no consequence.
4. Resolution is recorded with its transaction hash.

This is separate from the pre-`LIVE` emergency withdraw (Flow 2, step 3): that one needs no contested claim, just the resolver's sign-off on a legitimate reason, and only exists before the event goes live.

The dispute resolver must be a genuinely different person from the judge for this to work as a safety net — a judge who is also their own resolver has no one left to override them if they go silent or act in bad faith.

## Event state machine

```
(no deploy step) ──create_event, funded at creation──▶ CREATED ──publish──▶ LIVE
LIVE ──deadline──▶ JUDGING ──all prizes released──▶ COMPLETED
JUDGING ──judging_deadline passed, no release──▶ DISPUTED ──resolver releases on judge's behalf──▶ COMPLETED
LIVE ──organizer wants to cancel──▶ DISPUTED ──resolver decides distribution──▶ CANCELLED or COMPLETED
Pre-LIVE ──cancel_event (automatic refund) or two-signature emergency withdraw──▶ CANCELLED
```

Prize (milestone) states: `PENDING → ASSIGNED → APPROVED → RELEASED` with `DISPUTED` as a side-state blocking release. `RELEASED` means the winner has been paid directly and confirmed on-chain — there's no separate forwarding state to track. All transitions are validated server-side; money-moving transitions require an on-chain confirmation before the mirror state advances.

## UX principles — perceived performance

Apply these across every UI task in Phase 3, not just one flow:

- **Skeleton loaders**, not blank screens or spinners, for anything that renders real content once loaded (event pages, dashboards, lists).
- **Multi-step flows show their steps** (the event creation wizard, judging) — a visible step indicator, not a single long form or a silent chain of requests.
- **Progress indicators for a genuine network/backend wait should race to ~90% immediately, then crawl the rest of the way** while the real work finishes — this matches how fast the operation *feels*, not literally how fast it is. Never show a bar sitting at 0% while work is actually happening.
- **Optimistic UI for anything that isn't money movement:** saving a draft, updating an event's description, adding a submission link, checking off a task — show success immediately, sync in the background, roll back quietly on the rare failure. Validate inputs client-side first, so "assume it worked" is a safe bet, not a guess.
- **Never apply optimistic UI to a money-moving action.** Astrea's whole pitch is that the money is verifiably there, not just claimed to be — showing "payout sent" before the chain actually confirms it would undermine the one thing that differentiates Astrea from doing this manually (Principle 2, docs/architecture.md: the chain is the source of truth). For these, the perceived-performance technique is a well-designed, honest **pending/confirming** state, not a faked result. Client-side input validation still applies here too — catching an obviously-wrong amount, a missing trustline, or insufficient balance before ever building the transaction cuts how often someone has to sit through a failure, without ever pretending an unconfirmed transaction already succeeded.

## Non-goals for the MVP

- Mainnet operation (testnet only until the hardening phase).
- Fiat on/off ramps.
- Multi-asset prizes (USDC only).
- Automated judging or scoring.

## Future direction — per-audience frontends (deferred)

Longer-term, the plan is to split into three properties by audience — inspired by GrantFox's own structure (`grantfox.xyz` main site, `contribute.grantfox.xyz`, `maintainer.grantfox.xyz`): a marketing/docs site at the main domain (with a hero question routing the visitor as participant or organizer), plus a dedicated participant frontend and a dedicated organizer frontend, each on its own subdomain.

**Deliberately deferred, not built now.** For the MVP, all of this lives in one Next.js app with route-based sections (`/participant`, `/organizer`), not separate deployments — a 2-person team with no real users yet doesn't have the evidence to justify the operational cost of 3 deploys, 3 CI pipelines, and cross-subdomain wallet-session sharing. Revisit only once real organizer/participant usage surfaces a concrete reason route groups aren't enough (not just a branding preference).
