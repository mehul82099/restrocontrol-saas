import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { PurchaseService } from '@/server/services/purchase.service';

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:purchases');
  if (errorResponse || !auth) return errorResponse;

  try {
    const data = await req.json();
    const result = await PurchaseService.receiveGoods(
      auth.restaurantId,
      data.purchaseOrderId,
      auth.user.userId,
      data.invoiceNumber,
      data.notes
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to receive goods.' },
      { status: 400 }
    );
  }
}
