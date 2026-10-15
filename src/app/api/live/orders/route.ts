import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { orderAudience } from '@/server/services/push-policy';
import { protectRead } from '@/server/services/api-validation';
export const dynamic = 'force-dynamic';
export const GET = protectRead(async (req: NextRequest) => {
  const {auth, errorResponse} = await authenticateRequest(req);
  if (!auth || errorResponse) return errorResponse;
  if (!orderAudience(auth.user.role)) return NextResponse.json({success: false}, {status: 403});
  const where = {restaurantId: auth.restaurantId, outletId: auth.outletId};
  if (auth.user.role === 'WAITER') {
    const ready = await prisma.kitchenOrder.aggregate({where: {...where, status: 'READY', order: {status: {notIn: ['CANCELLED', 'REFUNDED']}}}, _count: true, _max: {updatedAt: true}});
    return NextResponse.json({success: true, revision: createHash('sha256').update(JSON.stringify(ready)).digest('hex')}, {headers: {'Cache-Control': 'private, no-store'}});
  }
  const [orders, kitchen] = await Promise.all([
    prisma.order.groupBy({by: ['status', 'paymentStatus'], where, _count: true, _max: {updatedAt: true}}),
    prisma.kitchenOrder.groupBy({by: ['status'], where, _count: true, _max: {updatedAt: true}}),
  ]);
  const revision = createHash('sha256').update(JSON.stringify({orders: orders.sort((a,b) => `${a.status}${a.paymentStatus}`.localeCompare(`${b.status}${b.paymentStatus}`)), kitchen: kitchen.sort((a,b) => a.status.localeCompare(b.status))})).digest('hex');
  return NextResponse.json({success: true, revision}, {headers: {'Cache-Control': 'private, no-store'}});
});
