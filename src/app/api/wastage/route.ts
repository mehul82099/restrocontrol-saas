import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { WastageService } from '@/server/services/wastage.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:wastage');
  if (errorResponse || !auth) return errorResponse;

  const wastages = await WastageService.listWastages(auth.restaurantId, auth.outletId);
  return NextResponse.json({ success: true, wastages });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:wastage');
  if (errorResponse || !auth) return errorResponse;

  try {
    const data = await req.json();
    const wastage = await WastageService.recordWastage({
      restaurantId: auth.restaurantId,
      outletId: auth.outletId,
      ingredientId: data.ingredientId,
      quantity: parseFloat(data.quantity),
      unit: data.unit,
      reason: data.reason,
      notes: data.notes,
      reportedByUserId: auth.user.userId,
    });

    return NextResponse.json({ success: true, wastage });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record wastage.' },
      { status: 400 }
    );
  }
}
