import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/server/db/prisma';
import { sendPasswordResetEmail } from '@/server/services/mail.service';
import { isDemoAccount } from '@/server/auth/demo';

// Always answers the same way so the endpoint cannot reveal whether an email has an account.
const GENERIC = { success: true, message: 'If this email has an account, a reset link is on its way.' };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
    if (!email || email.length > 254) return NextResponse.json(GENERIC);

    const candidates = await prisma.user.findMany({ where: { email, isActive: true } });
    const user = candidates.length === 1 ? candidates[0] : null;
    if (!user || isDemoAccount(user)) return NextResponse.json(GENERIC);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      }),
    ]);

    const base = process.env.APP_URL || req.nextUrl.origin;
    const sent = await sendPasswordResetEmail(user.email, `${base}/reset-password?token=${token}`);
    if (!sent) console.warn('[auth] Password reset requested but email delivery is not configured.');
    return NextResponse.json(GENERIC);
  } catch {
    return NextResponse.json(GENERIC);
  }
}

export const dynamic = 'force-dynamic';
