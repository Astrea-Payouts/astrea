# Security Policy

Astrea moves real funds through on-chain escrow. If you find a vulnerability,
please report it privately — not as a public GitHub issue — so it can be fixed
before it's disclosed.

## Reporting a Vulnerability

Use one of these private channels:

1. **GitHub Private Vulnerability Reporting** (preferred): open the
   [Security tab](https://github.com/Astrea-Payouts/astrea/security/advisories/new)
   on this repo and click "Report a vulnerability."
2. **Telegram**, if you need a faster or lower-friction first contact:
   - Christopher Lamberti — [@cLamberti](https://t.me/cLamberti)
   - Dereck Monge Chaves — [@Dmong04](https://t.me/Dmong04)

Please include:

- A description of the vulnerability and its potential impact (especially for
  anything touching `contracts/soroban`, `services/core-go`'s escrow client,
  or fund-moving flows in `apps/web`).
- Steps to reproduce, or a proof of concept if you have one.
- Whether you've tested this on testnet, mainnet, or only read the code.

We'll acknowledge reports as quickly as we can and keep you updated as we
investigate and fix the issue. We ask that you give us a reasonable window to
fix the issue before any public disclosure.

## Scope

In scope:

- `contracts/soroban` — the escrow smart contract.
- `services/core-go` — the Go backend, especially anything that builds, signs,
  or submits Stellar transactions.
- `apps/web` — the frontend, especially wallet connection, session handling,
  and anything that displays or acts on financial data.
- Repository/CI configuration that could lead to a supply-chain compromise.

Out of scope:

- Findings that require physical access to a user's device or wallet.
- Issues only reproducible on a fork/branch that was never merged.
- Social engineering against maintainers or contributors.

## Supported Versions

Astrea is pre-1.0 and under active development. Only the `main` and `develop`
branches are supported — there are no tagged releases yet, and the contract
has not been deployed to mainnet (see
[docs/contracts-build-plan.md](docs/contracts-build-plan.md) for the mainnet
gating security pass).
