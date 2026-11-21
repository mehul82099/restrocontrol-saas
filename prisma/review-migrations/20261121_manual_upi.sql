-- Additive only. Apply to production ONLY after a fresh backup and Mehul's explicit OK.
-- CreateEnum
CREATE TYPE "ManualUpiPaymentStatus" AS ENUM ('PENDING_UTR', 'UTR_SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ManualUpiPayment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "ManualUpiPaymentStatus" NOT NULL DEFAULT 'PENDING_UTR',
    "utr" TEXT,
    "vpaSnapshot" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utrSubmittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "entitlementAppliedAt" TIMESTAMP(3),

    CONSTRAINT "ManualUpiPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManualUpiPayment_utr_key" ON "ManualUpiPayment"("utr");

-- CreateIndex
CREATE INDEX "ManualUpiPayment_restaurantId_idx" ON "ManualUpiPayment"("restaurantId");

-- CreateIndex
CREATE INDEX "ManualUpiPayment_status_createdAt_idx" ON "ManualUpiPayment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManualUpiPayment_restaurantId_planCode_periodStart_key" ON "ManualUpiPayment"("restaurantId", "planCode", "periodStart");

