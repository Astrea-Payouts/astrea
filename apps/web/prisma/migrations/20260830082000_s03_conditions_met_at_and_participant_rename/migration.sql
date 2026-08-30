-- S03: conditionsMetAt on Event + Submission → Participant rename
-- (field shapes match docs/architecture.md domain model sketch).

-- 1) Manual-start precondition timestamp (E03). Nullable until both
--    funding and minimum-participant conditions are independently true.
ALTER TABLE "events" ADD COLUMN "conditionsMetAt" TIMESTAMPTZ;

-- 2) Drop the submissions public-read policy before renaming the table.
--    Postgres keeps policies on rename, but the USING clause still
--    references the old table name literally — recreate cleanly.
DROP POLICY IF EXISTS "public read of submissions for published events" ON "submissions";

-- 3) Rename table + columns to the architecture domain names.
ALTER TABLE "submissions" RENAME TO "participants";
ALTER TABLE "participants" RENAME COLUMN "participantWalletId" TO "walletId";
ALTER TABLE "participants" RENAME COLUMN "url" TO "submissionUrl";
ALTER TABLE "participants" RENAME COLUMN "submittedAt" TO "registeredAt";

ALTER INDEX IF EXISTS "submissions_eventId_idx" RENAME TO "participants_eventId_idx";
ALTER INDEX IF EXISTS "submissions_participantWalletId_idx" RENAME TO "participants_walletId_idx";

ALTER TABLE "participants" RENAME CONSTRAINT "submissions_pkey" TO "participants_pkey";
ALTER TABLE "participants" RENAME CONSTRAINT "submissions_eventId_fkey" TO "participants_eventId_fkey";
ALTER TABLE "participants" RENAME CONSTRAINT "submissions_participantWalletId_fkey" TO "participants_walletId_fkey";

-- 4) RLS stays enabled through the rename; replace the public SELECT policy.
--    wallets already have RLS with no anon/authenticated policies (service_role only).
CREATE POLICY "public read of participants for published events" ON "participants"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "events" e
    WHERE e."id" = "participants"."eventId"
      AND e."status" NOT IN ('DRAFT', 'CANCELLED')
  ));
