import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.userId },
    include: {
      restaurant: true,
      userOutlets: { include: { outlet: true } },
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const outlets = await prisma.outlet.findMany({
    where: { restaurantId: auth.restaurantId, isActive: true },
    orderBy: { isDefault: 'desc' },
  });

  const activeOutlet = outlets.find((o) => o.id === auth.outletId) || outlets[0];

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      restaurantId: user.restaurantId,
      restaurantName: user.restaurant.name,
      currency: user.restaurant.currency,
      currencySymbol: user.restaurant.currencySymbol,
      activeOutletId: activeOutlet?.id,
      activeOutletName: activeOutlet?.name,
      outlets: outlets.map((o) => ({ id: o.id, name: o.name, code: o.code, isDefault: o.isDefault })),
    },
  });
}
