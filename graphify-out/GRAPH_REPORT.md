# Graph Report - astrea  (2026-08-27)

## Corpus Check
- 116 files · ~279,279 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 861 nodes · 1104 edges · 114 communities (45 shown, 69 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fb0a51d7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- e06-vertical-slice.ts
- trustless-work-adapter.ts
- Astrea — Build Plan
- dependencies
- devDependencies
- layout.tsx
- Knowledge graph in sync (code) job
- compilerOptions
- web/biome.json
- scripts
- biome.json
- components.json
- CONTRIBUTING.md
- EscrowContract
- main.go
- docs/architecture.md
- README.md
- Astrea — Product Flows
- Astrea — Architecture
- test.rs
- prize.ts
- compilerOptions
- How It Works (5-step flow)
- tx-hash-link.tsx
- 🌠 Astrea
- run
- Wallet testing
- github.com/Astrea-Payouts/astrea/services/core-go
- post-commit
- .ping
- main.ts
- post-checkout
- AGENTS.md
- next.config.ts
- postcss.config.mjs
- soroban/README.md
- core-go/README.md
- run-testnet-spike.sh
- Migration Baseline Gotcha
- Astrea Payouts Logo (Dark Variant) - four-pointed star in circle mark with wordmark
- Astrea Payouts Logo (Light) - black lockup: four-pointed-star-in-circle mark + wordmark on white/transparent background
- Astrea Logo Mark (Light, black four-pointed star/compass in circle on radial gray gradient)
- Astrea Logo Mark (white four-point star/sparkle in glowing circle, on black)
- Astrea Payouts Logo Lockup (Light, Black Mark + Wordmark)
- Astrea Payouts Logo (side-by-side lockup, dark mark, light variant)
- Astrea Logo Lockup (light, trimmed) - dark starburst mark + wordmark on gradient background
- Astrea App Icon (circular mark, four-pointed star negative-space cutout, white/light monochrome)
- Custom Soroban escrow contract
- Tasks E01-E03
- Task K01 (done)
- ADR-001: Custom Soroban Escrow Contract
- The Chain Is the Source of Truth
- Escrow Behind a Client Interface
- Idempotent Money Operations
- Non-custodial, Always
- Testnet by Default
- Reconciliation Job
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
- Bug Report Issue Template
- Issue Template Config
- actions/upload-artifact@v5
- astrea/k02-go-soroban
- k01-soroban-escrow
- k03-ping
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
- k03-wallet-compat/web/package.json
- K06 — multi-release `close_event()` resource budget spike
- .close_event
- Contributing to Astrea
- k06-multi-release-budget
- manifest.ts
- sw.js
- Contributor Covenant Code of Conduct
- 🏁 Getting Started
- Database setup
- pre-push

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `main()` - 15 edges
3. `EscrowContract` - 15 edges
4. `scripts` - 13 edges
5. `main()` - 12 edges
6. `🌠 Astrea` - 11 edges
7. `EscrowProvider` - 10 edges
8. `Astrea — Build Plan` - 10 edges
9. `Knowledge graph in sync (code) job` - 10 edges
10. `main()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Chain is source of truth; database is a mirror` --semantically_similar_to--> `Fail if graphify-out/ is stale step`  [INFERRED] [semantically similar]
  README.md → .github/workflows/ci.yml
- `Update docs/ADRs alongside code policy` --semantically_similar_to--> `Fail if graphify-out/ is stale step`  [INFERRED] [semantically similar]
  CONTRIBUTING.md → .github/workflows/ci.yml
- `Commit messages (Conventional Commits) job` --implements--> `Conventional Commits`  [INFERRED]
  .github/workflows/ci.yml → README.md
- `docs/architecture.md` --conceptually_related_to--> `docs/architecture.md`  [INFERRED]
  README.md → CONTRIBUTING.md
- `Biome` --conceptually_related_to--> `Biome (lint/format)`  [INFERRED]
  README.md → CONTRIBUTING.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Code quality enforcement pipeline (Biome + Husky + commitlint + lint-staged + Conventional Commits + CI)** — contributing_biome, contributing_husky, contributing_lint_staged, contributing_ci_checks [EXTRACTED 1.00]
- **Supported Stellar wallet ecosystem (Freighter, Albedo, xBull, LOBSTR via Stellar Wallets Kit)** — readme_freighter, readme_albedo, readme_xbull, readme_lobstr, readme_stellar_wallets_kit, contributing_wallet_testing [EXTRACTED 1.00]
- **Knowledge graph maintenance workflow (code auto-rebuild + doc manual /graphify + CI enforcement)** — contributing_graphify, contributing_post_commit_hook, contributing_graphify_update_command, contributing_ci_graphify_check, github_workflows_ci_graphify_drift_check_job [INFERRED 0.85]

## Communities (114 total, 69 thin omitted)

### Community 0 - "e06-vertical-slice.ts"
Cohesion: 0.06
Nodes (53): accounts, findOrCreateWallet(), Keys, main(), signXdr(), step(), ADR-0007, accounts (+45 more)

### Community 1 - "trustless-work-adapter.ts"
Cohesion: 0.06
Nodes (33): env, serverSchema, baseEnv, loadEnvWith(), ForwardPaymentParams, FROM, TO, ADR-0007 (+25 more)

### Community 2 - "Astrea — Build Plan"
Cohesion: 0.05
Nodes (38): Architecture summary, Astrea — Build Plan, Milestone — Apply to GrantFox as maintainer, Phase 0 — Spike (de-risk before anything else), Phase 1 — Foundations, Phase 2 — Core system (event lifecycle, backend, real-time tracking), Phase 3 — Product UI, Phase 4 — Trust & edge cases (+30 more)

### Community 3 - "dependencies"
Cohesion: 0.05
Nodes (39): dependencies, @base-ui/react, class-variance-authority, clsx, @creit.tech/stellar-wallets-kit, lucide-react, next, next-intl (+31 more)

### Community 4 - "devDependencies"
Cohesion: 0.07
Nodes (29): devDependencies, @biomejs/biome, @commitlint/cli, @commitlint/config-conventional, husky, lint-staged, tailwindcss, @tailwindcss/postcss (+21 more)

### Community 5 - "layout.tsx"
Cohesion: 0.07
Nodes (23): geistMono, geistSans, viewport, LanguageSwitcher(), LOCALE_LABELS, PrismBackground(), PrismBackgroundProps, PwaRegister() (+15 more)

### Community 6 - "Knowledge graph in sync (code) job"
Cohesion: 0.09
Nodes (27): Update docs/ADRs alongside code policy, Fork-then-clone local setup workflow, Money-movement change review requirement (E0*, escrow calls, signing, reconciliation job), Opening a PR workflow, `security` label (extra review), upstream git remote, CI workflow, actions/checkout@v5 (+19 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 8 - "web/biome.json"
Cohesion: 0.07
Nodes (27): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+19 more)

### Community 9 - "scripts"
Cohesion: 0.07
Nodes (26): engines, node, lint-staged, *.{js,jsx,ts,tsx,json,css,md}, name, overrides, axios, elliptic (+18 more)

### Community 10 - "biome.json"
Cohesion: 0.07
Nodes (26): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+18 more)

### Community 11 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "CONTRIBUTING.md"
Cohesion: 0.10
Nodes (24): Biome (lint/format), CI checks: lint, typecheck, test, build, CI enforcement of code-graph sync, GitHub Discussions, graphify-out/graph.html (interactive view), graphify knowledge graph, /graphify --update command, Husky (+16 more)

### Community 13 - "EscrowContract"
Cohesion: 0.32
Nodes (7): Option, Result, DataKey, Error, EscrowContract, Address, Env

### Community 14 - "main.go"
Cohesion: 0.20
Nodes (20): context.Context, github.com/stellar/go/clients/horizonclient.Client, github.com/stellar/go/clients/rpcclient.Client, github.com/stellar/go/keypair.Full, github.com/stellar/go/xdr.HostFunction, github.com/stellar/go/xdr.ScAddress, github.com/stellar/go/xdr.ScVal, addressArg() (+12 more)

### Community 15 - "docs/architecture.md"
Cohesion: 0.11
Nodes (20): ADR-001, ADR-003, ALLOW_MAINNET=false gate, docs/architecture.md, docs/build-plan.md, .env.example, coded GitHub issue tasks (e.g. [E02], [U01]), migration-baseline gotcha before first `prisma migrate dev` (+12 more)

### Community 16 - "README.md"
Cohesion: 0.16
Nodes (14): graphify-out/GRAPH_REPORT.md, docs/architecture.md, Astrea (escrow-backed prize payouts platform), docs/contracts-build-plan.md, graphify-out/GRAPH_REPORT.md, Christopher Lamberti (Maintainer), The Problem We Solve (broken hackathon-payout promises), docs/product-flows.md (+6 more)

### Community 17 - "Astrea — Product Flows"
Cohesion: 0.12
Nodes (15): Astrea — Product Flows, Event state machine, Flow 1 — Organizer creates an event, Flow 2 — Organizer funds the prize pool, Flow 3 — Participants join and submit, Flow 4 — Judging and payout, Flow 5 — Dispute, Non-goals for the MVP (+7 more)

### Community 18 - "Astrea — Architecture"
Cohesion: 0.12
Nodes (16): ADR-001 — Custom Soroban escrow contract, no third-party provider, ADR-002: Multi-release Escrow, One Milestone Per Prize, ADR-003: Organizer Is Not in the Payout Path, ADR-004: Trustline Validation at Registration, Not Payout, ADR-005: Wallet Connection Sets a UX Session, Not an Authorization Boundary, Architecture Decision Records, Astrea — Architecture, Deploy + fund (organizer) (+8 more)

### Community 19 - "test.rs"
Cohesion: 0.13
Nodes (6): EscrowContractClient, Address, Env, Setup, StellarAssetClient, TokenClient

### Community 20 - "prize.ts"
Cohesion: 0.23
Nodes (8): InvalidTransitionError, assertEventTransition(), canTransitionEvent(), EVENT_TRANSITIONS, assertPrizeTransition(), canTransitionPrize(), PRIZE_TRANSITIONS, ADR-0007

### Community 21 - "compilerOptions"
Cohesion: 0.15
Nodes (12): ES2022, main.ts, compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck (+4 more)

### Community 22 - "How It Works (5-step flow)"
Cohesion: 0.13
Nodes (15): Client-side XDR signing, Organizer funds the escrow step, Organizer creates an event step, Event wizard, How It Works (5-step flow), Judges approve and release step, Judge panel, Next.js (App Router) (+7 more)

### Community 23 - "tx-hash-link.tsx"
Cohesion: 0.28
Nodes (9): OfflinePage(), TxHashLink(), TxHashLinkProps, Button(), buttonVariants, getExplorerTxUrl(), StellarNetwork, truncateHash() (+1 more)

### Community 24 - "🌠 Astrea"
Cohesion: 0.22
Nodes (9): 🌠 Astrea, 📖 Documentation, 🚀 How It Works, 📄 License, 🧑‍🚀 Maintainers, Our Solution, 🛠️ Technology Stack, The Problem We Solve (+1 more)

### Community 25 - "run"
Cohesion: 0.36
Nodes (7): MultiReleaseSpikeClient, budget_report_across_winner_counts(), budget_report_beyond_mainnet_limits_disabled(), report(), Address, Env, run()

### Community 26 - "Wallet testing"
Cohesion: 0.57
Nodes (7): Wallet testing, Albedo wallet, Freighter wallet, LOBSTR wallet, Stellar Wallets Kit, 👛 Wallet Requirements, xBull wallet

### Community 29 - "post-commit"
Cohesion: 0.40
Nodes (4): post-commit script, GRAPHIFY_CHANGED, GRAPHIFY_REBUILD_LOG, PYTHONHASHSEED

### Community 30 - ".ping"
Cohesion: 0.40
Nodes (3): PingContract, Address, Env

### Community 31 - "main.ts"
Cohesion: 0.50
Nodes (3): log(), logEl, runCheck()

### Community 32 - "post-checkout"
Cohesion: 0.50
Nodes (3): post-checkout script, GRAPHIFY_REBUILD_LOG, PYTHONHASHSEED

### Community 102 - "k03-wallet-compat/web/package.json"
Cohesion: 0.12
Nodes (16): dependencies, @creit.tech/stellar-wallets-kit, @stellar/stellar-sdk, devDependencies, typescript, vite, @creit.tech/stellar-wallets-kit, @stellar/stellar-sdk (+8 more)

### Community 103 - "K06 — multi-release `close_event()` resource budget spike"
Cohesion: 0.33
Nodes (5): Answer to the Council's question, K06 — multi-release `close_event()` resource budget spike, Result, Running it, The N=50 failure (and why it doesn't count)

### Community 104 - ".close_event"
Cohesion: 0.33
Nodes (4): MultiReleaseSpike, Address, Env, Vec

### Community 105 - "Contributing to Astrea"
Cohesion: 0.22
Nodes (9): Before you start, Code quality — enforced, not optional, Contributing to Astrea, Keeping the knowledge graph updated, License, Local setup, Opening a PR, Reporting a security issue (+1 more)

### Community 112 - "Contributor Covenant Code of Conduct"
Cohesion: 0.15
Nodes (12): 1. Correction, 2. Warning, 3. Temporary Ban, 4. Permanent Ban, Attribution, Contributor Covenant Code of Conduct, Enforcement, Enforcement Guidelines (+4 more)

### Community 115 - "🏁 Getting Started"
Cohesion: 0.15
Nodes (14): Chain is source of truth; database is a mirror, Environment Variables, EscrowClient interface, 🏁 Getting Started, Go backend (services/core-go), Stellar Horizon, Postgres, Prerequisites (+6 more)

### Community 117 - "Database setup"
Cohesion: 0.33
Nodes (5): Database setup, Environment variables, Everyday commands, ⚠️ Migration baseline (read before running `prisma migrate dev`), RLS model

## Knowledge Gaps
- **378 isolated node(s):** `$schema`, `root`, `enabled`, `clientKind`, `useIgnoreFile` (+373 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **69 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `tailwindcss` connect `devDependencies` to `README.md`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `$schema`, `root`, `enabled` to the rest of the system?**
  _378 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `e06-vertical-slice.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `trustless-work-adapter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05639097744360902 - nodes in this community are weakly interconnected._
- **Should `Astrea — Build Plan` be split into smaller, more focused modules?**
  _Cohesion score 0.04734299516908213 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._