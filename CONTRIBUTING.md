# Contributing to Astrea

Thanks for considering contributing — this project is built in the open specifically so others can help. This guide covers everything you need to go from "cloned the repo" to "opened a PR."

## Before you start

- Read [README.md](README.md) for what Astrea is and why it exists.
- All participation in this project is covered by the [Code of Conduct](CODE_OF_CONDUCT.md). Found a security issue instead of a bug? See [SECURITY.md](SECURITY.md) — please don't open a public issue for it.
- Read [docs/architecture.md](docs/architecture.md) for how the pieces fit together, and the ADRs behind key decisions — several of them (ADR-001, ADR-003) are backed by real testnet spikes in [spikes/](spikes), not just a plan on paper, which is worth knowing before you build on top of them.
- Check [docs/build-plan.md](docs/build-plan.md) for the current phase and task list. Every GitHub issue traces back to a coded task there (e.g. `[E02]`, `[U01]`) — the code in an issue title tells you which phase it belongs to and what depends on it.

## Local setup

**Fork the repo first** (top-right on GitHub) — you won't have push access to `Astrea-Payouts/astrea` directly, and a PR has to come from a branch GitHub can see, which means your fork. Then clone *your* fork, not the upstream one:

```bash
git clone https://github.com/<your-username>/astrea.git
cd astrea
git remote add upstream https://github.com/Astrea-Payouts/astrea.git
cd apps/web
npm install
cp .env.example .env
```

The `upstream` remote is so you can pull in new work before starting a task:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

Fill in `.env` following the comments in `.env.example` and [apps/web/prisma/README.md](apps/web/prisma/README.md):

- **Database**: a free Supabase project gets you `DATABASE_URL`/`DIRECT_URL` — see `apps/web/prisma/README.md` for the exact steps and the migration-baseline gotcha before running `prisma migrate dev` for the first time.
- **Trustless Work**: request a **testnet** API key at [dapp.trustlesswork.com](https://dapp.trustlesswork.com) (BackOffice → API keys) for `TW_API_KEY`. Never a mainnet key for local dev. This is what the running app calls today — see the note in [README.md](README.md#environment-variables) about where the custom Soroban contract fits in.
- **Stellar network**: leave `NEXT_PUBLIC_STELLAR_NETWORK=testnet` and `ALLOW_MAINNET=false`. See [docs/architecture.md](docs/architecture.md) for why mainnet is gated behind an explicit flag.

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

## Keeping the knowledge graph updated

The repo has a [graphify](https://github.com/safishamsi/graphify) knowledge graph at [graphify-out/GRAPH_REPORT.md](graphify-out/GRAPH_REPORT.md) (interactive view: `graphify-out/graph.html`). A `post-commit` Husky hook auto-rebuilds it after every commit — **but only for code file changes**, without needing an LLM.

**Doc changes are not covered by the hook.** If your PR touches a `.md` file (README, `docs/`, any `CONTRIBUTING.md`-style guide), the hook won't pick it up — semantic extraction from docs needs an LLM pass. Run this yourself before opening the PR:

```
/graphify --update
```

from a Claude Code session at the repo root (or any agent host that can run the graphify skill). If for whatever reason the hook doesn't fire, or you're not sure it ran, running `/graphify --update` manually is always safe — it only re-extracts what actually changed.

**CI enforces this for code.** The `graphify-out/` files in your PR must match a fresh `graphify update .` run against your code changes — if they don't, the `Knowledge graph in sync (code)` job fails and tells you what to run. It only checks code, not docs, since it has no LLM available; a stale doc-driven graph won't fail CI, so don't rely on green CI as proof the graph reflects your doc changes.

## Opening a PR

1. **Branch off your fork's `main`**, push it to your fork, then open the PR from there against `Astrea-Payouts/astrea:main` — GitHub does this automatically when you push a branch to your fork and click "Compare & pull request."
2. **Reference the issue** you're working on in the PR description (`Closes #123`).
3. **Keep it scoped** to the linked task — if you find something else worth fixing along the way, open a separate issue rather than bundling it in.
4. **If your change touches money movement** (anything under `E0*`, escrow calls, signing, the reconciliation job) — say so explicitly in the PR description and how you verified it on testnet. These get extra review; see the `security` label.
5. **Update docs alongside code** — if you change a decision recorded in an ADR, update the ADR rather than leaving it stale. A wrong doc is worse than no doc.

## Where to ask questions

- Open a [GitHub Discussion](https://github.com/Astrea-Payouts/astrea/discussions) or an issue with the `question` label for anything project-specific.
- For general Stellar/Soroban questions unrelated to Astrea itself, the [Stellar Developers Discord](https://discord.gg/stellardev) is a better fit.

## Reporting a security issue

If you find something that could put user funds or data at risk, **please don't open a public issue.** Email the maintainer directly (see the GitHub profile on the repo) with details, and allow time for a fix before any public disclosure. Everything else — non-security bugs, feature requests, questions — is fine as a normal public issue.

## License

By contributing, you agree your contributions are licensed under the project's [MIT License](LICENSE).
