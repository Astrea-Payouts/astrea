# Contributing to Astrea

Thanks for considering contributing — this project is built in the open specifically so others can help. This guide covers everything you need to go from "cloned the repo" to "opened a PR."

## Before you start

- Read [README.md](README.md) for what Astrea is and why it exists.
- Read [docs/architecture.md](docs/architecture.md) for how the pieces fit together, and the ADRs behind key decisions — several of them (ADR-003, ADR-005, ADR-006) exist because a real assumption turned out to be wrong when tested, which is exactly the kind of thing worth reading before you build on top of it.
- Check [docs/build-plan.md](docs/build-plan.md) for the current phase and task list. Every GitHub issue traces back to a coded task there (e.g. `[E02]`, `[U01]`) — the code in an issue title tells you which phase it belongs to and what depends on it.

## Local setup

```bash
git clone https://github.com/Astrea-Payouts/astrea.git
cd astrea
npm install
cp .env.example .env
```

Fill in `.env` following the comments in `.env.example` and [prisma/README.md](prisma/README.md):

- **Database**: a free Supabase project gets you `DATABASE_URL`/`DIRECT_URL` — see `prisma/README.md` for the exact steps and the migration-baseline gotcha before running `prisma migrate dev` for the first time.
- **Trustless Work**: request a **testnet** API key at [dapp.trustlesswork.com](https://dapp.trustlesswork.com) (BackOffice → API keys). Never a mainnet key for local dev.
- **Stellar network**: leave `NEXT_PUBLIC_STELLAR_NETWORK=testnet` and `ALLOW_MAINNET=false`. See [ADR in architecture.md](docs/architecture.md) for why mainnet is gated behind an explicit flag.

```bash
npm run dev          # start the dev server
npm run test          # run the test suite (Vitest)
npm run lint           # Biome check
npm run typecheck   # tsc --noEmit
npm run build          # production build
```

### Wallet testing

To exercise anything wallet-related you'll need one of Freighter, Albedo, xBull, or LOBSTR, **set to testnet**. Freighter is the most common for local dev — after installing, switch its network to Testnet (Settings → Security → Network) before connecting.

## Code quality — enforced, not optional

This repo uses [Biome](https://biomejs.dev) for linting/formatting and [Husky](https://typicode.github.io/husky) + [commitlint](https://commitlint.js.org) for commit hygiene, both locally and in CI:

- **Pre-commit**: `lint-staged` runs Biome on staged files automatically. If it can't auto-fix something, the commit is blocked until you do.
- **Commit messages**: must follow [Conventional Commits](https://www.conventionalcommits.org) (`feat: add event wizard`, `fix: trustline check`, `docs: update README`). Enforced locally by a Husky hook and again in CI on every PR — a bypassed local hook still gets caught.
- **CI**: every PR runs lint, typecheck, test, and build. All four must pass before merge.

If a check fails and you're not sure why, the error output is usually specific enough to act on directly — Biome and `tsc` both point at exact lines.

## Opening a PR

1. **Reference the issue** you're working on in the PR description (`Closes #123`).
2. **Keep it scoped** to the linked task — if you find something else worth fixing along the way, open a separate issue rather than bundling it in.
3. **If your change touches money movement** (anything under `E0*`, escrow calls, signing, the reconciliation job) — say so explicitly in the PR description and how you verified it on testnet. These get extra review; see the `security` label.
4. **Update docs alongside code** — if you change a decision recorded in an ADR, update the ADR rather than leaving it stale. A wrong doc is worse than no doc.

## Where to ask questions

- Open a [GitHub Discussion](https://github.com/Astrea-Payouts/astrea/discussions) or an issue with the `question` label for anything project-specific.
- For general Stellar/Soroban questions unrelated to Astrea itself, the [Stellar Developers Discord](https://discord.gg/stellardev) is a better fit.

## Reporting a security issue

If you find something that could put user funds or data at risk, **please don't open a public issue.** Email the maintainer directly (see the GitHub profile on the repo) with details, and allow time for a fix before any public disclosure. Everything else — non-security bugs, feature requests, questions — is fine as a normal public issue.

## License

By contributing, you agree your contributions are licensed under the project's [MIT License](LICENSE).
