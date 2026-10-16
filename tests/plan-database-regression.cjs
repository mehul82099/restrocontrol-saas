// Isolated local database only. Creates/deletes its own random fixtures, not live data.
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const host = new URL(process.env.DATABASE_URL || '').hostname;
if (!['127.0.0.1','localhost','[::1]'].includes(host)) throw new Error('An isolated localhost database is required.');
const jiti = require('jiti')(__filename,{alias:{'@':path.resolve(__dirname,'../src')}});
const { prisma } = jiti('../src/server/db/prisma.ts');
const { SubscriptionService:S } = jiti('../src/server/services/subscription.service.ts');
const tag = 'plan-test-'+crypto.randomUUID();
let single, multi, missing;
(async()=>{
  await S.seedStandardPlans();
  const rows = await prisma.plan.findMany({where:{code:{in:['WEBSITE_SINGLE','WEBSITE_MULTI','APP_SINGLE','APP_MULTI']}}});
  assert.equal(rows.length,4);
  const by = Object.fromEntries(rows.map(p=>[p.code,p]));
  assert.equal(by.WEBSITE_SINGLE.maxOutlets,1);
  assert.equal(by.WEBSITE_MULTI.maxOutlets,null);
  for(const code of ['WEBSITE_SINGLE','WEBSITE_MULTI']) {assert.equal(by[code].maxUsers,null);assert.equal(by[code].maxOrdersPerMonth,null);assert.equal(by[code].priceYearly,null);}
  async function fixture(suffix,code,outlets=1,legacy=false) {
    const r=await prisma.restaurant.create({data:{name:tag+suffix,slug:tag+suffix}});
    await prisma.outlet.createMany({data:Array.from({length:outlets},(_,i)=>({restaurantId:r.id,name:'Outlet '+i,code:'O'+i,isDefault:i===0}))});
    if(code) await prisma.subscription.create({data:{restaurantId:r.id,planId:by[code].id,status:'ACTIVE',currentPeriodStart:new Date('2026-01-01'),currentPeriodEnd:new Date('2026-02-01')}});
    return r;
  }
  single=await fixture('-single','WEBSITE_SINGLE');
  multi=await fixture('-multi','WEBSITE_MULTI',3);
  missing=await fixture('-missing',null);
  assert.equal((await S.canPerformAction(single.id,'ADD_OUTLET')).allowed,false);
  assert.equal((await S.canPerformAction(single.id,'ADD_USER')).allowed,true);
  assert.equal((await S.canPerformAction(single.id,'CREATE_ORDER')).allowed,true);
  assert.equal((await S.canPerformAction(multi.id,'ADD_OUTLET')).allowed,true);
  const created=await S.getRestaurantSubscription(missing.id);
  assert.equal(created.status,'TRIALING');
  assert.equal(created.currentPeriodEnd.getTime()-missing.createdAt.getTime(),14*86400000);
  await prisma.subscription.update({where:{restaurantId:single.id},data:{planId:by.APP_SINGLE.id}});
  assert.equal((await S.canPerformAction(single.id,'CREATE_ORDER')).allowed,false);
  await prisma.subscription.update({where:{restaurantId:single.id},data:{planId:by.WEBSITE_SINGLE.id,status:'TRIALING',currentPeriodEnd:new Date('2020-01-01')}});
  assert.equal((await S.canPerformAction(single.id,'CREATE_ORDER')).allowed,false);
  const before=await prisma.subscription.findUnique({where:{restaurantId:multi.id}});
  const fs=require('node:fs'),os=require('node:os');
  const config=path.join(os.tmpdir(),tag+'.json');
  function run(assignments,apply=false) {
    fs.writeFileSync(config,JSON.stringify({restaurantAssignments:assignments}));
    return JSON.parse(execFileSync(process.execPath,['scripts/reconcile-plan-catalog.cjs','--config='+config,...(apply?['--apply']:[])],{cwd:path.resolve(__dirname,'..'),env:process.env,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
  }
  const report=run({[multi.id]:'WEBSITE_MULTI'});
  assert.equal(report.dryRun,true);
  assert.throws(()=>run({[multi.id]:'WEBSITE_SINGLE'},true));
  assert.throws(()=>run({[multi.id]:'APP_MULTI'},true));
  run({[multi.id]:'WEBSITE_MULTI'},true);
  const after=await prisma.subscription.findUnique({where:{restaurantId:multi.id}});
  for(const key of ['status','currentPeriodStart','currentPeriodEnd']) assert.equal(String(after[key]),String(before[key]));
  fs.unlinkSync(config);
  console.log('PASS: DB catalogue, true unlimited quotas, one-outlet cap, unavailable plans, expired trials, missing billing state, dry-run and safe mapping guards, period/status preservation');
})().finally(async()=>{
  for(const r of [single,multi,missing]) if(r) await prisma.restaurant.delete({where:{id:r.id}});
  await prisma.$disconnect();
}).catch(error=>{console.error(error);process.exitCode=1;});
