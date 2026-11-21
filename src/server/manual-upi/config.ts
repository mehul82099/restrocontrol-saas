import { ApiError } from './types';

// Flags / env. Nothing secret is ever committed; values come from the runtime
// environment (see .env.example). The placeholder VPA is allowed ONLY outside
// production so the preview module can be exercised end-to-end.

export const MANUAL_UPI_ENABLED_FLAG = 'MANUAL_UPI_ENABLED';
export const MANUAL_UPI_VPA_FLAG = 'MANUAL_UPI_VPA';
export const MANUAL_UPI_PAYEE_NAME_FLAG = 'MANUAL_UPI_PAYEE_NAME';
export const MANUAL_UPI_ADMIN_USER_IDS_FLAG = 'MANUAL_UPI_ADMIN_USER_IDS';
export const MANUAL_UPI_ALLOW_PLACEHOLDER_FLAG = 'MANUAL_UPI_ALLOW_PLACEHOLDER';

export const PLACEHOLDER_VPA = 'TEST-ONLY-placeholder';

export function manualUpiEnabled(): boolean {
  return process.env[MANUAL_UPI_ENABLED_FLAG] === 'true';
}

export function isPlaceholderVpa(vpa: string): boolean {
  return vpa === PLACEHOLDER_VPA;
}

/**
 * Resolve the active VPA / payee config.
 * - Flag off -> 404 (checkout is hidden/unavailable).
 * - Placeholder VPA -> refuse unless MANUAL_UPI_ALLOW_PLACEHOLDER=true, an
 *   explicit, visible choice for non-payable preview environments. Production
 *   never sets that flag, so a missing real VPA stays fail-closed there.
 */
export function vpaConfig(): { vpa: string; payeeName: string } {
  if (!manualUpiEnabled()) throw new ApiError(404, 'Manual UPI payment is disabled.');
  const vpa = (process.env[MANUAL_UPI_VPA_FLAG] || PLACEHOLDER_VPA).trim();
  if (isPlaceholderVpa(vpa) && process.env[MANUAL_UPI_ALLOW_PLACEHOLDER_FLAG] !== 'true') {
    throw new ApiError(503, 'Manual UPI is not configured (set MANUAL_UPI_VPA to a real VPA, or MANUAL_UPI_ALLOW_PLACEHOLDER=true for a clearly-labeled non-payable preview).');
  }
  const payeeName = (process.env[MANUAL_UPI_PAYEE_NAME_FLAG] || 'RestroControl').trim();
  return { vpa, payeeName };
}

// 30-minute TTL on PENDING_UTR, enforced server-side.
export const UTR_TTL_MS = 30 * 60 * 1000;

// Admin allowlist for the manual-UPI review queue, mirroring the existing
// REFUND_ADMIN_USER_IDS pattern (src/server/services/refund-intake.service.ts).
export function isManualUpiAdmin(userId: string): boolean {
  return (process.env[MANUAL_UPI_ADMIN_USER_IDS_FLAG] || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .includes(userId);
}
