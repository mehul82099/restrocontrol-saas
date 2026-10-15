import crypto from 'crypto';

export const GOOGLE_STATE_COOKIE = 'g_oauth';
export const GOOGLE_SIGNUP_COOKIE = 'g_signup';
export const GOOGLE_SIGNUP_PURPOSE = 'google_signup';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function redirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export function randomToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export interface GoogleIdentity { email: string; emailVerified: boolean; name?: string }

// The id_token is received straight from Google's token endpoint over TLS (authorization-code flow),
// and its audience, issuer, expiry and nonce are still checked here.
export function readIdToken(idToken: string, clientId: string, nonce: string, now = Date.now()): GoogleIdentity | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  let p: any;
  try { p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return null; }
  if (p.aud !== clientId || !ISSUERS.includes(p.iss) || typeof p.exp !== 'number' || p.exp * 1000 < now) return null;
  if (typeof p.nonce !== 'string' || !safeEqual(p.nonce, nonce)) return null;
  if (typeof p.email !== 'string') return null;
  return { email: p.email.toLowerCase().trim(), emailVerified: p.email_verified === true, name: typeof p.name === 'string' ? p.name : undefined };
}
