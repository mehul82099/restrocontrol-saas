import { protectRead } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { InventoryService } from '@/server/services/inventory.service';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:inventory');
  if (errorResponse || !auth) return errorResponse;

  const stockList = await InventoryService.getOutletStock(auth.restaurantId, auth.outletId);
  const lowStock = stockList.filter((s) => s.status !== 'NORMAL');

  return NextResponse.json({ success: true, count: lowStock.length, items: lowStock });
}

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
