import { protectRead } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { AnalyticsService } from '@/server/services/analytics.service';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:food_cost');
  if (errorResponse || !auth) return errorResponse;

  const items = await AnalyticsService.getFoodCostAnalysis(auth.restaurantId);
  return NextResponse.json({ success: true, items });
}

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
