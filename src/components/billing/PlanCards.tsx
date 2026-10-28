'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SUBSCRIPTION_PLANS, planBreakup } from '@/lib/subscription-plans';
import { GST_RATE_LABEL, formatINR } from '@/lib/gst';

export default function PlanCards({ canRequest = false, currentCode, account = false }: { canRequest?: boolean; currentCode?: string; account?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => { fetch('/api/billing/live/status').then(async r => ({ ok: r.ok, d: await r.json() })).then(({ ok, d }) => setLive(!ok || d?.success !== true ? null : d?.enabled === true ? true : d?.enabled === false ? false : null)).catch(() => setLive(null)); }, []);
  async function pay(planCode: string) {
    const plan = SUBSCRIPTION_PLANS.find(p => p.code === planCode); if (!plan) return;
    if (!confirm('You will pay ' + formatINR(planBreakup(plan).totalPaise) + ' now (including 18% GST) and then every month automatically until you cancel. Continue?')) return;
    setBusy(planCode); setMessage('');
    try {
      const call = async (action: string, body: any) => { const r = await fetch('/api/billing/live/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.error || 'Payment could not be started.'); return d; };
      const data = await call('checkout', { planCode, confirmLive: true });
      if (data.reused && !['created', 'authenticated'].includes(data.subscription.providerStatus)) { setMessage('You already have a billing subscription. Status: ' + data.subscription.providerStatus + '.'); return; }
      if (!(window as any).Razorpay) await new Promise<void>((ok, bad) => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => ok(); s.onerror = () => bad(new Error('Could not load Razorpay checkout.')); document.head.appendChild(s); });
      new (window as any).Razorpay({ key: data.key, subscription_id: data.subscription.providerId, name: 'RestroControl', description: plan.name + ' - monthly autopay (incl. 18% GST)', handler: async (resp: any) => { try { await call('verify', resp); setMessage('Payment received. Your plan will show as active shortly. You can cancel anytime from this page.'); } catch { setMessage('Payment is being confirmed. Refresh in a minute; if your plan is not active, contact support.'); } }, modal: { ondismiss: () => setMessage('Checkout closed. You were not charged unless the payment completed.') } }).open();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Payment could not be started.'); }
    finally { setBusy(null); }
  }
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
    <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700">Prices are per month and carry 18% GST on top; each card shows the GST-inclusive monthly total. Both website plans include unlimited staff and orders. {live === true ? 'Pay online with UPI or card; renewal is automatic every month (autopay through Razorpay) until you cancel. ' : live === false ? 'Online autopay is not connected yet; activation is handled after signup. ' : ''}Upcoming plans cannot be selected.</div>
    <div className="grid gap-4 sm:grid-cols-2">
      {SUBSCRIPTION_PLANS.map(plan => <section key={plan.code} className={`flex min-w-0 flex-col rounded-2xl border bg-white p-5 ${plan.upcoming ? 'border-stone-200' : 'border-emerald-300'}`}>
        <span className={`self-start rounded-full px-2.5 py-1 text-xs font-bold ${plan.upcoming ? 'bg-stone-100 text-stone-600' : 'bg-emerald-50 text-emerald-800'}`}>{plan.upcoming ? 'Upcoming' : 'Website plan'}</span>
        <h2 className="mt-4 text-xl font-bold text-stone-900">{plan.name}</h2>
        <p className="mt-3 text-4xl font-black text-stone-900">₹{plan.price}<span className="text-base font-semibold text-stone-500"> + GST</span></p>
        <div className="mt-2 space-y-0.5 text-xs text-stone-500">
          <p>Base: {formatINR(planBreakup(plan).basePaise)} / month</p>
          <p>GST ({GST_RATE_LABEL}): {formatINR(planBreakup(plan).gstPaise)} / month</p>
          <p className="font-semibold text-stone-700">Total: {formatINR(planBreakup(plan).totalPaise)} / month</p>
        </div>
        <p className="mt-4 flex-1 text-sm leading-6 text-stone-600">{plan.description}</p>
        {plan.upcoming ? <button disabled className="mt-5 w-full rounded-xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-500">Upcoming - not active</button>
          : currentCode === plan.code ? <button disabled className="mt-5 w-full rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Current plan</button>
          : canRequest && live && !(currentCode === 'WEBSITE_SINGLE' && plan.code === 'WEBSITE_MULTI') ? <button onClick={() => pay(plan.code)} disabled={busy !== null} className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === plan.code ? 'Opening checkout...' : 'Pay ' + formatINR(planBreakup(plan).totalPaise) + ' and start autopay'}</button>
          : canRequest ? <button onClick={() => request(plan.code)} disabled={busy !== null} className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === plan.code ? 'Saving request...' : currentCode === 'WEBSITE_SINGLE' && plan.code === 'WEBSITE_MULTI' ? 'Request upgrade to ₹699 + GST' : 'Request this plan'}</button>
          : account ? <button disabled className="mt-5 w-full rounded-xl bg-stone-100 px-4 py-3 text-sm font-bold text-stone-500">Only the owner can request a plan</button>
          : <Link href="/signup" className="mt-5 rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white">Start 14-day free trial</Link>}
      </section>)}
    </div>
    {message && <p role="status" className="mt-5 rounded-xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-700">{message}</p>}
    <p className="mt-5 text-sm leading-6 text-stone-600">You can request a move from the ₹499 + GST website plan to the ₹699 + GST website plan from your account. A request does not change your access, price or renewal mandate. The ₹499 to ₹699 upgrade takes effect at the next renewal, with no immediate charge or proration.</p>
  </div>;
}
