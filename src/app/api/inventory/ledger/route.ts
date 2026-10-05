import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:inventory');
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const ingredientId = url.searchParams.get('ingredientId');
  const movementType = url.searchParams.get('movementType');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const where: any = {
    restaurantId: auth.restaurantId,
    outletId: auth.outletId,
    ...(ingredientId ? { ingredientId } : {}),
    ...(movementType ? { movementType: movementType as any } : {}),
  };

  const [total, movements] = await Promise.all([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      include: {
        ingredient: { select: { id: true, name: true, unit: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
  ]);

  return NextResponse.json({ success: true, total, movements });
}
