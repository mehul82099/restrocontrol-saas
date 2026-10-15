import { NextRequest, NextResponse } from 'next/server';
import { googleConfig, redirectUri, randomToken, GOOGLE_STATE_COOKIE } from '@/server/auth/google';

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(`${origin}/login?error=google_unavailable`);
  const mode = new URL(req.url).searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const state = randomToken();
  const nonce = randomToken();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', redirectUri(origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('prompt', 'select_account');
  const res = NextResponse.redirect(url.toString());
  res.cookies.set(GOOGLE_STATE_COOKIE, `${state}.${nonce}.${mode}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google', maxAge: 10 * 60 });
  return res;
}
export const dynamic = 'force-dynamic';
