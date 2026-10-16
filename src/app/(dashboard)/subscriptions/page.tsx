'use client';
import { useEffect, useState } from 'react';
import PlanCards from '@/components/billing/PlanCards';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import { useOutlet } from '../layout';

export default function SubscriptionsPage() {
  const { user } = useOutlet();
  const [sub, setSub] = useState<any>(null);
  const [state, setState] = useState('Loading your subscription...');
  useEffect(() => {
    fetch('/api/subscriptions').then(async r => { const d = await r.json(); if (!r.ok || !d.success) throw new Error(); setSub(d.subscription); setState(''); }).catch(() => setState('Subscription details could not be loaded. Try again from the menu.'));
  }, []);
  const known = SUBSCRIPTION_PLANS.some(plan => plan.code === sub?.plan?.code);
  return <div className="mx-auto max-w-4xl"><h1 className="text-2xl font-black text-slate-900">Subscription & upgrades</h1>
    {state && <p role="status" className="mt-4 text-sm text-slate-600">{state}</p>}
    {sub && <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-5"><p className="text-xs font-bold uppercase text-emerald-800">Account status: {sub.status}</p><h2 className="mt-2 text-lg font-bold text-stone-900">{known ? sub.plan.name : 'Legacy plan - billing review needed'}</h2><p className="mt-2 text-sm text-stone-600">Autopay is not connected. No renewal charge or upgrade is created by this page. {known ? '' : 'Your existing access is unchanged; old seed pricing is not a new billing offer.'}</p></section>}
    <PlanCards account canRequest={user?.role === 'OWNER'} currentCode={known ? sub?.plan?.code : undefined} />
  </div>;
}
