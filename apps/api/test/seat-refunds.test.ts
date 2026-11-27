import { REFUND_MAX_ATTEMPTS } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { translate } from '@elevate/i18n'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SEAT_REFUND_LABEL, SeatRefundsService } from '../src/services/seat-refunds.service'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * The seat refund sender (docs/designs/scheduled-classes-selling.md, "Refunds", Phase 4 entries
 * 4.2, 4.3 and 4.11). Each kind on the S$500 example with Stripe's fee at S$20.00: the Stripe
 * calls, the fake's balances against the amounts table, the ledger row with its fee refund, the
 * enrollment and the emails. Then resuming, failures, PayNow, the 23-hour lookup, the late fee,
 * Support's retry and close, and refunds from outside.
 */

// The amounts table: price A, Elevate's fee C + E, the profile's share N, Stripe's fee F and K.
const A = 50000
const FEE = 8988
const N = 41012
const F = 2000
const K = FEE - F

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

let t: TestApp
let root: string
let n = 0

beforeAll(async () => {
  t = await createTestApp()
  await t.grantRole('root@example.com', 'super_admin')
  root = (await t.signIn('root@example.com', 'support')).token as string
})
afterAll(async () => {
  await t.close()
})

type Seller = Awaited<ReturnType<typeof seller>>

/** A profile of its own, opted in, with a live S$500 course: its fake balance starts at zero. */
async function seller() {
  const email = `seller-${++n}@example.com`
  const { profile } = await t.createProfile(email, { payable: true, displayName: 'Mei Lin' })
  const course = await t.createCourse(profile.id, {
    status: 'live',
    priceCents: A,
    title: 'Wheel throwing',
  })
  await t.optIn(profile.id)
  const account = await t.db.query.payoutAccounts.findFirst({ where: { profileId: profile.id } })
  if (!account?.stripeAccountId) throw new Error('no payout account')
  const token = (await t.signIn(email, 'teach')).token as string
  return {
    email,
    token,
    profileId: profile.id,
    courseId: course.courseId,
    slug: course.slug,
    accountId: account.stripeAccountId,
  }
}

/** A published class two weeks away, unless told otherwise. */
async function newClass(
  sell: Seller,
  blocks = [{ startMs: 14 * DAY, endMs: 14 * DAY + 3 * HOUR }],
) {
  return t.createClass(sell.profileId, sell.courseId, { blocks })
}

/** A paid seat, with Stripe's fee at S$20.00 unless told otherwise. */
async function seat(
  classId: string,
  options: Parameters<TestApp['buySeat']>[2] = {},
): Promise<{
  email: string
  token: string
  enrollmentId: string
  paymentId: string
  paymentIntentId: string
  sessionId: string
}> {
  const email = `learner-${++n}@example.com`
  const bought = await t.buySeat(email, classId, { stripeFeeCents: F, ...options })
  if (!bought.payment?.stripePaymentIntentId) throw new Error('the seat was not paid')
  return {
    email,
    token: bought.token,
    enrollmentId: bought.enrollmentId,
    paymentId: bought.payment.id,
    paymentIntentId: bought.payment.stripePaymentIntentId,
    sessionId: bought.sessionId,
  }
}

const sender = () => new SeatRefundsService(t.deps)
const send = (id: string) => sender().send(id, t.now())
const balance = (sell: Seller) => t.payments.retrieveBalance(sell.accountId)
const rowOf = async (enrollmentId: string) => {
  const row = await t.db.query.seatRefunds.findFirst({
    where: { enrollmentId },
    orderBy: { createdAt: 'desc' },
  })
  if (!row) throw new Error('no seat refund row')
  return row
}
const ledgerOf = (paymentId: string) => t.db.query.refunds.findMany({ where: { paymentId } })
const enrollmentStatus = async (id: string) =>
  (await t.db.query.enrollments.findFirst({ where: { id } }))?.status
const stripeRefunds = (paymentIntentId: string) =>
  t.payments.refunds.filter((r) => r.paymentIntentId === paymentIntentId)
const feeRefunds = (paymentIntentId: string) =>
  t.payments.feeRefunds.filter((r) => r.applicationFeeId === `fee_${paymentIntentId}`)
const mailTo = (email: string) => t.mailer.sent.filter((m) => m.to === email)
const nameOf = async (classId: string) =>
  (await t.db.query.classes.findFirst({ where: { id: classId } }))?.name ?? ''

const withdraw = (enrollmentId: string, token: string) =>
  t.api('POST', `/api/me/classes/${enrollmentId}/withdraw`, { token })
const cancel = (sell: Seller, classId: string) =>
  t.api('POST', `/api/teach/profiles/${sell.profileId}/classes/${classId}/cancel`, {
    token: sell.token,
    body: { reason: 'The teacher is unwell.' },
  })
const discretionary = (sell: Seller, classId: string, enrollmentId: string, amountCents: number) =>
  t.api(
    'POST',
    `/api/teach/profiles/${sell.profileId}/classes/${classId}/learners/${enrollmentId}/refund`,
    { token: sell.token, body: { amountCents, reason: 'The room was too cold.' } },
  )
const rowAction = (id: string, action: 'retry' | 'close') =>
  t.api('POST', `/api/support/seat-refunds/${id}`, {
    token: root,
    body: { action, reason: 'Checked with Stripe.' },
  })

/** The two Stripe calls of a sent row: R with Elevate's fee kept, then X of the fee. */
function expectStripeCalls(paymentIntentId: string, rowId: string, r: number, x: number) {
  const refunds = stripeRefunds(paymentIntentId)
  expect(refunds.map((f) => [f.amountCents, f.metadata[SEAT_REFUND_LABEL]])).toEqual([[r, rowId]])
  const fees = feeRefunds(paymentIntentId)
  expect(fees.map((f) => [f.amountCents, f.metadata[SEAT_REFUND_LABEL]])).toEqual(
    x > 0 ? [[x, rowId]] : [],
  )
}

/** The row done, one ledger row carrying R, X and the row, and the payment's refunded total. */
async function expectRecorded(paymentId: string, rowId: string, r: number, x: number) {
  const row = await t.db.query.seatRefunds.findFirst({ where: { id: rowId } })
  expect(row).toMatchObject({
    status: 'done',
    learnerRefundCents: r,
    feeRefundToProfileCents: x,
    completedAt: t.now(),
  })
  const ledger = await ledgerOf(paymentId)
  expect(ledger.map((l) => [l.amountCents, l.applicationFeeRefundedCents, l.seatRefundId])).toEqual(
    [[r, x, rowId]],
  )
  expect(ledger[0]?.stripeRefundId).toBe(row?.stripeRefundId)
  const payment = await t.db.query.payments.findFirst({ where: { id: paymentId } })
  expect(payment).toMatchObject({
    refundedCents: r,
    status: r === A ? 'refunded' : 'partially_refunded',
  })
}

describe('each kind on the S$500 example, Stripe’s fee at S$20.00', () => {
  it('learner_withdrew returns S$480.00 and leaves the profile at zero', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    await t.db.update(s.users).set({ locale: 'zh' }).where(eq(s.users.email, learner.email))
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: N })
    const res = await withdraw(learner.enrollmentId, learner.token)
    expect(res.status).toBe(200)
    // the seat is free in the same request, and nothing has gone to Stripe
    expect(await enrollmentStatus(learner.enrollmentId)).toBe('cancelled')
    expect(stripeRefunds(learner.paymentIntentId)).toEqual([])
    const row = await rowOf(learner.enrollmentId)
    expect(row).toMatchObject({ kind: 'learner_withdrew', status: 'pending' })

    t.mailer.sent.length = 0
    expect(await send(row.id)).toBe('done')
    expectStripeCalls(learner.paymentIntentId, row.id, A - F, K)
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: 0 })
    await expectRecorded(learner.paymentId, row.id, A - F, K)
    expect(await enrollmentStatus(learner.enrollmentId)).toBe('cancelled')
    // the learner in their language, the owner in English
    const className = await nameOf(classId)
    expect(mailTo(learner.email).map((m) => m.subject)).toEqual([
      translate('zh', 'email.seatWithdrawn.title', { className }),
    ])
    expect(mailTo(learner.email)[0]?.text).toContain(
      translate('zh', 'email.seatWithdrawn.refundedLessFee', { amount: 'S$480.00' }),
    )
    expect(mailTo(sell.email).map((m) => m.subject)).toEqual([
      expect.stringMatching(/^A refund for ".+" was made$/),
    ])
    expect(mailTo(sell.email)[0]?.text).toContain('S$480.00')
    expect(mailTo(sell.email)[0]?.text).toContain('S$69.88')
  })

  it('changed_withdrew returns S$500.00 and leaves the profile S$20.00 down', async () => {
    const sell = await seller()
    // three days away: only the changed class gives a way out
    const { classId } = await newClass(sell, [{ startMs: 3 * DAY, endMs: 3 * DAY + HOUR }])
    const learner = await seat(classId)
    await t.db
      .update(s.enrollments)
      .set({ classChangedAt: t.now() })
      .where(eq(s.enrollments.id, learner.enrollmentId))
    expect((await withdraw(learner.enrollmentId, learner.token)).status).toBe(200)
    expect(await enrollmentStatus(learner.enrollmentId)).toBe('refunded')
    const row = await rowOf(learner.enrollmentId)
    expect(row.kind).toBe('changed_withdrew')
    expect(await send(row.id)).toBe('done')
    expectStripeCalls(learner.paymentIntentId, row.id, A, K)
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: -F })
    await expectRecorded(learner.paymentId, row.id, A, K)
    expect(mailTo(learner.email).at(-1)?.text).toContain(
      translate('en', 'email.seatWithdrawn.refundedFull', { amount: 'S$500.00' }),
    )
  })

  it('teacher_cancelled returns S$500.00 and leaves the profile S$20.00 down', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    expect((await cancel(sell, classId)).status).toBe(200)
    expect(await enrollmentStatus(learner.enrollmentId)).toBe('refunded')
    const row = await rowOf(learner.enrollmentId)
    expect(row).toMatchObject({ kind: 'teacher_cancelled', status: 'pending' })
    expect(await send(row.id)).toBe('done')
    expectStripeCalls(learner.paymentIntentId, row.id, A, K)
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: -F })
    await expectRecorded(learner.paymentId, row.id, A, K)
    expect(mailTo(learner.email).at(-1)?.text).toContain(
      translate('en', 'email.classCancelled.refunded', { amount: 'S$500.00' }),
    )
    // the cancellation is complete once its only row is done
    const cancellation = await t.db.query.classCancellations.findFirst({ where: { classId } })
    expect(cancellation?.completedAt).toEqual(t.now())
  })

  it('teacher_cancelled_part returns S$400.00 and S$55.90 of the fee after one of five blocks', async () => {
    const sell = await seller()
    const { classId, blockIds } = await newClass(
      sell,
      [10, 11, 12, 13, 14].map((d) => ({ startMs: d * DAY, endMs: d * DAY + 2 * HOUR })),
    )
    const learner = await seat(classId)
    const start = t.now()
    t.advanceClock(10 * DAY + HOUR)
    const user = await t.ensureUser(learner.email)
    await t.db.insert(s.attendanceEvents).values({
      classId,
      blockId: blockIds[0] as string,
      enrollmentId: learner.enrollmentId,
      learnerUserId: user.id,
      type: 'check_in',
      actorUserId: user.id,
      actorRole: 'learner',
      method: 'typed_code',
      locationStatus: 'ok',
      accuracyM: 10,
      distanceM: 5,
      requestId: 'fixture',
      createdAt: t.now(),
    })
    try {
      // a fresh sign-in, as the route asks for
      sell.token = (await t.signIn(sell.email, 'teach')).token as string
      expect((await cancel(sell, classId)).status).toBe(200)
      const cancellation = await t.db.query.classCancellations.findFirst({ where: { classId } })
      expect(cancellation).toMatchObject({ blocksTotal: 5, blocksUntaught: 4, afterStart: true })
      const row = await rowOf(learner.enrollmentId)
      expect(row).toMatchObject({ kind: 'teacher_cancelled_part', status: 'pending' })
      // the learner attended, so the seat stays theirs
      expect(await enrollmentStatus(learner.enrollmentId)).toBe('active')
      expect(await send(row.id)).toBe('done')
      expectStripeCalls(learner.paymentIntentId, row.id, 40000, 5590)
      expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: N - 40000 + 5590 })
      await expectRecorded(learner.paymentId, row.id, 40000, 5590)
      expect(await enrollmentStatus(learner.enrollmentId)).toBe('active')
      expect(mailTo(learner.email).at(-1)?.text).toContain(
        translate('en', 'email.classCancelled.refundedPart', { amount: 'S$400.00' }),
      )
    } finally {
      t.setClock(start)
    }
  })

  it('discretionary S$300.00 returns S$41.92 of the fee; the profile keeps S$152.04', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    const res = await discretionary(sell, classId, learner.enrollmentId, 30000)
    expect(res.status).toBe(200)
    expect(res.body.seat).toMatchObject({ status: 'active', canRefundUpToCents: 0 })
    const row = await rowOf(learner.enrollmentId)
    expect(row).toMatchObject({ kind: 'discretionary', requestedCents: 30000, status: 'pending' })
    expect(await send(row.id)).toBe('done')
    expectStripeCalls(learner.paymentIntentId, row.id, 30000, 4192)
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: 15204 })
    await expectRecorded(learner.paymentId, row.id, 30000, 4192)
    expect(await enrollmentStatus(learner.enrollmentId)).toBe('active')
    const mail = mailTo(learner.email).at(-1)
    expect(mail?.text).toContain('S$300.00')
    expect(mail?.text).toContain('The room was too cold.')
    expect(mail?.text).toContain(translate('en', 'email.seatRefunded.kept'))
  })

  it('elevate_cancelled returns S$500.00 and the whole of Elevate’s fee; the profile ends at zero', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    const res = await t.api('POST', `/api/support/classes/${classId}/cancel`, {
      token: root,
      body: { ground: 'teacher_absent', note: 'The teacher told us they cannot come.' },
    })
    expect(res.status).toBe(200)
    expect(res.body.class.id).toBe(classId)
    const owner = mailTo(sell.email).at(-1)
    expect(owner?.subject).toMatch(/^Elevate cancelled ".+"$/)
    expect(owner?.text).toContain('the teacher did not turn up, or cannot teach the class')
    expect(owner?.text).toContain('The teacher told us they cannot come.')
    const row = await rowOf(learner.enrollmentId)
    expect(row).toMatchObject({ kind: 'elevate_cancelled', status: 'pending' })
    expect(await send(row.id)).toBe('done')
    expectStripeCalls(learner.paymentIntentId, row.id, A, FEE)
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: 0 })
    await expectRecorded(learner.paymentId, row.id, A, FEE)
    expect(await enrollmentStatus(learner.enrollmentId)).toBe('refunded')
  })

  it('seat_lost returns S$500.00 and the whole of Elevate’s fee, and sends the lost-seat email', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const email = `learner-${++n}@example.com`
    const started = await t.buySeat(email, classId, { pay: false })
    await t.db
      .update(s.classes)
      .set({ status: 'cancelled', cancelledAt: t.now() })
      .where(eq(s.classes.id, classId))
    t.payments.setStripeFee(started.sessionId, F)
    expect((await t.stripeWebhook(t.payments.completeCheckout(started.sessionId))).status).toBe(200)
    const payment = await t.db.query.payments.findFirst({
      where: { stripeCheckoutSessionId: started.sessionId },
    })
    if (!payment?.stripePaymentIntentId) throw new Error('no payment')
    const row = await rowOf(started.enrollmentId)
    expect(row.kind).toBe('seat_lost')
    expect(await send(row.id)).toBe('done')
    expectStripeCalls(payment.stripePaymentIntentId, row.id, A, FEE)
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: 0 })
    await expectRecorded(payment.id, row.id, A, FEE)
    expect(await enrollmentStatus(started.enrollmentId)).toBe('pending_payment')
    expect(mailTo(email).at(-1)?.text).toContain(
      translate('en', 'email.seatLost.refunded', { amount: 'S$500.00' }),
    )
  })
})

describe('sending a row', () => {
  it('resumes from pending after a failure the next run may not meet, sending the refund once', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    await withdraw(learner.enrollmentId, learner.token)
    const row = await rowOf(learner.enrollmentId)
    t.payments.failNext('createRefund', 'retryable')
    expect(await send(row.id)).toBe('pending')
    expect(await rowOf(learner.enrollmentId)).toMatchObject({
      status: 'pending',
      attempts: 1,
      error: expect.stringContaining('could not connect'),
    })
    expect(stripeRefunds(learner.paymentIntentId)).toEqual([])
    expect(await send(row.id)).toBe('done')
    expectStripeCalls(learner.paymentIntentId, row.id, A - F, K)
    expect((await rowOf(learner.enrollmentId)).attempts).toBe(2)
  })

  it('resumes from refund_sent; Stripe’s notice between the two calls records nothing and sends no email', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    await withdraw(learner.enrollmentId, learner.token)
    const row = await rowOf(learner.enrollmentId)
    t.payments.failNext('refundApplicationFee', 'retryable')
    t.mailer.sent.length = 0
    expect(await send(row.id)).toBe('refund_sent')
    expect(stripeRefunds(learner.paymentIntentId)).toHaveLength(1)
    expect(feeRefunds(learner.paymentIntentId)).toEqual([])
    // Stripe's charge.refunded for the job's own refund arrives now
    const hook = await t.stripeWebhook(t.payments.refundedEvent(learner.paymentIntentId))
    expect(hook.status).toBe(200)
    expect(await ledgerOf(learner.paymentId)).toEqual([])
    expect(t.mailer.sent).toEqual([])
    expect(await send(row.id)).toBe('done')
    expectStripeCalls(learner.paymentIntentId, row.id, A - F, K)
    await expectRecorded(learner.paymentId, row.id, A - F, K)
    expect(mailTo(learner.email)).toHaveLength(1)
    // and once more after it is done: still one row, one email
    expect((await t.stripeWebhook(t.payments.refundedEvent(learner.paymentIntentId))).status).toBe(
      200,
    )
    expect(await ledgerOf(learner.paymentId)).toHaveLength(1)
    expect(mailTo(learner.email)).toHaveLength(1)
  })

  it('makes a row Stripe refuses failed, which the job does not take again until Support retries it', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    await withdraw(learner.enrollmentId, learner.token)
    const row = await rowOf(learner.enrollmentId)
    t.payments.failNext('createRefund', 'final', 'fake_refused')
    expect(await send(row.id)).toBe('failed')
    expect(await sender().sendUnfinished(t.now())).toEqual({ done: 0 })
    expect(await rowOf(learner.enrollmentId)).toMatchObject({ status: 'failed', attempts: 1 })
    expect(stripeRefunds(learner.paymentIntentId)).toEqual([])
    // the seat is gone, so a second withdrawal finds nothing
    expect((await withdraw(learner.enrollmentId, learner.token)).status).toBe(404)

    const retried = await rowAction(row.id, 'retry')
    expect(retried.status).toBe(200)
    expect(retried.body.seatRefund).toMatchObject({ status: 'pending' })
    expect(await rowOf(learner.enrollmentId)).toMatchObject({ attempts: 0, error: null })
    expect(await sender().sendUnfinished(t.now())).toEqual({ done: 1 })
    expectStripeCalls(learner.paymentIntentId, row.id, A - F, K)
    // a row that is not failed is neither retried nor closed
    for (const action of ['retry', 'close'] as const) {
      const res = await rowAction(row.id, action)
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('refund_not_failed')
    }
    const audit = await t.db.query.auditLog.findMany({ where: { action: 'seat.refund_retried' } })
    expect(audit.map((a) => a.entityId)).toContain(learner.enrollmentId)
  })

  it(`makes the ${REFUND_MAX_ATTEMPTS}th attempt failed`, async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    await withdraw(learner.enrollmentId, learner.token)
    const row = await rowOf(learner.enrollmentId)
    await t.db
      .update(s.seatRefunds)
      .set({ attempts: REFUND_MAX_ATTEMPTS - 2 })
      .where(eq(s.seatRefunds.id, row.id))
    t.payments.failNext('createRefund', 'retryable')
    expect(await send(row.id)).toBe('pending')
    t.payments.failNext('createRefund', 'retryable')
    expect(await send(row.id)).toBe('failed')
    expect(await rowOf(learner.enrollmentId)).toMatchObject({
      status: 'failed',
      attempts: REFUND_MAX_ATTEMPTS,
    })
  })

  it('waits on a pending PayNow refund: no fee refund, no ledger row and no email until it succeeds', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId, { method: 'paynow' })
    await withdraw(learner.enrollmentId, learner.token)
    const row = await rowOf(learner.enrollmentId)
    t.mailer.sent.length = 0
    expect(await send(row.id)).toBe('refund_sent')
    expect(await send(row.id)).toBe('refund_sent')
    expect(stripeRefunds(learner.paymentIntentId).map((r) => r.status)).toEqual(['pending'])
    expect(feeRefunds(learner.paymentIntentId)).toEqual([])
    expect(await ledgerOf(learner.paymentId)).toEqual([])
    expect(t.mailer.sent).toEqual([])
    const refundId = (await rowOf(learner.enrollmentId)).stripeRefundId as string
    t.payments.settleRefund(refundId, 'succeeded')
    expect(await send(row.id)).toBe('done')
    expectStripeCalls(learner.paymentIntentId, row.id, A - F, K)
    await expectRecorded(learner.paymentId, row.id, A - F, K)
    expect(mailTo(learner.email)).toHaveLength(1)
  })

  it('makes a row whose PayNow refund fails failed; Support closes it, and cannot retry it', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId, { method: 'paynow' })
    await withdraw(learner.enrollmentId, learner.token)
    const row = await rowOf(learner.enrollmentId)
    expect(await send(row.id)).toBe('refund_sent')
    t.payments.settleRefund((await rowOf(learner.enrollmentId)).stripeRefundId as string, 'failed')
    t.mailer.sent.length = 0
    expect(await send(row.id)).toBe('failed')
    expect(await rowOf(learner.enrollmentId)).toMatchObject({
      status: 'failed',
      error: 'refund_failed',
    })
    expect(feeRefunds(learner.paymentIntentId)).toEqual([])
    expect(await ledgerOf(learner.paymentId)).toEqual([])
    expect(t.mailer.sent).toEqual([])
    const retry = await rowAction(row.id, 'retry')
    expect(retry.status).toBe(409)
    expect(retry.body.error.code).toBe('refund_failed_at_stripe')
    const closed = await rowAction(row.id, 'close')
    expect(closed.status).toBe(200)
    expect(closed.body.seatRefund).toMatchObject({ status: 'closed', closedReason: 'support' })
    expect(await sender().sendUnfinished(t.now())).toEqual({ done: 0 })
  })

  it('finds a step older than 23 hours at Stripe by its label and does not send it again', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    await withdraw(learner.enrollmentId, learner.token)
    const row = await rowOf(learner.enrollmentId)
    // a run sent the refund a day ago and stopped before storing its id
    await t.payments.createRefund({
      paymentIntentId: learner.paymentIntentId,
      amountCents: A - F,
      refundApplicationFee: false,
      metadata: { [SEAT_REFUND_LABEL]: row.id },
      idempotencyKey: 'an-earlier-run',
    })
    await t.db
      .update(s.seatRefunds)
      .set({ attempts: 1, firstAttemptAt: new Date(t.now().getTime() - 24 * HOUR) })
      .where(eq(s.seatRefunds.id, row.id))
    expect(await send(row.id)).toBe('done')
    expectStripeCalls(learner.paymentIntentId, row.id, A - F, K)
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: 0 })
  })

  it('refuses a second unfinished row for one seat', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    const res = await discretionary(sell, classId, learner.enrollmentId, 10000)
    expect(res.status).toBe(200)
    const again = await discretionary(sell, classId, learner.enrollmentId, 10000)
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('refund_in_progress')
    await expect(
      t.db.transaction((tx) =>
        sender().request(tx as unknown as TestApp['deps']['db'], {
          enrollmentId: learner.enrollmentId,
          paymentId: learner.paymentId,
          classId,
          kind: 'teacher_cancelled',
        }),
      ),
    ).rejects.toMatchObject({ code: 'refund_in_progress' })
    expect(
      await t.db.query.seatRefunds.findMany({ where: { enrollmentId: learner.enrollmentId } }),
    ).toHaveLength(1)
  })

  it('waits for Stripe’s fee, and sends the row once the fee is recorded', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId, { stripeFeeCents: null })
    expect(
      (await t.db.query.payments.findFirst({ where: { id: learner.paymentId } }))
        ?.stripeFeeActualCents,
    ).toBeNull()
    await withdraw(learner.enrollmentId, learner.token)
    const row = await rowOf(learner.enrollmentId)
    expect(row).toMatchObject({ status: 'waiting', waitingFor: 'stripe_fee' })
    // the learner is shown a rate until then
    const mine = await t.api('GET', '/api/me/classes', { token: learner.token })
    expect(mine.body.items[0].seat.refund).toMatchObject({ status: 'waiting' })
    expect(await send(row.id)).toBe('waiting')
    expect(stripeRefunds(learner.paymentIntentId)).toEqual([])
    t.payments.setStripeFee(learner.sessionId, F)
    expect(await send(row.id)).toBe('done')
    const payment = await t.db.query.payments.findFirst({ where: { id: learner.paymentId } })
    expect(payment).toMatchObject({
      stripeFeeActualCents: F,
      stripeApplicationFeeId: `fee_${learner.paymentIntentId}`,
    })
    expectStripeCalls(learner.paymentIntentId, row.id, A - F, K)
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: 0 })
  })

  it('writes a refund_after_payout adjustment of X − R for a payment a payout has counted', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    // the payment counts as inside the opening amounts
    await t.db
      .update(s.payoutAccounts)
      .set({ manualSince: new Date(t.now().getTime() + MINUTE) })
      .where(eq(s.payoutAccounts.profileId, sell.profileId))
    await discretionary(sell, classId, learner.enrollmentId, 30000)
    const row = await rowOf(learner.enrollmentId)
    expect(await send(row.id)).toBe('done')
    const adjustments = await t.db.query.payoutAdjustments.findMany({
      where: { paymentId: learner.paymentId },
    })
    expect(adjustments.map((a) => [a.kind, a.amountCents])).toEqual([
      ['refund_after_payout', 4192 - 30000],
    ])
  })
})

describe('refunds from outside', () => {
  it('frees the seat on Support’s full refund and counts it once', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    const res = await t.api('POST', `/api/support/transactions/${learner.paymentId}/refund`, {
      token: root,
      body: { reason: 'Asked by the learner.' },
    })
    expect(res.status).toBe(200)
    expect(await enrollmentStatus(learner.enrollmentId)).toBe('refunded')
    expect((await t.stripeWebhook(t.payments.refundedEvent(learner.paymentIntentId))).status).toBe(
      200,
    )
    const ledger = await ledgerOf(learner.paymentId)
    expect(ledger.map((l) => [l.amountCents, l.applicationFeeRefundedCents])).toEqual([[A, null]])
    expect(
      await t.db.query.seatRefunds.findMany({ where: { enrollmentId: learner.enrollmentId } }),
    ).toEqual([])
    // the course's enrol count is the self-paced one
    const course = await t.db.query.courses.findFirst({ where: { id: sell.courseId } })
    expect(course?.enrolCount).toBe(0)
  })

  it('frees the seat on a full refund in the Stripe dashboard, and not on a part one', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const part = await seat(classId)
    await t.payments.createRefund({ paymentIntentId: part.paymentIntentId, amountCents: 10000 })
    expect((await t.stripeWebhook(t.payments.refundedEvent(part.paymentIntentId))).status).toBe(200)
    expect(await enrollmentStatus(part.enrollmentId)).toBe('active')
    expect((await ledgerOf(part.paymentId)).map((l) => l.amountCents)).toEqual([10000])

    const full = await seat(classId)
    await t.payments.createRefund({ paymentIntentId: full.paymentIntentId })
    expect((await t.stripeWebhook(t.payments.refundedEvent(full.paymentIntentId))).status).toBe(200)
    expect(await enrollmentStatus(full.enrollmentId)).toBe('refunded')
    expect((await ledgerOf(full.paymentId)).map((l) => l.amountCents)).toEqual([A])
  })

  it('shows a class payment’s seat and its refund rows on Support’s transaction page', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    await withdraw(learner.enrollmentId, learner.token)
    const res = await t.api('GET', `/api/support/transactions/${learner.paymentId}`, {
      token: root,
    })
    expect(res.status).toBe(200)
    const detail = res.body.transaction
    expect(detail).toMatchObject({
      class: { id: classId },
      seatStatus: 'cancelled',
      bankDisputeStatus: null,
      released: false,
      paidOut: false,
    })
    expect(detail.seatRefunds.map((r: { kind: string }) => r.kind)).toEqual(['learner_withdrew'])
  })

  it('refuses Support’s refund while the seat has an unfinished row', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    await withdraw(learner.enrollmentId, learner.token)
    const res = await t.api('POST', `/api/support/transactions/${learner.paymentId}/refund`, {
      token: root,
      body: { reason: 'Asked by the learner.' },
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('refund_in_progress')
    expect(stripeRefunds(learner.paymentIntentId)).toEqual([])
  })
})
