// Access: Public OAuth initiation.
// CHANGE (app handoff): accepts app=android|windows and cc=<sha256(verifier)>;
// both ride inside the existing g_oauth state cookie as a 5-part value.
// Unknown/absent app = today's behavior, byte-identical.
import { NextRequest, NextResponse } from 'next/server';
import { INVITE_COOKIE, validTokenShape } from '@/server/services/invite.service';
import { googleConfig, redirectUri, randomToken, GOOGLE_STATE_COOKIE } from '@/server/auth/google';
import { isAppTarget, isWellFormedChallenge, serializeOAuthState, sha256b64url } from '@/server/auth/app-handoff';
import { publicOrigin } from '@/server/public-origin';

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(`${origin}/login?error=google_unavailable`);
  const sp = new URL(req.url).searchParams;
  const inviteToken = sp.get('invite');
  const mode = sp.get('mode') === 'invite' && validTokenShape(inviteToken) ? 'invite' : sp.get('mode') === 'signup' ? 'signup' : 'login';
  if (sp.get('mode') === 'invite' && mode !== 'invite') return NextResponse.redirect(`${origin}/login?error=invite_invalid`);
  // App handoff: the shell sends its PKCE-style challenge (sha256 of a verifier
  // that never leaves the app). Missing app/challenge is fine (web flow); a
  // present-but-malformed pair is rejected, never silently downgraded.
  const app = sp.get('app');
  const cc = sp.get('cc');
  let appMode: { app: 'android' | 'windows'; challenge: string } | null = null;
  if (app !== null || cc !== null) {
    if (!isAppTarget(app) || !isWellFormedChallenge(cc)) return NextResponse.redirect(`${origin}/login?error=google_failed`);
    appMode = { app, challenge: cc };
  }
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
  const stateValue = appMode
    ? serializeOAuthState({ state, nonce, mode, app: appMode.app, challenge: appMode.challenge })
    : `${state}.${nonce}.${mode}`;
  res.cookies.set(GOOGLE_STATE_COOKIE, stateValue, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google', maxAge: 10 * 60 });
  if (mode === 'invite') res.cookies.set(INVITE_COOKIE, inviteToken as string, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google', maxAge: 10 * 60 });
  return res;
}
export const dynamic = 'force-dynamic';
