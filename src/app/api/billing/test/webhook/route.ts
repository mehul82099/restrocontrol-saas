import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { testConfig,validSignature } from '@/server/billing/razorpay-test';
import { refreshTestSubscription } from '@/server/billing/test-lifecycle';
export async function POST(req:NextRequest){try{
 testConfig();const secret=process.env.RAZORPAY_TEST_WEBHOOK_SECRET;if(!secret)return new NextResponse('Webhook not configured',{status:503});
 const raw=await req.text();if(raw.length>262144)return new NextResponse('Too large',{status:413});
 if(!validSignature(raw,req.headers.get('x-razorpay-signature')||'',secret))return new NextResponse('Invalid signature',{status:400});
 const body=JSON.parse(raw),eventId=req.headers.get('x-razorpay-event-id');
 if(!eventId||eventId.length>200)return new NextResponse('Event ID required',{status:400});
 if(await prisma.testBillingEvent.findUnique({where:{eventId}}))return NextResponse.json({success:true,duplicate:true});
 if(typeof body.event!=='string'||!body.event.startsWith('subscription.'))return NextResponse.json({success:true,ignored:true});
 const providerId=body.payload?.subscription?.entity?.id;
 if(typeof providerId!=='string'||!await prisma.testBillingSubscription.findUnique({where:{providerId}}))return new NextResponse('Unknown TEST subscription',{status:400});
 // Fetch authoritative current provider state instead of trusting out-of-order webhook state.
 await refreshTestSubscription(providerId);
 await prisma.testBillingEvent.upsert({where:{eventId},update:{},create:{eventId,providerId,eventType:body.event}});
 return NextResponse.json({success:true,productionAccessChanged:false});
}catch{return new NextResponse('TEST webhook processing failed; retry required',{status:503});}}
