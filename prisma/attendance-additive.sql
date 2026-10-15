-- Review and apply only after publish approval; production was not touched.
BEGIN;

CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "staffRole" TEXT NOT NULL,
    "outletId" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "checkedOutAt" TIMESTAMP(3),
    "checkoutReason" TEXT,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceSession_restaurantId_checkedInAt_id_idx" ON "AttendanceSession"("restaurantId", "checkedInAt", "id");

CREATE INDEX "AttendanceSession_userId_expiresAt_idx" ON "AttendanceSession"("userId", "expiresAt");

ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
