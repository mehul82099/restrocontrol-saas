// GST pricing rule: 18% GST on top of every plan's base price (owner-approved 2026-10-16).
// No database required: node tests/gst-billing.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const jiti = require('jiti')(__filename, { alias: { '@': require('path').resolve(__dirname, '../src') } });
const { GST_RATE_BPS, GST_RATE_LABEL, gstBreakup, formatINR } = jiti('../src/lib/gst.ts');
const { SUBSCRIPTION_PLANS, planBreakup } = jiti('../src/lib/subscription-plans.ts');

assert.equal(GST_RATE_BPS, 1800);
assert.equal(GST_RATE_LABEL, '18%');

// Exact owner-confirmed example: Rs 499 + 18% GST = Rs 588.82
assert.deepEqual(gstBreakup(49900), { basePaise: 49900, gstPaise: 8982, totalPaise: 58882 });
assert.deepEqual(gstBreakup(69900), { basePaise: 69900, gstPaise: 12582, totalPaise: 82482 });
assert.deepEqual(gstBreakup(99900), { basePaise: 99900, gstPaise: 17982, totalPaise: 117882 });

// Rounding to paise: 1 paisa base -> 0 GST; odd amounts round half up
assert.deepEqual(gstBreakup(0), { basePaise: 0, gstPaise: 0, totalPaise: 0 });
assert.equal(gstBreakup(1).gstPaise, 0);
assert.equal(gstBreakup(3).gstPaise, 1); // 0.54 paise -> 1
assert.throws(() => gstBreakup(-1));
assert.throws(() => gstBreakup(1.5));

// Formatting uses Indian grouping with exact paise
assert.equal(formatINR(58882), '₹588.82');
assert.equal(formatINR(117882), '₹1,178.82');
assert.equal(formatINR(49900), '₹499.00');

// Every catalogue plan gets the GST breakup; totals are what TEST checkout must charge
const totals = Object.fromEntries(SUBSCRIPTION_PLANS.map(p => [p.code, planBreakup(p).totalPaise]));
assert.deepEqual(totals, { WEBSITE_SINGLE: 58882, WEBSITE_MULTI: 82482, APP_SINGLE: 82482, APP_MULTI: 117882 });

// Server verification must compare the Razorpay plan amount to the GST-inclusive total
const billing = fs.readFileSync('src/server/billing/razorpay-test.ts', 'utf8');
assert.match(billing, /remote\.item\?\.amount!==planBreakup\(plan\)\.totalPaise/);
assert.doesNotMatch(billing, /remote\.item\?\.amount!==plan\.price\*100/);

console.log('PASS: 18% GST breakup, paise rounding, INR formatting, all four plan totals, server GST-inclusive verification');
