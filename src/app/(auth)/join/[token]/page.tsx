'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import WorldAuthShell from '@/components/world/WorldAuthShell';
import { Scale, ArrowRight } from 'lucide-react';

const inputClass =
  'w-full px-4 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-stone-400';
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5';
const ROLE_LABEL: Record<string, string> = { CASHIER: 'Cashier', KITCHEN_STAFF: 'Kitchen staff', WAITER: 'Waiter' };

export default function JoinPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<{ restaurantName: string; role: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/auth/invite/preview?token=${encodeURIComponent(token)}`).then(async (r) => {
      const d = await r.json();
      if (r.ok && d.success) setInfo(d); else setInvalid(true);
    }).catch(() => setInvalid(true));
    fetch('/api/auth/providers').then(r => r.json()).then(d => setGoogleOn(!!d.google)).catch(() => {});
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/invite/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, name, email, password }) });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || 'Sign-up failed.');
      router.push(d.redirect || '/');
    } catch (err: any) {
      setError(err.message || 'Sign-up failed.');
    } finally { setLoading(false); }
  };

  return (
    <WorldAuthShell>
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-xl shadow-emerald-950/50 mb-3">
          <Scale className="w-7 h-7" />
        </div>
        {invalid ? (
          <>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Invite not valid</h1>
            <p className="text-sm text-stone-500 mt-2">This invite link is invalid, expired or already used. Ask your manager for a new link.</p>
          </>
        ) : info ? (
          <>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Join <span className="text-emerald-600">{info.restaurantName}</span></h1>
            <p className="text-xs text-stone-500 font-medium mt-1">You are joining as {ROLE_LABEL[info.role] || info.role}. This link works once.</p>
          </>
        ) : <p className="text-sm text-stone-500">Checking invite...</p>}
      </div>
      {info && (
        <>
          {error && <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">{error}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div><label className={labelClass}>Your name</label><input className={inputClass} required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className={labelClass}>Email address</label><input type="email" className={inputClass} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div>
              <label className={labelClass}>Password</label>
              <input type="password" className={inputClass} required minLength={10} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-[11px] text-stone-500 mt-1">At least 10 characters, with a letter and a number.</p>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (<><span>Join the team</span><ArrowRight className="w-4 h-4" /></>)}
            </button>
          </form>
          {googleOn && (
            <div className="mt-5 pt-5 border-t border-stone-200">
              <a href={`/api/auth/google/start?mode=invite&invite=${encodeURIComponent(token)}`} className="w-full py-3 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all">
                <span>Continue with Google</span>
              </a>
            </div>
          )}
        </>
      )}
    </WorldAuthShell>
  );
}
