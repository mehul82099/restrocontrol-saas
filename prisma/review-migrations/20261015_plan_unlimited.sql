-- REVIEW ONLY. Never invoked by next build, npm install or application startup.
-- Back up and test on an isolated preview database before approved production use.
BEGIN;
ALTER TABLE "Plan" ALTER COLUMN "priceYearly" DROP NOT NULL, ALTER COLUMN "priceYearly" DROP DEFAULT;
ALTER TABLE "Plan" ALTER COLUMN "maxOutlets" DROP NOT NULL, ALTER COLUMN "maxOutlets" DROP DEFAULT;
ALTER TABLE "Plan" ALTER COLUMN "maxUsers" DROP NOT NULL, ALTER COLUMN "maxUsers" DROP DEFAULT;
ALTER TABLE "Plan" ALTER COLUMN "maxOrdersPerMonth" DROP NOT NULL, ALTER COLUMN "maxOrdersPerMonth" DROP DEFAULT;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true;
COMMIT;
-- Existing plan values, assignments, statuses and billing periods are unchanged.
-- Seed/reconciliation is a separate reviewed operation. Do not use demo seed on live data.
