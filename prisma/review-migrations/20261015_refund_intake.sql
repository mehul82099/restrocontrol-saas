-- Review only. Apply to an isolated preview DB before enabling intake. No startup execution.
CREATE TABLE "RefundRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "restaurantId" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "restaurantName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "paymentReference" TEXT NOT NULL,
  "refundReason" TEXT NOT NULL,
  "serviceFeedback" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK ("status" IN ('SUBMITTED','UNDER_REVIEW','DECLINED')),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "refundDueAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  CONSTRAINT "RefundRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RefundRequest_restaurantId_paymentReference_key" ON "RefundRequest"("restaurantId", "paymentReference");
CREATE INDEX "RefundRequest_status_submittedAt_idx" ON "RefundRequest"("status", "submittedAt");
