# Graph Report - C:\D\works\Paginas\Mine\astrea  (2026-08-16)

## Corpus Check
- 148 files · ~332,757 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1835 nodes · 2125 edges · 101 communities (52 shown, 49 thin omitted)
- Extraction: 99% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Prisma Event Model Types
- Prisma Client Internals
- Prisma Prize Model Types
- Prisma Wallet Model Types
- Prisma Submission Model Types
- Prisma User Model Types
- Prisma Payout Model Types
- Prisma Judge Model Types
- Architecture & Build-Plan Docs
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
- shadcn/ui Components Config
- K01 Soroban Escrow Contract
- Web App TypeScript Config
- K02 Go-Soroban Client
- Web App Dependencies
- Escrow Pipeline & Idempotency
- Event/Prize State Machines
- Prisma Event Delegate Methods
- Prisma Judge Delegate Methods
- Prisma OpLog Delegate Methods
- Prisma Payout Delegate Methods
- Prisma Prize Delegate Methods
- Prisma Submission Delegate Methods
- Prisma User Delegate Methods
- Prisma Wallet Delegate Methods
- K01 Contract Test Suite
- Web App Dev Dependencies
- K01 Trustless-Work Spike Deps
- Web App npm Scripts
- Reconciliation & DB Client
- TW Spike Runner Script
- K03 Wallet-Compat Web Deps
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
1. `PrismaClient` - 18 edges
2. `EventDelegate` - 18 edges
3. `JudgeDelegate` - 18 edges
4. `OpLogDelegate` - 18 edges
5. `PayoutDelegate` - 18 edges
6. `PrizeDelegate` - 18 edges
7. `SubmissionDelegate` - 18 edges
8. `UserDelegate` - 18 edges
9. `WalletDelegate` - 18 edges
10. `Astrea Architecture Doc` - 17 edges

## Surprising Connections (you probably didn't know these)
- `K02 Go-Soroban Integration Spike README` --references--> `Task E02: Go Build-Sign-Submit Pipeline`  [AMBIGUOUS]
  spikes/k02-go-soroban/README.md → docs/build-plan.md
- `ADR-008 (referenced in K01 spike, corresponds to current ADR-001)` --semantically_similar_to--> `ADR-001: Custom Soroban Escrow Contract`  [INFERRED] [semantically similar]
  spikes/k01-soroban-escrow/README.md → docs/architecture.md
- `ADR-005: Wallet Connection Sets a UX Session, Not an Authorization Boundary` --semantically_similar_to--> `K03 Ping Test Contract (CDIWLY6A...)`  [INFERRED] [semantically similar]
  docs/architecture.md → spikes/k03-wallet-compat/README.md
- `Soroban Contract README` --references--> `Contracts Task K01: Escrow Contract Spike`  [AMBIGUOUS]
  contracts/soroban/README.md → docs/contracts-build-plan.md
- `ADR-001: Custom Soroban Escrow Contract` --conceptually_related_to--> `Trustless Work (@trustless-work/escrow)`  [AMBIGUOUS]
  docs/architecture.md → README.md

## Import Cycles
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Submission.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Judge.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/commonInputTypes.ts -> src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/commonInputTypes.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Event.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/OpLog.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Payout.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Prize.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/User.ts -> src/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `src/generated/prisma/internal/prismaNamespace.ts -> src/generated/prisma/models.ts -> src/generated/prisma/models/Wallet.ts -> src/generated/prisma/internal/prismaNamespace.ts`

## Hyperedges (group relationships)
- **Wallet Compatibility Verification Flow** — readme_stellar_wallets_kit, spikes_k03_wallet_compat_readme, docs_build_plan_task_k03, docs_architecture_adr_005 [INFERRED 0.85]
- **Custom Soroban Escrow Contract Decision Trail** — spikes_k01_soroban_escrow_readme, spikes_k01_soroban_escrow_readme_adr008, docs_architecture_adr_001, docs_contracts_build_plan_task_k01 [INFERRED 0.85]
- **Idempotency & Reconciliation Money-Safety Pattern** — docs_architecture_principle_idempotent_operations, docs_architecture_reconciliation_job, docs_build_plan_task_e02, docs_build_plan_task_e05 [INFERRED 0.85]

## Communities (101 total, 49 thin omitted)

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

### Community 8 - "Architecture & Build-Plan Docs"
Cohesion: 0.05
Nodes (73): Prisma / Database Setup Guide, Migration Baseline Gotcha, Row Level Security Model, Soroban Contract README, Custom Escrow Smart Contract (planned), Biome (Lint/Format), Conventional Commits Standard, Husky + commitlint Pre-commit Hooks (+65 more)

### Community 9 - "Prisma Common Input Filters"
Cohesion: 0.04
Nodes (53): DateTimeFilter, DateTimeNullableFilter, DateTimeNullableWithAggregatesFilter, DateTimeWithAggregatesFilter, DecimalFilter, DecimalWithAggregatesFilter, EnumEventStatusFilter, EnumEventStatusWithAggregatesFilter (+45 more)

### Community 10 - "Prisma OpLog Model Types"
Cohesion: 0.04
Nodes (53): AggregateOpLog, EnumOpStatusFieldUpdateOperationsInput, GetOpLogAggregateType, GetOpLogGroupByPayload, OpLogAggregateArgs, OpLogCountAggregateInputType, OpLogCountAggregateOutputType, OpLogCountArgs (+45 more)

### Community 11 - "Prisma Client Entry Point"
Cohesion: 0.05
Nodes (17): @prisma/client, $Enums, Event, Judge, OpLog, Payout, PrismaClient, Prize (+9 more)

### Community 12 - "App Layout & Wallet Provider"
Cohesion: 0.09
Nodes (20): geistMono, geistSans, metadata, PrismBackground(), PrismBackgroundProps, LINKS, SiteFooter(), SiteHeader() (+12 more)

### Community 13 - "Prisma Browser Client"
Cohesion: 0.06
Nodes (32): $Enums, Event, Judge, OpLog, Payout, Prize, Submission, ADR-0003 (+24 more)

### Community 14 - "Web App Biome Config"
Cohesion: 0.07
Nodes (27): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+19 more)

### Community 15 - "Trustless Work Adapter (Legacy)"
Cohesion: 0.11
Nodes (20): ROLES, trustlessWorkAdapter, ApproveMilestoneParams, DeployEscrowParams, DisputeMilestoneParams, Distribution, EscrowMilestoneInput, EscrowMilestoneState (+12 more)

### Community 16 - "Repo Root Biome Config"
Cohesion: 0.07
Nodes (26): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+18 more)

### Community 17 - "E06 Vertical Slice Demo Script"
Cohesion: 0.13
Nodes (18): accounts, findOrCreateWallet(), Keys, main(), signXdr(), step(), ADR-0007, amountToFundForExactNet() (+10 more)

### Community 18 - "Demo Event Seed Script"
Cohesion: 0.14
Nodes (16): accounts, findOrCreateWallet(), Keys, main(), signXdr(), step(), env, serverSchema (+8 more)

### Community 19 - "shadcn/ui Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 20 - "K01 Soroban Escrow Contract"
Cohesion: 0.32
Nodes (7): Option, DataKey, Error, EscrowContract, Address, Env, Result

### Community 21 - "Web App TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 22 - "K02 Go-Soroban Client"
Cohesion: 0.22
Nodes (19): Client, Context, Full, HostFunction, ScAddress, ScVal, addressArg(), contractScAddress() (+11 more)

### Community 23 - "Web App Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @base-ui/react, class-variance-authority, clsx, @creit.tech/stellar-wallets-kit, lucide-react, next, ogl (+10 more)

### Community 24 - "Escrow Pipeline & Idempotency"
Cohesion: 0.19
Nodes (15): decidePrepare(), decideSubmit(), OpRecord, PrepareDecision, SubmitDecision, prepareOperation(), PrepareOperationParams, PrepareOperationResult (+7 more)

### Community 25 - "Event/Prize State Machines"
Cohesion: 0.19
Nodes (11): transitionPrize(), TransitionPrizeExtra, ADR-0007, InvalidTransitionError, assertEventTransition(), canTransitionEvent(), EVENT_TRANSITIONS, assertPrizeTransition() (+3 more)

### Community 34 - "K01 Contract Test Suite"
Cohesion: 0.13
Nodes (6): EscrowContractClient, Address, Env, Setup, StellarAssetClient, TokenClient

### Community 35 - "Web App Dev Dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, @biomejs/biome, @commitlint/cli, @commitlint/config-conventional, lint-staged, tailwindcss, @tailwindcss/postcss, tsx (+6 more)

### Community 36 - "K01 Trustless-Work Spike Deps"
Cohesion: 0.14
Nodes (13): dependencies, dotenv, @stellar/stellar-sdk, description, engines, node, name, private (+5 more)

### Community 37 - "Web App npm Scripts"
Cohesion: 0.15
Nodes (13): scripts, build, demo:e06, demo:seed, dev, format, lint, lint:fix (+5 more)

### Community 38 - "Reconciliation & DB Client"
Cohesion: 0.21
Nodes (8): globalForPrisma, findStalledForwardsInDb(), ADR-0007, findStalledForwards(), ReleasedPrize, StalledForwardAlert, NOW, ADR-0007

### Community 39 - "TW Spike Runner Script"
Cohesion: 0.22
Nodes (12): accounts, findings, ADR-0001, ADR-0003, main(), NOTE: endpoint paths and payload shapes here were reverse-engineered from the, record(), server (+4 more)

### Community 40 - "K03 Wallet-Compat Web Deps"
Cohesion: 0.15
Nodes (12): dependencies, @creit.tech/stellar-wallets-kit, @stellar/stellar-sdk, devDependencies, typescript, vite, name, private (+4 more)

### Community 41 - "TW Forward-Payment Verification"
Cohesion: 0.26
Nodes (11): accounts, ensureTrustline(), forwardPayment(), ADR-0005, main(), server, signAndSend(), signXdr() (+3 more)

### Community 42 - "TW Dispute-Redirect Verification"
Cohesion: 0.33
Nodes (9): accounts, ADR-0007, main(), server, signAndSend(), signXdr(), tryDispute(), tw() (+1 more)

### Community 43 - "K03 Wallet-Compat TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 45 - "TW Withdraw-Destination Verification"
Cohesion: 0.36
Nodes (8): accounts, main(), readEscrow(), server, signAndSend(), signXdr(), tw(), usdcBalance()

### Community 47 - "Web App Package Metadata"
Cohesion: 0.25
Nodes (7): engines, node, lint-staged, *.{js,jsx,ts,tsx,json,css,md}, name, private, version

### Community 48 - "TW Merged Judge/Resolver Test"
Cohesion: 0.39
Nodes (7): accounts, main(), server, signAndSend(), signXdr(), tw(), usdcBalance()

### Community 50 - "TW Spike Account Setup"
Cohesion: 0.38
Nodes (6): addUsdcTrustline(), friendbot(), ADR-0003, main(), server, USDC

### Community 51 - "TW Update-Escrow Verification"
Cohesion: 0.48
Nodes (6): accounts, main(), readEscrow(), signAndSend(), signXdr(), tw()

### Community 52 - "TW Dispute-Raise Permission Test"
Cohesion: 0.43
Nodes (6): accounts, ADR-0003, main(), signAndSend(), signXdr(), tw()

### Community 54 - "TW Dispute-Winner Verification"
Cohesion: 0.53
Nodes (5): accounts, main(), signAndSend(), signXdr(), tw()

### Community 57 - "Dependency Version Overrides"
Cohesion: 0.40
Nodes (5): overrides, axios, elliptic, protobufjs, uuid

### Community 58 - "K03 Ping Test Contract"
Cohesion: 0.40
Nodes (3): PingContract, Address, Env

### Community 59 - "K03 Wallet Test Harness UI"
Cohesion: 0.50
Nodes (3): log(), logEl, runCheck()

### Community 65 - "Prisma Client Base Options"
Cohesion: 0.67
Nodes (3): PrismaClientBaseOptions, PrismaClientOptionsWithAccelerateUrl, PrismaClientOptionsWithAdapter

## Ambiguous Edges - Review These
- `CONTRIBUTING.md` → `ADR-006 (referenced in CONTRIBUTING.md, not found in architecture.md)`  [AMBIGUOUS]
  CONTRIBUTING.md · relation: references
- `Soroban Contract README` → `Task S09 (referenced in soroban README, not found in build-plan.md)`  [AMBIGUOUS]
  contracts/soroban/README.md · relation: references
- `Soroban Contract README` → `Contracts Task K01: Escrow Contract Spike`  [AMBIGUOUS]
  contracts/soroban/README.md · relation: references
- `core-go README` → `Task S08 (referenced in core-go README, not found in build-plan.md)`  [AMBIGUOUS]
  services/core-go/README.md · relation: references
- `K02 Go-Soroban Integration Spike README` → `Task E02: Go Build-Sign-Submit Pipeline`  [AMBIGUOUS]
  spikes/k02-go-soroban/README.md · relation: references
- `ADR-001: Custom Soroban Escrow Contract` → `Trustless Work (@trustless-work/escrow)`  [AMBIGUOUS]
  docs/architecture.md · relation: conceptually_related_to

## Knowledge Gaps
- **1208 isolated node(s):** `husky.sh script`, `$schema`, `root`, `enabled`, `clientKind` (+1203 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `CONTRIBUTING.md` and `ADR-006 (referenced in CONTRIBUTING.md, not found in architecture.md)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Soroban Contract README` and `Task S09 (referenced in soroban README, not found in build-plan.md)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Soroban Contract README` and `Contracts Task K01: Escrow Contract Spike`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `core-go README` and `Task S08 (referenced in core-go README, not found in build-plan.md)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `K02 Go-Soroban Integration Spike README` and `Task E02: Go Build-Sign-Submit Pipeline`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `ADR-001: Custom Soroban Escrow Contract` and `Trustless Work (@trustless-work/escrow)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `@prisma/client` connect `Prisma Client Entry Point` to `Web App Dependencies`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._