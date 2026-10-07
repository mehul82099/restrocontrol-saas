import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { StockCountService } from '@/server/services/stock-count.service';

async function handlePOST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { auth, errorResponse } = await authenticateRequest(req, 'approve:stock_count');
  if (errorResponse || !auth) return errorResponse;

  try {
    const data = await req.json();
    const updated = await StockCountService.approveStockCount(
      auth.restaurantId,
      params.id,
      auth.user.userId,
      data.approve !== false
    );

    return NextResponse.json({ success: true, stockCount: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to approve stock count.' },
      { status: 400 }
    );
  }
}

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';
