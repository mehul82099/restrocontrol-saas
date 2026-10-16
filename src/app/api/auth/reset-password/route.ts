import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/server/db/prisma';
import bcrypt from 'bcryptjs';
import { AuditService } from '@/server/services/audit.service';
import { validateNewPassword } from '@/server/services/password-policy';

export async function POST(req: NextRequest) {
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
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

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

export const dynamic = 'force-dynamic';
