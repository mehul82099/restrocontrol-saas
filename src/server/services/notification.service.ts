import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';

export interface CreateNotificationInput {
  restaurantId: string;
  outletId?: string | null;
  type: string;
  title: string;
  message: string;
  data?: any;
}

export class NotificationService {
  static async createNotification(
    input: CreateNotificationInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return await db.notification.create({
      data: {
        restaurantId: input.restaurantId,
        outletId: input.outletId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data ? JSON.stringify(input.data) : null,
      },
    });
  }

  static async getNotifications(restaurantId: string, limit = 50) {
    return await prisma.notification.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  static async markAsRead(restaurantId: string, id: string) {
    return await prisma.notification.updateMany({
      where: { id, restaurantId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(restaurantId: string) {
    return await prisma.notification.updateMany({
      where: { restaurantId, isRead: false },
      data: { isRead: true },
    });
  }
}
