import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { owner,jsonBody,failure } from '@/server/billing/test-route';
import { razorTest } from '@/server/billing/razorpay-test';
import { refreshTestSubscription } from '@/server/billing/test-lifecycle';
export async function POST(req:NextRequest){const {auth,error}=await owner(req);if(error||!auth)return error;try{
 if((await jsonBody(req)).testOnly!==true)throw new Error('TEST acknowledgement required.');
 const row=await prisma.testBillingSubscription.findUnique({where:{restaurantId:auth.restaurantId}});if(!row?.providerId)throw new Error('No TEST subscription.');
 await razorTest('subscriptions/'+row.providerId+'/cancel','POST',{cancel_at_cycle_end:0});
 return NextResponse.json({success:true,subscription:await refreshTestSubscription(row.providerId),productionAccessChanged:false});
}catch{return failure();}}
