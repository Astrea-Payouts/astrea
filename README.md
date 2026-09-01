# Astrea

**Escrow-backed prize payouts for hackathons, bounties, and community challenges. Funds are locked on-chain before the event starts, using Stellar smart escrows.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![Network](https://img.shields.io/badge/Stellar-Testnet-blueviolet)](https://developers.stellar.org)

[What is Astrea](#what-is-astrea) • [How It Works](#how-it-works) • [Architecture](#architecture) • [Tech Stack](#technology-stack) • [Getting Started](#getting-started) • [Documentation](#documentation) • [Contributing](#contributing)

---

## What is Astrea?

Astrea puts prize money on-chain before a competition starts. Organizers fund a multi-release smart escrow on Stellar; participants can verify the prizes exist before investing their time; winners are paid in USDC as soon as judges approve.

*The name comes from Astraea, the Greek goddess of justice associated with the constellation Virgo.*

### The problem

Hackathon and bounty programs share a common promise — win, and you get paid. That promise breaks more often than it should:

- Prize pools are announced without ever being fully backed.
- Winners wait weeks or months for payment after the event ends.
- Payouts happen through manual transfers with no public record.
- Participants, often students and early-career builders, have no recourse when payment doesn't arrive.

The people with the least leverage in the process carry most of the risk.

### The approach

Astrea inverts the usual trust model:

- **Locked before launch.** An event cannot go live unless the escrow balance covers every prize.
- **Verifiable by anyone.** The public event page links directly to the escrow contract, so participants can audit the pool before committing their time.
- **Fast payouts.** A judge's approval and release settle in seconds; USDC reaches the winner's wallet immediately after.
- **Non-custodial.** Astrea never holds the funds. Every transaction is signed client-side by the party who owns it.
- **Fully auditable.** Every movement of funds has a transaction hash and a public explorer link.

---

## How It Works

1. **Organizer creates an event** — prizes, amounts (USDC), judges, and deadlines.
2. **Organizer funds the escrow** — one multi-release escrow per event, one milestone per prize. The event goes live only once it is fully funded.
3. **Participants register and submit** — wallet and USDC trustline are verified at registration, not at payout time.
4. **Judges approve and release** — the winner is not known when the prize pool is locked, so the winner's address is supplied at release time. The judge approves and releases each prize directly to the winner's wallet, with no forwarding step.
5. **Everything stays on the record** — winners, amounts, and transaction hashes are published on the public event page.

---

## Architecture

```
┌─ Frontend (Next.js App Router) ───────────────────────────┐
│  Stellar Wallets Kit (Freighter / Albedo / xBull / LOBSTR)│
│  Event wizard · Judge panel · Public event pages          │
│  Client-side XDR signing — private keys never leave       │
│  the user's wallet                                        │
└───────────────┬───────────────────────────────────────────┘
                │ HTTP API
┌───────────────▼───────────────────────────────────────────┐
│  Backend (Go service — services/core-go)                  │
│  EscrowClient interface → Soroban contract calls          │
│  Event/prize state machine · Real-time tracking ·         │
│  Build-sign-submit tx pipeline · Idempotent operations    │
└───────┬──────────────────────────────┬────────────────────┘
        │                              │
┌───────▼────────────┐   ┌─────────────▼─────────────────────┐
│ Postgres            │   │ Stellar network (testnet)         │
│ (Supabase + Prisma) │   │ Custom Soroban escrow contract    │
│ Events, Prizes,     │◄──┤ (contracts/soroban) · USDC        │
│ Judges, Payouts —   │   │ Reconciliation against Horizon    │
│ mirror state        │   │                                  │
└────────────────────┘   └───────────────────────────────────┘
```

The chain is the source of truth; the database is a mirror kept honest by a reconciliation job. Full design and ADRs are in [docs/architecture.md](docs/architecture.md).

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js (App Router), TypeScript (strict) |
| Backend | Go (`services/core-go`) |
| UI | Tailwind CSS + shadcn/ui |
| Wallets | Stellar Wallets Kit (Freighter, Albedo, xBull, LOBSTR) |
| Escrows | Custom Soroban smart contract (`contracts/soroban`, Rust) |
| ORM | Prisma + PostgreSQL |
| Database hosting | Supabase |
| Blockchain | Stellar testnet · USDC |
| CI/CD | GitHub Actions · Vercel |

---

## Getting Started

Note: the project scaffold currently ships with task **S01** of the [build plan](docs/build-plan.md). The steps below describe the target setup.

### Prerequisites

- Node.js 20+ and npm
- Go 1.22+ (for `services/core-go`)
- A Supabase project with PostgreSQL (`DATABASE_URL` and `DIRECT_URL`)
- One of the supported wallets installed (see below)

### Setup

```bash
# Install dependencies (Prisma client generates automatically via postinstall)
cd apps/web
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials and Stellar network config

# Apply migrations
npx prisma migrate dev

# Start the development server
npm run dev
```

### Environment Variables

See `apps/web/.env.example` for the authoritative list with setup notes. Summary:

```
# SUPABASE / DATABASE
DATABASE_URL=       # pooled connection, used by the app at runtime
DIRECT_URL=         # direct connection, used only by the Prisma CLI for migrations

# STELLAR NETWORK
NEXT_PUBLIC_STELLAR_NETWORK=testnet
ALLOW_MAINNET=false # explicit gate; testnet is refused into mainnet without this

# TRUSTLESS WORK — server-side only, NEVER expose with NEXT_PUBLIC_
TW_API_URL=https://dev.api.trustlesswork.com
TW_API_KEY=

# TESTNET USDC
USDC_SYMBOL=USDC
USDC_ISSUER=
```

Note: the Trustless Work variables above are what the running app reads today (`apps/web`). The custom Soroban escrow contract described under [Architecture](#architecture) is the direction the backend is moving toward — see task `E01` in [docs/build-plan.md](docs/build-plan.md) for that migration's status.

## Wallet Requirements

To use Astrea you need one of the following wallets installed (Chrome, Brave, or Firefox):

- Freighter
- Albedo
- xBull
- LOBSTR

Note: if Freighter shows "Not Available," confirm the wallet is set to testnet.

---

## Documentation

| Document | Description |
| --- | --- |
| [docs/product-flows.md](docs/product-flows.md) | Roles, user journeys, and the escrow lifecycle |
| [docs/architecture.md](docs/architecture.md) | System design, patterns, ADRs, and failure modes |
| [docs/build-plan.md](docs/build-plan.md) | Phased build plan with coded tasks (source of GitHub issues) |
| [docs/contracts-build-plan.md](docs/contracts-build-plan.md) | The escrow contract's own build plan |
| [graphify-out/GRAPH_REPORT.md](graphify-out/GRAPH_REPORT.md) | Auto-generated knowledge graph of the codebase — see [Contributing](#contributing) for how it stays current |

---

## Contributing

Astrea is built in the open and welcomes contributors at all levels. Issues are broken into small, well-scoped tasks with labels, including `good first issue` — see the [build plan](docs/build-plan.md) for the task map. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, code quality expectations, and how to open a pull request.

This project uses Biome for linting and formatting, and Husky with commitlint to enforce [Conventional Commits](https://www.conventionalcommits.org/) (for example, `feat: add event wizard`, `fix: trustline check`), both locally via pre-commit hooks and again in CI. Pull requests that fail these checks are rejected.

## Maintainers

| Name | Role | GitHub |
| --- | --- | --- |
| Christopher Lamberti | Maintainer | [cLamberti](https://github.com/cLamberti) |
| Dereck Monge | Maintainer | [Dmong04](https://github.com/Dmong04) |

## License

[MIT](LICENSE)
