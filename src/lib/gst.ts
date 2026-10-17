// Owner-approved pricing rule (WhatsApp, 2026-10-16): 18% GST is charged on top of
// every subscription plan's base price. Posters/reels say "₹499 + GST".
// All money math is done in integer paise; GST is rounded to the nearest paisa.
export const GST_RATE_BPS = 1800; // 18% in basis points
export const GST_RATE_LABEL = '18%';

// GSTIN: Mystify me is not GST-registered yet. When Mehul shares the GSTIN,
// set it here and surface it on policy pages and invoices. Keep null until then;
// no page may show a GSTIN while this is null.
export const GSTIN: string | null = null;

export interface PriceBreakup {
  basePaise: number;
  gstPaise: number;
  totalPaise: number;
}

export function gstBreakup(basePaise: number): PriceBreakup {
  if (!Number.isSafeInteger(basePaise) || basePaise < 0) throw new Error('Base amount must be a non-negative paise integer.');
  const gstPaise = Math.round((basePaise * GST_RATE_BPS) / 10000);
  return { basePaise, gstPaise, totalPaise: basePaise + gstPaise };
}

export function formatINR(paise: number): string {
  if (!Number.isSafeInteger(paise)) throw new Error('Amount must be a paise integer.');
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
