import { protectRead } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:orders');
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const orderType = url.searchParams.get('orderType');
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') || '50') || 50));
  const offset = Math.max(0, Math.min(100000, parseInt(url.searchParams.get('offset') || '0') || 0));

  const where: any = {
    restaurantId: auth.restaurantId,
    outletId: auth.outletId,
    ...(status ? { status: status as any } : {}),
    ...(orderType ? { orderType: orderType as any } : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        table: true,
        customer: true,
        cashier: { select: { id: true, name: true } },
        items: true,
        payments: true,
        kitchenOrder: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
  ]);

  return NextResponse.json({ success: true, total, orders });
}

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
