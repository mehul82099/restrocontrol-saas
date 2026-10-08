import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { AuditService } from '@/server/services/audit.service';
import { prisma } from '@/server/db/prisma';

// No payment gateway yet: the owner asks for activation and the request is recorded in the audit log.
export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:subscription');
  if (errorResponse || !auth) return errorResponse;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.auditLog.count({ where: { restaurantId: auth.restaurantId, action: 'PLAN_ACTIVATION_REQUEST', createdAt: { gte: since } } });
  if (recent === 0) {
    await AuditService.log({
      restaurantId: auth.restaurantId,
      userId: auth.user.userId,
      action: 'PLAN_ACTIVATION_REQUEST',
      entity: 'Subscription',
      after: { plan: 'STANDARD', priceMonthlyInr: 499, email: auth.user.email, name: auth.user.name },
      ipAddress: req.headers.get('x-forwarded-for') || null,
      userAgent: req.headers.get('user-agent'),
    });
  }
  return NextResponse.json({ success: true, email: auth.user.email });
}

export const dynamic = 'force-dynamic';
