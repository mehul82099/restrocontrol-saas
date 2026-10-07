import { protectRead } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { AuditService } from '@/server/services/audit.service';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:audit_logs');
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || undefined;
  const entity = url.searchParams.get('entity') || undefined;
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') || '50') || 50));
  const offset = Math.max(0, Math.min(100000, parseInt(url.searchParams.get('offset') || '0') || 0));

  const { total, logs } = await AuditService.getLogs(auth.restaurantId, {
    action,
    entity,
    limit,
    offset,
  });

  return NextResponse.json({ success: true, total, logs });
}

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
