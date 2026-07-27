# Astrea — Architecture

## Principles

1. **Non-custodial, always.** The server never touches private keys. Every money-moving operation follows: server builds unsigned XDR → the owning role signs in their wallet → server submits.
2. **The chain is the source of truth.** The database mirrors escrow state for UX and querying; a reconciliation job corrects drift by checking transaction hashes directly against Horizon (see "Reconciliation loop" for why this is Horizon, not a Trustless Work event log). No money-related state is marked final without an on-chain confirmation.
3. **Escrow behind a port.** Domain code depends on an `EscrowProvider` interface, not on Trustless Work directly. `TrustlessWorkAdapter` is the only implementation today; a native Soroban adapter is possible later without touching domain logic.
4. **Idempotent money operations.** Every escrow operation carries an idempotency key; retries are safe; partial failures (tx confirmed, DB write failed) are healed by reconciliation, never by manual fixes.
5. **Testnet by default.** Network, asset issuer, and Trustless Work base URL are environment configuration. Mainnet is a deliberate, gated change.

## System overview

- **Frontend** — Next.js App Router, TypeScript strict, Tailwind + shadcn/ui. Wallet connectivity through Stellar Wallets Kit. Signs XDR client-side. Renders public event pages (SSR for shareability/SEO — see build-plan.md U09/U10 for the concrete tasks: sitemap/robots/OG basics, then per-event dynamic metadata and social cards).
- **Backend** — Next.js server actions / route handlers. Holds the Trustless Work API key (server-side only — never `NEXT_PUBLIC_`). Owns the state machines, validation, idempotency, and reconciliation.
- **Database** — Supabase Postgres via Prisma. Row Level Security for user-scoped data. Mirror tables for escrow state.
- **Escrow layer** — Trustless Work REST API (`/deployer/multi-release`, `/escrow/multi-release/*`, `/helper/send-transaction`), multi-release escrows. One escrow per event; one milestone per prize. Identity is the Soroban `contractId`, returned only after the signed deploy transaction is submitted. **Each escrow has exactly one `approver` address and one `releaseSigner` address** (not arrays) — see the multi-judge note under ADR-003.

## Domain model (Prisma sketch)

```
Event      — id, organizerId, name, dates, status, escrowContractId, network
Prize      — id, eventId, rank, amountUsdc, milestoneIndex, status, winnerWalletId, releaseTxHash, forwardTxHash
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

### Release (judge approves → judge receives → judge forwards to winner)

Three separate transactions, all signed by the judge — **there is no combined approve-and-release endpoint** (confirmed against the live API in K01; the public docs site implied one, it does not exist), and the milestone `receiver` is the judge, not the winner (ADR-007 — the winner is unknown at deploy time and TW does not allow changing a milestone's receiver afterward):

```
judge assigns winner → server validates winner trustline
server → TW POST /escrow/multi-release/approve-milestone: build unsigned tx
judge signs → server → TW POST /helper/send-transaction: submit (approval)
server → TW POST /escrow/multi-release/release-milestone-funds: build unsigned tx
judge signs → server → TW POST /helper/send-transaction: submit (release to JUDGE's own wallet)
reconciler: confirms release event → Prize.RELEASED + Payout row (releaseTxHash, net of protocol fee — see ADR-005)
server: computes exact net amount received → builds unsigned Stellar payment tx, judge → winner
judge signs → server submits directly to Horizon (not a TW call — plain Stellar payment)
reconciler: confirms forward tx → Prize.PAID_OUT + Payout row updated (forwardTxHash)
```

### Reconciliation loop

**Correction (2026-07-26, E04):** the live OpenAPI spec has no "list of indexed events for a contract" endpoint — that was an assumption from before K01, never verified. What actually exists: `GET /helper/get-escrow-by-contract-ids?validateOnChain=true` (current escrow snapshot, already used by `getEscrow`), `PUT /indexer/update-from-txhash` (tells TW's indexer to re-process a specific transaction and returns the refreshed snapshot), and `GET /helper/get-escrows-by-signer` (bulk filter/list, not a per-contract event log). There is no substitute for asking Horizon directly whether a given transaction hash actually landed — which is exactly Principle 2 ("the chain is the source of truth"), not a gap.

Periodic job (and on-demand after each submit): for each `SUCCEEDED` `OpLog` row, confirms its `txHash` against Horizon directly rather than trusting Trustless Work's own indexed state; for prizes in `RELEASED`, checks `releasedAt` against `forwardTxHash` and alerts if a forward hasn't landed within a short window (ADR-007). Comparing Trustless Work's own milestone-status snapshot against the mirror tables is deferred until real data is flowing through the app (post-E06) — building that comparison against an empty database now would be speculative.

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

**Decision:** display prize amounts as configured (gross) on the event page, with a plain, permanent disclosure that released amounts are net of Trustless Work's fixed 0.3% protocol fee (plus Astrea's own `platformFee`, currently 0%). Astrea itself never gross-ups a funding amount automatically — the displayed net figure always matches what actually lands in the winner's wallet, computable client-side as `amount × (1 - 0.003 - platformFee)`.

**Organizer-covered fee (opt-in, U02):** the funding flow (`product-flows.md`, Flow 2) offers the organizer a calculated, opt-in option to fund `prize ÷ (1 - 0.003 - platformFee)` instead of the raw prize amount, so the winner's net receipt equals the advertised prize exactly. This is not a violation of "no automatic gross-up" — it's the organizer knowingly choosing to pay the fee themselves, with the UI doing the arithmetic. The event page must reflect whichever is true per prize: fee disclosed separately, or fee covered and the full amount guaranteed — never show the covered-fee number unless funding actually happened at the grossed-up amount.

### ADR-006 — Wallet connection sets a UX session, not an authorization boundary

**Decision (S05):** connecting a wallet via Stellar Wallets Kit (`@creit.tech/stellar-wallets-kit`) triggers a server action (`associateWallet`) that finds-or-creates a `User`/`Wallet` row and sets an httpOnly cookie pointing at the `Wallet.id`. This cookie is read to know "who's browsing as which wallet" for UX purposes (pre-filling forms, showing "your events").
**Why not more (yet):** the cookie is set from a client-asserted address with no cryptographic challenge (no "sign this nonce to prove you hold the key" step). That's a deliberate scope cut, not an oversight — because **no money-moving action ever trusts this cookie**. Every escrow operation (approve, release, withdraw) is independently authorized by an actual on-chain signature, verified by Trustless Work/the Soroban contract itself (proven in K01's negative tests). The session is a convenience for reads, never a check for writes that matter.
**Failure mode this avoids:** if the DB/session write fails (e.g. no DB connection available), the client-side wallet connection still succeeds — `associateWallet` failures are caught and logged, never allowed to undo a real wallet connection the user just approved in their extension.
**Revisit when:** if a future feature needs to trust "this browser really controls address X" for something other than display (e.g. gating a private organizer dashboard read), upgrade to a signed challenge-response ("Sign-In With Stellar," SEP-0043's `signMessage`) rather than trusting the cookie alone.

**Verified (2026-07-26):** wallet kit initializes client-side only (guarded against SSR execution); connect modal renders all four target wallets (Freighter, Albedo, xBull, LOBSTR) against a running dev server with no console errors from Astrea's own code.

### ADR-007 — The judge receives the prize and forwards it to the winner (two-hop payout)

**Status:** confirmed empirically (2026-07-26, testnet).

**The constraint:** Astrea's core promise is funds locked *before* the winner is known. But a Trustless Work milestone's `receiver` address is fixed at deploy time, and there is no supported way to change it afterward:

- `PUT /escrow/multi-release/update-escrow`, signed by the organizer (the only role allowed to call it — a judge-signed attempt is rejected outright with `"Only the platform address should be able to execute this function"`), accepts changes to `description` and other fields but rejects any change to `milestones[].receiver` with `"The provided escrow properties do not match the stored escrow."` — tested with the exact stored payload shape (including a JSON key-order sensitivity quirk), receiver-only change still rejected. See `spikes/k01-trustless-work/src/03-verify-update-escrow.js`.
- `POST /escrow/multi-release/withdraw-remaining-funds` (disputeResolver-only) cannot be used to redirect pool funds mid-flow either: it is rejected outright while any milestone is still pending — `"All milestones must be released or dispute-resolved before withdrawing remaining funds"`. It's an end-of-lifecycle cleanup operation, not a runtime reallocation tool. See `spikes/k01-trustless-work/src/04-verify-withdraw-destination.js`.

**Options considered:**
- **B — Pool escrow + per-prize escrow deployed at judging time.** Rejected: not just riskier but not buildable as imagined — `withdraw-remaining-funds` refuses to release pooled funds until every milestone is already released or formally disputed, so there is no clean way to pull money out of a pool and re-deploy it once winners are known without abusing the dispute mechanism (forcing every prize through a fake "dispute" just to move money — which would also make the public event page show every prize as disputed, the opposite of the transparency Astrea promises).
- **A — The judge is the milestone receiver; forwards to the winner.** Accepted.

**Decision:** at deploy time, every milestone's `receiver` is set to the judge's address (the `approver`/`releaseSigner`, per ADR-003 — winner is not yet known). When the judge releases a milestone, funds land in the judge's own wallet; the judge immediately sends a second, ordinary Stellar payment forwarding the funds to the real winner. This is disclosed plainly on the product (no "trust model" section, per established README guidance — the mechanism is stated as fact, not hedged).

**Verified end-to-end (2026-07-26, testnet, contract `CBGDI4WNYCQAACR2RJQTIHUGSVZJQQZHHE4HEYQKN3DU5XJADQIDROEW`):** deploy with judge as receiver → fund (1 USDC) → approve (judge) → release (judge) → judge's balance `0 → 0.997 USDC` (net of ADR-005's 0.3% fee) → judge forwards `0.997 USDC` via a plain Stellar `payment` operation → winner's balance increases by exactly `0.997 USDC`. See `spikes/k01-trustless-work/src/05-verify-option-a-forward.js`.

**New requirement found in the same spike:** the judge's Stellar account needs its own USDC trustline to hold the funds even momentarily — `01-setup-accounts.js` only opened one for organizer and winner. Every judge onboarding flow must verify/create this trustline, the same as ADR-004 does for participants.

**Forward amount, not gross amount:** the judge must forward exactly what they received (`amount × (1 - 0.003 - platformFee)`, per ADR-005), never the configured gross prize — forwarding the gross amount would leave the judge short. This must be a computed, non-editable value in the release/forward UI (`U06`), not something a judge types by hand.

**Residual trust window:** between release and forward, funds sit in the judge's personal wallet for the time it takes to submit one more signed transaction — typically seconds, and the same judge already trusted with approval and release under ADR-003. `E04`'s reconciliation job must track both hops (release tx *and* forward tx) per prize and alert if a release is not followed by a matching forward within a short window, so a stalled forward is caught immediately rather than discovered by a complaining winner.

**The escape hatch, verified (2026-07-26):** the live OpenAPI spec exposes two endpoints not covered above — `POST /escrow/multi-release/dispute-milestone` and `POST /escrow/multi-release/resolve-milestone-dispute`. Together they can redirect a single milestone's funds straight from the escrow to an address that was never the configured `receiver`, with **zero custody window** — no judge forwarding step at all:

- `dispute-milestone` can be signed by the **organizer, the judge, or the winner** — confirmed all three independently (`spikes/k01-trustless-work/src/06-verify-dispute-redirect.js`, `07-verify-dispute-who-can-raise.js`, `08-verify-dispute-winner.js`). The **disputeResolver cannot raise a dispute on their own escrow** — rejected with `"The dispute resolver cannot be the one to raise a dispute on a milestone."`
- `resolve-milestone-dispute` is **disputeResolver-only** and takes an explicit `distributions: [{address, amount}]` array — verified paying a milestone's funds directly to the winner's address even though the winner was never the milestone's `receiver` (06), with the organizer's balance unchanged (funds never touched it).

**Considered and rejected as the routine (happy-path) mechanism:** replacing ADR-007's forward step with dispute → resolve for every prize. Technically simpler per-transaction (the judge signs once, not three times), but it makes the **disputeResolver a required, always-available signer for every single payout**, not the exceptional fallback ADR-003 designed them to be — if the resolver is slow, traveling, or unresponsive, every prize decided that day waits on them even though the judge already finished. ADR-007's forward step depends on one person (the judge) who is already present; this alternative depends on two.

**Considered and rejected: merging the judge and the disputeResolver into one address**, to get dispute → resolve's zero-custody-window benefit without needing a second person. Verified technically possible (`09-verify-merged-judge-resolver.js`: deploy succeeds with the same address as `approver`/`releaseSigner`/`disputeResolver`; winner self-disputes; the merged judge/resolver resolves straight to the winner in one signature). **Rejected anyway**: it eliminates the one thing the separate disputeResolver role exists for — an independent check when the judge is dishonest or unresponsive. A merged judge/resolver who goes silent or plays favorites has no one left to override them.

**Conclusion — dispute → resolve is Flow 5's real mechanism, not an alternative to ADR-007.** ADR-007 (judge receives and forwards) is the routine path for every prize. Dispute → resolve, with a genuinely independent disputeResolver, is the verified implementation of `product-flows.md`'s Flow 5: when a judge is unresponsive or a result is contested, the winner (or organizer) raises a dispute and the resolver pays the winner directly — bypassing the stuck judge entirely, with no forwarding step needed in that case either.

## Security notes

- Trustless Work API key: server-side env only. (A `NEXT_PUBLIC_` key would ship to every browser — explicitly forbidden in this codebase.)
- XDR review: the server records the operations it built per idempotency key; submitted transactions are matched against what was built.
- RLS on all user-scoped tables; public event pages read through views exposing only public fields.
- No secrets in the repo; `.env.example` documents every variable.
- **Dependency audit (S05):** `@creit.tech/stellar-wallets-kit` bundles support for wallets Astrea doesn't use (Trezor, Ledger, WalletConnect, NEAR/"Hot Wallet", Coinbase CDP, Solana) — installing the package pulls in their full dependency trees regardless of which module subpaths we actually import (`kit.ts` only imports Freighter/Albedo/xBull/LOBSTR). `npm audit` flagged 43 vulnerabilities, nearly all inside those unused wallet integrations, including 1 critical (`protobufjs`, via the Trezor module chain). `package.json` `overrides` pins `protobufjs`, `axios`, `elliptic`, and `uuid` to their latest patched versions without downgrading the kit itself — reduced to 0 critical, 6 high. The 6 remaining high findings are `next`'s bundled `sharp`/`postcss` and `prisma`'s bundled `@prisma/dev`/`find-my-way` — both build/dev-tooling-only (never in the deployed runtime bundle), and `npm audit fix --force`'s suggested "fix" for both is an actual downgrade (Next→9.3.3, Prisma→7.8.0, older than what we run) — rejected as worse than the finding. Re-run `npm audit --omit=dev` after any dependency bump to check if upstream has patched these.

## Failure modes considered

| Failure | Handling |
| --- | --- |
| Tx confirmed on-chain, DB write lost | Reconciler confirms the `OpLog` txHash directly against Horizon; `Payout` is append-only |
| TW API down | Operations queue in `OpLog`, retry with backoff; UI shows degraded state |
| Judge unresponsive | Dispute flow with resolver; deadline surfaced in UI |
| Winner without trustline | Prevented at assignment (ADR-004) |
| Duplicate submit (double-click / retry) | Idempotency keys on every operation |
| Testnet/mainnet mix-up | Network is part of Event records; config validated at boot; mainnet behind explicit gate |
| Released amount < configured prize (0.3% protocol fee, ADR-005) | Disclosed on event page as a fixed, known deduction; reconciler compares against actual on-chain delta, not the configured amount |
| Public docs site (docs.trustlesswork.com) disagrees with the live API | Treat the live OpenAPI spec (`GET /docs-json` on the API host) as ground truth; re-verify against it, not the prose docs, whenever an endpoint call fails unexpectedly |
| Judge releases a milestone but never forwards to the winner (ADR-007) | Reconciler alerts if `Prize.RELEASED` has no matching `forwardTxHash` within a short window; funds are visibly sitting in a published, known judge wallet, not lost — dispute path available if the judge is unresponsive |
| Judge forwards the gross prize amount instead of the fee-net amount (ADR-007) | UI computes and locks the forward amount server-side (`amount × (1 - 0.003 - platformFee)`); never a judge-editable field |
| Judge account has no USDC trustline to receive the release (ADR-007) | Verified/created during judge onboarding, same pattern as ADR-004 for participants |
