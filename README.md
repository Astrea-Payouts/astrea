# 🌠 Astrea

**Escrow-backed prize payouts for hackathons, bounties, and community challenges — funds locked on-chain before the event starts, powered by Stellar smart escrows.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![Network](https://img.shields.io/badge/Stellar-Testnet-blueviolet)](https://developers.stellar.org)

[What is Astrea](#-what-is-astrea) • [How It Works](#-how-it-works) • [Architecture](#-architecture) • [Tech Stack](#-technology-stack) • [Getting Started](#-getting-started) • [Documentation](#-documentation) • [Contributing](#-contributing)

---

## 🎯 What is Astrea?

**Astrea** puts prize money on-chain *before* the competition starts. Organizers fund a multi-release smart escrow on Stellar; participants verify the prizes exist before writing a single line of code; winners get paid in USDC seconds after judges approve.

> Astrea was the Greek goddess of justice who became a constellation — fairness, living among the stars. 🌌

### The Problem We Solve

Every hackathon and bounty program makes the same promise: *"win and we'll pay you."* Too often that promise breaks:

- 💸 Prize pools are announced that never fully existed
- ⏳ Winners chase payments for weeks or months after the event
- 🕳️ Payouts happen through opaque manual transfers with no public record
- 🎓 Participants — mostly students and early-career builders — have zero leverage when payment never arrives

The people with the least power in the chain carry all the risk.

### Our Solution

Astrea flips the trust model:

🔐 **Locked before launch** — an event cannot go live unless the escrow balance covers every prize

👀 **Verifiable by anyone** — the public event page links the escrow contract; participants audit the pool before investing their time

⚡ **Fast payouts** — the judge approves, releases, and forwards the prize in a few seconds of signing; USDC settles to the winner's wallet right after

🔑 **Non-custodial** — nobody (including Astrea) holds the funds; every transaction is signed client-side by the role that owns it

📜 **Fully auditable** — every movement has a transaction hash and a public explorer link

---

## 🚀 How It Works

1. **🛠️ Organizer creates an event** — prizes, amounts (USDC), judges, deadlines
2. **💰 Organizer funds the escrow** — one multi-release escrow per event, one milestone per prize; the event goes live only when fully funded
3. **👩‍💻 Participants register and submit** — wallet + USDC trustline verified at registration, not at payout time
4. **⚖️ Judges approve and release** — the winner isn't known when the prize pool is locked, so the winner's address is supplied at release time; the judge approves and releases each prize directly to the winner's wallet, no forwarding step
5. **🏁 Everything on the record** — winners, amounts, and transaction hashes on the public event page

---

## 🏗️ Architecture

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

The chain is the source of truth; the database is a mirror kept honest by a reconciliation job. Full design and ADRs in [docs/architecture.md](docs/architecture.md).

---

## 🛠️ Technology Stack

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

## 🏁 Getting Started

> ⚠️ The project scaffold ships with task **S01** of the [build plan](docs/build-plan.md). The steps below describe the target setup.

### Prerequisites

- **Node.js 20+** and npm
- **Go 1.22+** (for `services/core-go`)
- A **Supabase** project with PostgreSQL (`DATABASE_URL` and `DIRECT_URL`)
- One of the supported wallets installed (see below)

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials and Stellar network config

# Generate Prisma client and apply migrations
npm run prisma:generate
npm run prisma:migrate

# Start the development server
npm run dev
```

### Environment Variables

```
# SUPABASE
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# PRISMA
DATABASE_URL=
DIRECT_URL=

# STELLAR
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_ESCROW_CONTRACT_ID=
STELLAR_USDC_ISSUER=
```

## 👛 Wallet Requirements

To use Astrea you need one of the following wallets installed (Chrome, Brave, or Firefox):

- **Freighter**
- **Albedo**
- **xBull**
- **LOBSTR**

> 💡 If Freighter shows "Not Available", make sure the wallet is set to **testnet**.

---

## 📖 Documentation

| Document | Description |
| --- | --- |
| [docs/product-flows.md](docs/product-flows.md) | Roles, user journeys, and the escrow lifecycle |
| [docs/architecture.md](docs/architecture.md) | System design, patterns, ADRs, and failure modes |
| [docs/build-plan.md](docs/build-plan.md) | Phased build plan with coded tasks (source of GitHub issues) |
| [docs/contracts-build-plan.md](docs/contracts-build-plan.md) | The escrow contract's own build plan |
| [graphify-out/GRAPH_REPORT.md](graphify-out/GRAPH_REPORT.md) | Auto-generated knowledge graph of the codebase — see [Contributing](#-contributing) for how it stays current |

---

## 🤝 Contributing

Astrea is built in the open and welcomes contributors of all levels. Issues are parceled into small, well-scoped tasks with labels (including `good first issue`) — see the [build plan](docs/build-plan.md) for the task map. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, code quality expectations, and how to open a PR.

_This project uses **Biome** for linting/formatting and **Husky** + **commitlint** to enforce [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: add event wizard`, `fix: trustline check`) — both locally via pre-commit hooks and again in CI. PRs that fail these checks are rejected._

## 🧑‍🚀 Maintainers

| Name | Role | GitHub |
| --- | --- | --- |
| Christopher Lamberti | Maintainer | [cLamberti](https://github.com/cLamberti) |

## 📄 License

[MIT](LICENSE)
