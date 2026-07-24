-- RLS: secure by default. No INSERT/UPDATE/DELETE policies anywhere —
-- all writes go through the Next.js backend via the service_role key,
-- which bypasses RLS by design (docs/architecture.md, Principle 1: the
-- backend owns every state transition, idempotency, and validation).

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prizes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "judges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "op_log" ENABLE ROW LEVEL SECURITY;

-- Published = not DRAFT and not CANCELLED. Matches the product promise
-- that a published event's prizes/judges/payouts are publicly auditable.
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

CREATE POLICY "public read of submissions for published events" ON "submissions"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "events" e
    WHERE e."id" = "submissions"."eventId"
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

-- users, wallets, and op_log: RLS enabled with NO anon/authenticated
-- policies — fully locked to service_role. Wallet-address linkage between
-- users is sensitive and deliberately not exposed via direct API; op_log
-- is internal bookkeeping only. The Next.js backend (service_role) already
-- has everything needed to render public wallet addresses (e.g. a prize
-- winner) server-side — see docs/architecture.md.
