import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { StockCountService } from '@/server/services/stock-count.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:stock_count');
  if (errorResponse || !auth) return errorResponse;

  const counts = await StockCountService.listStockCounts(auth.restaurantId, auth.outletId);
  return NextResponse.json({ success: true, counts });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:stock_count');
  if (errorResponse || !auth) return errorResponse;

  try {
    const data = await req.json();
    const result = await StockCountService.submitStockCount({
      restaurantId: auth.restaurantId,
      outletId: auth.outletId,
      conductedByUserId: auth.user.userId,
      items: data.items,
      notes: data.notes,
      autoApprove: !!data.autoApprove,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit stock count.' },
      { status: 400 }
    );
  }
}
