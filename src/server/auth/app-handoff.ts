// Google sign-in handoff for the app shells (Android WebView / Electron).
// PRIVATE change set: no branch, no PR, no production/DB mutation without Mehul's approval.
//
// Security contract (per approved design):
// - The handoff code is NEVER a redeemable bearer token: exchange requires the
//   PKCE-style verifier whose sha256 challenge was bound at flow start.
// - One-time use, 5 minute TTL, code and verifier challenge stored only as hashes.
// - Atomic consume: code+verifier+unused+unexpired are checked in ONE statement;
//   any failure consumes nothing and returns the same generic result.
// - No verifier, state, or raw code is ever logged.
import crypto from 'crypto';

export const APP_HANDOFF_TTL_MS = 5 * 60 * 1000;
// NOTE: no custom URL scheme exists in this design (review round 3): the only
// code-delivery channel is the verified Android App Link (https). The
// app-complete page is static and never touches the code.
export type AppTarget = 'android' | 'windows';

const APP_TARGETS: readonly string[] = ['android', 'windows'];
// base64url(sha256(...)) is exactly 43 chars; randomToken() is 32 chars.
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
const CODE_RE = /^[A-Za-z0-9_-]{32}$/;

export function isAppTarget(v: string | null | undefined): v is AppTarget {
  return typeof v === 'string' && APP_TARGETS.includes(v);
}

export function sha256b64url(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

export function newHandoffCode(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function isWellFormedCode(code: unknown): code is string {
  return typeof code === 'string' && CODE_RE.test(code);
}

export function isWellFormedChallenge(challenge: unknown): challenge is string {
  return typeof challenge === 'string' && CHALLENGE_RE.test(challenge);
}

// ---- OAuth state cookie (extends the existing `state.nonce.mode` format) ----
// New format: `state.nonce.mode.app.challenge`. state/nonce are base64url tokens
// (no dots), so dot-splitting stays unambiguous. Old 3-part values still parse.

export interface OAuthState {
  state: string;
  nonce: string;
  mode: string;
  app?: AppTarget;
  challenge?: string;
}

export function serializeOAuthState(s: OAuthState): string {
  const base = `${s.state}.${s.nonce}.${s.mode}`;
  if (s.app && s.challenge) return `${base}.${s.app}.${s.challenge}`;
  return base;
}

export function parseOAuthStateCookie(value: string | undefined | null): OAuthState | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3 && parts.length !== 5) return null;
  const [state, nonce, mode] = parts;
  if (!state || !nonce || !mode) return null;
  if (parts.length === 3) return { state, nonce, mode };
  const app = parts[3];
  const challenge = parts[4];
  // A 5-part cookie with a bad app or challenge is rejected whole: never
  // silently downgrade an app-mode flow into a web-mode session.
  if (!isAppTarget(app) || !isWellFormedChallenge(challenge)) return null;
  return { state, nonce, mode, app, challenge };
}

// ---- Handoff record store ----
// The production store is Postgres (see prisma migration + exchange route).
// Implementations MUST make consume() atomic: one statement that matches
// codeHash + verifierChallenge + unused + unexpired and marks used.

export interface HandoffRecord {
  codeHash: string;
  verifierChallenge: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface HandoffStore {
  insert(rec: HandoffRecord): Promise<void>;
  consume(codeHash: string, verifierChallenge: string, now: Date): Promise<HandoffRecord | null>;
  deleteExpired?(now: Date): Promise<number>;
}

export async function createHandoff(
  store: HandoffStore,
  userId: string,
  verifierChallenge: string,
  now: Date = new Date(),
): Promise<string> {
  if (!isWellFormedChallenge(verifierChallenge)) throw new Error('Invalid verifier challenge');
  const code = newHandoffCode();
  await store.insert({
    codeHash: sha256b64url(code),
    verifierChallenge,
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + APP_HANDOFF_TTL_MS),
    usedAt: null,
  });
  return code;
}

// Returns the record on success, null on ANY failure (bad code, expired,
// already used, wrong verifier) with no distinguishing detail.
export async function exchangeHandoff(
  store: HandoffStore,
  code: unknown,
  verifier: unknown,
  now: Date = new Date(),
): Promise<HandoffRecord | null> {
  if (!isWellFormedCode(code) || typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128) return null;
  return store.consume(sha256b64url(code), sha256b64url(verifier), now);
}

// ---- app-complete page ----
// Public page the browser lands on after a successful app-mode callback when NO
// verified app claims the link (App Links not yet verified for this install, or
// the user disabled 'open supported links' in Android settings).
//
// FAIL-CLOSED BY CONSTRUCTION (review round 3): this page has no script and no
// links at all. It never reads the URL fragment, never builds a custom-scheme
// deep link, and never hands the one-time code to anything. The ONLY delivery
// channel for the code is the verified Android App Link, where the OS hands
// the URI (fragment included) straight to the app that owns the domain
// association. When this page is showing, the code simply expires unused
// (5-minute TTL, one-time, PKCE-bound: non-redeemable without the verifier,
// which never left the app). The browser session is deliberately NOT signed in
// (app-mode callback issues no web session), so the page tells the user the
// honest recovery path: email + password inside the app.
export function appCompletePage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RestroControl - return to app</title>
</head>
<body>
<p><strong>Sign-in did not return to the RestroControl app automatically.</strong></p>
<p>For your security this page never receives or processes your sign-in code, and it cannot pass you back to the app. The sign-in attempt has expired.</p>
<p>Open the RestroControl app on this device and sign in with your email and password. If the app is not installed, install it first.</p>
</body>
</html>`;
}
