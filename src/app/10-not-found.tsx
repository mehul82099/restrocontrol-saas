import Link from 'next/link';
import type { Metadata } from 'next';
import { Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Page not found | RestroControl',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f8f5ee] text-stone-800 flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/20">
          <Scale className="h-7 w-7" />
        </span>
        <h1 className="mt-6 text-3xl font-black tracking-tight text-stone-900">This page is not on the menu.</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          The link may be old or mistyped. Head back to RestroControl, or check the menu of pages below.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">
            Go to RestroControl
          </Link>
          <Link href="/pricing" className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50">
            View plans
          </Link>
        </div>
        <nav aria-label="Helpful pages" className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-emerald-800">
          <Link href="/about" className="hover:underline">About us</Link>
          <Link href="/contact" className="hover:underline">Contact us</Link>
          <Link href="/login" className="hover:underline">Sign in</Link>
          <Link href="/signup" className="hover:underline">Free trial</Link>
        </nav>
      </div>
    </main>
  );
}
