import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import SiteFooter from '@/components/public/SiteFooter';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, OG_IMAGE } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'RestroControl | Restaurant POS + Inventory Management',
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    siteName: SITE_NAME,
    title: 'RestroControl | Restaurant POS + Inventory Management',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'RestroControl - your restaurant, under control' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RestroControl | Restaurant POS + Inventory Management',
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const FEATURES: { title: string; text: string }[] = [
  { title: 'POS billing', text: 'Point of sale for dine-in, takeaway and delivery, with orders and bills in one place.' },
  { title: 'Kitchen display (KDS)', text: 'Incoming orders appear live in the kitchen so preparation starts without printed tickets.' },
  { title: 'Recipe costing', text: 'Every dish sold computes and deducts its raw ingredient portions from inventory automatically.' },
  { title: 'Inventory and variance', text: 'Live stock ledger compares expected ingredient use with recorded stock movements and shows the gap.' },
  { title: 'Wastage, audits and purchases', text: 'Spoilage logging with manager review, physical stock audits, purchase orders and supplier records.' },
  { title: 'Reports and staff roles', text: 'Exportable business reports and role-based accounts for owners, managers, cashiers, kitchen and inventory staff.' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How much does RestroControl cost?',
    a: 'Website plans are Rs 499 per month + 18% GST (Rs 588.82 total) for one outlet, or Rs 699 per month + 18% GST (Rs 824.82 total) for unlimited outlets. Both include unlimited staff and orders. App + website plans are upcoming.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. New restaurant signups start with a 14-day free trial. No card is requested at signup.',
  },
  {
    q: 'Who is RestroControl for?',
    a: 'Restaurant owners and their teams, including small cafes and quick-service restaurants, who want POS billing, kitchen display, recipe costing, stock tracking and reports in one application, with role-based staff accounts.',
  },
  {
    q: 'What is the refund policy?',
    a: 'If you are dissatisfied, we offer an 80% refund when you request it within 7 days of a payment. It applies to the latest payment only, with a separate 7-day window per payment. A feedback form must be submitted first, and the refund is issued within 24 hours of form submission.',
  },
];

// The site name is separate from the legal/business Organization name.
// Google supports site names for subdomains, including the current Vercel URL.
const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: 'Restro Control',
  url: `${SITE_URL}/`,
};

const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Mystify me',
  brand: 'RestroControl',
  url: SITE_URL,
  email: 'mehuljhabak10@gmail.com',
  telephone: '+918209951190',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'B-297, Janta Colony, Adarsh Nagar',
    addressLocality: 'Jaipur',
    addressRegion: 'Rajasthan',
    postalCode: '302004',
    addressCountry: 'IN',
  },
};

const softwareLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'RestroControl',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web browser',
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  offers: [
    { '@type': 'Offer', name: 'Website plan - 1 outlet', priceCurrency: 'INR', price: '588.82', description: 'Rs 499 + 18% GST per month, one outlet, unlimited staff and orders' },
    { '@type': 'Offer', name: 'Website plan - unlimited outlets', priceCurrency: 'INR', price: '824.82', description: 'Rs 699 + 18% GST per month, unlimited outlets, staff and orders' },
  ],
};

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

function Cta({ href, children, primary = true }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[#c0392b] hover:bg-[#a32f23] text-[#fff8ee] font-bold text-[15px] shadow-[0_14px_34px_rgba(59,29,18,.14)]'
          : 'inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-transparent text-[#3b1d12] font-bold text-[15px] border-[1.5px] border-[rgba(59,29,18,.16)]'
      }
    >
      {children}
    </Link>
  );
}

const STATS: { label: string; value: string; accent?: boolean }[] = [
  { label: 'Free trial', value: '14 days' },
  { label: 'Plans from', value: '\u20B9499 + GST/mo', accent: true },
  { label: 'Staff roles', value: '5' },
  { label: 'Card at signup', value: 'None' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7ead9] text-[#3b1d12] selection:bg-emerald-600 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* Nav */}
      <nav className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-[rgba(59,29,18,.16)]">
        <Link href="/" className="font-display font-bold text-[19px] tracking-tight">
          Restro<em className="italic text-[#c0392b]">Control</em>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="hidden sm:block text-[13px] font-semibold text-[#7a5138] hover:text-[#3b1d12]">Pricing</Link>
          <Link href="/login" className="hidden sm:block text-[13px] font-semibold text-[#7a5138] hover:text-[#3b1d12]">Sign in</Link>
          <Link href="/signup" className="rounded-full bg-[#c0392b] hover:bg-[#a32f23] text-[#fff8ee] text-[13px] font-bold px-4 py-2">Free trial</Link>
        </div>
      </nav>

      <main id="main-content">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 pt-16 pb-12 sm:pt-24 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[3px] text-[#c0392b]">Restaurant POS + Inventory</p>
          <h1 className="font-display mt-4 font-medium leading-[1.02] tracking-tight text-[clamp(2.5rem,7vw,4.5rem)]">
            Your restaurant,<br className="hidden sm:block" /> <span className="italic text-[#c0392b]">under control.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[420px] text-[15px] leading-relaxed text-[#7a5138]">
            Know what you sold, what it should have used, what it actually used, and where the gap is.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Cta href="/signup">Start 14-day free trial</Cta>
            <Cta href="/login" primary={false}>Sign in</Cta>
          </div>
          <p className="mt-3.5 text-xs text-[#7a5138]">No card needed. Made for small cafes and QSRs.</p>
        </section>

        {/* Quick facts */}
        <section aria-label="Quick facts" className="mx-auto grid max-w-[760px] grid-cols-2 gap-2.5 px-6 pb-12 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-[14px] border border-[rgba(59,29,18,.16)] bg-[#fff8ee] px-3.5 py-3">
              <span className="block text-[10px] font-semibold uppercase tracking-[1.5px] text-[#7a5138]">{s.label}</span>
              <b className={`mt-1 block text-lg sm:text-[22px] font-bold ${s.accent ? 'text-[#c0392b]' : 'text-[#3b1d12]'}`}>{s.value}</b>
            </div>
          ))}
        </section>

        {/* What it is */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="font-display text-2xl sm:text-4xl font-medium tracking-tight">What is RestroControl?</h2>
          <p className="mt-4 max-w-3xl leading-7 text-[15px] text-[#7a5138]">
            RestroControl is restaurant-management software from Mystify me. It brings POS, orders, kitchen display,
            recipe costing, stock tracking, purchases and reports into one browser-based application, so daily
            operations and ingredient costs stay visible in one place.
          </p>
        </section>

        {/* Who it is for */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="font-display text-2xl sm:text-4xl font-medium tracking-tight">Who is it for?</h2>
          <p className="mt-4 max-w-3xl leading-7 text-[15px] text-[#7a5138]">
            Restaurant owners and their teams, including small cafes and quick-service restaurants. Role-based
            accounts let owners, managers, cashiers, kitchen staff and inventory managers each see the tools for
            their job, and compare expected ingredient use with recorded stock movements.
          </p>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="font-display text-2xl sm:text-4xl font-medium tracking-tight">Everything from counter to kitchen</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-[22px] border border-[rgba(59,29,18,.16)] bg-[#fff8ee] p-5 shadow-[0_14px_34px_rgba(59,29,18,.14)]">
                <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#3b1d12]">
                  <CheckCircle2 className="w-4 h-4 text-[#c0392b] shrink-0" /> {f.title}
                </h3>
                <p className="mt-2 text-[13px] leading-6 text-[#7a5138]">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="font-display text-2xl sm:text-4xl font-medium tracking-tight">Simple pricing, GST shown upfront</h2>
          <p className="mt-4 max-w-3xl leading-7 text-[15px] text-[#7a5138]">
            Website plans start at Rs 499 + 18% GST per month (Rs 588.82 total) for one outlet, or Rs 699 + 18% GST
            (Rs 824.82 total) for unlimited outlets. Both include unlimited staff and orders. Start with a 14-day
            free trial - no card needed.
          </p>
          <div className="mt-5"><Cta href="/pricing">Compare plans <ArrowRight className="w-4 h-4" /></Cta></div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="font-display text-2xl sm:text-4xl font-medium tracking-tight">Frequently asked questions</h2>
          <div className="mt-6 space-y-4 max-w-3xl">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-[22px] border border-[rgba(59,29,18,.16)] bg-[#fff8ee] p-5">
                <summary className="cursor-pointer text-[15px] font-bold text-[#3b1d12]">{f.q}</summary>
                <p className="mt-3 text-[13px] leading-6 text-[#7a5138]">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
