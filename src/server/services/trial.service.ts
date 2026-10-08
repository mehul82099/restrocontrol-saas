export const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrialInfo {
  isTrial: boolean;
  expired: boolean;
  daysRemaining: number;
  endsAt: string | null;
}

// Only TRIALING subscriptions are ever limited. ACTIVE (seeded demo) accounts are untouched.
export function getTrialInfo(sub: {status: string; currentPeriodEnd: Date} | null | undefined, now = new Date()): TrialInfo {
  if (!sub || sub.status !== 'TRIALING') return {isTrial: false, expired: false, daysRemaining: 0, endsAt: null};
  const msLeft = sub.currentPeriodEnd.getTime() - now.getTime();
  return {
    isTrial: true,
    expired: msLeft <= 0,
    daysRemaining: msLeft <= 0 ? 0 : Math.ceil(msLeft / DAY_MS),
    endsAt: sub.currentPeriodEnd.toISOString(),
  };
}

export function trialEndDate(from = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * DAY_MS);
}

// Routes that must keep working after the trial ends so the owner can see the notice and sign out.
export function isTrialExemptPath(pathname: string, method: string): boolean {
  if (pathname === '/api/auth/me' || pathname === '/api/auth/logout') return true;
  if (pathname === '/api/plans/request' && method === 'POST') return true;
  return pathname === '/api/subscriptions' && method === 'GET';
}
