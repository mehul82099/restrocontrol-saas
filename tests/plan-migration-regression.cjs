const assert = require('node:assert/strict');
const { compile, CATALOG } = require('../scripts/reconcile-plan-catalog.cjs');
assert.deepEqual(CATALOG.map(p=>p.price),[499,699,699,999]);
assert.deepEqual(CATALOG.map(p=>p.upcoming),[false,false,true,true]);
assert.throws(()=>compile({}),/cadence/);
assert.throws(()=>compile({billingFrequency:'MONTHLY',monthlyCadenceConfirmed:true}),/quotas/);
// Synthetic test quotas are not business defaults and are never used in a seed.
const config = {billingFrequency:'MONTHLY',monthlyCadenceConfirmed:true,quotas:Object.fromEntries(CATALOG.map(p=>[p.code,{maxOutlets:p.code.endsWith('_MULTI')?2:1,maxUsers:1,maxOrdersPerMonth:1,hasAdvancedReports:false,hasAiFeatures:false}]))};
const result = compile(config);
assert.deepEqual(result.map(p=>p.priceMonthly),[499,699,699,999]);
config.quotas.WEBSITE_SINGLE.maxOutlets = 2;
assert.throws(()=>compile(config),/one outlet/);
config.quotas.WEBSITE_SINGLE.maxOutlets = 1;
config.quotas.WEBSITE_MULTI.maxUsers = null;
assert.throws(()=>compile(config),/Explicit positive quota/);
console.log('PASS: cadence/quota gates, exact four prices, upcoming flags and no guessed quota defaults');
