import { protectRead } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { getTrialInfo } from '@/server/services/trial.service';

async function handleGET(req: NextRequest) {
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
    where: { restaurantId: auth.restaurantId, isActive: true, ...(auth.user.role === 'OWNER' ? {} : {userOutlets: {some: {userId: auth.user.userId}}}) },
    orderBy: { isDefault: 'desc' },
  });

  const subscription = await prisma.subscription.findUnique({ where: { restaurantId: auth.restaurantId }, select: { status: true, currentPeriodEnd: true } });
  const activeOutlet = outlets.find((o) => o.id === auth.outletId) || outlets[0];

  return NextResponse.json({
    success: true,
    trial: getTrialInfo(subscription),
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

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
