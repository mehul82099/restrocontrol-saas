import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { AuditService } from '@/server/services/audit.service';
import { prisma } from '@/server/db/prisma';
import { findSubscriptionPlan } from '@/lib/subscription-plans';

// A plan request is not payment confirmation and never grants paid entitlements.
export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await authenticateRequest(req, 'manage:subscription');
    if (errorResponse || !auth) return errorResponse;
    const text = await req.text();
    if (text.length > 1024) return NextResponse.json({ success: false, error: 'Request too large.' }, { status: 413 });
    const body = JSON.parse(text || '{}');
    const plan = findSubscriptionPlan(body.planCode);
    if (!plan || plan.upcoming) return NextResponse.json({ success: false, error: 'Choose an available website plan. App plans are upcoming.' }, { status: 400 });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.auditLog.findMany({ where: { restaurantId: auth.restaurantId, userId: auth.user.userId, action: 'PLAN_ACTIVATION_REQUEST', createdAt: { gte: since } }, take: 50, orderBy: { createdAt: 'desc' } });
    const duplicate = recent.some(log => { try { return JSON.parse(log.after || '{}').planCode === plan.code; } catch { return false; } });
    if (!duplicate) await prisma.$transaction(async tx => AuditService.log({ restaurantId: auth.restaurantId, userId: auth.user.userId, action: 'PLAN_ACTIVATION_REQUEST', entity: 'Subscription', after: { planCode: plan.code, displayedPriceInr: plan.price, billingFrequency: 'MONTHLY', email: auth.user.email, paymentStatus: 'NOT_CONNECTED' }, ipAddress: req.headers.get('x-forwarded-for') || null, userAgent: req.headers.get('user-agent') }, tx));
    return NextResponse.json({ success: true, pendingBilling: true });
  } catch { return NextResponse.json({ success: false, error: 'Plan request could not be saved.' }, { status: 400 }); }
}
export const dynamic = 'force-dynamic';
