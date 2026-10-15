import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { isRefundAdmin, saveRefundRequest, RefundInputError } from '@/server/services/refund-intake.service';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const {auth,errorResponse}=await authenticateRequest(req,'manage:subscription');
  if(errorResponse||!auth)return errorResponse;
  const enabled=process.env.REFUND_INTAKE_ENABLED==='true';
  const requests=enabled?await prisma.refundRequest.findMany({where:{restaurantId:auth.restaurantId},orderBy:{submittedAt:'desc'},take:50}):[];
  return NextResponse.json({success:true,enabled,admin:isRefundAdmin(auth.user.userId),requests},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req: NextRequest) {
  const {auth,errorResponse}=await authenticateRequest(req,'manage:subscription');
  if(errorResponse||!auth)return errorResponse;
  if(process.env.REFUND_INTAKE_ENABLED!=='true')return NextResponse.json({success:false,error:'Refund intake is not enabled in this environment.'},{status:503});
  try {
    const text=await req.text();
    if(text.length>12000)return NextResponse.json({success:false,error:'Request too large.'},{status:413});
    const request=await saveRefundRequest(auth.restaurantId,auth.user.userId,auth.user.email,JSON.parse(text));
    return NextResponse.json({success:true,request,moneyMoved:false},{status:201});
  }catch(error){return NextResponse.json({success:false,error:error instanceof RefundInputError?error.message:'Could not save request. Please try again or contact support.'},{status:400});}
}
