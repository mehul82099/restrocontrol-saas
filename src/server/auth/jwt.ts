import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

export interface AuthUserPayload {
  userId: string;
  restaurantId: string;
  role: UserRole;
  email: string;
  name: string;
  outletId?: string;
  attendanceSessionId?: string;
  authSessionId?: string;
}

function signingKey(): string {
  const key = process.env.JWT_SECRET;
  if (!key || key.length < 32 || /your-secure|restrocontrol-production|demo|change.?me/i.test(key)) {
    throw new Error('Authentication signing key is not configured securely');
  }
  return key;
}

export function signToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, signingKey(), { expiresIn: '12h', algorithm: 'HS256' });
}

export function verifyToken(token: string): AuthUserPayload | null {
  try {
    const p = jwt.verify(token, signingKey(), { algorithms: ['HS256'] }) as any;
    if (!p || p.purpose || typeof p.userId !== 'string' || !p.userId ||
      typeof p.restaurantId !== 'string' || !p.restaurantId ||
      !['OWNER','MANAGER','CASHIER','KITCHEN_STAFF','WAITER','INVENTORY_MANAGER'].includes(p.role) ||
      (p.authSessionId !== undefined && typeof p.authSessionId !== 'string') ||
      (p.attendanceSessionId !== undefined && typeof p.attendanceSessionId !== 'string')) return null;
    return p as AuthUserPayload;
  } catch {
    return null;
  }
}

// Short-lived, purpose-bound token (e.g. a Google-verified email waiting for the restaurant name at sign-up).
export function signPurposeToken(purpose: string, data: Record<string, string>, ttl: string = '15m'): string {
  return jwt.sign({ ...data, purpose }, signingKey(), { expiresIn: ttl as any, algorithm: 'HS256' });
}

export function verifyPurposeToken(token: string, purpose: string): Record<string, string> | null {
  try {
    const p = jwt.verify(token, signingKey(), { algorithms: ['HS256'] }) as any;
    return p && p.purpose === purpose ? p : null;
  } catch {
    return null;
  }
}
