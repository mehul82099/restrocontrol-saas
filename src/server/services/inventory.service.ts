import { prisma } from '../db/prisma';
import { MovementType, Prisma } from '@prisma/client';
import { NotificationService } from './notification.service';

export interface MovementInput {
  restaurantId: string;
  outletId: string;
  ingredientId: string;
  movementType: MovementType;
  quantity: number; // positive = added, negative = deducted
  unit?: string;
  costPerUnit?: number;
  referenceType?: string;
  referenceId?: string;
  userId?: string | null;
  reason?: string;
}

export class InventoryService {
  /**
   * Records an inventory movement in the immutable ledger and updates the outlet stock projection.
   * Can be executed inside an existing Prisma transaction or standalone.
   */
  static async recordMovement(
    input: MovementInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;

    // 1. Fetch current ingredient & outlet inventory
    const ingredient = await db.ingredient.findUnique({
      where: { id: input.ingredientId },
    });
    if (!ingredient) {
      throw new Error(`Ingredient not found: ${input.ingredientId}`);
    }

    const unit = input.unit || ingredient.unit;
    const costPerUnit = input.costPerUnit ?? ingredient.costPerUnit;
    const totalCost = Math.abs(input.quantity) * costPerUnit;

    // 2. Create immutable ledger movement record
    const movement = await db.inventoryMovement.create({
      data: {
        restaurantId: input.restaurantId,
        outletId: input.outletId,
        ingredientId: input.ingredientId,
        movementType: input.movementType,
        quantity: input.quantity,
        unit,
        costPerUnit,
        totalCost,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        userId: input.userId,
        reason: input.reason,
      },
    });

    // 3. Upsert outlet inventory projection
    const outletInventory = await db.outletInventory.upsert({
      where: {
        outletId_ingredientId: {
          outletId: input.outletId,
          ingredientId: input.ingredientId,
        },
      },
      create: {
        restaurantId: input.restaurantId,
        outletId: input.outletId,
        ingredientId: input.ingredientId,
        currentStock: input.quantity,
        minimumStock: ingredient.minimumStock,
        reorderLevel: ingredient.reorderLevel,
      },
      update: {
        currentStock: {
          increment: input.quantity,
        },
      },
    });

    // 4. Update ingredient master currentStock across all outlets
    const totalStock = await db.outletInventory.aggregate({
      where: {
        restaurantId: input.restaurantId,
        ingredientId: input.ingredientId,
      },
      _sum: {
        currentStock: true,
      },
    });

    await db.ingredient.update({
      where: { id: input.ingredientId },
      data: {
        currentStock: totalStock._sum.currentStock || 0,
      },
    });

    // 5. Low-stock check (performed if stock decreased)
    if (input.quantity < 0) {
      const newStock = outletInventory.currentStock;
      const minStock = outletInventory.minimumStock;
      const reorderLvl = outletInventory.reorderLevel;

      if (newStock <= minStock) {
        await NotificationService.createNotification({
          restaurantId: input.restaurantId,
          outletId: input.outletId,
          type: 'LOW_STOCK',
          title: `Low Stock Alert: ${ingredient.name}`,
          message: `${ingredient.name} stock (${newStock.toFixed(2)} ${unit}) is at or below minimum threshold (${minStock} ${unit}). Please reorder.`,
          data: {
            ingredientId: ingredient.id,
            currentStock: newStock,
            minimumStock: minStock,
            reorderLevel: reorderLvl,
          },
        }, db);
      }
    }

    return { movement, outletInventory };
  }

  /**
   * Get current stock for all ingredients in an outlet.
   */
  static async getOutletStock(restaurantId: string, outletId: string) {
    const items = await prisma.outletInventory.findMany({
      where: { restaurantId, outletId },
      include: {
        ingredient: {
          include: {
            category: true,
            preferredSupplier: true,
          },
        },
      },
      orderBy: { ingredient: { name: 'asc' } },
    });

    return items.map((item) => {
      let status: 'NORMAL' | 'LOW_STOCK' | 'WARNING' | 'CRITICAL' = 'NORMAL';
      if (item.currentStock <= 0) {
        status = 'CRITICAL';
      } else if (item.currentStock <= item.minimumStock) {
        status = 'LOW_STOCK';
      } else if (item.currentStock <= item.reorderLevel) {
        status = 'WARNING';
      }

      return {
        id: item.id,
        ingredientId: item.ingredientId,
        name: item.ingredient.name,
        category: item.ingredient.category?.name || 'Uncategorized',
        unit: item.ingredient.unit,
        currentStock: Math.round(item.currentStock * 1000) / 1000,
        minimumStock: item.minimumStock,
        reorderLevel: item.reorderLevel,
        costPerUnit: item.ingredient.costPerUnit,
        totalValue: Math.round(item.currentStock * item.ingredient.costPerUnit * 100) / 100,
        preferredSupplier: item.ingredient.preferredSupplier?.name || 'None',
        status,
        updatedAt: item.updatedAt,
      };
    });
  }

  /**
   * Reconciles current stock by recalculating the sum of all movements from the immutable ledger.
   */
  static async auditLedgerSum(
    restaurantId: string,
    outletId: string,
    ingredientId: string
  ): Promise<{ ledgerSum: number; projectedStock: number; mismatch: boolean }> {
    const ledgerAgg = await prisma.inventoryMovement.aggregate({
      where: { restaurantId, outletId, ingredientId },
      _sum: { quantity: true },
    });

    const projection = await prisma.outletInventory.findUnique({
      where: { outletId_ingredientId: { outletId, ingredientId } },
    });

    const ledgerSum = Math.round((ledgerAgg._sum.quantity || 0) * 10000) / 10000;
    const projectedStock = Math.round((projection?.currentStock || 0) * 10000) / 10000;
    const mismatch = Math.abs(ledgerSum - projectedStock) > 0.0001;

    return { ledgerSum, projectedStock, mismatch };
  }
}
