'use client';

import React from 'react';
import Link from 'next/link';
import { Scale, CheckCircle2, ArrowRight } from 'lucide-react';
import MiniRestaurant from './MiniRestaurant';

const FEATURES = [
  'POS, orders and kitchen display',
  'Recipe costing and inventory ledger',
  'Expected vs actual stock variance',
  'Wastage, stock audits and purchases',
  'All reports',
  'Staff accounts with roles',
];

const CHIPS = [
  { text: 'Order #128 sent to kitchen', cls: 'left-[4%] top-[34%]', delay: '0s' },
  { text: 'Low stock alert: tomatoes', cls: 'right-[4%] top-[14%]', delay: '3s' },
  { text: 'Stock count approved', cls: 'left-[8%] bottom-[22%]', delay: '6s' },
  { text: 'Variance report ready', cls: 'right-[8%] bottom-[26%]', delay: '9s' },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50">
        <Scale className="w-5 h-5" />
      </span>
      <span className="text-lg font-black text-white tracking-tight">
        Restro<span className="text-emerald-400">Control</span>
      </span>
    </Link>
  );
}

export default function LandingSvg() {
  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 selection:bg-emerald-500 selection:text-white overflow-x-hidden">
      <style>{`
        @keyframes rcChip { 0%{opacity:0;transform:translateY(8px)} 6%{opacity:1;transform:translateY(0)} 22%{opacity:1;transform:translateY(-4px)} 28%,100%{opacity:0;transform:translateY(-10px)} }
        @keyframes rcSign { 0%,100%{box-shadow:0 0 18px rgba(52,211,153,.45)} 50%{box-shadow:0 0 30px rgba(52,211,153,.8)} }
        .rc-chip{animation:rcChip 12s ease-in-out infinite;opacity:0}
        .rc-sign{animation:rcSign 3.2s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.rc-chip{animation:none;opacity:1}.rc-sign{animation:none}}
      `}</style>

      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-8 py-4">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-3 text-sm">
          <Link href="/login" className="px-3 py-2 text-slate-300 hover:text-white font-semibold">Sign in</Link>
          <Link href="/signup" className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-950/50">Free trial</Link>
        </nav>
      </header>

      {/* Hero: the miniature world */}
      <section className="relative min-h-[100svh] flex flex-col lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_55%,rgba(245,158,11,.14),transparent_60%)]" />
        <div className="relative z-20 pt-24 sm:pt-28 px-5 sm:px-8 lg:absolute lg:left-12 lg:top-1/2 lg:-translate-y-[55%] lg:max-w-md xl:max-w-lg lg:pt-0">
          <p className="inline-block text-[11px] font-bold uppercase tracking-[.2em] text-amber-300/90 mb-3">Restaurant POS + inventory</p>
          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight leading-[1.05] text-white">
            Your restaurant,<br /><span className="text-emerald-400">under control.</span>
          </h1>
          <p className="mt-4 text-slate-300/90 text-sm sm:text-base leading-relaxed">
            Know what you sold, what the recipes should have used, what was actually used, and where the gap is.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link href="/signup" className="rc-sign inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm border-2 border-emerald-300/60">
              Start 14-day free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#plan" className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-slate-900/70 backdrop-blur border border-amber-400/50 text-amber-200 font-bold text-sm hover:bg-slate-800/80">
              ₹499 / month, one plan
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-400">No card needed to start.</p>
        </div>

        <div className="relative lg:absolute lg:inset-y-0 lg:right-0 lg:w-[68%] mt-6 lg:mt-0 flex-1 min-h-[340px]">
          <div className="absolute inset-0" style={{ filter: 'saturate(1.2) contrast(1.05)' }}>
            <MiniRestaurant className="w-full h-full" />
          </div>
          {/* tilt-shift: blur the top and bottom bands */}
          <div className="absolute inset-x-0 top-0 h-[22%] pointer-events-none" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', WebkitMaskImage: 'linear-gradient(to bottom,#000,transparent)', maskImage: 'linear-gradient(to bottom,#000,transparent)' }} />
          <div className="absolute inset-x-0 bottom-0 h-[24%] pointer-events-none" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', WebkitMaskImage: 'linear-gradient(to top,#000,transparent)', maskImage: 'linear-gradient(to top,#000,transparent)' }} />
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_55%,#070b12_100%)]" />
          <div className="absolute inset-y-0 left-0 w-16 pointer-events-none bg-gradient-to-r from-[#070b12] to-transparent hidden lg:block" />
          {CHIPS.map((c) => (
            <div key={c.text} className={`rc-chip absolute ${c.cls} px-3 py-1.5 rounded-full bg-slate-900/85 border border-emerald-400/40 text-[11px] sm:text-xs font-semibold text-emerald-200 shadow-lg whitespace-nowrap`} style={{ animationDelay: c.delay }}>
              {c.text}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-5 sm:px-8 py-14 max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black text-white">Everything the little restaurant needs</h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <div key={f} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-sm font-semibold text-slate-200">{f}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Plan */}
      <section id="plan" className="px-5 sm:px-8 pb-20 max-w-5xl mx-auto">
        <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-b from-slate-900 to-slate-950 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">One plan</p>
            <p className="mt-1 text-4xl font-black text-white">₹499<span className="text-base font-semibold text-slate-400"> / month per restaurant</span></p>
            <p className="mt-2 text-sm text-slate-400">Everything included. Start with a 14-day free trial, no card needed.</p>
          </div>
          <Link href="/signup" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm">
            Start free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <p className="mt-8 text-center text-xs text-slate-500">
          Already have an account? <Link href="/login" className="text-emerald-400 font-bold">Sign in</Link>
        </p>
      </section>
    </div>
  );
}
