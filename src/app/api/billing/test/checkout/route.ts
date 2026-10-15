import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { owner,jsonBody,failure } from '@/server/billing/test-route';
import { testConfig,verifyPlan,razorTest } from '@/server/billing/razorpay-test';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){const {auth,error}=await owner(req);if(error||!auth)return error;return NextResponse.json({success:true,key:testConfig().key,subscription:await prisma.testBillingSubscription.findUnique({where:{restaurantId:auth.restaurantId}})},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:NextRequest){
 const {auth,error}=await owner(req);if(error||!auth)return error;
 try{
  const body=await jsonBody(req);if(body.testOnly!==true)throw new Error('TEST acknowledgement required.');
  const plan=await verifyPlan(body.planCode);
  const previous=await prisma.testBillingSubscription.findUnique({where:{restaurantId:auth.restaurantId}});
  if(previous)return NextResponse.json({success:true,subscription:previous,key:testConfig().key,reused:true});
  // Unique restaurant reservation prevents concurrent duplicate mandates. Crash/timeout stays CREATING for manual reconciliation.
  const record=await prisma.testBillingSubscription.create({data:{restaurantId:auth.restaurantId,planCode:plan.code}});
  const remote=await razorTest('subscriptions','POST',{plan_id:plan.id,total_count:2,quantity:1,customer_notify:false,expire_by:Math.floor(Date.now()/1000)+3600,notes:{purpose:'RestroControl TEST preview',test_record_id:record.id}});
  const subscription=await prisma.testBillingSubscription.update({where:{id:record.id},data:{providerId:remote.id,providerStatus:remote.status}});
  return NextResponse.json({success:true,subscription,key:testConfig().key},{status:201});
 }catch{return failure();}
}
