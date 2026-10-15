-- Review and apply only after publish approval; production was not touched.
-- Run outside a transaction: ALTER TYPE ... ADD VALUE cannot run in one on older Postgres.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'WAITER';

BEGIN;
CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "label" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffInvite_tokenHash_key" ON "StaffInvite"("tokenHash");
CREATE UNIQUE INDEX "StaffInvite_usedById_key" ON "StaffInvite"("usedById");
CREATE INDEX "StaffInvite_restaurantId_createdAt_idx" ON "StaffInvite"("restaurantId", "createdAt");
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;
