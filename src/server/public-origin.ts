import type { NextRequest } from 'next/server';

// Public origin for absolute URLs and same-origin checks. Behind a reverse proxy
// req.url carries the internal origin (e.g. https://localhost:3000), so a
// configured public APP_URL wins. Without APP_URL (or if it is not a valid URL)
// the request origin is used, which keeps behavior identical on Vercel.
export function publicOrigin(req: NextRequest): string {
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try { return new URL(appUrl).origin; } catch { /* fall through to request origin */ }
  }
  return new URL(req.url).origin;
}
