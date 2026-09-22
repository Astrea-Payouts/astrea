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

Every table has Row Level Security enabled. `events`, `prizes`, `judges`, `teams`, `team_members`, and `payouts` have a public `SELECT` policy scoped to non-`DRAFT`/non-`CANCELLED` events — matching the product promise that a published event is publicly auditable. `users`, `wallets`, `op_log`, `auth_nonces`, `linked_accounts`, and `_prisma_migrations` have RLS enabled with **no** policies. No table has an `INSERT`/`UPDATE`/`DELETE` policy for `anon`/`authenticated` — every write goes through the backend, which owns state-machine validation and idempotency (see `docs/architecture.md`, Principle 1).

A new table needs its own `ENABLE ROW LEVEL SECURITY` in the migration that creates it: an earlier migration's `ALTER TABLE` cannot reach a table that does not exist yet. That is how `auth_nonces` and `linked_accounts` stayed open to the anon-key REST path until `20260922120000`, and `_prisma_migrations` (which Prisma creates itself, outside any migration) until the same one. Supabase's own linter flags the gap as `rls_disabled_in_public`; check it after adding a table.

Those policies only constrain Supabase's API roles (`anon`, `authenticated`). Neither backend goes through them. `src/lib/db.ts` connects through the Prisma driver adapter with the pooled `DATABASE_URL` (port 6543, `?pgbouncer=true`); core-go connects with pgx and its own copy of `DATABASE_URL`, which must not carry `?pgbouncer=true` (`internal/config/config.go` refuses to boot otherwise) and adds `?default_query_exec_mode=describe_exec`. Both authenticate as the same database role — `postgres.<project-ref>` on a pooler host and plain `postgres` on the direct host are the same `postgres` role — so the pooling difference changes nothing here. That role is not subject to these policies — it both owns the tables and carries Supabase's own role attributes — so both backends read and write every row, including `users`/`wallets`/`op_log`, unfiltered. That is the intended trust model (the backend is the only writer), and it is why `DATABASE_URL` follows the same rule as `CORE_GO_SERVICE_TOKEN`: server-side only, never `NEXT_PUBLIC_`. There is no Supabase client or `service_role` key anywhere in the repo. Before treating RLS as a second line of defense for a backend query, check which mechanism is actually in play: `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'postgres'` and `SELECT relname, relforcerowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace`.
