// Cloudflare Siteverify is called only after protectAuthRequest's origin/body/budgets.
// No secret, token, provider response or client IP is logged.
const TEST_KEY = /^[123]x0{10,}/;
export function turnstilePublicConfig() {
  const enabled = process.env.TURNSTILE_ENABLED === '1';
  const siteKey = process.env.TURNSTILE_SITE_KEY || '';
  return { enabled, siteKey: enabled ? siteKey : '' };
}
export async function verifyTurnstile(token: unknown, action: 'login' | 'register', hostname: string): Promise<boolean> {
  if (process.env.TURNSTILE_ENABLED !== '1') return true;
  const secret = process.env.TURNSTILE_SECRET_KEY || '';
  const siteKey = process.env.TURNSTILE_SITE_KEY || '';
  if (!secret || !siteKey || (process.env.NODE_ENV === 'production' && (TEST_KEY.test(secret) || TEST_KEY.test(siteKey)))) return false;
  const allowedHosts = (process.env.TURNSTILE_HOSTNAMES || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  if (!allowedHosts.includes(hostname.toLowerCase())) return false;
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) return false;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({secret, response: token}),
      signal: AbortSignal.timeout(6000), cache: 'no-store',
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result?.success === true && result.action === action && result.hostname === hostname;
  } catch { return false; }
}
