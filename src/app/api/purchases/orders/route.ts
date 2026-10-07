import { protectRead } from '@/server/services/api-validation';
import { protectMutation } from '@/server/services/api-validation';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { PurchaseService } from '@/server/services/purchase.service';
import { prisma } from '@/server/db/prisma';

async function handleGET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:purchases');
  if (errorResponse || !auth) return errorResponse;

  const orders = await prisma.purchaseOrder.findMany({
    where: { restaurantId: auth.restaurantId, outletId: auth.outletId },
    include: {
      supplier: true,
      items: { include: { ingredient: true } },
      receipts: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, orders });
}

async function handlePOST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:purchases');
  if (errorResponse || !auth) return errorResponse;

  try {
    const data = await req.json();
    const po = await PurchaseService.createPO({
      restaurantId: auth.restaurantId,
      outletId: auth.outletId,
      supplierId: data.supplierId,
      items: data.items,
      notes: data.notes,
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
      createdByUserId: auth.user.userId,
    });

    return NextResponse.json({ success: true, purchaseOrder: po });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create purchase order.' },
      { status: 400 }
    );
  }
}

export const POST = protectMutation(handlePOST);

export const dynamic = 'force-dynamic';

export const GET = protectRead(handleGET);
