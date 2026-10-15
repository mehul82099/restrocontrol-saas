import { NextRequest, NextResponse } from 'next/server';
import { verifyPurposeToken } from '@/server/auth/jwt';
import { GOOGLE_SIGNUP_COOKIE, GOOGLE_SIGNUP_PURPOSE } from '@/server/auth/google';

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(GOOGLE_SIGNUP_COOKIE)?.value;
  const p = raw ? verifyPurposeToken(raw, GOOGLE_SIGNUP_PURPOSE) : null;
  if (!p) return NextResponse.json({ success: false }, { status: 404 });
  return NextResponse.json({ success: true, email: p.email, name: p.name || '' });
}
export const dynamic = 'force-dynamic';
