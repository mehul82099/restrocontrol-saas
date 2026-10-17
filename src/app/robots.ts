import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Indexing of the public info pages is controlled by their own robots meta
// (INDEX_PUBLIC_PAGES in src/lib/seo.ts), so robots.txt must NOT disallow them:
// a disallow would stop crawlers from ever seeing the noindex tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
