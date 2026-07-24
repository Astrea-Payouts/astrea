-- Astrea initial schema — mirrors prisma/schema.prisma exactly.

CREATE TYPE "StellarNetwork" AS ENUM ('TESTNET', 'MAINNET');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'CREATED', 'FUNDED', 'LIVE', 'JUDGING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PrizeStatus" AS ENUM ('PENDING', 'ASSIGNED', 'APPROVED', 'RELEASED', 'DISPUTED');
CREATE TYPE "JudgeStatus" AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE "OpStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "wallets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "address" TEXT NOT NULL UNIQUE,
  "usdcTrustlineVerifiedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

CREATE TABLE "events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizerId" UUID NOT NULL REFERENCES "users"("id"),
  "organizerWalletId" UUID NOT NULL REFERENCES "wallets"("id"),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "startsAt" TIMESTAMPTZ,
  "endsAt" TIMESTAMPTZ,
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "network" "StellarNetwork" NOT NULL DEFAULT 'TESTNET',
  "escrowContractId" TEXT UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "events_organizerId_idx" ON "events"("organizerId");
CREATE INDEX "events_status_idx" ON "events"("status");

CREATE TABLE "prizes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "rank" INTEGER NOT NULL,
  "amountUsdc" DECIMAL(18,7) NOT NULL,
  "milestoneIndex" INTEGER NOT NULL,
  "status" "PrizeStatus" NOT NULL DEFAULT 'PENDING',
  "winnerWalletId" UUID REFERENCES "wallets"("id"),
  "releaseTxHash" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("eventId", "milestoneIndex")
);
CREATE INDEX "prizes_eventId_idx" ON "prizes"("eventId");
CREATE INDEX "prizes_status_idx" ON "prizes"("status");

CREATE TABLE "judges" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "walletAddress" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "JudgeStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("eventId", "walletAddress")
);
CREATE INDEX "judges_eventId_idx" ON "judges"("eventId");

CREATE TABLE "submissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "participantWalletId" UUID NOT NULL REFERENCES "wallets"("id"),
  "url" TEXT NOT NULL,
  "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "submissions_eventId_idx" ON "submissions"("eventId");
CREATE INDEX "submissions_participantWalletId_idx" ON "submissions"("participantWalletId");

CREATE TABLE "payouts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "prizeId" UUID NOT NULL REFERENCES "prizes"("id") ON DELETE CASCADE,
  "txHash" TEXT NOT NULL UNIQUE,
  "amountUsdc" DECIMAL(18,7) NOT NULL,
  "confirmedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "payouts_prizeId_idx" ON "payouts"("prizeId");

CREATE TABLE "op_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "operation" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OpStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "op_log_status_idx" ON "op_log"("status");
