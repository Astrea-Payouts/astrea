-- Fixes 3 Supabase linter findings (rls_disabled_in_public, ERROR): auth_nonces
-- and linked_accounts were added after the original enable_rls migration
-- (20260724025905) and never got the same treatment; _prisma_migrations is
-- Prisma's own bookkeeping table, auto-created by `prisma migrate deploy` and
-- never covered by a migration at all.
--
-- Same pattern as users/wallets/op_log: RLS enabled, no anon/authenticated
-- policies. The Next.js backend never needs PostgREST for these — it reads
-- and writes through the direct Postgres connection (service_role, bypasses
-- RLS by design, see docs/architecture.md Principle 1). Without this, both
-- tables were reachable from Supabase's public REST API using nothing but
-- the project's anon key:
--   - auth_nonces: sign-in nonces keyed by wallet address — reading them
--     would let someone complete another wallet's SEP-0043 challenge.
--   - linked_accounts: GitHub account linkage per wallet, some of it behind
--     a private profile (wallets.profilePublic = false) that this would have
--     bypassed entirely.
--
-- _prisma_migrations is locked down for the same reason (nothing should ever
-- reach it via the anon-key REST path); the table owner (used by `prisma
-- migrate deploy`) bypasses RLS automatically, so this has no effect on
-- migrations themselves.

ALTER TABLE "auth_nonces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "linked_accounts" ENABLE ROW LEVEL SECURITY;
-- `IF EXISTS` because CI replays every migration with plain psql against an
-- empty database, where Prisma has not created its bookkeeping table yet.
ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
