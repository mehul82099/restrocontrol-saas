import { createHash } from 'crypto';
import { hasPermission } from '../auth/permissions';
import { UserRole } from '@prisma/client';
export const sessionHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const orderAudience = (role: UserRole) => hasPermission(role, 'manage:orders') || hasPermission(role, 'access:kot');
// Never send a request to arbitrary user-supplied URLs (SSRF).
export function validPushEndpoint(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname);
  } catch { return false; }
}
