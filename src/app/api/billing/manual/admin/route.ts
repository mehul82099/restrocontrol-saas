import { type NextRequest, type NextResponse } from 'next/server';
import { requireAdmin } from '@/server/manual-upi/auth';
import { enforceRenewal } from '@/server/manual-upi/entitlement';
import { json, jsonBody, respond } from '@/server/manual-upi/http';
import { approvePayment, rejectPayment, sweepExpiredPayments } from '@/server/manual-upi/service';
import { getStore } from '@/server/manual-upi/store';
import { REVIEWABLE_STATUSES, TERMINAL_STATUSES, type ManualUpiPayment } from '@/server/manual-upi/types';

export const dynamic = 'force-dynamic';

const REVIEWED = [...TERMINAL_STATUSES];

// Admin verification queue (MANUAL_UPI_ADMIN_USER_IDS allowlist on top of a
// valid session). Approval requires an explicit bank-credit-confirmed flag;
// entitlement activates only after it.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return respond(async () => {
    await requireAdmin(req);
    const store = getStore();
    await sweepExpiredPayments(store);
    await enforceRenewal(store);
    const pending = await store.listPayments({ statuses: REVIEWABLE_STATUSES, limit: 200 });
    const reviewed = await store.listPayments({ statuses: REVIEWED, limit: 50 });
    return json({ success: true, pending: pending.map(serialize), reviewed: reviewed.map(serialize) });
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return respond(async () => {
    const principal = await requireAdmin(req);
    const body = await jsonBody(req);
    const store = getStore();
    const action = body.action;

    if (action === 'approve') {
      const result = await approvePayment(store, {
        paymentId: String(body.paymentId || ''),
        reviewedBy: principal.userId,
        bankCreditConfirmed: body.bankCreditConfirmed === true,
      });
      return json({ success: true, decision: result.decision, already: result.already, activated: result.activated, payment: serialize(result.payment) });
    }

    if (action === 'reject') {
      const result = await rejectPayment(store, {
        paymentId: String(body.paymentId || ''),
        reviewedBy: principal.userId,
        reviewNote: typeof body.reviewNote === 'string' ? body.reviewNote : '',
      });
      return json({ success: true, decision: result.decision, already: result.already, payment: serialize(result.payment) });
    }

    return json({ success: false, error: 'Unknown action.' }, 400);
  });
}

function serialize(p: ManualUpiPayment) {
  return {
    id: p.id,
    restaurantId: p.restaurantId,
    planCode: p.planCode,
    amountPaise: p.amountPaise,
    status: p.status,
    utr: p.utr,
    vpaSnapshot: p.vpaSnapshot,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    createdAt: p.createdAt.toISOString(),
    utrSubmittedAt: p.utrSubmittedAt ? p.utrSubmittedAt.toISOString() : null,
    reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
    reviewedBy: p.reviewedBy,
    reviewNote: p.reviewNote,
  };
}
