import { prisma } from '@/server/db/prisma';
import { randomUUID } from 'crypto';
import { AuthUserPayload, signToken, verifyToken } from '@/server/auth/jwt';

export function attendanceView<T extends { checkedOutAt: Date | null; expiresAt: Date; checkoutReason: string | null }>(session: T, now = new Date()) {
  const expired = !session.checkedOutAt && session.expiresAt <= now;
  return { ...session, checkedOutAt: expired ? session.expiresAt : session.checkedOutAt,
    checkoutReason: expired ? 'SESSION_EXPIRED' : session.checkoutReason,
    systemEstimated: expired || session.checkoutReason === 'SESSION_EXPIRED' };
}

// Fail closed: never return a staff login token if its check-in cannot be saved.
export async function issueAttendanceToken(payload: AuthUserPayload) {
  if (payload.role === 'OWNER') return signToken(payload);
  const id = randomUUID();
  const token = signToken({ ...payload, attendanceSessionId: id });
  const claims = verifyToken(token) as AuthUserPayload & {iat: number; exp: number};
  if (!claims) throw new Error('Could not issue login token');
  await prisma.attendanceSession.create({ data: {
    id, restaurantId: payload.restaurantId, userId: payload.userId,
    staffName: payload.name, staffRole: payload.role, outletId: payload.outletId,
    checkedInAt: new Date(claims.iat * 1000), expiresAt: new Date(claims.exp * 1000),
  } });
  return token;
}
