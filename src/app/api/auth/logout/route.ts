import { NextRequest, NextResponse } from 'next/server';
import { sessionHash } from '@/server/services/push-policy';
import { verifyToken } from '@/server/auth/jwt';
import { prisma } from '@/server/db/prisma';

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(req.url).origin)) {
    return NextResponse.json({success: false, error: 'Cross-origin request denied.'}, {status: 403});
  }
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : req.cookies.get('token')?.value;
  const payload = verifyToken(token || '');
  try {
    if (payload?.authSessionId) await prisma.$transaction(async tx => {
      const now = new Date();
      await tx.authSession.updateMany({where: {id: payload.authSessionId, userId: payload.userId,
        restaurantId: payload.restaurantId, revokedAt: null}, data: {revokedAt: now}});
      if (payload.attendanceSessionId) await tx.attendanceSession.updateMany({where: {
        id: payload.attendanceSessionId, userId: payload.userId, restaurantId: payload.restaurantId,
        checkedOutAt: null, expiresAt: {gt: now},
      }, data: {checkedOutAt: now, checkoutReason: 'LOGOUT'}});
    });
  } catch {
    // Keep the cookie so Logout can be retried rather than silently losing check-out.
    return NextResponse.json({success: false, error: 'Check-out could not be recorded. Please retry Logout.'}, {status: 503});
  }
  if (token) await prisma.staffPushSubscription.deleteMany({where:{sessionHash:sessionHash(token)}}).catch(() => console.error('Push cleanup unavailable on logout'));
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.delete('token');
  return response;
}
export const dynamic = 'force-dynamic';
