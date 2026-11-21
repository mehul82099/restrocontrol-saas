'use client';

import { useCallback, useState } from 'react';
import QRCode from 'qrcode';

// PlanCards "Pay via UPI - manual verification" modal. The payment is verified
// by an operator only after the bank credit is confirmed; never on a
// screenshot or a customer claim. The TEST PREVIEW banner is shown only while
// the server reports a placeholder (non-real) collection VPA.
interface CheckoutResponse {
  success: boolean;
  orderId: string;
  upiIntent: string;
  amountPaise: number;
  vpa: string;
  payeeName: string;
  testPreview: boolean;
  periodStart: string;
  periodEnd: string;
  reused?: boolean;
}

export default function ManualUpiCheckout({ planCode, triggerLabel }: { planCode: string; triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [utr, setUtr] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const startCheckout = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/billing/manual/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Checkout failed.');
      setCheckout(d);
      const dataUrl = await QRCode.toDataURL(d.upiIntent, { width: 260, margin: 1 });
      setQrDataUrl(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed.');
    } finally {
      setBusy(false);
    }
  }, [planCode]);

  const submitUtr = useCallback(async () => {
    if (!checkout) return;
    if (!/^\d{12}$/.test(utr.trim())) {
      setError('UTR must be exactly 12 digits.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/billing/manual/submit-utr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: checkout.orderId, utr: utr.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Submit failed.');
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed.');
    } finally {
      setBusy(false);
    }
  }, [checkout, utr]);

  const close = useCallback(() => {
    setOpen(false);
    setCheckout(null);
    setQrDataUrl('');
    setUtr('');
    setSubmitted(false);
    setError('');
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-xl border border-emerald-700 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
      >
        {triggerLabel || 'Pay via UPI - manual verification'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-black text-stone-900">Pay via UPI - manual verification</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100"
              >
                X
              </button>
            </div>

            {checkout?.testPreview && (
              <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                TEST PREVIEW - not a real payment. The VPA shown is a placeholder.
              </p>
            )}

            {!checkout && !submitted && (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-stone-600">
                  Pay the exact amount via any UPI app to the VPA shown, then submit the 12-digit UTR (bank reference
                  number). Your subscription activates only after an operator verifies the bank credit.
                </p>
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={busy}
                  className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-60"
                >
                  {busy ? 'Preparing...' : 'Generate payment order'}
                </button>
              </div>
            )}

            {checkout && !submitted && (
              <div className="mt-5 space-y-4">
                <div className="flex justify-center rounded-2xl border border-stone-200 bg-white p-4">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt={`UPI QR for ${checkout.vpa}`} width={260} height={260} />
                  ) : (
                    <p className="p-10 text-sm text-stone-400">Loading QR...</p>
                  )}
                </div>
                <a
                  href={checkout.upiIntent}
                  className="block w-full rounded-xl bg-emerald-700 px-5 py-3 text-center font-bold text-white"
                >
                  Open UPI app
                </a>
                <div className="rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                  <p><strong>Pay to (VPA):</strong> {checkout.vpa}</p>
                  <p><strong>Payee:</strong> {checkout.payeeName}</p>
                  <p><strong>Amount:</strong> Rs {(checkout.amountPaise / 100).toFixed(2)}</p>
                  <p><strong>Order ID:</strong> <span className="break-all">{checkout.orderId}</span></p>
                  <p className="mt-2 text-xs text-stone-500">
                    Covers {new Date(checkout.periodStart).toLocaleDateString()} to{' '}
                    {new Date(checkout.periodEnd).toLocaleDateString()}.
                  </p>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-stone-600">
                  <li>Open any UPI app (GPay, PhonePe, Paytm, BHIM).</li>
                  <li>Pay exactly Rs {(checkout.amountPaise / 100).toFixed(2)} to {checkout.vpa}.</li>
                  <li>Copy the 12-digit UTR from the payment acknowledgement.</li>
                  <li>Enter it below and submit.</li>
                </ol>
                <label className="block text-sm font-semibold text-stone-700">
                  UTR (12 digits)
                  <input
                    value={utr}
                    onChange={e => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="e.g. 410291738821"
                    inputMode="numeric"
                    className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-2 text-base tracking-widest focus:border-emerald-600 focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={submitUtr}
                  disabled={busy || utr.length !== 12}
                  className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-60"
                >
                  {busy ? 'Submitting...' : 'Submit UTR'}
                </button>
              </div>
            )}

            {submitted && (
              <div className="mt-5 space-y-3">
                <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                  UTR submitted. Your payment is awaiting manual verification. It will be confirmed only after the bank
                  credit is verified - never on a screenshot or claim.
                </p>
                <p className="text-sm text-stone-500">Order {checkout?.orderId} - Status: PENDING VERIFICATION</p>
                <button type="button" onClick={close} className="w-full rounded-xl border border-stone-300 px-5 py-3 font-bold text-stone-700">
                  Done
                </button>
              </div>
            )}

            {error && <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
