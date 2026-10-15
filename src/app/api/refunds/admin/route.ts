import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { isRefundAdmin } from '@/server/services/refund-intake.service';
export const dynamic = 'force-dynamic';
async function authorize(req:NextRequest){
  const {auth,errorResponse}=await authenticateRequest(req);
  if(errorResponse||!auth)return {error:errorResponse};
  if(!isRefundAdmin(auth.user.userId))return {error:NextResponse.json({success:false,error:'Operator access required.'},{status:403})};
  if(process.env.REFUND_INTAKE_ENABLED!=='true')return {error:NextResponse.json({success:false,error:'Refund intake is disabled.'},{status:503})};
  return {auth};
}
export async function GET(req:NextRequest){
  const {error}=await authorize(req);if(error)return error;
  const requests=await prisma.refundRequest.findMany({orderBy:{submittedAt:'desc'},take:100});
  const pending=await prisma.refundRequest.count({where:{status:'SUBMITTED'}});
  return NextResponse.json({success:true,requests,pending},{headers:{'Cache-Control':'no-store'}});
}
export async function PATCH(req:NextRequest){
  const {auth,error}=await authorize(req);if(error||!auth)return error;
  try {
    const text=await req.text();if(text.length>1024)throw new Error('Request too large.');
    const body=JSON.parse(text);
    if(typeof body.id!=='string'||!['UNDER_REVIEW','DECLINED'].includes(body.status))throw new Error('Choose a review status.');
    const request=await prisma.refundRequest.update({where:{id:body.id},data:{status:body.status,reviewedAt:new Date(),reviewedById:auth.user.userId}});
    return NextResponse.json({success:true,request,moneyMoved:false});
  }catch{return NextResponse.json({success:false,error:'Status could not be updated.'},{status:400});}
}
