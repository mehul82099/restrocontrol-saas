import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { sessionHash, orderAudience } from '@/server/services/push-policy';
import { protectRead } from '@/server/services/api-validation';
export const dynamic = 'force-dynamic';
export const GET = protectRead(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get('id') || '';
  const token = req.cookies.get('token')?.value || '';
  const row = await prisma.staffPushSubscription.findFirst({where: {id, sessionHash: sessionHash(token), expiresAt: {gt: new Date()}}});
  if (!row) return new NextResponse(null, {status: 401});
  const headers = new Headers(req.headers); headers.set('x-outlet-id', row.outletId);
  const {auth, errorResponse} = await authenticateRequest(new NextRequest(req.url, {headers}));
  if (!auth || errorResponse) return errorResponse;
  if (auth.restaurantId !== row.restaurantId || auth.user.userId !== row.userId || !orderAudience(auth.user.role)) return new NextResponse(null, {status: 403});
  return NextResponse.json({success: true, message: auth.user.role === 'WAITER' ? 'Ready-to-serve tickets updated. Open your staff screen.' : 'Order activity updated. Open your staff screen.', url: `${auth.user.role === 'WAITER' ? '/waiter' : auth.user.role === 'KITCHEN_STAFF' ? '/kot' : '/orders'}?outletId=${encodeURIComponent(row.outletId)}`});
});
