import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { testConfig } from './razorpay-test';
export async function owner(req:NextRequest){
  const result=await authenticateRequest(req,'manage:subscription');
  if(result.errorResponse||!result.auth)return {error:result.errorResponse};
  try{testConfig();}catch{return {error:NextResponse.json({success:false,error:'TEST billing is disabled or not configured.'},{status:503})};}
  return {auth:result.auth};
}
export async function jsonBody(req:NextRequest){const text=await req.text();if(text.length>4096)throw new Error('Request too large.');return JSON.parse(text||'{}');}
export function failure(){return NextResponse.json({success:false,error:'TEST operation failed. No production access was changed. Check configuration and provider state before retrying.'},{status:400});}
