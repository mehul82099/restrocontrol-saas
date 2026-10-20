import React from 'react';
import Link from 'next/link';

// Tapri Warm auth shell: cream page, serif wordmark, one warm card.
export default function WorldAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7ead9] text-[#3b1d12] selection:bg-emerald-600 selection:text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(192,57,43,.08),transparent_55%)]"
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4 py-10">
        <Link href="/" className="mb-5 font-display text-[22px] font-bold tracking-tight">
          Restro<em className="italic text-[#c0392b]">Control</em>
        </Link>
        <div className="w-full max-w-md rounded-[22px] border border-[rgba(59,29,18,.16)] bg-[#fff8ee] p-6 shadow-[0_14px_34px_rgba(59,29,18,.14)] sm:p-8">
          {children}
        </div>
        <p className="mt-5 text-xs text-[#7a5138]">14-day free trial · {'\u20B9'}499 + GST/month · No card needed</p>
      </div>
    </div>
  );
}
