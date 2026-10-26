import { Prisma } from '@prisma/client';

// Call only inside the transaction that changes the password. The user update
// holds the same row lock used by login issuance, so new sessions cannot race it.
export async function invalidateUserSessions(tx: Prisma.TransactionClient, userId: string, restaurantId: string, now = new Date()) {
  await tx.authSession.updateMany({where: {userId, restaurantId, revokedAt: null}, data: {revokedAt: now}});
  await tx.attendanceSession.updateMany({where: {userId, restaurantId, checkedOutAt: null, expiresAt: {gt: now}},
    data: {checkedOutAt: now, checkoutReason: 'PASSWORD_CHANGED'}});
  await tx.staffPushSubscription.deleteMany({where: {userId, restaurantId}});
}
