import type { ManualUpiStore } from './store';
import type { ManualUpiPayment, SubscriptionRow } from './types';

// Real entitlement: approval writes the app's actual `subscription` table
// (same table razorpay-live.ts writes), so plan access follows the same
// machinery everywhere else in the app. Entitlement is granted ONLY from the
// server-side admin approval after a bank-credit-confirmed review, never from
// a client callback.

/** Same-day-of-month calendar month addition (clamps to month end). */
export function addCalendarMonth(d: Date): Date {
  const r = new Date(d.getTime());
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + 1);
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, lastDay));
  return r;
}

/**
 * Activate the subscription for exactly one month paid for by `payment`.
 * - Fresh activation: ACTIVE from payment.periodStart to payment.periodEnd.
 * - Renewal while still covered: EXTEND the current period by one calendar
 *   month from the later of (current period end, new period start). An
 *   approval while the restaurant is active never shortens coverage and
 *   never creates a gap.
 */
export async function activateSubscription(store: ManualUpiStore, payment: ManualUpiPayment, _now: Date = new Date()): Promise<SubscriptionRow> {
  const existing = await store.getSubscription(payment.restaurantId);
  if (existing && existing.status === 'ACTIVE' && existing.currentPeriodEnd.getTime() > payment.periodStart.getTime()) {
    const base = new Date(Math.max(existing.currentPeriodEnd.getTime(), payment.periodStart.getTime()));
    const end = addCalendarMonth(base);
    const row: SubscriptionRow = {
      restaurantId: payment.restaurantId,
      planCode: payment.planCode,
      status: 'ACTIVE',
      currentPeriodStart: existing.currentPeriodStart,
      currentPeriodEnd: end,
    };
    await store.setSubscription(row);
    return row;
  }
  const row: SubscriptionRow = {
    restaurantId: payment.restaurantId,
    planCode: payment.planCode,
    status: 'ACTIVE',
    currentPeriodStart: payment.periodStart,
    currentPeriodEnd: payment.periodEnd,
  };
  await store.setSubscription(row);
  return row;
}

/**
 * Monthly manual renewal: once a period end passes without an approved new
 * payment, the subscription flips to PAST_DUE. Called from the admin queue
 * load and checkout so the sweep happens on activity; a scheduled job can
 * call the same function later. Returns the number flipped.
 */
export async function enforceRenewal(store: ManualUpiStore, now: Date = new Date()): Promise<number> {
  return store.markSubscriptionsPastDueBefore(now);
}
