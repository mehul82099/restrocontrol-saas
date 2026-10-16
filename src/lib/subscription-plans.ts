import catalog from './plan-catalog.json';
import { gstBreakup, type PriceBreakup } from './gst';
// Monthly owner-approved catalogue. null quotas mean unlimited for available plans.
// Upcoming plans have no purchasable entitlement, regardless of quota metadata.
// `price` is the monthly base price in rupees; 18% GST is added on top (see ./gst).
export const SUBSCRIPTION_PLANS = catalog;
export function findSubscriptionPlan(code: unknown) {
  return SUBSCRIPTION_PLANS.find(plan => plan.code === code);
}
// GST-inclusive monthly breakup for a catalogue plan, in paise.
export function planBreakup(plan: { price: number }): PriceBreakup {
  if (!Number.isSafeInteger(plan.price)) throw new Error('Plan price must be whole rupees.');
  return gstBreakup(plan.price * 100);
}
