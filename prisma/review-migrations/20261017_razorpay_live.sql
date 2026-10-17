-- Additive only. Apply to production ONLY after a fresh backup and Mehul's explicit OK.
CREATE TABLE "LiveBillingSubscription" (
 "id" TEXT PRIMARY KEY, "restaurantId" TEXT NOT NULL UNIQUE,
 "providerId" TEXT UNIQUE, "planCode" TEXT NOT NULL, "pendingPlanCode" TEXT,
 "providerStatus" TEXT NOT NULL DEFAULT 'CREATING', "checkoutVerifiedAt" TIMESTAMP(3),
 "currentStart" INTEGER, "currentEnd" INTEGER,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "LiveBillingEvent" (
 "eventId" TEXT PRIMARY KEY, "providerId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
