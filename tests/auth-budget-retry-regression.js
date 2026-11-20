// Pure unit test, no database needed: transient-error retry around the auth rate-limit query.
const assert = require('node:assert/strict');
const path = require('path');
const jiti = require('jiti')(__filename, {alias: {'@': path.resolve(__dirname, '../src')}});
const {isTransientDbError, withTransientDbRetry} = jiti('../src/server/services/auth-request-security');
(async () => {
  assert.equal(isTransientDbError({name: 'PrismaClientInitializationError', message: 'x'}), true);
  for (const code of ['P1001', 'P1002', 'P1017', 'P2024']) assert.equal(isTransientDbError({code}), true, code);
  assert.equal(isTransientDbError({errorCode: 'P1001'}), true);
  for (const e of [{code: 'P2002'}, new Error('boom'), new SyntaxError('x'), null, undefined, 'P1001']) assert.equal(isTransientDbError(e), false);

  let calls = 0;
  assert.equal(await withTransientDbRetry(async () => { calls++; if (calls < 3) throw {code: 'P1001'}; return 'ok'; }, [1, 1]), 'ok');
  assert.equal(calls, 3, 'recovers after two transient failures');

  calls = 0;
  await assert.rejects(withTransientDbRetry(async () => { calls++; throw {code: 'P2024'}; }, [1, 1]), e => e.code === 'P2024');
  assert.equal(calls, 3, 'gives up after 2 retries');

  calls = 0;
  await assert.rejects(withTransientDbRetry(async () => { calls++; throw new Error('logic'); }, [1, 1]), /logic/);
  assert.equal(calls, 1, 'non-transient errors are not retried');

  calls = 0;
  assert.equal(await withTransientDbRetry(async () => { calls++; return 7; }), 7);
  assert.equal(calls, 1);
  console.log('PASS auth budget retry: transient-only, bounded retries');
})().catch(e => { console.error(e); process.exitCode = 1; });
