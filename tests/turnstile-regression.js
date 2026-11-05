const assert = require('node:assert/strict');
const path = require('path');
const jiti = require('jiti')(__filename, {alias: {'@': path.resolve(__dirname, '../src')}});
const {verifyTurnstile,turnstilePublicConfig}=jiti('../src/server/services/turnstile');
(async()=>{
 const saved={...process.env},oldFetch=global.fetch;let calls=0;
 try {
 delete process.env.TURNSTILE_ENABLED;assert.equal(await verifyTurnstile(null,'login','app.example'),true);
 process.env.TURNSTILE_ENABLED='1';process.env.TURNSTILE_HOSTNAMES='app.example,localhost';delete process.env.TURNSTILE_SECRET_KEY;assert.equal(await verifyTurnstile('token','login','app.example'),false);
 process.env.TURNSTILE_SECRET_KEY='private-unit-test-secret';process.env.TURNSTILE_SITE_KEY='public-unit-test-site';
 assert.deepEqual(turnstilePublicConfig(),{enabled:true,siteKey:'public-unit-test-site'});
 global.fetch=async(url,options)=>{calls++;assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');assert.equal(JSON.parse(options.body).secret,process.env.TURNSTILE_SECRET_KEY);assert.ok(options.signal);return new Response(JSON.stringify({success:true,action:'login',hostname:'app.example'}));};
 for(const token of [null,{},'', 'x'.repeat(2049)])assert.equal(await verifyTurnstile(token,'login','app.example'),false);assert.equal(calls,0);
 assert.equal(await verifyTurnstile('token','login','app.example'),true);
 assert.equal(await verifyTurnstile('token','register','app.example'),false);
 assert.equal(await verifyTurnstile('token','login','evil.example'),false);
 for(const result of [{success:false,'error-codes':['timeout-or-duplicate']},{success:true},{success:'true',action:'login',hostname:'app.example'}]){global.fetch=async()=>new Response(JSON.stringify(result));assert.equal(await verifyTurnstile('token','login','app.example'),false);}
 global.fetch=async()=>new Response('not-json');assert.equal(await verifyTurnstile('token','login','app.example'),false);
 global.fetch=async()=>new Response('{}',{status:503});assert.equal(await verifyTurnstile('token','login','app.example'),false);
 global.fetch=async()=>{throw new Error('timeout')};assert.equal(await verifyTurnstile('token','login','app.example'),false);
 process.env.NODE_ENV='production';process.env.TURNSTILE_SITE_KEY='1x00000000000000000000AA';calls=0;global.fetch=async()=>{calls++;throw new Error('must not call')};assert.equal(await verifyTurnstile('token','login','app.example'),false);assert.equal(calls,0);
 const fs=require('fs');const read=f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8');
 assert.ok(read('src/app/api/auth/register/route.ts').includes("if (!viaGoogle && !await verifyTurnstile"));
 assert.ok(!read('src/app/api/auth/register/route.ts').includes('status: 409'));
 assert.ok(!read('src/app/api/auth/register/route.ts').includes('An account with this email already exists'));
 assert.ok(read('src/server/services/auth-request-security.ts').indexOf('readBoundedText(req.clone())')<read('src/server/services/auth-request-security.ts').indexOf('return await handler(req)'));
 assert.ok(read('src/app/(auth)/signup/page.tsx').includes('href="/forgot-password"'));
 console.log('PASS Turnstile config/token/hostname/action/replay/error/production-test-key and signup-copy checks');
 }finally{global.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
})().catch(e=>{console.error(e);process.exitCode=1});
