import type { MetadataRoute } from 'next';
import { SITE_URL, INDEX_PUBLIC_PAGES } from '@/lib/seo';

const PUBLIC_INFO = ['/pricing', '/about', '/contact', '/terms', '/privacy', '/refunds', '/shipping'];

export default function sitemap(): MetadataRoute.Sitemap {
  const urls: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
  ];
  if (INDEX_PUBLIC_PAGES) {
    for (const path of PUBLIC_INFO) {
      urls.push({ url: `${SITE_URL}${path}`, changeFrequency: 'monthly', priority: 0.6 });
    }
  }
  return urls;
}
