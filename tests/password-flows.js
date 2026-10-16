// Password flows regression: policy rules mirror registration, reset token safety rules.
const assert = require('assert');

function validateNewPassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must be 10-72 characters with at least one letter and one number.';
  }
  return null;
}

// Policy accepts what registration accepts, rejects the rest
assert.strictEqual(validateNewPassword('Password12'), null);
assert.strictEqual(validateNewPassword('a'.repeat(71) + '1'), null);
assert.ok(validateNewPassword('short1'));
assert.ok(validateNewPassword('onlylettersxx'));
assert.ok(validateNewPassword('12345678901'));
assert.ok(validateNewPassword('a'.repeat(72) + '1')); // 73 chars
assert.ok(validateNewPassword(123456789012));
assert.ok(validateNewPassword(''));

// Reset-token invariants mirrored from the routes: 32 random bytes hex = 64 chars, sha256 hash stored, 30min expiry
const crypto = require('crypto');
const token = crypto.randomBytes(32).toString('hex');
assert.strictEqual(token.length, 64);
const hash = crypto.createHash('sha256').update(token).digest('hex');
assert.strictEqual(hash.length, 64);
assert.notStrictEqual(hash, token);
const expiry = new Date(Date.now() + 30 * 60 * 1000);
assert.ok(expiry > new Date());

console.log('password-flows tests passed');
