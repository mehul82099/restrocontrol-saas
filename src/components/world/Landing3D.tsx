'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Scale, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { StopId } from './Scene3D';

const Scene3D = dynamic(() => import('./Scene3D'), { ssr: false });

const TABS: { id: StopId; label: string; short: string }[] = [
  { id: 'overview', label: 'Overview', short: 'Overview' },
  { id: 'booth', label: 'From a booth', short: 'Booth' },
  { id: 'counter', label: 'Counter', short: 'Counter' },
  { id: 'kitchen', label: 'Kitchen', short: 'Kitchen' },
  { id: 'street', label: 'Street', short: 'Street' },
];

function Cta({ href, children, primary = true }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-900/20'
          : 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-stone-50 text-emerald-800 font-bold text-sm border border-emerald-600/30'
      }
    >
      {children}
    </Link>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2 text-sm text-stone-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {t}
        </li>
      ))}
    </ul>
  );
}

function Panel({ stop }: { stop: StopId }) {
  switch (stop) {
    case 'overview':
      return (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-700">Restaurant POS + inventory</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-stone-900 leading-[1.05]">Your restaurant,<br /><span className="text-emerald-600">under control.</span></h1>
          <p className="mt-3 text-sm text-stone-600">Know what you sold, what the recipes should have used, what was actually used, and where the gap is.</p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <Cta href="/signup">Start 14-day free trial <ArrowRight className="w-4 h-4" /></Cta>
            <Cta href="/login" primary={false}>Sign in</Cta>
          </div>
          <p className="mt-2 text-xs text-stone-500">No card needed. Tap a spot below to look around.</p>
        </>
      );
    case 'booth':
      return (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-700">Website plans</p>
          <p className="mt-2 text-4xl font-black text-stone-900">From ₹499<span className="text-base font-semibold text-stone-500"> website plan</span></p>
          <p className="mt-2 text-sm text-stone-600">Website plans from ₹499. App access is upcoming. Start with a 14-day free trial, no card needed.</p>
          <div className="mt-4"><Cta href="/pricing">Compare plans <ArrowRight className="w-4 h-4" /></Cta></div>
        </>
      );
    case 'counter':
      return (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-700">At the counter</p>
          <h2 className="mt-2 text-2xl font-black text-stone-900">Sell fast</h2>
          <List items={['POS for dine-in, takeaway and delivery', 'Orders and bills in one place', 'Staff accounts with roles']} />
        </>
      );
    case 'kitchen':
      return (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-700">In the kitchen</p>
          <h2 className="mt-2 text-2xl font-black text-stone-900">Know every ingredient</h2>
          <List items={['Kitchen display for incoming orders', 'Recipe costing and inventory ledger', 'Expected vs actual stock variance', 'Wastage, stock audits and purchases']} />
        </>
      );
    case 'street':
      return (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-700">Come on in</p>
          <h2 className="mt-2 text-2xl font-black text-stone-900">Open your restaurant on RestroControl</h2>
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <Cta href="/signup">Start 14-day free trial <ArrowRight className="w-4 h-4" /></Cta>
            <Cta href="/login" primary={false}>Sign in</Cta>
          </div>
        </>
      );
  }
}

export default function Landing3D() {
  const [stop, setStop] = useState<StopId>('overview');
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    setMobile(window.matchMedia?.('(max-width: 768px)').matches ?? false);
  }, []);

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-[#f3ede0] text-stone-900 selection:bg-emerald-500 selection:text-white">
      <div className="absolute inset-0">
        <Scene3D stop={stop} reduced={reduced} mobile={mobile} />
      </div>
      {/* tilt-shift: soft blur on the top and bottom edges */}
      <div className="absolute inset-x-0 top-0 h-[14%] pointer-events-none" style={{ backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', WebkitMaskImage: 'linear-gradient(to bottom,#000,transparent)', maskImage: 'linear-gradient(to bottom,#000,transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 h-[16%] pointer-events-none" style={{ backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', WebkitMaskImage: 'linear-gradient(to top,#000,transparent)', maskImage: 'linear-gradient(to top,#000,transparent)' }} />

      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-8 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/20"><Scale className="w-5 h-5" /></span>
          <span className="text-lg font-black tracking-tight text-stone-900">Restro<span className="text-emerald-600">Control</span></span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="px-3 py-2 font-semibold text-stone-700 hover:text-stone-900">Sign in</Link>
          <Link href="/signup" className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold">Free trial</Link>
        </nav>
      </header>

      {/* content for the current stop */}
      <div key={stop} className="absolute z-20 left-3 right-3 bottom-24 sm:left-10 sm:right-auto sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:w-[380px] rounded-3xl bg-white/90 backdrop-blur-md border border-stone-200 shadow-xl shadow-stone-900/10 p-5 sm:p-6 animate-[rcIn_.5s_ease-out]">
        <Panel stop={stop} />
      </div>

      {/* camera tabs */}
      <div className="absolute z-30 inset-x-0 bottom-5 flex justify-center px-3">
        <div role="tablist" aria-label="Look around the restaurant" className="flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 rounded-full bg-white/90 backdrop-blur border border-stone-200 shadow-lg max-w-full overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={stop === t.id}
              onClick={() => setStop(t.id)}
              className={`px-2.5 sm:px-4 py-2 rounded-full text-[13px] sm:text-sm font-bold whitespace-nowrap transition-colors ${stop === t.id ? 'bg-emerald-600 text-white' : 'text-stone-700 hover:bg-stone-100'}`}
            >
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <style>{`@keyframes rcIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}} @media (min-width:640px){[class*="rcIn"]{}}`}</style>
    </div>
  );
}
