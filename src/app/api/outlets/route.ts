import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { SubscriptionService } from '@/server/services/subscription.service';
import { AuditService } from '@/server/services/audit.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const outlets = await prisma.outlet.findMany({
    where: { restaurantId: auth.restaurantId },
    include: {
      _count: {
        select: { tables: true, orders: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ success: true, outlets });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:outlets');
  if (errorResponse || !auth) return errorResponse;

  const check = await SubscriptionService.canPerformAction(auth.restaurantId, 'ADD_OUTLET');
  if (!check.allowed) {
    return NextResponse.json({ success: false, error: check.reason }, { status: 403 });
  }

  const data = await req.json();
  const outlet = await prisma.outlet.create({
    data: {
      restaurantId: auth.restaurantId,
      name: data.name,
      code: data.code.toUpperCase().trim(),
      address: data.address,
      phone: data.phone,
      isDefault: !!data.isDefault,
    },
  });

  // Automatically initialize outlet inventory records for existing ingredients
  const ingredients = await prisma.ingredient.findMany({
    where: { restaurantId: auth.restaurantId },
  });

  for (const ing of ingredients) {
    await prisma.outletInventory.create({
      data: {
        restaurantId: auth.restaurantId,
        outletId: outlet.id,
        ingredientId: ing.id,
        currentStock: 0,
        minimumStock: ing.minimumStock,
        reorderLevel: ing.reorderLevel,
      },
    });
  }

  await AuditService.log({
    restaurantId: auth.restaurantId,
    userId: auth.user.userId,
    action: 'OUTLET_CREATE',
    entity: 'Outlet',
    entityId: outlet.id,
    after: outlet,
  });

  return NextResponse.json({ success: true, outlet });
}
