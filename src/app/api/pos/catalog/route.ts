import { protectRead } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'access:pos');
  if (errorResponse || !auth) return errorResponse;

  const [categories, menuItems, tables, customers] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId: auth.restaurantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId: auth.restaurantId, isAvailable: true },
      include: {
        category: true,
        variants: { where: { isActive: true } },
        addons: { where: { isActive: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.diningTable.findMany({
      where: { restaurantId: auth.restaurantId, outletId: auth.outletId },
      orderBy: { tableNumber: 'asc' },
    }),
    prisma.customer.findMany({
      where: { restaurantId: auth.restaurantId },
      orderBy: { name: 'asc' },
      take: 100,
    }),
  ]);

  return NextResponse.json({
    success: true,
    catalog: {
      categories,
      items: menuItems,
      tables,
      customers,
    },
  });
}

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
