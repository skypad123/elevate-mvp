import type { Locale } from '@elevate/core'

export type ConnectedAccountStatus = {
  accountId: string
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  /** A company account's registered name, when Stripe provides it; null for individuals. */
  legalName: string | null
}

export type BusinessType = 'individual' | 'company'

export type ConnectedAccountInput = {
  businessType: BusinessType
  /** Both IDs are stored in the Stripe account's metadata. */
  profileId: string
  payoutAccountId: string
  email: string
  /** Sent as the account's public business name. */
  displayName: string
}

export type CheckoutSessionInput = {
  /** Our enrollment id; part of the idempotency key. */
  enrollmentId: string
  /** The account being paid, and the profile it belongs to at the time of sale. */
  payoutAccountId: string
  profileId: string
  courseTitle: string
  courseImageUrl: string | null
  amountCents: number
  currency: string
  applicationFeeCents: number
  destinationAccountId: string
  customerEmail: string
  successUrl: string
  cancelUrl: string
  /** The language on the learner's screen; Stripe Checkout shows it. Part of the idempotency key. */
  locale?: Locale
  /**
   * The session this one replaces, if any. Part of the idempotency key, so a key is never sent
   * again once its session has been replaced (Stripe would answer with the closed session, or
   * refuse the request).
   */
  replacesSessionId?: string
  /** Written to the session and its payment intent as given; the caller builds it. */
  metadata: Record<string, string>
}

/**
 * Guards one start of checkout against a double submit. A later retry of the same attempt reuses
 * the open session through the payments service, not through this key. A different payee is a
 * different session, so a learner is never sent to pay an account that is no longer the course's;
 * a different language is one too, so a retry after a switch opens a session in the new language.
 */
export function checkoutIdempotencyKey(input: {
  enrollmentId: string
  amountCents: number
  payoutAccountId: string
  locale?: Locale
  replacesSessionId?: string
}): string {
  return `checkout:${input.enrollmentId}:${input.amountCents}:${input.payoutAccountId}:${input.locale ?? 'none'}:${input.replacesSessionId ?? 'none'}`
}

export type CheckoutSessionResult = {
  id: string
  url: string | null
  status: 'open' | 'complete' | 'expired'
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required'
  paymentIntentId: string | null
  amountTotal: number | null
  customerEmail: string | null
  metadata: Record<string, string>
}

export type PaymentDetails = {
  paymentIntentId: string
  chargeId: string | null
  balanceTransactionId: string | null
  /** Stripe's actual processing fee, from the balance transaction. */
  stripeFeeCents: number | null
  transferId: string | null
  applicationFeeId: string | null
  receiptUrl: string | null
  amountCents: number
}

export type RefundResult = { refundId: string; amountCents: number; status: string }

/** One refund of a charge, as Stripe has it now. */
export type ChargeRefund = {
  refundId: string
  amountCents: number
  /** Stripe's refund status: `pending`, `requires_action`, `succeeded`, `failed` or `canceled`. */
  status: string
  /** What `createRefund` wrote: `paymentId`, `actorId` or `enrollmentId`, and `elevateReason`. */
  metadata: Record<string, string>
}

export type PaymentsWebhookEvent = {
  id: string
  type: string
  /** Connected account id for Connect-scoped events. */
  account?: string
  data: { object: Record<string, unknown> }
}

export interface PaymentsProvider {
  readonly driver: 'stripe' | 'fake' | 'unconfigured'
  createConnectedAccount(input: ConnectedAccountInput): Promise<{ accountId: string }>
  createOnboardingLink(input: {
    accountId: string
    refreshUrl: string
    returnUrl: string
  }): Promise<{ url: string }>
  createLoginLink(accountId: string): Promise<{ url: string }>
  retrieveAccount(accountId: string): Promise<ConnectedAccountStatus>
  /** The connected account's page in the platform's Stripe dashboard, for Support. */
  accountDashboardUrl(accountId: string): string
  createCheckoutSession(input: CheckoutSessionInput): Promise<{ id: string; url: string }>
  retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionResult>
  /**
   * Closes an open session so it can no longer be paid, and returns the session as it then is. A
   * session that is not open (paid first, or already expired) is left as it is.
   */
  expireCheckoutSession(sessionId: string): Promise<CheckoutSessionResult>
  retrievePaymentDetails(paymentIntentId: string): Promise<PaymentDetails>
  createRefund(input: {
    paymentIntentId: string
    reason?: string
    metadata?: Record<string, string>
    /** A retry with the same key returns the first refund instead of making another. */
    idempotencyKey?: string
  }): Promise<RefundResult>
  /** Every refund of a charge, whoever made it (Elevate or the Stripe dashboard). */
  listRefunds(chargeId: string): Promise<ChargeRefund[]>
  listTransferAmountCents(destinationAccountId: string): Promise<number>
  /** Verifies the signature with one of the configured secrets and parses the event. */
  constructEvent(rawBody: string, signature: string | undefined): PaymentsWebhookEvent
}

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super('Stripe is not configured. Set STRIPE_SECRET_KEY (see docs/runbooks/stripe.md).')
    this.name = 'PaymentsNotConfiguredError'
  }
}

/** Used when STRIPE_SECRET_KEY is absent so the rest of the app still runs. */
export class UnconfiguredPaymentsProvider implements PaymentsProvider {
  readonly driver = 'unconfigured'
  private fail(): never {
    throw new PaymentsNotConfiguredError()
  }
  async createConnectedAccount(): Promise<never> {
    return this.fail()
  }
  async createOnboardingLink(): Promise<never> {
    return this.fail()
  }
  async createLoginLink(): Promise<never> {
    return this.fail()
  }
  async retrieveAccount(): Promise<never> {
    return this.fail()
  }
  accountDashboardUrl(): never {
    return this.fail()
  }
  async createCheckoutSession(): Promise<never> {
    return this.fail()
  }
  async retrieveCheckoutSession(): Promise<never> {
    return this.fail()
  }
  async expireCheckoutSession(): Promise<never> {
    return this.fail()
  }
  async retrievePaymentDetails(): Promise<never> {
    return this.fail()
  }
  async createRefund(): Promise<never> {
    return this.fail()
  }
  async listRefunds(): Promise<never> {
    return this.fail()
  }
  async listTransferAmountCents(): Promise<never> {
    return this.fail()
  }
  constructEvent(): never {
    return this.fail()
  }
}
