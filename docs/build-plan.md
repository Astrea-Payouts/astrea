# Astrea — Build Plan

Phased plan with coded tasks. Each task becomes one GitHub issue with its code in the title (e.g., `[S03] Postgres schema and repo scaffold`). Sizes: S (≤half day), M (1–2 days), L (3+ days, should be split before assignment). `GFI` = good first issue candidate. The escrow contract itself has its own plan — see [docs/contracts-build-plan.md](contracts-build-plan.md).

## Architecture summary

- **`apps/web`** — Next.js + TypeScript frontend/BFF: event creation, organizer dashboard, public event pages, participant registration, judge panel, real-time tracking UI.
- **`services/core-go`** — Go backend: owns the event/prize state machine, participant registration, real-time score/progress tracking, the build-sign-submit transaction pipeline, and reconciliation. The only service allowed to write transactional state or call the escrow contract.
- **`smart-contracts/astrea/contracts/event-escrow`** — the escrow contract (Rust/Soroban) — see [docs/contracts-build-plan.md](contracts-build-plan.md).
- **Postgres** — shared database (mirror tables for events, prizes, participants, wallets, payouts, an append-only op log for idempotency/auditability).
- Everything lives in a single repository (monorepo), separated by folder/service, not by repo — see S01.

## Phase 0 — Spike (de-risk before anything else)

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| K02 | ✅ **Done (2026-08-06)** — Go ↔ escrow contract integration spike: confirmed a Go service can build, sign, and submit Stellar transactions against the contract end-to-end (deploy/fund/approve/release) using the Stellar Go SDK | M | Findings in [spikes/k02-go-soroban](../spikes/k02-go-soroban/README.md) — no high-level "invoke" helper in the Go SDK, simulate→sign→submit→poll had to be hand-rolled |
| K03 | 🔜 **In progress (2026-08-06)** — wallet compatibility check: confirm the contract works across the wallets the team plans to support (Freighter, Albedo, xBull, LOBSTR via Stellar Wallets Kit) | S | See [spikes/k03-wallet-compat](../spikes/k03-wallet-compat/README.md). Freighter ✅ and Albedo ✅ confirmed signing a real contract call end-to-end; xBull and LOBSTR pending |
| K04 | Fold K03's complete results into ADR-005 once all four wallets are tested | S | |
| K05 | Expand wallet support beyond the initial four: Stellar Wallets Kit ships 16 wallet modules total (see `apps/web/node_modules/@creit.tech/stellar-wallets-kit`), we only wire up 4. Add + test the rest: Rabet/Hana/Klever, D'CENT/OneKey/HotWallet, Bitget/CactusLink/Fordefi, Ledger/Trezor, and WalletConnect | M — tracked as 5 sub-issues | Same pattern as K03: connect + sign a real testnet contract call per wallet. WalletConnect is its own protocol integration, not just one more module, and opens the door to further wallets beyond this list |

## Phase 1 — Foundations

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| S01 | Monorepo scaffold: `apps/web` (Next.js + TypeScript strict + Tailwind, already scaffolded), `services/core-go` (Go module, not yet added), `docker-compose.yml` for local Postgres (+ Redis if E04's real-time tracking ends up needing pub/sub) | M | One repo, not one per service/language — folder-level separation, shared CI. The Next.js app itself already exists at repo root; this task is folding it under `apps/web` and adding the Go service alongside it |
| S02 | CI: GitHub Actions — build/lint/test for `apps/web` (already running) and `services/core-go` (`go build`/`go vet`/`go test`, not yet added) | M | One pipeline, jobs scoped by changed path |
| S03 | Postgres schema: `Event`, `Prize`, `Judge`, `Participant`, `Wallet`, `Payout`, `OpLog`, plus row-level access control | M | A schema close to this already exists (Prisma + Supabase) — needs the `conditionsMetAt` field and the `Submission`→`Participant` rename to match the manual-start event lifecycle (E03) |
| S04 | Environment config: network (testnet/mainnet), contract ID, treasury signer handling (never in plaintext env vars), Postgres connection, boot-time validation in both `apps/web` and `services/core-go` | S | An env-config module already exists for the frontend; needs updating for the contract ID and the new Go service's own config |
| S05 | ✅ **Done** — Wallet connect (frontend): Stellar Wallets Kit integration (Freighter, Albedo, xBull, LOBSTR), session association | M | See ADR-005. API is a static-class rewrite, not the instance-based API in most tutorials/docs — verified against the installed package's own `.d.ts` files |
| S06 | ✅ **Done** — `.env.example`, `CONTRIBUTING.md` (including fork instructions for external contributors), issue/PR templates (Conventional Commits checkbox, build-plan task-code hint, split money-path checkboxes), labels, `LICENSE`, a Husky commit-msg hook that explains *why* a commit was rejected instead of printing bare rule codes | S | Set up with the GrantFox contributor phase in mind |
| S07 | Sign-In With Stellar (SEP-0043 `signMessage`) + optional email on `Wallet`, replacing the unverified session cookie from S05 | M | See ADR-005 "Triggered (S07)". Unlocks U12/U13 (persistent, verified per-wallet views) and T03 (email notifications). Additive — no money-moving action starts trusting this session |

## Phase 2 — Core system (event lifecycle, backend, real-time tracking)

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| E01 | Go `EscrowClient`: wraps the escrow contract via the Stellar Go SDK, exposes an internal API `apps/web` calls for anything escrow-related — the frontend never talks to the contract directly | L → split | Lives in `services/core-go`. K02 already validated the underlying simulate→sign→submit→poll mechanics this wraps |
| E02 | Go build-sign-submit pipeline backed by `OpLog`: idempotency rules — only a terminal `SUCCEEDED` status is final, `PENDING`/`FAILED` are always retryable; resubmitting an identical signed transaction is safe at the Stellar/Horizon layer, `OpLog` exists for audit trail and to avoid redundant calls, not to prevent double-payment on its own | M | |
| E03 | Event + prize state machine, with the manual-start rule built in from the start: `draft → standby → active → finished`. Track `conditionsMetAt` (derived: prize wallet funded **and** minimum participants registered) as distinct from `status = active` — the event **never** auto-activates on conditions being met; activation only happens via an explicit admin action (`POST /events/:id/start`). Guard every transition against races (conditional update keyed on expected `from` status) | M | Building this in from day one is simpler than retrofitting it later |
| E04 | Real-time tracking: as participants/judges update progress or scores, push updates to the frontend (Postgres `LISTEN`/`NOTIFY`, or Redis pub/sub if that's cleaner from S01, streamed to `apps/web` via WebSocket/SSE) | M | Decide the transport mechanism here — don't default to WebSockets without checking whether SSE is simpler given Next.js hosting |
| E05 | Reconciliation: stalled-transaction detection + Horizon transaction confirmation, comparing the Postgres mirror tables against on-chain state | M | Ships in the same phase as the first real money operation — never defer this once payouts are live |
| E06 | Trustline verification: check at participant registration and again at winner assignment that the payout wallet can actually receive the prize asset | S | A missing account on the ledger (no XLM yet) should be treated as "no trustline," not an error |
| E07 | Vertical slice demo: create event → fund → register participants → admin starts event → track in real time → assign winner → approve → release payout → reconcile, on real testnet | M | Milestone: **the product's core guarantee works**, verified end-to-end before building UI polish on top |

## Milestone — Apply to GrantFox as maintainer

Once Phases 0–2 are done, the core promise (registration, real-time tracking, and an on-chain payout that actually reaches the winner's wallet) is proven end-to-end. That's the point to apply — everything after this is UI, edge cases, and hardening, meant to be built with contributors rather than before them.

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| L00 | ✅ **Done** — Minimal shell: `SiteHeader` (transparent, full-width, floats over the hero — logo, GitHub link, wallet connect), `SiteFooter` (repo/docs/license links), left-aligned hero copy (eyebrow + serif wordmark), React Bits Prism background full-bleed with the shape pushed right via its `offset` prop | S | `SiteHeader`'s transparent style only works while the hero page is the only page — needs a solid variant before pages without a hero exist (see U08) |
| L01 | Deploy `apps/web` (Vercel or similar) and `services/core-go` (Docker + Railway/Fly.io/Render or a VPS); seed a standing demo event | S | The escrow contract deploys to Stellar testnet directly, not to the same host |

## Phase 3 — Product UI

**Contributor backlog opens here** once the milestone above is reached.

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| U01 | Event creation wizard: **Details → Prizes → Judges & Resolver → Participants → Review & Sign** (5 steps, see docs/product-flows.md's Flow 1 for the full breakdown of each) | L → split | Horizontal numbered stepper (completed steps marked, current one highlighted, future ones muted — back-navigation to any completed step without losing later steps' data). The prize step needs dynamic rows, not a fixed 1st/2nd/3rd form — the organizer picks how many positions get paid (1 through N) and the amount for each; same `create_event` prize-list, not a special mode (ADR-002/K06). Draft state between steps saves optimistically (no money moved yet); the final sign step is the one place that must show an honest confirming/pending state, never an assumed success (see the UX principles in product-flows.md) |
| U02 | Organizer dashboard: funding flow, event status, participant management. Shows a "Ready to start" state once `conditionsMetAt` is set, with an explicit "Start event" action calling the Go service — the event never activates on its own | M | Depends on E03 |
| U03 | Public event page: prize info, "verified on-chain" badge, contract link, payout history | M | SSR |
| U04 | Participant flow: register (trustline check), real-time progress view | M | |
| U05 | Judge panel: scoring/progress review, winner assignment, approval signing | M | |
| U06 | Payout flow UI + confirmation states ("pending on-chain" UX) | S | |
| U07 | Explorer links (stellar.expert) + tx hash display components | S | GFI |
| U08 | Marketing homepage: expand L00's hero, "see it in action," "how it works," primary CTA; design `SiteHeader`'s solid (non-transparent) variant for the new non-hero pages landing around this time | M | Add the hero question ("are you here as a participant or organizer?") routing to `/participant` or `/organizer` — same app, route-based sections, not separate domains yet. See docs/product-flows.md's "Future direction" section for the deferred per-audience-subdomain plan |
| U09 | Site-wide technical SEO + social cards: `robots.ts`, `sitemap.ts`, root Open Graph/Twitter Card metadata + a default OG image | S | GFI. Self-contained — works against L00's homepage today, doesn't need any later page to land first |
| U10 | Per-event SEO: dynamic metadata, OG image, `schema.org/Event` JSON-LD | M | Depends on U03 |
| U11 | QR code on the public event page for organizers to share (deep-links to U03) | S | GFI. Self-contained — needs only U03's public event page |
| U12 | Persistent "my events" view: every event a connected wallet is registered in or judging, with a live countdown to the next relevant deadline (registration close, judging deadline) | M | Depends on S07 (needs a verified session to be trustworthy across devices, not just the current browser's cookie) |
| U13 | Participant earnings view: past payouts received across events, wallet-scoped | S | Depends on S07. Reads `Payout` joined on the verified `Wallet.id` |
| U14 | In-app submission checklist: participant-tracked task list against their submission, with a completion percentage shown to the participant (and optionally the organizer) | M | Depends on U04. Checklist items can be organizer-defined per event or participant-defined — decide which in the PR, document the choice |
| U15 | PWA: web manifest, service worker (offline shell + cache-first static assets), installable on mobile/desktop | M | Self-contained on top of L00's shell. Participants often check event status from their phone mid-event — installable + resilient-to-flaky-wifi matters more here than for a typical marketing site |
| U16 | Spanish translation & i18n QA pass: review every key in `apps/web/messages/es.json` against `en.json`, fix machine-literal or awkward phrasing, fill in anything still stubbed with English placeholder text | S | **Requires fluency in both Spanish and English** — most contributors picking up Phase 3 UI tasks add their new strings in English plus an English placeholder in `es.json` (see the issue template's I18n field), so this doesn't block them; it's the sweep that makes the `/es` experience actually read naturally instead of just parsing. Living task — reopen/repeat as more Phase 3 UI ships |
| U17 | Optional organizer-defined registration questions: a toggle in U01's "Participants" step, off by default (one-click registration stays the default). If enabled, the organizer adds simple custom fields (text / single-select / yes-no) that a participant fills at registration | S | Depends on U01, U04. Not a general form-builder — keep the field types minimal |

## Phase 4 — Trust & edge cases

**Contributor backlog continues.**

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| T01 | Dispute flow: open, evidence, resolver signing, resolution record | L → split | Built against the contract's `dispute`/`resolve-dispute` functions |
| T02 | Event cancellation + refund flow | M | |
| T03 | Notifications on state changes — email, triggered from the Go service | M | GFI-able parts. See docs/architecture.md ADR-007 for the provider choice, the full trigger list, and the testing strategy. **Depends on Astrea owning a verified custom domain** (not just the Vercel subdomain) — buying/verifying that is a cheap, no-dependency task that should happen before this is picked up, not the day someone starts coding it |
| T04 | E2E tests on testnet for the money paths (fund→release; dispute) | M | |

## Phase 5 — Hardening

**Contributor backlog, final stretch — before this ships, mainnet planning starts as its own phase.**

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| L02 | Security pass: Go service secrets/config audit, transaction-matching checks, row-level access control review | M | Contract-specific security review is a separate, mandatory task — see [docs/contracts-build-plan.md](contracts-build-plan.md) |
| L03 | Observability: structured logs with tx hashes (Go service), reconciliation drift alerts | S | |

## Sequencing rules

1. K02/K03 before Phase 1 — confirming the app/backend can actually talk to the contract and that target wallets can sign for it is cheaper to learn now than after S01 is built on top of an assumption.
2. E05 (reconciliation) ships in the same phase as the first real money operation, never later.
3. The GrantFox application happens right after Phase 2, not after Phases 3–4 — those phases are the contributor-facing backlog the application is *for*, not a prerequisite to it.
4. E03's manual-start rule is part of the state machine from the start — U02 has nothing to call without it, so E03 must be complete before U02 is picked up.
5. Mainnet is out of scope for every task above; it gets its own phase after real testnet usage, gated by [docs/contracts-build-plan.md](contracts-build-plan.md)'s security pass.
