import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, AuthUserPayload } from './jwt';
import { hasPermission, Permission } from './permissions';
import { prisma } from '../db/prisma';

export interface AuthenticatedContext {
  user: AuthUserPayload;
  restaurantId: string;
  outletId: string;
}

export async function authenticateRequest(
  req: NextRequest,
  requiredPermission?: Permission
): Promise<{ auth?: AuthenticatedContext; errorResponse?: NextResponse }> {
  // 1. Extract token from header or cookie
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    const cookie = req.cookies.get('token');
    token = cookie ? cookie.value : null;
  }

  if (!token) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication token is missing.' },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken(token);
  if (!payload || !payload.userId || !payload.restaurantId) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid or expired token.' },
        { status: 401 }
      ),
    };
  }

  // 2. Check Role / Permission
  if (requiredPermission && !hasPermission(payload.role, requiredPermission)) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: `Forbidden: Missing required permission [${requiredPermission}].` },
        { status: 403 }
      ),
    };
  }

  // 3. Determine active outletId: from Header -> Query -> User's default outlet
  const outletHeader = req.headers.get('x-outlet-id');
  const url = new URL(req.url);
  const outletQuery = url.searchParams.get('outletId');
  let effectiveOutletId = outletHeader || outletQuery || payload.outletId;

  if (!effectiveOutletId) {
    // Lookup default outlet for this restaurant
    const defaultOutlet = await prisma.outlet.findFirst({
      where: { restaurantId: payload.restaurantId, isActive: true },
      orderBy: { isDefault: 'desc' },
    });
    effectiveOutletId = defaultOutlet?.id;
  }

  return {
    auth: {
      user: payload,
      restaurantId: payload.restaurantId,
      outletId: effectiveOutletId || '',
    },
  };
}
