import type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  ConnectedAccountStatus,
  PaymentDetails,
  PaymentsProvider,
  PaymentsWebhookEvent,
  RefundResult,
} from './types'

type FakeSession = CheckoutSessionInput & {
  id: string
  paid: boolean
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
  readonly accounts = new Map<string, ConnectedAccountStatus>()
  readonly sessions = new Map<string, FakeSession>()
  readonly refunds: Array<{ refundId: string; paymentIntentId: string; amountCents: number }> = []
  /** Actual Stripe fee the fake reports, in basis points + fixed, so tests can check estimate vs actual. */
  feeBps = 340
  feeFixedCents = 50
  private counter = 0

  async createConnectedAccount(_input: {
    email: string
    userId: string
    displayName: string
  }): Promise<{ accountId: string }> {
    const accountId = `acct_fake_${++this.counter}`
    this.accounts.set(accountId, {
      accountId,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
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
  /** Simulates the teacher finishing Connect onboarding; returns the account.updated event. */
  enableAccount(accountId: string): PaymentsWebhookEvent {
    const account = {
      accountId,
      detailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    }
    this.accounts.set(accountId, account)
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
    const existing = [...this.sessions.values()].find(
      (s) => s.enrollmentId === input.enrollmentId && !s.paid,
    )
    if (existing)
      return { id: existing.id, url: `https://checkout.fake-stripe.test/${existing.id}` }
    const id = `cs_fake_${++this.counter}`
    const stripeFeeCents =
      Math.round((input.amountCents * this.feeBps) / 10000) + this.feeFixedCents
    this.sessions.set(id, {
      ...input,
      id,
      paid: false,
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
      url: s.paid ? null : `https://checkout.fake-stripe.test/${s.id}`,
      status: s.paid ? 'complete' : 'open',
      paymentStatus: s.paid ? 'paid' : 'unpaid',
      paymentIntentId: s.paid ? s.paymentIntentId : null,
      amountTotal: s.amountCents,
      customerEmail: s.customerEmail,
      metadata: s.metadata,
    }
  }
  /** Simulates the learner paying. */
  completeCheckout(sessionId: string): PaymentsWebhookEvent {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`no such session ${sessionId}`)
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
  async createRefund(input: { paymentIntentId: string }): Promise<RefundResult> {
    const s = [...this.sessions.values()].find((x) => x.paymentIntentId === input.paymentIntentId)
    if (!s) throw new Error(`no such payment intent ${input.paymentIntentId}`)
    const amountCents = s.amountCents - s.refundedCents
    s.refundedCents = s.amountCents
    const refundId = `re_fake_${++this.counter}`
    this.refunds.push({ refundId, paymentIntentId: input.paymentIntentId, amountCents })
    return { refundId, amountCents, status: 'succeeded' }
  }
  /** The charge.refunded event Stripe would send after createRefund. */
  refundedEvent(paymentIntentId: string): PaymentsWebhookEvent {
    const s = [...this.sessions.values()].find((x) => x.paymentIntentId === paymentIntentId)
    if (!s) throw new Error(`no such payment intent ${paymentIntentId}`)
    return {
      id: `evt_ref_${paymentIntentId}_${++this.counter}`,
      type: 'charge.refunded',
      data: {
        object: {
          id: `ch_${paymentIntentId}`,
          object: 'charge',
          payment_intent: paymentIntentId,
          amount: s.amountCents,
          amount_refunded: s.refundedCents,
          refunded: s.refundedCents >= s.amountCents,
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
