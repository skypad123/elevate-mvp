export type ConnectedAccountStatus = {
  accountId: string
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

export type CheckoutSessionInput = {
  /** Our enrollment id; also used as the idempotency key. */
  enrollmentId: string
  courseTitle: string
  courseImageUrl: string | null
  amountCents: number
  currency: string
  applicationFeeCents: number
  destinationAccountId: string
  customerEmail: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
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

export type PaymentsWebhookEvent = {
  id: string
  type: string
  /** Connected account id for Connect-scoped events. */
  account?: string
  data: { object: Record<string, unknown> }
}

export interface PaymentsProvider {
  readonly driver: 'stripe' | 'fake' | 'unconfigured'
  createConnectedAccount(input: {
    email: string
    userId: string
    displayName: string
  }): Promise<{ accountId: string }>
  createOnboardingLink(input: {
    accountId: string
    refreshUrl: string
    returnUrl: string
  }): Promise<{ url: string }>
  createLoginLink(accountId: string): Promise<{ url: string }>
  retrieveAccount(accountId: string): Promise<ConnectedAccountStatus>
  createCheckoutSession(input: CheckoutSessionInput): Promise<{ id: string; url: string }>
  retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionResult>
  retrievePaymentDetails(paymentIntentId: string): Promise<PaymentDetails>
  createRefund(input: {
    paymentIntentId: string
    reason?: string
    metadata?: Record<string, string>
  }): Promise<RefundResult>
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
  async createCheckoutSession(): Promise<never> {
    return this.fail()
  }
  async retrieveCheckoutSession(): Promise<never> {
    return this.fail()
  }
  async retrievePaymentDetails(): Promise<never> {
    return this.fail()
  }
  async createRefund(): Promise<never> {
    return this.fail()
  }
  async listTransferAmountCents(): Promise<never> {
    return this.fail()
  }
  constructEvent(): never {
    return this.fail()
  }
}
