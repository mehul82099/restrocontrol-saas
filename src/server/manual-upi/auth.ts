import type { NextRequest } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { isManualUpiAdmin } from './config';
import { ApiError } from './types';

// Real session auth via the app's middleware - same gate the Razorpay live
// billing routes use. authenticateRequest enforces session validity, tenant
// binding and the CSRF/origin rules; it returns an errorResponse instead of
// throwing, which we map into the service layer's ApiError.

export interface ManualUpiPrincipal {
  userId: string;
  restaurantId: string;
}

export async function requireOwner(req: NextRequest): Promise<ManualUpiPrincipal> {
  const r = await authenticateRequest(req, 'manage:subscription');
  if (r.errorResponse || !r.auth) throw new ApiError(r.errorResponse?.status ?? 401, 'Authentication required.');
  return { userId: r.auth.user.userId, restaurantId: r.auth.restaurantId };
}

export async function requireAdmin(req: NextRequest): Promise<ManualUpiPrincipal> {
  const r = await authenticateRequest(req);
  if (r.errorResponse || !r.auth) throw new ApiError(r.errorResponse?.status ?? 401, 'Authentication required.');
  if (!isManualUpiAdmin(r.auth.user.userId)) throw new ApiError(403, 'Admin privilege required.');
  return { userId: r.auth.user.userId, restaurantId: r.auth.restaurantId };
}
