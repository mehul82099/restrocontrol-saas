import { NextRequest, NextResponse } from 'next/server';
import { lookupUsableInvite } from '@/server/services/invite.service';

export async function GET(req: NextRequest) {
  const invite = await lookupUsableInvite(new URL(req.url).searchParams.get('token') || '');
  if (!invite) return NextResponse.json({ success: false, error: 'This invite link is invalid, expired or already used.' }, { status: 404 });
  return NextResponse.json({ success: true, restaurantName: invite.restaurant.name, role: invite.role, expiresAt: invite.expiresAt });
}
export const dynamic = 'force-dynamic';
