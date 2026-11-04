if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) throw new Error('Local test database required');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const jiti=require('jiti')(__filename,{alias:{'@':path.resolve(__dirname,'../src')}});
const {NextRequest}=require('next/server');
const {prisma}=jiti('../src/server/db/prisma');
const {issueAttendanceToken}=jiti('../src/server/services/attendance.service');
const {hasPermission}=jiti('../src/server/auth/permissions');
const policies=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/security-route-access.json')));
let tests=0;
(async()=>{
 const r=await prisma.restaurant.findUniqueOrThrow({where:{slug:'demo-kitchen'}});
 const o=await prisma.outlet.findFirstOrThrow({where:{restaurantId:r.id,isDefault:true}});
 const roles=['OWNER','MANAGER','CASHIER','KITCHEN_STAFF','INVENTORY_MANAGER','WAITER'];
 const tokens={};
 for(const role of roles){let u=await prisma.user.findFirst({where:{restaurantId:r.id,role}});if(!u){u=await prisma.user.create({data:{restaurantId:r.id,role,name:'Local role test',email:'role-'+role+'@local.invalid',passwordHash:'not-a-login'}});await prisma.userOutlet.create({data:{userId:u.id,outletId:o.id}});}tokens[role]=await issueAttendanceToken({userId:u.id,restaurantId:r.id,role,email:u.email,name:u.name,outletId:o.id});}
 // Exercise every permission-bearing route export for every role denied by its
 // actual permission map. Empty bodies/IDs avoid creating business records.
 for(const row of policies){
 const file=path.join(__dirname,'../src/app',row.route,'route.ts');const text=fs.readFileSync(file,'utf8');
 const permissions=[...text.matchAll(/authenticateRequest\(req,\s*['"]([^'"]+)['"]\)/g)].map(x=>x[1]);
 if(!permissions.length)continue;
 const mod=jiti(file);
 let recordId='nonexistent';
 const recordModel=row.route.startsWith('/api/kot/')?'kitchenOrder':row.route.startsWith('/api/orders/')?'order':row.route.startsWith('/api/wastage/')?'wastage':row.route.startsWith('/api/stock-count/')?'stockCount':null;
 if(recordModel){const record=await prisma[recordModel].findFirst({where:{restaurantId:r.id,outletId:o.id}});if(!record)throw new Error('Missing local fixture '+recordModel);recordId=record.id;}
 // Only test an export when all route permissions deny the role. Mixed shared
 // GET/mutating routes are covered by explicit method parsing below.
 for(const [method,handler] of Object.entries(mod)){
 if(!['GET','POST','PUT','PATCH','DELETE'].includes(method)||typeof handler!=='function')continue;
 let permission;
 const name=text.match(new RegExp('export const '+method+' = (?:protectRead|protectMutation)\\((\\w+)\\)'))?.[1];
 const segment=name?text.slice(text.indexOf('async function '+name),text.indexOf('\n}',text.indexOf('async function '+name))+2):'';
 permission=segment.match(/authenticateRequest\(req,\s*['"]([^'"]+)['"]\)/)?.[1];
 if(!permission && new Set(permissions).size===1&&!text.includes('authenticateRequest(req)'))permission=permissions[0];
 if(!permission)continue;
 for(const role of roles.filter(role=>!hasPermission(role,permission))){
 const req=new NextRequest('http://localhost:3000'+row.route.replace('[id]',recordId).replace('[action]','checkout'),{method,headers:{cookie:'token='+tokens[role],'content-type':'application/json'},...(!['GET','HEAD'].includes(method)?{body:'{}'}:{})});
 const response=await handler(req,{params:Promise.resolve({id:recordId,action:'checkout'})});
 assert.equal(response.status,403,role+' '+method+' '+row.route);tests++;
 }
 }
 }
 const {POST:report}=jiti('../src/app/api/csp-report/route');
 for(const [body,type,status] of [['{}','application/csp-report',400],['{','application/csp-report',400],['x'.repeat(9000),'application/csp-report',413],['{}','text/plain',415],[JSON.stringify({'csp-report':{'effective-directive':'script-src', 'document-uri':'https://private.invalid/?token=secret'}}),'application/csp-report',204]]){const response=await report(new NextRequest('http://localhost:3000/api/csp-report',{method:'POST',headers:{'content-type':type},body}));assert.equal(response.status,status);tests++;}
 const cfg=require('../next.config.js');const headers=(await cfg.headers())[0].headers;assert.equal(headers.find(h=>h.key==='Strict-Transport-Security').value,'max-age=31536000');assert.ok(headers.find(h=>h.key==='Content-Security-Policy-Report-Only').value.includes('report-uri /api/csp-report'));assert.equal(cfg.productionBrowserSourceMaps,false);tests+=3;
 console.log(tests+' SECURITY REVIEW CHECKS PASSED (denied role-route pairs, CSP and config)');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
