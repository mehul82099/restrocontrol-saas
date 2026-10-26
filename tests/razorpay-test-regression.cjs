const assert=require('node:assert/strict'),crypto=require('node:crypto');
const host=new URL(process.env.DATABASE_URL||'').hostname;if(!['localhost','127.0.0.1'].includes(host))throw new Error('Isolated local DB only');
const jiti=require('jiti')(__filename,{alias:{'@':require('path').resolve(__dirname,'../src')}});const {prisma}=jiti('../src/server/db/prisma');const {issueAttendanceToken}=jiti('../src/server/services/attendance.service');const tokens=new Map();const {NextRequest}=require('next/server');
const {testConfig,validSignature}=jiti('../src/server/billing/razorpay-test');
const checkout=jiti('../src/app/api/billing/test/checkout/route'),verify=jiti('../src/app/api/billing/test/verify/route'),upgrade=jiti('../src/app/api/billing/test/upgrade/route'),cancel=jiti('../src/app/api/billing/test/cancel/route'),webhook=jiti('../src/app/api/billing/test/webhook/route');
let restaurants=[];const fetchOriginal=global.fetch;let calls=[],status='created',plan='plan_test_single',remoteId='sub_test_subscription';
async function request(u,path,body){return new NextRequest('http://localhost/api/billing/test/'+path,{method:'POST',headers:{authorization:'Bearer '+(tokens.get(u.id)||await (async()=>{const t=await issueAttendanceToken({userId:u.id,restaurantId:u.restaurantId,role:u.role,email:u.email,name:u.name});tokens.set(u.id,t);return t;})()),'Content-Type':'application/json'},body:JSON.stringify(body)});}
(async()=>{
 process.env.JWT_SECRET='random-local-only-test-key-for-subscriptions-09843724';
 delete process.env.RAZORPAY_TEST_ENABLED;assert.throws(testConfig);process.env.RAZORPAY_TEST_ENABLED='true';process.env.RAZORPAY_TEST_KEY_ID='rzp_live_rejected';process.env.RAZORPAY_TEST_KEY_SECRET='mock_secret';assert.throws(testConfig);process.env.RAZORPAY_TEST_KEY_ID='rzp_test_mock';process.env.RAZORPAY_TEST_PLAN_SINGLE='plan_test_single';process.env.RAZORPAY_TEST_PLAN_MULTI='plan_test_multi';process.env.RAZORPAY_TEST_WEBHOOK_SECRET='mock_webhook_secret';process.env.VERCEL_ENV='production';delete process.env.RAZORPAY_TEST_ALLOW_PRODUCTION;assert.throws(testConfig);process.env.RAZORPAY_TEST_ALLOW_PRODUCTION='yes';assert.throws(testConfig);process.env.RAZORPAY_TEST_ALLOW_PRODUCTION='true';assert.doesNotThrow(testConfig);process.env.RAZORPAY_TEST_KEY_ID='rzp_live_rejected';assert.throws(testConfig);process.env.RAZORPAY_TEST_KEY_ID='rzp_test_mock';delete process.env.RAZORPAY_TEST_ALLOW_PRODUCTION;process.env.VERCEL_ENV='preview';
 assert.equal(validSignature('abc','short','secret'),false);
 global.fetch=async(url,opts={})=>{calls.push({url,method:opts.method,body:opts.body&&JSON.parse(opts.body)});const path=url.split('/v1/')[1];let b;
 if(path.startsWith('plans/')){const amount=path.endsWith('single')?58882:82482;b={id:path.split('/')[1],period:'monthly',interval:1,item:{amount,currency:'INR'}};}
 else if(path==='subscriptions'){b={id:remoteId,status,plan_id:plan};}
 else if(path.endsWith('/cancel')){status='cancelled';b={id:remoteId,status,plan_id:plan};}
 else b={id:remoteId,status,plan_id:plan,current_start:100,current_end:200};
 return {ok:true,json:async()=>b};};
 async function fixture(s){const r=await prisma.restaurant.create({data:{name:'Billing '+s,slug:'billing-'+crypto.randomUUID()}});restaurants.push(r);await prisma.outlet.create({data:{restaurantId:r.id,name:'Test',code:'T'}});return prisma.user.create({data:{restaurantId:r.id,name:'Test',email:'test@example.invalid',passwordHash:'TEST',role:'OWNER'}});}
 const user=await fixture('one'),other=await fixture('two');const body={planCode:'WEBSITE_SINGLE',testOnly:true};
 assert.equal((await checkout.POST(await request(user,'checkout',{...body,planCode:'APP_SINGLE'}))).status,400);
 const created=(await(await checkout.POST(await request(user,'checkout',body))).json()).subscription;assert.equal(created.providerId,remoteId);
 const creation=calls.find(c=>c.url.endsWith('/subscriptions'));assert.equal(creation.body.customer_notify,false);assert.equal(creation.body.total_count,2);assert.equal(creation.body.quantity,1);
 await checkout.POST(await request(user,'checkout',body));assert.equal(calls.filter(c=>c.url.endsWith('/subscriptions')).length,1);
 assert.equal((await prisma.subscription.count({where:{restaurantId:user.restaurantId}})),0);
 assert.equal((await verify.POST(await request(user,'verify',{razorpay_subscription_id:remoteId,razorpay_payment_id:'pay_test',razorpay_signature:'bad'}))).status,400);
 const signature=crypto.createHmac('sha256','mock_secret').update('pay_test|'+remoteId).digest('hex');status='active';
 assert.equal((await verify.POST(await request(other,'verify',{razorpay_subscription_id:remoteId,razorpay_payment_id:'pay_test',razorpay_signature:signature}))).status,400);
 assert.equal((await verify.POST(await request(user,'verify',{razorpay_subscription_id:remoteId,razorpay_payment_id:'pay_test',razorpay_signature:signature}))).status,200);
 assert.equal((await upgrade.POST(await request(user,'upgrade',{testOnly:true,schedule:'now'}))).status,400);
 assert.equal((await upgrade.POST(await request(user,'upgrade',{testOnly:true,schedule:'cycle_end'}))).status,200);
 const patch=calls.find(c=>c.method==='PATCH');assert.equal(patch.body.schedule_change_at,'cycle_end');assert.equal(patch.body.plan_id,'plan_test_multi');assert.equal(patch.body.customer_notify,false);
 let row=await prisma.testBillingSubscription.findUnique({where:{restaurantId:user.restaurantId}});assert.equal(row.planCode,'WEBSITE_SINGLE');assert.equal(row.pendingPlanCode,'WEBSITE_MULTI');
 plan='plan_test_multi';status='active';const eventId='evt_'+crypto.randomUUID();
 function event(signatureOverride){const raw=JSON.stringify({event:'subscription.charged',payload:{subscription:{entity:{id:remoteId,status:'halted'}}}});return new NextRequest('http://localhost/api/billing/test/webhook',{method:'POST',headers:{'x-razorpay-event-id':eventId,'x-razorpay-signature':signatureOverride||crypto.createHmac('sha256','mock_webhook_secret').update(raw).digest('hex')},body:raw});}
 assert.equal((await webhook.POST(event('bad'))).status,400);assert.equal((await webhook.POST(event())).status,200);assert.equal((await(await webhook.POST(event())).json()).duplicate,true);
 row=await prisma.testBillingSubscription.findUnique({where:{restaurantId:user.restaurantId}});assert.equal(row.planCode,'WEBSITE_MULTI');assert.equal(row.pendingPlanCode,null);assert.equal(row.providerStatus,'active');
 assert.equal((await cancel.POST(await request(user,'cancel',{testOnly:true}))).status,200);row=await prisma.testBillingSubscription.findUnique({where:{restaurantId:user.restaurantId}});assert.equal(row.providerStatus,'cancelled');
 assert.equal(await prisma.subscription.count({where:{restaurantId:user.restaurantId}}),0);
 console.log('PASS TEST-only/live-key/production gates, exact plan amounts, disabled app plans, duplicate creation safety, signature/tenant verification, next-cycle upgrade only, pending plan separation, webhook HMAC/dedupe/current-state refresh, cancellation, zero real entitlement changes');
})().finally(async()=>{global.fetch=fetchOriginal;await prisma.testBillingEvent.deleteMany({where:{providerId:remoteId}});for(const r of restaurants){await prisma.testBillingSubscription.deleteMany({where:{restaurantId:r.id}});await prisma.restaurant.delete({where:{id:r.id}});}await prisma.$disconnect();}).catch(e=>{console.error(e);process.exitCode=1;});
