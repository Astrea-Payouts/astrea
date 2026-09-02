# Astrea — Architecture

## Principles

1. **Non-custodial, always.** The server never touches private keys. Every money-moving operation follows: backend builds unsigned XDR → the owning role signs in their wallet → backend submits.
2. **The chain is the source of truth.** The database mirrors escrow state for UX and querying; a reconciliation job corrects drift by checking transaction hashes directly against Horizon. No money-related state is marked final without an on-chain confirmation.
3. **Escrow behind a client interface.** Backend code depends on an `EscrowClient` interface, not on raw contract calls scattered through the codebase — this keeps contract-calling logic testable and mockable without hitting testnet on every test run.
4. **Idempotent money operations.** Every escrow operation carries an idempotency key; retries are safe; partial failures (tx confirmed, DB write failed) are healed by reconciliation, never by manual fixes.
5. **Testnet by default.** Network and contract ID are environment configuration. Mainnet is a deliberate, gated change.

## System overview

- **Frontend** — Next.js App Router (`apps/web`), TypeScript strict, Tailwind + shadcn/ui. Wallet connectivity through Stellar Wallets Kit. Signs XDR client-side. Renders public event pages (SSR for shareability/SEO — see build-plan.md U09/U10).
- **Backend** — Go service (`services/core-go`). Owns the event/prize state machine, participant registration, real-time tracking, the build-sign-submit transaction pipeline, and reconciliation. The only service that writes transactional state or calls the escrow contract.
- **Database** — Postgres. Mirror tables for events, prizes, participants, wallets, payouts, and an append-only op log for idempotency/auditability.
- **Escrow layer** — a single custom Soroban smart contract (`smart-contracts/astrea/contracts/event-escrow`) shared across all organizers, not one instance deployed per event (see ADR-006). Each organizer holds a balance inside the contract (`AdminWallet`); they deposit into it, then create events against it. Functions: `deposit_funds`, `withdraw_funds`, `create_event`, `cancel_event`, `close_event` (pays one or more winners in a single call — see ADR-002), `dispute`, `resolve_dispute`. The winner's address is supplied at `close_event` time, not fixed when the event is funded — release pays the winner directly, with no separate forwarding step.

  > **Design name → implemented name.** The ADRs below use the conceptual names above; the contract as built uses different ones. Current mapping: `close_event` → `release_reward`, `cancel_event` → `set_event_cancelled` (pre-launch states only — cancelling a live event is rejected, see ADR-006), `dispute`/`resolve_dispute` → **not implemented yet** (issue #22). The contract also has functions the ADRs don't describe: `expire_event` (deadline passed with nothing happening — refund), `release_compensation` (pay participants after a cancellation), the state machine (`set_event_waiting_for_start` / `set_event_in_progress`), event pagination, and a governance layer (emergency pause, per-admin pause, token whitelist).

## Domain model (Postgres sketch)

```
Event       — id, organizerId, name, dates, status, escrowContractId, network, conditionsMetAt
Prize       — id, eventId, rank, amountUsdc, milestoneIndex, status, winnerWalletId, releaseTxHash
Judge       — id, eventId, walletAddress, displayName, status
Participant — id, eventId, walletId, submissionUrl, registeredAt
Wallet      — id, userId, address, usdcTrustlineVerifiedAt
Payout      — id, prizeId, txHash, amountUsdc, confirmedAt        (append-only audit log)
OpLog       — id, idempotencyKey, operation, payload, status      (idempotency + outbox)
```

## Key sequences

### Deploy + fund (organizer)

```
UI → Go service: create event (validated)
Go service: builds unsigned deploy tx (contract `initialize`, simulated for footprint/fee)
UI: organizer signs (wallet) → Go service submits → RPC confirms → contractId recorded
Go service: builds unsigned fund tx (`fund`)
UI: organizer signs → Go service submits → RPC confirms
reconciler: confirms escrow balance == prize amount → Event.FUNDED
```

### Release (judge approves, then releases directly to the winner)

Two signed transactions, both by the judge (`approver` + `release_signer`, see ADR-003) — no forwarding step, the winner's address is supplied at release time:

```
judge assigns winner → backend validates winner trustline
Go service: builds unsigned `approve` tx
judge signs → Go service submits → RPC confirms
Go service: builds unsigned `release` tx, winner's address as an argument
judge signs → Go service submits → RPC confirms
reconciler: confirms release tx → Prize.PAID_OUT + Payout row (releaseTxHash)
```

### Reconciliation loop

Periodic job (and on-demand after each submit): for each `SUCCEEDED` `OpLog` row, confirms its `txHash` directly against Horizon rather than trusting any cached state — the chain is the source of truth (Principle 2). Release is a single confirmed transaction per prize; there's no separate forwarding step to track.

## Architecture Decision Records

### ADR-001 — Custom Soroban escrow contract, no third-party provider

**Decision:** Astrea's escrow is a smart contract Astrea owns and audits (`smart-contracts/astrea/contracts/event-escrow`, Rust/Soroban), not a third-party escrow API.

**Why:**
1. The winner's address is supplied at `release` time, not fixed when the escrow is funded — release pays the winner directly, with no separate forwarding transaction and no custody window.
2. No third-party protocol fee on releases — the only fee, if any, is Astrea's own, visible in the contract's own logic rather than an external deduction.
3. Real-time tracking and other product-specific logic are built directly against the contract via an owned backend service, not constrained by a generic escrow API's feature set.
4. No dependency on a third party's uptime, pricing, or API stability for the money-critical path.

**Trade-off:** owning the contract means owning its audit burden — there's no third-party liability backstop. Mitigated by validating the design on testnet before building production code on top of it, and a dedicated security review before mainnet (see [docs/contracts-build-plan.md](contracts-build-plan.md)).

**Verified (K01, 2026-08-06, testnet):** judge as both `approver` and `release_signer` works; the organizer has no function that moves escrowed funds anywhere (confirmed by a rejected direct-release attempt); the winner's address is supplied at `release` time. Contract `CBFPD4YFURBDQ3MQ7EMT3HPP2K34W5H6QCVWGCEP43MPHFO5XG5ONCUG` — see [spikes/k01-soroban-escrow](../spikes/k01-soroban-escrow/README.md).

**Verified (K02, 2026-08-06, testnet):** a Go service, not a CLI, can build, simulate, sign, and submit every transaction against the contract end to end, using the Stellar Go SDK directly — see [spikes/k02-go-soroban](../spikes/k02-go-soroban/README.md).

### ADR-002 — Multi-release escrow, one milestone per prize

**Decision:** each event can carry more than one prize (a list of milestones on the `Event`, not a single fixed amount), and each prize is independently payable — a single-winner event is simply the N=1 case of this list, not a separate code path.
**Why:** prizes resolve at different times or in different shapes (judging per category, a dispute on one prize must not block another). A list-of-prizes model maps 1:1 to this reality without a special case for "just one winner."
**Status:** target design for the production contract (`E01`, [docs/contracts-build-plan.md](contracts-build-plan.md)), implemented as a list of prizes on a single `Event` record inside the shared contract (ADR-006), not as a separate contract per multi-winner event. K01 validated the role model on a single-milestone contract.

**Verified (K06, 2026-08, in-process test):** a single `close_event()` call paying multiple winners scales linearly at ~168k CPU instructions per additional winner — ~1.2% of Stellar Mainnet's per-invocation instruction budget even at 25 winners in one call, far more than any realistic event needs. No separate contract is warranted for the multi-winner case. See [spikes/k06-multi-release-budget](../spikes/k06-multi-release-budget/README.md).

**Corollary:** "ranked prizes" (1st/2nd/3rd, or organizer-chosen up to N positions) and "prizes by category" are the same mechanism, not two contract paths — both are just a list of amounts with an off-chain label (`Prize.rank` in the Postgres sketch above) attached to each entry. The organizer choosing how many ranked positions pay out, and how much each pays, needs no new contract capability — it's the existing prize list at a different length.

### ADR-003 — Organizer is not in the payout path

**Decision:** the judge holds both the `approver` and `release_signer` addresses on the escrow. The organizer's address appears nowhere in the payout path — no function callable by the organizer can move escrowed funds anywhere.
**Why:** if the organizer had to co-sign releases, an absent or hostile organizer could strand approved winners — which would make any "the funds are locked and will pay out" claim dishonest. Removing them from the release path is what turns the locked funds into a credible promise.
**Residual trust:** judges (can go silent or collude) and the dispute resolver (a designated party). Both are mitigated by transparency: judges and resolver are published on the event page before the event starts, and judging deadlines trigger the dispute path.

**Resolver identity:** by default, Astrea's own team acts as resolver — recommended as a multisig, not a single key, given the power this role has (see ADR-006). An organizer may name their own third-party resolver instead at event creation. Whichever applies is published on the event page before the event starts, so participants know who backstops it before they commit their time.

**Judge picks a winner but never signs the release:** every event carries a `judging_deadline`. If it passes without a completed `close_event`, anyone (organizer, a participant, or an automated trigger) can open a dispute, and the resolver can execute the release on the judge's behalf — using whatever winner was already recorded off-chain, or its own review of submissions if none was recorded. This is the same resolver role as above, just triggered by a deadline instead of an open conflict between parties.

**Multi-judge panels:** the contract takes a single `approver`/`release_signer` address — for a panel of multiple human judges, that address should be a Stellar multisig account with each judge as a signer and a threshold (e.g. 2-of-3), giving genuine multi-judge approval with no contract changes needed. Deferred to Phase 3 (`U05`).

**Verified (K01/K02, 2026-08-06, testnet):** an organizer-signed direct release attempt was rejected — at the client signing-key level in K01, and rejected on-chain by the contract's own `require_auth` check in K02, confirming the guarantee is structural, not a client-side convention.

### ADR-004 — Trustline validation at registration, not payout

**Decision:** USDC trustline is checked when a participant registers and re-checked at winner assignment.
**Why:** discovering a missing trustline at payout time is the worst possible UX and blocks the release flow.

### ADR-005 — Wallet connection sets a UX session, not an authorization boundary

**Decision:** connecting a wallet via Stellar Wallets Kit (`@creit.tech/stellar-wallets-kit`) triggers a server action that finds-or-creates a `User`/`Wallet` row and sets an httpOnly cookie pointing at the `Wallet.id`. This cookie is read to know "who's browsing as which wallet" for UX purposes (pre-filling forms, showing "your events").
**Why not more (yet):** the cookie is set from a client-asserted address with no cryptographic challenge (no "sign this nonce to prove you hold the key" step). That's a deliberate scope cut, not an oversight — because **no money-moving action ever trusts this cookie**. Every escrow operation is independently authorized by an actual on-chain signature, verified by the contract itself. The session is a convenience for reads, never a check for writes that matter.
**Failure mode this avoids:** if the DB/session write fails, the client-side wallet connection still succeeds — session-association failures are caught and logged, never allowed to undo a real wallet connection the user just approved in their extension.
**Revisit when:** if a future feature needs to trust "this browser really controls address X" for something other than display, upgrade to a signed challenge-response ("Sign-In With Stellar," SEP-0043's `signMessage`) rather than trusting the cookie alone.

**Triggered (S07):** participant-facing features that persist across sessions and devices — earnings history, a persistent "my events" list, notification email — need a verified identity, not just a client-asserted address. Sign-In With Stellar (SEP-0043 `signMessage`) replaces the unverified cookie with a signed challenge-response, with an optional email field attached to the verified `Wallet` for notifications (T03). This is additive, not a reversal: money-moving actions still never trust this session — every escrow operation still requires its own on-chain signature, verified by the contract.

**Verified:** wallet kit initializes client-side only (guarded against SSR execution); connect modal renders all four target wallets (Freighter, Albedo, xBull, LOBSTR) with no console errors. Signing against the escrow contract itself is verified per-wallet in K03 ([docs/build-plan.md](build-plan.md)) — Freighter and Albedo confirmed so far.

### ADR-006 — Shared per-organizer ledger, not one contract instance per event

**Decision:** a single deployed `EventEscrow` contract holds a per-organizer balance (`AdminWallet`, keyed by the organizer's address) instead of a fresh contract instance being deployed for every event. The organizer deposits into their own `AdminWallet` first (`deposit_funds`); creating an event (`create_event`) reserves part of that balance as the event's reward(s).

**Why:** deploying a new contract instance per event means a deploy transaction on top of the fund transaction, for every single event. A shared contract with per-organizer accounting removes the deploy step entirely — an organizer who runs many events funds once and creates events against that balance repeatedly.

**What doesn't change:** ADR-001 (custom contract, no third party) and ADR-003 (organizer excluded from the payout path) still hold. `AdminWallet.balance` and an `Event`'s reward(s) are separate ledger entries inside the same contract — once `create_event` moves an amount out of the wallet's free balance and into an event, that amount is no longer withdrawable as free balance.

**Rules this introduces:**

1. **`withdraw_funds()` only touches `AdminWallet`'s free balance**, enforced with an explicit assert, not left as an assumption. It can never reach funds already assigned to a created `Event` — with one deliberate exception, below.
2. **Pre-launch emergency override.** Before an event reaches `Active` state, the organizer can request an early exit on funds already assigned to that event, but it requires **two signatures**: the organizer's (requesting it) and the resolver's (approving it, based on an off-chain-reviewed justification). Neither party can do this alone, and it is never possible once the event is `Active`.
3. **`cancel_event()` is a simple refund only pre-launch.** While the event hasn't reached `Active`, cancelling returns its reward(s) to `AdminWallet`'s free balance automatically, in the same call. Once `Active`, cancellation is not a bare refund — it routes through `resolve_dispute` instead (ADR-003), because participants may have already invested real work by then, and an unconditional refund to the organizer would let them extract free labor with no consequence.

### ADR-007 — Notifications via Resend, not Nodemailer

**Decision:** email notifications (T03) go through [Resend](https://resend.com)'s HTTP API, called directly from `services/core-go` (the service that already owns every state change that triggers a notification). Not Nodemailer — Nodemailer is an SMTP client for Node.js, and would force Go to call back into `apps/web` just to send an email, an extra hop with no benefit.

**Domain dependency:** sending to arbitrary recipients requires a verified custom domain (SPF/DKIM/DMARC) — Astrea currently only has the Vercel-assigned subdomain (`astrea-payouts.vercel.app`), not a domain it owns. Buying and verifying one is cheap and has no engineering dependency, so it should happen whenever convenient, not be discovered as a blocker the day T03 is picked up.

**Testing strategy:**
- **Unit:** mock the Resend client, same pattern as the Trustless Work/Horizon mocks elsewhere in the codebase — assert the right notification fires with the right data, never hit the real API.
- **Manual:** Resend's sandbox sender (`onboarding@resend.dev`) works without any domain and can send to the account owner's own verified address — enough to eyeball real templates before a custom domain exists.
- **Production:** requires the verified custom domain above.

**Volume/reputation notes (why this isn't "just send an email"):**
- Resend's free tier has real daily/monthly caps — check current numbers before assuming headroom (they change; this is exactly the kind of fact to verify with `search_docs` or Resend's own pricing page at implementation time, not to hardcode from a conversation).
- High-volume, low-engagement sends (e.g. an email per registration milestone with no cap) can hurt sending-domain reputation over time — see the milestone-notification note below.
- Fan-out sends (notifying every registered participant an event is starting soon) should use Resend's batch-send endpoint and go through the same idempotent-operation/outbox pattern (`OpLog`) as money-moving operations, not a naive loop of one API call per recipient — a partial failure shouldn't silently lose notifications, and a retry shouldn't double-send them either.

**Full trigger list:**

| Audience | Trigger |
| --- | --- |
| Participant | Registration confirmed |
| Participant | Trustline missing/invalid at registration (ADR-004) — fix-it nudge |
| Participant | Event starting soon (T-minus reminder) |
| Participant | Submission deadline approaching |
| Participant | Event cancelled |
| Participant | Winner(s) announced (sent to all registrants, not just winners) |
| Participant (winner) | Payout sent, with the transaction hash / explorer link |
| Organizer | Escrow funded / event ready to start (`conditionsMetAt` set) |
| Organizer | Registration milestones (see decay rule below) |
| Organizer | A team/participant submitted (also sent to the judge) |
| Organizer | Event starting soon |
| Organizer | Judging deadline approaching — sent *before* it passes, specifically to reduce how often the resolver fallback actually has to fire |
| Organizer | Event closed / payout completed |
| Organizer | A dispute was opened on their event |
| Judge | Assigned as judge for an event |
| Judge | A submission came in |
| Judge | Judging deadline approaching |
| Judge | Event starting soon |
| Resolver | Assigned as resolver for an event (non-default resolver case) |
| Resolver | Action needed — dispute opened (judge never signed, cancel-after-launch, or a pre-launch emergency-withdraw request) |
| Resolver | Event starting soon |
| Resolver | Dispute resolved — outcome confirmation |
| Astrea (internal) | A support request came in from a participant, organizer, or external resolver |
| Astrea (internal) | Astrea is acting as the default resolver and needs to act — same case as "Resolver: action needed" above, routed to an internal channel (Telegram/Slack) instead of a personal inbox |

**Registration-milestone decay rule:** the interval between organizer milestone notifications grows by 10 each time (10, 20, 30, 40, ...), so notifications fire at the triangular-number counts 10, 30, 60, 100, 150, 210, 280, 360, ... This was chosen over two alternatives: a fixed staircase (every 10 up to 100, then every 50, then every 100) needs arbitrary thresholds that would eventually need revisiting as events grow past whatever ceiling was picked; a multiplicative decay (interval ×1.5 each time — 10, 25, 48, 87, ...) tapers too fast for the realistic scale of Astrea's events (tens to low hundreds of participants), making notifications feel like they stop right when an event is getting interesting. The additive-growth rule needs no threshold ever, self-scales to any event size, and stays gentle enough that it never needs a hard cap.

## Security notes

- Contract treasury/signer key handling: never in plaintext env vars — see [docs/contracts-build-plan.md](contracts-build-plan.md) for the security pass before mainnet.
- XDR review: the backend records the operations it built per idempotency key; submitted transactions are matched against what was built.
- Row-level access control on all user-scoped tables; public event pages read through views exposing only public fields.
- No secrets in the repo; `.env.example` documents every variable.
- **Dependency audit:** `@creit.tech/stellar-wallets-kit` bundles support for wallets Astrea doesn't use (Trezor, Ledger, WalletConnect, NEAR/"Hot Wallet", Coinbase CDP, Solana) — installing the package pulls in their full dependency trees regardless of which module subpaths are actually imported (only Freighter/Albedo/xBull/LOBSTR are used). `package.json` `overrides` pins the affected transitive dependencies to patched versions without downgrading the kit itself. Re-check after any dependency bump.

## Failure modes considered

| Failure | Handling |
| --- | --- |
| Tx confirmed on-chain, DB write lost | Reconciler confirms the `OpLog` txHash directly against Horizon; `Payout` is append-only |
| Contract/RPC endpoint down | Operations queue in `OpLog`, retry with backoff; UI shows degraded state |
| Judge unresponsive | Dispute flow with resolver; deadline surfaced in UI |
| Judge picks a winner but never signs `close_event` | `judging_deadline` passes → resolver executes the release on the judge's behalf (ADR-003) |
| Organizer cancels an event already `Active` | Routes through `resolve_dispute`, not a bare refund — resolver decides the distribution (ADR-006) |
| Organizer needs an early exit before the event starts | Two-signature override only (organizer + resolver) — never a unilateral `withdraw_funds` on already-assigned funds (ADR-006) |
| Winner without trustline | Prevented at assignment (ADR-004) |
| Duplicate submit (double-click / retry) | Idempotency keys on every operation |
| Testnet/mainnet mix-up | Network is part of Event records; config validated at boot; mainnet behind explicit gate |
| Contract call fails mid-simulation | Simulation catches most failures before submission; reconciler compares against actual on-chain state, never assumed success |
