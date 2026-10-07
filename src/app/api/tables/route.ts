import { protectRead } from '@/server/services/api-validation';
import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

async function handleGET(req: NextRequest) {
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

async function handlePOST(req: NextRequest) {
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

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
