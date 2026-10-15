'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import WorldAuthShell from '@/components/world/WorldAuthShell';
import { Scale, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleOn, setGoogleOn] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    const messages: Record<string, string> = {
      google_unavailable: 'Google sign-in is not available yet. Use your email and password.',
      google_no_account: 'No RestroControl account uses this Google email. Start a free trial first, or sign in with email.',
      invite_invalid: 'This invite link is invalid, expired or already used. Ask your manager for a new one.',
      invite_email_exists: 'This Google email already has an account. Sign in instead, or ask your manager.',
      already_registered: 'This email is already registered. Sign in with Google or your email and password.',
      google_failed: 'Google sign-in could not be completed. Please try again or use your email.',
    };
    if (code && messages[code]) setError(messages[code]);
    fetch('/api/auth/providers').then(r => r.json()).then(d => setGoogleOn(!!d.google)).catch(() => {});
  }, []);

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
      if (data.user.role === 'WAITER') {
        router.push('/pos');
      } else if (data.user.role === 'CASHIER') {
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

  return (
    <WorldAuthShell>
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-950/50 mb-3">
            <Scale className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Restro<span className="text-emerald-600">Control</span>
          </h1>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Inventory-First Restaurant POS & Management SaaS
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
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

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-stone-500 text-center mt-5">
          New restaurant?{' '}
          <Link href="/signup" className="text-emerald-600 font-bold hover:underline">Start a 14-day free trial</Link>
        </p>

        {googleOn && (
          <div className="mt-6 pt-5 border-t border-stone-200">
            <a
              href="/api/auth/google/start"
              className="w-full py-3 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
              <span>Continue with Google</span>
            </a>
          </div>
        )}
    </WorldAuthShell>
  );
}
