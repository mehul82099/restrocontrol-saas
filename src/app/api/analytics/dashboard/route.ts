import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { AnalyticsService } from '@/server/services/analytics.service';
import { cache } from '@/server/cache/redis';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:analytics');
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const filter = url.searchParams.get('filter') || 'today';
  const customStart = url.searchParams.get('startDate') || undefined;
  const customEnd = url.searchParams.get('endDate') || undefined;

  const cacheKey = `dashboard:${auth.restaurantId}:${auth.outletId}:${filter}:${customStart || ''}:${customEnd || ''}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, ...cached, fromCache: true });
  }

  const metrics = await AnalyticsService.getDashboardMetrics(
    auth.restaurantId,
    auth.outletId,
    filter,
    customStart,
    customEnd
  );

  await cache.set(cacheKey, metrics, 60); // cache for 1 minute

  return NextResponse.json({ success: true, ...metrics });
}
