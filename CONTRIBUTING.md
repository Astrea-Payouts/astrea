# Contributing to Astrea

Thanks for considering contributing — this project is built in the open specifically so others can help. This guide covers everything you need to go from "cloned the repo" to "opened a PR."

## Before you start

- Read [README.md](README.md) for what Astrea is and why it exists.
- All participation in this project is covered by the [Code of Conduct](CODE_OF_CONDUCT.md). Found a security issue instead of a bug? See [SECURITY.md](SECURITY.md) — please don't open a public issue for it.
- Read [docs/architecture.md](docs/architecture.md) for how the pieces fit together, and the ADRs behind key decisions — several of them (ADR-001, ADR-003) are backed by real testnet spikes in [spikes/](spikes), not just a plan on paper, which is worth knowing before you build on top of them.
- Check [docs/build-plan.md](docs/build-plan.md) for the current phase and task list. Every GitHub issue traces back to a coded task there (e.g. `[E02]`, `[U01]`) — the code in an issue title tells you which phase it belongs to and what depends on it.
- Read [docs/definition-of-done.md](docs/definition-of-done.md) before you open a PR, not after — it's the exact checklist a reviewer checks your work against, and for money-path or UI work it includes requirements (a real testnet transaction, screenshots at both desktop and mobile width) that are much cheaper to build in from the start than to add once asked.

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

The `upstream` remote is so you can pull in new work before starting a task. Note that `develop` is the branch everything is built on — `main` only receives promoted releases, so branching off it will put you behind:

```bash
git fetch upstream
git checkout develop
git merge upstream/develop
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

## The knowledge graph — you don't have to do anything

There's a [graphify](https://github.com/safishamsi/graphify) knowledge graph indexing code, docs, ADRs and task definitions together — useful when you're new here and want to see how a piece fits before changing it.

**Browse it at [astrea-payouts.github.io/astrea](https://astrea-payouts.github.io/astrea/)** — no clone, no install. CI rebuilds and republishes it on every merge to `develop`, so the published copy is always current.

**It is published, not committed.** A fresh clone has no `graphify-out/graph.json`, and that's deliberate: regenerating the whole graph costs zero tokens and about a minute, so committing 7.8 MB of it bought nothing — and guaranteed a stale copy, because branch protection stops CI from pushing a refreshed one back. A stale graph is worse than none, since tools read it without noticing its age. The one exception is `graphify-out/cache/semantic/`, which stays in git: that part is LLM-derived and costs real tokens to rebuild.

**Nothing about this is your responsibility.** Don't install graphify, don't run it, don't commit `graphify-out/`. There is no hook and no CI check enforcing anything about the graph, by design — the previous setup demanded a byte-identical rebuild from every contributor's machine, which is not something a parallel floating-point build can guarantee across operating systems.

If you do want to query it locally, `pip install graphifyy==0.9.45` then `graphify update .` builds it, and [AGENTS.md](AGENTS.md) documents what it answers well and where it will confidently mislead you.

## Opening a PR

1. **Branch off your fork's `develop`**, push it to your fork, then open the PR from there against `Astrea-Payouts/astrea:develop` — GitHub targets `develop` by default when you push a branch to your fork and click "Compare & pull request," since it is this repo's default branch. Don't retarget it at `main`: that branch only receives promoted releases, and a PR opened against it will show unrelated commits in the diff.
2. **Reference the issue** you're working on in the PR description (`Closes #123`).
3. **Keep it scoped** to the linked task — if you find something else worth fixing along the way, open a separate issue rather than bundling it in.
4. **If your change touches money movement** (anything under `E0*`, escrow calls, signing, the reconciliation job) — say so explicitly in the PR description and how you verified it on testnet. These get extra review; see the `security` label.
5. **Update docs alongside code** — if you change a decision recorded in an ADR, update the ADR rather than leaving it stale. A wrong doc is worse than no doc.

## Where to ask questions

- Open a [GitHub Discussion](https://github.com/Astrea-Payouts/astrea/discussions) or an issue with the `question` label for anything project-specific.
- For general Stellar/Soroban questions unrelated to Astrea itself, the [Stellar Developers Discord](https://discord.gg/stellardev) is a better fit.

## Reporting a security issue

If you find something that could put user funds or data at risk, **please don't open a public issue.** See [SECURITY.md](SECURITY.md) for how to report it privately, and allow time for a fix before any public disclosure. Everything else — non-security bugs, feature requests, questions — is fine as a normal public issue.

## License

By contributing, you agree your contributions are licensed under the project's [MIT License](LICENSE).
