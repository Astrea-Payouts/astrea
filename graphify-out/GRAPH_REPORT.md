# Graph Report - astrea  (2026-08-17)

## Corpus Check
- 126 files · ~329,354 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1871 nodes · 1995 edges · 184 communities (56 shown, 128 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fa8c0565`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Prisma Event Model Types
- Prisma Client Internals
- Prisma Prize Model Types
- Prisma Wallet Model Types
- Prisma Submission Model Types
- Prisma User Model Types
- Prisma Payout Model Types
- Prisma Judge Model Types
- Prisma Common Input Filters
- Prisma OpLog Model Types
- Prisma Client Entry Point
- App Layout & Wallet Provider
- Prisma Browser Client
- Web App Biome Config
- Trustless Work Adapter (Legacy)
- Repo Root Biome Config
- E06 Vertical Slice Demo Script
- Demo Event Seed Script
- Architecture & Build-Plan Docs
- shadcn/ui Components Config
- K01 Soroban Escrow Contract
- README Overview & Principles
- Web App TypeScript Config
- K02 Go-Soroban Client
- Architecture & Build-Plan Docs
- Web App Dependencies
- Escrow Pipeline & Idempotency
- Event/Prize State Machines
- Architecture & Build-Plan Docs
- Prisma Event Delegate Methods
- Prisma Judge Delegate Methods
- Prisma OpLog Delegate Methods
- Prisma Payout Delegate Methods
- Prisma Prize Delegate Methods
- Prisma Submission Delegate Methods
- Prisma User Delegate Methods
- Prisma Wallet Delegate Methods
- CONTRIBUTING Guide & Code Quality
- K01 Contract Test Suite
- Web App Dev Dependencies
- K01 Trustless-Work Spike Deps
- Web App npm Scripts
- Reconciliation & DB Client
- TW Spike Runner Script
- K03 Wallet-Compat Web Deps
- Escrow-to-Backend Money Path
- 🌠 Astrea
- Astrea — Build Plan
- K03 Wallet-Compat TS Config
- EscrowProvider Interface
- Astrea — Product Flows
- Prisma Event Client Relations
- Web App Package Metadata
- K03 (server-build-plan.md) — wallet compatibility check
- Prisma Wallet Client Relations
- Astrea — Contracts Build Plan
- PULL_REQUEST_TEMPLATE.md
- post-commit
- Prisma Prize Client Relations
- K01 (server-build-plan.md) — custom Soroban escrow spike
- Prisma Submission Client Relations
- Prisma User Client Relations
- Dependency Version Overrides
- K03 Ping Test Contract
- K03 Wallet Test Harness UI
- Prisma Judge Client Relations
- Prisma Payout Client Relations
- Prisma OpLog Client Relations
- Husky Shell Helper
- Husky PATH Helper
- Prisma Client Base Options
- Next.js Config
- PostCSS Config
- Reconciliation Job (Doc)
- Husky applypatch-msg Hook
- Husky commit-msg Hook
- Husky post-applypatch Hook
- Husky post-checkout Hook
- Husky post-commit Hook
- Husky post-merge Hook
- Husky post-rewrite Hook
- Husky pre-applypatch Hook
- Husky pre-auto-gc Hook
- Husky pre-commit Hook
- Husky pre-merge-commit Hook
- Husky pre-push Hook
- Husky pre-rebase Hook
- Husky prepare-commit-msg Hook
- K01 Testnet Spike Script
- AGENTS.md
- Astrea Logo (Dark)
- Astrea Logo (Light)
- Astrea Logo Mark (Light)
- Astrea Logo Mark (White)
- Astrea Sided Logo v2
- Astrea Sided Logo (Light)
- Astrea Sided Logo (Trimmed)
- Astrea App Favicon
- Bug Report Template
- Issue Template Config
- Go Module Definition
- post-checkout
- post-commit
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
1. `PrismaClient` - 18 edges
2. `EventDelegate` - 18 edges
3. `JudgeDelegate` - 18 edges
4. `OpLogDelegate` - 18 edges
5. `PayoutDelegate` - 18 edges
6. `PrizeDelegate` - 18 edges
7. `SubmissionDelegate` - 18 edges
8. `UserDelegate` - 18 edges
9. `WalletDelegate` - 18 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `prepareOperation()`  [EXTRACTED]
  apps/web/scripts/e06-vertical-slice.ts → apps/web/src/lib/escrow/pipeline.ts
- `main()` --calls--> `submitOperation()`  [EXTRACTED]
  apps/web/scripts/e06-vertical-slice.ts → apps/web/src/lib/escrow/pipeline.ts
- `main()` --indirect_call--> `submitForwardPayment()`  [INFERRED]
  apps/web/scripts/e06-vertical-slice.ts → apps/web/src/lib/escrow/stellar-payment.ts
- `main()` --calls--> `findStalledForwardsInDb()`  [EXTRACTED]
  apps/web/scripts/e06-vertical-slice.ts → apps/web/src/lib/reconciliation/run.ts
- `main()` --calls--> `transitionEvent()`  [EXTRACTED]
  apps/web/scripts/e06-vertical-slice.ts → apps/web/src/lib/state-machines/apply.ts

## Import Cycles
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/User.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/commonInputTypes.ts -> src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/commonInputTypes.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Judge.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Prize.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Event.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/OpLog.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Payout.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Submission.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Wallet.ts -> src/generated/prisma/internal/prismaNamespace.ts`

## Communities (184 total, 128 thin omitted)

### Community 0 - "Prisma Event Model Types"
Cohesion: 0.02
Nodes (128): AggregateEvent, EnumEventStatusFieldUpdateOperationsInput, EnumStellarNetworkFieldUpdateOperationsInput, Event$judgesArgs, Event$prizesArgs, Event$submissionsArgs, EventAggregateArgs, EventCountAggregateInputType (+120 more)

### Community 1 - "Prisma Client Internals"
Cohesion: 0.02
Nodes (123): Args, At, AtLeast, AtLoose, AtStrict, BatchPayload, Boolean, Bytes (+115 more)

### Community 2 - "Prisma Prize Model Types"
Cohesion: 0.02
Nodes (115): AggregatePrize, DecimalFieldUpdateOperationsInput, EnumPrizeStatusFieldUpdateOperationsInput, GetPrizeAggregateType, GetPrizeGroupByPayload, IntFieldUpdateOperationsInput, Prize$payoutsArgs, Prize$winnerWalletArgs (+107 more)

### Community 3 - "Prisma Wallet Model Types"
Cohesion: 0.02
Nodes (113): AggregateWallet, GetWalletAggregateType, GetWalletGroupByPayload, NullableDateTimeFieldUpdateOperationsInput, ADR-0003, Wallet$organizedEventsArgs, Wallet$submissionsArgs, Wallet$wonPrizesArgs (+105 more)

### Community 4 - "Prisma Submission Model Types"
Cohesion: 0.02
Nodes (88): AggregateSubmission, GetSubmissionAggregateType, GetSubmissionGroupByPayload, SubmissionAggregateArgs, SubmissionCountAggregateInputType, SubmissionCountAggregateOutputType, SubmissionCountArgs, SubmissionCountOrderByAggregateInput (+80 more)

### Community 5 - "Prisma User Model Types"
Cohesion: 0.02
Nodes (83): AggregateUser, DateTimeFieldUpdateOperationsInput, GetUserAggregateType, GetUserGroupByPayload, StringFieldUpdateOperationsInput, User$organizedEventsArgs, User$walletsArgs, UserAggregateArgs (+75 more)

### Community 6 - "Prisma Payout Model Types"
Cohesion: 0.02
Nodes (80): AggregatePayout, GetPayoutAggregateType, GetPayoutGroupByPayload, PayoutAggregateArgs, PayoutAvgAggregateInputType, PayoutAvgAggregateOutputType, PayoutAvgOrderByAggregateInput, PayoutCountAggregateInputType (+72 more)

### Community 7 - "Prisma Judge Model Types"
Cohesion: 0.03
Nodes (76): AggregateJudge, EnumJudgeStatusFieldUpdateOperationsInput, GetJudgeAggregateType, GetJudgeGroupByPayload, JudgeAggregateArgs, JudgeCountAggregateInputType, JudgeCountAggregateOutputType, JudgeCountArgs (+68 more)

### Community 8 - "Prisma Common Input Filters"
Cohesion: 0.04
Nodes (53): DateTimeFilter, DateTimeNullableFilter, DateTimeNullableWithAggregatesFilter, DateTimeWithAggregatesFilter, DecimalFilter, DecimalWithAggregatesFilter, EnumEventStatusFilter, EnumEventStatusWithAggregatesFilter (+45 more)

### Community 9 - "Prisma OpLog Model Types"
Cohesion: 0.04
Nodes (53): AggregateOpLog, EnumOpStatusFieldUpdateOperationsInput, GetOpLogAggregateType, GetOpLogGroupByPayload, OpLogAggregateArgs, OpLogCountAggregateInputType, OpLogCountAggregateOutputType, OpLogCountArgs (+45 more)

### Community 10 - "Prisma Client Entry Point"
Cohesion: 0.05
Nodes (17): @prisma/client, $Enums, Event, Judge, OpLog, Payout, PrismaClient, Prize (+9 more)

### Community 11 - "App Layout & Wallet Provider"
Cohesion: 0.09
Nodes (20): geistMono, geistSans, metadata, PrismBackground(), PrismBackgroundProps, LINKS, SiteFooter(), SiteHeader() (+12 more)

### Community 12 - "Prisma Browser Client"
Cohesion: 0.06
Nodes (32): $Enums, Event, Judge, OpLog, Payout, Prize, Submission, ADR-0003 (+24 more)

### Community 13 - "Web App Biome Config"
Cohesion: 0.07
Nodes (27): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+19 more)

### Community 14 - "Trustless Work Adapter (Legacy)"
Cohesion: 0.11
Nodes (20): ROLES, trustlessWorkAdapter, ApproveMilestoneParams, DeployEscrowParams, DisputeMilestoneParams, Distribution, EscrowMilestoneInput, EscrowMilestoneState (+12 more)

### Community 15 - "Repo Root Biome Config"
Cohesion: 0.07
Nodes (26): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+18 more)

### Community 16 - "E06 Vertical Slice Demo Script"
Cohesion: 0.13
Nodes (18): accounts, findOrCreateWallet(), Keys, main(), signXdr(), step(), ADR-0007, amountToFundForExactNet() (+10 more)

### Community 17 - "Demo Event Seed Script"
Cohesion: 0.15
Nodes (15): accounts, findOrCreateWallet(), Keys, main(), signXdr(), step(), env, serverSchema (+7 more)

### Community 18 - "Architecture & Build-Plan Docs"
Cohesion: 0.31
Nodes (4): Build Plan Task Issue Template, Money-Path Change Requires Security Label & Extra Review, K03 Ping Test Contract (CDIWLY6A...), K03 Wallet Compat Test Page

### Community 19 - "shadcn/ui Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 20 - "K01 Soroban Escrow Contract"
Cohesion: 0.32
Nodes (7): Option, DataKey, Error, EscrowContract, Address, Env, Result

### Community 22 - "Web App TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 23 - "K02 Go-Soroban Client"
Cohesion: 0.22
Nodes (19): Client, Context, Full, HostFunction, ScAddress, ScVal, addressArg(), contractScAddress() (+11 more)

### Community 24 - "Architecture & Build-Plan Docs"
Cohesion: 0.33
Nodes (5): Database setup, Environment variables, Everyday commands, ⚠️ Migration baseline (read before running `prisma migrate dev`), RLS model

### Community 25 - "Web App Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @base-ui/react, class-variance-authority, clsx, @creit.tech/stellar-wallets-kit, lucide-react, next, ogl (+10 more)

### Community 26 - "Escrow Pipeline & Idempotency"
Cohesion: 0.19
Nodes (15): decidePrepare(), decideSubmit(), OpRecord, PrepareDecision, SubmitDecision, prepareOperation(), PrepareOperationParams, PrepareOperationResult (+7 more)

### Community 27 - "Event/Prize State Machines"
Cohesion: 0.18
Nodes (12): transitionEvent(), transitionPrize(), TransitionPrizeExtra, ADR-0007, InvalidTransitionError, assertEventTransition(), canTransitionEvent(), EVENT_TRANSITIONS (+4 more)

### Community 28 - "Architecture & Build-Plan Docs"
Cohesion: 0.25
Nodes (6): Astrea — UI motion & React Bits components, Build-plan cross-references, Component placement, Corrections to the original placement assumptions, Hero background — decision, Principles

### Community 37 - "CONTRIBUTING Guide & Code Quality"
Cohesion: 0.20
Nodes (10): Before you start, Code quality — enforced, not optional, Contributing to Astrea, Keeping the knowledge graph updated, License, Local setup, Opening a PR, Reporting a security issue (+2 more)

### Community 38 - "K01 Contract Test Suite"
Cohesion: 0.13
Nodes (6): EscrowContractClient, Address, Env, Setup, StellarAssetClient, TokenClient

### Community 39 - "Web App Dev Dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, @biomejs/biome, @commitlint/cli, @commitlint/config-conventional, lint-staged, tailwindcss, @tailwindcss/postcss, tsx (+6 more)

### Community 40 - "K01 Trustless-Work Spike Deps"
Cohesion: 0.12
Nodes (16): ADR-001 — Custom Soroban escrow contract, no third-party provider, ADR-002 — Multi-release escrow, one milestone per prize, ADR-003 — Organizer is not in the payout path, ADR-004 — Trustline validation at registration, not payout, ADR-005 — Wallet connection sets a UX session, not an authorization boundary, Architecture Decision Records, Astrea — Architecture, Deploy + fund (organizer) (+8 more)

### Community 41 - "Web App npm Scripts"
Cohesion: 0.15
Nodes (13): scripts, build, demo:e06, demo:seed, dev, format, lint, lint:fix (+5 more)

### Community 42 - "Reconciliation & DB Client"
Cohesion: 0.21
Nodes (8): globalForPrisma, findStalledForwardsInDb(), ADR-0007, findStalledForwards(), ReleasedPrize, StalledForwardAlert, NOW, ADR-0007

### Community 44 - "K03 Wallet-Compat Web Deps"
Cohesion: 0.15
Nodes (12): dependencies, @creit.tech/stellar-wallets-kit, @stellar/stellar-sdk, devDependencies, typescript, vite, name, private (+4 more)

### Community 46 - "🌠 Astrea"
Cohesion: 0.12
Nodes (16): 🏗️ Architecture, 🌠 Astrea, 🤝 Contributing, 📖 Documentation, Environment Variables, 🏁 Getting Started, 🚀 How It Works, 📄 License (+8 more)

### Community 47 - "Astrea — Build Plan"
Cohesion: 0.20
Nodes (10): Architecture summary, Astrea — Build Plan, Milestone — Apply to GrantFox as maintainer, Phase 0 — Spike (de-risk before anything else), Phase 1 — Foundations, Phase 2 — Core system (event lifecycle, backend, real-time tracking), Phase 3 — Product UI, Phase 4 — Trust & edge cases (+2 more)

### Community 48 - "K03 Wallet-Compat TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 50 - "Astrea — Product Flows"
Cohesion: 0.22
Nodes (9): Astrea — Product Flows, Event state machine, Flow 1 — Organizer creates an event, Flow 2 — Organizer funds the prize pool, Flow 3 — Participants join and submit, Flow 4 — Judging and payout, Flow 5 — Dispute, Non-goals for the MVP (+1 more)

### Community 52 - "Web App Package Metadata"
Cohesion: 0.25
Nodes (7): engines, node, lint-staged, *.{js,jsx,ts,tsx,json,css,md}, name, private, version

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
Nodes (4): GRAPHIFY_CHANGED, GRAPHIFY_REBUILD_LOG, post-commit script, PYTHONHASHSEED

### Community 59 - "K01 (server-build-plan.md) — custom Soroban escrow spike"
Cohesion: 0.40
Nodes (5): Findings folded into ADR-008, How to run, K01 (server-build-plan.md) — custom Soroban escrow spike, Next step, What it verifies — results

### Community 62 - "Dependency Version Overrides"
Cohesion: 0.40
Nodes (5): overrides, axios, elliptic, protobufjs, uuid

### Community 63 - "K03 Ping Test Contract"
Cohesion: 0.40
Nodes (3): PingContract, Address, Env

### Community 64 - "K03 Wallet Test Harness UI"
Cohesion: 0.50
Nodes (3): log(), logEl, runCheck()

### Community 70 - "Prisma Client Base Options"
Cohesion: 0.67
Nodes (3): PrismaClientBaseOptions, PrismaClientOptionsWithAccelerateUrl, PrismaClientOptionsWithAdapter

### Community 77 - "Husky post-checkout Hook"
Cohesion: 0.40
Nodes (5): Findings folded into ADR-008, How to run, K02 (server-build-plan.md) — Go ↔ Soroban integration spike, Next step, What it verifies — results

### Community 78 - "Husky post-commit Hook"
Cohesion: 0.50
Nodes (3): GRAPHIFY_REBUILD_LOG, post-checkout script, PYTHONHASHSEED

## Knowledge Gaps
- **1300 isolated node(s):** `husky.sh script`, `$schema`, `root`, `enabled`, `clientKind` (+1295 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **128 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `Prisma Client Entry Point` to `Web App Dependencies`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Web App Dependencies` to `Prisma Client Entry Point`, `Web App Package Metadata`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Web App Dev Dependencies` to `Web App Package Metadata`, `Husky Shell Helper`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `husky.sh script`, `$schema`, `root` to the rest of the system?**
  _1320 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Prisma Event Model Types` be split into smaller, more focused modules?**
  _Cohesion score 0.015503875968992248 - nodes in this community are weakly interconnected._
- **Should `Prisma Client Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.016129032258064516 - nodes in this community are weakly interconnected._
- **Should `Prisma Prize Model Types` be split into smaller, more focused modules?**
  _Cohesion score 0.017241379310344827 - nodes in this community are weakly interconnected._