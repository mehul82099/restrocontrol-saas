'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Scale, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('owner@demokitchen.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // Route according to primary role
      if (data.user.role === 'CASHIER') {
        router.push('/pos');
      } else if (data.user.role === 'KITCHEN_STAFF') {
        router.push('/kot');
      } else if (data.user.role === 'INVENTORY_MANAGER') {
        router.push('/inventory');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoRole = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-950/50 mb-3">
            <Scale className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Restro<span className="text-emerald-400">Control</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Inventory-First Restaurant POS & Management SaaS
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 font-medium">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@demokitchen.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-5">
          New restaurant?{' '}
          <Link href="/signup" className="text-emerald-400 font-bold hover:underline">Start a 14-day free trial</Link>
        </p>

        {/* 1-Click Demo Accounts */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">
            Quick 1-Click Demo Logins
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setDemoRole('owner@demokitchen.com')}
              className={`p-2 rounded-xl border text-left transition-colors ${
                email === 'owner@demokitchen.com'
                  ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300 font-bold'
                  : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white'
              }`}
            >
              👑 Owner
            </button>
            <button
              type="button"
              onClick={() => setDemoRole('manager@demokitchen.com')}
              className={`p-2 rounded-xl border text-left transition-colors ${
                email === 'manager@demokitchen.com'
                  ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300 font-bold'
                  : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white'
              }`}
            >
              👔 Manager
            </button>
            <button
              type="button"
              onClick={() => setDemoRole('cashier@demokitchen.com')}
              className={`p-2 rounded-xl border text-left transition-colors ${
                email === 'cashier@demokitchen.com'
                  ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300 font-bold'
                  : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white'
              }`}
            >
              💵 Cashier (POS)
            </button>
            <button
              type="button"
              onClick={() => setDemoRole('kitchen@demokitchen.com')}
              className={`p-2 rounded-xl border text-left transition-colors ${
                email === 'kitchen@demokitchen.com'
                  ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300 font-bold'
                  : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white'
              }`}
            >
              👨‍🍳 Kitchen (KDS)
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDemoRole('inventory@demokitchen.com')}
            className={`w-full mt-2 p-2 rounded-xl border text-center transition-colors text-xs ${
              email === 'inventory@demokitchen.com'
                ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300 font-bold'
                : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white'
            }`}
          >
            📦 Inventory Manager
          </button>
        </div>
      </div>
    </div>
  );
}
