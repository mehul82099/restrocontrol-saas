import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { WastageService } from '@/server/services/wastage.service';

async function handlePOST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { auth, errorResponse } = await authenticateRequest(req, 'approve:wastage');
  if (errorResponse || !auth) return errorResponse;

  try {
    const data = await req.json();
    const updated = await WastageService.approveWastage(
      auth.restaurantId,
      params.id,
      auth.user.userId,
      data.approve !== false
    );

    return NextResponse.json({ success: true, wastage: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process wastage approval.' },
      { status: 400 }
    );
  }
}

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';
