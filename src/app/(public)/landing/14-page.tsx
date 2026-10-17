import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Landing from '@/components/world/Landing';
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
    a: 'The draft policy is an 80% refund if you are dissatisfied and request it within 7 days of a payment. It applies to the latest payment only, with a separate 7-day window per payment. A feedback form must be submitted first, and the refund is issued within 24 hours of form submission.',
  },
];

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
          ? 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-900/20'
          : 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-stone-50 text-emerald-800 font-bold text-sm border border-emerald-600/30'
      }
    >
      {children}
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-[#f3ede0] text-stone-900 selection:bg-emerald-500 selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* Interactive 3D walkthrough (client enhancement) */}
      <Landing withFooter={false} />

      <main id="main-content">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-10 sm:px-8 sm:pt-20">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-700">Restaurant POS + inventory</p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight text-stone-900 leading-[1.08]">
            Your restaurant, <span className="text-emerald-600">under control.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-stone-600">
            Know what you sold, what the recipes should have used, what was actually used, and where the gap is.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <Cta href="/signup">Start 14-day free trial <ArrowRight className="w-4 h-4" /></Cta>
            <Cta href="/login" primary={false}>Sign in</Cta>
          </div>
          <p className="mt-2 text-xs text-stone-500">No card needed.</p>
        </section>

        {/* What it is */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">What is RestroControl?</h2>
          <p className="mt-4 max-w-3xl leading-7 text-stone-600">
            RestroControl is restaurant-management software from Mystify me. It brings POS, orders, kitchen display,
            recipe costing, stock tracking, purchases and reports into one browser-based application, so daily
            operations and ingredient costs stay visible in one place.
          </p>
        </section>

        {/* Who it is for */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">Who is it for?</h2>
          <p className="mt-4 max-w-3xl leading-7 text-stone-600">
            Restaurant owners and their teams, including small cafes and quick-service restaurants. Role-based
            accounts let owners, managers, cashiers, kitchen staff and inventory managers each see the tools for
            their job, and compare expected ingredient use with recorded stock movements.
          </p>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">Everything from counter to kitchen</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-stone-200 bg-white/80 p-5">
                <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> {f.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">Simple pricing, GST shown upfront</h2>
          <p className="mt-4 max-w-3xl leading-7 text-stone-600">
            Website plans start at Rs 499 + 18% GST per month (Rs 588.82 total) for one outlet, or Rs 699 + 18% GST
            (Rs 824.82 total) for unlimited outlets. Both include unlimited staff and orders. Start with a 14-day
            free trial - no card needed.
          </p>
          <div className="mt-5"><Cta href="/pricing">Compare plans <ArrowRight className="w-4 h-4" /></Cta></div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">Frequently asked questions</h2>
          <div className="mt-6 space-y-4 max-w-3xl">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-2xl border border-stone-200 bg-white/80 p-5">
                <summary className="cursor-pointer text-base font-bold text-stone-900">{f.q}</summary>
                <p className="mt-3 text-sm leading-6 text-stone-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
