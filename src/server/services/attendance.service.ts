import { prisma } from '@/server/db/prisma';
import { randomUUID } from 'crypto';
import { AuthUserPayload, signToken, verifyToken } from '@/server/auth/jwt';

export function attendanceView<T extends { checkedOutAt: Date | null; expiresAt: Date; checkoutReason: string | null }>(session: T, now = new Date()) {
  const expired = !session.checkedOutAt && session.expiresAt <= now;
  return { ...session, checkedOutAt: expired ? session.expiresAt : session.checkedOutAt,
    checkoutReason: expired ? 'SESSION_EXPIRED' : session.checkoutReason,
    systemEstimated: expired || session.checkoutReason === 'SESSION_EXPIRED' };
}

// Both the revocable login and staff check-in commit together. Locking the user
// serializes password invalidation with issuance, including an in-flight password login.
export async function issueAttendanceToken(payload: AuthUserPayload, expectedPasswordHash?: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${payload.userId} AND "restaurantId" = ${payload.restaurantId} FOR UPDATE`;
    const user = await tx.user.findFirst({where: {id: payload.userId, restaurantId: payload.restaurantId, isActive: true}});
    if (!user || (expectedPasswordHash !== undefined && user.passwordHash !== expectedPasswordHash)) {
      throw new Error('Login authority changed; sign in again');
    }
    const authSessionId = randomUUID();
    const attendanceSessionId = user.role === 'OWNER' ? undefined : randomUUID();
    const token = signToken({ ...payload, role: user.role, name: user.name, email: user.email,
      authSessionId, attendanceSessionId });
    const claims = verifyToken(token) as AuthUserPayload & {iat: number; exp: number};
    if (!claims) throw new Error('Could not issue login token');
    const createdAt = new Date(claims.iat * 1000), expiresAt = new Date(claims.exp * 1000);
    await tx.authSession.create({data: {id: authSessionId, userId: user.id, restaurantId: user.restaurantId,
      authVersion: user.authVersion, createdAt, expiresAt}});
    if (attendanceSessionId) await tx.attendanceSession.create({ data: {
      id: attendanceSessionId, restaurantId: user.restaurantId, userId: user.id,
      staffName: user.name, staffRole: user.role, outletId: payload.outletId,
      checkedInAt: createdAt, expiresAt,
    }});
    return token;
  });
}
