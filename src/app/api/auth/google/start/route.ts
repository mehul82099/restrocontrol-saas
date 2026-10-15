import { NextRequest, NextResponse } from 'next/server';
import { INVITE_COOKIE, validTokenShape } from '@/server/services/invite.service';
import { googleConfig, redirectUri, randomToken, GOOGLE_STATE_COOKIE } from '@/server/auth/google';

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(`${origin}/login?error=google_unavailable`);
  const sp = new URL(req.url).searchParams;
  const inviteToken = sp.get('invite');
  const mode = sp.get('mode') === 'invite' && validTokenShape(inviteToken) ? 'invite' : sp.get('mode') === 'signup' ? 'signup' : 'login';
  if (sp.get('mode') === 'invite' && mode !== 'invite') return NextResponse.redirect(`${origin}/login?error=invite_invalid`);
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
  if (mode === 'invite') res.cookies.set(INVITE_COOKIE, inviteToken as string, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google', maxAge: 10 * 60 });
  return res;
}
export const dynamic = 'force-dynamic';
