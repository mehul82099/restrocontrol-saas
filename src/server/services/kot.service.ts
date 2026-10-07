import { prisma } from '../db/prisma';
import { KotStatus, OrderStatus } from '@prisma/client';

export class KotService {
  /**
   * Get all active KOT tickets for an outlet (for Kitchen Display Screen - KDS).
   */
  static async getActiveTickets(restaurantId: string, outletId: string) {
    return await prisma.kitchenOrder.findMany({
      where: {
        restaurantId,
        outletId,
        order: {status: {notIn: ['CANCELLED', 'REFUNDED']}},
        status: {
          not: KotStatus.SERVED,
        },
      },
      include: {
        order: {
          include: {
            table: true,
            customer: true,
          },
        },
        items: {
          include: {
            orderItem: {
              include: {
                menuItem: true,
                variant: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Update KOT ticket status.
   */
  static async updateTicketStatus(
    restaurantId: string,
    kotId: string,
    newStatus: KotStatus
  ) {
    const kot = await prisma.kitchenOrder.findUnique({
      where: { id: kotId },
      include: { order: true },
    });

    if (!kot || kot.restaurantId !== restaurantId) {
      throw new Error('KOT ticket not found or tenant mismatch');
    }

    if (!Object.values(KotStatus).includes(newStatus) || ['CANCELLED','REFUNDED'].includes(kot.order.status)) throw new Error('Invalid KOT transition');
    const updatedKot = await prisma.kitchenOrder.update({
      where: { id: kotId },
      data: { status: newStatus },
      include: { items: true },
    });

    // Also update order status corresponding to kitchen state
    let correspondingOrderStatus: OrderStatus | null = null;
    if (newStatus === KotStatus.PREPARING) {
      correspondingOrderStatus = OrderStatus.PREPARING;
    } else if (newStatus === KotStatus.READY) {
      correspondingOrderStatus = OrderStatus.READY;
    }

    if (correspondingOrderStatus) {
      await prisma.order.update({
        where: { id: kot.orderId },
        data: { status: correspondingOrderStatus },
      });
    }

    return updatedKot;
  }
}
