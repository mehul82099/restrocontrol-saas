'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import WorldAuthShell from '@/components/world/WorldAuthShell';
import { Scale, Mail, ArrowRight } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setDone(true);
    setLoading(false);
  };

  return (
    <WorldAuthShell>
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-950/50 mb-3">
          <Scale className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">
          Restro<span className="text-emerald-600">Control</span>
        </h1>
        <p className="text-xs text-stone-500 font-medium mt-1">Reset your password</p>
      </div>

      {done ? (
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium">
            If this email has an account, a reset link is on its way. The link works for 30 minutes.
          </div>
          <p className="text-xs text-stone-500 text-center">
            <Link href="/login" className="text-emerald-600 font-bold hover:underline">Back to sign in</Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@restaurant.com"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-stone-400"
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
                <span>Send reset link</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="text-xs text-stone-500 text-center">
            Remembered it?{' '}
            <Link href="/login" className="text-emerald-600 font-bold hover:underline">Sign in</Link>
          </p>
        </form>
      )}
    </WorldAuthShell>
  );
}
