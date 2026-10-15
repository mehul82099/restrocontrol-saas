if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) throw new Error('Local test database required');
const assert = require('node:assert/strict');
const path = require('path');
const jiti = require('jiti')(__filename, {alias: {'@': path.resolve(__dirname, '../src')}});
const {NextRequest} = require('next/server');
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
process.env.WEB_PUSH_PUBLIC_KEY = keys.publicKey; process.env.WEB_PUSH_PRIVATE_KEY = keys.privateKey; process.env.WEB_PUSH_SUBJECT = 'mailto:test@example.invalid';
const {prisma} = jiti('../src/server/db/prisma');
const {signToken} = jiti('../src/server/auth/jwt');
const {sessionHash, validPushEndpoint, orderAudience} = jiti('../src/server/services/push-policy');
const {GET: live} = jiti('../src/app/api/live/orders/route');
const {POST: subscribe, DELETE: unsubscribe} = jiti('../src/app/api/push/subscription/route');
const {GET: current} = jiti('../src/app/api/push/current/route');
const {POST: logout} = jiti('../src/app/api/auth/logout/route');
const {notifyOrderStaff} = jiti('../src/server/services/staff-push.service');
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS', name); }
async function main() {
 const restaurant = await prisma.restaurant.findUnique({where:{slug:'demo-kitchen'}});
 const outlet = await prisma.outlet.findFirst({where:{restaurantId:restaurant.id,isDefault:true}});
 const owner = await prisma.user.findFirst({where:{restaurantId:restaurant.id,role:'OWNER'}});
 const kitchen = await prisma.user.findFirst({where:{restaurantId:restaurant.id,role:'KITCHEN_STAFF'}});
 const inventory = await prisma.user.findFirst({where:{restaurantId:restaurant.id,role:'INVENTORY_MANAGER'}});
 const token = u => signToken({userId:u.id,restaurantId:u.restaurantId,role:u.role,email:u.email,name:u.name,outletId:outlet.id});
 const ownerToken = token(owner), kitchenToken = token(kitchen);
 const req = (route, tok = ownerToken, method = 'GET', body, out = outlet.id, origin) => new NextRequest('http://localhost:3000'+route, {method, headers:{cookie:`token=${tok}`, 'x-outlet-id':out, ...(origin?{origin}:{}), ...(body?{'content-type':'application/json'}:{})}, ...(body?{body:JSON.stringify(body)}:{})});
 const body = {endpoint:'https://fcm.googleapis.com/fcm/send/local-test-only',keys:{p256dh:keys.publicKey,auth:Buffer.alloc(16,7).toString('base64url')}};
 const revision = async () => (await (await live(req('/api/live/orders'))).json()).revision;
 await test('HTTPS push service allowlist rejects SSRF, userinfo, ports and spoofed suffix', async()=>{
   for (const url of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.invalid/x','https://x@fcm.googleapis.com/x','https://fcm.googleapis.com:444/x']) assert.equal(validPushEndpoint(url),false);
   assert.equal(validPushEndpoint(body.endpoint),true);
 });
 await test('Only order-facing roles in audience',async()=>{for(const role of ['OWNER','MANAGER','CASHIER','KITCHEN_STAFF'])assert.equal(orderAudience(role),true);assert.equal(orderAudience('INVENTORY_MANAGER'),false);});
 await test('Live feed requires authenticated user and permitted role', async()=>{assert.equal((await live(req('/api/live/orders','invalid'))).status,401);assert.equal((await live(req('/api/live/orders',token(inventory)))).status,403);assert.equal((await live(req('/api/live/orders',kitchenToken))).status,200);});
 await test('Foreign outlet rejected',async()=>{assert.equal((await live(req('/api/live/orders',ownerToken,'GET',undefined,'foreign'))).status,403);});
 await test('Revision changes after create, cancel and kitchen updates',async()=>{
   const start=await revision(); const order=await prisma.order.create({data:{restaurantId:restaurant.id,outletId:outlet.id,orderNumber:'LIVE-'+Date.now(),orderType:'TAKEAWAY',subtotal:1,totalAmount:1,status:'CONFIRMED'}});
   const created=await revision();assert.notEqual(start,created);
   await prisma.order.update({where:{id:order.id},data:{status:'CANCELLED'}});const cancelled=await revision();assert.notEqual(created,cancelled);
   const kot=await prisma.kitchenOrder.create({data:{orderId:order.id,restaurantId:restaurant.id,outletId:outlet.id,kotNumber:'LIVE-'+Date.now()}});const before=await revision();
   await prisma.kitchenOrder.update({where:{id:kot.id},data:{status:'READY'}});assert.notEqual(before,await revision());
 });
 await test('Foreign tenant order does not change revision', async()=>{
   const r=await prisma.restaurant.create({data:{name:'Live isolated',slug:'live-test-'+Date.now()}});const o=await prisma.outlet.create({data:{restaurantId:r.id,name:'Foreign',code:'X'}});const before=await revision();
   await prisma.order.create({data:{restaurantId:r.id,outletId:o.id,orderNumber:'FOREIGN',orderType:'TAKEAWAY',subtotal:1,totalAmount:1}});assert.equal(await revision(),before);
   await prisma.restaurant.delete({where:{id:r.id}});
 });
 await test('Cross-origin subscription rejected',async()=>{assert.equal((await subscribe(req('/api/push/subscription',ownerToken,'POST',body,outlet.id,'https://evil.invalid'))).status,403);});
 await test('Browser subscription binds authenticated tenant, outlet, session and expiry',async()=>{
   assert.equal((await subscribe(req('/api/push/subscription',ownerToken,'POST',body))).status,200);
   const row=await prisma.staffPushSubscription.findUnique({where:{endpoint:body.endpoint}});assert.equal(row.restaurantId,restaurant.id);assert.equal(row.outletId,outlet.id);assert.equal(row.sessionHash,sessionHash(ownerToken));assert(row.expiresAt>new Date());
 });
 const id=(await prisma.staffPushSubscription.findUnique({where:{endpoint:body.endpoint}})).id;
 await test('Queued push only displays for the same active login',async()=>{assert.equal((await current(req('/api/push/current?id='+id))).status,200);assert.equal((await current(req('/api/push/current?id='+id,kitchenToken))).status,401);assert.equal((await current(req('/api/push/current?id='+id,''))).status,401);});
 await test('Disabled staff cannot receive queued push',async()=>{await prisma.user.update({where:{id:owner.id},data:{isActive:false}});assert.equal((await current(req('/api/push/current?id='+id))).status,401);await prisma.user.update({where:{id:owner.id},data:{isActive:true}});});
 await test('Unassigned outlet revokes queued push',async()=>{await prisma.outlet.update({where:{id:outlet.id},data:{isActive:false}});assert.equal((await current(req('/api/push/current?id='+id))).status,403);await prisma.outlet.update({where:{id:outlet.id},data:{isActive:true}});});
 await test('Logout deletes subscriptions for this session and cookie',async()=>{const response=await logout(req('/api/auth/logout',ownerToken,'POST'));assert.equal(response.status,200);assert(response.headers.get('set-cookie').includes('token='));assert.equal(await prisma.staffPushSubscription.count({where:{sessionHash:sessionHash(ownerToken)}}),0);assert.equal((await current(req('/api/push/current?id='+id))).status,401);});
 await test('Expired subscription cannot display',async()=>{await subscribe(req('/api/push/subscription',ownerToken,'POST',body));const row=await prisma.staffPushSubscription.findUnique({where:{endpoint:body.endpoint}});await prisma.staffPushSubscription.update({where:{id:row.id},data:{expiresAt:new Date(0)}});assert.equal((await current(req('/api/push/current?id='+row.id))).status,401);});
 await test('Push off by default without keys; order path does not throw',async()=>{const key=process.env.WEB_PUSH_PRIVATE_KEY;delete process.env.WEB_PUSH_PRIVATE_KEY;await notifyOrderStaff(restaurant.id,outlet.id);process.env.WEB_PUSH_PRIVATE_KEY=key;});
 await test('Unsubscribe removes only current login subscriptions',async()=>{await subscribe(req('/api/push/subscription',ownerToken,'POST',body));assert.equal((await unsubscribe(req('/api/push/subscription',ownerToken,'DELETE'))).status,200);assert.equal(await prisma.staffPushSubscription.count({where:{sessionHash:sessionHash(ownerToken)}}),0);});
 await test('Sender rechecks current permission and removes forbidden registration',async()=>{
   await subscribe(req('/api/push/subscription',ownerToken,'POST',body));
   let sends=0;const original=webpush.sendNotification;webpush.sendNotification=async()=>{sends++;return {statusCode:201}};
   try { await prisma.user.update({where:{id:owner.id},data:{role:'INVENTORY_MANAGER'}});await notifyOrderStaff(restaurant.id,outlet.id);assert.equal(sends,0);assert.equal(await prisma.staffPushSubscription.count({where:{endpoint:body.endpoint}}),0); }
   finally {await prisma.user.update({where:{id:owner.id},data:{role:'OWNER'}});webpush.sendNotification=original;}
 });
 await test('Delivery carries no customer/order content and removes gone endpoint',async()=>{
   await subscribe(req('/api/push/subscription',ownerToken,'POST',body));
   const original=webpush.sendNotification;let sends=0;
   webpush.sendNotification=async (subscription,payload,options)=>{sends++;assert.deepEqual(Object.keys(JSON.parse(payload)),['subscriptionId']);assert.equal(options.TTL,30);throw {statusCode:410};};
   try {await notifyOrderStaff(restaurant.id,outlet.id);assert.equal(sends,1);assert.equal(await prisma.staffPushSubscription.count({where:{endpoint:body.endpoint}}),0);}
   finally {webpush.sendNotification=original;}
 });
 await test('Worker suppresses unauthorized/offline deliveries and shows only generic authorized text',async()=>{
   const vm=require('node:vm'),source=require('node:fs').readFileSync(path.resolve(__dirname,'../public/staff-push-sw.js'),'utf8');
   const handlers={},shown=[];let ok=false,offline=false;
   const self={location:{origin:'https://local.invalid'},clients:{matchAll:async()=>[]},registration:{showNotification:async(...args)=>shown.push(args)},addEventListener:(name,callback)=>handlers[name]=callback};
   vm.runInNewContext(source,{self,fetch:async()=>{if(offline)throw new Error('offline');return {ok,json:async()=>({success:true,url:'/orders'})}},URL,encodeURIComponent});
   const deliver=async()=>{let job;handlers.push({data:{json:()=>({subscriptionId:'local-only'})},waitUntil:p=>job=p});await job;};
   await deliver();assert.equal(shown.length,0);offline=true;await deliver();assert.equal(shown.length,0);offline=false;ok=true;await deliver();assert.equal(shown.length,1);assert.equal(shown[0][0],'RestroControl');assert.equal(shown[0][1].body,'Order activity updated. Open your staff screen.');
 });
 console.log(passed+' LIVE ORDER / PUSH REGRESSIONS PASSED');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
