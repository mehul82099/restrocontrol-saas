const assert = require('node:assert/strict');
const { compile } = require('../scripts/reconcile-plan-catalog.cjs');
const rows = compile();
assert.deepEqual(rows.map(p=>p.priceMonthly),[499,699,699,999]);
assert.deepEqual(rows.map(p=>p.isAvailable),[true,true,false,false]);
assert.deepEqual(rows.map(p=>p.priceYearly),[null,null,null,null]);
assert.equal(rows[0].maxOutlets,1);
assert.equal(rows[1].maxOutlets,null);
for (const row of rows.slice(0,2)) {assert.equal(row.maxUsers,null);assert.equal(row.maxOrdersPerMonth,null);}
assert.equal(rows.length,4);
console.log('PASS: exact monthly catalogue, explicit nullable unlimited quotas, no annual offer, app plans unavailable');
