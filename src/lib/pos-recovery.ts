// Device-only recovery. Never a substitute for server-confirmed orders.
export const recoveryKey = (restaurant: string, user: string, outlet: string) =>
  `restrocontrol:pos:v1:${restaurant}:${user}:${outlet}`;
export function decodeRecovery(raw: string | null) {
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value.version !== 1 || !Array.isArray(value.cart) || !Array.isArray(value.heldOrders) ||
      !['DINE_IN', 'TAKEAWAY', 'DELIVERY'].includes(value.orderType) ||
      !Number.isFinite(value.deliveryCharge) || !Number.isFinite(value.discountPercent) ||
      value.cart.some((i: any) => !i.menuItemId || !Number.isFinite(i.quantity) || i.quantity < 1 || !Number.isFinite(i.totalPrice)) ||
      value.heldOrders.some((h: any) => !h.id || !Array.isArray(h.cart)) ||
      (value.pendingCheckout && (!value.pendingCheckout.idempotencyKey || !Array.isArray(value.pendingCheckout.items)))) {
    throw new Error('Saved order is unreadable. Do not start another payment until the order history is checked.');
  }
  return value;
}
export function elapsedLabel(date: string, now = Date.now()) {
  const mins = Math.max(0, Math.floor((now - new Date(date).getTime()) / 60000));
  if (!Number.isFinite(mins)) return 'Time unavailable';
  if (mins >= 1440) return `${Math.floor(mins / 1440)}d ${Math.floor(mins % 1440 / 60)}h old`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m elapsed`;
  return `${mins}m elapsed`;
}
export function ticketToken(value: string) {
  // Display only: retain the full unique identifier for lookup and receipt links.
  return value?.replace(/-/g, '').slice(-8).toUpperCase() || 'Unknown';
}
