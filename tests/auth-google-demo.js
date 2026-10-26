// No database needed. Run: node tests/auth-google-demo.js
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jiti = require('jiti')(__filename, {alias: {'@': path.resolve(__dirname, '../src')}});
const {isDemoEmail, isDemoAccount} = jiti('../src/server/auth/demo');
const g = jiti('../src/server/auth/google');
let n = 0;
async function test(name, fn) { await fn(); n++; console.log('PASS ' + name); }
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const {privateKey, publicKey} = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
const jwk = {...publicKey.export({format: 'jwk'}), kid: 'demo-test-key', alg: 'RS256', use: 'sig'};
const readIdToken = g.createGoogleIdTokenReader(async () => new Response(JSON.stringify({keys: [jwk]}), {headers: {'cache-control': 'max-age=3600'}}));
const tok = p => jwt.sign(p, privateKey, {algorithm: 'RS256', keyid: jwk.kid, noTimestamp: true});
const good = {sub: 'test-subject', aud: 'cid', iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 600, nonce: 'n1', email: 'Owner@Shop.com', email_verified: true};
(async () => {
  await test('demo emails and demo restaurant are detected', () => {
    for (const e of ['owner@demokitchen.com', 'MANAGER@DemoKitchen.com', 'inventory@demokitchen.com']) assert.ok(isDemoEmail(e));
    assert.ok(!isDemoEmail('owner@shop.com'));
    assert.ok(isDemoAccount({email: 'x@y.com', restaurant: {slug: 'demo-kitchen'}}));
    assert.ok(!isDemoAccount({email: 'x@y.com', restaurant: {slug: 'real-1'}}));
  });
  await test('valid id_token yields normalized verified identity', async () => {
    const id = await readIdToken(tok(good), 'cid', 'n1');
    assert.deepEqual([id.email, id.emailVerified], ['owner@shop.com', true]);
  });
  await test('wrong audience, issuer, nonce, expiry or malformed token rejected', async () => {
    assert.equal(await readIdToken(tok({...good, aud: 'other'}), 'cid', 'n1'), null);
    assert.equal(await readIdToken(tok({...good, iss: 'https://evil.example'}), 'cid', 'n1'), null);
    assert.equal(await readIdToken(tok(good), 'cid', 'n2'), null);
    assert.equal(await readIdToken(tok({...good, exp: 1}), 'cid', 'n1'), null);
    assert.equal(await readIdToken('nonsense', 'cid', 'n1'), null);
  });
  await test('unverified email is flagged', async () => {
    assert.equal((await readIdToken(tok({...good, email_verified: false}), 'cid', 'n1')).emailVerified, false);
  });
  await test('google disabled without credentials; start redirects to login error', async () => {
    delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
    assert.equal(g.googleConfig(), null);
    const {NextRequest} = require('next/server');
    const {GET} = jiti('../src/app/api/auth/google/start/route');
    const r = await GET(new NextRequest('http://localhost:3000/api/auth/google/start'));
    assert.match(r.headers.get('location'), /\/login\?error=google_unavailable$/);
  });
  await test('start sends state+nonce to Google and sets httpOnly cookie', async () => {
    process.env.GOOGLE_CLIENT_ID = 'cid'; process.env.GOOGLE_CLIENT_SECRET = 'sec';
    const {NextRequest} = require('next/server');
    const {GET} = jiti('../src/app/api/auth/google/start/route');
    const r = await GET(new NextRequest('http://localhost:3000/api/auth/google/start'));
    const u = new URL(r.headers.get('location'));
    assert.equal(u.host, 'accounts.google.com');
    assert.equal(u.searchParams.get('redirect_uri'), 'http://localhost:3000/api/auth/google/callback');
    assert.ok(u.searchParams.get('state') && u.searchParams.get('nonce'));
    assert.match(r.headers.get('set-cookie'), /HttpOnly/i);
    assert.ok(!/GOOGLE_CLIENT_SECRET|sec/.test(r.headers.get('location').replace('select_account','')));
  });
  await test('login and google callback refuse demo accounts; login page has no demo credentials', () => {
    const read = f => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
    assert.match(read('src/app/api/auth/login/route.ts'), /isDemoAccount\(user\)/);
    assert.match(read('src/app/api/auth/google/callback/route.ts'), /isDemoAccount\(user\)/);
    assert.match(read('src/app/api/auth/register/route.ts'), /isDemoEmail\(email\)/);
    const page = read('src/app/(auth)/login/page.tsx');
    assert.ok(!/password123|owner@demokitchen|Demo Logins/i.test(page));
  });
  await test('purpose token: google_signup only, tamper/expiry/other purpose rejected', async () => {
    process.env.JWT_SECRET = 'x'.repeat(8) + 'unit-test-signing-key-0123456789abcdef';
    const j = jiti('../src/server/auth/jwt');
    const t = j.signPurposeToken('google_signup', {email: 'a@b.com', name: 'A'});
    assert.equal(j.verifyPurposeToken(t, 'google_signup').email, 'a@b.com');
    assert.equal(j.verifyPurposeToken(t, 'other'), null);
    assert.equal(j.verifyPurposeToken(t + 'x', 'google_signup'), null);
    // a normal session token must not work as a signup token
    const s2 = j.signToken({userId: 'u', restaurantId: 'r', role: 'OWNER', email: 'a@b.com', name: 'A'});
    assert.equal(j.verifyPurposeToken(s2, 'google_signup'), null);
    assert.equal(j.verifyToken(t)?.userId, undefined); // signup token carries no session identity
  });
  await test('register takes Google email only from signed cookie; existing email still blocks duplicates', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/app/api/auth/register/route.ts'), 'utf8');
    assert.match(src, /verifyPurposeToken\(raw, GOOGLE_SIGNUP_PURPOSE\)/);
    assert.match(src, /email = g\.email/);
    assert.match(src, /An account with this email already exists/);
    const cb = fs.readFileSync(path.resolve(__dirname, '../src/app/api/auth/google/callback/route.ts'), 'utf8');
    assert.match(cb, /already_registered/);
  });
  console.log(`${n} auth checks passed`);
})().catch(e => { console.error(e); process.exit(1); });
