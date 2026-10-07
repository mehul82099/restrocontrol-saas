import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

export interface AuthUserPayload {
  userId: string;
  restaurantId: string;
  role: UserRole;
  email: string;
  name: string;
  outletId?: string;
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
    return jwt.verify(token, signingKey(), { algorithms: ['HS256'] }) as AuthUserPayload;
  } catch {
    return null;
  }
}
