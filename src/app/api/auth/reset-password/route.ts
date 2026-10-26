import { protectAuthRequest } from '@/server/services/auth-request-security';
import { invalidateUserSessions } from '@/server/services/auth.service';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/server/db/prisma';
import bcrypt from 'bcryptjs';
import { AuditService } from '@/server/services/audit.service';
import { validateNewPassword } from '@/server/services/password-policy';

async function resetPassword(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : '';
    const newPassword = body?.newPassword;
    if (!token || token.length > 128) {
      return NextResponse.json({ success: false, error: 'This reset link is invalid.' }, { status: 400 });
    }
    const policyError = validateNewPassword(newPassword);
    if (policyError) return NextResponse.json({ success: false, error: policyError }, { status: 400 });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
      return NextResponse.json({ success: false, error: 'This reset link is invalid or has expired. Request a new one.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction(async tx => {
      // User lock order is shared with issuance and credential changes.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${record.userId} AND "restaurantId" = ${record.user.restaurantId} FOR UPDATE`;
      const now = new Date();
      const claim = await tx.passwordResetToken.updateMany({where: {id: record.id, userId: record.userId,
        tokenHash, usedAt: null, expiresAt: {gt: now}, user: {isActive: true}}, data: {usedAt: now}});
      if (claim.count !== 1) throw new Error('Reset link already consumed');
      await tx.user.update({where: {id: record.userId}, data: {passwordHash, authVersion: {increment: 1}}});
      await tx.passwordResetToken.updateMany({where: {userId: record.userId, usedAt: null}, data: {usedAt: now}});
      await invalidateUserSessions(tx, record.userId, record.user.restaurantId, now);
    });

    await AuditService.log({
      restaurantId: record.user.restaurantId,
      userId: record.userId,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: record.userId,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Password could not be reset. Please request a new link.' }, { status: 400 });
  }
}

export const POST = protectAuthRequest(resetPassword, {scope: 'reset-password', ipLimit: 100, identityLimit: 10});
export const dynamic = 'force-dynamic';
