-- Adds the fields an organizer needs to present an event publicly and
-- express its registration window. The on-chain Event struct (admin, judge,
-- token, reward, state, deadline) has no notion of any of this — it's all
-- off-chain presentation/scheduling metadata.
--
-- `timezone` exists because the contract's `deadline` is a UTC ledger
-- timestamp and `expire_event` is permissionless: once the deadline passes,
-- anyone can call it and the reserved reward refunds to the organizer. An
-- organizer-entered local time with no recorded timezone can silently
-- offset that deadline by hours. See the doc comment on Event.timezone in
-- schema.prisma.
--
-- Live-database impact (verified 2026-09-09 against the `astrea` Supabase
-- project): `events` holds 2 rows today (the E06 vertical-slice demo run
-- and the standing seed-demo-event row), both with startsAt/endsAt NULL.
-- That rules out a bare NOT NULL for `timezone` without a default. Chose
-- NOT NULL DEFAULT 'UTC' over nullable: it keeps the invariant this field
-- exists for — every event row has an explicit, unambiguous timezone —
-- without a backfill, and it back-fills the two existing rows with 'UTC'
-- (an unambiguous, safe default; no destructive change). logoUrl, tagline,
-- location, registrationOpensAt and registrationClosesAt stay nullable —
-- none of them have an invariant that requires a value, and both existing
-- rows get NULL, matching their current absence of this data.

-- AlterTable
ALTER TABLE "events"
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "tagline" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN "registrationOpensAt" TIMESTAMPTZ,
ADD COLUMN "registrationClosesAt" TIMESTAMPTZ;

-- CHECK: registration must open no later than it closes, when both are set.
ALTER TABLE "events"
ADD CONSTRAINT "events_registration_window_check"
CHECK ("registrationOpensAt" IS NULL OR "registrationClosesAt" IS NULL OR "registrationOpensAt" <= "registrationClosesAt");

-- CHECK: registration must close no later than the event starts, when both
-- are set — the contract has no notion of registration, so this is purely
-- an off-chain scheduling invariant, not something release_reward enforces.
ALTER TABLE "events"
ADD CONSTRAINT "events_registration_before_start_check"
CHECK ("registrationClosesAt" IS NULL OR "startsAt" IS NULL OR "registrationClosesAt" <= "startsAt");
