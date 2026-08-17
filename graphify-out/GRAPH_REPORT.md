# Graph Report - astrea  (2026-08-17)

## Corpus Check
- 88 files · ~265,573 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 705 nodes · 837 edges · 136 communities (39 shown, 97 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `24b29953`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devDependencies
- pipeline.ts
- k01-soroban-escrow
- k03-ping
- provider.tsx
- web/biome.json
- trustless-work-adapter.ts
- biome.json
- e06-vertical-slice.ts
- build-plan.md
- components.json
- EscrowContract
- Custom Soroban escrow contract
- compilerOptions
- main.go
- Database setup
- dependencies
- apply.ts
- Astrea — UI motion & React Bits components
- Contributing to Astrea
- test.rs
- scripts
- Astrea — Architecture
- soroban/README.md
- k03-wallet-compat/web/package.json
- core-go/README.md
- 🌠 Astrea
- Astrea — Build Plan
- compilerOptions
- Astrea — Product Flows
- K03 (server-build-plan.md) — wallet compatibility check
- Astrea — Contracts Build Plan
- PULL_REQUEST_TEMPLATE.md
- post-commit
- K01 (server-build-plan.md) — custom Soroban escrow spike
- .ping
- main.ts
- next.config.ts
- postcss.config.mjs
- Reconciliation Job
- K02 (server-build-plan.md) — Go ↔ Soroban integration spike
- post-checkout
- run-testnet-spike.sh
- AGENTS.md
- Astrea Payouts Logo (Dark Variant) - four-pointed star in circle mark with wordmark
- Astrea Payouts Logo (Light) - black lockup: four-pointed-star-in-circle mark + wordmark on white/transparent background
- Astrea Logo Mark (Light, black four-pointed star/compass in circle on radial gray gradient)
- Astrea Logo Mark (white four-point star/sparkle in glowing circle, on black)
- Astrea Payouts Logo Lockup (Light, Black Mark + Wordmark)
- Astrea Payouts Logo (side-by-side lockup, dark mark, light variant)
- Astrea Logo Lockup (light, trimmed) - dark starburst mark + wordmark on gradient background
- Astrea App Icon (circular mark, four-pointed star negative-space cutout, white/light monochrome)
- Bug Report Issue Template
- Issue Template Config
- astrea/k02-go-soroban
- Migration Baseline Gotcha
- Tasks E01-E03
- Task K01 (done)
- ADR-001: Custom Soroban Escrow Contract
- ADR-002: Multi-release Escrow, One Milestone Per Prize
- ADR-003: Organizer Is Not in the Payout Path
- ADR-004: Trustline Validation at Registration, Not Payout
- ADR-005: Wallet Connection Sets a UX Session, Not an Authorization Boundary
- EscrowClient Interface
- The Chain Is the Source of Truth
- Escrow Behind a Client Interface
- Idempotent Money Operations
- Non-custodial, Always
- Testnet by Default
- Task E01: Go EscrowClient
- Task E02: Go Build-Sign-Submit Pipeline
- Task E03: Event + Prize State Machine
- Task E05: Reconciliation
- Task K02: Go-Soroban Integration Spike
- Task K03: Wallet Compatibility Check
- Task K04: Fold K03 Results into ADR-005
- Task L00: Minimal Shell
- Task S01: Monorepo Scaffold
- Task S05: Wallet Connect (Frontend)
- Task S06: Contributor Docs & Templates
- Task U02: Organizer Dashboard
- Contracts Task E01: Multi-milestone Escrow Contract
- Contracts Task K01: Escrow Contract Spike
- Contracts Task L01: Security Pass
- Dispute Resolver Must Be Independent of the Judge
- Dispute Resolver Role
- Judge Role
- Organizer Role
- Participant Role
- Light Pillar (React Bits Background, Reverted)
- Prism (React Bits Hero Background)
- SiteHeader Component
- Albedo wallet
- Backend layer (Go service)
- Blockchain layer (Stellar/Soroban)
- Database layer (Postgres/Supabase/Prisma mirror)
- Frontend layer (Next.js App Router)
- Christopher Lamberti (Maintainer)
- Fast payouts (principle)
- Freighter wallet
- Fully auditable (principle)
- GitHub Actions
- Go language
- LOBSTR wallet
- Locked before launch (principle)
- MIT License
- Next.js (App Router)
- Non-custodial (principle)
- PostgreSQL
- Prisma ORM
- Reconciliation job (chain as source of truth)
- shadcn/ui
- Stellar testnet
- Stellar Wallets Kit
- Supabase
- Tailwind CSS
- TypeScript (strict)
- USDC
- Vercel
- Verifiable by anyone (principle)
- xBull wallet
- Participant registration
- Real-time tracking
- Reconciliation (core-go)
- Event/prize state machine
- Tasks E01-E06
- Task S01
- Transaction pipeline
- ADR-008 (referenced in K01 spike, corresponds to current ADR-001)
- K01 Soroban Escrow Contract (CBFPD4YF...)
- K02 Go-Soroban Contract (CC76XEKP...)

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `main()` - 15 edges
3. `EscrowContract` - 15 edges
4. `scripts` - 13 edges
5. `main()` - 12 edges
6. `🌠 Astrea` - 11 edges
7. `EscrowProvider` - 10 edges
8. `Astrea — Build Plan` - 10 edges
9. `main()` - 9 edges
10. `hasUsdcTrustline()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `submitOperation()`  [EXTRACTED]
  apps/web/scripts/e06-vertical-slice.ts → apps/web/src/lib/escrow/pipeline.ts
- `main()` --indirect_call--> `submitForwardPayment()`  [INFERRED]
  apps/web/scripts/e06-vertical-slice.ts → apps/web/src/lib/escrow/stellar-payment.ts
- `main()` --calls--> `submitOperation()`  [EXTRACTED]
  apps/web/scripts/seed-demo-event.ts → apps/web/src/lib/escrow/pipeline.ts
- `prepareOperation()` --calls--> `decidePrepare()`  [EXTRACTED]
  apps/web/src/lib/escrow/pipeline.ts → apps/web/src/lib/escrow/idempotency.ts
- `transitionEvent()` --calls--> `assertEventTransition()`  [EXTRACTED]
  apps/web/src/lib/state-machines/apply.ts → apps/web/src/lib/state-machines/event.ts

## Import Cycles
- None detected.

## Communities (136 total, 97 thin omitted)

### Community 0 - "devDependencies"
Cohesion: 0.07
Nodes (29): devDependencies, @biomejs/biome, @commitlint/cli, @commitlint/config-conventional, husky, lint-staged, tailwindcss, @tailwindcss/postcss (+21 more)

### Community 1 - "pipeline.ts"
Cohesion: 0.18
Nodes (14): decidePrepare(), decideSubmit(), OpRecord, PrepareDecision, SubmitDecision, PrepareOperationParams, PrepareOperationResult, readPayload() (+6 more)

### Community 11 - "provider.tsx"
Cohesion: 0.09
Nodes (20): geistMono, geistSans, metadata, PrismBackground(), PrismBackgroundProps, LINKS, SiteFooter(), SiteHeader() (+12 more)

### Community 13 - "web/biome.json"
Cohesion: 0.07
Nodes (27): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+19 more)

### Community 14 - "trustless-work-adapter.ts"
Cohesion: 0.09
Nodes (17): ROLES, trustlessWorkAdapter, ApproveMilestoneParams, DeployEscrowParams, DisputeMilestoneParams, Distribution, EscrowMilestoneInput, EscrowMilestoneState (+9 more)

### Community 15 - "biome.json"
Cohesion: 0.07
Nodes (26): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+18 more)

### Community 16 - "e06-vertical-slice.ts"
Cohesion: 0.05
Nodes (54): accounts, findOrCreateWallet(), Keys, main(), signXdr(), step(), ADR-0007, accounts (+46 more)

### Community 18 - "build-plan.md"
Cohesion: 0.31
Nodes (4): Build Plan Task Issue Template, Money-Path Change Requires Security Label & Extra Review, K03 Ping Test Contract (CDIWLY6A...), K03 Wallet Compat Test Page

### Community 19 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 20 - "EscrowContract"
Cohesion: 0.32
Nodes (7): Option, Result, DataKey, Error, EscrowContract, Address, Env

### Community 22 - "compilerOptions"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 23 - "main.go"
Cohesion: 0.20
Nodes (20): context.Context, github.com/stellar/go/clients/horizonclient.Client, github.com/stellar/go/clients/rpcclient.Client, github.com/stellar/go/keypair.Full, github.com/stellar/go/xdr.HostFunction, github.com/stellar/go/xdr.ScAddress, github.com/stellar/go/xdr.ScVal, addressArg() (+12 more)

### Community 24 - "Database setup"
Cohesion: 0.33
Nodes (5): Database setup, Environment variables, Everyday commands, ⚠️ Migration baseline (read before running `prisma migrate dev`), RLS model

### Community 25 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, @base-ui/react, class-variance-authority, clsx, @creit.tech/stellar-wallets-kit, lucide-react, next, ogl (+29 more)

### Community 27 - "apply.ts"
Cohesion: 0.20
Nodes (10): TransitionPrizeExtra, ADR-0007, InvalidTransitionError, assertEventTransition(), canTransitionEvent(), EVENT_TRANSITIONS, assertPrizeTransition(), canTransitionPrize() (+2 more)

### Community 28 - "Astrea — UI motion & React Bits components"
Cohesion: 0.25
Nodes (6): Astrea — UI motion & React Bits components, Build-plan cross-references, Component placement, Corrections to the original placement assumptions, Hero background — decision, Principles

### Community 37 - "Contributing to Astrea"
Cohesion: 0.20
Nodes (10): Before you start, Code quality — enforced, not optional, Contributing to Astrea, Keeping the knowledge graph updated, License, Local setup, Opening a PR, Reporting a security issue (+2 more)

### Community 38 - "test.rs"
Cohesion: 0.13
Nodes (6): EscrowContractClient, Address, Env, Setup, StellarAssetClient, TokenClient

### Community 39 - "scripts"
Cohesion: 0.07
Nodes (26): engines, node, lint-staged, *.{js,jsx,ts,tsx,json,css,md}, name, overrides, axios, elliptic (+18 more)

### Community 40 - "Astrea — Architecture"
Cohesion: 0.12
Nodes (16): ADR-001 — Custom Soroban escrow contract, no third-party provider, ADR-002 — Multi-release escrow, one milestone per prize, ADR-003 — Organizer is not in the payout path, ADR-004 — Trustline validation at registration, not payout, ADR-005 — Wallet connection sets a UX session, not an authorization boundary, Architecture Decision Records, Astrea — Architecture, Deploy + fund (organizer) (+8 more)

### Community 44 - "k03-wallet-compat/web/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @creit.tech/stellar-wallets-kit, @stellar/stellar-sdk, devDependencies, typescript, vite, @creit.tech/stellar-wallets-kit, @stellar/stellar-sdk (+8 more)

### Community 46 - "🌠 Astrea"
Cohesion: 0.12
Nodes (16): 🏗️ Architecture, 🌠 Astrea, 🤝 Contributing, 📖 Documentation, Environment Variables, 🏁 Getting Started, 🚀 How It Works, 📄 License (+8 more)

### Community 47 - "Astrea — Build Plan"
Cohesion: 0.20
Nodes (10): Architecture summary, Astrea — Build Plan, Milestone — Apply to GrantFox as maintainer, Phase 0 — Spike (de-risk before anything else), Phase 1 — Foundations, Phase 2 — Core system (event lifecycle, backend, real-time tracking), Phase 3 — Product UI, Phase 4 — Trust & edge cases (+2 more)

### Community 48 - "compilerOptions"
Cohesion: 0.15
Nodes (12): ES2022, main.ts, compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck (+4 more)

### Community 50 - "Astrea — Product Flows"
Cohesion: 0.22
Nodes (9): Astrea — Product Flows, Event state machine, Flow 1 — Organizer creates an event, Flow 2 — Organizer funds the prize pool, Flow 3 — Participants join and submit, Flow 4 — Judging and payout, Flow 5 — Dispute, Non-goals for the MVP (+1 more)

### Community 53 - "K03 (server-build-plan.md) — wallet compatibility check"
Cohesion: 0.29
Nodes (6): How to run, K03 (server-build-plan.md) — wallet compatibility check, Next step, Research finding (before touching any code), The test contract, What happens with the results

### Community 55 - "Astrea — Contracts Build Plan"
Cohesion: 0.40
Nodes (5): Astrea — Contracts Build Plan, Phase 0 — Spike (de-risk before anything else), Phase 1 — Production contract, Phase 2 — Hardening (before mainnet), Sequencing rules

### Community 56 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.40
Nodes (4): Docs, How I verified it, Money-path change?, What this does

### Community 57 - "post-commit"
Cohesion: 0.40
Nodes (4): post-commit script, GRAPHIFY_CHANGED, GRAPHIFY_REBUILD_LOG, PYTHONHASHSEED

### Community 59 - "K01 (server-build-plan.md) — custom Soroban escrow spike"
Cohesion: 0.40
Nodes (5): Findings folded into ADR-008, How to run, K01 (server-build-plan.md) — custom Soroban escrow spike, Next step, What it verifies — results

### Community 63 - ".ping"
Cohesion: 0.40
Nodes (3): PingContract, Address, Env

### Community 64 - "main.ts"
Cohesion: 0.50
Nodes (3): log(), logEl, runCheck()

### Community 77 - "K02 (server-build-plan.md) — Go ↔ Soroban integration spike"
Cohesion: 0.40
Nodes (5): Findings folded into ADR-008, How to run, K02 (server-build-plan.md) — Go ↔ Soroban integration spike, Next step, What it verifies — results

### Community 78 - "post-checkout"
Cohesion: 0.50
Nodes (3): post-checkout script, GRAPHIFY_REBUILD_LOG, PYTHONHASHSEED

## Knowledge Gaps
- **354 isolated node(s):** `$schema`, `root`, `enabled`, `clientKind`, `useIgnoreFile` (+349 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **97 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `🌠 Astrea` connect `🌠 Astrea` to `build-plan.md`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `$schema`, `root`, `enabled` to the rest of the system?**
  _354 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `provider.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0907563025210084 - nodes in this community are weakly interconnected._
- **Should `web/biome.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._