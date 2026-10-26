if (!/^postgres(?:ql)?:\/\/[^/]*@(127\.0\.0\.1|localhost):\d+\//.test(process.env.DATABASE_URL || '')) throw new Error('Explicit isolated local DB required');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jiti = require('jiti')(__filename, {alias: {'@': require('path').resolve(__dirname, '../src')}});
const {prisma} = jiti('../src/server/db/prisma');
const {signToken, verifyToken} = jiti('../src/server/auth/jwt');
const {issueAttendanceToken} = jiti('../src/server/services/attendance.service');
const {authenticateRequest} = jiti('../src/server/auth/middleware');
const {POST: logout} = jiti('../src/app/api/auth/logout/route');
const {POST: reset} = jiti('../src/app/api/auth/reset-password/route');
const {POST: change} = jiti('../src/app/api/auth/change-password/route');
const {GET: live} = jiti('../src/app/api/live/orders/route');
const {NextRequest} = require('next/server');
const bcrypt = require('bcryptjs');
let count=0;
const test = async (name, fn) => {await fn();count++;console.log('PASS '+name);};
const req=(token, body, path='/api/auth/me', bearer=false)=>new NextRequest('http://localhost:3000'+path,{method:body?'POST':'GET',headers:{...(bearer?{authorization:'Bearer '+token}:{cookie:'token='+token}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
let restaurant;
async function main(){
 restaurant=await prisma.restaurant.create({data:{name:'Session fixture',slug:'session-'+crypto.randomUUID()}});
 const outlet=await prisma.outlet.create({data:{restaurantId:restaurant.id,name:'Main',code:'MAIN',isDefault:true}});
 const password='old-safe-password123', passwordHash=await bcrypt.hash(password,12);
 const users={};
 for(const role of ['OWNER','CASHIER']) users[role]=await prisma.user.create({data:{restaurantId:restaurant.id,email:role+crypto.randomUUID()+'@invalid.test',name:role,role,passwordHash,userOutlets:{create:{outletId:outlet.id}}}});
 const payload=u=>({userId:u.id,restaurantId:restaurant.id,role:u.role,email:u.email,name:u.name,outletId:outlet.id});
 const mint=u=>issueAttendanceToken(payload(u));
 const denied=async t=>assert.equal((await authenticateRequest(req(t))).errorResponse?.status,401);
 for(const u of Object.values(users)){
   const a=await mint(u), b=await mint(u);
   await test(u.role+' persisted login works and legacy JWT rejected',async()=>{assert.ok((await authenticateRequest(req(a))).auth);await denied(signToken(payload(u)));assert.equal((await live(req(signToken(payload(u)),null,'/api/live/orders'))).status,401);});
   await test(u.role+' logout revokes copied cookie and bearer but preserves other device',async()=>{assert.equal((await logout(req(a,{},'/api/auth/logout',true))).status,200);await denied(a);assert.equal((await live(req(a,null,'/api/live/orders'))).status,401);assert.ok((await authenticateRequest(req(b))).auth);});
 }
 await test('Staff attendance must remain open even with active AuthSession',async()=>{const t=await mint(users.CASHIER);await prisma.attendanceSession.update({where:{id:verifyToken(t).attendanceSessionId},data:{checkedOutAt:new Date()}});await denied(t);assert.equal((await live(req(t,null,'/api/live/orders'))).status,401);});
 await test('Session/attendance ids from another user or tenant rejected',async()=>{const owner=await mint(users.OWNER), staff=await mint(users.CASHIER);await denied(signToken({...payload(users.CASHIER),authSessionId:verifyToken(owner).authSessionId,attendanceSessionId:verifyToken(staff).attendanceSessionId}));await denied(signToken({...payload(users.OWNER),authSessionId:verifyToken(owner).authSessionId,restaurantId:crypto.randomUUID()}));});
 await test('Expired login row rejected',async()=>{const t=await mint(users.OWNER);await prisma.authSession.update({where:{id:verifyToken(t).authSessionId},data:{expiresAt:new Date(0)}});await denied(t);});
 await test('Password change invalidates all owner logins and pending reset links',async()=>{
  const a=await mint(users.OWNER), b=await mint(users.OWNER);
  await prisma.passwordResetToken.create({data:{userId:users.OWNER.id,tokenHash:crypto.randomUUID(),expiresAt:new Date(Date.now()+60000)}});
  assert.equal((await change(req(a,{currentPassword:password,newPassword:'new-safe-password123'},'/api/auth/change-password'))).status,200);
  await denied(a);await denied(b);assert.equal(await prisma.passwordResetToken.count({where:{userId:users.OWNER.id,usedAt:null}}),0);
  await assert.rejects(()=>issueAttendanceToken(payload(users.OWNER),passwordHash));
  assert.ok((await authenticateRequest(req(await mint(users.OWNER)))).auth);
 });
 await test('Concurrent reset exactly one winner; all staff sessions and links invalidated',async()=>{
  const a=await mint(users.CASHIER), b=await mint(users.CASHIER), token=crypto.randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({data:{userId:users.CASHIER.id,tokenHash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+60000)}});
  const results=await Promise.all(['first-safe-password123','second-safe-password123'].map(newPassword=>reset(req('',{token,newPassword},'/api/auth/reset-password'))));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);await denied(a);await denied(b);
  assert.equal(await prisma.attendanceSession.count({where:{userId:users.CASHIER.id,checkedOutAt:null,expiresAt:{gt:new Date()}}}),0);
  assert.equal((await reset(req('',{token,newPassword:'third-safe-password123'},'/api/auth/reset-password'))).status,400);
  await assert.rejects(()=>issueAttendanceToken(payload(users.CASHIER),passwordHash));
 });
 await test('Auth version mismatch invalidates row without deleting it',async()=>{const t=await mint(users.OWNER);await prisma.user.update({where:{id:users.OWNER.id},data:{authVersion:{increment:1}}});await denied(t);assert.equal((await live(req(t,null,'/api/live/orders'))).status,401);});
 await test('Live revision retains exactly one query for valid session',async()=>{const t=await mint(users.OWNER);const original=prisma.$queryRaw;let calls=0;prisma.$queryRaw=function(...args){calls++;return original.apply(prisma,args)};try{assert.equal((await live(req(t,null,'/api/live/orders'))).status,200);assert.equal(calls,1)}finally{prisma.$queryRaw=original}});
 await test('Session database failure cannot issue a token or partial attendance',async()=>{const before=await prisma.attendanceSession.count({where:{userId:users.CASHIER.id}});const original=prisma.$transaction;prisma.$transaction=async()=>{throw new Error('synthetic DB unavailable')};try{await assert.rejects(()=>mint(users.CASHIER))}finally{prisma.$transaction=original}assert.equal(await prisma.attendanceSession.count({where:{userId:users.CASHIER.id}}),before);});
 console.log(count+' SESSION SECURITY CHECKS PASSED');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(restaurant)await prisma.restaurant.delete({where:{id:restaurant.id}});await prisma.$disconnect()});
