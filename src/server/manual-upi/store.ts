import { prisma } from '@/server/db/prisma';
import { ApiError, OPEN_STATUSES, type ManualUpiPayment, type ManualUpiStatus, type SubscriptionRow } from './types';

// Store abstraction. The production adapter talks to Postgres through the app's
// shared Prisma client; the in-memory adapter exists for local unit tests only
// (MANUAL_UPI_STORE=memory is refused in production). All concurrency-sensitive
// writes go through transitionPayment(), a DB-level conditional update
// (updateMany ... WHERE id AND status IN (...) -> count check), so concurrent
// decisions resolve with exactly one winner.

export type PaymentPatch = Partial<
  Pick<ManualUpiPayment, 'utr' | 'utrSubmittedAt' | 'reviewedAt' | 'reviewedBy' | 'reviewNote'>
>;

export interface CreatePaymentInput {
  restaurantId: string;
  planCode: string;
  amountPaise: number;
  vpaSnapshot: string;
  status: ManualUpiStatus;
  periodStart: Date;
  periodEnd: Date;
  /** Defaults to now; injectable so expiry behavior is testable. */
  createdAt?: Date;
}

export interface ListPaymentsOpts {
  statuses?: readonly ManualUpiStatus[];
  restaurantId?: string;
  limit?: number;
}

export interface ManualUpiStore {
  createPayment(input: CreatePaymentInput): Promise<ManualUpiPayment>;
  findPayment(id: string): Promise<ManualUpiPayment | null>;
  findPaymentByUtr(utr: string): Promise<ManualUpiPayment | null>;
  /** Newest open (non-terminal) order for this restaurant+plan, if any. */
  findOpenOrder(restaurantId: string, planCode: string): Promise<ManualUpiPayment | null>;
  listPayments(opts?: ListPaymentsOpts): Promise<ManualUpiPayment[]>;
  /** Atomic CAS. Returns the updated row, or null when no row matched the
   *  expected `from` statuses (a concurrent transition won). Throws ApiError
   *  409 when the patch collides with the unique UTR constraint. */
  transitionPayment(id: string, from: readonly ManualUpiStatus[], to: ManualUpiStatus, patch?: PaymentPatch): Promise<ManualUpiPayment | null>;
  getSubscription(restaurantId: string): Promise<SubscriptionRow | null>;
  setSubscription(row: SubscriptionRow): Promise<void>;
  /** Flip ACTIVE subscriptions whose period has lapsed to PAST_DUE. Returns count. */
  markSubscriptionsPastDueBefore(now: Date): Promise<number>;
  /** Atomically claim the right to apply this payment's entitlement: true for
   *  exactly one caller per payment (status APPROVED, marker unset). */
  claimEntitlement(paymentId: string, now: Date): Promise<boolean>;
}

function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: string }).code === 'P2002';
}

// ---------------------------------------------------------------------------
// Production adapter on the app's real Prisma schema.
// ---------------------------------------------------------------------------

function rowToPayment(row: {
  id: string; restaurantId: string; planCode: string; amountPaise: number; status: string;
  utr: string | null; vpaSnapshot: string; periodStart: Date; periodEnd: Date; createdAt: Date;
  utrSubmittedAt: Date | null; reviewedAt: Date | null; reviewedBy: string | null; reviewNote: string | null;
  entitlementAppliedAt: Date | null;
}): ManualUpiPayment {
  return { ...row, status: row.status as ManualUpiStatus };
}

export class PrismaStore implements ManualUpiStore {
  async createPayment(input: CreatePaymentInput): Promise<ManualUpiPayment> {
    try {
      const row = await prisma.manualUpiPayment.create({
        data: {
          restaurantId: input.restaurantId,
          planCode: input.planCode,
          amountPaise: input.amountPaise,
          status: input.status,
          vpaSnapshot: input.vpaSnapshot,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        },
      });
      return rowToPayment(row);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ApiError(409, 'An order already exists for this restaurant, plan and period.');
      throw e;
    }
  }

  async findPayment(id: string): Promise<ManualUpiPayment | null> {
    const row = await prisma.manualUpiPayment.findUnique({ where: { id } });
    return row ? rowToPayment(row) : null;
  }

  async findPaymentByUtr(utr: string): Promise<ManualUpiPayment | null> {
    const row = await prisma.manualUpiPayment.findFirst({ where: { utr } });
    return row ? rowToPayment(row) : null;
  }

  async findOpenOrder(restaurantId: string, planCode: string): Promise<ManualUpiPayment | null> {
    const row = await prisma.manualUpiPayment.findFirst({
      where: { restaurantId, planCode, status: { in: [...OPEN_STATUSES] } },
      orderBy: { createdAt: 'desc' },
    });
    return row ? rowToPayment(row) : null;
  }

  async listPayments(opts: ListPaymentsOpts = {}): Promise<ManualUpiPayment[]> {
    const rows = await prisma.manualUpiPayment.findMany({
      where: {
        ...(opts.statuses ? { status: { in: [...opts.statuses] as ManualUpiStatus[] } } : {}),
        ...(opts.restaurantId ? { restaurantId: opts.restaurantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 200,
    });
    return rows.map(rowToPayment);
  }

  async transitionPayment(id: string, from: readonly ManualUpiStatus[], to: ManualUpiStatus, patch: PaymentPatch = {}): Promise<ManualUpiPayment | null> {
    const data: Record<string, unknown> = { status: to };
    if (patch.utr !== undefined) data.utr = patch.utr;
    if (patch.utrSubmittedAt !== undefined) data.utrSubmittedAt = patch.utrSubmittedAt;
    if (patch.reviewedAt !== undefined) data.reviewedAt = patch.reviewedAt;
    if (patch.reviewedBy !== undefined) data.reviewedBy = patch.reviewedBy;
    if (patch.reviewNote !== undefined) data.reviewNote = patch.reviewNote;
    try {
      const res = await prisma.manualUpiPayment.updateMany({ where: { id, status: { in: [...from] } }, data });
      if (res.count !== 1) return null;
    } catch (e) {
      // Concurrent duplicate UTR: the unique index rejected the write.
      if (isUniqueViolation(e)) throw new ApiError(409, 'This UTR is already registered to another payment.');
      throw e;
    }
    return this.findPayment(id);
  }

  async getSubscription(restaurantId: string): Promise<SubscriptionRow | null> {
    const row = await prisma.subscription.findUnique({ where: { restaurantId }, include: { plan: true } });
    if (!row) return null;
    return {
      restaurantId: row.restaurantId,
      planCode: row.plan.code,
      status: row.status,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
    };
  }

  async setSubscription(row: SubscriptionRow): Promise<void> {
    const plan = await prisma.plan.findUnique({ where: { code: row.planCode } });
    if (!plan) throw new Error('Plan row missing.');
    await prisma.subscription.upsert({
      where: { restaurantId: row.restaurantId },
      update: { planId: plan.id, status: row.status, currentPeriodStart: row.currentPeriodStart, currentPeriodEnd: row.currentPeriodEnd },
      create: { restaurantId: row.restaurantId, planId: plan.id, status: row.status, currentPeriodStart: row.currentPeriodStart, currentPeriodEnd: row.currentPeriodEnd },
    });
  }

  async markSubscriptionsPastDueBefore(now: Date): Promise<number> {
    const res = await prisma.subscription.updateMany({ where: { status: 'ACTIVE', currentPeriodEnd: { lt: now } }, data: { status: 'PAST_DUE' } });
    return res.count;
  }

  async claimEntitlement(paymentId: string, now: Date): Promise<boolean> {
    const res = await prisma.manualUpiPayment.updateMany({
      where: { id: paymentId, status: 'APPROVED', entitlementAppliedAt: null },
      data: { entitlementAppliedAt: now },
    });
    return res.count === 1;
  }
}

// ---------------------------------------------------------------------------
// In-memory adapter (local tests only, never production). Faithful semantics:
// mutations are serialized through a promise-chain lock so concurrent
// decisions still resolve to exactly one winner, mirroring the DB conditional
// update, and the UTR map enforces the same uniqueness the DB index gives.
// ---------------------------------------------------------------------------

class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn, fn);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export class InMemoryStore implements ManualUpiStore {
  private payments = new Map<string, ManualUpiPayment>();
  private subscriptions = new Map<string, SubscriptionRow>();
  private lock = new Mutex();

  async createPayment(input: CreatePaymentInput): Promise<ManualUpiPayment> {
    return this.lock.run(async () => {
      for (const p of this.payments.values()) {
        if (p.restaurantId === input.restaurantId && p.planCode === input.planCode && p.periodStart.getTime() === input.periodStart.getTime()) {
          throw new ApiError(409, 'An order already exists for this restaurant, plan and period.');
        }
      }
      const payment: ManualUpiPayment = {
        id: nextId('muupi'),
        restaurantId: input.restaurantId,
        planCode: input.planCode,
        amountPaise: input.amountPaise,
        status: input.status,
        utr: null,
        vpaSnapshot: input.vpaSnapshot,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        createdAt: input.createdAt ?? new Date(),
        utrSubmittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
        entitlementAppliedAt: null,
      };
      this.payments.set(payment.id, payment);
      return { ...payment };
    });
  }

  async findPayment(id: string): Promise<ManualUpiPayment | null> {
    const p = this.payments.get(id);
    return p ? { ...p } : null;
  }

  async findPaymentByUtr(utr: string): Promise<ManualUpiPayment | null> {
    for (const p of this.payments.values()) if (p.utr === utr) return { ...p };
    return null;
  }

  async findOpenOrder(restaurantId: string, planCode: string): Promise<ManualUpiPayment | null> {
    const open = [...this.payments.values()]
      .filter(p => p.restaurantId === restaurantId && p.planCode === planCode && (OPEN_STATUSES as readonly string[]).includes(p.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return open[0] ? { ...open[0] } : null;
  }

  async listPayments(opts: ListPaymentsOpts = {}): Promise<ManualUpiPayment[]> {
    const list = [...this.payments.values()]
      .filter(p => (opts.statuses ? opts.statuses.includes(p.status) : true))
      .filter(p => (opts.restaurantId ? p.restaurantId === opts.restaurantId : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return (opts.limit ? list.slice(0, opts.limit) : list).map(p => ({ ...p }));
  }

  async transitionPayment(id: string, from: readonly ManualUpiStatus[], to: ManualUpiStatus, patch: PaymentPatch = {}): Promise<ManualUpiPayment | null> {
    return this.lock.run(async () => {
      const p = this.payments.get(id);
      if (!p || !from.includes(p.status)) return null;
      if (patch.utr) {
        // Same atomic uniqueness the DB unique index enforces (fixes the
        // check-then-act race the verifier found in the draft).
        for (const other of this.payments.values()) {
          if (other.id !== id && other.utr === patch.utr) throw new ApiError(409, 'This UTR is already registered to another payment.');
        }
      }
      const next: ManualUpiPayment = { ...p, ...patch, status: to };
      this.payments.set(id, next);
      return { ...next };
    });
  }

  async getSubscription(restaurantId: string): Promise<SubscriptionRow | null> {
    const s = this.subscriptions.get(restaurantId);
    return s ? { ...s, currentPeriodStart: new Date(s.currentPeriodStart), currentPeriodEnd: new Date(s.currentPeriodEnd) } : null;
  }

  async setSubscription(row: SubscriptionRow): Promise<void> {
    return this.lock.run(async () => {
      this.subscriptions.set(row.restaurantId, { ...row, currentPeriodStart: new Date(row.currentPeriodStart), currentPeriodEnd: new Date(row.currentPeriodEnd) });
    });
  }

  async markSubscriptionsPastDueBefore(now: Date): Promise<number> {
    return this.lock.run(async () => {
      let flipped = 0;
      for (const [id, s] of this.subscriptions) {
        if (s.status === 'ACTIVE' && s.currentPeriodEnd.getTime() < now.getTime()) {
          this.subscriptions.set(id, { ...s, status: 'PAST_DUE' });
          flipped += 1;
        }
      }
      return flipped;
    });
  }

  async claimEntitlement(paymentId: string, now: Date): Promise<boolean> {
    return this.lock.run(async () => {
      const p = this.payments.get(paymentId);
      if (!p || p.status !== 'APPROVED' || p.entitlementAppliedAt !== null) return false;
      this.payments.set(paymentId, { ...p, entitlementAppliedAt: now });
      return true;
    });
  }
}

// ---------------------------------------------------------------------------
// Store factory. The memory adapter is a test tool and is refused in production.
// ---------------------------------------------------------------------------

let memoryStoreSingleton: InMemoryStore | null = null;
let prismaStoreSingleton: PrismaStore | null = null;

export function getStore(): ManualUpiStore {
  if (process.env.MANUAL_UPI_STORE === 'memory') {
    if (process.env.NODE_ENV === 'production') throw new Error('MANUAL_UPI_STORE=memory is not allowed in production.');
    if (!memoryStoreSingleton) memoryStoreSingleton = new InMemoryStore();
    return memoryStoreSingleton;
  }
  if (!prismaStoreSingleton) prismaStoreSingleton = new PrismaStore();
  return prismaStoreSingleton;
}
