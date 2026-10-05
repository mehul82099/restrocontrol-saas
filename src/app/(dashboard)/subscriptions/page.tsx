'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  Zap,
  Building2,
  Users,
  Receipt,
  Layers,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  code: string;
  priceMonthly: number;
  maxOutlets: number;
  maxUsers: number;
  maxOrdersPerMonth: number;
  features: string[];
}

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    plan: Plan;
  };
  limits: {
    outlets: { current: number; max: number };
    users: { current: number; max: number };
    ordersThisMonth: { current: number; max: number };
  };
}

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/subscriptions');
      const json = await res.json();
      if (json.success) {
        setData(json.subscription);
        setPlans(json.plans);
      }
    } catch (err) {
      console.error('Failed to load subscription', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const handleSwitchPlan = async (planCode: string) => {
    try {
      setUpgrading(true);
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) throw new Error(resData.error || 'Failed to update plan');

      alert(`Subscription successfully changed to ${planCode}!`);
      await fetchSubscription();
    } catch (err: any) {
      alert(err.message || 'Error updating subscription');
    } finally {
      setUpgrading(false);
    }
  };

  const currentPlan = data?.subscription?.plan;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-emerald-600" />
            SaaS Subscription & Plan Quotas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your restaurant tier, outlet quotas, user seat capacity, and automated billing
          </p>
        </div>
      </div>

      {/* Current Subscription Card */}
      {data && currentPlan && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-lg border border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800">
                  Current Plan
                </span>
                <Badge variant="success">ACTIVE</Badge>
              </div>
              <h2 className="text-3xl font-black tracking-tight">{currentPlan.name} Tier</h2>
              <p className="text-sm text-slate-300 mt-1">
                Renewing on <strong className="text-white">{formatDate(data.subscription.currentPeriodEnd)}</strong>{' '}
                at <strong className="text-emerald-400">{formatCurrency(currentPlan.priceMonthly)}/month</strong>
              </p>
            </div>

            {/* Quota Meters */}
            <div className="grid grid-cols-3 gap-4 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Outlets</span>
                <span className="text-lg font-bold font-mono">
                  {data.limits.outlets.current} / {data.limits.outlets.max >= 999 ? '∞' : data.limits.outlets.max}
                </span>
                <div className="w-full bg-slate-700 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (data.limits.outlets.current / (data.limits.outlets.max || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Staff Users</span>
                <span className="text-lg font-bold font-mono">
                  {data.limits.users.current} / {data.limits.users.max >= 999 ? '∞' : data.limits.users.max}
                </span>
                <div className="w-full bg-slate-700 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-400 h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (data.limits.users.current / (data.limits.users.max || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Orders / Mo</span>
                <span className="text-lg font-bold font-mono">
                  {data.limits.ordersThisMonth.current} /{' '}
                  {data.limits.ordersThisMonth.max >= 9999 ? '∞' : data.limits.ordersThisMonth.max}
                </span>
                <div className="w-full bg-slate-700 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (data.limits.ordersThisMonth.current /
                          (data.limits.ordersThisMonth.max || 1)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans Tier Comparison Grid */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Available SaaS Subscription Plans</h3>
          <p className="text-xs text-slate-500">Pick a plan matching your scale and branch expansion requirements</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((p) => {
            const isCurrent = currentPlan?.code === p.code;

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition-all shadow-xs relative ${
                  isCurrent
                    ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 right-4 bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs">
                    Active Plan
                  </span>
                )}

                <div>
                  <h4 className="text-lg font-bold text-slate-900">{p.name}</h4>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">{formatCurrency(p.priceMonthly)}</span>
                    <span className="text-xs text-slate-400 font-medium">/ month</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>{p.maxOutlets >= 999 ? 'Unlimited' : p.maxOutlets}</strong> Outlets
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>
                        <strong>{p.maxUsers >= 999 ? 'Unlimited' : p.maxUsers}</strong> User Seats
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>{p.maxOrdersPerMonth >= 9999 ? 'Unlimited' : p.maxOrdersPerMonth.toLocaleString()}</strong> Orders/Mo
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Included Capabilities
                    </span>
                    {(p.features || [
                      'Touchscreen POS Terminal',
                      'Automated Recipe Deduction',
                      'Variance Analytics Engine',
                      'Kitchen Display System (KDS)',
                      'Wastage & Physical Audits',
                    ]).map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-default"
                    >
                      Currently Active
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSwitchPlan(p.code)}
                      disabled={upgrading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Switch to {p.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
