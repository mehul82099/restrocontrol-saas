import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/audit.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: auth.restaurantId },
    include: {
      outlets: true,
      subscription: { include: { plan: true } },
    },
  });

  return NextResponse.json({ success: true, restaurant });
}

export async function PUT(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:restaurant');
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();
  const before = await prisma.restaurant.findUnique({ where: { id: auth.restaurantId } });

  const updated = await prisma.restaurant.update({
    where: { id: auth.restaurantId },
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      currency: data.currency,
      currencySymbol: data.currencySymbol,
      timezone: data.timezone,
      taxNumber: data.taxNumber,
      address: data.address,
    },
  });

  await AuditService.log({
    restaurantId: auth.restaurantId,
    userId: auth.user.userId,
    action: 'RESTAURANT_UPDATE',
    entity: 'Restaurant',
    entityId: updated.id,
    before,
    after: updated,
  });

  return NextResponse.json({ success: true, restaurant: updated });
}
