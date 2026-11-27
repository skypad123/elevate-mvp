import { RELEASE_AFTER_MS } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ReleaseService } from '../src/services/release.service'
import { SEAT_REFUND_LABEL } from '../src/services/seat-refunds.service'
import {
  A,
  attendance,
  block,
  buyCourse,
  counted,
  DAY,
  FEE,
  lostAnswers,
  MINUTE,
  N,
  newClass,
  run,
  type Seller,
  seat,
  seller,
  teachToken,
} from './helpers/selling'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Bank disputes (docs/designs/scheduled-classes-selling.md, "Bank disputes", Phase 5 entries 5.5,
 * 5.6 and 5.10): opened, won and lost on a class payment before release and after a payout, and
 * on a self-paced one; the reversal that takes the profile's share back, and the fake's balances
 * after it; the seat ended; a refund row that waits, then resumes or closes; a loss delivered
 * twice; and the debt after a payout.
 */

let t: TestApp

beforeEach(async () => {
  t = await createTestApp()
})
afterEach(async () => {
  await t.close()
})

const paymentOf = (id: string) => t.db.query.payments.findFirst({ where: { id } })
const rowsOf = (paymentId: string) =>
  t.db.query.seatRefunds.findMany({ where: { paymentId }, orderBy: { createdAt: 'asc' } })
const enrollmentOf = (id: string) => t.db.query.enrollments.findFirst({ where: { id } })
const balance = (sell: Seller) => t.payments.retrieveBalance(sell.accountId)
const dispute = (paymentIntentId: string, stage: 'created' | 'won' | 'lost') =>
  t.stripeWebhook(t.payments.disputeEvent(paymentIntentId, stage))
const withdraw = (enrollmentId: string, token: string) =>
  t.api('POST', `/api/me/classes/${enrollmentId}/withdraw`, { token })
const reversalsOf = (paymentIntentId: string) =>
  t.payments.reversals.filter((r) => r.transferId === `tr_${paymentIntentId}`)

describe('a bank dispute on a class payment', () => {
  it('records the opening once, and holds the seat', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    const opened = await dispute(learner.paymentIntentId, 'created')
    expect(opened.body.outcome).toBe('applied')
    expect(await paymentOf(learner.paymentId)).toMatchObject({
      bankDisputeId: `dp_${learner.paymentIntentId}`,
      bankDisputeStatus: 'open',
      bankDisputedAt: t.now(),
    })
    const again = await dispute(learner.paymentIntentId, 'created')
    expect(again.body.outcome).toBe('ignored')
    expect((await enrollmentOf(learner.enrollmentId))?.status).toBe('active')
  })

  it('takes the profile’s share back when lost before release, leaving the profile at zero', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: N })
    await dispute(learner.paymentIntentId, 'created')
    const lost = await dispute(learner.paymentIntentId, 'lost')
    expect(lost.body.outcome).toBe('applied')
    expect((await paymentOf(learner.paymentId))?.bankDisputeStatus).toBe('lost')
    expect((await enrollmentOf(learner.enrollmentId))?.status).toBe('refunded')
    const [row] = await rowsOf(learner.paymentId)
    expect(row).toMatchObject({ kind: 'dispute_lost', status: 'pending', reason: null })

    const mailBefore = t.mailer.sent.length
    await run(t)
    const [done] = await rowsOf(learner.paymentId)
    expect(done).toMatchObject({
      status: 'done',
      learnerRefundCents: 0,
      feeRefundToProfileCents: FEE,
    })
    // the whole transfer is taken back with Elevate's fee returned: the profile's net is zero
    expect(reversalsOf(learner.paymentIntentId)).toEqual([
      {
        reversalId: done?.stripeReversalId,
        transferId: `tr_${learner.paymentIntentId}`,
        amountCents: A,
        metadata: { [SEAT_REFUND_LABEL]: done?.id },
      },
    ])
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: 0 })
    // no refund was made, so none is recorded
    expect(t.payments.refunds).toEqual([])
    expect(await t.db.$count(s.refunds)).toBe(0)
    expect((await paymentOf(learner.paymentId))?.refundedCents).toBe(0)
    // the owner is told; the learner, whose bank returned the money, is not
    const told = t.mailer.sent.slice(mailBefore)
    expect(told.map((m) => m.to)).toEqual([sell.email])
    expect(told[0]?.subject).toContain('won a bank dispute')
    expect(await t.db.$count(s.payoutAdjustments)).toBe(2) // the two opening amounts only

    // nothing is held for the seat, and its payment is released with its class
    t.setClock(new Date(t.now().getTime() + DAY + 10 * MINUTE))
    const other = await t.db.query.enrollments.findFirst({ where: { id: learner.enrollmentId } })
    expect(other?.status).toBe('refunded')
    const token = await teachToken(t, sell)
    const earnings = await t.api('GET', `/api/teach/profiles/${sell.profileId}/earnings`, { token })
    expect(earnings.body.earnings).toMatchObject({ heldCents: 0 })
    expect(earnings.body.earnings.totals.netCents).toBe(0)
  })

  it('writes one row when the loss is delivered twice', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    await dispute(learner.paymentIntentId, 'created')
    await dispute(learner.paymentIntentId, 'lost')
    const twice = await dispute(learner.paymentIntentId, 'lost')
    expect(twice.status).toBe(200)
    expect(twice.body.outcome).toBe('ignored')
    expect((await rowsOf(learner.paymentId)).map((r) => r.kind)).toEqual(['dispute_lost'])
    await run(t)
    await dispute(learner.paymentIntentId, 'lost')
    expect(await rowsOf(learner.paymentId)).toHaveLength(1)
    expect(reversalsOf(learner.paymentIntentId)).toHaveLength(1)
  })

  it('takes the share back after a payout, as a debt the next payouts cover', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    t.setClock(new Date(t.now().getTime() + DAY + 10 * MINUTE))
    await attendance(t, learner, c.classId, c.blockId)
    t.payments.settle(sell.accountId)
    await run(t, new Date(c.lastEndsAt.getTime() + RELEASE_AFTER_MS))
    const paid = await paymentOf(learner.paymentId)
    expect(paid).toMatchObject({ releaseReason: 'due', paidOutCents: N })
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: 0 })

    // a month later the learner disputes the payment and the bank decides for them (CUJ 14)
    t.setClock(new Date(t.now().getTime() + 30 * DAY))
    await dispute(learner.paymentIntentId, 'created')
    await dispute(learner.paymentIntentId, 'lost')
    await run(t)
    expect(await balance(sell)).toEqual({ availableCents: -N, pendingCents: 0 })
    const debt = await t.db.query.payoutAdjustments.findFirst({
      where: { kind: 'bank_dispute_after_payout', paymentId: learner.paymentId },
    })
    expect(debt).toMatchObject({ amountCents: -N, payoutAccountId: sell.payoutAccountId })
    const token = await teachToken(t, sell)
    const earnings = await t.api('GET', `/api/teach/profiles/${sell.profileId}/earnings`, { token })
    expect(earnings.body.earnings.debtCents).toBe(N)

    // a later sale is paid only once the debt is covered
    const sale = await buyCourse(t, sell.courseId)
    t.payments.settle(sell.accountId)
    await run(t, new Date(t.now().getTime() + DAY))
    expect((await paymentOf(sale.paymentId))?.payoutId).toBeNull()
    const payouts = await t.db.query.payouts.findMany({
      where: { payoutAccountId: sell.payoutAccountId },
      orderBy: { createdAt: 'desc' },
    })
    expect(payouts[0]).toMatchObject({ outcome: 'nothing_payable', namedCents: 0 })
  })

  it('makes a ready refund row wait, then sends it once the dispute is won', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell, [block(14)])
    const learner = await seat(t, c.classId)
    expect((await withdraw(learner.enrollmentId, learner.token)).status).toBe(200)
    await dispute(learner.paymentIntentId, 'created')
    expect((await rowsOf(learner.paymentId))[0]).toMatchObject({
      kind: 'learner_withdrew',
      status: 'waiting',
      waitingFor: 'bank_dispute',
    })
    await run(t)
    expect((await rowsOf(learner.paymentId))[0]?.status).toBe('waiting')
    expect(t.payments.refunds).toEqual([])

    const won = await dispute(learner.paymentIntentId, 'won')
    expect(won.body.outcome).toBe('applied')
    await run(t, new Date(t.now().getTime() + 15 * MINUTE))
    expect((await rowsOf(learner.paymentId))[0]).toMatchObject({ status: 'done' })
    expect(t.payments.refunds).toHaveLength(1)
  })

  it('closes a waiting refund row when the dispute is lost: the bank returned the money', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell, [block(14)])
    const learner = await seat(t, c.classId)
    expect((await withdraw(learner.enrollmentId, learner.token)).status).toBe(200)
    await dispute(learner.paymentIntentId, 'created')
    await dispute(learner.paymentIntentId, 'lost')
    const rows = await rowsOf(learner.paymentId)
    expect(rows.map((r) => [r.kind, r.status, r.closedReason])).toEqual([
      ['learner_withdrew', 'closed', 'bank_returned'],
      ['dispute_lost', 'pending', null],
    ])
    // the learner withdrew, so the seat stays withdrawn
    expect((await enrollmentOf(learner.enrollmentId))?.status).toBe('cancelled')
    await run(t)
    expect((await rowsOf(learner.paymentId))[1]?.status).toBe('done')
    expect(t.payments.refunds).toEqual([])
    expect(await balance(sell)).toEqual({ availableCents: 0, pendingCents: 0 })
  })

  it('finds a reversal older than 23 hours by its label instead of sending it again', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    await dispute(learner.paymentIntentId, 'created')
    await dispute(learner.paymentIntentId, 'lost')
    await new ReleaseService({
      ...t.deps,
      payments: lostAnswers(t.payments, ['reverseTransfer']),
    }).run(t.now())
    expect(reversalsOf(learner.paymentIntentId)).toHaveLength(1)
    expect((await rowsOf(learner.paymentId))[0]?.status).toBe('pending')

    const watched = counted(t.payments)
    t.setClock(new Date(t.now().getTime() + DAY))
    await new ReleaseService({ ...t.deps, payments: watched }).run(t.now())
    expect(watched.calls.listTransferReversals).toBe(1)
    expect(watched.calls.reverseTransfer).toBeUndefined()
    const [row] = await rowsOf(learner.paymentId)
    expect(row).toMatchObject({
      status: 'done',
      stripeReversalId: reversalsOf(learner.paymentIntentId)[0]?.reversalId,
    })
    expect(reversalsOf(learner.paymentIntentId)).toHaveLength(1)
  })
})

describe('a bank dispute on a self-paced payment', () => {
  it('is recorded and changes nothing else', async () => {
    const sell = await seller(t)
    const sale = await buyCourse(t, sell.courseId)
    await dispute(sale.paymentIntentId, 'created')
    const lost = await dispute(sale.paymentIntentId, 'lost')
    expect(lost.body.outcome).toBe('applied')
    expect(await paymentOf(sale.paymentId)).toMatchObject({ bankDisputeStatus: 'lost' })
    expect(await rowsOf(sale.paymentId)).toEqual([])
    const enrollment = await t.db.query.enrollments.findFirst({
      where: { id: (await paymentOf(sale.paymentId))?.enrollmentId },
    })
    expect(enrollment?.status).toBe('active')
    await run(t)
    expect(t.payments.reversals).toEqual([])
    // Elevate bears it: the profile keeps its share, and is paid it
    t.payments.settle(sell.accountId)
    await run(t, new Date(t.now().getTime() + DAY))
    expect((await paymentOf(sale.paymentId))?.paidOutCents).toBe(N)
  })

  it('answers unmatched for a payment it does not know', async () => {
    const res = await t.stripeWebhook({
      id: 'evt_unknown_dispute',
      type: 'charge.dispute.created',
      data: {
        object: { id: 'dp_x', charge: 'ch_x', payment_intent: 'pi_x', status: 'needs_response' },
      },
    })
    expect(res.body.outcome).toBe('unmatched')
  })
})
