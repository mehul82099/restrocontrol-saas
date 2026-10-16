import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/middleware';
import { prisma } from '@/server/db/prisma';
import { AuditService } from '@/server/services/audit.service';
import { SubscriptionService } from '@/server/services/subscription.service';
import { INVITE_TTL_MS, hashToken, newToken, isInviteRole, inviteState } from '@/server/services/invite.service';

// Owner and Manager (manage:users) only. The raw link is returned once, at creation.
export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:users');
  if (errorResponse || !auth) return errorResponse;
  const rows = await prisma.staffInvite.findMany({
    where: { restaurantId: auth.restaurantId },
    orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, role: true, label: true, createdAt: true, expiresAt: true, usedAt: true, revokedAt: true, createdBy: { select: { name: true } }, usedBy: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ success: true, invites: rows.map((r) => ({ ...r, state: inviteState(r) })) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(req.url).origin)) return NextResponse.json({ success: false, error: 'Cross-origin request denied.' }, { status: 403 });
  const { auth, errorResponse } = await authenticateRequest(req, 'manage:users');
  if (errorResponse || !auth) return errorResponse;
  if (auth.user.role !== 'OWNER' && auth.user.role !== 'MANAGER') return NextResponse.json({ success: false, error: 'Permission denied.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!isInviteRole(body.role)) return NextResponse.json({ success: false, error: 'Choose cashier, kitchen or waiter.' }, { status: 400 });
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 80) || null : null;
  const check = await SubscriptionService.canPerformAction(auth.restaurantId, 'ADD_USER');
  if (!check.allowed) return NextResponse.json({ success: false, error: check.reason }, { status: 403 });
  const recent = await prisma.staffInvite.count({ where: { restaurantId: auth.restaurantId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
  if (recent >= 30) return NextResponse.json({ success: false, error: 'Too many invites created. Try again later.' }, { status: 429 });
  const token = newToken();
  const invite = await prisma.staffInvite.create({ data: { restaurantId: auth.restaurantId, tokenHash: hashToken(token), role: body.role, label, createdById: auth.user.userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) } });
  await AuditService.log({ restaurantId: auth.restaurantId, userId: auth.user.userId, action: 'STAFF_INVITE_CREATE', entity: 'StaffInvite', entityId: invite.id, after: { role: invite.role, label, expiresAt: invite.expiresAt } });
  return NextResponse.json({ success: true, invite: { id: invite.id, role: invite.role, label, expiresAt: invite.expiresAt }, link: `${new URL(req.url).origin}/join/${token}` }, { status: 201 });
}
export const dynamic = 'force-dynamic';
