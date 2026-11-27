import Stripe from 'stripe'
import { beforeEach, describe, expect, it } from 'vitest'
import { FakePaymentsProvider } from '../src/providers/payments'

/**
 * The S$500 seat of the design's amounts table: price A, Elevate's fee C + E, profile's share N,
 * Stripe's fee F, and K, what Elevate keeps after Stripe's fee.
 */
const A = 50000
const FEE = 8988 // C + E: S$72.38 commission and S$17.50 fee estimate
const N = 41012
const F = 2000
const K = FEE - F // S$69.88

const account = 'acct_seller'
let fake: FakePaymentsProvider

/** One paid S$500 seat; returns its ids as the provider names them. */
async function paidSeat(method: 'card' | 'paynow' = 'card') {
  const { id } = await fake.createCheckoutSession({
    enrollmentId: `enr_${fake.sessions.size + 1}`,
    payoutAccountId: 'pa_1',
    profileId: 'prof_1',
    courseTitle: 'A course',
    productName: 'A course: Saturday class',
    courseImageUrl: null,
    amountCents: A,
    currency: 'sgd',
    applicationFeeCents: FEE,
    destinationAccountId: account,
    customerEmail: 'learner@example.com',
    successUrl: 'http://learner.test/ok',
    cancelUrl: 'http://learner.test/no',
    allowedPaymentMethods: ['card', 'paynow'],
    hideLink: true,
    metadata: { classId: 'cls_1' },
  })
  fake.completeCheckout(id, method)
  fake.setStripeFee(id, F)
  const details = await fake.retrievePaymentDetails(fake.sessions.get(id)?.paymentIntentId ?? '')
  return {
    sessionId: id,
    paymentIntentId: details.paymentIntentId,
    chargeId: details.chargeId as string,
    transferId: details.transferId as string,
    applicationFeeId: details.applicationFeeId as string,
  }
}

const balance = () => fake.retrieveBalance(account)
const share = () => fake.listTransferAmountCents(account)

/** Step 2 and step 3 of "How the job sends a row": R with the fee kept, then X of the fee. */
async function seatRefund(seat: Awaited<ReturnType<typeof paidSeat>>, r: number, x: number) {
  const refund = await fake.createRefund({
    paymentIntentId: seat.paymentIntentId,
    amountCents: r,
    refundApplicationFee: false,
    metadata: { seat_refund_id: 'sr_1' },
    idempotencyKey: `seat-refund:${seat.sessionId}`,
  })
  if (x > 0)
    await fake.refundApplicationFee({
      applicationFeeId: seat.applicationFeeId,
      amountCents: x,
      metadata: { seat_refund_id: 'sr_1' },
      idempotencyKey: `seat-fee-refund:${seat.sessionId}`,
    })
  return refund
}

beforeEach(() => {
  fake = new FakePaymentsProvider()
})

describe('the fake on the S$500 example', () => {
  it("puts the profile's share in its pending balance when the seat is paid", async () => {
    const seat = await paidSeat()
    expect(await balance()).toEqual({ availableCents: 0, pendingCents: N })
    expect(await share()).toBe(N)
    expect(await fake.retrieveChargeFee(seat.chargeId)).toEqual({
      stripeFeeCents: F,
      balanceTransactionId: `txn_${seat.paymentIntentId}`,
      transferId: seat.transferId,
      applicationFeeId: seat.applicationFeeId,
    })
    expect(fake.sessions.get(seat.sessionId)).toMatchObject({
      allowedPaymentMethods: ['card', 'paynow'],
      productName: 'A course: Saturday class',
      hideLink: true,
    })
  })

  it('a cancelled seat returns S$500.00 and leaves the profile S$20.00 down', async () => {
    const seat = await paidSeat()
    await fake.createRefund({
      paymentIntentId: seat.paymentIntentId,
      refundApplicationFee: false,
      idempotencyKey: 'seat-refund:1',
    })
    // the reversal goes through although it is larger than the balance
    expect(await balance()).toEqual({ availableCents: 0, pendingCents: N - A })
    await fake.refundApplicationFee({
      applicationFeeId: seat.applicationFeeId,
      amountCents: K,
      metadata: { seat_refund_id: 'sr_1' },
      idempotencyKey: 'seat-fee-refund:1',
    })
    expect(await balance()).toEqual({ availableCents: 0, pendingCents: -F })
    expect(await share()).toBe(-F)
  })

  it('a withdrawal returns S$480.00 and leaves the profile at zero', async () => {
    const seat = await paidSeat()
    const refund = await seatRefund(seat, A - F, K)
    expect(refund).toMatchObject({ amountCents: 48000, status: 'succeeded' })
    expect(await balance()).toEqual({ availableCents: 0, pendingCents: 0 })
    expect(await share()).toBe(0)
  })

  it('a discretionary S$300.00 refund returns S$41.92 of the fee; the profile keeps S$152.04', async () => {
    const seat = await paidSeat()
    const x = Math.floor((K * 30000) / A)
    expect(x).toBe(4192)
    await seatRefund(seat, 30000, x)
    expect(await balance()).toEqual({ availableCents: 0, pendingCents: 15204 })
    expect(await share()).toBe(15204)
    expect(fake.sessions.get(seat.sessionId)).toMatchObject({
      refundedCents: 30000,
      reversedCents: 30000,
      feeRefundedCents: 4192,
    })
  })

  it('a five-block class cancelled after one block returns S$400.00 and S$55.90 of the fee', async () => {
    const seat = await paidSeat()
    const r = Math.floor((A * 4) / 5)
    const x = Math.floor((K * r) / A)
    expect([r, x]).toEqual([40000, 5590])
    await seatRefund(seat, r, x)
    expect(await share()).toBe(N - r + x)
  })

  it("a lost seat returns S$500.00 and all of Elevate's fee; the profile ends at zero", async () => {
    const seat = await paidSeat()
    await seatRefund(seat, A, FEE)
    expect(await balance()).toEqual({ availableCents: 0, pendingCents: 0 })
  })

  it("a lost bank dispute's reversal takes the whole transfer back with the fee returned", async () => {
    const seat = await paidSeat()
    fake.disputeEvent(seat.paymentIntentId, 'created')
    // Elevate's balance pays the bank, not the profile's
    expect(await balance()).toEqual({ availableCents: 0, pendingCents: N })
    fake.disputeEvent(seat.paymentIntentId, 'lost')
    const reversal = await fake.reverseTransfer({
      transferId: seat.transferId,
      amountCents: A,
      refundApplicationFee: true,
      metadata: { seat_refund_id: 'sr_9' },
      idempotencyKey: 'seat-reversal:sr_9',
    })
    expect(reversal.applicationFeeRefundedCents).toBe(FEE)
    expect(await balance()).toEqual({ availableCents: 0, pendingCents: 0 })
    expect(await share()).toBe(0)
    // the same key answers the first reversal and moves nothing
    expect(
      await fake.reverseTransfer({
        transferId: seat.transferId,
        amountCents: A,
        refundApplicationFee: true,
        metadata: { seat_refund_id: 'sr_9' },
        idempotencyKey: 'seat-reversal:sr_9',
      }),
    ).toEqual(reversal)
    expect(fake.reversals).toHaveLength(1)
  })

  it("a refund told nothing returns Elevate's fee in proportion, as Support's does today", async () => {
    const seat = await paidSeat()
    await fake.createRefund({ paymentIntentId: seat.paymentIntentId })
    expect(await balance()).toEqual({ availableCents: 0, pendingCents: 0 })
    expect(await fake.listApplicationFeeRefunds(seat.applicationFeeId)).toEqual([
      expect.objectContaining({ amountCents: FEE, metadata: {} }),
    ])
  })

  it('pays out of the available balance only, and a failed payout puts the money back', async () => {
    await paidSeat()
    await fake.setManualPayouts(account)
    expect(fake.moneyOf(account).payoutMode).toBe('manual')
    await expect(
      fake.createPayout({ accountId: account, amountCents: N, metadata: {}, idempotencyKey: 'p0' }),
    ).rejects.toMatchObject({ code: 'balance_insufficient' })
    fake.settle(account)
    expect(await balance()).toEqual({ availableCents: N, pendingCents: 0 })
    const { payoutId } = await fake.createPayout({
      accountId: account,
      amountCents: 40000,
      metadata: { payout_id: 'pr_1' },
      idempotencyKey: 'payout:pr_1',
    })
    expect(
      await fake.createPayout({
        accountId: account,
        amountCents: 40000,
        metadata: { payout_id: 'pr_1' },
        idempotencyKey: 'payout:pr_1',
      }),
    ).toEqual({ payoutId })
    expect(await balance()).toEqual({ availableCents: N - 40000, pendingCents: 0 })
    expect(await fake.findPayout(account, 'pr_1')).toEqual({
      payoutId,
      amountCents: 40000,
      status: 'pending',
      metadata: { payout_id: 'pr_1' },
    })
    expect(await fake.findPayout(account, 'pr_2')).toBeNull()
    const event = fake.payoutEvent(payoutId, 'failed')
    expect(event).toMatchObject({
      type: 'payout.failed',
      account,
      data: { object: { id: payoutId } },
    })
    expect(await balance()).toEqual({ availableCents: N, pendingCents: 0 })
    await fake.setAutomaticPayouts(account)
    expect(fake.moneyOf(account).payoutMode).toBe('automatic')
  })

  it('takes a refund on a settled payment from the available balance', async () => {
    const seat = await paidSeat()
    fake.settle(account)
    await seatRefund(seat, A, K)
    expect(await balance()).toEqual({ availableCents: -F, pendingCents: 0 })
  })
})

describe('what the fake refuses', () => {
  it('refuses a fee refund larger than what is left of the fee', async () => {
    const seat = await paidSeat()
    await fake.refundApplicationFee({
      applicationFeeId: seat.applicationFeeId,
      amountCents: 7238,
      metadata: {},
      idempotencyKey: 'f1',
    })
    await expect(
      fake.refundApplicationFee({
        applicationFeeId: seat.applicationFeeId,
        amountCents: FEE,
        metadata: {},
        idempotencyKey: 'f2',
      }),
    ).rejects.toBeInstanceOf(Stripe.errors.StripeInvalidRequestError)
  })

  it('refuses a refund while a bank dispute is open or after it is lost, and allows it after a win', async () => {
    const open = await paidSeat()
    fake.disputeEvent(open.paymentIntentId, 'created')
    const refuse = (paymentIntentId: string) =>
      expect(
        fake.createRefund({ paymentIntentId, refundApplicationFee: false }),
      ).rejects.toMatchObject({ code: 'charge_disputed' })
    await refuse(open.paymentIntentId)
    const lost = await paidSeat()
    fake.disputeEvent(lost.paymentIntentId, 'created')
    expect(fake.disputeEvent(lost.paymentIntentId, 'lost')).toMatchObject({
      type: 'charge.dispute.closed',
      data: { object: { status: 'lost', payment_intent: lost.paymentIntentId } },
    })
    await refuse(lost.paymentIntentId)
    expect(fake.refunds).toHaveLength(0)
    fake.disputeEvent(open.paymentIntentId, 'won')
    const refund = await fake.createRefund({
      paymentIntentId: open.paymentIntentId,
      refundApplicationFee: false,
    })
    expect(refund.status).toBe('succeeded')
  })

  it('refuses a payment method the session does not allow', async () => {
    const { id } = await fake.createCheckoutSession({
      enrollmentId: 'enr_card',
      payoutAccountId: 'pa_1',
      profileId: 'prof_1',
      courseTitle: 'A course',
      courseImageUrl: null,
      amountCents: A,
      currency: 'sgd',
      applicationFeeCents: FEE,
      destinationAccountId: account,
      customerEmail: 'learner@example.com',
      successUrl: 'http://learner.test/ok',
      cancelUrl: 'http://learner.test/no',
      allowedPaymentMethods: ['card'],
      metadata: {},
    })
    expect(() => fake.completeCheckout(id, 'paynow')).toThrow('does not allow paynow')
  })
})

describe('PayNow refunds', () => {
  it('a refund on a PayNow payment is pending until it is settled; a card one succeeds at once', async () => {
    const paynow = await paidSeat('paynow')
    const refund = await seatRefund(paynow, A - 709, FEE - 709)
    expect(refund.status).toBe('pending')
    expect(await fake.retrieveRefund(refund.refundId)).toBe('pending')
    fake.settleRefund(refund.refundId, 'succeeded')
    expect(await fake.retrieveRefund(refund.refundId)).toBe('succeeded')

    const card = await paidSeat('card')
    const cardRefund = await seatRefund(card, A - F, K)
    expect(await fake.retrieveRefund(cardRefund.refundId)).toBe('succeeded')
  })

  it('a failed PayNow refund no longer counts as refunded', async () => {
    const seat = await paidSeat('paynow')
    const refund = await fake.createRefund({
      paymentIntentId: seat.paymentIntentId,
      refundApplicationFee: false,
    })
    fake.settleRefund(refund.refundId, 'failed')
    expect(await fake.retrieveRefund(refund.refundId)).toBe('failed')
    expect(fake.sessions.get(seat.sessionId)?.refundedCents).toBe(0)
    expect(await fake.listRefunds(seat.chargeId)).toEqual([
      expect.objectContaining({ refundId: refund.refundId, status: 'failed' }),
    ])
  })
})

describe('test drivers', () => {
  it("leaves Stripe's fee empty on the first read when it comes late, and fills it after", async () => {
    fake.stripeFeeLate = true
    const { id } = await fake.createCheckoutSession({
      enrollmentId: 'enr_late',
      payoutAccountId: 'pa_1',
      profileId: 'prof_1',
      courseTitle: 'A course',
      courseImageUrl: null,
      amountCents: A,
      currency: 'sgd',
      applicationFeeCents: FEE,
      destinationAccountId: account,
      customerEmail: 'learner@example.com',
      successUrl: 'http://learner.test/ok',
      cancelUrl: 'http://learner.test/no',
      metadata: {},
    })
    fake.completeCheckout(id)
    const pi = fake.sessions.get(id)?.paymentIntentId as string
    expect(await fake.retrievePaymentDetails(pi)).toMatchObject({
      stripeFeeCents: null,
      balanceTransactionId: null,
      transferId: null,
      applicationFeeId: null,
    })
    expect(await fake.retrieveChargeFee(`ch_${pi}`)).toMatchObject({ stripeFeeCents: 1750 })
    fake.setStripeFee(id, null)
    expect(await fake.retrieveChargeFee(`ch_${pi}`)).toBeNull()
    fake.setStripeFee(id, F)
    expect(await fake.retrieveChargeFee(`ch_${pi}`)).toMatchObject({ stripeFeeCents: F })
  })

  it('makes the next call of a method fail once, retryable or final', async () => {
    await paidSeat()
    fake.failNext('retrieveBalance', 'retryable')
    await expect(balance()).rejects.toBeInstanceOf(Stripe.errors.StripeConnectionError)
    expect(await balance()).toEqual({ availableCents: 0, pendingCents: N })
    fake.failNext('createPayout', 'final', 'payouts_not_allowed')
    await expect(
      fake.createPayout({ accountId: account, amountCents: 1, metadata: {}, idempotencyKey: 'x' }),
    ).rejects.toMatchObject({ code: 'payouts_not_allowed' })
  })

  it('a refund with the same key is made once', async () => {
    const seat = await paidSeat()
    const first = await seatRefund(seat, 30000, 0)
    const again = await seatRefund(seat, 30000, 0)
    expect(again).toEqual(first)
    expect(fake.refunds).toHaveLength(1)
    expect(await share()).toBe(N - 30000)
  })
})
