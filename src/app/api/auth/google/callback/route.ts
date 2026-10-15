import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { signToken, signPurposeToken } from '@/server/auth/jwt';
import { AuditService } from '@/server/services/audit.service';
import { isDemoAccount, isDemoEmail } from '@/server/auth/demo';
import { googleConfig, redirectUri, readIdToken, safeEqual, GOOGLE_STATE_COOKIE, GOOGLE_SIGNUP_COOKIE, GOOGLE_SIGNUP_PURPOSE } from '@/server/auth/google';

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const fail = (code: string) => {
    const r = NextResponse.redirect(`${origin}/login?error=${code}`);
    r.cookies.set(GOOGLE_STATE_COOKIE, '', { path: '/api/auth/google', maxAge: 0 });
    return r;
  };
  try {
    const cfg = googleConfig();
    if (!cfg) return fail('google_unavailable');
    const params = new URL(req.url).searchParams;
    const code = params.get('code');
    const state = params.get('state');
    const [cookieState, nonce, mode] = (req.cookies.get(GOOGLE_STATE_COOKIE)?.value || '').split('.');
    if (params.get('error') || !code || !state || !cookieState || !nonce || !safeEqual(state, cookieState)) return fail('google_failed');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri(origin), grant_type: 'authorization_code' }),
    });
    if (!tokenRes.ok) return fail('google_failed');
    const tokens = await tokenRes.json();
    const identity = typeof tokens.id_token === 'string' ? readIdToken(tokens.id_token, cfg.clientId, nonce) : null;
    if (!identity || !identity.emailVerified) return fail('google_failed');

    // Same rule as password login: the email must resolve to exactly one active, non-demo account.
    const candidates = await prisma.user.findMany({
      where: { email: identity.email },
      include: { restaurant: true, userOutlets: { include: { outlet: true } } },
    });
    const user = candidates.length === 1 ? candidates[0] : null;
    if (candidates.length === 0 && !isDemoEmail(identity.email)) {
      if (mode !== 'signup') return fail('google_no_account');
      // New email: carry the Google-verified identity to the sign-up form (restaurant name still needed).
      const r = NextResponse.redirect(`${origin}/signup?google=1`);
      r.cookies.set(GOOGLE_SIGNUP_COOKIE, signPurposeToken(GOOGLE_SIGNUP_PURPOSE, { email: identity.email, name: identity.name || '' }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth', maxAge: 15 * 60 });
      r.cookies.set(GOOGLE_STATE_COOKIE, '', { path: '/api/auth/google', maxAge: 0 });
      return r;
    }
    if (!user || !user.isActive) return fail('google_no_account');
    if (isDemoAccount(user)) return fail('google_failed');
    if (mode === 'signup') return fail('already_registered'); // one account per email: sign in instead

    const defaultOutlet = user.userOutlets[0]?.outlet || (await prisma.outlet.findFirst({ where: { restaurantId: user.restaurantId, isDefault: true } }));
    const token = signToken({ userId: user.id, restaurantId: user.restaurantId, role: user.role, email: user.email, name: user.name, outletId: defaultOutlet?.id });
    await AuditService.log({ restaurantId: user.restaurantId, userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1', userAgent: req.headers.get('user-agent') });

    const dest = (user.role as string) === 'WAITER' ? '/waiter' : user.role === 'CASHIER' ? '/pos' : user.role === 'KITCHEN_STAFF' ? '/kot' : user.role === 'INVENTORY_MANAGER' ? '/inventory' : '/';
    const res = NextResponse.redirect(`${origin}${dest}`);
    res.cookies.set('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 12 * 60 * 60 });
    res.cookies.set(GOOGLE_STATE_COOKIE, '', { path: '/api/auth/google', maxAge: 0 });
    return res;
  } catch {
    return fail('google_failed');
  }
}
export const dynamic = 'force-dynamic';
