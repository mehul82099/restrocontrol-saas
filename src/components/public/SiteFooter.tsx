import Link from 'next/link';

export const publicLinks = [
  ['Pricing', '/pricing'], ['About us', '/about'], ['Contact us', '/contact'],
  ['Terms of service', '/terms'], ['Privacy policy', '/privacy'],
  ['Cancellation & refunds', '/refunds'], ['Digital delivery', '/shipping'],
] as const;

export default function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-[rgba(59,29,18,.16)] bg-[#f7ead9] text-[#7a5138]">
      <div className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:justify-between">
          <div>
            <Link href="/" className="font-display text-lg font-bold text-[#3b1d12]">Restro<em className="italic text-[#c0392b]">Control</em></Link>
            <p className="mt-1 text-sm">Restaurant management by Mystify me.</p>
          </div>
          <nav aria-label="Business and policy pages" className="flex max-w-2xl flex-wrap gap-x-5 gap-y-3 text-sm">
            {publicLinks.map(([label, href]) => <Link key={href} href={href} className="rounded underline-offset-4 hover:text-[#c0392b] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c0392b]">{label}</Link>)}
          </nav>
        </div>
        <div aria-hidden="true" className="pointer-events-none select-none mt-8 text-center font-display font-bold leading-none tracking-[-2px] text-transparent text-[clamp(2.5rem,9vw,6rem)] [-webkit-text-stroke:1.2px_#c0392b] opacity-85">
          restrocontrol
        </div>
        <p className="mt-4 text-center text-[13px] text-[#7a5138]">14-day free trial · {'\u20B9'}499 + GST/month · No card needed</p>
        <p className="mt-3 pb-8 text-center text-xs text-[#a98a70]">© 2026 Mystify me, Jaipur, Rajasthan, India.</p>
      </div>
    </footer>
  );
}
