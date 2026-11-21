export const MANUAL_UPI_STATUSES = ['PENDING_UTR', 'UTR_SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
export type ManualUpiStatus = (typeof MANUAL_UPI_STATUSES)[number];

// Terminal states are immutable: once a payment is APPROVED / REJECTED / EXPIRED
// the decision is final. Repeated approve/reject is an idempotent no-op that
// returns the existing decision.
export const TERMINAL_STATUSES: ReadonlySet<ManualUpiStatus> = new Set(['APPROVED', 'REJECTED', 'EXPIRED']);

// A payment can only have its UTR submitted while awaiting it.
export const SUBMITTABLE_STATUSES: readonly ManualUpiStatus[] = ['PENDING_UTR'];
// Admin review acts on payments awaiting review.
export const REVIEWABLE_STATUSES: readonly ManualUpiStatus[] = ['PENDING_UTR', 'UTR_SUBMITTED'];
// Open (non-terminal) orders: a repeat checkout reuses these instead of creating.
export const OPEN_STATUSES: readonly ManualUpiStatus[] = ['PENDING_UTR', 'UTR_SUBMITTED'];

export interface ManualUpiPayment {
  id: string;
  restaurantId: string;
  planCode: string;
  amountPaise: number; // integer minor units, GST-inclusive (per existing planBreakup)
  status: ManualUpiStatus;
  utr: string | null;
  vpaSnapshot: string; // VPA shown to the customer at checkout time
  periodStart: Date; // the 1-month period this payment buys
  periodEnd: Date;
  createdAt: Date;
  utrSubmittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  entitlementAppliedAt: Date | null;
}

export interface SubscriptionRow {
  restaurantId: string;
  planCode: string;
  status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
