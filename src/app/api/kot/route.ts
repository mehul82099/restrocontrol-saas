import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { KotService } from '@/server/services/kot.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'access:kot');
  if (errorResponse || !auth) return errorResponse;

  const tickets = await KotService.getActiveTickets(auth.restaurantId, auth.outletId);
  return NextResponse.json({ success: true, tickets });
}
