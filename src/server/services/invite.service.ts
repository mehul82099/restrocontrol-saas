import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db/prisma';
import { issueAttendanceToken } from '@/server/services/attendance.service';
import { AuditService } from '@/server/services/audit.service';
import { SubscriptionService } from '@/server/services/subscription.service';
import { isDemoAccount, isDemoEmail } from '@/server/auth/demo';

export const INVITE_TTL_MS = 48 * 60 * 60 * 1000;
// Presets an invite may carry. Owner and Manager can never be created through a link.
export const INVITE_ROLES = ['CASHIER', 'KITCHEN_STAFF', 'WAITER'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];
export const INVITE_COOKIE = 'g_invite';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
export function newToken(): string {
  return crypto.randomBytes(32).toString('base64url'); // 43 chars
}
export function validTokenShape(t: unknown): t is string {
  return typeof t === 'string' && TOKEN_RE.test(t);
}
export function isInviteRole(r: unknown): r is InviteRole {
  return typeof r === 'string' && (INVITE_ROLES as readonly string[]).includes(r);
}

export type InviteState = 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';
export function inviteState(i: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = new Date()): InviteState {
  if (i.usedAt) return 'USED';
  if (i.revokedAt) return 'REVOKED';
  if (i.expiresAt <= now) return 'EXPIRED';
  return 'PENDING';
}

// Public lookup: reveals only restaurant name and role, and only for a usable invite.
export async function lookupUsableInvite(token: string) {
  if (!validTokenShape(token)) return null;
  const invite = await prisma.staffInvite.findUnique({ where: { tokenHash: hashToken(token) }, include: { restaurant: true } });
  if (!invite || inviteState(invite) !== 'PENDING' || invite.restaurant.slug === 'demo-kitchen') return null;
  return invite;
}

export class InviteError extends Error {
  constructor(public code: 'invalid' | 'email_exists' | 'plan_limit' | 'bad_input', message: string) { super(message); }
}

// Creates the staff user inside the invite's restaurant with the preset role and consumes the invite
// in the same transaction. The conditional update makes a second concurrent use fail.
export async function redeemInvite(opts: { token: string; email: string; name: string; password?: string; ip?: string | null; userAgent?: string | null }) {
  const email = opts.email.toLowerCase().trim();
  const name = opts.name.trim();
  if (!EMAIL_RE.test(email) || email.length > 254 || isDemoEmail(email)) throw new InviteError('bad_input', 'Enter a valid email address.');
  if (name.length < 2 || name.length > 80) throw new InviteError('bad_input', 'Enter your name (2-80 characters).');
  const invite = await lookupUsableInvite(opts.token);
  if (!invite) throw new InviteError('invalid', 'This invite link is invalid, expired or already used.');
  if (!isInviteRole(invite.role)) throw new InviteError('invalid', 'This invite link is invalid, expired or already used.');
  // Login resolves a user by email alone, so an email can belong to only one account.
  if (await prisma.user.findFirst({ where: { email }, select: { id: true } })) throw new InviteError('email_exists', 'An account with this email already exists. Ask your manager for help.');
  const plan = await SubscriptionService.canPerformAction(invite.restaurantId, 'ADD_USER');
  if (!plan.allowed) throw new InviteError('plan_limit', 'This restaurant cannot add more staff right now. Ask the owner.');
  // Google-verified sign-ins have no password: store an unusable random one.
  const password = opts.password ?? crypto.randomBytes(32).toString('base64url') + 'a1';
  const passwordHash = await bcrypt.hash(password, 12);
  const outlet = await prisma.outlet.findFirst({ where: { restaurantId: invite.restaurantId, isDefault: true } });
  const now = new Date();
  const user = await prisma.$transaction(async (tx) => {
    const claimed = await tx.staffInvite.updateMany({ where: { id: invite.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claimed.count !== 1) throw new InviteError('invalid', 'This invite link is invalid, expired or already used.');
    const u = await tx.user.create({ data: { restaurantId: invite.restaurantId, email, name, role: invite.role, passwordHash } });
    if (outlet) await tx.userOutlet.create({ data: { userId: u.id, outletId: outlet.id } });
    await tx.staffInvite.update({ where: { id: invite.id }, data: { usedById: u.id } });
    return u;
  }, { isolationLevel: 'Serializable' }).catch((e) => {
    if (e instanceof InviteError) throw e;
    if (e?.code === 'P2034') throw new InviteError('invalid', 'This invite link is invalid, expired or already used.');
    if (e?.code === 'P2002') throw new InviteError('email_exists', 'An account with this email already exists. Ask your manager for help.');
    throw e;
  });
  // Staff login: attendance check-in token (fails closed).
  const token = await issueAttendanceToken({ userId: user.id, restaurantId: invite.restaurantId, role: user.role, email: user.email, name: user.name, outletId: outlet?.id });
  await AuditService.log({ restaurantId: invite.restaurantId, userId: user.id, action: 'USER_CREATE', entity: 'User', entityId: user.id, after: { email: user.email, name: user.name, role: user.role, via: 'staff_invite', inviteId: invite.id }, ipAddress: opts.ip || undefined, userAgent: opts.userAgent || undefined });
  return { user, token, restaurantName: invite.restaurant.name };
}

export function landingFor(role: string): string {
  return role === 'KITCHEN_STAFF' ? '/kot' : role === 'CASHIER' || role === 'WAITER' ? '/pos' : '/';
}

export { isDemoAccount };
