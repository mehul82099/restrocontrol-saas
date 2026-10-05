import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { AnalyticsService } from '@/server/services/analytics.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:food_cost');
  if (errorResponse || !auth) return errorResponse;

  const items = await AnalyticsService.getFoodCostAnalysis(auth.restaurantId);
  return NextResponse.json({ success: true, items });
}
