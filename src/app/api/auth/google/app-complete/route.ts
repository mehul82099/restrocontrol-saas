// Access: Public handoff landing page (also the claimed Android App Link URL).
// The one-time code arrives in the URL FRAGMENT, which is never sent to this
// server: this route always serves the same static page, and the page reads
// the fragment client-side. No caller-supplied URL is ever read or reflected.
import { NextResponse } from 'next/server';
import { appCompletePage } from '@/server/auth/app-handoff';

export async function GET() {
  return new NextResponse(appCompletePage(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
export const dynamic = 'force-dynamic';
