# Graph Report - astrea  (2026-08-17)

## Corpus Check
- 126 files · ~329,354 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1774 nodes · 2033 edges · 98 communities (49 shown, 49 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4f4fd757`
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
- K03 Wallet-Compat TS Config
- EscrowProvider Interface
- Prisma Event Client Relations
- Web App Package Metadata
- Prisma Wallet Client Relations
- Prisma Prize Client Relations
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
- Astrea Logo (Dark)
- Astrea Logo (Light)
- Astrea Logo Mark (Light)
- Astrea Logo Mark (White)
- Astrea Sided Logo v2
- Astrea Sided Logo (Light)
- Astrea Sided Logo (Trimmed)
- Astrea App Favicon
- CLAUDE.md Agent Rules
- Bug Report Template
- Issue Template Config
- Go Module Definition

## God Nodes (most connected - your core abstractions)
1. `Astrea README` - 35 edges
2. `PrismaClient` - 18 edges
3. `EventDelegate` - 18 edges
4. `JudgeDelegate` - 18 edges
5. `OpLogDelegate` - 18 edges
6. `PayoutDelegate` - 18 edges
7. `PrizeDelegate` - 18 edges
8. `SubmissionDelegate` - 18 edges
9. `UserDelegate` - 18 edges
10. `WalletDelegate` - 18 edges

## Surprising Connections (you probably didn't know these)
- `K02 Go-Soroban Integration Spike README` --references--> `Task E02: Go Build-Sign-Submit Pipeline`  [AMBIGUOUS]
  spikes/k02-go-soroban/README.md → docs/build-plan.md
- `ADR-008 (referenced in K01 spike, corresponds to current ADR-001)` --semantically_similar_to--> `ADR-001: Custom Soroban Escrow Contract`  [INFERRED] [semantically similar]
  spikes/k01-soroban-escrow/README.md → docs/architecture.md
- `ADR-005: Wallet Connection Sets a UX Session, Not an Authorization Boundary` --semantically_similar_to--> `K03 Ping Test Contract (CDIWLY6A...)`  [INFERRED] [semantically similar]
  docs/architecture.md → spikes/k03-wallet-compat/README.md
- `Reconciliation job (chain as source of truth)` --semantically_similar_to--> `Reconciliation (core-go)`  [INFERRED] [semantically similar]
  README.md → services/core-go/README.md
- `Tasks E01-E03` --semantically_similar_to--> `Tasks E01-E06`  [INFERRED] [semantically similar]
  contracts/soroban/README.md → services/core-go/README.md

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

## Hyperedges (group relationships)
- **Supported Stellar wallets** — readme_freighter, readme_albedo, readme_xbull, readme_lobstr, readme_stellar_wallets_kit [EXTRACTED 0.90]
- **Wallet Compatibility Verification Flow** — readme_stellar_wallets_kit, spikes_k03_wallet_compat_readme, docs_build_plan_task_k03, docs_architecture_adr_005 [INFERRED 0.85]
- **Custom Soroban Escrow Contract Decision Trail** — spikes_k01_soroban_escrow_readme, spikes_k01_soroban_escrow_readme_adr008, docs_architecture_adr_001, docs_contracts_build_plan_task_k01 [INFERRED 0.85]
- **Idempotency & Reconciliation Money-Safety Pattern** — docs_architecture_principle_idempotent_operations, docs_architecture_reconciliation_job, docs_build_plan_task_e02, docs_build_plan_task_e05 [INFERRED 0.85]

## Communities (98 total, 49 thin omitted)

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
Cohesion: 0.11
Nodes (14): geistMono, geistSans, metadata, PrismBackground(), PrismBackgroundProps, LINKS, SiteFooter(), SiteHeader() (+6 more)

### Community 12 - "Prisma Browser Client"
Cohesion: 0.06
Nodes (32): $Enums, Event, Judge, OpLog, Payout, Prize, Submission, ADR-0003 (+24 more)

### Community 13 - "Web App Biome Config"
Cohesion: 0.07
Nodes (27): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+19 more)

### Community 14 - "Trustless Work Adapter (Legacy)"
Cohesion: 0.09
Nodes (24): env, serverSchema, baseEnv, loadEnvWith(), ForwardPaymentParams, ADR-0007, ROLES, trustlessWorkAdapter (+16 more)

### Community 15 - "Repo Root Biome Config"
Cohesion: 0.07
Nodes (26): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+18 more)

### Community 16 - "E06 Vertical Slice Demo Script"
Cohesion: 0.14
Nodes (18): accounts, findOrCreateWallet(), Keys, main(), signXdr(), step(), ADR-0007, amountToFundForExactNet() (+10 more)

### Community 17 - "Demo Event Seed Script"
Cohesion: 0.22
Nodes (6): FROM, TO, isNotFoundError(), isTransactionConfirmed(), NETWORK_CONFIG, StellarNetworkName

### Community 18 - "Architecture & Build-Plan Docs"
Cohesion: 0.19
Nodes (20): ADR-001: Custom Soroban Escrow Contract, ADR-005: Wallet Connection Sets a UX Session, Not an Authorization Boundary, Task E02: Go Build-Sign-Submit Pipeline, Task K03: Wallet Compatibility Check, Task K04: Fold K03 Results into ADR-005, Task S01: Monorepo Scaffold, Task S05: Wallet Connect (Frontend), Albedo wallet (+12 more)

### Community 19 - "shadcn/ui Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 20 - "K01 Soroban Escrow Contract"
Cohesion: 0.32
Nodes (7): Option, DataKey, Error, EscrowContract, Address, Env, Result

### Community 21 - "README Overview & Principles"
Cohesion: 0.11
Nodes (24): Custom Soroban escrow contract, Astrea README, Blockchain layer (Stellar/Soroban), Database layer (Postgres/Supabase/Prisma mirror), Frontend layer (Next.js App Router), Christopher Lamberti (Maintainer), Fast payouts (principle), Fully auditable (principle) (+16 more)

### Community 22 - "Web App TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 23 - "K02 Go-Soroban Client"
Cohesion: 0.22
Nodes (19): Client, Context, Full, HostFunction, ScAddress, ScVal, addressArg(), contractScAddress() (+11 more)

### Community 24 - "Architecture & Build-Plan Docs"
Cohesion: 0.15
Nodes (14): Prisma / Database Setup Guide, Migration Baseline Gotcha, Row Level Security Model, Astrea Architecture Doc, ADR-002: Multi-release Escrow, One Milestone Per Prize, ADR-004: Trustline Validation at Registration, Not Payout, The Chain Is the Source of Truth, Escrow Behind a Client Interface (+6 more)

### Community 25 - "Web App Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @base-ui/react, class-variance-authority, clsx, @creit.tech/stellar-wallets-kit, lucide-react, next, ogl (+10 more)

### Community 26 - "Escrow Pipeline & Idempotency"
Cohesion: 0.14
Nodes (22): accounts, findOrCreateWallet(), Keys, main(), signXdr(), step(), decidePrepare(), decideSubmit() (+14 more)

### Community 27 - "Event/Prize State Machines"
Cohesion: 0.20
Nodes (10): TransitionPrizeExtra, ADR-0007, InvalidTransitionError, assertEventTransition(), canTransitionEvent(), EVENT_TRANSITIONS, assertPrizeTransition(), canTransitionPrize() (+2 more)

### Community 28 - "Architecture & Build-Plan Docs"
Cohesion: 0.17
Nodes (16): ADR-003: Organizer Is Not in the Payout Path, Astrea Build Plan, Task E03: Event + Prize State Machine, Task L00: Minimal Shell, Task U02: Organizer Dashboard, Astrea Product Flows, Dispute Resolver Must Be Independent of the Judge, Event State Machine (+8 more)

### Community 37 - "CONTRIBUTING Guide & Code Quality"
Cohesion: 0.14
Nodes (14): Before you start, Code quality — enforced, not optional, Contributing to Astrea, Keeping the knowledge graph updated, License, Local setup, Opening a PR, Reporting a security issue (+6 more)

### Community 38 - "K01 Contract Test Suite"
Cohesion: 0.13
Nodes (6): EscrowContractClient, Address, Env, Setup, StellarAssetClient, TokenClient

### Community 39 - "Web App Dev Dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, @biomejs/biome, @commitlint/cli, @commitlint/config-conventional, lint-staged, tailwindcss, @tailwindcss/postcss, tsx (+6 more)

### Community 40 - "K01 Trustless-Work Spike Deps"
Cohesion: 0.33
Nodes (6): initWalletKit(), WalletContext, WalletContextValue, WalletProvider(), associateWallet(), clearWalletSession()

### Community 41 - "Web App npm Scripts"
Cohesion: 0.15
Nodes (13): scripts, build, demo:e06, demo:seed, dev, format, lint, lint:fix (+5 more)

### Community 42 - "Reconciliation & DB Client"
Cohesion: 0.21
Nodes (8): globalForPrisma, findStalledForwardsInDb(), ADR-0007, findStalledForwards(), ReleasedPrize, StalledForwardAlert, NOW, ADR-0007

### Community 43 - "TW Spike Runner Script"
Cohesion: 0.60
Nodes (5): contracts/soroban README, Tasks E01-E03, Task K01 (done), Astrea Contracts Build Plan, Tasks E01-E06

### Community 44 - "K03 Wallet-Compat Web Deps"
Cohesion: 0.15
Nodes (12): dependencies, @creit.tech/stellar-wallets-kit, @stellar/stellar-sdk, devDependencies, typescript, vite, name, private (+4 more)

### Community 45 - "Escrow-to-Backend Money Path"
Cohesion: 0.21
Nodes (12): EscrowClient Interface, Task E01: Go EscrowClient, Task K02: Go-Soroban Integration Spike, Backend layer (Go service), Reconciliation job (chain as source of truth), Participant registration, services/core-go README, Real-time tracking (+4 more)

### Community 48 - "K03 Wallet-Compat TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 52 - "Web App Package Metadata"
Cohesion: 0.25
Nodes (7): engines, node, lint-staged, *.{js,jsx,ts,tsx,json,css,md}, name, private, version

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

## Ambiguous Edges - Review These
- `K02 Go-Soroban Integration Spike README` → `Task E02: Go Build-Sign-Submit Pipeline`  [AMBIGUOUS]
  spikes/k02-go-soroban/README.md · relation: references

## Knowledge Gaps
- **1188 isolated node(s):** `Before you start`, `Wallet testing`, `Code quality — enforced, not optional`, `Keeping the knowledge graph updated`, `Opening a PR` (+1183 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `K02 Go-Soroban Integration Spike README` and `Task E02: Go Build-Sign-Submit Pipeline`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `@prisma/client` connect `Prisma Client Entry Point` to `Web App Dependencies`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Web App Dependencies` to `Prisma Client Entry Point`, `Web App Package Metadata`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `UserDelegate` connect `Prisma User Delegate Methods` to `Prisma User Model Types`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `Before you start`, `Wallet testing`, `Code quality — enforced, not optional` to the rest of the system?**
  _1199 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Prisma Event Model Types` be split into smaller, more focused modules?**
  _Cohesion score 0.015503875968992248 - nodes in this community are weakly interconnected._
- **Should `Prisma Client Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.016129032258064516 - nodes in this community are weakly interconnected._