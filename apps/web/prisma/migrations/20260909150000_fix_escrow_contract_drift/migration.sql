-- Corrects Prize/Payout/EventStatus/PrizeStatus drift from the shipped
-- event-escrow contract (smart-contracts/astrea/contracts/event-escrow).
-- See docs/architecture.md ADR-001/ADR-002/ADR-003 and the contract's
-- release_reward signature: one event locks one reward, release_reward
-- pays every winner directly in a single atomic transaction, and the
-- judge is the sole payout signer — there is no approval step and no
-- judge-forwards-to-winner hop.
--
-- Live-database impact (verified 2026-09-09 against the `astrea` Supabase
-- project): every affected table (`prizes`, `payouts`) has 0 rows, so
-- nothing here drops or converts existing data. The two `amountUsdc` ->
-- `amount` renames use RENAME COLUMN (not drop+add) regardless, so the
-- column contents would survive even if rows existed.

-- AlterEnum
ALTER TYPE "EventStatus" ADD VALUE 'DISPUTED';

-- AlterEnum: drop APPROVED — the contract has no approval step, only
-- PENDING -> ASSIGNED -> RELEASED (-> PAID_OUT) with a DISPUTED branch.
BEGIN;
CREATE TYPE "PrizeStatus_new" AS ENUM ('PENDING', 'ASSIGNED', 'RELEASED', 'PAID_OUT', 'DISPUTED');
ALTER TABLE "prizes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "prizes" ALTER COLUMN "status" TYPE "PrizeStatus_new" USING ("status"::text::"PrizeStatus_new");
ALTER TYPE "PrizeStatus" RENAME TO "PrizeStatus_old";
ALTER TYPE "PrizeStatus_new" RENAME TO "PrizeStatus";
DROP TYPE "PrizeStatus_old";
ALTER TABLE "prizes" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropIndex
DROP INDEX "prizes_eventId_milestoneIndex_key";

-- DropIndex: Payout.txHash can no longer be globally unique — a single
-- release_reward call produces one tx hash shared by every winner (Payout
-- row) it pays in that event.
DROP INDEX "payouts_txHash_key";

-- AlterTable: Prize — no milestones (drop milestoneIndex, natural key is
-- eventId+rank); no judge-forwards-to-winner hop (drop forwardTxHash,
-- paidOutAt); amountUsdc -> amount (the contract is token-agnostic, see
-- AdminWallet.token — the live testnet run used native XLM, not USDC).
ALTER TABLE "prizes" DROP COLUMN "forwardTxHash",
DROP COLUMN "milestoneIndex",
DROP COLUMN "paidOutAt";
ALTER TABLE "prizes" RENAME COLUMN "amountUsdc" TO "amount";

-- AlterTable: Payout — same amountUsdc -> amount rename as Prize.
ALTER TABLE "payouts" RENAME COLUMN "amountUsdc" TO "amount";

-- CreateIndex
CREATE UNIQUE INDEX "prizes_eventId_rank_key" ON "prizes"("eventId", "rank");

-- CreateIndex
CREATE INDEX "payouts_txHash_idx" ON "payouts"("txHash");

-- CreateIndex: the atomic-release invariant is now (prizeId, txHash), not
-- txHash alone — one payout per prize per release transaction.
CREATE UNIQUE INDEX "payouts_prizeId_txHash_key" ON "payouts"("prizeId", "txHash");
