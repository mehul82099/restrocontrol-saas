'use client';

import { useState, type FormEvent } from 'react';

// Preview only. No network request, storage write, refund or support notification.
export default function RefundFeedbackForm() {
  const [reviewed, setReviewed] = useState(false);
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewed(true);
  }
  const fieldClass = 'mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700';
  return (
    <section aria-labelledby="refund-feedback-title" className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <h2 id="refund-feedback-title" className="text-xl font-bold">Refund feedback form</h2>
      <p id="refund-preview-note" className="mt-3 text-sm leading-6 text-amber-950">Preview only. This form does not send or save your answers, contact support or issue a refund. It does not start the 24-hour processing period. Do not enter real personal or payment information while testing.</p>
      <form aria-describedby="refund-preview-note" onSubmit={review} onChange={() => setReviewed(false)} className="mt-6 space-y-5">
        <label className="block text-sm font-semibold">Restaurant name
          <input name="restaurant" required maxLength={160} autoComplete="off" className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold">Registered email
          <input name="email" type="email" required maxLength={254} autoComplete="off" className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold">Payment reference
          <input name="paymentReference" required maxLength={160} autoComplete="off" aria-describedby="refund-reference-note" className={fieldClass} />
        </label>
        <p id="refund-reference-note" className="text-sm leading-6 text-stone-600">Use only a test reference in this preview. Never enter card details, passwords or OTPs.</p>
        <label className="block text-sm font-semibold">Why do you want a refund?
          <textarea name="refundReason" required minLength={10} maxLength={2000} rows={4} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold">Why do you not like the service?
          <textarea name="serviceFeedback" required minLength={10} maxLength={2000} rows={4} className={fieldClass} />
        </label>
        <p className="text-sm leading-6 text-stone-600">Draft policy: 80% of the latest payment only, requested within 7 days of that payment. Each payment has its own 7-day window. When live intake is enabled, an eligible refund is issued within 24 hours of form submission.</p>
        <button type="submit" className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2">Test form preview</button>
        {reviewed && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">Preview checked. Nothing was submitted or saved. No refund request was created and no processing period has started.</p>}
      </form>
    </section>
  );
}
