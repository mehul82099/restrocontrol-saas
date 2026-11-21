'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR } from '@/lib/gst';

// Owner-facing manual-UPI verification queue. Data access is enforced
// server-side by the MANUAL_UPI_ADMIN_USER_IDS allowlist on
// /api/billing/manual/admin; this page renders nothing without it.
interface AdminPayment {
  id: string;
  restaurantId: string;
  restaurantName: string | null;
  planCode: string;
  amountPaise: number;
  status: string;
  utr: string | null;
  vpaSnapshot: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  utrSubmittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

export default function ManualPaymentsAdminPage() {
  const [pending, setPending] = useState<AdminPayment[]>([]);
  const [reviewed, setReviewed] = useState<AdminPayment[]>([]);
  const [testPreview, setTestPreview] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/billing/manual/admin');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not load queue.');
      setPending(d.pending);
      setReviewed(d.reviewed);
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load queue.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch('/api/billing/manual/status')
      .then(r => r.json())
      .then(d => setTestPreview(d?.testPreview === true))
      .catch(() => {});
  }, [load]);

  const act = useCallback(
    async (paymentId: string, action: 'approve' | 'reject') => {
      if (action === 'approve' && !confirmed[paymentId]) {
        setMessage('Approval requires confirming the bank credit (verify in the bank statement).');
        return;
      }
      if (action === 'reject' && !(notes[paymentId] || '').trim()) {
        setMessage('A review note is mandatory when rejecting.');
        return;
      }
      setBusy(true);
      setMessage('');
      try {
        const r = await fetch('/api/billing/manual/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            paymentId,
            bankCreditConfirmed: action === 'approve' ? true : undefined,
            reviewNote: action === 'reject' ? notes[paymentId] : undefined,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Action failed.');
        setMessage(
          action === 'approve'
            ? 'Approved. Subscription activated for one month, based on the bank-credit check you confirmed.'
            : 'Rejected with note recorded.',
        );
        await load();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Action failed.');
      } finally {
        setBusy(false);
      }
    },
    [confirmed, notes, load],
  );

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-10 text-stone-900">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black">Manual UPI verification</h1>
        {testPreview && (
          <p className="mt-3 text-sm font-bold text-amber-800">TEST PREVIEW - placeholder VPA, not a real payment pipeline.</p>
        )}
        <p className="mt-2 max-w-3xl leading-7 text-stone-600">
          A payment is verified ONLY after the bank credit is confirmed in the account statement. Never approve on a
          screenshot or a customer claim. Approving activates the subscription for exactly one month; rejecting requires
          a note.
        </p>
        <button onClick={load} disabled={busy} className="my-5 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-60">
          {busy ? 'Working...' : 'Refresh queue'}
        </button>
        {message && <p role="alert" className="mb-5 rounded-xl border border-amber-300 p-4">{message}</p>}

        <h2 className="text-xl font-bold">Pending verification ({pending.length})</h2>
        <div className="mt-4 grid gap-5">
          {pending.map(p => (
            <article key={p.id} className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{p.restaurantName ?? p.restaurantId}</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Order {p.id.slice(0, 8)} · created {new Date(p.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    {p.planCode} · {formatINR(p.amountPaise)} · {p.status}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    Period {new Date(p.periodStart).toLocaleDateString()} to {new Date(p.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
                  {p.utr ? `UTR ${p.utr}` : 'No UTR yet'}
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-stone-200 p-4">
                  <label className="flex items-start gap-3 text-sm leading-6">
                    <input
                      type="checkbox"
                      checked={!!confirmed[p.id]}
                      onChange={e => setConfirmed(prev => ({ ...prev, [p.id]: e.target.checked }))}
                      className="mt-1 h-4 w-4 accent-emerald-700"
                    />
                    <span>
                      I confirmed the bank credit for {formatINR(p.amountPaise)} in the account statement (never a
                      screenshot or claim).
                    </span>
                  </label>
                  <button
                    onClick={() => act(p.id, 'approve')}
                    disabled={busy || !p.utr}
                    title={p.utr ? undefined : 'Waiting for the customer to submit their UTR'}
                    className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40"
                  >
                    Approve & activate (1 month)
                  </button>
                  {!p.utr && (
                    <p className="mt-2 text-xs text-stone-500">Approval unlocks after the customer submits their 12-digit UTR.</p>
                  )}
                </div>

                <div className="rounded-xl border border-stone-200 p-4">
                  <textarea
                    value={notes[p.id] || ''}
                    onChange={e => setNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="Mandatory note for rejection (e.g. UTR not found in statement)"
                    className="min-h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                  <button
                    onClick={() => act(p.id, 'reject')}
                    disabled={busy}
                    className="mt-3 w-full rounded-xl border border-red-600 px-4 py-2 font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </article>
          ))}
          {pending.length === 0 && <p className="rounded-xl border border-stone-200 bg-white p-5 text-stone-500">Queue empty.</p>}
        </div>

        <h2 className="mt-10 text-xl font-bold">Recently reviewed ({reviewed.length})</h2>
        <div className="mt-4 space-y-3">
          {reviewed.map(p => (
            <article key={p.id} className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
              <p>
                <strong>{p.restaurantName ?? p.restaurantId}</strong> · Order {p.id.slice(0, 8)} · {p.planCode} · {formatINR(p.amountPaise)} ·{' '}
                <span className="font-bold">{p.status}</span>
              </p>
              <p className="mt-1 text-stone-500">
                {p.utr ? `UTR ${p.utr} · ` : ''}Reviewed by {p.reviewedBy ?? '-'} on{' '}
                {p.reviewedAt ? new Date(p.reviewedAt).toLocaleString() : '-'}
                {p.reviewNote ? ` · Note: ${p.reviewNote}` : ''}
              </p>
            </article>
          ))}
          {reviewed.length === 0 && <p className="text-stone-500">None yet.</p>}
        </div>
      </div>
    </main>
  );
}
