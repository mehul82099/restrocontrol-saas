import { type NextRequest, type NextResponse } from 'next/server';
import { requireOwner } from '@/server/manual-upi/auth';
import { json, jsonBody, respond } from '@/server/manual-upi/http';
import { submitUtr } from '@/server/manual-upi/service';
import { getStore } from '@/server/manual-upi/store';

export const dynamic = 'force-dynamic';

// Owner (manage:subscription). Validates exactly 12-digit UTR, enforces the
// 30-min PENDING_UTR TTL and UTR uniqueness across payments (atomically via
// the DB unique index), then moves the order to UTR_SUBMITTED.
export async function POST(req: NextRequest): Promise<NextResponse> {
  return respond(async () => {
    const principal = await requireOwner(req);
    const body = await jsonBody(req);
    const payment = await submitUtr(getStore(), {
      restaurantId: principal.restaurantId,
      orderId: String(body.orderId || ''),
      utr: body.utr,
    });
    return json({
      success: true,
      orderId: payment.id,
      status: payment.status,
      utr: payment.utr,
      utrSubmittedAt: payment.utrSubmittedAt ? payment.utrSubmittedAt.toISOString() : null,
    });
  });
}
