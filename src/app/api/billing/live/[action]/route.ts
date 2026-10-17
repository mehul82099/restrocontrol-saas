import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { authenticateRequest } from '@/server/auth/middleware';
import { liveConfig, liveEnabled, verifyLivePlan, razorLive, refreshLiveSubscription, validSignature } from '@/server/billing/razorpay-live';
export const dynamic = 'force-dynamic';
const fail = (status = 400) => NextResponse.json({ success: false, error: 'Billing request failed. Your account was not charged by this step. Try again or contact support.' }, { status });
async function owner(req: NextRequest) {
  const r = await authenticateRequest(req, 'manage:subscription');
  if (r.errorResponse || !r.auth) return { error: r.errorResponse };
  try { liveConfig(); } catch { return { error: NextResponse.json({ success: false, error: 'Online billing is not available yet.' }, { status: 503 }) }; }
  return { auth: r.auth };
}
async function json(req: NextRequest) { const t = await req.text(); if (t.length > 4096) throw new Error('Request too large.'); return JSON.parse(t || '{}'); }
export async function GET(req: NextRequest, { params }: { params: { action: string } }) {
  if (params.action === 'status') { // public, tells the UI whether to show the checkout button
    return NextResponse.json({ success: true, enabled: liveEnabled() }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (params.action !== 'checkout') return fail(404);
  const { auth, error } = await owner(req); if (error || !auth) return error;
  return NextResponse.json({ success: true, key: liveConfig().key, subscription: await prisma.liveBillingSubscription.findUnique({ where: { restaurantId: auth.restaurantId } }) }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  if (params.action === 'webhook') return webhook(req);
  const { auth, error } = await owner(req); if (error || !auth) return error;
  try {
    const body = await json(req);
    if (params.action === 'checkout') {
      if (body.confirmLive !== true) throw new Error('Explicit confirmation required.');
      const plan = await verifyLivePlan(body.planCode);
      const previous = await prisma.liveBillingSubscription.findUnique({ where: { restaurantId: auth.restaurantId } });
      // One mandate per restaurant: an existing record is reused, never duplicated.
      if (previous && !['cancelled', 'completed', 'expired'].includes(previous.providerStatus)) return NextResponse.json({ success: true, subscription: previous, key: liveConfig().key, reused: true });
      if (previous) await prisma.liveBillingSubscription.delete({ where: { id: previous.id } });
      const record = await prisma.liveBillingSubscription.create({ data: { restaurantId: auth.restaurantId, planCode: plan.code } });
      const total = Math.min(Math.max(parseInt(process.env.RAZORPAY_LIVE_TOTAL_COUNT || '120', 10) || 120, 1), 1200);
      const remote = await razorLive('subscriptions', 'POST', { plan_id: plan.id, total_count: total, quantity: 1, customer_notify: true, expire_by: Math.floor(Date.now() / 1000) + 3600, notes: { restaurant_record_id: record.id } });
      const subscription = await prisma.liveBillingSubscription.update({ where: { id: record.id }, data: { providerId: remote.id, providerStatus: remote.status } });
      return NextResponse.json({ success: true, subscription, key: liveConfig().key }, { status: 201 });
    }
    const row = await prisma.liveBillingSubscription.findUnique({ where: { restaurantId: auth.restaurantId } });
    if (!row?.providerId) throw new Error('No subscription.');
    if (params.action === 'verify') {
      if (row.providerId !== body.razorpay_subscription_id || typeof body.razorpay_payment_id !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(body.razorpay_payment_id) || !validSignature(body.razorpay_payment_id + '|' + row.providerId, body.razorpay_signature || '', liveConfig().secret)) throw new Error('Invalid checkout signature.');
      await prisma.liveBillingSubscription.update({ where: { id: row.id }, data: { checkoutVerifiedAt: new Date() } });
      return NextResponse.json({ success: true, subscription: await refreshLiveSubscription(row.providerId) });
    }
    if (params.action === 'cancel') {
      if (body.confirmCancel !== true) throw new Error('Explicit confirmation required.');
      await razorLive('subscriptions/' + row.providerId + '/cancel', 'POST', { cancel_at_cycle_end: 0 }); // access ends immediately, per policy
      return NextResponse.json({ success: true, subscription: await refreshLiveSubscription(row.providerId) });
    }
    if (params.action === 'upgrade') {
      if (body.schedule !== 'cycle_end') throw new Error('End-of-cycle upgrade only.');
      const current = await refreshLiveSubscription(row.providerId);
      if (current.planCode !== 'WEBSITE_SINGLE' || current.providerStatus !== 'active' || current.pendingPlanCode) throw new Error('Upgrade unavailable.');
      const plan = await verifyLivePlan('WEBSITE_MULTI');
      await razorLive('subscriptions/' + row.providerId, 'PATCH', { plan_id: plan.id, schedule_change_at: 'cycle_end', customer_notify: true });
      return NextResponse.json({ success: true, subscription: await prisma.liveBillingSubscription.update({ where: { id: row.id }, data: { pendingPlanCode: 'WEBSITE_MULTI' } }) });
    }
    return fail(404);
  } catch { return fail(); }
}
async function webhook(req: NextRequest) {
  try {
    liveConfig(); const secret = process.env.RAZORPAY_LIVE_WEBHOOK_SECRET;
    if (!secret) return new NextResponse('Webhook not configured', { status: 503 });
    const raw = await req.text(); if (raw.length > 262144) return new NextResponse('Too large', { status: 413 });
    if (!validSignature(raw, req.headers.get('x-razorpay-signature') || '', secret)) return new NextResponse('Invalid signature', { status: 400 });
    const body = JSON.parse(raw), eventId = req.headers.get('x-razorpay-event-id');
    if (!eventId || eventId.length > 200) return new NextResponse('Event ID required', { status: 400 });
    if (await prisma.liveBillingEvent.findUnique({ where: { eventId } })) return NextResponse.json({ success: true, duplicate: true });
    if (typeof body.event !== 'string' || !body.event.startsWith('subscription.')) return NextResponse.json({ success: true, ignored: true });
    const providerId = body.payload?.subscription?.entity?.id;
    // Unknown id: ack with 200 so Razorpay does not retry endlessly (could belong to another product on the account).
    if (typeof providerId !== 'string' || !await prisma.liveBillingSubscription.findUnique({ where: { providerId } })) return NextResponse.json({ success: true, ignored: true });
    await refreshLiveSubscription(providerId); // fetch authoritative state; out-of-order webhooks are harmless
    await prisma.liveBillingEvent.upsert({ where: { eventId }, update: {}, create: { eventId, providerId, eventType: body.event } });
    return NextResponse.json({ success: true });
  } catch { return new NextResponse('Webhook processing failed; retry required', { status: 503 }); }
}
