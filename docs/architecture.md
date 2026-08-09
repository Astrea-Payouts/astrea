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
- **Escrow layer** — a custom Soroban smart contract (`contracts/soroban`): deploy, fund, approve, release, dispute, resolve-dispute. One escrow per event; one milestone per prize (target design, see ADR-002). The winner's address is supplied at `release` time, not fixed when the escrow is funded — release pays the winner directly, with no separate forwarding step.

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

**Decision:** Astrea's escrow is a smart contract Astrea owns and audits (`contracts/soroban`, Rust/Soroban), not a third-party escrow API.

**Why:**
1. The winner's address is supplied at `release` time, not fixed when the escrow is funded — release pays the winner directly, with no separate forwarding transaction and no custody window.
2. No third-party protocol fee on releases — the only fee, if any, is Astrea's own, visible in the contract's own logic rather than an external deduction.
3. Real-time tracking and other product-specific logic are built directly against the contract via an owned backend service, not constrained by a generic escrow API's feature set.
4. No dependency on a third party's uptime, pricing, or API stability for the money-critical path.

**Trade-off:** owning the contract means owning its audit burden — there's no third-party liability backstop. Mitigated by validating the design on testnet before building production code on top of it, and a dedicated security review before mainnet (see [docs/contracts-build-plan.md](contracts-build-plan.md)).

**Verified (K01, 2026-08-06, testnet):** judge as both `approver` and `release_signer` works; the organizer has no function that moves escrowed funds anywhere (confirmed by a rejected direct-release attempt); the winner's address is supplied at `release` time. Contract `CBFPD4YFURBDQ3MQ7EMT3HPP2K34W5H6QCVWGCEP43MPHFO5XG5ONCUG` — see [spikes/k01-soroban-escrow](../spikes/k01-soroban-escrow/README.md).

**Verified (K02, 2026-08-06, testnet):** a Go service, not a CLI, can build, simulate, sign, and submit every transaction against the contract end to end, using the Stellar Go SDK directly — see [spikes/k02-go-soroban](../spikes/k02-go-soroban/README.md).

### ADR-002 — Multi-release escrow, one milestone per prize

**Decision:** one escrow per event; each prize is an independently approvable/releasable milestone.
**Why:** prizes resolve at different times (judging per category, a dispute on one prize must not block another). Multi-release maps 1:1 to this reality.
**Status:** target design for the production contract (`E01`, [docs/contracts-build-plan.md](contracts-build-plan.md)). K01 validated the role model on a single-milestone contract; multi-milestone support is part of building the production contract, not yet re-verified.

### ADR-003 — Organizer is not in the payout path

**Decision:** the judge holds both the `approver` and `release_signer` addresses on the escrow. The organizer's address appears nowhere in the payout path — no function callable by the organizer can move escrowed funds anywhere.
**Why:** if the organizer had to co-sign releases, an absent or hostile organizer could strand approved winners — which would make any "the funds are locked and will pay out" claim dishonest. Removing them from the release path is what turns the locked funds into a credible promise.
**Residual trust:** judges (can go silent or collude) and the dispute resolver (a designated party). Both are mitigated by transparency: judges and resolver are published on the event page before the event starts, and judging deadlines trigger the dispute path.
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

**Verified:** wallet kit initializes client-side only (guarded against SSR execution); connect modal renders all four target wallets (Freighter, Albedo, xBull, LOBSTR) with no console errors. Signing against the escrow contract itself is verified per-wallet in K03 ([docs/build-plan.md](build-plan.md)) — Freighter and Albedo confirmed so far.

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
| Winner without trustline | Prevented at assignment (ADR-004) |
| Duplicate submit (double-click / retry) | Idempotency keys on every operation |
| Testnet/mainnet mix-up | Network is part of Event records; config validated at boot; mainnet behind explicit gate |
| Contract call fails mid-simulation | Simulation catches most failures before submission; reconciler compares against actual on-chain state, never assumed success |
