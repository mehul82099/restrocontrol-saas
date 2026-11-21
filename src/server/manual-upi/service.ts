import { addCalendarMonth, activateSubscription } from './entitlement';
import { UTR_TTL_MS, vpaConfig } from './config';
import { findSubscriptionPlan, planBreakup } from '@/lib/subscription-plans';
import { ApiError, SUBMITTABLE_STATUSES, REVIEWABLE_STATUSES, TERMINAL_STATUSES, type ManualUpiPayment, type ManualUpiStatus } from './types';
import type { ManualUpiStore } from './store';

// Service layer (pure domain logic; framework-free). Routes are thin adapters
// that parse the request, call these, and render JSON. Every function accepts
// an injectable `now` so time-travel scenarios are testable.

const UTR_PATTERN = /^[A-Za-z0-9]{12}$/;

export function normalizeUtr(raw: unknown): string {
  if (typeof raw !== 'string') throw new ApiError(400, 'UTR must be a 12-character string.');
  const utr = raw.trim().toUpperCase();
  if (!UTR_PATTERN.test(utr)) throw new ApiError(400, 'UTR must be exactly 12 alphanumeric characters.');
  return utr;
}

function verifiedPlan(code: unknown) {
  const plan = findSubscriptionPlan(code);
  if (!plan || plan.upcoming) throw new ApiError(400, 'Unknown or unavailable plan.');
  return plan;
}

function isExpired(payment: ManualUpiPayment, now: Date): boolean {
  return payment.status === 'PENDING_UTR' && now.getTime() - payment.createdAt.getTime() > UTR_TTL_MS;
}

/** Enforce the 30-minute PENDING_UTR TTL server-side (lazy transition). */
export async function expireIfNeeded(store: ManualUpiStore, payment: ManualUpiPayment, now: Date): Promise<ManualUpiPayment> {
  if (!isExpired(payment, now)) return payment;
  const updated = await store.transitionPayment(payment.id, ['PENDING_UTR'], 'EXPIRED', { reviewedAt: now });
  return updated ?? { ...payment, status: 'EXPIRED' };
}

/** Sweep overdue PENDING_UTR payments to EXPIRED (called from the admin queue load). */
export async function sweepExpiredPayments(store: ManualUpiStore, now: Date = new Date()): Promise<number> {
  const pending = await store.listPayments({ statuses: ['PENDING_UTR'] });
  let n = 0;
  for (const p of pending) {
    if (isExpired(p, now)) {
      const r = await store.transitionPayment(p.id, ['PENDING_UTR'], 'EXPIRED', { reviewedAt: now });
      if (r) n += 1;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Checkout / create
// ---------------------------------------------------------------------------

export interface CreateOrderInput {
  restaurantId: string;
  planCode: unknown;
  now?: Date;
}

export interface CreateOrderResult {
  payment: ManualUpiPayment;
  reused: boolean;
}

/**
 * Create a pending payment for a fresh 1-month period starting now.
 * Idempotent per customer intent: if an OPEN order already exists for this
 * restaurant+plan, it is returned (reused) instead of duplicated. Terminal
 * orders (REJECTED/EXPIRED) never block a fresh checkout - the unique
 * (restaurantId, planCode, periodStart) key only guards same-millisecond
 * races, resolved by the retry below.
 */
export async function createManualOrder(store: ManualUpiStore, input: CreateOrderInput): Promise<CreateOrderResult> {
  const now = input.now ?? new Date();
  const plan = verifiedPlan(input.planCode);
  const amountPaise = planBreakup(plan).totalPaise;
  const { vpa } = vpaConfig();

  const open = await store.findOpenOrder(input.restaurantId, plan.code);
  if (open) return { payment: open, reused: true };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const periodStart = new Date(now.getTime() + attempt);
    const periodEnd = addCalendarMonth(periodStart);
    try {
      const payment = await store.createPayment({
        restaurantId: input.restaurantId,
        planCode: plan.code,
        amountPaise,
        vpaSnapshot: vpa,
        status: 'PENDING_UTR',
        periodStart,
        periodEnd,
        createdAt: periodStart,
      });
      return { payment, reused: false };
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Unique-key race: another request created an order for the same key.
        // If it is open, reuse it; otherwise shift a millisecond and retry once.
        const existing = await store.findOpenOrder(input.restaurantId, plan.code);
        if (existing) return { payment: existing, reused: true };
        continue;
      }
      throw e;
    }
  }
  throw new ApiError(409, 'Could not create an order; please retry.');
}

// ---------------------------------------------------------------------------
// Submit UTR
// ---------------------------------------------------------------------------

export interface SubmitUtrInput {
  restaurantId: string;
  orderId: string;
  utr: unknown;
  now?: Date;
}

export async function submitUtr(store: ManualUpiStore, input: SubmitUtrInput): Promise<ManualUpiPayment> {
  const now = input.now ?? new Date();
  const utr = normalizeUtr(input.utr);
  const payment = await store.findPayment(input.orderId);
  if (!payment) throw new ApiError(404, 'Order not found.');
  if (payment.restaurantId !== input.restaurantId) throw new ApiError(403, 'Cannot submit a UTR for another restaurant.');

  const checked = await expireIfNeeded(store, payment, now);
  if (checked.status === 'EXPIRED') throw new ApiError(410, 'Order expired; a fresh order is required.');
  if (checked.status !== 'PENDING_UTR') throw new ApiError(409, 'Order is not awaiting a UTR.');

  // Fast-path advisory check; the atomic guarantee is the unique index,
  // enforced inside transitionPayment (concurrent duplicates get a clean 409).
  const holder = await store.findPaymentByUtr(utr);
  if (holder && holder.id !== payment.id) throw new ApiError(409, 'This UTR is already registered to another payment.');

  const updated = await store.transitionPayment(payment.id, SUBMITTABLE_STATUSES, 'UTR_SUBMITTED', {
    utr,
    utrSubmittedAt: now,
  });
  if (!updated) throw new ApiError(409, 'Order changed concurrently; refresh and retry.');
  return updated;
}

// ---------------------------------------------------------------------------
// Admin review (approve / reject)
// ---------------------------------------------------------------------------

export interface ReviewResult {
  payment: ManualUpiPayment;
  decision: ManualUpiStatus;
  already: boolean;
  activated: boolean;
}

async function lockedDecision(store: ManualUpiStore, id: string): Promise<ManualUpiPayment> {
  const p = await store.findPayment(id);
  if (!p) throw new ApiError(404, 'Payment not found.');
  return p;
}

export interface ApproveInput {
  paymentId: string;
  reviewedBy: string;
  bankCreditConfirmed: boolean;
  now?: Date;
}

export async function approvePayment(store: ManualUpiStore, input: ApproveInput): Promise<ReviewResult> {
  const now = input.now ?? new Date();
  if (input.bankCreditConfirmed !== true) {
    throw new ApiError(400, 'Approval requires bank-credit-confirmed=true. Verify via bank statement before approving - never on a screenshot or customer claim.');
  }
  const payment = await lockedDecision(store, input.paymentId);
  if (payment.status === 'EXPIRED') throw new ApiError(410, 'Order expired; cannot approve.');
  if (TERMINAL_STATUSES.has(payment.status)) {
    // Idempotent no-op. If this payment is APPROVED but its entitlement was
    // never applied (an earlier activation failed after the status flip),
    // exactly one caller claims and applies it here - self-healing without
    // ever double-extending the period.
    if (payment.status === 'APPROVED' && (await store.claimEntitlement(payment.id, now))) {
      await activateSubscription(store, payment, now);
    }
    return { payment, decision: payment.status, already: true, activated: payment.status === 'APPROVED' };
  }
  const updated = await store.transitionPayment(input.paymentId, REVIEWABLE_STATUSES, 'APPROVED', {
    reviewedAt: now,
    reviewedBy: input.reviewedBy,
    reviewNote: null,
  });
  if (!updated) {
    // A concurrent decision won. Resolve to the existing decision.
    const winner = await lockedDecision(store, input.paymentId);
    if (winner.status === 'APPROVED' && (await store.claimEntitlement(winner.id, now))) {
      await activateSubscription(store, winner, now);
    }
    return { payment: winner, decision: winner.status, already: true, activated: winner.status === 'APPROVED' };
  }
  // Entitlement is granted only here, after the bank-credit-confirmed
  // approval, and applied exactly once via the atomic claim.
  if (await store.claimEntitlement(updated.id, now)) {
    await activateSubscription(store, updated, now);
  }
  return { payment: updated, decision: 'APPROVED', already: false, activated: true };
}

export interface RejectInput {
  paymentId: string;
  reviewedBy: string;
  reviewNote: string;
  now?: Date;
}

export async function rejectPayment(store: ManualUpiStore, input: RejectInput): Promise<ReviewResult> {
  const now = input.now ?? new Date();
  if (!input.reviewNote || !input.reviewNote.trim()) throw new ApiError(400, 'A review note is mandatory when rejecting.');
  const payment = await lockedDecision(store, input.paymentId);
  if (payment.status === 'EXPIRED') throw new ApiError(410, 'Order expired; cannot reject.');
  if (TERMINAL_STATUSES.has(payment.status)) {
    return { payment, decision: payment.status, already: true, activated: payment.status === 'APPROVED' };
  }
  const updated = await store.transitionPayment(input.paymentId, REVIEWABLE_STATUSES, 'REJECTED', {
    reviewedAt: now,
    reviewedBy: input.reviewedBy,
    reviewNote: input.reviewNote.trim(),
  });
  if (!updated) {
    const winner = await lockedDecision(store, input.paymentId);
    return { payment: winner, decision: winner.status, already: true, activated: winner.status === 'APPROVED' };
  }
  return { payment: updated, decision: 'REJECTED', already: false, activated: false };
}
