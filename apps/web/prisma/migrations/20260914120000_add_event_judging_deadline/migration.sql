-- Deadline the judge has to sign release_reward, passed to the contract's
-- set_event_in_progress as ledger seconds (#11). Null while DRAFT.
--
-- Hand-written, not `prisma migrate dev`-generated: this schema's `id`
-- columns are native UUID (see the init migration) while schema.prisma
-- declares them as plain String, a known drift the auto-diff engine tries
-- to "fix" with unrelated ALTER COLUMN ... SET DATA TYPE statements across
-- every table (breaks RLS policies that reference those columns) -- same
-- reason 20260911090000_add_event_escrow_event_id is hand-written.
ALTER TABLE "events" ADD COLUMN "judgingDeadlineAt" TIMESTAMPTZ;
