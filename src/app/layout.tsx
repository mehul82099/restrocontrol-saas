import type { Metadata, Viewport } from 'next';
import { Fraunces } from 'next/font/google';
import './globals.css';
import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION, OG_IMAGE } from '@/lib/seo';

const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: '/manifest.json',
  openGraph: {
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'RestroControl - your restaurant, under control' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7ead9',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`antialiased selection:bg-emerald-600 selection:text-white ${displayFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
