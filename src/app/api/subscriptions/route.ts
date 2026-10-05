import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { SubscriptionService } from '@/server/services/subscription.service';
import { prisma } from '@/server/db/prisma';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const [sub, allPlans] = await Promise.all([
    SubscriptionService.getRestaurantSubscription(auth.restaurantId),
    prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } }),
  ]);

  return NextResponse.json({ success: true, subscription: sub, plans: allPlans });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:subscription');
  if (errorResponse || !auth) return errorResponse;

  const { planCode } = await req.json();
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) {
    return NextResponse.json({ success: false, error: 'Invalid plan code' }, { status: 400 });
  }

  const updatedSub = await prisma.subscription.update({
    where: { restaurantId: auth.restaurantId },
    data: {
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    include: { plan: true },
  });

  return NextResponse.json({ success: true, subscription: updatedSub });
}
