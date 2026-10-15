import { createHmac, timingSafeEqual } from 'crypto';
import { findSubscriptionPlan } from '@/lib/subscription-plans';

export function testConfig() {
  if(process.env.RAZORPAY_TEST_ENABLED!=='true'||process.env.VERCEL_ENV==='production') throw new Error('TEST billing is disabled.');
  const key=process.env.RAZORPAY_TEST_KEY_ID||'',secret=process.env.RAZORPAY_TEST_KEY_SECRET||'';
  if(!key.startsWith('rzp_test_')||!secret)throw new Error('Valid TEST keys are required. Live keys are refused.');
  return {key,secret};
}
export function testPlan(code:unknown) {
  const plan=findSubscriptionPlan(code);
  if(!plan||plan.upcoming)throw new Error('Choose an available website plan.');
  const id=process.env[plan.code==='WEBSITE_SINGLE'?'RAZORPAY_TEST_PLAN_SINGLE':'RAZORPAY_TEST_PLAN_MULTI'];
  if(!id?.startsWith('plan_'))throw new Error('TEST plan mapping is missing.');
  return {...plan,id};
}
export function validSignature(body:string,signature:string,secret:string){
  if(!/^[a-fA-F0-9]{64}$/.test(signature))return false;
  return timingSafeEqual(Buffer.from(createHmac('sha256',secret).update(body).digest('hex'),'hex'),Buffer.from(signature,'hex'));
}
export async function razorTest(path:string,method='GET',body?:unknown){
  const {key,secret}=testConfig();
  // Fixed API origin. Never send keys to a caller-provided URL.
  const response=await fetch('https://api.razorpay.com/v1/'+path,{method,headers:{Authorization:'Basic '+Buffer.from(key+':'+secret).toString('base64'),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Razorpay TEST request failed ('+response.status+').');
  return response.json();
}
export async function verifyPlan(code:unknown){
  const plan=testPlan(code),remote=await razorTest('plans/'+plan.id);
  if(remote.period!=='monthly'||remote.interval!==1||remote.item?.amount!==plan.price*100||remote.item?.currency!=='INR')throw new Error('TEST plan amount/currency/interval does not match the catalogue.');
  return plan;
}
