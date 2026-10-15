'use client';

import { useState, useEffect, type FormEvent } from 'react';

// Runtime intake is opt-in and requires an authenticated restaurant owner.
export default function RefundFeedbackForm() {
  const [reviewed, setReviewed] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [admin, setAdmin] = useState(false);
  useEffect(() => {fetch('/api/refunds').then(r => r.json()).then(data => {setEnabled(data.enabled === true);setRequests(data.requests || []);setAdmin(data.admin === true);}).catch(() => {});}, []);
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) { setReviewed(true); return; }
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/refunds', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save request.');
      setRequests(previous => [data.request, ...previous.filter(r => r.id !== data.request.id)]);
      setMessage('Request saved for operator review. No money has moved. Eligibility and payment must still be verified.');
    } catch(error) { setMessage(error instanceof Error ? error.message : 'Could not save request.'); }
    finally { setBusy(false); }
  }
  const fieldClass = 'mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700';
  return (
    <section aria-labelledby="refund-feedback-title" className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <h2 id="refund-feedback-title" className="text-xl font-bold">Refund feedback form</h2>
      <p id="refund-preview-note" className="mt-3 text-sm leading-6 text-amber-950">{enabled ? 'Preview intake enabled. Submissions are saved to this environment for operator review. No automatic refund is issued. Use test information only in this preview.' : 'Demo only. Sign in as a restaurant owner to submit when intake is enabled. This demo does not send or save your answers or start a processing period. Do not enter real personal or payment information while testing.'}</p>
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
        <button type="submit" disabled={busy} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2">{busy ? 'Saving...' : enabled ? 'Submit refund request' : 'Test form preview'}</button>
        {message && <p role="status" className="rounded-xl border border-stone-200 p-4 text-sm leading-6">{message}</p>}
        {reviewed && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">Preview checked. Nothing was submitted or saved. No refund request was created and no processing period has started.</p>}
      </form>
      {admin && <a href="/refund-admin" className="mt-6 block font-semibold text-emerald-800 underline">Operator refund queue</a>}
      {requests.length > 0 && <section className="mt-8 space-y-3"><h3 className="font-bold">Your restaurant's requests</h3>{requests.map(r => <div key={r.id} className="rounded-xl border border-stone-200 p-4 text-sm leading-6 break-words"><p className="font-semibold">{r.paymentReference} · {r.status}</p><p>Submitted: {new Date(r.submittedAt).toLocaleString()}</p><p>Refund due: {new Date(r.refundDueAt).toLocaleString()} (24 hours after submission)</p><p>Tracking target only. Eligibility/payment verification pending; not proof of a refund.</p></div>)}</section>}

    </section>
  );
}
