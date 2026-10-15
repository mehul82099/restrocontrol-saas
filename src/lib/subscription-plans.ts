import catalog from './plan-catalog.json';
// Monthly owner-approved catalogue. null quotas mean unlimited for available plans.
// Upcoming plans have no purchasable entitlement, regardless of quota metadata.
export const SUBSCRIPTION_PLANS = catalog;
export function findSubscriptionPlan(code: unknown) {
  return SUBSCRIPTION_PLANS.find(plan => plan.code === code);
}
