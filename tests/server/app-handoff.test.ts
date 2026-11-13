// Isolated tests for the app-handoff core. No DB, no network, no Next.js:
// the store is an in-memory implementation whose consume() mirrors the
// single-statement atomic UPDATE used by the Postgres store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_HANDOFF_TTL_MS,
  appCompletePage,
  createHandoff,
  exchangeHandoff,
  isWellFormedChallenge,
  isWellFormedCode,
  parseOAuthStateCookie,
  serializeOAuthState,
  sha256b64url,
  type HandoffRecord,
  type HandoffStore,
} from '../src/server/auth/app-handoff.ts';

function memoryStore(): HandoffStore & { rows: Map<string, HandoffRecord> } {
  const rows = new Map<string, HandoffRecord>();
  return {
    rows,
    async insert(rec) {
      if (rows.has(rec.codeHash)) throw new Error('duplicate');
      rows.set(rec.codeHash, rec);
    },
    // Synchronous check+mark: the same semantics as the single UPDATE statement.
    async consume(codeHash, verifierChallenge, now) {
      const rec = rows.get(codeHash);
      if (!rec || rec.usedAt || rec.expiresAt <= now || rec.verifierChallenge !== verifierChallenge) return null;
      rec.usedAt = now;
      return rec;
    },
  };
}

const VERIFIER = 'a'.repeat(64); // stands in for a high-entropy verifier
const CHALLENGE = sha256b64url(VERIFIER);

test('state cookie: legacy 3-part parses unchanged', () => {
  const p = parseOAuthStateCookie('st.no.login');
  assert.deepEqual(p, { state: 'st', nonce: 'no', mode: 'login' });
});

test('state cookie: 5-part app-mode parses with challenge', () => {
  const p = parseOAuthStateCookie(`st.no.login.android.${CHALLENGE}`);
  assert.deepEqual(p, { state: 'st', nonce: 'no', mode: 'login', app: 'android', challenge: CHALLENGE });
});

test('state cookie: malformed values rejected whole, never downgraded', () => {
  assert.equal(parseOAuthStateCookie(''), null);
  assert.equal(parseOAuthStateCookie('st.no'), null);
  assert.equal(parseOAuthStateCookie('st.no.login.extra'), null); // 4 parts
  assert.equal(parseOAuthStateCookie(`st.no.login.web.${CHALLENGE}`), null); // bad app
  assert.equal(parseOAuthStateCookie('st.no.login.android.tooshort'), null); // bad challenge
  assert.equal(parseOAuthStateCookie('..login'), null); // empty state/nonce
});

test('state cookie: serialize/parse round-trip both shapes', () => {
  const web = { state: 's1', nonce: 'n1', mode: 'signup' };
  assert.deepEqual(parseOAuthStateCookie(serializeOAuthState(web)), web);
  const app = { state: 's2', nonce: 'n2', mode: 'login', app: 'windows' as const, challenge: CHALLENGE };
  assert.deepEqual(parseOAuthStateCookie(serializeOAuthState(app)), app);
});

test('exchange: correct code+verifier succeeds', async () => {
  const s = memoryStore();
  const code = await createHandoff(s, 'user-1', CHALLENGE);
  const rec = await exchangeHandoff(s, code, VERIFIER);
  assert.ok(rec);
  assert.equal(rec.userId, 'user-1');
});

test('exchange: store holds hashes only, never raw code or verifier', async () => {
  const s = memoryStore();
  const code = await createHandoff(s, 'user-1', CHALLENGE);
  const [rec] = [...s.rows.values()];
  assert.equal(rec.codeHash, sha256b64url(code));
  assert.notEqual(rec.codeHash, code);
  assert.equal(rec.verifierChallenge, CHALLENGE);
  assert.notEqual(rec.verifierChallenge, VERIFIER);
  assert.ok(!JSON.stringify([...s.rows.values()]).includes(code));
});

test('exchange: wrong verifier fails generic and CONSUMES NOTHING', async () => {
  const s = memoryStore();
  const code = await createHandoff(s, 'user-1', CHALLENGE);
  assert.equal(await exchangeHandoff(s, code, 'b'.repeat(64)), null);
  // Failed attempt did not burn the code: the real verifier still works.
  assert.ok(await exchangeHandoff(s, code, VERIFIER));
});

test('exchange: replay of a used code fails', async () => {
  const s = memoryStore();
  const code = await createHandoff(s, 'user-1', CHALLENGE);
  assert.ok(await exchangeHandoff(s, code, VERIFIER));
  assert.equal(await exchangeHandoff(s, code, VERIFIER), null);
});

test('exchange: expired code fails', async () => {
  const s = memoryStore();
  const t0 = new Date('2026-11-13T10:00:00Z');
  const code = await createHandoff(s, 'user-1', CHALLENGE, t0);
  const afterTtl = new Date(t0.getTime() + APP_HANDOFF_TTL_MS + 1000);
  assert.equal(await exchangeHandoff(s, code, VERIFIER, afterTtl), null);
});

test('exchange: two parallel exchanges of one code - exactly one succeeds', async () => {
  const s = memoryStore();
  const code = await createHandoff(s, 'user-1', CHALLENGE);
  const results = await Promise.all([
    exchangeHandoff(s, code, VERIFIER),
    exchangeHandoff(s, code, VERIFIER),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
});

test('exchange: malformed inputs rejected without touching the store', async () => {
  let calls = 0;
  const s = memoryStore();
  const orig = s.consume;
  s.consume = async (...a) => { calls++; return orig(...a); };
  assert.equal(await exchangeHandoff(s, 'not-a-code', VERIFIER), null);
  assert.equal(await exchangeHandoff(s, undefined, VERIFIER), null);
  const code = await createHandoff(s, 'user-1', CHALLENGE);
  assert.equal(await exchangeHandoff(s, code, 'short'), null); // verifier too short
  assert.equal(await exchangeHandoff(s, code, 12345), null); // verifier not a string
  assert.equal(calls, 0);
});

test('exchange: unknown code fails generic', async () => {
  const s = memoryStore();
  await createHandoff(s, 'user-1', CHALLENGE);
  const other = 'Z'.repeat(32);
  assert.ok(isWellFormedCode(other));
  assert.equal(await exchangeHandoff(s, other, VERIFIER), null);
});

test('challenge/code shape validation', () => {
  assert.ok(isWellFormedChallenge(CHALLENGE));
  assert.ok(!isWellFormedChallenge('x'.repeat(42)));
  assert.ok(!isWellFormedChallenge('x'.repeat(43) + '!'));
  const s = memoryStore();
  return createHandoff(s, 'u', CHALLENGE).then((code) => {
    assert.ok(isWellFormedCode(code));
    assert.ok(!isWellFormedCode(code + 'AA'));
    assert.ok(!isWellFormedCode(code.slice(0, 30) + '+/')); // not base64url
  });
});

test('app-complete page: fail-closed static page, no script, no scheme, no URLs', () => {
  const html = appCompletePage();
  // Fail-closed (review round 3): no JavaScript at all - nothing reads the
  // fragment, so no code can be extracted or forwarded by this page.
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('window.location'));
  // No custom-scheme deep link (hijackable channel removed entirely).
  assert.ok(!html.includes('restrocontrol://'));
  // No web URL anywhere in the page.
  assert.ok(!html.includes('http://') && !html.includes('https://'));
  // Honest recovery guidance: email + password inside the app.
  assert.ok(html.includes('email and password'));
  assert.ok(html.includes('did not return to the RestroControl app'));
});
