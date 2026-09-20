# Database setup

Astrea's mirror database runs on Supabase Postgres (project `astrea`, `sa-east-1`).

## Environment variables

Copy `.env.example` to `.env` and fill in two connection strings from the Supabase dashboard (**Project Settings → Database → Connection string**):

```
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

- `DATABASE_URL` (transaction pooler, port 6543) — used by the app at runtime via a Prisma driver adapter (`src/lib/db.ts`).
- `DIRECT_URL` (session pooler, port 5432) — used by the Prisma CLI for migrations (`prisma.config.ts`). Migrations cannot run through the transaction pooler. The dashboard also offers a "direct" string (`postgres@db.<project-ref>.supabase.co:5432`); it resolves to IPv6 only, so on an IPv4-only network it fails before authenticating — the session pooler works from anywhere. Note the username differs between the two: `postgres.<project-ref>` on the pooler hosts, plain `postgres` on the direct host.

The dashboard's copy button leaves `[YOUR-PASSWORD]` in the string; replace the whole token, brackets included.

**Copy the full URI with the copy button in Supabase's dashboard — don't retype the password by hand.** Supabase-generated passwords often contain characters like `%` that need percent-encoding inside a connection-string URL; pasting the raw password into the `<password>` placeholder yourself can silently corrupt it (Postgres then rejects it with `28P01 password authentication failed`, even though the password "looks right"). The dashboard's copy button already encodes it correctly.

**Also watch for tooling that overwrites `.env` wholesale** (a `prisma init`-style wizard, a Vercel/Supabase env-pull step, etc.) — it can quietly replace your working `DATABASE_URL`/`NEXT_PUBLIC_ESCROW_CONTRACT_ID`/etc. with fresh boilerplate. If a script that was working suddenly can't authenticate, check whether `.env` still has all the keys from `.env.example` before re-deriving credentials from scratch.

## Migration history and how to apply new ones

The live Supabase project (`zomhlmotpcchdvixhuxd`) is tracked by Prisma's
`_prisma_migrations` table since 2026-09-14 and is at the head of
`prisma/migrations/`. For a deployed database the only command to apply new
migrations is:

```bash
npx prisma migrate deploy   # run from apps/web, uses DIRECT_URL
```

Never run `prisma migrate dev` or `prisma db push` against it: both can
rewrite the schema outside the migration history.

Background, in case the tracking table ever has to be rebuilt: the first five
migrations (`init` through `add_prize_forward_and_transition_timestamps`) were
originally applied through the Supabase MCP `apply_migration` tool in July
2026, so Prisma had no record of them. They were baselined with
`npx prisma migrate resolve --applied <migration>` on 2026-09-14, the July
test rows in `events`/`prizes`/`judges`/`submissions`/`payouts`/`op_log` were
truncated (a legacy payout had no `participants` row to backfill
`teamMemberId` from, which halts `replace_participants_with_teams`), and the
remaining seven were applied with `migrate deploy`.

## Everyday commands

```bash
npx prisma generate       # regenerate the client after editing schema.prisma
npx prisma migrate dev    # create + apply a new migration (local database only)
npx prisma studio         # browse the data (uses DIRECT_URL)
```

## RLS model

Every table has Row Level Security enabled. `events`, `prizes`, `judges`, `participants`, and `payouts` have a public `SELECT` policy scoped to non-`DRAFT`/non-`CANCELLED` events — matching the product promise that a published event is publicly auditable. `users`, `wallets`, and `op_log` have RLS enabled with **no** policies: they're reachable only via the `service_role` key, which the Next.js backend holds server-side (never `NEXT_PUBLIC_`, same rule as `CORE_GO_SERVICE_TOKEN`). No table has an `INSERT`/`UPDATE`/`DELETE` policy for `anon`/`authenticated` — every write goes through the backend, which owns state-machine validation and idempotency (see `docs/architecture.md`, Principle 1).
