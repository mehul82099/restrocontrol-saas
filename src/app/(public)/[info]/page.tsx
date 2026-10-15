import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PlanCards from '@/components/billing/PlanCards';
import SiteFooter, { publicLinks } from '@/components/public/SiteFooter';

const pages: Record<string, { title: string; intro: string; sections: { title: string; text: string }[] }> = {
  pricing: { title: 'Plans for your restaurant.', intro: 'Start with a 14-day free trial. Choose website access now, with app access coming later.', sections: [
    { title: 'Restaurant-management tools', text: 'POS, orders, kitchen display, recipe costing, inventory ledger, stock variance, wastage, purchases, stock audits, reports and staff roles.' },
    { title: '14-day free trial', text: 'New restaurant signups start with a 14-day trial. No card is requested at signup. When the trial ends, access is paused until the restaurant is activated on a paid plan.' },
    { title: 'Payment and renewal', text: 'Online subscription checkout is not enabled by this preview. Prices are per month. Automatic renewal is planned but not active. Any applicable tax treatment and the final amount payable must be confirmed before paid checkout launches. No payment is collected on this page.' },
  ] },
  about: { title: 'About RestroControl', intro: 'Restaurant operations, from the counter to the kitchen.', sections: [
    { title: 'What we build', text: 'RestroControl is restaurant-management software from Mystify me. It brings POS, orders, recipe costing, stock tracking, purchases and reports into one application.' },
    { title: 'Who it is for', text: 'Restaurant owners and their teams can use role-based accounts to manage day-to-day operations and compare expected ingredient use with recorded stock movements.' },
  ] },
  contact: { title: 'Contact us', intro: 'Questions about RestroControl, your account or a payment? Contact Mystify me.', sections: [
    { title: 'Account and payment queries', text: 'Include your restaurant name, registered email and a short description of the issue. For a payment issue, include the payment reference if available. Do not send passwords, card details or OTPs.' },
    { title: 'Support availability', text: 'Support hours and response-time commitments are still to be confirmed. This preview does not promise a support or resolution deadline.' },
  ] },
  terms: { title: 'Terms of service', intro: 'Draft terms for the RestroControl restaurant-management service. Not yet effective.', sections: [
    { title: 'Service and accounts', text: 'RestroControl provides restaurant-management tools, including POS, inventory and reporting. Use an account you are authorised to manage. Keep login details private and provide accurate account information.' },
    { title: 'Responsible use', text: 'Use the service lawfully. Do not attempt to access another restaurant’s data, bypass access controls, interfere with the service or upload unlawful material. Restaurant owners are responsible for the information they enter and the access they give their staff.' },
    { title: 'Trial and pricing', text: 'Four plans are shown on the pricing page: ₹499 for one outlet, ₹699 for two or more outlets, and upcoming app + website plans at ₹699 and ₹999. Prices are per month. Automatic renewal is planned but not active. Cancellation is intended to end access immediately. The selected dissatisfaction refund is 80% if requested within 7 days of payment; it applies only to the latest payment, with a separate 7-day window for each payment. Refund processing time remains pending. Both website plans include unlimited staff and orders; the ₹499 plan has one outlet and the ₹699 plan has unlimited outlets. Upgrade billing rules and tax treatment must be finalised before paid checkout is enabled.' },
    { title: 'Business records', text: 'Review bills, inventory entries and reports before relying on them for accounting or business decisions. The software does not replace professional accounting or legal advice.' },
    { title: 'Terms still requiring approval', text: 'Refund processing time, data retention and deletion, service suspension, liability terms, dispute handling and an effective date need owner review. No uptime, backup, security or compliance guarantee is made by this preview.' },
  ] },
  refunds: { title: 'Cancellation & refund policy', intro: 'Draft policy: an 80% refund if you are dissatisfied and request it within 7 days of payment. For recurring subscriptions, the refund applies to the latest payment only, with a separate 7-day window for each payment. Refund processing time is still pending.', sections: [
    { title: 'Dissatisfaction refunds', text: 'If you do not like the service, the selected policy is an 80% refund when requested within 7 days of payment. For recurring subscriptions, 80% applies only to the latest payment, not earlier payments. The 7-day request window runs separately from each payment. The refund processing time must also be confirmed before this draft becomes effective or paid checkout is enabled.' },
    { title: 'Cancellation and renewal', text: 'Cancellation is intended to end access immediately, rather than at the end of a paid period. Automatic renewal is planned but is not active in this preview. No recurring payment mandate or charge is created by these pages.' },
    { title: 'How to contact us', text: 'For a cancellation request or an existing payment issue, contact Mystify me using the email or phone below. Include your restaurant name, registered email, payment reference and the reason for your request. Do not share card details or OTPs.' },
    { title: 'Decisions awaiting approval', text: 'The time to process approved refunds and the cancellation process still need to be finalised. Cancellation alone does not mean a refund has been issued.' },
  ] },
  privacy: { title: 'Privacy policy', intro: 'Draft notice based on the current application. Review is required before this policy becomes effective.', sections: [
    { title: 'Information used in the application', text: 'Signup uses the restaurant name, owner name, email, password and optional phone number. The application stores restaurant records entered by its users, including staff, customer, order, payment-record, supplier and inventory information, and activity logs.' },
    { title: 'Why the application uses it', text: 'Account information is used for sign-in and restaurant access. Business records support POS, stock tracking, reports and other requested restaurant features. Staff permissions determine access inside the restaurant account.' },
    { title: 'Cookies and device storage', text: 'The application uses a sign-in cookie. POS recovery data is stored in the browser’s local storage so a cart or pending checkout can be recovered. People using shared devices should sign out and avoid leaving restaurant information on devices they do not control.' },
    { title: 'Hosting and payments', text: 'The application is deployed on Vercel and uses a hosted PostgreSQL database. Razorpay integration is planned; these pages do not activate it. Payment data handling and any payment-provider disclosures must be reviewed against the finished integration before launch.' },
    { title: 'Requests about your information', text: 'Contact Mystify me to ask about access, correction or deletion of information associated with your account. Do not send identity documents or sensitive credentials unless a suitable secure process has been agreed.' },
    { title: 'Details still requiring approval', text: 'The final processor list, data retention periods, account deletion process, international processing details, grievance contact, request-handling times and effective date remain to be confirmed. This draft does not claim certification, guaranteed security or compliance with any particular law.' },
  ] },
  shipping: { title: 'Digital delivery', intro: 'RestroControl is browser-based software, not a physical product.', sections: [
    { title: 'No physical shipping', text: 'There are no physical goods to dispatch for the RestroControl software plan. Access is through the website after account registration and sign-in.' },
    { title: 'Trial and paid activation', text: 'A successful new restaurant signup starts the 14-day trial. Paid activation is currently requested from inside the account. Online payment and a paid-activation delivery timeline are not established by this preview.' },
    { title: 'Access problems', text: 'If you cannot access your account, contact Mystify me with your registered email and restaurant name. Never share your password or OTP.' },
  ] },
};

export function generateStaticParams() { return Object.keys(pages).map(info => ({ info })); }
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<{ info: string }> }): Promise<Metadata> {
  const page = pages[(await params).info];
  return { title: `${page?.title || 'Page not found'} | RestroControl`, robots: { index: false, follow: false } };
}
export default async function PublicInfoPage({ params }: { params: Promise<{ info: string }> }) {
  const info = (await params).info;
  const page = pages[info];
  if (!page) notFound();
  return (
    <div className="min-h-screen bg-[#f8f5ee] text-stone-800">
      <header className="border-b border-stone-200 bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <Link href="/" className="text-xl font-black tracking-tight text-emerald-800">RestroControl</Link>
          <nav aria-label="Main navigation" className="flex items-center gap-4 text-sm font-semibold"><Link href="/pricing">Pricing</Link><Link href="/login">Sign in</Link><Link href="/signup" className="rounded-xl bg-emerald-700 px-4 py-2 text-white">Free trial</Link></nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div role="note" className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950"><strong>Preview only.</strong> These pages are for owner review, not final commercial policies. No online subscription payment is enabled here.</div>
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
          <aside><nav aria-label="Information pages" className="flex flex-wrap gap-2 lg:flex-col">{publicLinks.map(([label, href]) => <Link key={href} href={href} aria-current={href === `/${info}` ? 'page' : undefined} className={`rounded-xl px-3 py-2 text-sm font-semibold ${href === `/${info}` ? 'bg-emerald-800 text-white' : 'bg-white text-stone-600 hover:bg-stone-100'}`}>{label}</Link>)}</nav></aside>
          <article className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">Mystify me / RestroControl</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-900 sm:text-5xl">{page.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">{page.intro}</p>
            {info === 'pricing' && <PlanCards />}
            <div className="mt-8 space-y-7">{page.sections.map(section => <section key={section.title}><h2 className="text-xl font-bold text-stone-900">{section.title}</h2><p className="mt-2 leading-7 text-stone-600">{section.text}</p></section>)}</div>
            <section className="mt-10 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-bold">Mystify me</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">RestroControl service and policy enquiries</p>
              <address className="mt-3 text-sm not-italic leading-6 text-stone-600">B-297, Janta Colony, Adarsh Nagar,<br />Jaipur, Rajasthan 302004, India</address>
              <a href="mailto:mehuljhabak10@gmail.com" className="mt-3 block break-all text-sm font-semibold text-emerald-800 underline underline-offset-4">mehuljhabak10@gmail.com</a>
              <a href="tel:+918209951190" className="mt-2 block text-sm font-semibold text-emerald-800 underline underline-offset-4">+91 82099 51190</a>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
