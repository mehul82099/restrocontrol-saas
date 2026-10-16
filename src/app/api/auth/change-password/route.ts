import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import bcrypt from 'bcryptjs';
import { authenticateRequest } from '@/server/auth/middleware';
import { AuditService } from '@/server/services/audit.service';
import { validateNewPassword } from '@/server/services/password-policy';

export async function POST(req: NextRequest) {
  try {
    const { auth, errorResponse } = await authenticateRequest(req);
    if (!auth) return errorResponse;

    const body = await req.json().catch(() => null);
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || currentPassword.length > 72 || newPassword.length > 72) {
      return NextResponse.json({ success: false, error: 'Current and new password are required.' }, { status: 400 });
    }
    const policyError = validateNewPassword(newPassword);
    if (policyError) return NextResponse.json({ success: false, error: policyError }, { status: 400 });

    const user = await prisma.user.findFirst({ where: { id: auth.user.userId, restaurantId: auth.restaurantId, isActive: true } });
    if (!user) return NextResponse.json({ success: false, error: 'Account not found.' }, { status: 404 });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 401 });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    await AuditService.log({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: 'PASSWORD_CHANGE',
      entity: 'User',
      entityId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Password could not be changed. Please try again.' }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
