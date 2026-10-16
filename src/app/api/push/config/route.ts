import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { pushConfigured } from '@/server/services/staff-push.service';
import { orderAudience } from '@/server/services/push-policy';
import { protectRead } from '@/server/services/api-validation';
export const dynamic = 'force-dynamic';
export const GET = protectRead(async (req: NextRequest) => {
  const {auth, errorResponse} = await authenticateRequest(req);
  if (!auth || errorResponse) return errorResponse;
  if (!orderAudience(auth.user.role)) return NextResponse.json({success: false}, {status: 403});
  return NextResponse.json({success: true, configured: pushConfigured(), publicKey: pushConfigured() ? process.env.WEB_PUSH_PUBLIC_KEY : null});
});
