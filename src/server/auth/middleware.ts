import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, AuthUserPayload } from './jwt';
import { hasPermission, Permission } from './permissions';
import { prisma } from '../db/prisma';

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
  if (!payload?.userId || !payload.restaurantId) return reject(401, 'Invalid or expired authentication.');
  // Reload authority on every request: disabled users and role changes take effect immediately.
  const user = await prisma.user.findFirst({where: {id: payload.userId, restaurantId: payload.restaurantId, isActive: true}, include: {userOutlets: true}});
  if (!user) return reject(401, 'Invalid or expired authentication.');
  if (requiredPermission && !hasPermission(user.role, requiredPermission)) return reject(403, 'Permission denied.');
  const canUseAllOutlets = user.role === 'OWNER';
  const outlets = await prisma.outlet.findMany({where: {restaurantId: user.restaurantId, isActive: true, ...(canUseAllOutlets ? {} : {userOutlets: {some: {userId: user.id}}})}, orderBy: {isDefault: 'desc'}});
  const requested = req.headers.get('x-outlet-id') || new URL(req.url).searchParams.get('outletId');
  const outlet = requested ? outlets.find(o => o.id === requested) : outlets.find(o => o.id === payload.outletId) || outlets[0];
  if (!outlet) return reject(403, 'Outlet unavailable or not assigned to this user.');
  return {auth: {user: {userId: user.id, restaurantId: user.restaurantId, role: user.role, email: user.email, name: user.name, outletId: outlet.id}, restaurantId: user.restaurantId, outletId: outlet.id}};
}
