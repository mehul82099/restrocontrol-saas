import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RestroControl | Inventory-First Restaurant POS & Management SaaS',
  description: 'Know what your restaurant sold, what recipes should have consumed, what was actually consumed, and where variance occurred.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
