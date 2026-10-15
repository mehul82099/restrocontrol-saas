'use client';
import { useState } from 'react';
import Link from 'next/link';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';

export default function PlanCards({ canRequest = false, currentCode, account = false }: { canRequest?: boolean; currentCode?: string; account?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  async function request(planCode: string) {
    setBusy(planCode); setMessage('');
    try {
      const res = await fetch('/api/plans/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planCode }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Request could not be saved. Try again.');
      setMessage('Plan request recorded. This does not charge you, activate a plan or enable autopay. Billing setup is not connected yet.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request could not be saved.'); }
    finally { setBusy(null); }
  }
  return <div className="mt-7">
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Preview pricing. Prices are per month. Both website plans include unlimited staff and orders. Tax treatment is being confirmed. Razorpay autopay is not connected. Upcoming plans cannot be selected.</div>
    <div className="grid gap-4 sm:grid-cols-2">
      {SUBSCRIPTION_PLANS.map(plan => <section key={plan.code} className={`flex min-w-0 flex-col rounded-2xl border bg-white p-5 ${plan.upcoming ? 'border-stone-200' : 'border-emerald-300'}`}>
        <span className={`self-start rounded-full px-2.5 py-1 text-xs font-bold ${plan.upcoming ? 'bg-stone-100 text-stone-600' : 'bg-emerald-50 text-emerald-800'}`}>{plan.upcoming ? 'Upcoming' : 'Website plan'}</span>
        <h2 className="mt-4 text-xl font-bold text-stone-900">{plan.name}</h2>
        <p className="mt-3 text-4xl font-black text-stone-900">₹{plan.price}<span className="text-sm font-medium text-stone-500"> / month</span></p>
        <p className="mt-1 text-xs text-stone-500">Monthly subscription</p>
        <p className="mt-4 flex-1 text-sm leading-6 text-stone-600">{plan.description}</p>
        {plan.upcoming ? <button disabled className="mt-5 w-full rounded-xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-500">Upcoming - not active</button>
          : currentCode === plan.code ? <button disabled className="mt-5 w-full rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Current plan</button>
          : canRequest ? <button onClick={() => request(plan.code)} disabled={busy !== null} className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === plan.code ? 'Saving request...' : currentCode === 'WEBSITE_SINGLE' && plan.code === 'WEBSITE_MULTI' ? 'Request upgrade to ₹699' : 'Request this plan'}</button>
          : account ? <button disabled className="mt-5 w-full rounded-xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-500">Only the owner can request a plan</button>
          : <Link href="/signup" className="mt-5 rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white">Start 14-day free trial</Link>}
      </section>)}
    </div>
    {message && <p role="status" className="mt-5 rounded-xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-700">{message}</p>}
    <p className="mt-5 text-sm leading-6 text-stone-600">You can request a move from the ₹499 website plan to the ₹699 website plan from your account. A request does not change your access, price or renewal mandate. Final upgrade billing rules must be approved before payments launch.</p>
  </div>;
}
