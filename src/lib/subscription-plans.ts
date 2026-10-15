// Owner-requested catalogue. Monthly billing is confirmed; quota decisions are pending review.
// No price in this module authorizes a payment or a subscription activation.
export const SUBSCRIPTION_PLANS = [
  { code: 'WEBSITE_SINGLE', name: '1 outlet setup', price: 499, upcoming: false, description: 'Website access for 1 outlet.' },
  { code: 'WEBSITE_MULTI', name: '2 or more outlets', price: 699, upcoming: false, description: 'Website access with unlimited outlets and staff. Monthly order limit is awaiting confirmation.' },
  { code: 'APP_SINGLE', name: 'App + website access', price: 699, upcoming: true, description: 'App + website access. Upcoming, not available for purchase.' },
  { code: 'APP_MULTI', name: 'App + website, 2+ outlets', price: 999, upcoming: true, description: 'App + website access for 2 or more outlets. Upcoming, not available for purchase.' },
] as const;
export function findSubscriptionPlan(code: unknown) {
  return SUBSCRIPTION_PLANS.find(plan => plan.code === code);
}
