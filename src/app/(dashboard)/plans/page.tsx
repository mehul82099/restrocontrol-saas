'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useOutlet } from '../layout';

const FEATURES = [
  'POS, orders and kitchen display',
  'Recipe costing and inventory ledger',
  'Expected vs actual stock variance',
  'Wastage, stock audits and purchases',
  'All reports',
  'Staff accounts with roles',
];

export default function PlansPage() {
  const { user } = useOutlet();
  const [trial, setTrial] = useState<any>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setTrial(d.trial || null)).catch(() => {});
  }, []);

  const request = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/plans/request', { method: 'POST' });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error('Could not send your request. Try again.');
      setSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-black text-slate-900 text-center">Choose your plan</h1>
      {trial?.isTrial && (
        <p className="text-sm text-center text-slate-600 mt-2">
          {trial.expired ? 'Your free trial has ended.' : `Free trial: ${trial.daysRemaining} ${trial.daysRemaining === 1 ? 'day' : 'days'} remaining.`}
        </p>
      )}
      <div className="mt-6 bg-white border-2 border-emerald-500 rounded-2xl p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">RestroControl</p>
        <p className="mt-2 text-4xl font-black text-slate-900">
          ₹499<span className="text-base font-semibold text-slate-500"> / month</span>
        </p>
        <p className="text-sm text-slate-500 mt-1">Per restaurant. Everything included.</p>
        <ul className="mt-5 space-y-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {sent ? (
          <div className="mt-6 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-semibold text-center">
            Request received. We will contact you at {user?.email || 'your email'} to activate your plan.
          </div>
        ) : (
          <button
            onClick={request}
            disabled={busy}
            className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl disabled:opacity-50"
          >
            {busy ? 'Sending...' : 'Request activation'}
          </button>
        )}
        {error && <p className="text-xs text-rose-600 mt-2 text-center">{error}</p>}
        <p className="text-[11px] text-slate-400 text-center mt-3">Online payment is coming soon. For now we activate your plan after you request it.</p>
      </div>
    </div>
  );
}
