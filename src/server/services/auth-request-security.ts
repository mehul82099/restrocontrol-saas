import { NextRequest, NextResponse } from 'next/server';
import { createHash, createHmac } from 'crypto';
import { isIP } from 'net';
import { prisma } from '../db/prisma';
import { publicOrigin } from '@/server/public-origin';

export class RequestBodyError extends Error {
  constructor(public status: number) { super('Invalid request body'); }
}

// Read incrementally. Content-Length is only a hint and is never trusted as the cap.
export async function readBoundedText(req: Request, maximum = 65536): Promise<string> {
  const length = req.headers.get('content-length');
  if (length && /^\d+$/.test(length) && Number(length) > maximum) throw new RequestBodyError(413);
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) {
        void reader.cancel().catch(() => undefined);
        throw new RequestBodyError(413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}

// Transient connection errors (cold start / connection setup / pool wait), retried a couple
// of times before the caller fails closed with 503. Any other error is rethrown at once.
// P1001 can't reach DB, P1002 DB reach timed out, P2024 timed out fetching a pooled
// connection: the query never ran. P1017 server closed the connection: worst case a retry
// counts one extra hit against the budget, which only makes throttling stricter.
const TRANSIENT_DB_CODES = new Set(['P1001', 'P1002', 'P1017', 'P2024']);
const AUTH_BUDGET_RETRY_DELAYS_MS = [200, 500];

export function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as {name?: unknown; code?: unknown; errorCode?: unknown};
  if (e.name === 'PrismaClientInitializationError') return true;
  const code = typeof e.code === 'string' ? e.code : typeof e.errorCode === 'string' ? e.errorCode : '';
  return TRANSIENT_DB_CODES.has(code);
}

export async function withTransientDbRetry<T>(operation: () => Promise<T>, delaysMs: readonly number[] = AUTH_BUDGET_RETRY_DELAYS_MS): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= delaysMs.length || !isTransientDbError(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, delaysMs[attempt]));
    }
  }
}

export async function consumeAuthBudget(scope: string, identity: string, limit: number, windowMs: number): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('Security budget key unavailable');
  const key = createHmac('sha256', secret).update('auth-budget-v1\0' + scope + '\0' + identity).digest('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const rows = await withTransientDbRetry(() => prisma.$queryRaw<{hits: number}[]>`
    WITH cleanup AS (
      DELETE FROM "SecurityRateLimit" WHERE "key" IN (
        SELECT "key" FROM "SecurityRateLimit" WHERE "expiresAt" < ${new Date(now.getTime() - 86400000)} AND "key" <> ${key} LIMIT 10
      )
    )
    INSERT INTO "SecurityRateLimit" ("key", "hits", "expiresAt") VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "SecurityRateLimit"."expiresAt" <= ${now} THEN 1 ELSE "SecurityRateLimit"."hits" + 1 END,
      "expiresAt" = CASE WHEN "SecurityRateLimit"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "SecurityRateLimit"."expiresAt" END
    WHERE "SecurityRateLimit"."expiresAt" <= ${now} OR "SecurityRateLimit"."hits" < ${limit}
    RETURNING "hits"`);
  return rows.length === 1;
}

export type AuthRequestPolicy = {scope: string; ipLimit?: number; identityLimit?: number; accountLimit?: number; windowMs?: number; generic?: Record<string, unknown>};
export function protectAuthRequest(handler: (req: NextRequest) => Promise<NextResponse>, policy: AuthRequestPolicy) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const reject = (status: number, error: string) => policy.generic
      ? NextResponse.json(policy.generic)
      : NextResponse.json({success: false, error}, {status});
    try {
      const origin = req.headers.get('origin');
      if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== publicOrigin(req))) return reject(403, 'Cross-origin request denied.');
      // On Vercel the platform sets x-vercel-forwarded-for, rather than trusting a client-supplied XFF.
      const raw = process.env.VERCEL === '1' ? req.headers.get('x-vercel-forwarded-for') : req.headers.get('x-forwarded-for');
      const candidate = (raw || '').split(',')[0].trim();
      const ip = isIP(candidate) ? candidate : 'unknown';
      const allowedIp = await consumeAuthBudget(policy.scope + ':ip', ip, policy.ipLimit || 100, policy.windowMs || 15 * 60 * 1000);
      if (!allowedIp) return reject(429, 'Too many attempts. Try again in 15 minutes.');
      const text = await readBoundedText(req.clone());
      const data = JSON.parse(text || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) return reject(400, 'Invalid request.');
      const identity = typeof data.email === 'string' ? data.email.toLowerCase().trim().slice(0, 254) : '';
      // Reset tokens are capabilities, never persisted directly in the budget key.
      const tokenIdentity = typeof data.token === 'string' ? createHash('sha256').update(data.token).digest('hex') : '';
      if (identity || tokenIdentity) {
        if (!await consumeAuthBudget(policy.scope + ':identity', ip + '\0' + (identity || tokenIdentity), policy.identityLimit || 10, policy.windowMs || 15 * 60 * 1000)) return reject(429, 'Too many attempts. Try again in 15 minutes.');
      }
      if (identity && policy.accountLimit && !await consumeAuthBudget(policy.scope + ':account', identity, policy.accountLimit, policy.windowMs || 15 * 60 * 1000)) return reject(429, 'Too many attempts. Try again in 15 minutes.');
      return await handler(req);
    } catch (error) {
      if (error instanceof RequestBodyError) return reject(error.status, 'Request too large.');
      if (error instanceof SyntaxError) return reject(400, 'Invalid request.');
      // Security storage outage must not silently turn off authentication throttling.
      return reject(503, 'Authentication is temporarily unavailable. Try again shortly.');
    }
  };
}
