// Public demo/seed identities must never be able to authenticate (password, Google or existing sessions).
export const DEMO_RESTAURANT_SLUG = 'demo-kitchen';
export const DEMO_EMAIL_DOMAIN = '@demokitchen.com';

export function isDemoEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.toLowerCase().trim().endsWith(DEMO_EMAIL_DOMAIN);
}

export function isDemoAccount(user: { email?: string | null; restaurant?: { slug?: string | null } | null }): boolean {
  return isDemoEmail(user.email) || user.restaurant?.slug === DEMO_RESTAURANT_SLUG;
}
