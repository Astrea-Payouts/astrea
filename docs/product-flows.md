# Astrea — Product Flows

This document defines the roles, core user journeys, and the escrow lifecycle. It is the product contract the build plan implements.

## Roles

| Role | Who they are | What they can do |
| --- | --- | --- |
| **Organizer** | Hackathon host, community lead, bounty sponsor | Creates events, defines prizes, funds the escrow, manages judges |
| **Judge** | Trusted reviewer appointed by the organizer | Reviews submissions, releases prizes |
| **Participant** | Builder competing in the event | Registers wallet, submits entry, receives prize on win |
| **Dispute Resolver** | Neutral third party defined at escrow creation | Resolves disputes (e.g., absent judges, contested results) |

Escrow role mapping:

- Organizer → funder (not in the payout path — see ADR-003). No function callable by the organizer moves escrowed funds anywhere.
- Judges → the event's `judge` address, the sole `release_signer` — the contract has no separate `approver` function (see ADR-003). For a panel of multiple judges, that address is a Stellar multisig account they co-sign. Winner addresses are supplied directly at release — one judge-signed `release_reward` call pays every winner, no approval step, no intermediate custody.
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

An event cannot be created unless the organizer's free balance covers the full prize total. That's the core product guarantee, and it's exact — the winners receive precisely the announced total. The go-live fee is separate and disclosed at go-live, not here: before the organizer signs to go live (Flow 2), the UI shows the fee quoted by `quote_go_live_fee`, with a top-up step first if the free balance doesn't cover it — the same "1 of 2: deposit" → "2 of 2: go live" shape as this flow's step 5.

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

1. Judges review submissions and select winners for every prize.
2. Winner assignment re-validates each winner's wallet + trustline.
3. Judge signs **one** `release_reward` transaction for the whole event — no approve step — whose winner amounts must sum exactly to the event's locked reward. The organizer is not in this path (ADR-003).
4. **Release**: USDC lands directly in every winner's wallet in that same transaction — no intermediate custody, no second signing step.
5. Event page updates: winners, amounts, and the transaction hash (shared by every winner paid in that call), explorer link. The event goes straight from `JUDGING` to `COMPLETED` — there is no per-prize release to wait on; all prizes settle atomically together.

## Flow 5 — Dispute and fallback paths

On-chain trigger: the event's `judging_deadline` passes while it is still `InProgress` and the judge hasn't called `release_reward`. There is no separate "open a dispute" transaction — `resolve_dispute` is both the eligibility check (it asserts the deadline has already passed) and the resolution, in one resolver-signed call. **Before that deadline, a `LIVE`/`InProgress` event cannot be cancelled on-chain** — `set_event_cancelled` explicitly rejects anything past `Created`/`WaitingForStart`. The judge can still call `release_reward` before the deadline (it has no deadline check), and that is the only way a live event's funds move early. So "the organizer wants to cancel a `LIVE` event" is not a distinct on-chain path — it can only actually be resolved through the same post-deadline `resolve_dispute` call as a silent judge, not on demand.

1. Once `judging_deadline` passes with the event still `InProgress`, the product marks it `DISPUTED` off-chain (`Event.status`) so the UI stops offering the normal release flow. The contract itself has no `Disputed` state — it stays `InProgress` until `resolve_dispute` is actually called.
2. The dispute resolver reviews the situation and calls `resolve_dispute` with a winners list — same shape and exact-sum-to-`reward` validation as `release_reward`:
   - **Judge never signed:** pays whichever winner(s) were already recorded off-chain, or the resolver's own read of the submissions if none was recorded.
   - **Organizer wanted to cancel:** the resolver decides the distribution, including naming the organizer's own address as a "winner" for a refund — a full refund only if genuinely nothing happened yet, otherwise some split with participants who already invested real work. Never an automatic, unconditional refund (see ADR-006) — that would let an organizer extract free labor with no consequence.
3. `resolve_dispute` pays every recipient atomically and moves the event straight from `InProgress` to `Ended` — the same terminal transition `release_reward` makes, just resolver-signed instead of judge-signed. Resolution is recorded with its transaction hash.

Nothing on-chain stops an organizer from naming themselves as their own resolver, so resolver/organizer collusion is a real gap the contract does not close — the only mitigation is publishing the resolver's identity up front and recommending a multisig (ADR-003, ADR-006; see `docs/threat-model.md` §4.6, "not yet enforced").

This is separate from the pre-`LIVE` emergency withdraw (Flow 2, step 3): that one needs no deadline to have passed, just the resolver's sign-off on a legitimate reason, and only exists before the event goes live.

The dispute resolver must be a genuinely different person from the judge for this to work as a safety net — a judge who is also their own resolver has no one left to override them if they go silent or act in bad faith.

## Event state machine

The product's `Event.status` (Prisma) and the contract's own `EventState` (`types.rs`) don't map one-to-one — the product splits one on-chain state into two phases and can mark a status the contract itself never sets:

| Product status | Contract `EventState` | Notes |
| --- | --- | --- |
| `DRAFT` | *(nothing on-chain yet)* | Nothing exists on-chain until `create_event` confirms |
| `CREATED` | `Created` (or `WaitingForStart`) | Reward already reserved (Flow 1) — `FUNDED` is a defined product status this flow never reaches, since creating and funding are the same call |
| `LIVE` | `InProgress` | Set by `set_event_in_progress`, which also charges the go-live fee |
| `JUDGING` | `InProgress` | Same on-chain state as `LIVE` — "judging" is a product-level phase (past the submission deadline), not a separate contract state |
| `DISPUTED` | `InProgress` | The product marks this once `judging_deadline` passes with no release; the contract itself stays `InProgress` until `resolve_dispute` is actually called |
| `COMPLETED` | `Ended` | Reached via either `release_reward` or `resolve_dispute` — the same terminal transition, a different signer |
| `CANCELLED` | `Cancelled` | Reached via `set_event_cancelled` (pre-launch only) or `expire_event` (deadline passed, pre-launch only) |

```
(no deploy step) ──create_event, reward reserved at creation──▶ CREATED
CREATED ──set_event_in_progress, charges go-live fee──▶ LIVE / JUDGING (same on-chain InProgress state)
InProgress ──release_reward, every winner paid atomically──▶ COMPLETED
InProgress ──judging_deadline passes with no release──▶ DISPUTED (product-level only, contract still InProgress) ──resolve_dispute, resolver-signed──▶ COMPLETED
Pre-launch (Created/WaitingForStart) ──set_event_cancelled (automatic refund) or two-signature emergency withdraw──▶ CANCELLED
Pre-launch, deadline configured ──expire_event, permissionless refund──▶ CANCELLED
```

Prize states are off-chain only — the contract pays an event's prizes in one call and has no per-prize model (ADR-002's correction): `PENDING → ASSIGNED → RELEASED → PAID_OUT`, with `DISPUTED` reachable from `ASSIGNED` (skipping `RELEASED`, since a resolved dispute pays the winner directly) and resolving to `PAID_OUT`. There is no `APPROVED` status — the contract has no approval step, so `ASSIGNED` goes straight to `RELEASED` once the judge's (or resolver's) transaction confirms. All transitions are validated server-side; money-moving transitions require an on-chain confirmation before the mirror state advances.

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
