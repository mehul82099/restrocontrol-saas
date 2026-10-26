// Offline cryptographic regression tests. No Google, database or secrets required.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const path = require('node:path');
const fs = require('node:fs');
const jiti = require('jiti')(__filename);
const {createGoogleIdTokenReader} = jiti('../src/server/auth/google');
const now = 1_800_000_000_000;
const pair = kid => {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
  return {privateKey, jwk: {...publicKey.export({format: 'jwk'}), kid, alg: 'RS256', use: 'sig'}};
};
const a = pair('a'), b = pair('b'), attacker = pair('attacker');
const claims = {sub: 'google-user-123', aud: 'cid', iss: 'https://accounts.google.com', exp: now / 1000 + 600, nonce: 'n1', email: 'Owner@Shop.com', email_verified: true};
const token = (p = {}, key = a, header = {}) => jwt.sign(Object.fromEntries(Object.entries({...claims, ...p}).filter(([, v]) => v !== undefined)), key.privateKey, {algorithm: 'RS256', keyid: key.jwk.kid, noTimestamp: true, header});
const response = (keys, maxAge = 3600) => new Response(JSON.stringify({keys}), {headers: {'cache-control': `public, max-age=${maxAge}`}});
let count = 0;
async function test(name, fn) { await fn(); count++; console.log('PASS ' + name); }
(async () => {
  await test('valid signed identity, accepted issuer variants, email status preserved', async () => {
    const read = createGoogleIdTokenReader(async url => {assert.equal(url, 'https://www.googleapis.com/oauth2/v3/certs'); return response([a.jwk]);});
    assert.deepEqual(await read(token(), 'cid', 'n1', now), {email: 'owner@shop.com', emailVerified: true, name: undefined});
    assert.equal((await read(token({iss: 'accounts.google.com', email_verified: false}), 'cid', 'n1', now)).emailVerified, false);
  });
  await test('forgery, algorithm confusion, absent kid and malformed tokens fail closed', async () => {
    let requests = 0;
    const read = createGoogleIdTokenReader(async () => {requests++; return response([a.jwk]);});
    assert.equal(await read(token({}, attacker, {kid: 'a'}), 'cid', 'n1', now), null);
    const hs = jwt.sign(claims, 'synthetic-test-key', {algorithm: 'HS256', keyid: 'a'});
    const none = `${Buffer.from('{"alg":"none","kid":"a"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.`;
    for (const t of [hs, none, 'garbage', 'h.p.s', 'a'.repeat(17000), token({}, a, {kid: ''})]) assert.equal(await read(t, 'cid', 'n1', now), null);
    assert.equal(requests, 1);
  });
  await test('audience, issuer, expiry, nonce, subject, azp, nbf, email and iat restrictions', async () => {
    const read = createGoogleIdTokenReader(async () => response([a.jwk]));
    for (const p of [{aud: 'other'}, {aud: ['cid', 'other']}, {iss: 'https://evil.invalid'}, {exp: now / 1000}, {exp: undefined}, {nonce: 'wrong'}, {nonce: undefined}, {sub: ''}, {sub: undefined}, {azp: 'other'}, {nbf: now / 1000 + 1}, {email: ''}]) {
      const t = token(p);
      assert.equal(await read(t, 'cid', 'n1', now), null, JSON.stringify(p));
    }
    const future = jwt.sign({...claims, iat: now / 1000 + 120}, a.privateKey, {algorithm: 'RS256', keyid: 'a'});
    assert.equal(await read(future, 'cid', 'n1', now), null);
  });
  await test('cache coalesces parallel misses and refreshes an unknown rotated kid', async () => {
    let requests = 0;
    const read = createGoogleIdTokenReader(async () => {requests++; await new Promise(r => setTimeout(r, 5)); return response(requests === 1 ? [a.jwk] : [a.jwk, b.jwk]);});
    const results = await Promise.all(Array.from({length: 8}, () => read(token(), 'cid', 'n1', now)));
    assert.ok(results.every(Boolean)); assert.equal(requests, 1);
    assert.ok(await read(token({}, b), 'cid', 'n1', now + 1000)); assert.equal(requests, 2);
    assert.equal(await read(token({}, attacker), 'cid', 'n1', now + 2000), null); assert.equal(requests, 2);
  });
  await test('cache expires and unavailable refresh never falls back to stale keys', async () => {
    let requests = 0;
    const read = createGoogleIdTokenReader(async () => ++requests === 1 ? response([a.jwk], 1) : new Response('', {status: 503}));
    assert.ok(await read(token(), 'cid', 'n1', now));
    assert.equal(await read(token(), 'cid', 'n1', now + 1000), null);
  });
  await test('failed JWKS parsing, wrong key kinds, oversized body, duplicate keys reject', async () => {
    const responses = [new Response('bad json'), response([]), response([{...a.jwk, alg: 'HS256'}]), response([{...a.jwk, use: 'enc'}]), response([{...a.jwk, key_ops: ['sign']}]), response([a.jwk, a.jwk]), new Response('x'.repeat(65537))];
    for (const r of responses) assert.equal(await createGoogleIdTokenReader(async () => r)(token(), 'cid', 'n1', now), null);
    assert.equal(await createGoogleIdTokenReader(async () => {throw new Error('offline');})(token(), 'cid', 'n1', now), null);
  });
  await test('token header URLs cannot choose a signing authority', async () => {
    const read = createGoogleIdTokenReader(async url => {assert.equal(url, 'https://www.googleapis.com/oauth2/v3/certs'); return response([a.jwk]);});
    assert.ok(await read(token({}, a, {jku: 'https://evil.invalid/keys', x5u: 'https://evil.invalid/cert'}), 'cid', 'n1', now));
    assert.equal(await read(token({}, a, {crit: ['untrusted']}), 'cid', 'n1', now), null);
  });
  await test('altered payload/signature and retired key after rotation fail', async () => {
    let requests = 0;
    const read = createGoogleIdTokenReader(async () => response(++requests === 1 ? [a.jwk] : [b.jwk], 1));
    const signed = token();
    const parts = signed.split('.');
    parts[1] = Buffer.from(JSON.stringify({...claims, email: 'attacker@example.invalid'})).toString('base64url');
    assert.equal(await read(parts.join('.'), 'cid', 'n1', now), null);
    const signature = signed.split('.');
    signature[2] = (signature[2][0] === 'A' ? 'B' : 'A') + signature[2].slice(1);
    assert.equal(await read(signature.join('.'), 'cid', 'n1', now), null);
    assert.ok(await read(signed, 'cid', 'n1', now));
    assert.ok(await read(token({}, b), 'cid', 'n1', now + 1000));
    assert.equal(await read(signed, 'cid', 'n1', now + 1000), null);
  });
  await test('unknown kid cooldown expires and can recover the new key', async () => {
    let requests = 0;
    const read = createGoogleIdTokenReader(async () => response(++requests < 3 ? [a.jwk] : [a.jwk, b.jwk]));
    assert.ok(await read(token(), 'cid', 'n1', now));
    assert.equal(await read(token({}, b), 'cid', 'n1', now + 1000), null);
    assert.equal(await read(token({}, b), 'cid', 'n1', now + 2000), null);
    assert.equal(requests, 2);
    assert.ok(await read(token({}, b), 'cid', 'n1', now + 31000));
    assert.equal(requests, 3);
  });
  await test('cache Age and no-store force refresh instead of stale trust', async () => {
    for (const headers of [{'cache-control': 'max-age=3600', age: '3600'}, {'cache-control': 'no-store, max-age=3600'}]) {
      let requests = 0;
      const read = createGoogleIdTokenReader(async () => {
        requests++;
        return new Response(JSON.stringify({keys: [a.jwk]}), {headers});
      });
      assert.ok(await read(token(), 'cid', 'n1', now));
      assert.ok(await read(token(), 'cid', 'n1', now));
      assert.equal(requests, 2);
    }
  });
  await test('callback awaits verification before using any identity', async () => {
    const callback = fs.readFileSync(path.resolve(__dirname, '../src/app/api/auth/google/callback/route.ts'), 'utf8');
    assert.match(callback, /\? await readIdToken\(tokens.id_token, cfg.clientId, nonce\) : null/);
    assert.ok(callback.indexOf('await readIdToken') < callback.indexOf('await redeemInvite'));
    assert.match(callback, /if \(!identity \|\| !identity.emailVerified\) return fail\('google_failed'\)/);
  });
  console.log(`${count} Google signature checks passed`);
})().catch(e => {console.error(e); process.exit(1);});
