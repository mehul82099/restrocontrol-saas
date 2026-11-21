/* Integrated-code behavioral verification (service + store + entitlement).
 * Runs the adversarial scenario set against the InMemoryStore, mirroring the
 * independent verifier's cases plus the fixes applied during integration:
 * F1 atomic duplicate-UTR rejection, F3 fresh checkout after terminal order,
 * self-healing entitlement on repeated approve, renewal semantics. */
process.env.MANUAL_UPI_STORE = 'memory';
process.env.MANUAL_UPI_ENABLED = 'true';
process.env.MANUAL_UPI_VPA = 'TEST-ONLY-placeholder';
(process.env as Record<string, string>).NODE_ENV = 'test';

import { InMemoryStore } from '../src/server/manual-upi/store';
import { approvePayment, createManualOrder, rejectPayment, submitUtr, sweepExpiredPayments } from '../src/server/manual-upi/service';
import { enforceRenewal, addCalendarMonth } from '../src/server/manual-upi/entitlement';
import { planBreakup, findSubscriptionPlan } from '../src/lib/subscription-plans';

let pass = 0, fail = 0;
function ok(cond: boolean, name: string, extra = '') {
  if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra); }
}
async function expectErr(fn: () => Promise<unknown>, status: number, name: string) {
  try { await fn(); fail++; console.log('FAIL', name, '(no error thrown)'); }
  catch (e: any) { ok(e?.status === status, name, `got status ${e?.status}`); }
}

async function main() {
  const store = new InMemoryStore();
  const R1 = 'rest-1', R2 = 'rest-2';

  // 0a: GST-inclusive amount from the real catalog (499 + 18% = 58882 paise)
  const plan = findSubscriptionPlan('WEBSITE_SINGLE')!;
  ok(planBreakup(plan).totalPaise === 58882, '0a GST-inclusive amount 58882');

  // 0b: flag gating
  process.env.MANUAL_UPI_ENABLED = 'false';
  await expectErr(() => createManualOrder(store, { restaurantId: R1, planCode: 'WEBSITE_SINGLE' }), 404, '0b flag off -> 404');
  process.env.MANUAL_UPI_ENABLED = 'true';

  // 0c: placeholder VPA refused in production
  (process.env as Record<string, string>).NODE_ENV = 'production';
  await expectErr(() => createManualOrder(store, { restaurantId: R1, planCode: 'WEBSITE_SINGLE' }), 503, '0c placeholder VPA refused in prod (503)');
  (process.env as Record<string, string>).NODE_ENV = 'test';

  // 1a: checkout creates PENDING_UTR, ~1 month period
  const o1 = await createManualOrder(store, { restaurantId: R1, planCode: 'WEBSITE_SINGLE' });
  ok(o1.payment.status === 'PENDING_UTR' && !o1.reused, '1a checkout pending');
  ok(Math.abs(o1.payment.periodEnd.getTime() - addCalendarMonth(o1.payment.periodStart).getTime()) < 1000, '1a period ~1mo');
  ok(o1.payment.amountPaise === 58882 && o1.payment.vpaSnapshot === 'TEST-ONLY-placeholder', '1a amount+vpa snapshot');

  // 1b: repeat checkout reuses the open order (integrated semantics)
  const o1b = await createManualOrder(store, { restaurantId: R1, planCode: 'WEBSITE_SINGLE' });
  ok(o1b.reused && o1b.payment.id === o1.payment.id, '1b open order reused not duplicated');

  // 1c: unknown/upcoming plan rejected
  await expectErr(() => createManualOrder(store, { restaurantId: R1, planCode: 'NOPE' }), 400, '1c unknown plan 400');
  await expectErr(() => createManualOrder(store, { restaurantId: R1, planCode: 'APP_SINGLE' }), 400, '1c upcoming plan 400');

  // 2a: no subscription before APPROVED
  ok((await store.getSubscription(R1)) === null, '2a no subscription before approval');

  // 3a/3b: UTR validation
  await expectErr(() => submitUtr(store, { restaurantId: R1, orderId: o1.payment.id, utr: '123' }), 400, '3a malformed UTR 400');
  const s1 = await submitUtr(store, { restaurantId: R1, orderId: o1.payment.id, utr: 'utr000000001' });
  ok(s1.status === 'UTR_SUBMITTED' && s1.utr === 'UTR000000001', '3b valid UTR normalized uppercase');

  // 3c: duplicate UTR across two orders of same restaurant
  const o2 = await createManualOrder(store, { restaurantId: R1, planCode: 'WEBSITE_MULTI' });
  await expectErr(() => submitUtr(store, { restaurantId: R1, orderId: o2.payment.id, utr: 'UTR000000001' }), 409, '3c duplicate UTR same restaurant 409');

  // 3d: duplicate UTR across restaurants
  const o3 = await createManualOrder(store, { restaurantId: R2, planCode: 'WEBSITE_SINGLE' });
  await expectErr(() => submitUtr(store, { restaurantId: R2, orderId: o3.payment.id, utr: 'UTR000000001' }), 409, '3d duplicate UTR cross-restaurant 409');

  // 3e: submit on non-PENDING payment
  await expectErr(() => submitUtr(store, { restaurantId: R1, orderId: o1.payment.id, utr: 'UTR000000002' }), 409, '3e resubmit 409');

  // 4a: cross-restaurant submit blocked
  await expectErr(() => submitUtr(store, { restaurantId: R2, orderId: o1.payment.id, utr: 'UTR000000099' }), 403, '4a cross-restaurant submit 403');

  // 5a: approve without bank-credit-confirmed -> 400; reject without note -> 400
  await expectErr(() => approvePayment(store, { paymentId: o1.payment.id, reviewedBy: 'admin', bankCreditConfirmed: false }), 400, '5a approve w/o bank confirm 400');
  await expectErr(() => rejectPayment(store, { paymentId: o1.payment.id, reviewedBy: 'admin', reviewNote: ' ' }), 400, '5b reject w/o note 400');

  // 6a: approve with bankCreditConfirmed -> APPROVED + ACTIVE ~1mo
  const a1 = await approvePayment(store, { paymentId: o1.payment.id, reviewedBy: 'admin', bankCreditConfirmed: true });
  ok(a1.decision === 'APPROVED' && a1.activated && !a1.already, '6a approved+activated');
  const sub1 = await store.getSubscription(R1);
  ok(sub1?.status === 'ACTIVE' && sub1.planCode === 'WEBSITE_SINGLE', '6a subscription ACTIVE');

  // 6b: repeated approve idempotent, no double entitlement (and self-heals)
  const a1b = await approvePayment(store, { paymentId: o1.payment.id, reviewedBy: 'admin', bankCreditConfirmed: true });
  ok(a1b.already && a1b.decision === 'APPROVED', '6b repeated approve idempotent');
  const sub1b = await store.getSubscription(R1);
  ok(sub1b?.currentPeriodEnd.getTime() === sub1?.currentPeriodEnd.getTime(), '6b no double entitlement');

  // 7: concurrent approve+reject -> exactly one wins
  const o4 = await createManualOrder(store, { restaurantId: R2, planCode: 'WEBSITE_SINGLE' });
  await submitUtr(store, { restaurantId: R2, orderId: o4.payment.id, utr: 'UTR000000777' });
  const [r1, r2] = await Promise.all([
    approvePayment(store, { paymentId: o4.payment.id, reviewedBy: 'admin', bankCreditConfirmed: true }),
    rejectPayment(store, { paymentId: o4.payment.id, reviewedBy: 'admin', reviewNote: 'not found' }),
  ]);
  const final7 = await store.findPayment(o4.payment.id);
  ok([r1, r2].filter(r => !r.already).length === 1 && r1.decision === final7!.status && r2.decision === final7!.status, '7 concurrent exactly-one-wins (loser sees existing decision)');
  const final4 = await store.findPayment(o4.payment.id);
  ok(final4!.status === 'APPROVED' || final4!.status === 'REJECTED', '7 final status terminal');
  const sub4 = await store.getSubscription(R2);
  ok((final4!.status === 'APPROVED') === (sub4?.status === 'ACTIVE'), '7 entitlement matches winner');

  // F1: concurrent same-UTR submits on two orders -> exactly one succeeds
  const o5 = await createManualOrder(store, { restaurantId: R1, planCode: 'WEBSITE_MULTI' });
  const o6 = await createManualOrder(store, { restaurantId: R2, planCode: 'WEBSITE_MULTI' });
  const results = await Promise.allSettled([
    submitUtr(store, { restaurantId: R1, orderId: o5.payment.id, utr: 'RACEUTRA0011' }),
    submitUtr(store, { restaurantId: R2, orderId: o6.payment.id, utr: 'RACEUTRA0011' }),
  ]);
  const okCount = results.filter(r => r.status === 'fulfilled').length;
  const rej = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
  ok(okCount === 1 && rej !== undefined && rej.reason?.status === 409, 'F1 concurrent same-UTR exactly one succeeds, loser 409');

  // 8a: TTL sweep -> EXPIRED, then submit/approve -> 410
  const past = new Date(Date.now() - 31 * 60 * 1000);
  const o7 = await createManualOrder(store, { restaurantId: R1, planCode: 'WEBSITE_SINGLE', now: past });
  await sweepExpiredPayments(store);
  await expectErr(() => submitUtr(store, { restaurantId: R1, orderId: o7.payment.id, utr: 'UTR000000888' }), 410, '8a expired submit 410');
  await expectErr(() => approvePayment(store, { paymentId: o7.payment.id, reviewedBy: 'admin', bankCreditConfirmed: true }), 410, '8a expired approve 410');

  // F3: fresh checkout after terminal (EXPIRED) succeeds
  const o8 = await createManualOrder(store, { restaurantId: R1, planCode: 'WEBSITE_SINGLE' });
  ok(!o8.reused && o8.payment.id !== o7.payment.id && o8.payment.status === 'PENDING_UTR', 'F3 fresh checkout after terminal works');

  // F3b: fresh checkout after REJECTED succeeds
  await submitUtr(store, { restaurantId: R1, orderId: o8.payment.id, utr: 'UTR000000999' });
  await rejectPayment(store, { paymentId: o8.payment.id, reviewedBy: 'admin', reviewNote: 'UTR not in statement' });
  const o9 = await createManualOrder(store, { restaurantId: R1, planCode: 'WEBSITE_SINGLE' });
  ok(!o9.reused && o9.payment.status === 'PENDING_UTR', 'F3b fresh checkout after REJECTED works');

  // 9a: period end without approved payment -> PAST_DUE
  const R3 = 'rest-3';
  const o10 = await createManualOrder(store, { restaurantId: R3, planCode: 'WEBSITE_SINGLE' });
  await submitUtr(store, { restaurantId: R3, orderId: o10.payment.id, utr: 'UTR000001000' });
  await approvePayment(store, { paymentId: o10.payment.id, reviewedBy: 'admin', bankCreditConfirmed: true });
  await enforceRenewal(store, new Date(Date.now() + 40 * 24 * 3600 * 1000));
  const subR3 = await store.getSubscription(R3);
  ok(subR3?.status === 'PAST_DUE', '9a lapsed period -> PAST_DUE');

  // 9b: approved renewal while still ACTIVE extends period exactly once
  // (fresh restaurant, created after the 9a future-sweep so it stays ACTIVE)
  const R4 = 'rest-4';
  const o12 = await createManualOrder(store, { restaurantId: R4, planCode: 'WEBSITE_SINGLE' });
  await submitUtr(store, { restaurantId: R4, orderId: o12.payment.id, utr: 'UTR000001122' });
  await approvePayment(store, { paymentId: o12.payment.id, reviewedBy: 'admin', bankCreditConfirmed: true });
  const before = (await store.getSubscription(R4))!.currentPeriodEnd.getTime();
  const o11 = await createManualOrder(store, { restaurantId: R4, planCode: 'WEBSITE_SINGLE' });
  await submitUtr(store, { restaurantId: R4, orderId: o11.payment.id, utr: 'UTR000001111' });
  await approvePayment(store, { paymentId: o11.payment.id, reviewedBy: 'admin', bankCreditConfirmed: true });
  const after = (await store.getSubscription(R4))!.currentPeriodEnd.getTime();
  const expected = addCalendarMonth(new Date(before)).getTime();
  ok(Math.abs(after - expected) < 2000, '9b renewal extends exactly one month', `before=${before} after=${after} expected=${expected}`);
  // 9c: lapsed (PAST_DUE) renewal reactivates with a FRESH period, no extension
  ok((await store.getSubscription(R1))!.status === 'PAST_DUE', '9c precondition: R1 lapsed');
  const o13 = await createManualOrder(store, { restaurantId: R1, planCode: 'WEBSITE_SINGLE' });
  await submitUtr(store, { restaurantId: R1, orderId: o13.payment.id, utr: 'UTR000001333' });
  await approvePayment(store, { paymentId: o13.payment.id, reviewedBy: 'admin', bankCreditConfirmed: true });
  const subR1 = await store.getSubscription(R1);
  ok(subR1!.status === 'ACTIVE' && Math.abs(subR1!.currentPeriodEnd.getTime() - o13.payment.periodEnd.getTime()) < 2000, '9c lapsed renewal reactivates fresh 1-month period');

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
