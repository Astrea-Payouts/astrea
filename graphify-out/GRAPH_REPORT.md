# Graph Report - C:/D/works/Paginas/Mine/astrea  (2026-08-16)

## Corpus Check
- 4 files · ~332,749 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1873 nodes · 2183 edges · 106 communities (57 shown, 49 thin omitted)
- Extraction: 99% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.78)
- Token cost: 123,819 input · 0 output

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
- TW Forward-Payment Verification
- TW Dispute-Redirect Verification
- K03 Wallet-Compat TS Config
- EscrowProvider Interface
- TW Withdraw-Destination Verification
- Prisma Event Client Relations
- Web App Package Metadata
- TW Merged Judge/Resolver Test
- Prisma Wallet Client Relations
- TW Spike Account Setup
- TW Update-Escrow Verification
- TW Dispute-Raise Permission Test
- Prisma Prize Client Relations
- TW Dispute-Winner Verification
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
1. `Astrea README` - 40 edges
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
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Submission.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Event.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/commonInputTypes.ts -> src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/commonInputTypes.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Judge.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Wallet.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/OpLog.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Payout.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Prize.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/User.ts -> src/generated/prisma/internal/prismaNamespace.ts`

## Hyperedges (group relationships)
- **Supported Stellar wallets** — readme_freighter, readme_albedo, readme_xbull, readme_lobstr, readme_stellar_wallets_kit [EXTRACTED 0.90]
- **Code quality enforcement pipeline** — contributing_biome, contributing_husky, contributing_commitlint, contributing_conventional_commits, contributing_ci_pipeline [EXTRACTED 0.90]
- **Money-movement safety controls** — contributing_money_movement_review, contracts_soroban_task_e01_e03, services_core_go_task_e01_e06, readme_non_custodial [INFERRED 0.75]
- **Wallet Compatibility Verification Flow** — readme_stellar_wallets_kit, spikes_k03_wallet_compat_readme, docs_build_plan_task_k03, docs_architecture_adr_005 [INFERRED 0.85]
- **Custom Soroban Escrow Contract Decision Trail** — spikes_k01_soroban_escrow_readme, spikes_k01_soroban_escrow_readme_adr008, docs_architecture_adr_001, docs_contracts_build_plan_task_k01 [INFERRED 0.85]
- **Idempotency & Reconciliation Money-Safety Pattern** — docs_architecture_principle_idempotent_operations, docs_architecture_reconciliation_job, docs_build_plan_task_e02, docs_build_plan_task_e05 [INFERRED 0.85]

## Communities (106 total, 49 thin omitted)

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
Cohesion: 0.14
Nodes (16): accounts, findOrCreateWallet(), Keys, main(), signXdr(), step(), env, serverSchema (+8 more)

### Community 18 - "Architecture & Build-Plan Docs"
Cohesion: 0.16
Nodes (24): Wallet testing process, ADR-001: Custom Soroban Escrow Contract, ADR-005: Wallet Connection Sets a UX Session, Not an Authorization Boundary, EscrowClient Interface, Task E01: Go EscrowClient, Task E02: Go Build-Sign-Submit Pipeline, Task K02: Go-Soroban Integration Spike, Task K03: Wallet Compatibility Check (+16 more)

### Community 19 - "shadcn/ui Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 20 - "K01 Soroban Escrow Contract"
Cohesion: 0.32
Nodes (7): Option, DataKey, Error, EscrowContract, Address, Env, Result

### Community 21 - "README Overview & Principles"
Cohesion: 0.12
Nodes (22): Astrea README, Blockchain layer (Stellar/Soroban), Database layer (Postgres/Supabase/Prisma mirror), Frontend layer (Next.js App Router), Christopher Lamberti (Maintainer), Fast payouts (principle), Fully auditable (principle), GitHub Actions (+14 more)

### Community 22 - "Web App TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 23 - "K02 Go-Soroban Client"
Cohesion: 0.22
Nodes (19): Client, Context, Full, HostFunction, ScAddress, ScVal, addressArg(), contractScAddress() (+11 more)

### Community 24 - "Architecture & Build-Plan Docs"
Cohesion: 0.13
Nodes (19): Prisma / Database Setup Guide, Migration Baseline Gotcha, Row Level Security Model, contracts/soroban README, Tasks E01-E03, Task K01 (done), Astrea Architecture Doc, ADR-002: Multi-release Escrow, One Milestone Per Prize (+11 more)

### Community 25 - "Web App Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @base-ui/react, class-variance-authority, clsx, @creit.tech/stellar-wallets-kit, lucide-react, next, ogl (+10 more)

### Community 26 - "Escrow Pipeline & Idempotency"
Cohesion: 0.19
Nodes (15): decidePrepare(), decideSubmit(), OpRecord, PrepareDecision, SubmitDecision, prepareOperation(), PrepareOperationParams, PrepareOperationResult (+7 more)

### Community 27 - "Event/Prize State Machines"
Cohesion: 0.19
Nodes (11): transitionPrize(), TransitionPrizeExtra, ADR-0007, InvalidTransitionError, assertEventTransition(), canTransitionEvent(), EVENT_TRANSITIONS, assertPrizeTransition() (+3 more)

### Community 28 - "Architecture & Build-Plan Docs"
Cohesion: 0.15
Nodes (18): ADR-003: Organizer Is Not in the Payout Path, Astrea Build Plan, Task E03: Event + Prize State Machine, Task L00: Minimal Shell, Task U02: Organizer Dashboard, Astrea Product Flows, Dispute Resolver Must Be Independent of the Judge, Event State Machine (+10 more)

### Community 37 - "CONTRIBUTING Guide & Code Quality"
Cohesion: 0.15
Nodes (16): ADR-001, ADR-003, Biome, CI pipeline (lint/typecheck/test/build gate), commitlint, Conventional Commits, Husky pre-commit hooks, Security issue reporting process (+8 more)

### Community 38 - "K01 Contract Test Suite"
Cohesion: 0.13
Nodes (6): EscrowContractClient, Address, Env, Setup, StellarAssetClient, TokenClient

### Community 39 - "Web App Dev Dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, @biomejs/biome, @commitlint/cli, @commitlint/config-conventional, lint-staged, tailwindcss, @tailwindcss/postcss, tsx (+6 more)

### Community 40 - "K01 Trustless-Work Spike Deps"
Cohesion: 0.14
Nodes (13): dependencies, dotenv, @stellar/stellar-sdk, description, engines, node, name, private (+5 more)

### Community 41 - "Web App npm Scripts"
Cohesion: 0.15
Nodes (13): scripts, build, demo:e06, demo:seed, dev, format, lint, lint:fix (+5 more)

### Community 42 - "Reconciliation & DB Client"
Cohesion: 0.21
Nodes (8): globalForPrisma, findStalledForwardsInDb(), ADR-0007, findStalledForwards(), ReleasedPrize, StalledForwardAlert, NOW, ADR-0007

### Community 43 - "TW Spike Runner Script"
Cohesion: 0.22
Nodes (12): accounts, findings, ADR-0001, ADR-0003, main(), NOTE: endpoint paths and payload shapes here were reverse-engineered from the, record(), server (+4 more)

### Community 44 - "K03 Wallet-Compat Web Deps"
Cohesion: 0.15
Nodes (12): dependencies, @creit.tech/stellar-wallets-kit, @stellar/stellar-sdk, devDependencies, typescript, vite, name, private (+4 more)

### Community 45 - "Escrow-to-Backend Money Path"
Cohesion: 0.23
Nodes (12): Custom Soroban escrow contract, Money-movement extra review policy, PR opening process, Backend layer (Go service), Reconciliation job (chain as source of truth), Participant registration, services/core-go README, Real-time tracking (+4 more)

### Community 46 - "TW Forward-Payment Verification"
Cohesion: 0.26
Nodes (11): accounts, ensureTrustline(), forwardPayment(), ADR-0005, main(), server, signAndSend(), signXdr() (+3 more)

### Community 47 - "TW Dispute-Redirect Verification"
Cohesion: 0.33
Nodes (9): accounts, ADR-0007, main(), server, signAndSend(), signXdr(), tryDispute(), tw() (+1 more)

### Community 48 - "K03 Wallet-Compat TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 50 - "TW Withdraw-Destination Verification"
Cohesion: 0.36
Nodes (8): accounts, main(), readEscrow(), server, signAndSend(), signXdr(), tw(), usdcBalance()

### Community 52 - "Web App Package Metadata"
Cohesion: 0.25
Nodes (7): engines, node, lint-staged, *.{js,jsx,ts,tsx,json,css,md}, name, private, version

### Community 53 - "TW Merged Judge/Resolver Test"
Cohesion: 0.39
Nodes (7): accounts, main(), server, signAndSend(), signXdr(), tw(), usdcBalance()

### Community 55 - "TW Spike Account Setup"
Cohesion: 0.38
Nodes (6): addUsdcTrustline(), friendbot(), ADR-0003, main(), server, USDC

### Community 56 - "TW Update-Escrow Verification"
Cohesion: 0.48
Nodes (6): accounts, main(), readEscrow(), signAndSend(), signXdr(), tw()

### Community 57 - "TW Dispute-Raise Permission Test"
Cohesion: 0.43
Nodes (6): accounts, ADR-0003, main(), signAndSend(), signXdr(), tw()

### Community 59 - "TW Dispute-Winner Verification"
Cohesion: 0.53
Nodes (5): accounts, main(), signAndSend(), signXdr(), tw()

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
- **1214 isolated node(s):** `husky.sh script`, `$schema`, `root`, `enabled`, `clientKind` (+1209 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `K02 Go-Soroban Integration Spike README` and `Task E02: Go Build-Sign-Submit Pipeline`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `@prisma/client` connect `Prisma Client Entry Point` to `Web App Dependencies`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Web App Dependencies` to `Prisma Client Entry Point`, `Web App Package Metadata`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `EventDelegate` connect `Prisma Event Delegate Methods` to `Prisma Event Model Types`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `husky.sh script`, `$schema`, `root` to the rest of the system?**
  _1228 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Prisma Event Model Types` be split into smaller, more focused modules?**
  _Cohesion score 0.015503875968992248 - nodes in this community are weakly interconnected._
- **Should `Prisma Client Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.016129032258064516 - nodes in this community are weakly interconnected._