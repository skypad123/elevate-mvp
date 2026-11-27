import Stripe from 'stripe'
import {
  type AccountBalance,
  type ApplicationFeeRefund,
  type BusinessType,
  type ChargeFee,
  type ChargeRefund,
  type CheckoutSessionInput,
  type CheckoutSessionResult,
  type ConnectedAccountInput,
  type ConnectedAccountStatus,
  type CreateRefundInput,
  checkoutIdempotencyKey,
  PAYOUT_LABEL,
  type PaymentDetails,
  type PaymentsProvider,
  type PaymentsWebhookEvent,
  type PayoutResult,
  type RefundResult,
  type RefundStatus,
  type TransferReversal,
  type TransferReversalResult,
} from './types'

/** What the fake remembers about an account beyond its status, so tests can assert on it. */
type FakeAccount = ConnectedAccountStatus & {
  businessType: BusinessType
  metadata: { elevateProfileId: string; elevatePayoutAccountId: string }
}

/** A connected account's money. Kept by account id, so an account the fake never made has one. */
export type FakeAccountMoney = {
  payoutMode: 'automatic' | 'manual'
  /** SGD cents. Either can go below zero, as at Stripe. */
  availableCents: number
  pendingCents: number
  /** Oldest first. */
  payouts: PayoutResult[]
}

export type FakePaymentMethod = 'card' | 'paynow'

type FakeSession = CheckoutSessionInput & {
  id: string
  /** The key real Stripe would deduplicate on. */
  idempotencyKey: string
  paid: boolean
  /** Closed by `expireCheckoutSession` before it was paid; it can no longer be paid. */
  expired: boolean
  paymentIntentId: string
  /** How the learner paid; set by `completeCheckout`. */
  paymentMethod: FakePaymentMethod | null
  /** Stripe's time for the payment, when `completeCheckout` was given one. */
  paidAt: Date | null
  /** Refunded to the learner, less refunds that failed. */
  refundedCents: number
  /** Taken back from the profile's transfer, by refunds and reversals. */
  reversedCents: number
  /** Elevate's fee returned to the profile, with refunds, reversals and fee refunds. */
  feeRefundedCents: number
  /** Stripe's fee on the charge; null while Stripe has not filled it. */
  stripeFeeCents: number | null
  /** The next read of the fee answers empty, as on the pinned API just after a payment. */
  feeLate: boolean
  /** The profile's money from this payment has moved from pending to available. */
  settled: boolean
  disputeStatus: 'open' | 'won' | 'lost' | null
}

type FakeRefund = {
  refundId: string
  paymentIntentId: string
  amountCents: number
  status: RefundStatus
  metadata: Record<string, string>
}

type FakeFeeRefund = ApplicationFeeRefund & { applicationFeeId: string }

type FakeReversal = {
  reversalId: string
  transferId: string
  amountCents: number
  metadata: Record<string, string>
}

/** A provider method that `failNext` can make fail. */
export type FakeFailableMethod = Exclude<
  keyof PaymentsProvider,
  'driver' | 'accountDashboardUrl' | 'constructEvent'
>

/**
 * In-memory Stripe stand-in. Webhook bodies are JSON events with header `stripe-signature: fake-valid`.
 * `completeCheckout(sessionId)` marks a session paid and returns the checkout.session.completed event.
 *
 * Money follows a destination charge: a payment puts the price less Elevate's fee in the
 * profile's pending balance; a refund takes its amount back from the profile (the transfer
 * reversed) and, unless told to keep it, returns Elevate's fee in proportion. Movements on a
 * payment land in the balance its money is in: pending until `settle`, then available. Refusals
 * are Stripe's own error classes, so code that sorts Stripe's errors sorts the fake's too.
 */
export class FakePaymentsProvider implements PaymentsProvider {
  readonly driver = 'fake'
  readonly accounts = new Map<string, FakeAccount>()
  readonly sessions = new Map<string, FakeSession>()
  readonly refunds: FakeRefund[] = []
  readonly feeRefunds: FakeFeeRefund[] = []
  readonly reversals: FakeReversal[] = []
  readonly money = new Map<string, FakeAccountMoney>()
  /** Answers already given, by method and idempotency key. */
  private readonly byKey = new Map<string, unknown>()
  private readonly failures = new Map<
    FakeFailableMethod,
    { kind: 'retryable' | 'final'; code: string }
  >()
  /** Actual Stripe fee the fake reports, in basis points + fixed, so tests can check estimate vs actual. */
  feeBps = 340
  feeFixedCents = 50
  /** When true, a new session's fee is empty on its first read, as on the pinned API. */
  stripeFeeLate = false
  private counter = 0

  /**
   * Makes the next call of `method` fail once: `retryable` as a network failure, `final` as
   * Stripe refusing the request with `code`.
   */
  failNext(method: FakeFailableMethod, kind: 'retryable' | 'final', code = 'fake_refused'): void {
    this.failures.set(method, { kind, code })
  }
  private trip(method: FakeFailableMethod): void {
    const failure = this.failures.get(method)
    if (!failure) return
    this.failures.delete(method)
    if (failure.kind === 'retryable')
      throw new Stripe.errors.StripeConnectionError({
        message: `fake: ${method} could not connect`,
      })
    throw refused(failure.code, `fake: ${method} was refused`)
  }

  async createConnectedAccount(input: ConnectedAccountInput): Promise<{ accountId: string }> {
    this.trip('createConnectedAccount')
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
    this.trip('createOnboardingLink')
    return {
      url: `https://connect.fake-stripe.test/onboard/${input.accountId}?return=${encodeURIComponent(input.returnUrl)}`,
    }
  }
  async createLoginLink(accountId: string): Promise<{ url: string }> {
    this.trip('createLoginLink')
    return { url: `https://connect.fake-stripe.test/express/${accountId}` }
  }
  async retrieveAccount(accountId: string): Promise<ConnectedAccountStatus> {
    this.trip('retrieveAccount')
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
    this.trip('createCheckoutSession')
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
      paymentMethod: null,
      paidAt: null,
      refundedCents: 0,
      reversedCents: 0,
      feeRefundedCents: 0,
      stripeFeeCents,
      feeLate: this.stripeFeeLate,
      settled: false,
      disputeStatus: null,
    })
    return { id, url: `https://checkout.fake-stripe.test/${id}` }
  }
  async retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionResult> {
    this.trip('retrieveCheckoutSession')
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
    this.trip('expireCheckoutSession')
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`no such session ${sessionId}`)
    if (!s.paid) s.expired = true
    return this.retrieveCheckoutSession(sessionId)
  }
  /**
   * Simulates the learner paying, by card unless told otherwise. Like Stripe, an expired session
   * cannot be paid, nor a session by a method it does not allow. The profile's share goes to its
   * pending balance. `paidAt` is Stripe's time for the payment; without it the fake reports none.
   */
  completeCheckout(
    sessionId: string,
    paymentMethod: FakePaymentMethod = 'card',
    paidAt?: Date,
  ): PaymentsWebhookEvent {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`no such session ${sessionId}`)
    if (s.expired) throw new Error(`session ${sessionId} has expired`)
    if (s.allowedPaymentMethods && !s.allowedPaymentMethods.includes(paymentMethod))
      throw new Error(`session ${sessionId} does not allow ${paymentMethod}`)
    if (!s.paid) {
      s.paid = true
      s.paymentMethod = paymentMethod
      s.paidAt = paidAt ?? null
      this.move(s, s.amountCents - s.applicationFeeCents)
    }
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
    this.trip('retrievePaymentDetails')
    const s = this.byPaymentIntent(paymentIntentId)
    const fee = this.readFee(s)
    return {
      paymentIntentId,
      chargeId: `ch_${paymentIntentId}`,
      // On the pinned API these are empty together until Stripe fills the charge.
      balanceTransactionId: fee === null ? null : `txn_${paymentIntentId}`,
      stripeFeeCents: fee,
      transferId: fee === null ? null : `tr_${paymentIntentId}`,
      applicationFeeId: fee === null ? null : `fee_${paymentIntentId}`,
      receiptUrl: `https://receipts.fake-stripe.test/${paymentIntentId}`,
      amountCents: s.amountCents,
      paidAt: s.paidAt,
    }
  }
  async retrieveChargeFee(chargeId: string): Promise<ChargeFee | null> {
    this.trip('retrieveChargeFee')
    const s = this.byCharge(chargeId)
    const fee = this.readFee(s)
    if (fee === null) return null
    return {
      stripeFeeCents: fee,
      balanceTransactionId: `txn_${s.paymentIntentId}`,
      transferId: `tr_${s.paymentIntentId}`,
      applicationFeeId: `fee_${s.paymentIntentId}`,
    }
  }
  /**
   * Sets Stripe's fee on a session's charge. Null empties it until it is set again; a number
   * fills it at once, even when `stripeFeeLate` would have answered the next read empty.
   */
  setStripeFee(sessionId: string, cents: number | null): void {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error(`no such session ${sessionId}`)
    s.stripeFeeCents = cents
    s.feeLate = false
  }

  /**
   * Refunds what is left of the payment, or `amountCents` of it, and takes the same amount back
   * from the profile. A card refund has succeeded at once; a PayNow one is `pending` until
   * `settleRefund`. Stripe refuses a refund while a bank dispute is open or after it is lost.
   */
  async createRefund(input: CreateRefundInput): Promise<RefundResult> {
    this.trip('createRefund')
    const key = input.idempotencyKey ? `refund:${input.idempotencyKey}` : null
    const earlier = key ? (this.byKey.get(key) as RefundResult | undefined) : undefined
    if (earlier) return earlier
    const s = this.byPaymentIntent(input.paymentIntentId)
    if (s.disputeStatus === 'open' || s.disputeStatus === 'lost')
      throw refused(
        'charge_disputed',
        `Charge ch_${s.paymentIntentId} has been charged back; cannot issue a refund.`,
      )
    const left = s.amountCents - s.refundedCents
    if (input.amountCents !== undefined && input.amountCents > left)
      throw refused(
        'amount_too_large',
        `Refund amount (${input.amountCents}) is greater than unrefunded amount on charge (${left})`,
      )
    const amountCents = input.amountCents ?? left
    s.refundedCents += amountCents
    s.reversedCents += amountCents
    this.move(s, -amountCents)
    if (input.refundApplicationFee ?? true) this.returnFeeInProportion(s, amountCents)
    const refundId = `re_fake_${++this.counter}`
    const status: RefundStatus = s.paymentMethod === 'paynow' ? 'pending' : 'succeeded'
    // The metadata Stripe stores, as the real provider writes it.
    const metadata = {
      ...(input.metadata ?? {}),
      ...(input.reason ? { elevateReason: input.reason.slice(0, 500) } : {}),
    }
    this.refunds.push({
      refundId,
      paymentIntentId: input.paymentIntentId,
      amountCents,
      status,
      metadata,
    })
    const result: RefundResult = { refundId, amountCents, status }
    if (key) this.byKey.set(key, result)
    return result
  }
  async retrieveRefund(refundId: string): Promise<RefundStatus> {
    this.trip('retrieveRefund')
    const refund = this.refunds.find((r) => r.refundId === refundId)
    if (!refund) throw new Error(`no such refund ${refundId}`)
    return refund.status
  }
  /**
   * Finishes a pending (PayNow) refund. A failed one no longer counts as refunded; the profile's
   * money stays taken back, as Stripe returns a failed PayNow refund to the platform's balance.
   */
  settleRefund(refundId: string, outcome: 'succeeded' | 'failed'): void {
    const refund = this.refunds.find((r) => r.refundId === refundId)
    if (!refund) throw new Error(`no such refund ${refundId}`)
    if (refund.status !== 'pending') throw new Error(`refund ${refundId} is ${refund.status}`)
    refund.status = outcome
    if (outcome === 'failed')
      this.byPaymentIntent(refund.paymentIntentId).refundedCents -= refund.amountCents
  }
  async listRefunds(chargeId: string): Promise<ChargeRefund[]> {
    this.trip('listRefunds')
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
  /** Like Stripe, refuses more than is left of the fee. */
  async refundApplicationFee(input: {
    applicationFeeId: string
    amountCents: number
    metadata: Record<string, string>
    idempotencyKey: string
  }): Promise<{ feeRefundId: string }> {
    this.trip('refundApplicationFee')
    const key = `fee-refund:${input.idempotencyKey}`
    const earlier = this.byKey.get(key) as { feeRefundId: string } | undefined
    if (earlier) return earlier
    const s = this.byApplicationFee(input.applicationFeeId)
    const left = s.applicationFeeCents - s.feeRefundedCents
    if (input.amountCents > left)
      throw refused(
        'amount_too_large',
        `Refund amount (${input.amountCents}) is greater than unrefunded amount on fee (${left})`,
      )
    const feeRefundId = this.returnFee(s, input.amountCents, input.metadata)
    const result = { feeRefundId }
    this.byKey.set(key, result)
    return result
  }
  async listApplicationFeeRefunds(applicationFeeId: string): Promise<ApplicationFeeRefund[]> {
    this.trip('listApplicationFeeRefunds')
    return this.feeRefunds
      .filter((r) => r.applicationFeeId === applicationFeeId)
      .reverse()
      .map(({ feeRefundId, amountCents, metadata }) => ({ feeRefundId, amountCents, metadata }))
  }
  /** Takes part of the transfer back from the profile, which Stripe allows below zero. */
  async reverseTransfer(input: {
    transferId: string
    amountCents: number
    refundApplicationFee: boolean
    metadata: Record<string, string>
    idempotencyKey: string
  }): Promise<TransferReversalResult> {
    this.trip('reverseTransfer')
    const key = `reversal:${input.idempotencyKey}`
    const earlier = this.byKey.get(key) as TransferReversalResult | undefined
    if (earlier) return earlier
    const s = this.byTransfer(input.transferId)
    const left = s.amountCents - s.reversedCents
    if (input.amountCents > left)
      throw refused(
        'amount_too_large',
        `Reversal amount (${input.amountCents}) is greater than unreversed amount on transfer (${left})`,
      )
    s.reversedCents += input.amountCents
    this.move(s, -input.amountCents)
    if (input.refundApplicationFee) this.returnFeeInProportion(s, input.amountCents)
    const reversalId = `trr_fake_${++this.counter}`
    this.reversals.push({
      reversalId,
      transferId: input.transferId,
      amountCents: input.amountCents,
      metadata: input.metadata,
    })
    const result = { reversalId, applicationFeeRefundedCents: s.feeRefundedCents }
    this.byKey.set(key, result)
    return result
  }
  async listTransferReversals(transferId: string): Promise<TransferReversal[]> {
    this.trip('listTransferReversals')
    return this.reversals
      .filter((r) => r.transferId === transferId)
      .reverse()
      .map(({ reversalId, amountCents, metadata }) => ({ reversalId, amountCents, metadata }))
  }

  async setManualPayouts(accountId: string): Promise<void> {
    this.trip('setManualPayouts')
    this.moneyOf(accountId).payoutMode = 'manual'
  }
  async setAutomaticPayouts(accountId: string): Promise<void> {
    this.trip('setAutomaticPayouts')
    this.moneyOf(accountId).payoutMode = 'automatic'
  }
  async retrieveBalance(accountId: string): Promise<AccountBalance> {
    this.trip('retrieveBalance')
    const { availableCents, pendingCents } = this.moneyOf(accountId)
    return { availableCents, pendingCents }
  }
  /** Test driver: the account's pending money becomes available. */
  settle(accountId: string): void {
    const money = this.moneyOf(accountId)
    money.availableCents += money.pendingCents
    money.pendingCents = 0
    for (const s of this.sessions.values())
      if (s.paid && s.destinationAccountId === accountId) s.settled = true
  }
  /** Like Stripe, refuses more than the available balance. */
  async createPayout(input: {
    accountId: string
    amountCents: number
    metadata: Record<string, string>
    idempotencyKey: string
  }): Promise<{ payoutId: string }> {
    this.trip('createPayout')
    const key = `payout:${input.accountId}:${input.idempotencyKey}`
    const earlier = this.byKey.get(key) as { payoutId: string } | undefined
    if (earlier) return earlier
    const money = this.moneyOf(input.accountId)
    if (input.amountCents > money.availableCents)
      throw refused(
        'balance_insufficient',
        `You have insufficient funds in your Stripe account for this payout (${money.availableCents} available)`,
      )
    money.availableCents -= input.amountCents
    const payoutId = `po_fake_${++this.counter}`
    money.payouts.push({
      payoutId,
      amountCents: input.amountCents,
      status: 'pending',
      metadata: input.metadata,
    })
    const result = { payoutId }
    this.byKey.set(key, result)
    return result
  }
  async findPayout(accountId: string, label: string): Promise<PayoutResult | null> {
    this.trip('findPayout')
    const found = [...this.moneyOf(accountId).payouts]
      .reverse()
      .find((p) => p.metadata[PAYOUT_LABEL] === label)
    return found ? { ...found } : null
  }
  /**
   * The payout.paid or payout.failed event Stripe sends on the Connect endpoint. A failed payout's
   * money goes back to the available balance.
   */
  payoutEvent(payoutId: string, outcome: 'paid' | 'failed'): PaymentsWebhookEvent {
    for (const [accountId, money] of this.money) {
      const payout = money.payouts.find((p) => p.payoutId === payoutId)
      if (!payout) continue
      if (outcome === 'failed' && payout.status !== 'failed')
        money.availableCents += payout.amountCents
      payout.status = outcome
      return {
        id: `evt_po_${payoutId}_${++this.counter}`,
        type: `payout.${outcome}`,
        account: accountId,
        data: {
          object: {
            id: payoutId,
            object: 'payout',
            amount: payout.amountCents,
            currency: 'sgd',
            status: outcome,
            metadata: payout.metadata,
            ...(outcome === 'failed' ? { failure_code: 'account_closed' } : {}),
          },
        },
      }
    }
    throw new Error(`no such payout ${payoutId}`)
  }

  /**
   * A bank dispute on a card payment, and the event Stripe sends for it. Elevate's balance is
   * debited, not the profile's, so the fake's balances do not change.
   */
  disputeEvent(paymentIntentId: string, stage: 'created' | 'won' | 'lost'): PaymentsWebhookEvent {
    const s = this.byPaymentIntent(paymentIntentId)
    s.disputeStatus = stage === 'created' ? 'open' : stage
    return {
      id: `evt_dp_${paymentIntentId}_${++this.counter}`,
      type: stage === 'created' ? 'charge.dispute.created' : 'charge.dispute.closed',
      data: {
        object: {
          id: `dp_${paymentIntentId}`,
          object: 'dispute',
          amount: s.amountCents,
          currency: s.currency,
          charge: `ch_${paymentIntentId}`,
          payment_intent: paymentIntentId,
          reason: 'fraudulent',
          status: stage === 'created' ? 'needs_response' : stage,
        },
      },
    }
  }

  /** The charge.refunded event Stripe would send after createRefund, with the charge's refunds. */
  refundedEvent(paymentIntentId: string): PaymentsWebhookEvent {
    const s = this.byPaymentIntent(paymentIntentId)
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
  /** Each paid session's share to the account, less what was taken back, plus fee returned. */
  async listTransferAmountCents(destinationAccountId: string): Promise<number> {
    this.trip('listTransferAmountCents')
    return [...this.sessions.values()]
      .filter((s) => s.paid && s.destinationAccountId === destinationAccountId)
      .reduce(
        (sum, s) =>
          sum + (s.amountCents - s.applicationFeeCents) - s.reversedCents + s.feeRefundedCents,
        0,
      )
  }
  constructEvent(rawBody: string, signature: string | undefined): PaymentsWebhookEvent {
    if (signature !== 'fake-valid') throw new Error('invalid signature')
    return JSON.parse(rawBody) as PaymentsWebhookEvent
  }

  /** The account's money, made empty and automatic on first use. */
  moneyOf(accountId: string): FakeAccountMoney {
    let money = this.money.get(accountId)
    if (!money) {
      money = { payoutMode: 'automatic', availableCents: 0, pendingCents: 0, payouts: [] }
      this.money.set(accountId, money)
    }
    return money
  }
  /** Adds to (or, below zero, takes from) the balance that holds the payment's money. */
  private move(s: FakeSession, cents: number): void {
    const money = this.moneyOf(s.destinationAccountId)
    if (s.settled) money.availableCents += cents
    else money.pendingCents += cents
  }
  private returnFee(s: FakeSession, cents: number, metadata: Record<string, string>): string {
    s.feeRefundedCents += cents
    this.move(s, cents)
    const feeRefundId = `fr_fake_${++this.counter}`
    this.feeRefunds.push({
      feeRefundId,
      applicationFeeId: `fee_${s.paymentIntentId}`,
      amountCents: cents,
      metadata,
    })
    return feeRefundId
  }
  /** Stripe returns Elevate's fee in proportion to what was taken back, up to what is left. */
  private returnFeeInProportion(s: FakeSession, takenBackCents: number): void {
    const cents = Math.min(
      Math.round((s.applicationFeeCents * takenBackCents) / s.amountCents),
      s.applicationFeeCents - s.feeRefundedCents,
    )
    if (cents > 0) this.returnFee(s, cents, {})
  }
  private readFee(s: FakeSession): number | null {
    if (s.feeLate) {
      s.feeLate = false
      return null
    }
    return s.stripeFeeCents
  }
  private byPaymentIntent(paymentIntentId: string): FakeSession {
    const s = [...this.sessions.values()].find((x) => x.paymentIntentId === paymentIntentId)
    if (!s) throw new Error(`no such payment intent ${paymentIntentId}`)
    return s
  }
  private byCharge(chargeId: string): FakeSession {
    return this.byPaymentIntent(chargeId.replace(/^ch_/, ''))
  }
  private byTransfer(transferId: string): FakeSession {
    return this.byPaymentIntent(transferId.replace(/^tr_/, ''))
  }
  private byApplicationFee(applicationFeeId: string): FakeSession {
    return this.byPaymentIntent(applicationFeeId.replace(/^fee_/, ''))
  }
}

function refused(code: string, message: string): Error {
  return new Stripe.errors.StripeInvalidRequestError({ code, message, statusCode: 400 })
}
