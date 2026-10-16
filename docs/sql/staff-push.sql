-- Additive preview schema. Apply to the isolated preview DB only before testing.
CREATE TABLE "StaffPushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffPushSubscription_endpoint_key" ON "StaffPushSubscription"("endpoint");
CREATE INDEX "StaffPushSubscription_restaurantId_outletId_expiresAt_idx" ON "StaffPushSubscription"("restaurantId", "outletId", "expiresAt");
CREATE INDEX "StaffPushSubscription_sessionHash_idx" ON "StaffPushSubscription"("sessionHash");
