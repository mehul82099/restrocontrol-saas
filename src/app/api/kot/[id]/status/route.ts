import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { KotService } from '@/server/services/kot.service';
import { KotStatus } from '@prisma/client';

async function handlePOST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { auth, errorResponse } = await authenticateRequest(req, 'update:kot_status');
  if (errorResponse || !auth) return errorResponse;

  try {
    const data = await req.json();
    const updated = await KotService.updateTicketStatus(
      auth.restaurantId,
      params.id,
      data.status as KotStatus
    );

    return NextResponse.json({ success: true, ticket: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update KOT status.' },
      { status: 400 }
    );
  }
}

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';
