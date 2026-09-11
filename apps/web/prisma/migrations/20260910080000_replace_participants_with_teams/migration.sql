-- Replaces the individual-participant model with teams. Every entrant is now
-- a team (a solo entrant is a team of one); a team declares its own prize
-- split at registration; Participant is gone.
--
-- Why: release_reward(judge, event_id, winners: Vec<Winner>) in
-- event-escrow/src/rewards.rs pays each Winner{place, amount, address}
-- directly and individually — `place` is never validated or emitted
-- (rewards.rs:101, confirmed by reading the function), so ranking is
-- off-chain metadata entirely and a winning team can be expanded into N
-- on-chain winner entries sharing one `place` with no contract change.
-- MAX_WINNERS = 25 (rewards.rs:20) becomes a positions*team-size ceiling
-- under this change, and every winner.amount must be > 0 — enforced here
-- one layer up by team_members.shareBasisPoints > 0, since a zero-share
-- member would produce a Winner the contract rejects, failing the whole
-- atomic release for every other winner in the same call.
--
-- Rounding: a team declares proportions before knowing what a position
-- pays, so shares are stored as integer basis points (1 bp = 0.01%; 10000 bp
-- = 100%), never a float/Decimal percentage. release_reward's
-- total_distributed == event.reward assert is exact-equality, so a leftover
-- remainder from dividing an integer prize by these basis points cannot be
-- dropped — see the remainder-rule doc comment on TeamMember.shareBasisPoints
-- in schema.prisma (lowest-ordinal member absorbs it). That allocation is
-- the Go release-wrapper's job (#25); nothing here performs it.
--
-- Live-database impact: the `astrea` Supabase project (verified 2026-09-10)
-- turned out to be five migrations behind `develop` — it has never had
-- `prisma migrate deploy` (or equivalent) run past `20260724025905_enable_rls`.
-- Its `submissions` table (pre-S03-rename name for what schema.prisma now
-- calls `participants`) still has the old `participantWalletId`/`url`/
-- `submittedAt` columns, `prizes` still has `amountUsdc`/`milestoneIndex`/
-- `forwardTxHash`/`paidOutAt`, and `auth_nonces` doesn't exist at all. This
-- is a pre-existing deployment gap, unrelated to this change, not fixed
-- here — flagged in the PR body for whoever owns deploying this project.
-- The row-level data is unaffected by that gap (S03's rename and the drift
-- fix touch no values, only names/types already confirmed compatible by
-- earlier migrations' own verified-live-DB notes), so the counts below are
-- real, from that table under its current name:
--   `submissions` (-> `participants`): 2 rows. Both have a non-null wallet;
--     no wallet repeats within the same eventId, so both convert cleanly to
--     a team-of-one with no conflict against the new
--     team_members_eventId_walletId_key constraint below.
--   `prizes`: 2 rows. One (event "Astrea E06 vertical slice...", status
--     COMPLETED) has `winnerWalletId` set to the same wallet as one of the
--     two submissions above and one `payouts` row against it (status
--     PAID_OUT) — backfilled below to the matching migrated team and team
--     member. The other prize (event "Astrea Demo Hackathon", status
--     JUDGING) has `winnerWalletId` NULL and stays winnerTeamId NULL.
--   `payouts`: 1 row, backfilled to the team member above.
-- Both source events are already past LIVE (COMPLETED and JUDGING), which
-- is exactly why the data migration below runs BEFORE the share-freeze
-- trigger is created: the freeze trigger must not exist yet when this
-- migration reconstructs already-decided historical state, only once it's
-- done, so it guards future application writes without rejecting its own
-- backfill.
--
-- Migrated teams get the placeholder name 'Solo entrant' — no display name
-- exists for a Participant today, and there is no UI in this repo for an
-- organizer or entrant to set one (task explicitly out of scope). Placeholder,
-- not destructive; renameable whenever that UI exists.

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "submissionUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- eventId duplicates teams.eventId deliberately — see the doc comment on
-- TeamMember.eventId in schema.prisma — it is what lets "a wallet may not
-- be on two teams in the same event" be the plain UNIQUE index below
-- instead of a cross-table trigger.
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "shareBasisPoints" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_members_shareBasisPoints_check" CHECK ("shareBasisPoints" > 0 AND "shareBasisPoints" <= 10000)
);

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id");

-- CreateIndex
CREATE INDEX "teams_eventId_idx" ON "teams"("eventId");
CREATE INDEX "team_members_teamId_idx" ON "team_members"("teamId");
CREATE INDEX "team_members_walletId_idx" ON "team_members"("walletId");

-- CreateIndex: a wallet may not be on two teams in the same event.
CREATE UNIQUE INDEX "team_members_eventId_walletId_key" ON "team_members"("eventId", "walletId");

-- CreateIndex: deterministic ordering is unique per team, not globally —
-- also the tiebreak target for the remainder-allocation rule.
CREATE UNIQUE INDEX "team_members_teamId_ordinal_key" ON "team_members"("teamId", "ordinal");

-- A team's shares must sum to exactly 10000 bp and it must have at least one
-- member. Both invariants span every member row of a team, so neither can be
-- a plain single-row CHECK constraint; this is the SQL-level "equivalent
-- guarantee" instead. Deferred to end of transaction so a team and its
-- member rows can be inserted across several statements in the same
-- transaction and only validated once, at commit — required here, since the
-- application will create a team then insert N member rows after it.
CREATE OR REPLACE FUNCTION check_team_shares(p_team_id UUID) RETURNS void AS $$
DECLARE
  v_member_count INTEGER;
  v_share_sum INTEGER;
BEGIN
  -- The team itself may already be gone (e.g. cascaded from an event
  -- delete) by the time a deferred check runs — nothing to validate then.
  IF NOT EXISTS (SELECT 1 FROM "teams" WHERE "id" = p_team_id) THEN
    RETURN;
  END IF;

  SELECT count(*), COALESCE(sum("shareBasisPoints"), 0)
    INTO v_member_count, v_share_sum
    FROM "team_members"
    WHERE "teamId" = p_team_id;

  IF v_member_count = 0 THEN
    RAISE EXCEPTION 'team % has no members', p_team_id;
  END IF;

  IF v_share_sum <> 10000 THEN
    RAISE EXCEPTION 'team % member shares sum to % bp, must sum to exactly 10000', p_team_id, v_share_sum;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION team_members_validate_team() RETURNS trigger AS $$
BEGIN
  PERFORM check_team_shares(COALESCE(NEW."teamId", OLD."teamId"));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "team_members_validate_team_trigger"
  AFTER INSERT OR UPDATE OR DELETE ON "team_members"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION team_members_validate_team();

CREATE OR REPLACE FUNCTION teams_validate_new() RETURNS trigger AS $$
BEGIN
  PERFORM check_team_shares(NEW."id");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Covers a team inserted with zero member rows ever touched, which would
-- otherwise never fire the trigger above.
CREATE CONSTRAINT TRIGGER "teams_validate_new_trigger"
  AFTER INSERT ON "teams"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION teams_validate_new();

-- DataMigration: participants -> teams-of-one. team.id reuses participant.id
-- directly (same value, not a new uuid) so the prizes/payouts backfill below
-- can join prizes.winnerWalletId/eventId straight back to the right migrated
-- team without a separate mapping table.
INSERT INTO "teams" ("id", "eventId", "name", "submissionUrl", "createdAt", "updatedAt")
SELECT "id", "eventId", 'Solo entrant', "submissionUrl", "registeredAt", "registeredAt"
FROM "participants";

INSERT INTO "team_members" ("id", "teamId", "eventId", "walletId", "shareBasisPoints", "ordinal", "createdAt")
SELECT gen_random_uuid(), "id", "eventId", "walletId", 10000, 0, "registeredAt"
FROM "participants";

-- AlterTable: Prize — winnerWalletId (a wallet) -> winnerTeamId (a team).
-- release_reward pays a team's members directly and individually, so "who
-- won the position" and "who got paid" are no longer the same column; see
-- the doc comment on Prize.winnerTeamId in schema.prisma. @@unique([eventId,
-- rank]) is untouched — a position is still won by exactly one entrant
-- (team, now), that part of the invariant never assumed a wallet.
ALTER TABLE "prizes" ADD COLUMN "winnerTeamId" UUID;

-- Backfill: a prize's old winnerWalletId maps to the migrated team-of-one
-- for that same wallet in that same event (there can only be one, per the
-- team_members_eventId_walletId_key constraint above).
UPDATE "prizes" p
SET "winnerTeamId" = par."id"
FROM "participants" par
WHERE p."winnerWalletId" IS NOT NULL
  AND par."eventId" = p."eventId"
  AND par."walletId" = p."winnerWalletId";

ALTER TABLE "prizes" DROP CONSTRAINT "prizes_winnerWalletId_fkey";
DROP INDEX "prizes_winnerWalletId_idx";
ALTER TABLE "prizes" DROP COLUMN "winnerWalletId";
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "teams"("id");
CREATE INDEX "prizes_winnerTeamId_idx" ON "prizes"("winnerTeamId");

-- AlterTable: Payout — teamMemberId identifies which member of the winning
-- team this row pays. Under teams a single Prize can have several winners
-- (one row per paid member, all sharing one txHash from the one atomic
-- release_reward call), so the old one-row-per-prize assumption behind
-- @@unique([prizeId, txHash]) no longer holds — teamMemberId is what makes
-- each of those N rows unique instead. See the corrected doc comment on
-- Payout in schema.prisma.
ALTER TABLE "payouts" ADD COLUMN "teamMemberId" UUID;

-- Backfill: each existing payout paid the one member of the team-of-one
-- that won the prize it's attached to.
UPDATE "payouts" po
SET "teamMemberId" = tm."id"
FROM "team_members" tm
JOIN "prizes" pr ON pr."id" = po."prizeId"
WHERE tm."teamId" = pr."winnerTeamId";

ALTER TABLE "payouts" ALTER COLUMN "teamMemberId" SET NOT NULL;
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "team_members"("id");
CREATE INDEX "payouts_teamMemberId_idx" ON "payouts"("teamMemberId");

ALTER TABLE "payouts" DROP CONSTRAINT "payouts_prizeId_txHash_key";
CREATE UNIQUE INDEX "payouts_prizeId_txHash_teamMemberId_key" ON "payouts"("prizeId", "txHash", "teamMemberId");

-- DropTable: Participant is gone (decision 3 — a solo entrant is a team of
-- one, there is no separate individual path). Nothing else references
-- participants.id as a foreign key, so this needs no CASCADE. Its RLS
-- policy ("public read of participants for published events") is dropped
-- along with the table.
DROP TABLE "participants";

-- Share freeze: created only now, after the data migration above, and
-- deliberately not a deferred constraint trigger — it's a plain BEFORE
-- trigger guarding future writes, not a cross-row invariant. Both source
-- events for the backfilled teams (COMPLETED and JUDGING) are already past
-- LIVE; creating this trigger before the backfill would have rejected the
-- migration's own INSERTs into team_members. A team's membership and shares
-- may only change while its event is still DRAFT, CREATED, FUNDED, or LIVE
-- — once judging starts there is no rewriting a split that release_reward
-- may be about to pay out against. See the doc comment on Team in
-- schema.prisma for why this is derived from Event.status rather than a
-- separate sharesLockedAt column.
CREATE OR REPLACE FUNCTION team_members_enforce_freeze() RETURNS trigger AS $$
DECLARE
  v_status "EventStatus";
BEGIN
  SELECT e."status" INTO v_status
    FROM "teams" t
    JOIN "events" e ON e."id" = t."eventId"
    WHERE t."id" = COALESCE(NEW."teamId", OLD."teamId");

  IF v_status NOT IN ('DRAFT', 'CREATED', 'FUNDED', 'LIVE') THEN
    RAISE EXCEPTION 'team shares are locked once judging begins (event status %)', v_status;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "team_members_enforce_freeze_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "team_members"
  FOR EACH ROW EXECUTE FUNCTION team_members_enforce_freeze();

-- RLS: new tables need their own policies — an old migration's policy never
-- covers a table that didn't exist yet. Same shape as the existing
-- "public read of X for published events" policies (20260724025905_enable_rls).
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read of teams for published events" ON "teams"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "events" e
    WHERE e."id" = "teams"."eventId"
      AND e."status" NOT IN ('DRAFT', 'CANCELLED')
  ));

CREATE POLICY "public read of team_members for published events" ON "team_members"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "events" e
    WHERE e."id" = "team_members"."eventId"
      AND e."status" NOT IN ('DRAFT', 'CANCELLED')
  ));
