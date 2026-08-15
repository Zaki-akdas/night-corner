-- MessengerIdentity — the table that was added after the db-push-era baseline.
-- On production the baseline init migration is recorded as applied (the schema
-- already existed), so this migration is what actually creates the table on
-- the first `migrate deploy` after the conversion. Idempotent for fresh
-- databases where the init migration already created it.

-- CreateTable
CREATE TABLE IF NOT EXISTS "MessengerIdentity" (
    "id" TEXT NOT NULL,
    "psid" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT,
    "mobile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessengerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MessengerIdentity_psid_key" ON "MessengerIdentity"("psid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessengerIdentity_userId_idx" ON "MessengerIdentity"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessengerIdentity_mobile_idx" ON "MessengerIdentity"("mobile");
