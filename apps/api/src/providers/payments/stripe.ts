import Stripe from 'stripe'
import {
  type AccountBalance,
  type ApplicationFeeRefund,
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
  type PayoutStatus,
  type RefundResult,
  type RefundStatus,
  type TransferReversal,
  type TransferReversalResult,
} from './types'

export type StripeConfig = {
  secretKey: string
  webhookSecret?: string
  connectWebhookSecret?: string
  country: string
}

export class StripePaymentsProvider implements PaymentsProvider {
  readonly driver = 'stripe'
  readonly stripe: Stripe

  constructor(private readonly config: StripeConfig) {
    this.stripe = new Stripe(config.secretKey, {
      appInfo: { name: 'Elevate', url: 'https://elevate.sg' },
    })
  }

  /** Express-equivalent account via controller properties (Stripe marks `type: 'express'` as legacy). */
  async createConnectedAccount(input: ConnectedAccountInput): Promise<{ accountId: string }> {
    const account = await this.stripe.accounts.create({
      country: this.config.country,
      email: input.email,
      controller: {
        stripe_dashboard: { type: 'express' },
        fees: { payer: 'application' },
        losses: { payments: 'application' },
      },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_type: input.businessType,
      business_profile: {
        product_description: 'Online courses sold through Elevate',
        name: input.displayName,
      },
      metadata: {
        elevateProfileId: input.profileId,
        elevatePayoutAccountId: input.payoutAccountId,
      },
    })
    return { accountId: account.id }
  }

  async createOnboardingLink(input: {
    accountId: string
    refreshUrl: string
    returnUrl: string
  }): Promise<{ url: string }> {
    const link = await this.stripe.accountLinks.create({
      account: input.accountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: 'account_onboarding',
    })
    return { url: link.url }
  }

  async createLoginLink(accountId: string): Promise<{ url: string }> {
    const link = await this.stripe.accounts.createLoginLink(accountId)
    return { url: link.url }
  }

  async retrieveAccount(accountId: string): Promise<ConnectedAccountStatus> {
    const account = await this.stripe.accounts.retrieve(accountId)
    return accountStatus(account)
  }

  /** A test-mode key leads to the test dashboard. */
  accountDashboardUrl(accountId: string): string {
    const test = /^(sk|rk)_test_/.test(this.config.secretKey)
    return `https://dashboard.stripe.com/${test ? 'test/' : ''}connect/accounts/${accountId}`
  }

  /**
   * A key is refused when it comes back with a different request (a session replaced and later
   * pointed at again, or a retry after 30 minutes), because `expires_at` always differs. Such a
   * start is not a double submit, so it gets one fresh key.
   */
  async createCheckoutSession(input: CheckoutSessionInput): Promise<{ id: string; url: string }> {
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.amountCents,
            product_data: {
              name: input.productName ?? input.courseTitle,
              ...(input.courseImageUrl ? { images: [input.courseImageUrl] } : {}),
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: input.applicationFeeCents,
        transfer_data: { destination: input.destinationAccountId },
        metadata: input.metadata,
      },
      customer_email: input.customerEmail,
      client_reference_id: input.enrollmentId,
      metadata: input.metadata,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.allowedPaymentMethods
        ? { allowed_payment_method_types: [...input.allowedPaymentMethods] }
        : {}),
      ...(input.hideLink ? { wallet_options: { link: { display: 'never' } } } : {}),
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    }
    const key = checkoutIdempotencyKey(input)
    let session: Stripe.Checkout.Session
    try {
      session = await this.stripe.checkout.sessions.create(params, { idempotencyKey: key })
    } catch (error) {
      if (!(error instanceof Stripe.errors.StripeIdempotencyError)) throw error
      session = await this.stripe.checkout.sessions.create(params, {
        idempotencyKey: `${key}:${Date.now()}`,
      })
    }
    if (!session.url) throw new Error('Stripe did not return a Checkout URL')
    return { id: session.id, url: session.url }
  }

  async retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionResult> {
    const s = await this.stripe.checkout.sessions.retrieve(sessionId)
    return {
      id: s.id,
      url: s.url,
      status: (s.status ?? 'open') as CheckoutSessionResult['status'],
      paymentStatus: s.payment_status as CheckoutSessionResult['paymentStatus'],
      paymentIntentId:
        typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null),
      amountTotal: s.amount_total,
      customerEmail: s.customer_details?.email ?? s.customer_email ?? null,
      metadata: (s.metadata ?? {}) as Record<string, string>,
    }
  }

  async expireCheckoutSession(sessionId: string): Promise<CheckoutSessionResult> {
    try {
      await this.stripe.checkout.sessions.expire(sessionId)
    } catch (error) {
      // Stripe refuses to expire a session that is not open; the retrieve below says why.
      if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) throw error
    }
    return this.retrieveCheckoutSession(sessionId)
  }

  async retrievePaymentDetails(paymentIntentId: string): Promise<PaymentDetails> {
    const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: [
        'latest_charge.balance_transaction',
        'latest_charge.transfer',
        'latest_charge.application_fee',
      ],
    })
    const charge = typeof pi.latest_charge === 'string' ? null : pi.latest_charge
    const balance =
      charge && typeof charge.balance_transaction !== 'string' ? charge.balance_transaction : null
    const transfer = charge && typeof charge.transfer !== 'string' ? charge.transfer : null
    const appFee =
      charge && typeof charge.application_fee !== 'string' ? charge.application_fee : null
    return {
      paymentIntentId: pi.id,
      chargeId: charge?.id ?? (typeof pi.latest_charge === 'string' ? pi.latest_charge : null),
      balanceTransactionId:
        balance?.id ??
        (typeof charge?.balance_transaction === 'string' ? charge.balance_transaction : null),
      stripeFeeCents: balance?.fee ?? null,
      transferId: transfer?.id ?? (typeof charge?.transfer === 'string' ? charge.transfer : null),
      applicationFeeId:
        appFee?.id ?? (typeof charge?.application_fee === 'string' ? charge.application_fee : null),
      receiptUrl: charge?.receipt_url ?? null,
      amountCents: pi.amount_received || pi.amount,
      paidAt: charge?.created ? new Date(charge.created * 1000) : null,
    }
  }

  async createRefund(input: CreateRefundInput): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create(
      {
        payment_intent: input.paymentIntentId,
        ...(input.amountCents === undefined ? {} : { amount: input.amountCents }),
        reverse_transfer: true,
        refund_application_fee: input.refundApplicationFee ?? true,
        reason: 'requested_by_customer',
        metadata: {
          ...(input.metadata ?? {}),
          ...(input.reason ? { elevateReason: input.reason.slice(0, 500) } : {}),
        },
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    )
    return { refundId: refund.id, amountCents: refund.amount, status: refundStatus(refund.status) }
  }

  async retrieveRefund(refundId: string): Promise<RefundStatus> {
    const refund = await this.stripe.refunds.retrieve(refundId)
    return refundStatus(refund.status)
  }

  async listRefunds(chargeId: string): Promise<ChargeRefund[]> {
    const out: ChargeRefund[] = []
    for await (const refund of this.stripe.refunds.list({ charge: chargeId, limit: 100 })) {
      out.push({
        refundId: refund.id,
        amountCents: refund.amount,
        status: refund.status ?? 'pending',
        metadata: (refund.metadata ?? {}) as Record<string, string>,
      })
    }
    return out
  }

  async refundApplicationFee(input: {
    applicationFeeId: string
    amountCents: number
    metadata: Record<string, string>
    idempotencyKey: string
  }): Promise<{ feeRefundId: string }> {
    const feeRefund = await this.stripe.applicationFees.createRefund(
      input.applicationFeeId,
      { amount: input.amountCents, metadata: input.metadata },
      { idempotencyKey: input.idempotencyKey },
    )
    return { feeRefundId: feeRefund.id }
  }

  async listApplicationFeeRefunds(applicationFeeId: string): Promise<ApplicationFeeRefund[]> {
    const out: ApplicationFeeRefund[] = []
    for await (const feeRefund of this.stripe.applicationFees.listRefunds(applicationFeeId, {
      limit: 100,
    })) {
      out.push({
        feeRefundId: feeRefund.id,
        amountCents: feeRefund.amount,
        metadata: (feeRefund.metadata ?? {}) as Record<string, string>,
      })
    }
    return out
  }

  /**
   * The answer carries the transfer's charge and its application fee, so the fee returned in all
   * is read from the same response that an idempotent retry replays.
   */
  async reverseTransfer(input: {
    transferId: string
    amountCents: number
    refundApplicationFee: boolean
    metadata: Record<string, string>
    idempotencyKey: string
  }): Promise<TransferReversalResult> {
    const reversal = await this.stripe.transfers.createReversal(
      input.transferId,
      {
        amount: input.amountCents,
        refund_application_fee: input.refundApplicationFee,
        metadata: input.metadata,
        expand: ['transfer.source_transaction.application_fee'],
      },
      { idempotencyKey: input.idempotencyKey },
    )
    const transfer = typeof reversal.transfer === 'string' ? null : reversal.transfer
    const charge =
      transfer?.source_transaction && typeof transfer.source_transaction !== 'string'
        ? transfer.source_transaction
        : null
    const fee =
      charge?.application_fee && typeof charge.application_fee !== 'string'
        ? charge.application_fee
        : null
    return { reversalId: reversal.id, applicationFeeRefundedCents: fee?.amount_refunded ?? null }
  }

  async listTransferReversals(transferId: string): Promise<TransferReversal[]> {
    const out: TransferReversal[] = []
    for await (const reversal of this.stripe.transfers.listReversals(transferId, { limit: 100 })) {
      out.push({
        reversalId: reversal.id,
        amountCents: reversal.amount,
        metadata: (reversal.metadata ?? {}) as Record<string, string>,
      })
    }
    return out
  }

  /** The call the test session ran on the pinned API version. */
  async setManualPayouts(accountId: string): Promise<void> {
    await this.stripe.accounts.update(accountId, {
      settings: { payouts: { schedule: { interval: 'manual' } } },
    })
  }

  async setAutomaticPayouts(accountId: string): Promise<void> {
    await this.stripe.accounts.update(accountId, {
      settings: { payouts: { schedule: { interval: 'daily' } } },
    })
  }

  async retrieveBalance(accountId: string): Promise<AccountBalance> {
    const balance = await this.stripe.balance.retrieve({}, { stripeAccount: accountId })
    const sgd = (rows: Array<{ amount: number; currency: string }>) =>
      rows.filter((r) => r.currency === 'sgd').reduce((sum, r) => sum + r.amount, 0)
    return { availableCents: sgd(balance.available), pendingCents: sgd(balance.pending) }
  }

  async createPayout(input: {
    accountId: string
    amountCents: number
    metadata: Record<string, string>
    idempotencyKey: string
  }): Promise<{ payoutId: string }> {
    const payout = await this.stripe.payouts.create(
      { amount: input.amountCents, currency: 'sgd', metadata: input.metadata },
      { stripeAccount: input.accountId, idempotencyKey: input.idempotencyKey },
    )
    return { payoutId: payout.id }
  }

  /** Reads the account's payouts, newest first, until one carries the label or the list ends. */
  async findPayout(accountId: string, label: string): Promise<PayoutResult | null> {
    for await (const payout of this.stripe.payouts.list(
      { limit: 100 },
      { stripeAccount: accountId },
    )) {
      if (payout.metadata?.[PAYOUT_LABEL] === label)
        return {
          payoutId: payout.id,
          amountCents: payout.amount,
          status: payout.status as PayoutStatus,
          metadata: (payout.metadata ?? {}) as Record<string, string>,
        }
    }
    return null
  }

  async retrieveChargeFee(chargeId: string): Promise<ChargeFee | null> {
    const charge = await this.stripe.charges.retrieve(chargeId, {
      expand: ['balance_transaction'],
    })
    const balance = charge.balance_transaction
    if (!balance || typeof balance === 'string') return null
    const id = (field: string | { id: string } | null | undefined) =>
      field ? (typeof field === 'string' ? field : field.id) : null
    return {
      stripeFeeCents: balance.fee,
      balanceTransactionId: balance.id,
      transferId: id(charge.transfer),
      applicationFeeId: id(charge.application_fee),
    }
  }

  async listTransferAmountCents(destinationAccountId: string): Promise<number> {
    let total = 0
    for await (const transfer of this.stripe.transfers.list({
      destination: destinationAccountId,
      limit: 100,
    })) {
      total += transfer.amount - transfer.amount_reversed
    }
    return total
  }

  constructEvent(rawBody: string, signature: string | undefined): PaymentsWebhookEvent {
    if (!signature) throw new Error('missing stripe-signature header')
    const secrets = [this.config.webhookSecret, this.config.connectWebhookSecret].filter(
      (s): s is string => !!s,
    )
    if (secrets.length === 0) throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
    let lastError: unknown
    for (const secret of secrets) {
      try {
        const event = this.stripe.webhooks.constructEvent(rawBody, signature, secret)
        return {
          id: event.id,
          type: event.type,
          account: event.account,
          data: { object: event.data.object as unknown as Record<string, unknown> },
        }
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('invalid signature')
  }
}

export function accountStatus(
  account: Pick<
    Stripe.Account,
    'id' | 'details_submitted' | 'charges_enabled' | 'payouts_enabled' | 'company'
  >,
): ConnectedAccountStatus {
  return {
    accountId: account.id,
    detailsSubmitted: !!account.details_submitted,
    chargesEnabled: !!account.charges_enabled,
    payoutsEnabled: !!account.payouts_enabled,
    legalName: account.company?.name ?? null,
  }
}

function refundStatus(status: string | null): RefundStatus {
  return status === 'succeeded' || status === 'failed' || status === 'canceled' ? status : 'pending'
}
