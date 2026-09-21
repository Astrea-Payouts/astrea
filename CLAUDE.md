# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Astrea locks hackathon prize money in a Soroban escrow on Stellar testnet before an event goes live and pays winners in USDC when a judge releases. Three deployables live in this monorepo; the chain is the source of truth and Postgres is a mirror.

| Part | Path | Stack | Deployed |
| --- | --- | --- | --- |
| Web | `apps/web` | Next.js 16 App Router, React 19, Prisma 7, Tailwind 4 + shadcn, next-intl, Vitest, Biome | Vercel (`astrea-payouts.vercel.app`), production branch `main` |
| Backend | `services/core-go` | Go 1.26, `net/http`, pgx, stellar/go | Vercel Go preset (`astrea-core-go.vercel.app`), root dir `services/core-go` |
| Contract | `smart-contracts/astrea/contracts/event-escrow` | Rust, soroban-sdk 27, target `wasm32v1-none` | Testnet instance referenced by `NEXT_PUBLIC_ESCROW_CONTRACT_ID` / `ESCROW_CONTRACT_ID` |

`develop` is the default branch and where all work lands; `main` only receives develop → main release PRs.

## Commands

### Web (`apps/web`)

```bash
npm ci --legacy-peer-deps      # what CI runs; postinstall does `prisma generate`
npm run dev
npm run lint / npm run lint:fix  # biome check .
npm run typecheck                # tsc --noEmit
npm run test                     # vitest run
npm run test -- --coverage       # lcov + text, same as CI
npx vitest run src/lib/github/oauth.test.ts        # one file
npx vitest run -t "posts credentials"              # one test by name
npm run build
```

Prisma: the generated client is at `src/generated/prisma` (gitignored, rebuilt by `npx prisma generate`; a stale one shows up as `Unknown field … for include statement`). `npx prisma migrate dev` only against a local database. Against the deployed Supabase project the only allowed command is `npx prisma migrate deploy` (uses `DIRECT_URL` via `prisma.config.ts`), and Vercel does **not** run it: a release PR that ships a migration needs it applied by hand first, or production breaks on the first query that touches the new column.

### Backend (`services/core-go`)

```bash
go build ./... && go vet ./... && go test ./...
go test ./internal/api -run TestReleaseBuild      # one package / one test
```

`go run .` reads plain env vars only, never a `.env` file: load it into the shell first (`set -a; source .env; set +a`). The `internal/store` integration test is skipped unless `TEST_DATABASE_URL` points at a Postgres with the Prisma migrations applied (CI does this with a service container).

### Contract (`smart-contracts/astrea`)

```bash
cargo test                                          # or: cargo test -p event-escrow <name>
cargo build --release --target wasm32v1-none        # the deployable artifact; catches no_std violations
cargo clippy --all-targets -- -D warnings           # CI enforces zero warnings
cargo fmt --all --check
contracts/event-escrow/scripts/deploy-testnet.sh    # needs EMERGENCY_ADMIN_KEY, DEFAULT_RESOLVER, TREASURY
```

Prereq: `rustup target add wasm32v1-none`. You do not need to run the contract to work on web or Go; both point at the deployed testnet instance.

### Gates

- Commits: Conventional Commits, enforced by husky `commit-msg` and the `commitlint` CI job. `lint-staged` runs Biome on staged files at pre-commit.
- CI (`.github/workflows/ci.yml`): web lint/typecheck/test/build, contracts fmt/clippy/test/wasm build, core-go build/vet/test, commitlint. All four are required on `main`; none is gated on a `paths:` filter on purpose (a skipped required check blocks the merge).
- SonarCloud: quality gate requires **≥ 80 % coverage on new code** across web, Go and Rust (`sonar-project.properties`). It is not a required check, but release PRs are expected to pass it, so untested logic in a PR is what usually fails it. Skipped on fork PRs (no secret), runs on the merge commit.
- `docs/definition-of-done.md` is what reviewers check: UI PRs need desktop + 375 px screenshots and strings in both `messages/en.json` and `messages/es.json`; money-path PRs need a real testnet tx hash in the description and the `security` label.

## Architecture

### Money path: build → sign → submit

Nothing server-side ever holds a key. Every on-chain action is a pair of core-go endpoints (`/wallets/{addr}/deposit`, `/events/{id}/create`, `/events/{id}/start`, `/events/{id}/release`, each with `/build` and `/submit`):

1. A web server action calls `build` through `src/lib/core-go/client.ts` (`server-only`); Go simulates the contract call and returns an unsigned XDR.
2. The browser signs it with Stellar Wallets Kit (`src/lib/wallet/kit.ts`, Freighter/Albedo/xBull/LOBSTR).
3. The action posts the signed XDR to `submit`; Go verifies the envelope matches what it built, submits, polls confirmation (up to 30 s), and writes the mirror rows in Postgres.

Web → Go auth is `Authorization: Bearer CORE_GO_SERVICE_TOKEN` plus `X-Astrea-Wallet` (the acting wallet). Go answers errors as `{ error: { code, message } }`; the client maps that to `CoreGoError` (codes like `envelope_mismatch`, `not_judge` are shown verbatim), non-JSON bodies to `CoreGoTransportError`, and missing `CORE_GO_URL`/token to `CoreGoConfigError` before any fetch. Host functions and tx assembly live in `internal/escrow/`, HTTP handlers in `internal/api/`, persistence in `internal/store/`.

### Contract model (ADR-006, ADR-003)

One deployed `EventEscrow` instance for everyone. An organizer's funds sit in a per-organizer `AdminWallet` ledger (`deposit_funds`); `create_event` reserves rewards out of that free balance; `withdraw_funds` can only touch free balance. Winners are unknown when funds lock, so the judge supplies winner wallets at `release_reward`, which pays them directly: the organizer is never in the payout path. Pre-launch cancel refunds to the wallet; post-launch cancellation goes through `resolve_dispute`. Prize amounts are fixed at creation and the split to wallets is enforced in Go at release, not on-chain.

### State machines exist twice

Event status (`draft → CREATED → LIVE → JUDGING → COMPLETED`, plus `DISPUTED`/`CANCELLED`) and prize status are encoded in `apps/web/src/lib/state-machines/` (`event.ts`, `prize.ts`, applied via `apply.ts`) and again on the Go side (`internal/escrow/lifecycle.go`, `internal/store/*`). `start/submit` in Go is the only path that moves `CREATED → LIVE`. Changing a transition means changing both and the contract's own `lifecycle.rs` if it is on-chain.

### Sessions are not authorization (ADR-005)

Connecting a wallet runs a server action that upserts `User`/`Wallet` and sets an httpOnly cookie with the `Wallet.id` (`src/lib/wallet/session.ts`). It is used for reads and pre-filling only; every money-moving action is authorized by the on-chain signature the contract verifies. Do not add a write that trusts the cookie.

### Database

Prisma 7 with `@prisma/adapter-pg` (`src/lib/db.ts`, client cached on `globalThis` in dev, so restart `next dev` after changing `DATABASE_URL`). Two URLs: `DATABASE_URL` is Supabase's transaction pooler (port 6543, `?pgbouncer=true`) for runtime; `DIRECT_URL` is the session pooler (5432) for the Prisma CLI. Pooler user must be `postgres.<project-ref>` (otherwise `XX000 no tenant identifier`); the `db.<ref>.supabase.co` host is IPv6-only and fails with `ENOENT` on most networks. core-go reads the same schema and never migrates it; its `DATABASE_URL` drops `?pgbouncer=true` and adds `?default_query_exec_mode=describe_exec`.

### Env and tests

`src/lib/env.ts` is a lazy Proxy validated on first access (with a testnet/mainnet gate behind `ALLOW_MAINNET`). `vitest.setup.ts` seeds the required vars; to vary them in a test, `vi.mock("@/lib/env", () => ({ env: envMock }))` with a `vi.hoisted` mutable object, and stub network with `vi.stubGlobal("fetch", …)` (see `src/lib/core-go/client.test.ts`, `src/lib/github/oauth.test.ts`). Vitest runs in `environment: node`.

### Web conventions

- All routes are under `app/[locale]/` (next-intl). Every user-facing string goes in both `messages/en.json` and `messages/es.json`; a missing key renders raw on `/es`.
- There is no light theme: `<html class="dark">`, `<body class="bg-black">`, pages hardcode `bg-black text-white`, and shadcn tokens are defined under `.dark` in `globals.css`. `dark:` variants outrank plain utilities (`.dark *` selector), so overriding a shadcn `outline`/`ghost` button with `bg-white text-black` produces black-on-black in the connected state; fix the token or variant instead.
- The header is transparent on load and gets a frosted `bg-black/40 backdrop-blur-xl` once scrolled (`site-header.tsx`, `useScrolledPast`, thresholds per variant).
- Server-only modules import `"server-only"`; the Vitest alias resolves it to a no-op.

### Docs that matter

`docs/architecture.md` (ADR-001…007), `docs/build-plan.md` and `docs/contracts-build-plan.md` (task codes like `E03`, `U16`, `S07` in issue titles map to these), `docs/definition-of-done.md`, `docs/threat-model.md`, `apps/web/prisma/README.md` (migration baseline history), `services/core-go/README.md` (endpoint contracts, Vercel pooler settings). Update the ADR when a change contradicts it.

@AGENTS.md
