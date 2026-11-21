// UPI deep-link / QR payload building. The string follows the standard
// upi://pay?pa=VPA&pn=PAYEE&am=TOTAL&cu=INR&tn=ORDERID shape.
export interface UpiIntentInput {
  vpa: string;
  payeeName: string;
  amountInr: string; // e.g. "588.82" (₹, two decimals)
  orderId: string;
  currency?: string;
}

export function buildUpiIntent(input: UpiIntentInput): string {
  const params = new URLSearchParams({
    pa: input.vpa,
    pn: input.payeeName,
    am: input.amountInr,
    cu: input.currency || 'INR',
    tn: input.orderId,
  });
  return 'upi://pay?' + params.toString();
}

// Paise (integer minor units) -> "₹" with two decimals, e.g. 58882 -> "588.82".
export function rupeesFromPaise(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) throw new Error('Amount must be a non-negative paise integer.');
  return (paise / 100).toFixed(2);
}
