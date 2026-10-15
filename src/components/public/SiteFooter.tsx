import Link from 'next/link';

export const publicLinks = [
  ['Pricing', '/pricing'], ['About us', '/about'], ['Contact us', '/contact'],
  ['Terms of service', '/terms'], ['Privacy policy', '/privacy'],
  ['Cancellation & refunds', '/refunds'], ['Digital delivery', '/shipping'],
] as const;

export default function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-stone-200 bg-[#f8f5ee] text-stone-700">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:justify-between">
          <div><Link href="/" className="text-lg font-black text-emerald-800">RestroControl</Link>
            <p className="mt-1 text-sm">Restaurant management by Mystify me.</p></div>
          <nav aria-label="Business and policy pages" className="flex max-w-2xl flex-wrap gap-x-5 gap-y-3 text-sm">
            {publicLinks.map(([label, href]) => <Link key={href} href={href} className="rounded underline-offset-4 hover:text-emerald-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">{label}</Link>)}
          </nav>
        </div>
        <p className="mt-6 text-xs text-stone-500">Policy preview for review. Commercial terms are not final and online subscription checkout is not enabled by these pages.</p>
      </div>
    </footer>
  );
}
