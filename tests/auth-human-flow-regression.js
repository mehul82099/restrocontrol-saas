// Isolated database only. No real provider calls, email or production records.
if (!/^postgres(?:ql)?:\/\/[^/]*@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL || '')) throw new Error('Isolated DB required');
const assert=require('node:assert/strict'),path=require('path'),crypto=require('crypto');
const jiti=require('jiti')(__filename,{alias:{'@':path.resolve(__dirname,'../src')}});
const {NextRequest}=require('next/server');const {prisma}=jiti('../src/server/db/prisma');
const {POST:register}=jiti('../src/app/api/auth/register/route');const {POST:login}=jiti('../src/app/api/auth/login/route');
(async()=>{const saved={...process.env},originalFetch=global.fetch;let calls=0;const prefix='human-'+crypto.randomUUID(),email=prefix+'@example.test';
try{
 process.env.TURNSTILE_ENABLED='1';process.env.TURNSTILE_HOSTNAMES='app.example,localhost';process.env.TURNSTILE_SITE_KEY='unit-site';process.env.TURNSTILE_SECRET_KEY='unit-secret';
 let action='register';global.fetch=async()=>{calls++;return new Response(JSON.stringify({success:true,action,hostname:'localhost'}));};
 const req=(body,ip,origin='http://localhost:3000',route='register')=>new NextRequest('http://localhost:3000/api/auth/'+route,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':ip,origin},body:JSON.stringify(body)});
 const data={restaurantName:'Isolated Human Flow',ownerName:'Isolated Test',email,password:'ValidTestPass123',turnstileToken:'unit-token'};
 assert.equal((await register(req(data,'192.0.2.101','https://evil.invalid'))).status,403);assert.equal(calls,0,'origin before external verification');
 assert.equal((await register(req({...data,turnstileToken:''},'192.0.2.101'))).status,400);assert.equal(calls,0,'missing token fails before provider/account lookup');
 const success=await register(req(data,'192.0.2.101'));assert.equal(success.status,201);assert.equal((await success.json()).success,true);assert.ok(success.cookies.get('token'),'immediate session retained');
 const before=await prisma.user.count({where:{email}});const duplicate=await register(req(data,'192.0.2.102'));assert.equal(duplicate.status,400);assert.match((await duplicate.json()).error,/We couldn.t create this account/);assert.equal(duplicate.cookies.get('token'),undefined);assert.equal(await prisma.user.count({where:{email}}),before,'duplicate never creates account');
 action='login';const denied=await login(req({email,password:'ValidTestPass123'},'192.0.2.103','http://localhost:3000','login'));assert.equal(denied.status,400);
 const ok=await login(req({email,password:'ValidTestPass123',turnstileToken:'unit-token'},'192.0.2.103','http://localhost:3000','login'));assert.equal(ok.status,200);assert.ok(ok.cookies.get('token'));
 for(let i=0;i<5;i++)await register(req({...data,email:prefix+'-'+i+'@example.test',turnstileToken:''},'192.0.2.104'));
 const prior=calls;assert.equal((await register(req(data,'192.0.2.104'))).status,429);assert.equal(calls,prior,'budget exhausted before Siteverify');
 console.log('PASS isolated auth human-check ordering, valid signup immediate session, duplicate safe rejection, password login and abuse-budget checks');
}finally{
 global.fetch=originalFetch;const users=await prisma.user.findMany({where:{email},select:{restaurantId:true}});for(const u of users)await prisma.restaurant.delete({where:{id:u.restaurantId}});
 for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);await prisma.$disconnect();
}})().catch(e=>{console.error(e);process.exitCode=1});
