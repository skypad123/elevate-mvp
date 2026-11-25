import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import { StripePaymentsProvider } from '../src/providers/payments/stripe'

const input = {
  enrollmentId: 'enr_1',
  payoutAccountId: 'acc_1',
  profileId: 'prof_1',
  courseTitle: 'A course',
  courseImageUrl: null,
  amountCents: 8000,
  currency: 'sgd',
  applicationFeeCents: 1200,
  destinationAccountId: 'acct_1',
  customerEmail: 'learner@example.com',
  successUrl: 'http://learner.test/checkout/success',
  cancelUrl: 'http://learner.test/course/a',
  replacesSessionId: 'cs_old',
  metadata: {},
}

const newProvider = () => new StripePaymentsProvider({ secretKey: 'sk_test_fake', country: 'SG' })

/** Replaces `resource[method]` with a stub that records the arguments of each call. */
function stub(resource: unknown, method: string, answer: (...args: unknown[]) => unknown) {
  const calls: unknown[][] = []
  ;(resource as Record<string, unknown>)[method] = (...args: unknown[]) => {
    calls.push(args)
    return answer(...args)
  }
  return calls
}

/** What `for await` reads from an auto-paginating Stripe list. */
function pages<T>(...items: T[]) {
  return (async function* () {
    yield* items
  })()
}

describe('Stripe checkout sessions', () => {
  it('opens the session with a fresh key when Stripe refuses a repeated one', async () => {
    const provider = newProvider()
    const keys: string[] = []
    const create = async (_params: unknown, options: { idempotencyKey: string }) => {
      keys.push(options.idempotencyKey)
      if (keys.length === 1)
        throw new Stripe.errors.StripeIdempotencyError({
          message: 'Keys for idempotent requests can only be used with the same parameters',
        })
      return { id: 'cs_new', url: 'https://checkout.stripe.test/cs_new' }
    }
    ;(provider.stripe.checkout.sessions as unknown as { create: typeof create }).create = create
    expect(await provider.createCheckoutSession(input)).toEqual({
      id: 'cs_new',
      url: 'https://checkout.stripe.test/cs_new',
    })
    expect(keys[0]).toBe('checkout:enr_1:8000:acc_1:none:cs_old')
    expect(keys[1]).toMatch(/^checkout:enr_1:8000:acc_1:none:cs_old:\d+$/)
  })

  it('sends the product name, the allowed methods and the hidden Link button when given', async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.checkout.sessions, 'create', async () => ({
      id: 'cs_1',
      url: 'https://checkout.stripe.test/cs_1',
    }))
    await provider.createCheckoutSession({
      ...input,
      productName: 'A course: Saturday class',
      allowedPaymentMethods: ['card', 'paynow'],
      hideLink: true,
    })
    const params = calls[0]?.[0] as Stripe.Checkout.SessionCreateParams
    expect(params.line_items?.[0]?.price_data?.product_data?.name).toBe('A course: Saturday class')
    expect(params.allowed_payment_method_types).toEqual(['card', 'paynow'])
    expect(params.wallet_options).toEqual({ link: { display: 'never' } })
  })

  it('leaves the methods and the wallets to the Dashboard when none are given', async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.checkout.sessions, 'create', async () => ({
      id: 'cs_1',
      url: 'https://checkout.stripe.test/cs_1',
    }))
    await provider.createCheckoutSession(input)
    const params = calls[0]?.[0] as Stripe.Checkout.SessionCreateParams
    expect(params.line_items?.[0]?.price_data?.product_data?.name).toBe('A course')
    expect(params).not.toHaveProperty('allowed_payment_method_types')
    expect(params).not.toHaveProperty('wallet_options')
  })

  it('does not retry other errors', async () => {
    const provider = newProvider()
    let calls = 0
    const create = async () => {
      calls++
      throw new Stripe.errors.StripeAPIError({ message: 'down' })
    }
    ;(provider.stripe.checkout.sessions as unknown as { create: typeof create }).create = create
    await expect(provider.createCheckoutSession(input)).rejects.toThrow('down')
    expect(calls).toBe(1)
  })
})

describe('Stripe refunds', () => {
  it('lists every refund of a charge with its id, amount, status and metadata', async () => {
    const provider = newProvider()
    const asked: unknown[] = []
    const list = (params: unknown) => {
      asked.push(params)
      return (async function* () {
        yield { id: 're_2', amount: 2000, status: 'succeeded', metadata: {} }
        yield {
          id: 're_1',
          amount: 3000,
          status: 'pending',
          metadata: { paymentId: 'pay_1', elevateReason: 'Bought by mistake' },
        }
      })()
    }
    ;(provider.stripe.refunds as unknown as { list: typeof list }).list = list
    expect(await provider.listRefunds('ch_1')).toEqual([
      { refundId: 're_2', amountCents: 2000, status: 'succeeded', metadata: {} },
      {
        refundId: 're_1',
        amountCents: 3000,
        status: 'pending',
        metadata: { paymentId: 'pay_1', elevateReason: 'Bought by mistake' },
      },
    ])
    expect(asked).toEqual([{ charge: 'ch_1', limit: 100 }])
  })

  it("refunds the whole payment with Elevate's fee returned when told nothing, as before", async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.refunds, 'create', async () => ({
      id: 're_1',
      amount: 8000,
      status: 'succeeded',
    }))
    expect(
      await provider.createRefund({
        paymentIntentId: 'pi_1',
        reason: 'Bought by mistake',
        metadata: { paymentId: 'pay_1' },
        idempotencyKey: 'support-refund:pay_1',
      }),
    ).toEqual({ refundId: 're_1', amountCents: 8000, status: 'succeeded' })
    expect(calls[0]).toEqual([
      {
        payment_intent: 'pi_1',
        reverse_transfer: true,
        refund_application_fee: true,
        reason: 'requested_by_customer',
        metadata: { paymentId: 'pay_1', elevateReason: 'Bought by mistake' },
      },
      { idempotencyKey: 'support-refund:pay_1' },
    ])
  })

  it("refunds part of a payment with the transfer reversed and Elevate's fee kept", async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.refunds, 'create', async () => ({
      id: 'pyr_1',
      amount: 48000,
      status: 'pending',
    }))
    expect(
      await provider.createRefund({
        paymentIntentId: 'pi_1',
        amountCents: 48000,
        refundApplicationFee: false,
        metadata: { seat_refund_id: 'sr_1' },
        idempotencyKey: 'seat-refund:sr_1',
      }),
    ).toEqual({ refundId: 'pyr_1', amountCents: 48000, status: 'pending' })
    expect(calls[0]).toEqual([
      {
        payment_intent: 'pi_1',
        amount: 48000,
        reverse_transfer: true,
        refund_application_fee: false,
        reason: 'requested_by_customer',
        metadata: { seat_refund_id: 'sr_1' },
      },
      { idempotencyKey: 'seat-refund:sr_1' },
    ])
  })

  it("reads a refund's status, with requires_action as pending", async () => {
    const provider = newProvider()
    let status = 'succeeded'
    const calls = stub(provider.stripe.refunds, 'retrieve', async () => ({ id: 're_1', status }))
    expect(await provider.retrieveRefund('re_1')).toBe('succeeded')
    status = 'requires_action'
    expect(await provider.retrieveRefund('re_1')).toBe('pending')
    status = 'canceled'
    expect(await provider.retrieveRefund('re_1')).toBe('canceled')
    expect(calls[0]).toEqual(['re_1'])
  })

  it("refunds part of Elevate's fee with a label and a key", async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.applicationFees, 'createRefund', async () => ({
      id: 'fr_1',
    }))
    expect(
      await provider.refundApplicationFee({
        applicationFeeId: 'fee_1',
        amountCents: 6988,
        metadata: { seat_refund_id: 'sr_1' },
        idempotencyKey: 'seat-fee-refund:sr_1',
      }),
    ).toEqual({ feeRefundId: 'fr_1' })
    expect(calls[0]).toEqual([
      'fee_1',
      { amount: 6988, metadata: { seat_refund_id: 'sr_1' } },
      { idempotencyKey: 'seat-fee-refund:sr_1' },
    ])
  })

  it('lists the refunds of an application fee with their labels', async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.applicationFees, 'listRefunds', () =>
      pages(
        { id: 'fr_2', amount: 100, metadata: null },
        { id: 'fr_1', amount: 6988, metadata: { seat_refund_id: 'sr_1' } },
      ),
    )
    expect(await provider.listApplicationFeeRefunds('fee_1')).toEqual([
      { feeRefundId: 'fr_2', amountCents: 100, metadata: {} },
      { feeRefundId: 'fr_1', amountCents: 6988, metadata: { seat_refund_id: 'sr_1' } },
    ])
    expect(calls[0]).toEqual(['fee_1', { limit: 100 }])
  })

  it('reverses a transfer with the fee returned, and reads the fee returned from the answer', async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.transfers, 'createReversal', async () => ({
      id: 'trr_1',
      transfer: {
        id: 'tr_1',
        source_transaction: { id: 'ch_1', application_fee: { id: 'fee_1', amount_refunded: 8988 } },
      },
    }))
    expect(
      await provider.reverseTransfer({
        transferId: 'tr_1',
        amountCents: 50000,
        refundApplicationFee: true,
        metadata: { seat_refund_id: 'sr_9' },
        idempotencyKey: 'seat-reversal:sr_9',
      }),
    ).toEqual({ reversalId: 'trr_1', applicationFeeRefundedCents: 8988 })
    expect(calls[0]).toEqual([
      'tr_1',
      {
        amount: 50000,
        refund_application_fee: true,
        metadata: { seat_refund_id: 'sr_9' },
        expand: ['transfer.source_transaction.application_fee'],
      },
      { idempotencyKey: 'seat-reversal:sr_9' },
    ])
  })

  it('answers null for the fee when the reversal does not carry it', async () => {
    const provider = newProvider()
    stub(provider.stripe.transfers, 'createReversal', async () => ({
      id: 'trr_1',
      transfer: 'tr_1',
    }))
    expect(
      await provider.reverseTransfer({
        transferId: 'tr_1',
        amountCents: 100,
        refundApplicationFee: false,
        metadata: {},
        idempotencyKey: 'k',
      }),
    ).toEqual({ reversalId: 'trr_1', applicationFeeRefundedCents: null })
  })

  it('lists the reversals of a transfer with their labels', async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.transfers, 'listReversals', () =>
      pages(
        { id: 'trr_2', amount: 100, metadata: null },
        { id: 'trr_1', amount: 50000, metadata: { seat_refund_id: 'sr_9' } },
      ),
    )
    expect(await provider.listTransferReversals('tr_1')).toEqual([
      { reversalId: 'trr_2', amountCents: 100, metadata: {} },
      { reversalId: 'trr_1', amountCents: 50000, metadata: { seat_refund_id: 'sr_9' } },
    ])
    expect(calls[0]).toEqual(['tr_1', { limit: 100 }])
  })
})

describe('Stripe payouts', () => {
  it('switches an account to manual payouts and back to daily', async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.accounts, 'update', async () => ({ id: 'acct_1' }))
    await provider.setManualPayouts('acct_1')
    await provider.setAutomaticPayouts('acct_1')
    expect(calls).toEqual([
      ['acct_1', { settings: { payouts: { schedule: { interval: 'manual' } } } }],
      ['acct_1', { settings: { payouts: { schedule: { interval: 'daily' } } } }],
    ])
  })

  it("reads the account's SGD balance", async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.balance, 'retrieve', async () => ({
      available: [
        { amount: 41012, currency: 'sgd' },
        { amount: 999, currency: 'usd' },
      ],
      pending: [{ amount: -8988, currency: 'sgd' }],
    }))
    expect(await provider.retrieveBalance('acct_1')).toEqual({
      availableCents: 41012,
      pendingCents: -8988,
    })
    expect(calls[0]).toEqual([{}, { stripeAccount: 'acct_1' }])
  })

  it('creates a payout on the account with a label and a key', async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.payouts, 'create', async () => ({ id: 'po_1' }))
    expect(
      await provider.createPayout({
        accountId: 'acct_1',
        amountCents: 41012,
        metadata: { payout_id: 'pr_1' },
        idempotencyKey: 'payout:pr_1',
      }),
    ).toEqual({ payoutId: 'po_1' })
    expect(calls[0]).toEqual([
      { amount: 41012, currency: 'sgd', metadata: { payout_id: 'pr_1' } },
      { stripeAccount: 'acct_1', idempotencyKey: 'payout:pr_1' },
    ])
  })

  it('finds a payout by its label, and answers null when none carries it', async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.payouts, 'list', () =>
      pages(
        { id: 'po_3', amount: 1, status: 'paid', metadata: {} },
        { id: 'po_2', amount: 41012, status: 'in_transit', metadata: { payout_id: 'pr_2' } },
        { id: 'po_1', amount: 5, status: 'paid', metadata: { payout_id: 'pr_1' } },
      ),
    )
    expect(await provider.findPayout('acct_1', 'pr_2')).toEqual({
      payoutId: 'po_2',
      amountCents: 41012,
      status: 'in_transit',
      metadata: { payout_id: 'pr_2' },
    })
    expect(await provider.findPayout('acct_1', 'pr_9')).toBeNull()
    expect(calls[0]).toEqual([{ limit: 100 }, { stripeAccount: 'acct_1' }])
  })
})

describe('Stripe charge fees', () => {
  it("reads Stripe's fee and the ids from the charge with its balance transaction", async () => {
    const provider = newProvider()
    const calls = stub(provider.stripe.charges, 'retrieve', async () => ({
      id: 'ch_1',
      balance_transaction: { id: 'txn_1', fee: 2000 },
      transfer: 'tr_1',
      application_fee: { id: 'fee_1' },
    }))
    expect(await provider.retrieveChargeFee('ch_1')).toEqual({
      stripeFeeCents: 2000,
      balanceTransactionId: 'txn_1',
      transferId: 'tr_1',
      applicationFeeId: 'fee_1',
    })
    expect(calls[0]).toEqual(['ch_1', { expand: ['balance_transaction'] }])
  })

  it('answers null while Stripe has not filled the balance transaction', async () => {
    const provider = newProvider()
    stub(provider.stripe.charges, 'retrieve', async () => ({
      id: 'ch_1',
      balance_transaction: null,
      transfer: null,
      application_fee: null,
    }))
    expect(await provider.retrieveChargeFee('ch_1')).toBeNull()
  })
})
