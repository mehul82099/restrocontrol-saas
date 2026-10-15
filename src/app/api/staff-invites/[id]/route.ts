import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/audit.service';

// Cancel (revoke) an unused invite of this restaurant.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get('origin');
  if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(req.url).origin)) return NextResponse.json({ success: false, error: 'Cross-origin request denied.' }, { status: 403 });
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:users');
  if (errorResponse || !auth) return errorResponse;
  if (auth.user.role !== 'OWNER' && auth.user.role !== 'MANAGER') return NextResponse.json({ success: false, error: 'Permission denied.' }, { status: 403 });
  const { id } = await ctx.params;
  const r = await prisma.staffInvite.updateMany({ where: { id, restaurantId: auth.restaurantId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (r.count !== 1) return NextResponse.json({ success: false, error: 'Invite not found or already used.' }, { status: 404 });
  await AuditService.log({ restaurantId: auth.restaurantId, userId: auth.user.userId, action: 'STAFF_INVITE_REVOKE', entity: 'StaffInvite', entityId: id });
  return NextResponse.json({ success: true });
}
export const dynamic = 'force-dynamic';
