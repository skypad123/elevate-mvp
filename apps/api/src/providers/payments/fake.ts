import {
  type BusinessType,
  type ChargeRefund,
  type CheckoutSessionInput,
  type CheckoutSessionResult,
  type ConnectedAccountInput,
  type ConnectedAccountStatus,
  checkoutIdempotencyKey,
  type PaymentDetails,
  type PaymentsProvider,
  type PaymentsWebhookEvent,
  type RefundResult,
} from './types'

/** What the fake remembers about an account beyond its status, so tests can assert on it. */
type FakeAccount = ConnectedAccountStatus & {
  businessType: BusinessType
  metadata: { elevateProfileId: string; elevatePayoutAccountId: string }
}

type FakeSession = CheckoutSessionInput & {
  id: string
  /** The key real Stripe would deduplicate on. */
  idempotencyKey: string
  paid: boolean
  /** Closed by `expireCheckoutSession` before it was paid; it can no longer be paid. */
  expired: boolean
  paymentIntentId: string
  refundedCents: number
  stripeFeeCents: number
}

/**
 * In-memory Stripe stand-in. Webhook bodies are JSON events with header `stripe-signature: fake-valid`.
 * `completeCheckout(sessionId)` marks a session paid and returns the checkout.session.completed event.
 */
export class FakePaymentsProvider implements PaymentsProvider {
  readonly driver = 'fake'
  readonly accounts = new Map<string, FakeAccount>()
  readonly sessions = new Map<string, FakeSession>()
  readonly refunds: Array<{
    refundId: string
    paymentIntentId: string
    amountCents: number
    status: string
    metadata: Record<string, string>
  }> = []
  private readonly refundsByKey = new Map<string, RefundResult>()
  /** Actual Stripe fee the fake reports, in basis points + fixed, so tests can check estimate vs actual. */
  feeBps = 340
  feeFixedCents = 50
  private counter = 0

  async createConnectedAccount(input: ConnectedAccountInput): Promise<{ accountId: string }> {
    const accountId = `acct_fake_${++this.counter}`
    this.accounts.set(accountId, {
      accountId,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      legalName: null,
      businessType: input.businessType,
      metadata: {
        elevateProfileId: input.profileId,
        elevatePayoutAccountId: input.payoutAccountId,
      },
    })
    return { accountId }
  }
  async createOnboardingLink(input: {
    accountId: string
    returnUrl: string
  }): Promise<{ url: string }> {
    return {
      url: `https://connect.fake-stripe.test/onboard/${input.accountId}?return=${encodeURIComponent(input.returnUrl)}`,
    }
  }
  async createLoginLink(accountId: string): Promise<{ url: string }> {
    return { url: `https://connect.fake-stripe.test/express/${accountId}` }
  }
  async retrieveAccount(accountId: string): Promise<ConnectedAccountStatus> {
    const account = this.accounts.get(accountId)
    if (!account) throw new Error(`no such account ${accountId}`)
    return account
  }
  accountDashboardUrl(accountId: string): string {
    return `https://dashboard.fake-stripe.test/connect/accounts/${accountId}`
  }
  /** The legal name the company gave Stripe during onboarding; real Stripe reports it for companies. */
  setLegalName(accountId: string, legalName: string | null): void {
    const account = this.accounts.get(accountId)
    if (!account) throw new Error(`no such account ${accountId}`)
    this.accounts.set(accountId, { ...account, legalName })
  }
  /** Simulates Stripe withdrawing charges from an account; returns the account.updated event. */
  disableAccount(accountId: string): PaymentsWebhookEvent {
    const account = this.accounts.get(accountId)
    if (!account) throw new Error(`no such account ${accountId}`)
    this.accounts.set(accountId, { ...account, chargesEnabled: false, payoutsEnabled: false })
    return {
      id: `evt_acct_${accountId}_${++this.counter}`,
      type: 'account.updated',
      account: accountId,
      data: {
        object: {
          id: accountId,
          details_submitted: account.detailsSubmitted,
          charges_enabled: false,
          payouts_enabled: false,
        },
      },
    }
  }
  /** Simulates the teacher finishing Connect onboarding; returns the account.updated event. */
  enableAccount(accountId: string): PaymentsWebhookEvent {
    const existing = this.accounts.get(accountId)
    this.accounts.set(accountId, {
      legalName: null,
      businessType: 'individual',
      metadata: { elevateProfileId: '', elevatePayoutAccountId: '' },
      ...existing,
      accountId,
      detailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    })
    return {
      id: `evt_acct_${accountId}_${++this.counter}`,
      type: 'account.updated',
      account: accountId,
      data: {
        object: {
          id: accountId,
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
        },
      },
    }
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<{ id: string; url: string }> {
    const idempotencyKey = checkoutIdempotencyKey(input)
    const existing = [...this.sessions.values()].find(
      (s) => s.idempotencyKey === idempotencyKey && !s.paid && !s.expired,
    )
    if (existing)
      return { id: existing.id, url: `https://checkout.fake-stripe.test/${existing.id}` }
    const id = `cs_fake_${++this.counter}`
    const stripeFeeCents =
      Math.round((input.amountCents * this.feeBps) / 10000) + this.feeFixedCents
    this.sessions.set(id, {
      ...input,
      // Stripe does not store a metadata key whose value is empty.
      metadata: Object.fromEntries(Object.entries(input.metadata).filter(([, v]) => v !== '')),
      id,
      idempotencyKey,
      paid: false,
      expired: false,
      paymentIntentId: `pi_fake_${this.counter}`,
      refundedCents: 0,
      stripeFeeCents,
    })
    return { id, url: `https://checkout.fake-stripe.test/${id}` }
  }
  async retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionResult> {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`no such session ${sessionId}`)
    return {
      id: s.id,
      url: s.paid || s.expired ? null : `https://checkout.fake-stripe.test/${s.id}`,
      status: s.paid ? 'complete' : s.expired ? 'expired' : 'open',
      paymentStatus: s.paid ? 'paid' : 'unpaid',
      paymentIntentId: s.paid ? s.paymentIntentId : null,
      amountTotal: s.amountCents,
      customerEmail: s.customerEmail,
      metadata: s.metadata,
    }
  }
  async expireCheckoutSession(sessionId: string): Promise<CheckoutSessionResult> {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`no such session ${sessionId}`)
    if (!s.paid) s.expired = true
    return this.retrieveCheckoutSession(sessionId)
  }
  /** Simulates the learner paying. Like Stripe, an expired session cannot be paid. */
  completeCheckout(sessionId: string): PaymentsWebhookEvent {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`no such session ${sessionId}`)
    if (s.expired) throw new Error(`session ${sessionId} has expired`)
    s.paid = true
    return {
      id: `evt_cs_${sessionId}_${++this.counter}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: s.id,
          object: 'checkout.session',
          payment_status: 'paid',
          payment_intent: s.paymentIntentId,
          amount_total: s.amountCents,
          client_reference_id: s.enrollmentId,
          customer_details: { email: s.customerEmail },
          metadata: s.metadata,
        },
      },
    }
  }
  async retrievePaymentDetails(paymentIntentId: string): Promise<PaymentDetails> {
    const s = [...this.sessions.values()].find((x) => x.paymentIntentId === paymentIntentId)
    if (!s) throw new Error(`no such payment intent ${paymentIntentId}`)
    return {
      paymentIntentId,
      chargeId: `ch_${paymentIntentId}`,
      balanceTransactionId: `txn_${paymentIntentId}`,
      stripeFeeCents: s.stripeFeeCents,
      transferId: `tr_${paymentIntentId}`,
      applicationFeeId: `fee_${paymentIntentId}`,
      receiptUrl: `https://receipts.fake-stripe.test/${paymentIntentId}`,
      amountCents: s.amountCents,
    }
  }
  /**
   * Refunds what is left of the payment, as Elevate always does. `amountCents`, which the real
   * provider does not take, refunds part of it, as a refund in the Stripe dashboard can.
   */
  async createRefund(input: {
    paymentIntentId: string
    reason?: string
    metadata?: Record<string, string>
    idempotencyKey?: string
    amountCents?: number
  }): Promise<RefundResult> {
    const earlier = input.idempotencyKey ? this.refundsByKey.get(input.idempotencyKey) : undefined
    if (earlier) return earlier
    const s = [...this.sessions.values()].find((x) => x.paymentIntentId === input.paymentIntentId)
    if (!s) throw new Error(`no such payment intent ${input.paymentIntentId}`)
    const left = s.amountCents - s.refundedCents
    const amountCents = Math.min(input.amountCents ?? left, left)
    s.refundedCents += amountCents
    const refundId = `re_fake_${++this.counter}`
    // The metadata Stripe stores, as the real provider writes it.
    const metadata = {
      ...(input.metadata ?? {}),
      ...(input.reason ? { elevateReason: input.reason.slice(0, 500) } : {}),
    }
    this.refunds.push({
      refundId,
      paymentIntentId: input.paymentIntentId,
      amountCents,
      status: 'succeeded',
      metadata,
    })
    const result = { refundId, amountCents, status: 'succeeded' }
    if (input.idempotencyKey) this.refundsByKey.set(input.idempotencyKey, result)
    return result
  }
  async listRefunds(chargeId: string): Promise<ChargeRefund[]> {
    // Newest first, as Stripe lists them.
    return this.refunds
      .filter((r) => `ch_${r.paymentIntentId}` === chargeId)
      .reverse()
      .map(({ refundId, amountCents, status, metadata }) => ({
        refundId,
        amountCents,
        status,
        metadata,
      }))
  }
  /** The charge.refunded event Stripe would send after createRefund, with the charge's refunds. */
  refundedEvent(paymentIntentId: string): PaymentsWebhookEvent {
    const s = [...this.sessions.values()].find((x) => x.paymentIntentId === paymentIntentId)
    if (!s) throw new Error(`no such payment intent ${paymentIntentId}`)
    const chargeId = `ch_${paymentIntentId}`
    const refunds = this.refunds
      .filter((r) => r.paymentIntentId === paymentIntentId)
      .reverse()
      .map((r) => ({
        id: r.refundId,
        object: 'refund',
        amount: r.amountCents,
        charge: chargeId,
        status: r.status,
        metadata: r.metadata,
      }))
    return {
      id: `evt_ref_${paymentIntentId}_${++this.counter}`,
      type: 'charge.refunded',
      data: {
        object: {
          id: chargeId,
          object: 'charge',
          payment_intent: paymentIntentId,
          amount: s.amountCents,
          amount_refunded: s.refundedCents,
          refunded: s.refundedCents >= s.amountCents,
          refunds: { object: 'list', data: refunds },
        },
      },
    }
  }
  async listTransferAmountCents(destinationAccountId: string): Promise<number> {
    return [...this.sessions.values()]
      .filter((s) => s.paid && s.destinationAccountId === destinationAccountId)
      .reduce(
        (sum, s) =>
          sum +
          (s.amountCents - s.applicationFeeCents) -
          (s.refundedCents > 0 ? s.amountCents - s.applicationFeeCents : 0),
        0,
      )
  }
  constructEvent(rawBody: string, signature: string | undefined): PaymentsWebhookEvent {
    if (signature !== 'fake-valid') throw new Error('invalid signature')
    return JSON.parse(rawBody) as PaymentsWebhookEvent
  }
}
