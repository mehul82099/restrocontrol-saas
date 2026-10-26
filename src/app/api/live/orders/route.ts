import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/server/auth/jwt';
import { prisma } from '@/server/db/prisma';
import { protectRead } from '@/server/services/api-validation';
export const dynamic = 'force-dynamic';
// One parameterized database operation, including fresh authority. No process-local
// permission cache, pooled connection affinity or paid cache service is required.
export const GET = protectRead(async (req: NextRequest) => {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload?.userId || !payload.restaurantId || !payload.authSessionId) return NextResponse.json({success: false}, {status: 401});
  const requested = req.headers.get('x-outlet-id') || new URL(req.url).searchParams.get('outletId') || null;
  const rows = await prisma.$queryRaw<Array<{status: number; revision: unknown}>>`
    WITH authority AS (
      SELECT u.id, u."restaurantId", u.role, s.status AS subscription_status,
        s."currentPeriodEnd", o.id AS outlet_id
      FROM "User" u
      LEFT JOIN "Subscription" s ON s."restaurantId" = u."restaurantId"
      LEFT JOIN LATERAL (
        SELECT candidate.id FROM "Outlet" candidate
        WHERE candidate."restaurantId" = u."restaurantId" AND candidate."isActive" = true
          AND (${requested}::text IS NULL OR candidate.id = ${requested})
          AND (u.role = 'OWNER' OR EXISTS (
            SELECT 1 FROM "UserOutlet" membership WHERE membership."userId" = u.id AND membership."outletId" = candidate.id
          ))
        ORDER BY (candidate.id = ${payload.outletId || ''}) DESC, candidate."isDefault" DESC, candidate.id
        LIMIT 1
      ) o ON true
      WHERE u.id = ${payload.userId} AND u."restaurantId" = ${payload.restaurantId} AND u."isActive" = true
        AND EXISTS (SELECT 1 FROM "AuthSession" login WHERE login.id = ${payload.authSessionId}
          AND login."userId" = u.id AND login."restaurantId" = u."restaurantId"
          AND login."authVersion" = u."authVersion" AND login."revokedAt" IS NULL AND login."expiresAt" > NOW())
        AND ((u.role = 'OWNER' AND ${payload.attendanceSessionId || null}::text IS NULL) OR EXISTS (
          SELECT 1 FROM "AttendanceSession" attendance WHERE attendance.id = ${payload.attendanceSessionId || ''}
            AND attendance."userId" = u.id AND attendance."restaurantId" = u."restaurantId"
            AND attendance."checkedOutAt" IS NULL AND attendance."expiresAt" > NOW()))
    ), permitted AS (
      SELECT * FROM authority WHERE outlet_id IS NOT NULL
        AND role::text IN ('OWNER','MANAGER','CASHIER','KITCHEN_STAFF','WAITER')
        AND NOT (COALESCE(subscription_status::text = 'TRIALING' AND "currentPeriodEnd" <= NOW(), false))
    )
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM authority) THEN 401
      WHEN EXISTS (SELECT 1 FROM authority WHERE subscription_status::text = 'TRIALING' AND "currentPeriodEnd" <= NOW()) THEN 402
      WHEN NOT EXISTS (SELECT 1 FROM permitted) THEN 403 ELSE 200 END AS status,
      (SELECT CASE WHEN a.role::text = 'WAITER' THEN
        (SELECT jsonb_build_object('count', count(*), 'updated', max(k."updatedAt"))
          FROM "KitchenOrder" k JOIN "Order" ord ON ord.id = k."orderId"
          WHERE k."restaurantId" = a."restaurantId" AND k."outletId" = a.outlet_id
            AND k.status = 'READY' AND ord.status NOT IN ('CANCELLED','REFUNDED'))
      ELSE jsonb_build_object(
        'orders', (SELECT jsonb_agg(to_jsonb(g) ORDER BY g.status, g."paymentStatus") FROM (
          SELECT ord.status, ord."paymentStatus", count(*) AS count, max(ord."updatedAt") AS updated
          FROM "Order" ord WHERE ord."restaurantId" = a."restaurantId" AND ord."outletId" = a.outlet_id
          GROUP BY ord.status, ord."paymentStatus") g),
        'kitchen', (SELECT jsonb_agg(to_jsonb(g) ORDER BY g.status) FROM (
          SELECT k.status, count(*) AS count, max(k."updatedAt") AS updated
          FROM "KitchenOrder" k WHERE k."restaurantId" = a."restaurantId" AND k."outletId" = a.outlet_id
          GROUP BY k.status) g)) END FROM permitted a) AS revision
  `;
  const result = rows[0];
  if (!result || result.status !== 200) return NextResponse.json({success: false}, {status: result?.status || 401});
  return NextResponse.json({success: true, revision: createHash('sha256').update(JSON.stringify(result.revision)).digest('hex')}, {headers: {'Cache-Control': 'private, no-store'}});
});
