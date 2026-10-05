import { prisma } from '../db/prisma';
import { ApprovalStatus, MovementType } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';

export interface PhysicalCountItemInput {
  ingredientId: string;
  physicalStock: number;
  reason?: string;
  notes?: string;
}

export interface CreateStockCountInput {
  restaurantId: string;
  outletId: string;
  conductedByUserId?: string | null;
  items: PhysicalCountItemInput[];
  notes?: string;
  autoApprove?: boolean;
}

export class StockCountService {
  /**
   * Records a physical stock count session, computes variances against system stock.
   */
  static async submitStockCount(input: CreateStockCountInput) {
    const { restaurantId, outletId, conductedByUserId, items, notes, autoApprove } = input;

    const countCountToday = await prisma.stockCount.count({
      where: {
        restaurantId,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countNumber = `STK-${dateStr}-${(countCountToday + 1).toString().padStart(3, '0')}`;

    return await prisma.$transaction(async (tx) => {
      const stockCount = await tx.stockCount.create({
        data: {
          restaurantId,
          outletId,
          countNumber,
          conductedByUserId,
          status: autoApprove ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING_APPROVAL,
          approvedByUserId: autoApprove ? conductedByUserId : null,
          notes,
          completedAt: autoApprove ? new Date() : null,
        },
      });

      let totalVarianceValue = 0;
      const createdItems = [];

      for (const item of items) {
        // Fetch current system stock
        const outletInv = await tx.outletInventory.findUnique({
          where: {
            outletId_ingredientId: {
              outletId,
              ingredientId: item.ingredientId,
            },
          },
          include: { ingredient: true },
        });

        const systemStock = outletInv?.currentStock || 0;
        const physicalStock = item.physicalStock;
        const variance = Math.round((physicalStock - systemStock) * 1000) / 1000;
        const unit = outletInv?.ingredient.unit || 'KG';
        const unitCost = outletInv?.ingredient.costPerUnit || 0;
        const varianceValue = Math.round(variance * unitCost * 100) / 100;
        totalVarianceValue += Math.abs(varianceValue);

        const countItem = await tx.stockCountItem.create({
          data: {
            stockCountId: stockCount.id,
            ingredientId: item.ingredientId,
            systemStock,
            physicalStock,
            variance,
            unit,
            unitCost,
            varianceValue,
            reason: item.reason,
            notes: item.notes,
          },
        });
        createdItems.push(countItem);

        // If auto-approved, immediately record ADJUSTMENT movement
        if (autoApprove && variance !== 0) {
          await InventoryService.recordMovement(
            {
              restaurantId,
              outletId,
              ingredientId: item.ingredientId,
              movementType: MovementType.STOCK_COUNT,
              quantity: variance, // can be positive or negative
              unit,
              costPerUnit: unitCost,
              referenceType: 'STOCK_COUNT',
              referenceId: stockCount.id,
              userId: conductedByUserId,
              reason: `Physical stock count adjustment #${countNumber}: variance of ${variance} ${unit}`,
            },
            tx
          );
        }
      }

      // If pending approval and significant variance, alert manager
      if (!autoApprove && totalVarianceValue > 200) {
        await NotificationService.createNotification(
          {
            restaurantId,
            outletId,
            type: 'LARGE_VARIANCE',
            title: `Stock Count Variance: ₹${totalVarianceValue.toFixed(2)}`,
            message: `Stock count #${countNumber} has total variance value of ₹${totalVarianceValue.toFixed(2)}. Manager approval required.`,
            data: { stockCountId: stockCount.id, totalVarianceValue },
          },
          tx
        );
      }

      await AuditService.log(
        {
          restaurantId,
          userId: conductedByUserId,
          action: 'STOCK_COUNT_SUBMIT',
          entity: 'StockCount',
          entityId: stockCount.id,
          after: { countNumber, itemsCount: items.length, totalVarianceValue },
        },
        tx
      );

      return { stockCount, items: createdItems };
    });
  }

  /**
   * Approve or reject a submitted stock count session.
   */
  static async approveStockCount(
    restaurantId: string,
    stockCountId: string,
    approvedByUserId: string,
    approve: boolean
  ) {
    return await prisma.$transaction(async (tx) => {
      const stockCount = await tx.stockCount.findUnique({
        where: { id: stockCountId },
        include: { items: { include: { ingredient: true } } },
      });

      if (!stockCount || stockCount.restaurantId !== restaurantId) {
        throw new Error('Stock count not found or tenant mismatch');
      }

      if (stockCount.status !== ApprovalStatus.PENDING_APPROVAL) {
        throw new Error(`Stock count is already ${stockCount.status}`);
      }

      const newStatus = approve ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

      const updated = await tx.stockCount.update({
        where: { id: stockCountId },
        data: {
          status: newStatus,
          approvedByUserId,
          completedAt: new Date(),
        },
      });

      if (approve) {
        // Record ADJUSTMENT movements for items with variance
        for (const item of stockCount.items) {
          if (item.variance !== 0) {
            await InventoryService.recordMovement(
              {
                restaurantId,
                outletId: stockCount.outletId,
                ingredientId: item.ingredientId,
                movementType: MovementType.STOCK_COUNT,
                quantity: item.variance,
                unit: item.unit,
                costPerUnit: item.unitCost,
                referenceType: 'STOCK_COUNT',
                referenceId: stockCount.id,
                userId: approvedByUserId,
                reason: `Approved stock count #${stockCount.countNumber} variance: ${item.variance} ${item.unit} (${item.reason || 'Count adjustment'})`,
              },
              tx
            );
          }
        }
      }

      await AuditService.log(
        {
          restaurantId,
          userId: approvedByUserId,
          action: approve ? 'STOCK_COUNT_APPROVE' : 'STOCK_COUNT_REJECT',
          entity: 'StockCount',
          entityId: stockCountId,
          after: { status: newStatus },
        },
        tx
      );

      return updated;
    });
  }

  static async listStockCounts(restaurantId: string, outletId?: string) {
    return await prisma.stockCount.findMany({
      where: {
        restaurantId,
        ...(outletId ? { outletId } : {}),
      },
      include: {
        items: {
          include: { ingredient: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
