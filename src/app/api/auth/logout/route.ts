import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { sessionHash } from '@/server/services/push-policy';
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(req.url).origin)) return new NextResponse(null, {status: 403});
  const token = req.cookies.get('token')?.value;
  // Clear cookie even if optional push storage has not been migrated yet. The worker revalidates the cookie on every delivery.
  if (token) await prisma.staffPushSubscription.deleteMany({where: {sessionHash: sessionHash(token)}}).catch(() => console.error('Push cleanup unavailable on logout'));
  const response = NextResponse.json({success: true, message: 'Logged out successfully.'});
  response.cookies.delete('token');
  return response;
}
export const dynamic = 'force-dynamic';
