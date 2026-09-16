-- AlterTable
ALTER TABLE "events" ADD COLUMN "conditionsMetAt" TIMESTAMP(3);

-- RenameTable submissions -> participants
ALTER TABLE "submissions" RENAME TO "participants";

-- RenameColumns
ALTER TABLE "participants" RENAME COLUMN "participantWalletId" TO "walletId";
ALTER TABLE "participants" RENAME COLUMN "url" TO "submissionUrl";
ALTER TABLE "participants" RENAME COLUMN "submittedAt" TO "registeredAt";

-- RenameConstraintsAndIndexes
ALTER INDEX "submissions_pkey" RENAME TO "participants_pkey";
ALTER INDEX "submissions_eventId_idx" RENAME TO "participants_eventId_idx";
ALTER INDEX "submissions_participantWalletId_idx" RENAME TO "participants_walletId_idx";
ALTER TABLE "participants" RENAME CONSTRAINT "submissions_eventId_fkey" TO "participants_eventId_fkey";
ALTER TABLE "participants" RENAME CONSTRAINT "submissions_participantWalletId_fkey" TO "participants_walletId_fkey";

-- Recreate RLS policy for renamed table
DROP POLICY IF EXISTS "public read of submissions for published events" ON "participants";

CREATE POLICY "public read of participants for published events" ON "participants"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "events" e
    WHERE e."id" = "participants"."eventId"
      AND e."status" NOT IN ('DRAFT', 'CANCELLED')
  ));
