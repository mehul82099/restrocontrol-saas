import { planBreakup, findSubscriptionPlan } from '@/lib/subscription-plans';
import { prisma } from '@/server/db/prisma';
import { validSignature } from './razorpay-test';
export { validSignature };
// LIVE (real money) Razorpay billing. Off unless RAZORPAY_LIVE_ENABLED=true and a rzp_live_ key is set.
export function liveEnabled() { return process.env.RAZORPAY_LIVE_ENABLED === 'true'; }
export function liveConfig() {
  if (!liveEnabled()) throw new Error('LIVE billing is disabled.');
  const key = process.env.RAZORPAY_LIVE_KEY_ID || '', secret = process.env.RAZORPAY_LIVE_KEY_SECRET || '';
  if (!key.startsWith('rzp_live_') || !secret) throw new Error('Valid LIVE keys are required.');
  return { key, secret };
}
export function livePlan(code: unknown) {
  const plan = findSubscriptionPlan(code);
  if (!plan || plan.upcoming) throw new Error('Choose an available website plan.');
  const id = process.env[plan.code === 'WEBSITE_SINGLE' ? 'RAZORPAY_LIVE_PLAN_SINGLE' : 'RAZORPAY_LIVE_PLAN_MULTI'];
  if (!id?.startsWith('plan_')) throw new Error('LIVE plan mapping is missing.');
  return { ...plan, id };
}
export async function razorLive(path: string, method = 'GET', body?: unknown) {
  const { key, secret } = liveConfig();
  // Fixed API origin. Keys are never sent to a caller-provided URL.
  const response = await fetch('https://api.razorpay.com/v1/' + path, { method, headers: { Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Razorpay LIVE request failed (' + response.status + ').');
  return response.json();
}
export async function verifyLivePlan(code: unknown) {
  const plan = livePlan(code), remote = await razorLive('plans/' + plan.id);
  if (remote.period !== 'monthly' || remote.interval !== 1 || remote.item?.amount !== planBreakup(plan).totalPaise || remote.item?.currency !== 'INR') throw new Error('LIVE plan amount/currency/interval does not match the GST-inclusive catalogue total.');
  return plan;
}
// Provider state is the only source of truth. Entitlement follows verified provider state, never a client callback.
export async function refreshLiveSubscription(providerId: string) {
  const row = await prisma.liveBillingSubscription.findUnique({ where: { providerId } });
  if (!row) throw new Error('Unknown LIVE subscription.');
  const remote = await razorLive('subscriptions/' + providerId);
  if (remote.id !== providerId) throw new Error('Provider identity mismatch.');
  const code = remote.plan_id === livePlan('WEBSITE_SINGLE').id ? 'WEBSITE_SINGLE' : remote.plan_id === livePlan('WEBSITE_MULTI').id ? 'WEBSITE_MULTI' : null;
  if (!code) throw new Error('Unknown LIVE plan.');
  const updated = await prisma.liveBillingSubscription.update({ where: { id: row.id }, data: { providerStatus: remote.status, planCode: code, ...(row.pendingPlanCode === code ? { pendingPlanCode: null } : {}), currentStart: remote.current_start || null, currentEnd: remote.current_end || null } });
  await applyEntitlement(updated);
  return updated;
}
export async function applyEntitlement(row: { restaurantId: string; planCode: string; providerStatus: string; currentStart: number | null; currentEnd: number | null }) {
  const status = row.providerStatus;
  const plan = await prisma.plan.findUnique({ where: { code: row.planCode } });
  if (!plan) throw new Error('Plan row missing.');
  if (status === 'active' && row.currentEnd && row.currentEnd * 1000 > Date.now()) {
    const start = new Date((row.currentStart || Math.floor(Date.now() / 1000)) * 1000), end = new Date(row.currentEnd * 1000);
    await prisma.subscription.upsert({ where: { restaurantId: row.restaurantId }, update: { planId: plan.id, status: 'ACTIVE', currentPeriodStart: start, currentPeriodEnd: end }, create: { restaurantId: row.restaurantId, planId: plan.id, status: 'ACTIVE', currentPeriodStart: start, currentPeriodEnd: end } });
  } else if (!row.currentEnd) {
    // Never charged (abandoned or expired checkout): leave the trial/account exactly as it is.
  } else if (status === 'pending' || status === 'halted') {
    await prisma.subscription.updateMany({ where: { restaurantId: row.restaurantId }, data: { status: 'PAST_DUE' } });
  } else if (status === 'cancelled' || status === 'completed' || status === 'expired') {
    await prisma.subscription.updateMany({ where: { restaurantId: row.restaurantId }, data: { status: 'CANCELLED' } });
  }
  // created / authenticated / paused: no entitlement change.
}
