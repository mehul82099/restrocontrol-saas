import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/server/auth/jwt';
import { prisma } from '@/server/db/prisma';

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(req.url).origin)) {
    return NextResponse.json({success: false, error: 'Cross-origin request denied.'}, {status: 403});
  }
  const payload = verifyToken(req.cookies.get('token')?.value || '');
  try {
    if (payload?.attendanceSessionId) {
      await prisma.attendanceSession.updateMany({where: {
        id: payload.attendanceSessionId, userId: payload.userId, restaurantId: payload.restaurantId,
        checkedOutAt: null, expiresAt: {gt: new Date()},
      }, data: {checkedOutAt: new Date(), checkoutReason: 'LOGOUT'}});
    }
  } catch {
    // Keep the cookie so Logout can be retried rather than silently losing check-out.
    return NextResponse.json({success: false, error: 'Check-out could not be recorded. Please retry Logout.'}, {status: 503});
  }
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.delete('token');
  return response;
}
export const dynamic = 'force-dynamic';
