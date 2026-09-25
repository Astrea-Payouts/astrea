-- Drops the dead FUNDED value from EventStatus. The shipped event-escrow
-- contract reserves the reward inside create_event itself (ADR-006), so an
-- event goes DRAFT -> CREATED -> LIVE with no separate funding step and
-- nothing in the app or core-go ever writes FUNDED.
--
-- The only code that ever did were the two operator scripts
-- (scripts/seed-demo-event.ts, scripts/e06-vertical-slice.ts), which walked
-- CREATED -> FUNDED -> LIVE through transitionEvent. A run that died between
-- those two calls could have left a row at FUNDED, so such rows are mapped
-- back to CREATED (escrow reserved, not yet live) before the type swap.
--
-- Postgres cannot drop an enum value in place, so this uses the same
-- create-new-type / swap / drop pattern as 20260909150000_fix_escrow_contract_drift.
-- Unlike PrizeStatus there, events.status is referenced by six RLS
-- policies, and ALTER COLUMN ... TYPE refuses to run while a policy depends
-- on the column, so they are dropped and recreated verbatim around the swap.
-- team_members_enforce_freeze() is recreated too: its body compares against
-- a 'FUNDED' literal that would fail to cast to the new type at runtime.
--
-- Everything runs in one transaction: if the target database has any other
-- dependency on the type this file does not know about, the ALTER fails and
-- nothing is changed.

BEGIN;

-- Data: no row may still hold the value being removed.
UPDATE "events" SET "status" = 'CREATED', "updatedAt" = now() WHERE "status" = 'FUNDED';

-- Policies that depend on events.status (20260724025905_enable_rls,
-- 20260910080000_replace_participants_with_teams).
DROP POLICY "public read of published events" ON "events";
DROP POLICY "public read of prizes for published events" ON "prizes";
DROP POLICY "public read of judges for published events" ON "judges";
DROP POLICY "public read of payouts for published events" ON "payouts";
DROP POLICY "public read of teams for published events" ON "teams";
DROP POLICY "public read of team_members for published events" ON "team_members";

-- AlterEnum
CREATE TYPE "EventStatus_new" AS ENUM ('DRAFT', 'CREATED', 'LIVE', 'JUDGING', 'COMPLETED', 'DISPUTED', 'CANCELLED');
ALTER TABLE "events" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "events" ALTER COLUMN "status" TYPE "EventStatus_new" USING ("status"::text::"EventStatus_new");
ALTER TYPE "EventStatus" RENAME TO "EventStatus_old";
ALTER TYPE "EventStatus_new" RENAME TO "EventStatus";
DROP TYPE "EventStatus_old";
ALTER TABLE "events" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Recreate the policies exactly as before.
CREATE POLICY "public read of published events" ON "events"
  FOR SELECT
  USING (status NOT IN ('DRAFT', 'CANCELLED'));

CREATE POLICY "public read of prizes for published events" ON "prizes"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "events" e
    WHERE e."id" = "prizes"."eventId"
      AND e."status" NOT IN ('DRAFT', 'CANCELLED')
  ));

CREATE POLICY "public read of judges for published events" ON "judges"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "events" e
    WHERE e."id" = "judges"."eventId"
      AND e."status" NOT IN ('DRAFT', 'CANCELLED')
  ));

CREATE POLICY "public read of payouts for published events" ON "payouts"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "prizes" p
    JOIN "events" e ON e."id" = p."eventId"
    WHERE p."id" = "payouts"."prizeId"
      AND e."status" NOT IN ('DRAFT', 'CANCELLED')
  ));

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

-- Share freeze: same function as 20260910080000_replace_participants_with_teams,
-- minus FUNDED. Membership and shares may change while the event is DRAFT,
-- CREATED, or LIVE; the trigger itself is unchanged and keeps pointing here.
CREATE OR REPLACE FUNCTION team_members_enforce_freeze() RETURNS trigger AS $$
DECLARE
  v_status "EventStatus";
BEGIN
  SELECT e."status" INTO v_status
    FROM "teams" t
    JOIN "events" e ON e."id" = t."eventId"
    WHERE t."id" = COALESCE(NEW."teamId", OLD."teamId");

  IF v_status NOT IN ('DRAFT', 'CREATED', 'LIVE') THEN
    RAISE EXCEPTION 'team shares are locked once judging begins (event status %)', v_status;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMIT;
