const assert=require('node:assert/strict');
const host=new URL(process.env.DATABASE_URL||'').hostname;if(!['localhost','127.0.0.1'].includes(host))throw new Error('Isolated local DB required');
const jiti=require('jiti')(__filename,{alias:{'@':require('node:path').resolve(__dirname,'../src')}});
const {prisma}=jiti('../src/server/db/prisma');const {signToken}=jiti('../src/server/auth/jwt');const {issueAttendanceToken}=jiti('../src/server/services/attendance.service');const tokens=new Map();const {NextRequest}=require('next/server');
const {GET,POST}=jiti('../src/app/api/refunds/route');const admin=jiti('../src/app/api/refunds/admin/route');
const {parseRefundInput,isRefundAdmin}=jiti('../src/server/services/refund-intake.service');
const tag='refund-'+require('node:crypto').randomUUID();let a,b,owner,other,staff;
async function req(user,path,method='GET',body){return new NextRequest('http://localhost'+path,{method,headers:{authorization:'Bearer '+(tokens.get(user.id)||await (async()=>{const t=await issueAttendanceToken({userId:user.id,restaurantId:user.restaurantId,role:user.role,email:user.email,name:user.name});tokens.set(user.id,t);return t;})()),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
(async()=>{
 async function tenant(s){const r=await prisma.restaurant.create({data:{name:tag+s,slug:tag+s}});await prisma.outlet.create({data:{restaurantId:r.id,name:'Test',code:'T'}});return r;}
 a=await tenant('a');b=await tenant('b');
 async function user(r,role){return prisma.user.create({data:{restaurantId:r.id,name:role,email:role+'@example.invalid',passwordHash:'TEST_ONLY',role}});}
 owner=await user(a,'OWNER');other=await user(b,'OWNER');staff=await user(a,'CASHIER');
 const body={restaurant:'Test restaurant',email:owner.email,paymentReference:tag,refundReason:'The service did not fit.',serviceFeedback:'The workflow was not suitable.'};
 assert.throws(()=>parseRefundInput({...body,email:'bad'}));assert.throws(()=>parseRefundInput({...body,refundReason:'x'}));
 delete process.env.REFUND_INTAKE_ENABLED;assert.equal((await POST(await req(owner,'/api/refunds','POST',body))).status,503);
 process.env.REFUND_INTAKE_ENABLED='true';
 assert.equal((await POST(await req(staff,'/api/refunds','POST',body))).status,403);
 assert.equal((await POST(await req(owner,'/api/refunds','POST',{...body,email:'wrong@example.invalid'}))).status,400);
 const response=await POST(await req(owner,'/api/refunds','POST',body));assert.equal(response.status,201);const saved=(await response.json()).request;
 assert.equal(Date.parse(saved.refundDueAt)-Date.parse(saved.submittedAt),86400000);assert.equal(saved.status,'SUBMITTED');
 const retry=(await (await POST(await req(owner,'/api/refunds','POST',body))).json()).request;assert.equal(retry.id,saved.id);assert.equal(retry.submittedAt,saved.submittedAt);
 assert.equal((await(await GET(await req(other,'/api/refunds'))).json()).requests.length,0);
 assert.equal((await admin.GET(await req(owner,'/api/refunds/admin'))).status,403);
 process.env.REFUND_ADMIN_USER_IDS=other.id;assert.equal(isRefundAdmin(owner.id),false);
 assert.equal((await(await admin.GET(await req(other,'/api/refunds/admin'))).json()).pending,1);
 assert.equal((await admin.PATCH(await req(other,'/api/refunds/admin','PATCH',{id:saved.id,status:'REFUNDED'}))).status,400);
 assert.equal((await admin.PATCH(await req(other,'/api/refunds/admin','PATCH',{id:saved.id,status:'UNDER_REVIEW'}))).status,200);
 const row=await prisma.refundRequest.findUnique({where:{id:saved.id}});assert.equal(row.reviewedById,other.id);assert.equal(row.refundDueAt.toISOString(),saved.refundDueAt);
 const csrf=new NextRequest('http://localhost/api/refunds',{method:'POST',headers:{cookie:'token='+signToken({userId:owner.id,restaurantId:a.id,role:'OWNER',email:owner.email,name:owner.name}),origin:'https://bad.invalid'},body:JSON.stringify(body)});assert.equal((await POST(csrf)).status,403);
 await prisma.user.update({where:{id:other.id},data:{isActive:false}});assert.equal((await admin.GET(await req(other,'/api/refunds/admin'))).status,401);
 console.log('PASS: intake disabled default, owner gate, field/email checks, save/status/deadline, retry identity, tenant isolation, explicit admin gate, review only, CSRF, disabled operator rejection');
})().finally(async()=>{for(const r of [a,b])if(r)await prisma.restaurant.delete({where:{id:r.id}});await prisma.$disconnect();}).catch(e=>{console.error(e);process.exitCode=1;});
