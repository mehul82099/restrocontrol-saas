import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/server/auth/jwt';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { orderAudience, sessionHash, validPushEndpoint } from '@/server/services/push-policy';
import { pushConfigured } from '@/server/services/staff-push.service';
import { protectMutation } from '@/server/services/api-validation';
export const dynamic = 'force-dynamic';
export const POST = protectMutation(async (req: NextRequest) => {
  const {auth, errorResponse} = await authenticateRequest(req);
  if (!auth || errorResponse) return errorResponse;
  if (!orderAudience(auth.user.role)) return NextResponse.json({success: false}, {status: 403});
  if (!pushConfigured()) return NextResponse.json({success: false, error: 'Background notifications are not configured yet.'}, {status: 503});
  // Browser push requires a live cookie session, not a stored bearer token.
  const token = req.cookies.get('token')?.value || '';
  const payload = verifyToken(token) as any;
  if (!payload || payload.userId !== auth.user.userId || !payload.exp) return NextResponse.json({success: false}, {status: 401});
  const data = await req.json();
  if (!validPushEndpoint(data.endpoint) || typeof data.keys?.p256dh !== 'string' || !/^[A-Za-z0-9_\-=+/]{80,100}$/.test(data.keys.p256dh) || typeof data.keys?.auth !== 'string' || !/^[A-Za-z0-9_\-=+/]{20,30}$/.test(data.keys.auth)) return NextResponse.json({success: false, error: 'Invalid browser subscription.'}, {status: 400});
  const hash = sessionHash(token);
  // Limit subscriptions per session; switching an outlet updates the same browser capability.
  const count = await prisma.staffPushSubscription.count({where: {sessionHash: hash}});
  const existing = await prisma.staffPushSubscription.findUnique({where: {endpoint: data.endpoint}});
  if (existing && existing.userId !== auth.user.userId) return NextResponse.json({success: false, error: 'Reset notifications on this browser before using another account.'}, {status: 409});
  if (!existing && count >= 10) return NextResponse.json({success: false, error: 'Too many browser subscriptions.'}, {status: 429});
  const record = {userId: auth.user.userId, restaurantId: auth.restaurantId, outletId: auth.outletId, sessionHash: hash, expiresAt: new Date(payload.exp * 1000), p256dh: data.keys.p256dh, auth: data.keys.auth};
  await prisma.staffPushSubscription.upsert({where: {endpoint: data.endpoint}, create: {endpoint: data.endpoint, ...record}, update: record});
  return NextResponse.json({success: true});
});
export const DELETE = protectMutation(async (req: NextRequest) => {
  const {auth, errorResponse} = await authenticateRequest(req);
  if (!auth || errorResponse) return errorResponse;
  const token = req.cookies.get('token')?.value || '';
  await prisma.staffPushSubscription.deleteMany({where: {sessionHash: sessionHash(token), userId: auth.user.userId}});
  return NextResponse.json({success: true});
});
