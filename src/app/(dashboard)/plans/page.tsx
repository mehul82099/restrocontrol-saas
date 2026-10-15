'use client';
import { useEffect, useState } from 'react';
import PlanCards from '@/components/billing/PlanCards';
import { useOutlet } from '../layout';

export default function PlansPage() {
  const { user } = useOutlet();
  const [currentCode, setCurrentCode] = useState<string>();
  useEffect(() => { fetch('/api/subscriptions').then(r => r.json()).then(d => setCurrentCode(d.subscription?.plan?.code)).catch(() => {}); }, []);
  return <div className="mx-auto max-w-4xl"><h1 className="text-2xl font-black text-slate-900">Restaurant plans</h1><p className="mt-2 text-sm text-slate-600">14-day free trial. Two website choices, plus two upcoming app plans.</p><PlanCards account canRequest={user?.role === 'OWNER'} currentCode={currentCode} /><p className="mt-4 text-xs text-slate-500">Only the restaurant owner can request a plan change. Online payment is not active.</p></div>;
}
