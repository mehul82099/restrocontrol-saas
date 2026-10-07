import { protectRead } from '@/server/services/api-validation';
import { hasPermission } from '@/server/auth/permissions';
import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { StockCountService } from '@/server/services/stock-count.service';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:stock_count');
  if (errorResponse || !auth) return errorResponse;

  const counts = await StockCountService.listStockCounts(auth.restaurantId, auth.outletId);
  return NextResponse.json({ success: true, counts });
}

async function handlePOST(req: NextRequest) {
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
      autoApprove: !!data.autoApprove && hasPermission(auth.user.role, 'approve:stock_count'),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit stock count.' },
      { status: 400 }
    );
  }
}

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
