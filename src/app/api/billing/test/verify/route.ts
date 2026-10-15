import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { owner,jsonBody,failure } from '@/server/billing/test-route';
import { testConfig,validSignature } from '@/server/billing/razorpay-test';
import { refreshTestSubscription } from '@/server/billing/test-lifecycle';
export async function POST(req:NextRequest){const {auth,error}=await owner(req);if(error||!auth)return error;try{
 const body=await jsonBody(req),row=await prisma.testBillingSubscription.findUnique({where:{restaurantId:auth.restaurantId}});
 if(!row?.providerId||row.providerId!==body.razorpay_subscription_id||typeof body.razorpay_payment_id!=='string'||!/^pay_[A-Za-z0-9]+$/.test(body.razorpay_payment_id)||!validSignature(body.razorpay_payment_id+'|'+row.providerId,body.razorpay_signature||'',testConfig().secret))throw new Error('Invalid checkout signature.');
 await prisma.testBillingSubscription.update({where:{id:row.id},data:{checkoutVerifiedAt:new Date()}});
 const subscription=await refreshTestSubscription(row.providerId);
 return NextResponse.json({success:true,subscription,productionAccessChanged:false});
}catch{return failure();}}
