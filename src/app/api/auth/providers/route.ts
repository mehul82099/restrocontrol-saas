// Access: Public provider availability, no secret values.
import { NextResponse } from 'next/server';
import { turnstilePublicConfig } from '@/server/services/turnstile';
import { googleConfig } from '@/server/auth/google';

export async function GET() {
  return NextResponse.json({ google: !!googleConfig(), turnstile: turnstilePublicConfig() });
}
export const dynamic = 'force-dynamic';
