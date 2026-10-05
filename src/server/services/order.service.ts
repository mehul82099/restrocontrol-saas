import { prisma } from '../db/prisma';
import {
  OrderType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  MovementType,
  KotStatus,
  TableStatus,
} from '@prisma/client';
import { RecipeEngineService, OrderItemInput } from './recipe-engine.service';
import { InventoryService } from './inventory.service';
import { AuditService } from './audit.service';
import { cache } from '../cache/redis';

export interface CreateOrderPaymentInput {
  amount: number;
  paymentMethod: PaymentMethod;
  transactionRef?: string;
}

export interface CreateOrderItemInput {
  menuItemId: string;
  variantId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  addons?: Array<{ name: string; price: number }>;
  discountAmount?: number;
}

export interface CreateOrderInput {
  restaurantId: string;
  outletId: string;
  cashierId?: string | null;
  idempotencyKey?: string | null;
  orderType: OrderType;
  tableId?: string | null;
  customerId?: string | null;
  items: CreateOrderItemInput[];
  subtotal: number;
  discountAmount?: number;
  discountReason?: string;
  taxAmount?: number;
  deliveryFee?: number;
  tipAmount?: number;
  totalAmount: number;
  notes?: string;
  payments?: CreateOrderPaymentInput[];
}

export class OrderService {
  /**
   * Finalizes an order inside an atomic database transaction.
   * Handles idempotency, recipe calculation, inventory deduction, KOT creation, and table status.
   */
  static async createOrder(input: CreateOrderInput) {
    const { restaurantId, outletId, idempotencyKey } = input;

    // 1. Idempotency Check: Prevent duplicate deductions if retried
    if (idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey },
        include: {
          items: true,
          payments: true,
          kitchenOrder: { include: { items: true } },
        },
      });

      if (existing) {
        return { order: existing, isDuplicate: true };
      }
    }

    // 2. Validate Order
    if (!input.items || input.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // 3. Pre-calculate Recipe Consumption for all items
    const orderItemsForEngine: OrderItemInput[] = input.items.map((i) => ({
      menuItemId: i.menuItemId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));

    const consumptionPlan = await RecipeEngineService.calculateOrderConsumption(
      restaurantId,
      orderItemsForEngine
    );

    // 4. Generate unique sequential Order Number & KOT Number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderCountToday = await prisma.order.count({
      where: {
        restaurantId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });
    const orderNumber = `ORD-${dateStr}-${(orderCountToday + 1).toString().padStart(4, '0')}`;
    const kotNumber = `KOT-${dateStr}-${(orderCountToday + 1).toString().padStart(4, '0')}`;

    // 5. Execute everything inside an atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Calculate payment status
      const totalPaid = input.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
      if (totalPaid >= input.totalAmount) {
        paymentStatus = PaymentStatus.PAID;
      } else if (totalPaid > 0) {
        paymentStatus = PaymentStatus.PARTIALLY_PAID;
      }

      // Create Order
      const order = await tx.order.create({
        data: {
          restaurantId,
          outletId,
          orderNumber,
          orderType: input.orderType,
          status: OrderStatus.CONFIRMED,
          paymentStatus,
          tableId: input.tableId,
          customerId: input.customerId,
          cashierId: input.cashierId,
          idempotencyKey: input.idempotencyKey,
          subtotal: input.subtotal,
          discountAmount: input.discountAmount || 0,
          discountReason: input.discountReason,
          taxAmount: input.taxAmount || 0,
          deliveryFee: input.deliveryFee || 0,
          tipAmount: input.tipAmount || 0,
          totalAmount: input.totalAmount,
          paidAmount: totalPaid,
          changeAmount: Math.max(0, totalPaid - input.totalAmount),
          notes: input.notes,
        },
      });

      // Create Order Items
      const createdItems = [];
      for (const item of input.items) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: item.menuItemId,
            variantId: item.variantId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes,
            addons: item.addons ? JSON.stringify(item.addons) : null,
            discountAmount: item.discountAmount || 0,
          },
        });
        createdItems.push(orderItem);
      }

      // Record Payments
      if (input.payments && input.payments.length > 0) {
        for (const payment of input.payments) {
          await tx.payment.create({
            data: {
              orderId: order.id,
              restaurantId,
              outletId,
              amount: payment.amount,
              paymentMethod: payment.paymentMethod,
              transactionRef: payment.transactionRef,
              status: 'COMPLETED',
              processedByUserId: input.cashierId,
            },
          });
        }
      }

      // Create Kitchen Order Ticket (KOT)
      const kot = await tx.kitchenOrder.create({
        data: {
          orderId: order.id,
          restaurantId,
          outletId,
          kotNumber,
          status: KotStatus.NEW,
          notes: input.notes,
        },
      });

      for (const orderItem of createdItems) {
        await tx.kitchenOrderItem.create({
          data: {
            kitchenOrderId: kot.id,
            orderItemId: orderItem.id,
            menuItemId: orderItem.menuItemId,
            quantity: orderItem.quantity,
            notes: orderItem.notes,
            status: KotStatus.NEW,
          },
        });
      }

      // Update Table Status if Dine-In
      if (input.tableId && input.orderType === OrderType.DINE_IN) {
        const tableStatus = paymentStatus === PaymentStatus.PAID ? TableStatus.AVAILABLE : TableStatus.OCCUPIED;
        await tx.diningTable.update({
          where: { id: input.tableId },
          data: {
            status: tableStatus,
            currentOrderId: paymentStatus === PaymentStatus.PAID ? null : order.id,
          },
        });
      }

      // Update Customer Total Spend & Visits if customer selected
      if (input.customerId) {
        await tx.customer.update({
          where: { id: input.customerId },
          data: {
            totalVisits: { increment: 1 },
            totalSpend: { increment: input.totalAmount },
          },
        });
      }

      // AUTOMATIC INVENTORY DEDUCTION via Inventory Movements
      const inventoryMovements = [];
      for (const item of consumptionPlan) {
        const { movement } = await InventoryService.recordMovement(
          {
            restaurantId,
            outletId,
            ingredientId: item.ingredientId,
            movementType: MovementType.SALE_CONSUMPTION,
            quantity: -item.quantityToDeduct, // negative deduction
            unit: item.inventoryUnit,
            costPerUnit: item.costPerUnit,
            referenceType: 'ORDER',
            referenceId: order.id,
            userId: input.cashierId,
            reason: `Recipe consumption for Order #${orderNumber}`,
          },
          tx
        );
        inventoryMovements.push(movement);
      }

      // Audit Log
      await AuditService.log(
        {
          restaurantId,
          userId: input.cashierId,
          action: 'ORDER_CREATE',
          entity: 'Order',
          entityId: order.id,
          after: {
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            itemsCount: createdItems.length,
            deductionsCount: inventoryMovements.length,
          },
        },
        tx
      );

      return {
        order,
        items: createdItems,
        kot,
        consumption: consumptionPlan,
        isDuplicate: false,
      };
    });

    // Invalidate dashboard caches for this outlet
    await cache.del(`dashboard:${restaurantId}:${outletId}`);

    return result;
  }

  /**
   * Cancel an order: reverses table status, marks order as CANCELLED, and optionally reverses inventory deduction.
   */
  static async cancelOrder(
    restaurantId: string,
    orderId: string,
    userId?: string | null,
    reason?: string,
    reverseStock = true
  ) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, table: true },
      });

      if (!order || order.restaurantId !== restaurantId) {
        throw new Error('Order not found or tenant mismatch');
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new Error('Order is already cancelled');
      }

      // Update Order Status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason || 'Cancelled by staff',
        },
      });

      // Free up Table
      if (order.tableId) {
        await tx.diningTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE, currentOrderId: null },
        });
      }

      // Reverse Inventory Movements if requested (items not cooked / returned to stock)
      if (reverseStock) {
        const consumptionMovements = await tx.inventoryMovement.findMany({
          where: {
            restaurantId,
            referenceType: 'ORDER',
            referenceId: orderId,
            movementType: MovementType.SALE_CONSUMPTION,
          },
        });

        for (const mov of consumptionMovements) {
          await InventoryService.recordMovement(
            {
              restaurantId,
              outletId: order.outletId,
              ingredientId: mov.ingredientId,
              movementType: MovementType.ADJUSTMENT,
              quantity: Math.abs(mov.quantity), // add back
              unit: mov.unit,
              costPerUnit: mov.costPerUnit,
              referenceType: 'ORDER_CANCELLATION',
              referenceId: orderId,
              userId,
              reason: `Reversal for cancelled Order #${order.orderNumber} - ${reason || ''}`,
            },
            tx
          );
        }
      }

      await AuditService.log(
        {
          restaurantId,
          userId,
          action: 'ORDER_CANCEL',
          entity: 'Order',
          entityId: orderId,
          before: { status: order.status },
          after: { status: OrderStatus.CANCELLED, reason, reverseStock },
        },
        tx
      );

      return updatedOrder;
    });
  }

  /**
   * Process a refund for an order.
   */
  static async refundOrder(
    restaurantId: string,
    orderId: string,
    refundAmount: number,
    userId?: string | null,
    reason?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order || order.restaurantId !== restaurantId) {
        throw new Error('Order not found or tenant mismatch');
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.REFUNDED,
          status: OrderStatus.REFUNDED,
          notes: `${order.notes || ''} [Refunded ₹${refundAmount}: ${reason || 'N/A'}]`,
        },
      });

      await tx.payment.create({
        data: {
          orderId,
          restaurantId,
          outletId: order.outletId,
          amount: -refundAmount,
          paymentMethod: PaymentMethod.OTHER,
          status: 'REFUNDED',
          transactionRef: `REFUND-${Date.now()}`,
          processedByUserId: userId,
        },
      });

      await AuditService.log(
        {
          restaurantId,
          userId,
          action: 'ORDER_REFUND',
          entity: 'Order',
          entityId: orderId,
          after: { refundAmount, reason },
        },
        tx
      );

      return updatedOrder;
    });
  }
}
