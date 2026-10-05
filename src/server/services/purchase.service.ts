import { prisma } from '../db/prisma';
import { POStatus, MovementType } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';

export interface CreatePOItemInput {
  ingredientId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface CreatePOInput {
  restaurantId: string;
  outletId: string;
  supplierId: string;
  items: CreatePOItemInput[];
  notes?: string;
  expectedDate?: Date;
  createdByUserId?: string | null;
}

export class PurchaseService {
  /**
   * Creates a purchase order.
   */
  static async createPO(input: CreatePOInput) {
    const { restaurantId, outletId, supplierId, items, notes, expectedDate, createdByUserId } = input;

    const countToday = await prisma.purchaseOrder.count({
      where: {
        restaurantId,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const poNumber = `PO-${dateStr}-${(countToday + 1).toString().padStart(3, '0')}`;

    let subtotal = 0;
    const poItemsData = items.map((item) => {
      const totalAmount = item.quantity * item.unitPrice;
      subtotal += totalAmount;
      return {
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalAmount,
      };
    });

    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% standard GST
    const totalAmount = subtotal + taxAmount;

    return await prisma.purchaseOrder.create({
      data: {
        restaurantId,
        outletId,
        supplierId,
        poNumber,
        status: POStatus.ORDERED,
        subtotal,
        taxAmount,
        totalAmount,
        notes,
        expectedDate,
        createdByUserId,
        items: {
          create: poItemsData,
        },
      },
      include: {
        items: { include: { ingredient: true } },
        supplier: true,
      },
    });
  }

  /**
   * Goods Receipt: receives full or partial PO items, automatically increases inventory in ledger,
   * and updates ingredient costPerUnit to store latest historical purchase price!
   */
  static async receiveGoods(
    restaurantId: string,
    purchaseOrderId: string,
    receivedByUserId?: string | null,
    invoiceNumber?: string,
    notes?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { items: { include: { ingredient: true } }, supplier: true },
      });

      if (!po || po.restaurantId !== restaurantId) {
        throw new Error('Purchase order not found or tenant mismatch');
      }

      if (po.status === POStatus.RECEIVED) {
        throw new Error('Purchase order has already been received');
      }

      const receiptNumber = `GRN-${Date.now().toString().slice(-6)}`;

      // Create Goods Receipt record
      const goodsReceipt = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId: po.id,
          restaurantId: po.restaurantId,
          outletId: po.outletId,
          receiptNumber,
          receivedByUserId,
          invoiceNumber,
          notes,
          totalAmount: po.totalAmount,
        },
      });

      // Increase inventory for each PO item and update ingredient historical cost
      for (const item of po.items) {
        // Record inventory movement (PURCHASE)
        await InventoryService.recordMovement(
          {
            restaurantId,
            outletId: po.outletId,
            ingredientId: item.ingredientId,
            movementType: MovementType.PURCHASE,
            quantity: item.quantity, // positive addition
            unit: item.unit,
            costPerUnit: item.unitPrice,
            referenceType: 'PO_RECEIPT',
            referenceId: goodsReceipt.id,
            userId: receivedByUserId,
            reason: `Goods receipt for PO #${po.poNumber} (${po.supplier.name})`,
          },
          tx
        );

        // Update item receivedQuantity
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQuantity: item.quantity },
        });

        // Store latest purchase price on ingredient
        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: { costPerUnit: item.unitPrice },
        });
      }

      // Mark PO as RECEIVED
      const updatedPO = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: POStatus.RECEIVED,
          receivedDate: new Date(),
        },
      });

      // Notification
      await NotificationService.createNotification(
        {
          restaurantId,
          outletId: po.outletId,
          type: 'PURCHASE_RECEIVED',
          title: `Purchase Received: PO #${po.poNumber}`,
          message: `Goods received from ${po.supplier.name} with total amount ₹${po.totalAmount.toFixed(2)}. Inventory updated.`,
          data: { purchaseOrderId: po.id, receiptNumber },
        },
        tx
      );

      await AuditService.log(
        {
          restaurantId,
          userId: receivedByUserId,
          action: 'PO_RECEIVE',
          entity: 'PurchaseOrder',
          entityId: po.id,
          after: { receiptNumber, status: POStatus.RECEIVED, totalAmount: po.totalAmount },
        },
        tx
      );

      return { purchaseOrder: updatedPO, goodsReceipt };
    });
  }

  /**
   * Process a purchase return: returns goods to supplier and reduces inventory.
   */
  static async returnGoods(
    restaurantId: string,
    purchaseOrderId: string,
    returnedByUserId: string,
    reason: string,
    returnItems: Array<{ ingredientId: string; quantity: number; unit: string; unitPrice: number }>
  ) {
    return await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
      });

      if (!po || po.restaurantId !== restaurantId) {
        throw new Error('PO not found or tenant mismatch');
      }

      const returnNumber = `PR-${Date.now().toString().slice(-6)}`;
      let totalAmount = 0;

      for (const item of returnItems) {
        totalAmount += item.quantity * item.unitPrice;

        // Deduct inventory with PURCHASE_RETURN movement
        await InventoryService.recordMovement(
          {
            restaurantId,
            outletId: po.outletId,
            ingredientId: item.ingredientId,
            movementType: MovementType.PURCHASE_RETURN,
            quantity: -item.quantity, // deduction
            unit: item.unit,
            costPerUnit: item.unitPrice,
            referenceType: 'PURCHASE_RETURN',
            referenceId: returnNumber,
            userId: returnedByUserId,
            reason: `Purchase return for PO #${po.poNumber}: ${reason}`,
          },
          tx
        );
      }

      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          purchaseOrderId: po.id,
          restaurantId,
          outletId: po.outletId,
          returnNumber,
          returnedByUserId,
          reason,
          totalAmount,
        },
      });

      await AuditService.log(
        {
          restaurantId,
          userId: returnedByUserId,
          action: 'PO_RETURN',
          entity: 'PurchaseReturn',
          entityId: purchaseReturn.id,
          after: { returnNumber, reason, totalAmount },
        },
        tx
      );

      return purchaseReturn;
    });
  }
}
