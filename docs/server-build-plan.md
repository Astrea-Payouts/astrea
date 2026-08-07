# Astrea — Server Build Plan (v2, current direction)

> **Adopted (2026-08-01, ADR-008)** — supersedes [docs/build-plan.md](build-plan.md)'s Trustless Work approach. Custom Soroban escrow contract, a new Go backend service, and real-time participant/score tracking. **K01 here gates the whole plan**, same discipline the original plan used: don't build Phase 1+ until the contract spike validates the role model on real testnet (see ADR-008 for the four concrete problems this is meant to solve, and the trade-offs accepted knowingly to solve them).

Phased plan with coded tasks. Each task becomes one GitHub issue with its code in the title (e.g., `[S03] Postgres schema and repo scaffold`). Sizes: S (≤half day), M (1–2 days), L (3+ days, should be split before assignment). `GFI` = good first issue candidate.

## Architecture summary

- **`apps/web`** — Next.js + TypeScript frontend/BFF: event creation, organizer dashboard, public event pages, participant registration, judge panel, real-time tracking UI.
- **`services/core-go`** — Go backend: owns the event/prize state machine, participant registration, real-time score/progress tracking, the build-sign-submit transaction pipeline, and reconciliation. This is the only service allowed to write transactional state or trigger the escrow contract.
- **`contracts/soroban`** — Rust smart contract (Soroban/Stellar): custom-built escrow — deploy, fund, approve, release, dispute, resolve-dispute — no third-party escrow provider.
- **Postgres** — shared database (mirror tables for events, prizes, participants, wallets, payouts, an append-only op log for idempotency/auditability).
- Everything lives in a single repository (monorepo), separated by folder/service, not by repo — see S01.

## Phase 0 — Spike (de-risk before anything else)

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| K01 | ✅ **Done (2026-08-06)** — Custom Soroban escrow contract spike: script-driven deploy → fund → approve → release → dispute → resolve, end-to-end on testnet. Validated the role model: judge acts as both approver and release signer; the funder cannot withdraw funded amounts once escrowed | L → split | **Gated the whole plan**, same as the original K01. Findings in [spikes/k01-soroban-escrow](../spikes/k01-soroban-escrow/README.md) — role model confirmed on real testnet (contract `CBFPD4YFURBDQ3MQ7EMT3HPP2K34W5H6QCVWGCEP43MPHFO5XG5ONCUG`), including the late-bound winner address that directly fixes ADR-007's two-hop payout |
| K02 | ✅ **Done (2026-08-06)** — Go ↔ Soroban integration spike: confirmed a Go service can build, sign, and submit Stellar transactions against the K01 contract end-to-end (deploy/fund/approve/release) using the Stellar Go SDK | M | Findings in [spikes/k02-go-soroban](../spikes/k02-go-soroban/README.md) — no high-level "invoke" helper in the Go SDK, simulate→sign→submit→poll had to be hand-rolled; NEG-1 (unauthorized release) was rejected **on-chain** this time, a stronger check than K01's CLI-level rejection |
| K03 | 🔜 **Harness ready, awaiting manual verification** — wallet compatibility check: confirm the contract works across the wallets the team plans to support (Freighter, Albedo, xBull, LOBSTR via Stellar Wallets Kit) | S | See [spikes/k03-wallet-compat](../spikes/k03-wallet-compat/README.md). Needs a human clicking through real wallet extensions (can't be scripted like K01/K02 — the whole point is the extension holding the key, not a CLI). Public-docs research already flags LOBSTR's Soroban support as "partial" as of mid-2026 — that's the actual open question, run the harness to get a real answer instead of guessing from marketing copy |
| K04 | ADRs from K01–K03 findings: role model, treasury/signer custody approach, and whether the contract charges any protocol fee (or none) | S | Write these once, early — cheaper to change an ADR than to change shipped code |

## Phase 1 — Foundations

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| S01 | Monorepo scaffold: `apps/web` (Next.js + TypeScript strict + Tailwind), `services/core-go` (Go module), `contracts/soroban` (Rust/cargo workspace), `docker-compose.yml` for local Postgres (+ Redis if E05's real-time tracking ends up needing pub/sub) | M | One repo, not one per service/language — folder-level separation, shared CI |
| S02 | CI: GitHub Actions — build/lint/test for all three: Next.js (existing tooling), Go (`go build`/`go vet`/`go test`), Rust (`cargo test`/`clippy`) | M | One pipeline, jobs scoped by changed path |
| S03 | Postgres schema: `Event`, `Prize`, `Judge`, `Participant`, `Wallet`, `Payout`, `OpLog` — plus row-level security if using Supabase, or equivalent access control otherwise | M | Decide here whether Go or Next.js (or both) get direct DB access — recommend Go as sole writer for transactional tables, Next.js reads for display |
| S04 | Environment config: network (testnet/mainnet), contract ID, treasury signer handling (never in plaintext env vars — flag as an L02 dependency), Postgres connection, boot-time validation in both `apps/web` and `services/core-go` | S | |
| S05 | Wallet connect (frontend): Stellar Wallets Kit integration, session association | M | |
| S06 | `.env.example`, `CONTRIBUTING.md`, issue/PR templates, labels, `LICENSE` | S | Set this up with GrantFox's eventual contributor phase in mind, even if that's a later milestone |

## Phase 2 — Core system (event lifecycle, escrow, real-time tracking)

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| E01 | Soroban escrow contract: deploy, fund, approve, release, dispute, resolve-dispute functions, per K01's validated role model | L → split | Lives in `contracts/soroban` |
| E02 | Go `EscrowClient`: wraps the E01 contract via the Stellar Go SDK, exposes an internal API that `apps/web` calls for anything escrow-related — the frontend never talks to the contract directly | L → split | Lives in `services/core-go` |
| E03 | Go build-sign-submit pipeline backed by `OpLog`: idempotency rules — only a terminal `SUCCEEDED` status is final, `PENDING`/`FAILED` are always retryable; resubmitting an identical signed transaction is safe at the Stellar/Horizon layer (idempotent per tx hash), `OpLog` exists for audit trail and to avoid redundant calls, not to prevent double-payment on its own | M | |
| E04 | Event + prize state machine, with the manual-start rule built in from the start: `draft → standby → active → finished`. Track `conditionsMetAt` (derived: prize wallet funded **and** minimum participants registered) as distinct from `status = active` — the event **never** auto-activates on conditions being met; activation only happens via an explicit admin action (`POST /events/:id/start`), so an admin can pick an arbitrary start time. Guard every transition against races (e.g. conditional update keyed on expected `from` status) | M | This was originally going to be a bolt-on; building it into the state machine from day one is simpler than retrofitting it |
| E05 | Real-time tracking: as participants/judges update progress or scores, push updates to the frontend (Postgres `LISTEN`/`NOTIFY`, or Redis pub/sub if that's cleaner from S01, streamed to `apps/web` via WebSocket/SSE) | M | Decide the transport mechanism here — don't default to WebSockets without checking whether SSE is simpler given Next.js hosting |
| E06 | Reconciliation: stalled-transaction detection + Horizon transaction confirmation, comparing the Postgres mirror tables against on-chain state | M | Ships in the same phase as the first real money operation — never defer this to a later phase once payouts are live |
| E07 | Trustline verification: check at participant registration and again at winner assignment that the payout wallet can actually receive the prize asset | S | A missing account on the ledger (no XLM yet) should be treated as "no trustline," not an error |
| E08 | Vertical slice demo: create event → fund → register participants → admin starts event → track in real time → assign winner → approve → release payout → reconcile, on real testnet | M | Milestone: **the product's core guarantee works**, verified end-to-end before building UI polish on top |

## Milestone — Apply to GrantFox as maintainer

Once Phases 0–2 are done, the core promise (registration, real-time tracking, and an on-chain payout that actually reaches the winner's wallet) is proven end-to-end. That's the point to apply — everything after this is UI, edge cases, and hardening, meant to be built with contributors rather than before them.

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| L00 | Minimal shell: header, footer, hero, basic layout | S | |
| L01 | Deploy `apps/web` (Vercel or similar) and `services/core-go` (Docker + Railway/Fly.io/Render or a VPS); seed a standing demo event | S | `contracts/soroban` deploys to Stellar testnet directly, not to the same host |

## Phase 3 — Product UI

**Contributor backlog opens here** once the milestone above is reached.

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| U01 | Event creation wizard (details → prize → review & sign) | L → split | |
| U02 | Organizer dashboard: funding flow, event status, participant management. Shows a "Ready to start" state once `conditionsMetAt` is set, with an explicit "Start event" action calling the Go service — the event never activates on its own | M | Depends on E04 |
| U03 | Public event page: prize info, "verified on-chain" badge, contract link, payout history | M | SSR |
| U04 | Participant flow: register (trustline check), real-time progress view | M | |
| U05 | Judge panel: scoring/progress review, winner assignment, approval signing | M | |
| U06 | Payout flow UI + confirmation states ("pending on-chain" UX) | S | |
| U07 | Explorer links (stellar.expert) + tx hash display components | S | GFI |
| U08 | Marketing homepage | M | |
| U09 | Site-wide technical SEO + social cards | S | GFI |
| U10 | Per-event SEO: dynamic metadata, OG image, `schema.org/Event` JSON-LD | M | Depends on U03 |

## Phase 4 — Trust & edge cases

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| T01 | Dispute flow: open, evidence, resolver signing, resolution record | L → split | Built against E01's `dispute`/`resolve-dispute` functions |
| T02 | Event cancellation + refund flow | M | |
| T03 | Notifications on state changes (registration confirmed, event started, winner announced, payout sent) — email or in-app, triggered from the Go service; a dedicated notifications service is worth splitting out later if volume/retry logic gets complex enough to justify it | M | GFI-able parts. Should include a notification when `conditionsMetAt` is set, so the admin knows the event is ready to start |
| T04 | E2E tests on testnet for the money paths (fund→release; dispute) | M | |

## Phase 5 — Hardening

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| L02 | Security pass: Rust contract review, Go service secrets/config audit, treasury signer key custody review, transaction-matching checks | M | |
| L03 | Observability: structured logs with tx hashes (Go service), reconciliation drift alerts | S | |

## Sequencing rules

1. K01 before everything — if the spike falsifies the role-model assumption, ADRs change while changing docs is still cheap.
2. E06 (reconciliation) ships in the same phase as the first real money operation, never later.
3. The GrantFox application happens right after Phase 2, not after Phases 3–4 — those phases are the contributor-facing backlog the application is *for*, not a prerequisite to it.
4. E04's manual-start rule is part of the state machine from the start — U02 has nothing to call without it, so E04 must be complete before U02 is picked up.
5. Mainnet is out of scope for every task above; it gets its own phase after real testnet usage.
