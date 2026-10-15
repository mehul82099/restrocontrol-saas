import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { owner,jsonBody,failure } from '@/server/billing/test-route';
import { verifyPlan,razorTest } from '@/server/billing/razorpay-test';
import { refreshTestSubscription } from '@/server/billing/test-lifecycle';
export async function POST(req:NextRequest){const {auth,error}=await owner(req);if(error||!auth)return error;try{
 const body=await jsonBody(req);if(body.testOnly!==true||body.schedule!=='cycle_end')throw new Error('Explicit TEST end-of-cycle acknowledgement required.');
 const row=await prisma.testBillingSubscription.findUnique({where:{restaurantId:auth.restaurantId}});if(!row?.providerId)throw new Error('No TEST subscription.');
 const current=await refreshTestSubscription(row.providerId);
 if(current.planCode!=='WEBSITE_SINGLE'||!['authenticated','active'].includes(current.providerStatus)||current.pendingPlanCode)throw new Error('TEST upgrade unavailable.');
 const plan=await verifyPlan('WEBSITE_MULTI');
 await razorTest('subscriptions/'+row.providerId,'PATCH',{plan_id:plan.id,schedule_change_at:'cycle_end',customer_notify:false});
 const subscription=await prisma.testBillingSubscription.update({where:{id:row.id},data:{pendingPlanCode:'WEBSITE_MULTI'}});
 return NextResponse.json({success:true,subscription,productionAccessChanged:false});
}catch{return failure();}}
