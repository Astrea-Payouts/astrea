-- Flagged by Supabase's performance advisor: foreign keys without a
-- covering index.
CREATE INDEX "events_organizerWalletId_idx" ON "events"("organizerWalletId");
CREATE INDEX "prizes_winnerWalletId_idx" ON "prizes"("winnerWalletId");
