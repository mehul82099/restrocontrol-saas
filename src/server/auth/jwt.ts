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

const JWT_SECRET = process.env.JWT_SECRET || 'restrocontrol-production-jwt-key-32chars-min-secure-hash';

export function signToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUserPayload;
  } catch {
    return null;
  }
}
