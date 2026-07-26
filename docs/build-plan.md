# Astrea — Build Plan

Phased plan with coded tasks. Each task becomes one GitHub issue with its code in the title (e.g., `[S03] Prisma schema and Supabase setup`). Sizes: S (≤half day), M (1–2 days), L (3+ days, should be split before assignment). `GFI` = good first issue candidate.

## Phase 0 — Spike (de-risk before anything else)

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| K01 | ✅ **Done (2026-07-24)** — Trustless Work testnet spike: deploy, fund, approve, and release a multi-release escrow end-to-end with a script — confirmed the judge (approver + releaseSigner) can release as sole signer and the funder cannot withdraw funded amounts; findings in [spikes/k01-trustless-work](../spikes/k01-trustless-work/README.md) | M | **Gated the whole plan.** Confirmed the role model behind ADR-003; also surfaced that the public docs site was stale (use live `/docs-json` spec) and a 0.3% protocol fee (ADR-005) |
| K02 | ✅ **Done** — ADR-003 corrected and ADR-005 added from spike findings | S | See docs/architecture.md |
| K03 | ✅ **Done** — confirmed the ADR-005 fee rate (fixed 0.3%, hardcoded in the Soroban contract, charged per milestone release, on top of `platformFee`) against the official Trustless Work whitepaper (§7, Fees & Economics) — no Discord ask needed, their worked example matched our spike result exactly | S | See ADR-005 |

## Phase 1 — Foundations

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| S01 | ✅ **Done** — Repo scaffold: Next.js + TypeScript strict + Tailwind + shadcn/ui, Biome, Husky + commitlint (Conventional Commits) | M | Mirrors GrantFox-family conventions |
| S02 | ✅ **Done** — CI: GitHub Actions — build, lint, test on PR | S | GFI |
| S03 | ✅ **Done** — Prisma schema + Supabase setup (`Event`, `Prize`, `Judge`, `Submission`, `Wallet`, `Payout`, `OpLog`) + RLS | M | |
| S04 | ✅ **Done** — Environment config module: network, USDC issuer, TW base URL/key (server-only), boot-time validation | S | See src/lib/env.ts |
| S05 | ✅ **Done (2026-07-26)** — Wallet connect with Stellar Wallets Kit (Freighter, Albedo, xBull, LOBSTR) + session association | M | See ADR-006. API turned out to be a static-class v2.5.0 rewrite, not the instance-based API in every tutorial/doc found — verified against the installed package's own `.d.ts` files |
| S06 | ✅ **Done** — `.env.example`, CONTRIBUTING.md, issue/PR templates, labels | S | Also filled two gaps found along the way: missing `LICENSE` file, and README's Contributing section still said "will use Biome" in future tense |

## Phase 2 — Escrow core (vertical slice)

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| E01 | ✅ **Done (2026-07-26)** — `EscrowProvider` port + `TrustlessWorkAdapter` (deploy, fund, approve, release, dispute, resolve-dispute, reads) + `buildForwardPaymentXdr` (plain Stellar payment, judge → winner) + `fees.ts` (ADR-005 fee math, incl. the opt-in cover-the-fee calculator) | L → split | See `src/lib/escrow/`. Domain never imports TW types directly. `submitSignedTransaction` computes the tx hash locally from the signed XDR rather than trusting the API response (Principle 2). Added `vitest.setup.ts` — first real consumer of `env.ts`'s boot validation, tests need dummy TW_API_KEY/USDC_ISSUER |
| E02 | ✅ **Done (2026-07-26)** — Build-sign-submit pipeline: `prepareOperation`/`submitOperation` in `src/lib/escrow/pipeline.ts`, backed by `OpLog` | M | Idempotency rules (`idempotency.ts`) are pure and unit-tested: only `SUCCEEDED` is terminal, `PENDING`/`FAILED` are always retryable. Resubmitting the identical signed XDR twice is safe at the Stellar/Horizon layer (idempotent per tx hash) — `OpLog` avoids redundant calls and keeps the audit trail, it isn't what prevents double-payment |
| E03 | Event + prize state machines with server-side transition validation | M | |
| E04 | Reconciliation job: TW indexed events vs mirror tables; heal + alert | M | **In this phase on purpose** — money ops and reconciliation ship together |
| E05 | Trustline verification service (check at registration + winner assignment) | S | |
| E06 | Vertical slice demo: script or minimal UI — create event → fund → assign → approve → release on testnet | M | Milestone: **the product guarantee works** |

## Milestone — Apply to GrantFox as maintainer

**This is where solo work ends and the contributor phase begins.** Everything above (Phases 0–2) is built alone — it has to be, it's the part that proves the product's core promise actually works. Everything below (Phases 3–4, and the rest of Phase 5) is deliberately left as the open backlog GrantFox displays to contributors. Don't build ahead of this milestone; the whole point of applying here is that the UI, the edge cases, and the hardening get built *with* contributors, not *before* them.

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| L00 | Minimal shell — header (logo + wallet connect + GitHub link), footer (links), hero (existing tagline, optionally the React Bits **Prism** background from ui-motion.md) | S | **Not U08.** No Card Swap, Scroll Stack, or "how it works" section — those stay in the contributor backlog. This exists only so L01's deployed demo doesn't look like a bare scaffold |
| L01 | Deploy to Vercel (testnet demo) + seed demo event | S | |
| L02 | Demo video of the full flow | S | |
| L05 | GrantFox maintainer application: sync repo, complete project form | S | The point of it all |

## Phase 3 — Product UI

**Contributor backlog opens here.** These are meant to become GitHub issues a stranger can pick up — the [`build_plan_task` issue template](../.github/ISSUE_TEMPLATE/build_plan_task.yml) exists for exactly this.

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| U01 | Event creation wizard (details → prizes → judges → review & sign) — uses React Bits **Stepper** | L → split | See docs/ui-motion.md |
| U02 | Organizer dashboard: funding flow, escrow status, judge management | M | Funding flow includes the ADR-005 opt-in "cover the fee" toggle (see product-flows.md Flow 2) |
| U03 | Public event page: prizes, "verified on-chain" badge, contract link, payout history — prize cards wrapped in React Bits **Border Glow**; mobile bottom nav uses **Staggered Menu** + **Dock** (shape only, see ui-motion.md caveat) | M | SSR |
| U04 | Participant flow: register (trustline check), submit entry | M | |
| U05 | Judge panel: submissions review, winner assignment, approval signing | M | |
| U06 | Release flow UI + confirmation states ("pending on-chain" UX) | S | |
| U07 | Explorer links (stellar.expert) + tx hash display components | S | GFI |
| U08 | Marketing homepage: hero (React Bits **Prism** background, unmounted when scrolled past), "see it in action" (**Card Swap**), "how it works" (**Scroll Stack**), primary CTA (**Specular Button**, 1–2 max) | M | See docs/ui-motion.md for full rationale and the corrections to Dock/Tilted Card assumptions |

## Phase 4 — Trust & edge cases

**Contributor backlog continues.**

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| T01 | Dispute flow: open, evidence, resolver signing, resolution record | L → split | |
| T02 | Event cancellation + refund flow | M | |
| T03 | Notifications (email or in-app) on state changes | M | GFI-able parts |
| T04 | E2E tests on testnet for the money paths (deploy→fund→release; dispute) | M | |

## Phase 5 — Hardening

**Contributor backlog, final stretch — before this ships, mainnet planning starts as its own phase.**

| Code | Task | Size | Notes |
| --- | --- | --- | --- |
| L03 | Security pass: RLS review, secrets audit, XDR matching | M | |
| L04 | Observability: structured logs with tx hashes, reconciliation drift alerts | S | |

## Sequencing rules

1. K01 before everything — if the spike falsifies an assumption, ADRs change while changing docs is still cheap.
2. E04 (reconciliation) ships in the same phase as the first money operation, never later.
3. The GrantFox application (L01, L02, L05) happens **right after Phase 2**, not after Phases 3–4 — those phases are the contributor-facing backlog the application is *for*, not a prerequisite to it. Keep Phase 3–5 tasks small, labeled, and well-described; they are what GrantFox displays.
4. Mainnet is out of scope for every task above; it gets its own phase after real testnet usage.
