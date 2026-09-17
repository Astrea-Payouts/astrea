-- U18: Link GitHub account to the wallet + public participation profile + repo ownership
-- Hand-written per project conventions (native UUID ids; avoids schema-engine auto-diff issues).

ALTER TABLE "wallets" ADD COLUMN "profilePublic" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "events" ADD COLUMN "requireGithub" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "teams" ADD COLUMN "submissionVerifiedAt" TIMESTAMPTZ;

CREATE TABLE "linked_accounts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "walletId" UUID NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "profileUrl" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "linked_accounts_provider_providerId_key" ON "linked_accounts"("provider", "providerId");
CREATE UNIQUE INDEX "linked_accounts_walletId_provider_key" ON "linked_accounts"("walletId", "provider");
CREATE INDEX "linked_accounts_walletId_idx" ON "linked_accounts"("walletId");
