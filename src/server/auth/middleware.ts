import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, AuthUserPayload } from './jwt';
import { hasPermission, Permission } from './permissions';
import { prisma } from '../db/prisma';
import { getTrialInfo, isTrialExemptPath } from '../services/trial.service';

export interface AuthenticatedContext {
  user: AuthUserPayload;
  restaurantId: string;
  outletId: string;
}
export async function authenticateRequest(req: NextRequest, requiredPermission?: Permission): Promise<{auth?: AuthenticatedContext; errorResponse?: NextResponse}> {
  const reject = (status: number, error: string) => ({errorResponse: NextResponse.json({success: false, error}, {status})});
  // Reject cross-origin cookie-authenticated mutations. Bearer tokens are not ambient credentials.
  const header = req.headers.get('authorization');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !header?.startsWith('Bearer ')) {
    const origin = req.headers.get('origin');
    if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(req.url).origin)) return reject(403, 'Cross-origin request denied.');
  }
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies.get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload?.userId || !payload.restaurantId || !payload.authSessionId) return reject(401, 'Invalid or expired authentication.');
  const now = new Date();
  // One current-user read carries session and attendance authority. IDs alone never
  // select another tenant's capability. No legacy token compatibility bypass.
  const user = await prisma.user.findFirst({where: {id: payload.userId, restaurantId: payload.restaurantId, isActive: true}, include: {
    userOutlets: true,
    authSessions: {where: {id: payload.authSessionId, userId: payload.userId, restaurantId: payload.restaurantId, revokedAt: null, expiresAt: {gt: now}}},
    ...(payload.attendanceSessionId ? {attendanceSessions: {where: {id: payload.attendanceSessionId, userId: payload.userId, restaurantId: payload.restaurantId, checkedOutAt: null, expiresAt: {gt: now}}}} : {}),
  }});
  if (!user || !user.authSessions.some(s => s.authVersion === user.authVersion)) return reject(401, 'This login session has ended.');
  if ((user.role !== 'OWNER' || payload.attendanceSessionId) && !('attendanceSessions' in user && Array.isArray(user.attendanceSessions) && user.attendanceSessions.length)) return reject(401, 'This login session has ended.');
  // Free-trial expiry: only TRIALING subscriptions are blocked. Other accounts are unaffected.
  const subscription = await prisma.subscription.findUnique({where: {restaurantId: user.restaurantId}, select: {status: true, currentPeriodEnd: true}});
  if (getTrialInfo(subscription).expired && !isTrialExemptPath(new URL(req.url).pathname, req.method)) {
    return {errorResponse: NextResponse.json({success: false, code: 'TRIAL_EXPIRED', error: 'Your 14-day free trial has ended.'}, {status: 402})};
  }
  if (requiredPermission && !hasPermission(user.role, requiredPermission)) return reject(403, 'Permission denied.');
  const canUseAllOutlets = user.role === 'OWNER';
  const outlets = await prisma.outlet.findMany({where: {restaurantId: user.restaurantId, isActive: true, ...(canUseAllOutlets ? {} : {userOutlets: {some: {userId: user.id}}})}, orderBy: {isDefault: 'desc'}});
  const requested = req.headers.get('x-outlet-id') || new URL(req.url).searchParams.get('outletId');
  const outlet = requested ? outlets.find(o => o.id === requested) : outlets.find(o => o.id === payload.outletId) || outlets[0];
  if (!outlet) return reject(403, 'Outlet unavailable or not assigned to this user.');
  return {auth: {user: {userId: user.id, restaurantId: user.restaurantId, role: user.role, email: user.email, name: user.name, outletId: outlet.id, authSessionId: payload.authSessionId, attendanceSessionId: payload.attendanceSessionId}, restaurantId: user.restaurantId, outletId: outlet.id}};
}
