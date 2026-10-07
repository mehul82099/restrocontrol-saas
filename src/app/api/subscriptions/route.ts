import { protectRead } from '@/server/services/api-validation';
import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { SubscriptionService } from '@/server/services/subscription.service';
import { prisma } from '@/server/db/prisma';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req);
  if (errorResponse || !auth) return errorResponse;

  const [sub, allPlans] = await Promise.all([
    SubscriptionService.getRestaurantSubscription(auth.restaurantId),
    prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } }),
  ]);

  return NextResponse.json({ success: true, subscription: sub, plans: allPlans });
}

async function handlePOST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:subscription');
  if (errorResponse || !auth) return errorResponse;

  const { planCode } = await req.json();
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) {
    return NextResponse.json({ success: false, error: 'Invalid plan code' }, { status: 400 });
  }

  return NextResponse.json({success: false, error: 'Plan changes require verified billing and are not available in this demo.'}, {status: 403});
}

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
