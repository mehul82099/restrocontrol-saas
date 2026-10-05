import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const orderType = url.searchParams.get('orderType');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

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
