import { prisma } from '../db/prisma';
import { WastageReason, ApprovalStatus, MovementType } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';

export interface RecordWastageInput {
  restaurantId: string;
  outletId: string;
  ingredientId: string;
  quantity: number;
  unit?: string;
  reason: WastageReason;
  reportedByUserId?: string | null;
  notes?: string;
  autoApproveThreshold?: number; // e.g. amount in currency below which is auto-approved
}

export class WastageService {
  static async recordWastage(input: RecordWastageInput) {
    const { restaurantId, outletId, ingredientId, quantity, reason, reportedByUserId, notes } = input;

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });
    if (!ingredient || ingredient.restaurantId !== restaurantId) {
      throw new Error('Ingredient not found or tenant mismatch');
    }

    const unit = input.unit || ingredient.unit;
    const costPerUnit = ingredient.costPerUnit;
    const totalCost = quantity * costPerUnit;

    // Configurable threshold: e.g. if totalCost <= threshold (default 500), auto-approve; otherwise PENDING_APPROVAL
    const threshold = input.autoApproveThreshold ?? 500;
    const status: ApprovalStatus = totalCost <= threshold ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING_APPROVAL;

    return await prisma.$transaction(async (tx) => {
      const wastage = await tx.wastage.create({
        data: {
          restaurantId,
          outletId,
          ingredientId,
          quantity,
          unit,
          costPerUnit,
          totalCost,
          reason,
          reportedByUserId,
          approvedByUserId: status === ApprovalStatus.APPROVED ? reportedByUserId : null,
          status,
          notes,
        },
      });

      // If approved immediately, record ledger movement and deduct inventory
      if (status === ApprovalStatus.APPROVED) {
        await InventoryService.recordMovement(
          {
            restaurantId,
            outletId,
            ingredientId,
            movementType: MovementType.WASTAGE,
            quantity: -quantity, // deduct
            unit,
            costPerUnit,
            referenceType: 'WASTAGE',
            referenceId: wastage.id,
            userId: reportedByUserId,
            reason: `Wastage: ${reason} - ${notes || ''}`,
          },
          tx
        );
      } else {
        // High wastage notification requiring manager approval
        await NotificationService.createNotification(
          {
            restaurantId,
            outletId,
            type: 'APPROVAL_REQUIRED',
            title: `High Wastage Recorded: ₹${totalCost.toFixed(2)}`,
            message: `${quantity} ${unit} of ${ingredient.name} recorded as ${reason}. Manager approval required.`,
            data: { wastageId: wastage.id, totalCost, ingredientName: ingredient.name },
          },
          tx
        );
      }

      await AuditService.log(
        {
          restaurantId,
          userId: reportedByUserId,
          action: 'WASTAGE_RECORD',
          entity: 'Wastage',
          entityId: wastage.id,
          after: { quantity, unit, totalCost, status, reason },
        },
        tx
      );

      return wastage;
    });
  }

  static async approveWastage(
    restaurantId: string,
    wastageId: string,
    approvedByUserId: string,
    approve: boolean
  ) {
    return await prisma.$transaction(async (tx) => {
      const wastage = await tx.wastage.findUnique({
        where: { id: wastageId },
        include: { ingredient: true },
      });

      if (!wastage || wastage.restaurantId !== restaurantId) {
        throw new Error('Wastage record not found or tenant mismatch');
      }

      if (wastage.status !== ApprovalStatus.PENDING_APPROVAL) {
        throw new Error(`Wastage is already ${wastage.status}`);
      }

      const newStatus = approve ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

      const updated = await tx.wastage.update({
        where: { id: wastageId },
        data: {
          status: newStatus,
          approvedByUserId,
        },
      });

      if (approve) {
        // Record ledger movement now
        await InventoryService.recordMovement(
          {
            restaurantId,
            outletId: wastage.outletId,
            ingredientId: wastage.ingredientId,
            movementType: MovementType.WASTAGE,
            quantity: -wastage.quantity,
            unit: wastage.unit,
            costPerUnit: wastage.costPerUnit,
            referenceType: 'WASTAGE',
            referenceId: wastage.id,
            userId: approvedByUserId,
            reason: `Wastage approved: ${wastage.reason} - ${wastage.notes || ''}`,
          },
          tx
        );
      }

      await AuditService.log(
        {
          restaurantId,
          userId: approvedByUserId,
          action: approve ? 'WASTAGE_APPROVE' : 'WASTAGE_REJECT',
          entity: 'Wastage',
          entityId: wastageId,
          after: { status: newStatus },
        },
        tx
      );

      return updated;
    });
  }

  static async listWastages(restaurantId: string, outletId?: string) {
    return await prisma.wastage.findMany({
      where: {
        restaurantId,
        ...(outletId ? { outletId } : {}),
      },
      include: {
        ingredient: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
