import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';

export interface AuditLogInput {
  restaurantId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: any;
  after?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  static async log(input: AuditLogInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    try {
      return await db.auditLog.create({
        data: {
          restaurantId: input.restaurantId,
          userId: input.userId,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          before: input.before ? JSON.stringify(input.before) : null,
          after: input.after ? JSON.stringify(input.after) : null,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    } catch {
      // Audit log failures should not crash business transactions
      return null;
    }
  }

  static async getLogs(
    restaurantId: string,
    options?: { action?: string; entity?: string; limit?: number; offset?: number }
  ) {
    const where: any = { restaurantId };
    if (options?.action) where.action = options.action;
    if (options?.entity) where.entity = options.entity;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
    ]);

    return { total, logs };
  }
}
