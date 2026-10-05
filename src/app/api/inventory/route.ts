import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { InventoryService } from '@/server/services/inventory.service';
import { MovementType } from '@prisma/client';
import { AuditService } from '@/server/services/audit.service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'view:inventory');
  if (errorResponse || !auth) return errorResponse;

  const stockList = await InventoryService.getOutletStock(auth.restaurantId, auth.outletId);
  return NextResponse.json({ success: true, stock: stockList });
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:inventory');
  if (errorResponse || !auth) return errorResponse;

  const data = await req.json();
  const quantity = parseFloat(data.quantity);

  const { movement, outletInventory } = await InventoryService.recordMovement({
    restaurantId: auth.restaurantId,
    outletId: auth.outletId,
    ingredientId: data.ingredientId,
    movementType: data.movementType || MovementType.ADJUSTMENT,
    quantity,
    unit: data.unit,
    costPerUnit: data.costPerUnit,
    reason: data.reason || 'Manual inventory adjustment',
    userId: auth.user.userId,
    referenceType: 'MANUAL_ADJUSTMENT',
  });

  await AuditService.log({
    restaurantId: auth.restaurantId,
    userId: auth.user.userId,
    action: 'INVENTORY_ADJUST',
    entity: 'InventoryMovement',
    entityId: movement.id,
    after: { quantity, movementType: movement.movementType, newStock: outletInventory.currentStock },
  });

  return NextResponse.json({ success: true, movement, outletInventory });
}
