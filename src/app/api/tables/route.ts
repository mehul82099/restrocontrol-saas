import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const tables = await prisma.diningTable.findMany({
    where: { restaurantId: auth.restaurantId, outletId: auth.outletId },
    include: {
      orders: {
        where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY'] } },
        include: { items: true },
      },
    },
    orderBy: { tableNumber: 'asc' },
  });

  return NextResponse.json({ success: true, tables });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:restaurant');
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();
  const table = await prisma.diningTable.create({
    data: {
      restaurantId: auth.restaurantId,
      outletId: auth.outletId,
      tableNumber: data.tableNumber,
      capacity: parseInt(data.capacity || 4),
      section: data.section || 'Main Dining',
    },
  });

  return NextResponse.json({ success: true, table });
}
