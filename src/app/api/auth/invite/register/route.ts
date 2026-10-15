import { NextRequest, NextResponse } from 'next/server';
import { redeemInvite, InviteError, landingFor } from '@/server/services/invite.service';

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  h.push(now); hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.length > 20;
}

// Email + password sign-up through a staff invite link. Never creates a restaurant.
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin');
    if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(req.url).origin)) return NextResponse.json({ success: false, error: 'Cross-origin request denied.' }, { status: 403 });
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (limited(ip)) return NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
    const b = await req.json();
    const password = typeof b.password === 'string' ? b.password : '';
    if (password.length < 10 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return NextResponse.json({ success: false, error: 'Password must be 10-72 characters with at least one letter and one number.' }, { status: 400 });
    const r = await redeemInvite({ token: String(b.token || ''), email: String(b.email || ''), name: String(b.name || ''), password, ip, userAgent: req.headers.get('user-agent') });
    const res = NextResponse.json({ success: true, user: { role: r.user.role, restaurantName: r.restaurantName }, redirect: landingFor(r.user.role) }, { status: 201 });
    res.cookies.set('token', r.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 12 * 60 * 60 });
    return res;
  } catch (e: any) {
    if (e instanceof InviteError) return NextResponse.json({ success: false, error: e.message }, { status: e.code === 'invalid' ? 404 : e.code === 'bad_input' ? 400 : e.code === 'plan_limit' ? 403 : 409 });
    return NextResponse.json({ success: false, error: 'Sign-up could not be completed.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
