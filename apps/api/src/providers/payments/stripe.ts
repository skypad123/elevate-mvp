import Stripe from 'stripe'
import {
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

  async createCheckoutSession(input: CheckoutSessionInput): Promise<{ id: string; url: string }> {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency,
              unit_amount: input.amountCents,
              product_data: {
                name: input.courseTitle,
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
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      },
      { idempotencyKey: checkoutIdempotencyKey(input) },
    )
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
    }
  }

  async createRefund(input: {
    paymentIntentId: string
    reason?: string
    metadata?: Record<string, string>
  }): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: input.paymentIntentId,
      reverse_transfer: true,
      refund_application_fee: true,
      reason: 'requested_by_customer',
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.reason ? { elevateReason: input.reason.slice(0, 500) } : {}),
      },
    })
    return { refundId: refund.id, amountCents: refund.amount, status: refund.status ?? 'pending' }
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
