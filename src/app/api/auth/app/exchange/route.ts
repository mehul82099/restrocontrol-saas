// Access: Public one-time app-handoff exchange; rate-limited via the shared
// auth-request security wrapper. Exchanges a PKCE-bound one-time code for the
// normal 12h session cookie inside the app context.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { issueAttendanceToken } from '@/server/services/attendance.service';
import { AuditService } from '@/server/services/audit.service';
import { landingFor } from '@/server/services/invite.service';
import { isDemoAccount } from '@/server/auth/demo';
import { protectAuthRequest, readBoundedText } from '@/server/services/auth-request-security';
import { exchangeHandoff } from '@/server/auth/app-handoff';
import { prismaHandoffStore } from '@/server/auth/app-handoff-store';

const GENERIC = { success: false, error: 'Invalid or expired sign-in link.' };

async function handler(req: NextRequest): Promise<NextResponse> {
  // Generic 400 for every failure path: bad shape, bad code, expired, used,
  // wrong verifier - nothing distinguishes them.
  const fail = () => NextResponse.json(GENERIC, { status: 400 });
  try {
    const text = await readBoundedText(req, 4096);
    const data = JSON.parse(text || '{}');
    const record = await exchangeHandoff(prismaHandoffStore, data?.code, data?.code_verifier);
    if (!record) return fail();

    // Re-read the live user so a deactivation inside the 5-minute window wins.
    const user = await prisma.user.findFirst({
      where: { id: record.userId, isActive: true },
      include: { restaurant: true, userOutlets: { include: { outlet: true } } },
    });
    if (!user || isDemoAccount(user)) return fail();

    const defaultOutlet = user.userOutlets[0]?.outlet || (await prisma.outlet.findFirst({ where: { restaurantId: user.restaurantId, isDefault: true } }));
    const token = await issueAttendanceToken({ userId: user.id, restaurantId: user.restaurantId, role: user.role, email: user.email, name: user.name, outletId: defaultOutlet?.id });
    await AuditService.log({ restaurantId: user.restaurantId, userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1', userAgent: req.headers.get('user-agent') });

    const dest = user.role === 'INVENTORY_MANAGER' ? '/inventory' : landingFor(user.role);
    const res = NextResponse.json({ success: true, landing: dest });
    res.cookies.set('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 12 * 60 * 60 });
    return res;
  } catch {
    return fail();
  }
}

export const POST = protectAuthRequest(handler, {
  scope: 'app-exchange',
  ipLimit: 10,
  windowMs: 60 * 1000,
  generic: GENERIC,
});
export const dynamic = 'force-dynamic';
