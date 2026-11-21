import { type NextRequest, type NextResponse } from 'next/server';
import { requireOwner } from '@/server/manual-upi/auth';
import { isPlaceholderVpa, vpaConfig } from '@/server/manual-upi/config';
import { json, jsonBody, respond } from '@/server/manual-upi/http';
import { createManualOrder } from '@/server/manual-upi/service';
import { getStore } from '@/server/manual-upi/store';
import { buildUpiIntent, rupeesFromPaise } from '@/server/manual-upi/upi';

export const dynamic = 'force-dynamic';

// Owner (manage:subscription), same gate as the Razorpay live routes. Creates
// a pending payment with a fresh 1-month period and returns the UPI intent
// string + order id. An existing OPEN order for the same restaurant+plan is
// reused, never duplicated; terminal orders never block a fresh checkout.
export async function POST(req: NextRequest): Promise<NextResponse> {
  return respond(async () => {
    const principal = await requireOwner(req);
    const body = await jsonBody(req);
    const store = getStore();
    const { payment, reused } = await createManualOrder(store, {
      restaurantId: principal.restaurantId,
      planCode: body.planCode,
    });
    const cfg = vpaConfig();
    const upiIntent = buildUpiIntent({
      vpa: cfg.vpa,
      payeeName: cfg.payeeName,
      amountInr: rupeesFromPaise(payment.amountPaise),
      orderId: payment.id,
    });
    return json(
      {
        success: true,
        orderId: payment.id,
        upiIntent,
        amountPaise: payment.amountPaise,
        vpa: cfg.vpa,
        payeeName: cfg.payeeName,
        testPreview: isPlaceholderVpa(cfg.vpa),
        periodStart: payment.periodStart.toISOString(),
        periodEnd: payment.periodEnd.toISOString(),
        reused,
      },
      201,
    );
  });
}
