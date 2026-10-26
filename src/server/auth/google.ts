import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const GOOGLE_STATE_COOKIE = 'g_oauth';
export const GOOGLE_SIGNUP_COOKIE = 'g_signup';
export const GOOGLE_SIGNUP_PURPOSE = 'google_signup';
const ISSUERS: [string, ...string[]] = ['https://accounts.google.com', 'accounts.google.com'];

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

// Google's discovery document publishes this JWKS URI. Never follow a URL from
// a token header: the signing authority is fixed, not selected by the caller.
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const MAX_TOKEN_BYTES = 16 * 1024;
const MAX_JWKS_BYTES = 64 * 1024;
const UNKNOWN_KID_RETRY_MS = 30_000;
type SigningJwk = crypto.JsonWebKey & { kid?: string; alg?: string; use?: string; key_ops?: string[] };

// A reader owns an in-memory cache and one in-flight refresh. Dependency injection
// makes key rotation/error tests deterministic without a production bypass.
export function createGoogleIdTokenReader(fetcher: typeof fetch = fetch) {
  let keys = new Map<string, crypto.KeyObject>();
  let expiresAt = 0;
  let unknownKidRetryAt = 0;
  let refreshing: Promise<void> | null = null;

  async function refresh(now: number): Promise<void> {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const response = await fetcher(GOOGLE_JWKS_URI, {
        headers: { Accept: 'application/json' }, redirect: 'error',
        cache: 'no-store', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Google signing keys unavailable');
      // Bound the streamed body, not only Content-Length (which is optional).
      if (!response.body) throw new Error('Missing Google signing keys');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_JWKS_BYTES) throw new Error('Google signing keys too large');
          chunks.push(value);
        }
      } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
      const document = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Array.isArray(document.keys) || document.keys.length > 32) throw new Error('Invalid Google signing keys');
      const next = new Map<string, crypto.KeyObject>();
      for (const key of document.keys as SigningJwk[]) {
        if (!key || key.kty !== 'RSA' || typeof key.kid !== 'string' || !key.kid || key.kid.length > 256 ||
            (key.alg && key.alg !== 'RS256') || (key.use && key.use !== 'sig') ||
            (key.key_ops && (!Array.isArray(key.key_ops) || !key.key_ops.includes('verify')))) continue;
        if (next.has(key.kid)) throw new Error('Duplicate Google signing key');
        const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
        if (publicKey.asymmetricKeyType !== 'rsa' || (publicKey.asymmetricKeyDetails?.modulusLength || 0) < 2048) continue;
        next.set(key.kid, publicKey);
      }
      if (!next.size) throw new Error('No Google signing keys');
      const cacheControl = response.headers.get('cache-control') || '';
      const maxAge = /(?:^|,)\s*max-age=(\d+)/i.exec(cacheControl);
      const age = Number(response.headers.get('age') || 0);
      const ttl = /(?:^|,)\s*(?:no-store|no-cache)(?:,|$)/i.test(cacheControl) ? 0 :
        Math.max(0, Math.min(86400, (maxAge ? Number(maxAge[1]) : 300) - (Number.isFinite(age) ? age : 0)));
      keys = next;
      expiresAt = now + ttl * 1000;
    })();
    try { await refreshing; } finally { refreshing = null; }
  }

  return async function readIdToken(idToken: string, clientId: string, nonce: string, now = Date.now()): Promise<GoogleIdentity | null> {
    try {
      if (!idToken || idToken.length > MAX_TOKEN_BYTES || !clientId || !nonce || !Number.isFinite(now)) return null;
      const parts = idToken.split('.');
      if (parts.length !== 3 || parts.some(p => !p || !/^[A-Za-z0-9_-]+$/.test(p))) return null;
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.kid.length > 256 ||
          header.crit !== undefined || header.b64 !== undefined) return null;
      let refreshed = false;
      if (now >= expiresAt) { await refresh(now); refreshed = true; }
      if (!keys.has(header.kid) && !refreshed && now >= unknownKidRetryAt) {
        // Retry once for a newly rotated kid, with a cooldown to bound random-kid traffic.
        unknownKidRetryAt = now + UNKNOWN_KID_RETRY_MS;
        await refresh(now);
      }
      const key = keys.get(header.kid);
      if (!key) return null;
      const p = jwt.verify(idToken, key, { algorithms: ['RS256'], issuer: ISSUERS, audience: clientId, clockTimestamp: now / 1000 });
      if (!p || typeof p !== 'object' || p.aud !== clientId || typeof p.exp !== 'number' || !Number.isFinite(p.exp) || p.exp * 1000 <= now ||
          typeof p.sub !== 'string' || !p.sub || p.sub.length > 255 ||
          (p.azp !== undefined && p.azp !== clientId) ||
          (p.iat !== undefined && (typeof p.iat !== 'number' || !Number.isFinite(p.iat) || p.iat * 1000 > now + 60_000))) return null;
      if (typeof p.nonce !== 'string' || !safeEqual(p.nonce, nonce)) return null;
      if (typeof p.email !== 'string' || !p.email.trim()) return null;
      return { email: p.email.toLowerCase().trim(), emailVerified: p.email_verified === true, name: typeof p.name === 'string' ? p.name : undefined };
    } catch {
      // Network, parse and signature failures all fail closed. Never log tokens.
      return null;
    }
  };
}

export const readIdToken = createGoogleIdTokenReader();
