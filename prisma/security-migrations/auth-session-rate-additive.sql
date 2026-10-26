-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SecurityRateLimit" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityRateLimit_expiresAt_idx" ON "SecurityRateLimit"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_restaurantId_expiresAt_idx" ON "AuthSession"("userId", "restaurantId", "expiresAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
