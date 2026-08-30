# Database setup

Astrea's mirror database runs on Supabase Postgres (project `astrea`, `sa-east-1`).

## Environment variables

Copy `.env.example` to `.env` and fill in two connection strings from the Supabase dashboard (**Project Settings → Database → Connection string**):

```
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
```

- `DATABASE_URL` (pooled, port 6543) — used by the app at runtime via a Prisma driver adapter (`src/lib/db.ts`).
- `DIRECT_URL` (direct, port 5432) — used by the Prisma CLI for migrations (`prisma.config.ts`). Supabase does not support running migrations over the pooled connection.

**Copy the full URI with the copy button in Supabase's dashboard — don't retype the password by hand.** Supabase-generated passwords often contain characters like `%` that need percent-encoding inside a connection-string URL; pasting the raw password into the `<password>` placeholder yourself can silently corrupt it (Postgres then rejects it with `28P01 password authentication failed`, even though the password "looks right"). The dashboard's copy button already encodes it correctly.

**Also watch for tooling that overwrites `.env` wholesale** (a `prisma init`-style wizard, a Vercel/Supabase env-pull step, etc.) — it can quietly replace your working `DATABASE_URL`/`TW_API_KEY`/etc. with fresh boilerplate. If a script that was working suddenly can't authenticate, check whether `.env` still has all the keys from `.env.example` before re-deriving credentials from scratch.

## ⚠️ Migration baseline (read before running `prisma migrate dev`)

The schema in this database was **not** created by running `prisma migrate dev` locally — it was applied directly against the live Supabase project (via the Supabase MCP `apply_migration` tool) during initial setup, because the database password wasn't available in that environment. The SQL in `prisma/migrations/` is a faithful record of what was applied, and `prisma/schema.prisma` matches it exactly — but Prisma's own tracking table (`_prisma_migrations`) does not exist in the live database yet.

**Before running `prisma migrate dev` for the first time with real credentials**, baseline it so Prisma knows these migrations are already applied — otherwise it will try to re-run `CREATE TABLE` on tables that already exist:

```bash
npx prisma migrate resolve --applied 20260724025900_init
npx prisma migrate resolve --applied 20260724025905_enable_rls
npx prisma migrate resolve --applied 20260724025910_add_missing_fk_indexes
npx prisma migrate resolve --applied 20260726064951_add_paid_out_prize_status
npx prisma migrate resolve --applied 20260726065728_add_prize_forward_and_transition_timestamps
```

After that, `prisma migrate dev` behaves normally for all future migrations (including S03's
`20260830082000_s03_conditions_met_at_and_participant_rename`).

## Everyday commands

```bash
npx prisma generate       # regenerate the client after editing schema.prisma
npx prisma migrate dev    # create + apply a new migration (after baselining, see above)
npx prisma studio         # browse the data (uses DIRECT_URL)
```

## RLS model

Every table has Row Level Security enabled. `events`, `prizes`, `judges`, `participants`, and `payouts` have a public `SELECT` policy scoped to non-`DRAFT`/non-`CANCELLED` events — matching the product promise that a published event is publicly auditable. `users`, `wallets`, and `op_log` have RLS enabled with **no** policies: they're reachable only via the `service_role` key, which the Next.js backend holds server-side (never `NEXT_PUBLIC_`, same rule as the Trustless Work API key). No table has an `INSERT`/`UPDATE`/`DELETE` policy for `anon`/`authenticated` — every write goes through the backend, which owns state-machine validation and idempotency (see `docs/architecture.md`, Principle 1).
