-- Additive migration for the app-handoff flow. PREPARED, NOT APPLIED.
-- Apply only with Mehul's approval alongside the handoff PR.
-- Raw code and verifier are never stored: only their sha256 hashes.

-- CreateTable
CREATE TABLE "AuthHandoffCode" (
    "codeHash" TEXT NOT NULL,
    "verifierChallenge" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "AuthHandoffCode_pkey" PRIMARY KEY ("codeHash")
);

-- CreateIndex
CREATE INDEX "AuthHandoffCode_expiresAt_idx" ON "AuthHandoffCode"("expiresAt");


-- schema.prisma model block (merge into the schema when the PR is merged):
--
-- model AuthHandoffCode {
--   codeHash          String    @id
--   verifierChallenge String
--   userId            String
--   createdAt         DateTime  @default(now())
--   expiresAt         DateTime
--   usedAt            DateTime?
--
--   @@index([expiresAt])
-- }
