import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { AuditService } from '@/server/services/audit.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:audit_logs');
  if (errorResponse || !auth) return errorResponse;

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || undefined;
  const entity = url.searchParams.get('entity') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const { total, logs } = await AuditService.getLogs(auth.restaurantId, {
    action,
    entity,
    limit,
    offset,
  });

  return NextResponse.json({ success: true, total, logs });
}
