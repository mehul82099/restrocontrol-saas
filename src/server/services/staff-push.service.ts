import webpush from 'web-push';
import { prisma } from '../db/prisma';
import { orderAudience } from './push-policy';
import { getTrialInfo } from './trial.service';

export function pushConfigured() {
  return !!(process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY && process.env.WEB_PUSH_SUBJECT);
}
// Best effort, after commit only. A push failure must never turn a successful order into a failed checkout.
export async function notifyOrderStaff(restaurantId: string, outletId: string, event: 'activity' | 'ready' = 'activity') {
  if (!pushConfigured()) return;
  try {
    const subscription = await prisma.subscription.findUnique({where: {restaurantId}});
    if (getTrialInfo(subscription).expired) return;
    const rows = await prisma.staffPushSubscription.findMany({where: {restaurantId, outletId, expiresAt: {gt: new Date()}}});
    for (let offset = 0; offset < rows.length; offset += 10) {
      await Promise.allSettled(rows.slice(offset, offset + 10).map(async row => {
        const user = await prisma.user.findFirst({where: {id: row.userId, restaurantId, isActive: true}, include: {userOutlets: true}});
        const outlet = await prisma.outlet.findFirst({where: {id: outletId, restaurantId, isActive: true}});
        if (!user || !outlet || !orderAudience(user.role) || (user.role !== 'OWNER' && !user.userOutlets.some(o => o.outletId === outletId))) {
          await prisma.staffPushSubscription.deleteMany({where: {id: row.id}}); return;
        }
        if (user.role === 'WAITER' && event !== 'ready') return;
        try {
          // No order/customer content in queued payloads. Worker re-checks the current cookie before display.
          await webpush.sendNotification({endpoint: row.endpoint, keys: {p256dh: row.p256dh, auth: row.auth}}, JSON.stringify({subscriptionId: row.id}), {
            TTL: 30, timeout: 3000, vapidDetails: {subject: process.env.WEB_PUSH_SUBJECT!, publicKey: process.env.WEB_PUSH_PUBLIC_KEY!, privateKey: process.env.WEB_PUSH_PRIVATE_KEY!},
          });
        } catch (error: any) {
          if (error.statusCode === 404 || error.statusCode === 410) await prisma.staffPushSubscription.deleteMany({where: {id: row.id}});
          else console.error('Staff push delivery failed'); // Do not log capability URLs or keys.
        }
      }));
    }
  } catch { console.error('Staff push unavailable; committed order is unchanged'); }
}
