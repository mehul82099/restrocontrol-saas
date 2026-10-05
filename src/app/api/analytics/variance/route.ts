import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { AnalyticsService } from '@/server/services/analytics.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:variance');
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const filter = url.searchParams.get('filter') || 'today';
  const customStart = url.searchParams.get('startDate') || undefined;
  const customEnd = url.searchParams.get('endDate') || undefined;

  const dateRange = AnalyticsService.parseDateFilter(filter, customStart, customEnd);
  const variance = await AnalyticsService.getExpectedVsActualConsumption(
    auth.restaurantId,
    auth.outletId,
    dateRange
  );

  return NextResponse.json({ success: true, ...variance });
}
