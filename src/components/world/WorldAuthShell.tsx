'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Scale } from 'lucide-react';

const Scene3D = dynamic(() => import('./Scene3D'), { ssr: false });

export default function WorldAuthShell({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = React.useState(false);
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    setReduced(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    setMobile(window.matchMedia?.('(max-width: 768px)').matches ?? false);
  }, []);
  return (
    <div className="relative min-h-screen bg-[#f3ede0] overflow-hidden selection:bg-emerald-500 selection:text-white">
      <div className="fixed inset-0" style={{ filter: 'blur(1.5px)' }}>
        <Scene3D stop="overview" reduced={reduced} mobile={mobile} />
      </div>
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(243,237,224,.35),rgba(243,237,224,.88)_85%)]" />
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 py-10">
        <Link href="/" className="mb-5 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/20"><Scale className="w-5 h-5" /></span>
          <span className="text-lg font-black tracking-tight text-stone-900">Restro<span className="text-emerald-600">Control</span></span>
        </Link>
        <div className="w-full max-w-md bg-white/92 backdrop-blur-md border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-stone-900/15 text-stone-900">
          {children}
        </div>
      </div>
    </div>
  );
}
