import { NextResponse } from 'next/server';
import { googleConfig } from '@/server/auth/google';

export async function GET() {
  return NextResponse.json({ google: !!googleConfig() });
}
export const dynamic = 'force-dynamic';
