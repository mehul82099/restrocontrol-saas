import { type NextRequest, type NextResponse } from 'next/server';
import { isPlaceholderVpa, manualUpiEnabled, vpaConfig } from '@/server/manual-upi/config';
import { json, respond } from '@/server/manual-upi/http';
import { enforceRenewal } from '@/server/manual-upi/entitlement';
import { getStore } from '@/server/manual-upi/store';

export const dynamic = 'force-dynamic';

// Public, mirrors /api/billing/live/status: always 200, tells the UI whether
// to show the manual-UPI checkout. Never exposes the VPA here; the collection
// VPA is only returned to an authenticated owner at checkout.
export async function GET(_req: NextRequest): Promise<NextResponse> {
  return respond(async () => {
    if (!manualUpiEnabled()) return json({ success: true, enabled: false });
    try {
      const cfg = vpaConfig();
      // Activity-driven renewal sweep (manual billing has no provider cron).
      await enforceRenewal(getStore());
      return json({ success: true, enabled: true, payeeName: cfg.payeeName, testPreview: isPlaceholderVpa(cfg.vpa) });
    } catch {
      return json({ success: true, enabled: false });
    }
  });
}
