# Astrea — Architecture

## Principles

1. **Non-custodial, always.** The server never touches private keys. Every money-moving operation follows: server builds unsigned XDR → the owning role signs in their wallet → server submits.
2. **The chain is the source of truth.** The database mirrors escrow state for UX and querying; a reconciliation job corrects drift using Trustless Work indexed events and transaction hashes. No money-related state is marked final without an on-chain confirmation.
3. **Escrow behind a port.** Domain code depends on an `EscrowProvider` interface, not on Trustless Work directly. `TrustlessWorkAdapter` is the only implementation today; a native Soroban adapter is possible later without touching domain logic.
4. **Idempotent money operations.** Every escrow operation carries an idempotency key; retries are safe; partial failures (tx confirmed, DB write failed) are healed by reconciliation, never by manual fixes.
5. **Testnet by default.** Network, asset issuer, and Trustless Work base URL are environment configuration. Mainnet is a deliberate, gated change.

## System overview

- **Frontend** — Next.js App Router, TypeScript strict, Tailwind + shadcn/ui. Wallet connectivity through Stellar Wallets Kit. Signs XDR client-side. Renders public event pages (SSR for shareability/SEO).
- **Backend** — Next.js server actions / route handlers. Holds the Trustless Work API key (server-side only — never `NEXT_PUBLIC_`). Owns the state machines, validation, idempotency, and reconciliation.
- **Database** — Supabase Postgres via Prisma. Row Level Security for user-scoped data. Mirror tables for escrow state.
- **Escrow layer** — Trustless Work REST API (`/deployer/multi-release`, `/escrow/multi-release/*`, `/helper/send-transaction`), multi-release escrows. One escrow per event; one milestone per prize. Identity is the Soroban `contractId`, returned only after the signed deploy transaction is submitted. **Each escrow has exactly one `approver` address and one `releaseSigner` address** (not arrays) — see the multi-judge note under ADR-003.

## Domain model (Prisma sketch)

```
Event      — id, organizerId, name, dates, status, escrowContractId, network
Prize      — id, eventId, rank, amountUsdc, milestoneIndex, status, winnerWalletId, releaseTxHash
Judge      — id, eventId, walletAddress, displayName, status
Submission — id, eventId, participantWalletId, url, submittedAt
Wallet     — id, userId, address, usdcTrustlineVerifiedAt
Payout     — id, prizeId, txHash, amountUsdc, confirmedAt        (append-only audit log)
OpLog      — id, idempotencyKey, operation, payload, status      (idempotency + outbox)
```

## Key sequences

### Deploy + fund (organizer)

```
UI → server: create event (validated)
server → TW POST /deployer/multi-release: build unsigned deploy tx
UI: organizer signs → server → TW POST /helper/send-transaction: submit
                                → response includes contractId (not before)
server → TW POST /escrow/multi-release/fund-escrow: build unsigned fund tx
UI: organizer signs → server → TW POST /helper/send-transaction: submit
reconciler: confirms escrow balance == Σ prizes → Event.FUNDED
```

### Release (judge approves → winner paid)

Two separate transactions, both signed by the judge — **there is no combined approve-and-release endpoint** (confirmed against the live API in K01; the public docs site implied one, it does not exist):

```
judge assigns winner → server validates winner trustline
server → TW POST /escrow/multi-release/approve-milestone: build unsigned tx
judge signs → server → TW POST /helper/send-transaction: submit (approval)
server → TW POST /escrow/multi-release/release-milestone-funds: build unsigned tx
judge signs → server → TW POST /helper/send-transaction: submit (release)
reconciler: confirms release event → Prize.RELEASED + Payout row (txHash, net of protocol fee — see ADR-005)
```

### Reconciliation loop

Periodic job (and on-demand after each submit): pulls escrow state + indexed events from Trustless Work (`GET /escrows/:contractId`, events endpoint), compares against mirror tables, and repairs drift. Alerts on any divergence it cannot auto-heal.

## Architecture Decision Records

### ADR-001 — Trustless Work over a custom Soroban contract

**Decision:** use Trustless Work escrows behind the `EscrowProvider` port.
**Why:** audited, deployed, actively maintained escrow infrastructure from the same ecosystem family (GrantFox itself is designed around it); writing and auditing a custom escrow contract is months of work orthogonal to Astrea's product value.
**Trade-off:** third-party dependency (API availability, contract evolution). Mitigated by the port abstraction and the append-only `Payout`/`OpLog` audit trail.

### ADR-002 — Multi-release escrow, one milestone per prize

**Decision:** one escrow per event; each prize is an independently approvable/releasable milestone.
**Why:** prizes resolve at different times (judging per category, disputes on one prize must not block others). Multi-release maps 1:1 to this reality.
**Trade-off:** milestone operations are batch-oriented in TW v2 — the adapter handles batching.

### ADR-003 — Organizer is not in the payout path

**Decision:** the judge holds **both** the `approver` and `releaseSigner` addresses on the escrow. Approval and release are two separate signed transactions (no combined endpoint exists), but both are signed by the judge — the organizer's address appears nowhere in the payout path.
**Why:** if the organizer had to co-sign releases, an absent or hostile organizer could strand approved winners — which would make any "the funds are locked and will pay out" claim dishonest. Removing them from the release path is what turns the locked funds into a credible promise.
**Residual trust:** judges (can go silent or collude) and the dispute resolver (a designated party). Both are mitigated by transparency: judges and resolver are published on the event page before the event starts, and judging deadlines trigger the dispute path.
**Structural constraint discovered in K01:** a Trustless Work multi-release escrow has exactly **one** `approver` address and **one** `releaseSigner` address — not arrays. If Astrea needs a panel of multiple human judges (product-flows.md describes judges plural), a single judge's personal wallet cannot be the honest implementation of "the panel decided." The two real options, deferred to Phase 3 (`U05`):
  1. **Stellar multisig account** as the `approver`/`releaseSigner` address, with each judge as a signer and a threshold (e.g. 2-of-3) — genuine multi-judge approval, no protocol changes needed.
  2. A single designated "lead judge" wallet signs, with off-chain consensus (recorded in `Judge`/`Submission` tables) as the accountability trail — simpler, weaker guarantee.
  Option 1 is preferred; it is a UX/tooling cost (coordinating a multisig account setup), not a Trustless Work limitation.

**Verified in K01 (2026-07-24, testnet, contract `CACTMEF4DADZI6AVIZPZ43U4QTI4SFFUJYBFRY3YKHXYWQYOSAXP4E4N`):**
- Organizer attempted `withdraw-remaining-funds` while impersonating the `disputeResolver` role → rejected: `"Only the dispute resolver can execute this function"` (HTTP 400). The organizer cannot pull funds under any tested path.
- Judge attempted `release-milestone-funds` before approval → rejected: `"The milestone must be completed to release funds"` (HTTP 400).
- Judge approved, then released, milestone 0 as sole `approver`/`releaseSigner` → succeeded; winner received funds (see ADR-005 for the amount discrepancy found).

### ADR-004 — Trustline validation at registration, not payout

**Decision:** USDC trustline is checked when a participant registers and re-checked at winner assignment.
**Why:** discovering a missing trustline at payout time is the worst possible UX and blocks the release flow.

### ADR-005 — Prize amounts are gross; released amounts are net of a 0.3% Trustless Work protocol fee

**Status:** confirmed. Not an Astrea design choice — a fixed property of the escrow contract we integrate with.

**Finding (K01, 2026-07-24):** a milestone configured for 12.000000 USDC, released with `platformFee: 0`, paid the winner **11.964000 USDC** — a deduction of 0.036 USDC, exactly **0.3%**.

**Confirmed against the Trustless Work whitepaper** (trustlesswork.com/Whitepaper.pdf, §7 "Fees & Economics"):
- Escrow creation and funding are free (only ordinary Stellar network fees apply).
- **Escrow release: fixed 0.3% Trustless Work fee**, deducted automatically from the released amount — separate from and in addition to our own `platformFee` (also deducted at release).
- In multi-release escrows, the fee applies **per milestone**, independently. Their own worked example (1,000 USDC split into 400/400/200) matches our result exactly: fee = amount × 0.3%.
- The fee is **hardcoded into the Soroban contract** and enforced on-chain — "no external intervention (API, dApp, or Indexer) can alter or avoid this deduction." It changes only via a contract upgrade, communicated to integrators in advance. Safe to treat as a stable constant, not a fluke of this one test run.

**Why it matters:** Astrea's core promise is "the prize money is locked and will pay out." If prize amounts are advertised as gross figures, winners receive slightly less than advertised — a small but real gap between the claim and the outcome, in the same spirit as the "guaranteed" language already removed from the README.

**Decision:** display prize amounts as configured (gross) on the event page, with a plain, permanent disclosure that released amounts are net of Trustless Work's fixed 0.3% protocol fee (plus Astrea's own `platformFee`, currently 0%). Do **not** gross-up funding amounts to compensate — the winner-facing number should always match what actually lands in their wallet, computable client-side as `amount × (1 - 0.003 - platformFee)`.

## Security notes

- Trustless Work API key: server-side env only. (A `NEXT_PUBLIC_` key would ship to every browser — explicitly forbidden in this codebase.)
- XDR review: the server records the operations it built per idempotency key; submitted transactions are matched against what was built.
- RLS on all user-scoped tables; public event pages read through views exposing only public fields.
- No secrets in the repo; `.env.example` documents every variable.

## Failure modes considered

| Failure | Handling |
| --- | --- |
| Tx confirmed on-chain, DB write lost | Reconciler heals from TW indexed events; `Payout` is append-only |
| TW API down | Operations queue in `OpLog`, retry with backoff; UI shows degraded state |
| Judge unresponsive | Dispute flow with resolver; deadline surfaced in UI |
| Winner without trustline | Prevented at assignment (ADR-004) |
| Duplicate submit (double-click / retry) | Idempotency keys on every operation |
| Testnet/mainnet mix-up | Network is part of Event records; config validated at boot; mainnet behind explicit gate |
| Released amount < configured prize (0.3% protocol fee, ADR-005) | Disclosed on event page as a fixed, known deduction; reconciler compares against actual on-chain delta, not the configured amount |
| Public docs site (docs.trustlesswork.com) disagrees with the live API | Treat the live OpenAPI spec (`GET /docs-json` on the API host) as ground truth; re-verify against it, not the prose docs, whenever an endpoint call fails unexpectedly |
