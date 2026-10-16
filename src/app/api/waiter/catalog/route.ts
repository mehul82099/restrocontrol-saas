import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { protectRead } from '@/server/services/api-validation';
export const dynamic = 'force-dynamic';
export const GET = protectRead(async (req: NextRequest) => {
  const {auth, errorResponse} = await authenticateRequest(req, 'access:waiter');
  if (!auth || errorResponse) return errorResponse;
  const [items, tables] = await Promise.all([
    prisma.menuItem.findMany({where: {restaurantId: auth.restaurantId, isAvailable: true}, select: {id: true, name: true, basePrice: true, taxRate: true}, orderBy: {name: 'asc'}}),
    prisma.diningTable.findMany({where: {restaurantId: auth.restaurantId, outletId: auth.outletId}, select: {id: true, tableNumber: true, status: true}, orderBy: {tableNumber: 'asc'}}),
  ]);
  return NextResponse.json({success: true, items, tables});
});
