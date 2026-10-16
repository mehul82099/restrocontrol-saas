import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { attendanceView } from '@/server/services/attendance.service';
import { protectRead } from '@/server/services/api-validation';

export const GET = protectRead(async (req: NextRequest) => {
  const {auth, errorResponse} = await authenticateRequest(req);
  if (!auth) return errorResponse;
  if (!['OWNER', 'MANAGER'].includes(auth.user.role)) return NextResponse.json({success: false, error: 'Permission denied.'}, {status: 403});
  const params = new URL(req.url).searchParams;
  const from = new Date(params.get('from') || new Date(Date.now() - 7 * 86400000).toISOString());
  const to = new Date(params.get('to') || new Date().toISOString());
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 31 * 86400000) {
    return NextResponse.json({success: false, error: 'Select a valid range of up to 31 days.'}, {status: 400});
  }
  const cursor = params.get('cursor');
  // A cursor is scoped to this restaurant, never trusted as a global record ID.
  const previous = cursor ? await prisma.attendanceSession.findFirst({where: {id: cursor, restaurantId: auth.restaurantId}}) : null;
  if (cursor && !previous) return NextResponse.json({success: false, error: 'Invalid cursor.'}, {status: 400});
  const sessions = await prisma.attendanceSession.findMany({where: {
    restaurantId: auth.restaurantId,
    checkedInAt: {gte: from, lt: to},
    ...(previous ? {OR: [{checkedInAt: {lt: previous.checkedInAt}}, {checkedInAt: previous.checkedInAt, id: {lt: previous.id}}]} : {}),
  }, orderBy: [{checkedInAt: 'desc'}, {id: 'desc'}], take: 101,
    select: {id: true, userId: true, staffName: true, staffRole: true, checkedInAt: true, expiresAt: true, checkedOutAt: true, checkoutReason: true},
  });
  const restaurant = await prisma.restaurant.findUnique({where: {id: auth.restaurantId}, select: {timezone: true}});
  const page = sessions.slice(0, 100);
  return NextResponse.json({success: true, timezone: restaurant?.timezone || 'Asia/Kolkata', sessions: page.map(s => attendanceView(s)), nextCursor: sessions.length > 100 ? page[99].id : null});
});
export const dynamic = 'force-dynamic';
