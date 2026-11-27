import { DISPUTE_WINDOW_MS, MAX_HELD_MS, RELEASE_AFTER_MS } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PAYOUT_LABEL } from '../src/providers/payments/types'
import { ReleaseService } from '../src/services/release.service'
import { SeatRefundsService } from '../src/services/seat-refunds.service'
import {
  attendance,
  block,
  buyCourse,
  counted,
  DAY,
  F,
  HOUR,
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
 * Held class money and payouts (docs/designs/scheduled-classes-selling.md, "Held money and the
 * release job", Phase 5 entries 5.1 and 5.10): when a class and its payments are released, the
 * no-attendance review and the day limit, a bank dispute holding one seat, and the payouts: the
 * three bounds, whole payments oldest first, debts, the opening amounts, unnamed money, one a
 * Singapore day from 10:00, a run that dies after Stripe's answer, a refusal and a failure at the
 * bank, a refund after a payout, and Support's corrections.
 *
 * Each test has an app of its own, so one test's accounts are not paid by another's runs. The
 * test clock starts at 12:00 in Singapore.
 */

let t: TestApp
let root: string
let agent: string
let start: number

beforeEach(async () => {
  t = await createTestApp()
  start = t.now().getTime()
  await t.grantRole('root@example.com', 'super_admin')
  root = (await t.signIn('root@example.com', 'support')).token as string
  await t.grantRole('agent@example.com', 'support_agent')
  agent = (await t.signIn('agent@example.com', 'support')).token as string
})
afterEach(async () => {
  await t.close()
})

const at = (ms: number) => new Date(start + ms)
const classOf = async (id: string) => t.db.query.classes.findFirst({ where: { id } })
const paymentOf = async (id: string) => t.db.query.payments.findFirst({ where: { id } })
const payoutsOf = (sell: Seller) =>
  t.db.query.payouts.findMany({
    where: { payoutAccountId: sell.payoutAccountId },
    orderBy: { createdAt: 'asc' },
  })
const stripePayouts = (sell: Seller) => t.payments.moneyOf(sell.accountId).payouts
const overview = async () =>
  (await t.api('GET', '/api/support/payouts/overview', { token: agent })).body.overview
const earnings = async (sell: Seller) =>
  (
    await t.api('GET', `/api/teach/profiles/${sell.profileId}/earnings`, {
      token: await teachToken(t, sell),
    })
  ).body.earnings
const cancel = async (sell: Seller, classId: string) => {
  const res = await t.api(
    'POST',
    `/api/teach/profiles/${sell.profileId}/classes/${classId}/cancel`,
    {
      token: await teachToken(t, sell),
      body: { reason: 'The teacher is unwell.' },
    },
  )
  if (res.status !== 200) throw new Error(`cancel failed: ${JSON.stringify(res.body)}`)
}
const settle = (sell: Seller) => t.payments.settle(sell.accountId)

describe('releasing a class', () => {
  it('releases a class and its payments 7 days after its last block, and not a second earlier', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    t.setClock(at(DAY + 10 * MINUTE))
    await attendance(t, learner, c.classId, c.blockId)
    const due = c.lastEndsAt.getTime() + RELEASE_AFTER_MS

    await run(t, new Date(due - 1000))
    expect((await classOf(c.classId))?.releasedAt).toBeNull()
    expect((await paymentOf(learner.paymentId))?.releasedAt).toBeNull()

    const second = await run(t, new Date(due))
    if (second.status !== 'finished') throw new Error('the run did not finish')
    expect(second.classesReleased).toBe(1)
    expect(await classOf(c.classId)).toMatchObject({
      releasedAt: new Date(due),
      releasedRunId: second.runId,
      releaseReason: 'due',
      reviewNeededAt: null,
    })
    expect(await paymentOf(learner.paymentId)).toMatchObject({
      releasedAt: new Date(due),
      releasedRunId: second.runId,
      releaseReason: 'due',
    })
  })

  it('releases a cancelled class 7 days after the cancellation, once its refunds are done', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell, [block(14)])
    const learner = await seat(t, c.classId)
    await cancel(sell, c.classId)
    const cancelledAt = t.now().getTime()
    // the run sends the refund, which completes the cancellation
    await run(t)
    expect(
      (await t.db.query.classCancellations.findFirst({ where: { classId: c.classId } }))
        ?.completedAt,
    ).not.toBeNull()

    await run(t, new Date(cancelledAt + RELEASE_AFTER_MS - 1000))
    expect((await classOf(c.classId))?.releasedAt).toBeNull()
    await run(t, new Date(cancelledAt + RELEASE_AFTER_MS))
    // nobody attended a cancelled class, but every seat was refunded: no review
    expect(await classOf(c.classId)).toMatchObject({ releaseReason: 'due', reviewNeededAt: null })
    expect(await paymentOf(learner.paymentId)).toMatchObject({ releaseReason: 'due' })
  })

  it('waits while a manual mark is open, and releases once it settles', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    // marked present by hand six days after the class: the mark is open for 7 days
    t.setClock(new Date(c.lastEndsAt.getTime() + 6 * DAY))
    const mark = await attendance(t, learner, c.classId, c.blockId, 'manual_mark')
    await run(t, new Date(c.lastEndsAt.getTime() + RELEASE_AFTER_MS + HOUR))
    expect(await classOf(c.classId)).toMatchObject({ releasedAt: null, reviewNeededAt: null })

    await run(t, new Date(mark.createdAt.getTime() + DISPUTE_WINDOW_MS + MINUTE))
    expect(await classOf(c.classId)).toMatchObject({ releaseReason: 'due' })
    expect((await paymentOf(learner.paymentId))?.releaseReason).toBe('due')
  })

  it('waits while its cancellation has an unfinished refund row', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell, [block(14)])
    const learner = await seat(t, c.classId)
    await cancel(sell, c.classId)
    const row = await t.db.query.seatRefunds.findFirst({
      where: { enrollmentId: learner.enrollmentId },
    })
    if (!row) throw new Error('no seat refund row')
    t.payments.failNext('createRefund', 'final')
    expect(await new SeatRefundsService(t.deps).send(row.id, t.now())).toBe('failed')

    await run(t, at(8 * DAY))
    expect((await classOf(c.classId))?.releasedAt).toBeNull()
    expect((await overview()).openCancellations).toEqual([
      expect.objectContaining({ classId: c.classId, rowsLeft: 1 }),
    ])

    const closed = await t.api('POST', `/api/support/seat-refunds/${row.id}`, {
      token: root,
      body: { action: 'close', reason: 'Refunded by bank transfer.' },
    })
    expect(closed.status).toBe(200)
    await run(t, at(8 * DAY + HOUR))
    expect((await classOf(c.classId))?.releaseReason).toBe('due')
  })

  it('puts a class nobody attended under review, and releases it with support once cleared', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    const due = new Date(c.lastEndsAt.getTime() + RELEASE_AFTER_MS)
    await run(t, due)
    expect(await classOf(c.classId)).toMatchObject({ releasedAt: null, reviewNeededAt: due })
    expect((await overview()).classesUnderReview).toEqual([
      {
        classId: c.classId,
        className: expect.any(String),
        profileName: expect.any(String),
        dueAt: due.toISOString(),
        heldCents: N,
      },
    ])
    expect((await earnings(sell)).heldClasses).toEqual([
      expect.objectContaining({ classId: c.classId, heldCents: N, waitingFor: 'review' }),
    ])

    const path = `/api/support/classes/${c.classId}/clear-review`
    const body = { note: 'The teacher sent the sign-in sheet.' }
    expect((await t.api('POST', path, { token: agent, body })).status).toBe(403)
    expect((await t.api('POST', path, { token: root, body: { note: 'x' } })).status).toBe(400)
    const cleared = await t.api('POST', path, { token: root, body })
    expect(cleared.status).toBe(200)
    expect(cleared.body.review.classId).toBe(c.classId)
    const again = await t.api('POST', path, { token: root, body })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('review_not_needed')
    expect(
      await t.db.query.auditLog.findFirst({
        where: { action: 'class.review_cleared', entityId: c.classId },
      }),
    ).toMatchObject({ metadata: { note: body.note } })

    await run(t, new Date(due.getTime() + HOUR))
    expect(await classOf(c.classId)).toMatchObject({
      releaseReason: 'support',
      reviewNote: body.note,
    })
    expect((await paymentOf(learner.paymentId))?.releaseReason).toBe('support')
    expect((await overview()).classesUnderReview).toEqual([])
  })

  it('releases the payments of a class left under review at 85 days, with day_limit', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    const paidAt = (await paymentOf(learner.paymentId))?.paidAt.getTime() ?? 0
    await run(t, new Date(c.lastEndsAt.getTime() + RELEASE_AFTER_MS))
    await run(t, new Date(paidAt + MAX_HELD_MS - MINUTE))
    expect((await paymentOf(learner.paymentId))?.releasedAt).toBeNull()

    await run(t, new Date(paidAt + MAX_HELD_MS))
    expect(await paymentOf(learner.paymentId)).toMatchObject({ releaseReason: 'day_limit' })
    expect((await classOf(c.classId))?.releasedAt).toBeNull()
    // 85 days on, the morning's session has expired
    agent = (await t.signIn('agent@example.com', 'support')).token as string
    expect((await overview()).dayLimitReleases).toEqual([
      expect.objectContaining({ paymentId: learner.paymentId }),
    ])
  })

  it('keeps a seat with an open bank dispute held after its class is released, until it is won', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const calm = await seat(t, c.classId)
    const disputed = await seat(t, c.classId)
    t.setClock(at(DAY + 10 * MINUTE))
    await attendance(t, calm, c.classId, c.blockId)
    await attendance(t, disputed, c.classId, c.blockId)
    await t.stripeWebhook(t.payments.disputeEvent(disputed.paymentIntentId, 'created'))

    const due = new Date(c.lastEndsAt.getTime() + RELEASE_AFTER_MS)
    await run(t, due)
    expect((await classOf(c.classId))?.releaseReason).toBe('due')
    expect((await paymentOf(calm.paymentId))?.releaseReason).toBe('due')
    expect((await paymentOf(disputed.paymentId))?.releasedAt).toBeNull()

    await t.stripeWebhook(t.payments.disputeEvent(disputed.paymentIntentId, 'won'))
    await run(t, new Date(due.getTime() + HOUR))
    expect(await paymentOf(disputed.paymentId)).toMatchObject({
      bankDisputeStatus: 'won',
      releaseReason: 'due',
    })
  })

  it('never puts a class that sold nothing under review', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    await run(t, new Date(c.lastEndsAt.getTime() + RELEASE_AFTER_MS))
    expect(await classOf(c.classId)).toMatchObject({ releasedAt: null, reviewNeededAt: null })
  })
})

describe('paying a profile', () => {
  it('pays self-paced and released class money in one payout, whole payments oldest first', async () => {
    const sell = await seller(t)
    const sale = await buyCourse(t, sell.courseId)
    t.setClock(at(MINUTE))
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    t.setClock(at(DAY + 10 * MINUTE))
    await attendance(t, learner, c.classId, c.blockId)
    settle(sell)

    const result = await run(t, new Date(c.lastEndsAt.getTime() + RELEASE_AFTER_MS))
    if (result.status !== 'finished') throw new Error('the run did not finish')
    expect(result.payoutsCreated).toBe(1)
    const [payout] = await payoutsOf(sell)
    expect(payout).toMatchObject({
      runId: result.runId,
      outcome: 'paid',
      sendStatus: 'sent',
      payoutStatus: 'pending',
      availableCents: 2 * N,
      pendingCents: 0,
      heldCents: 0,
      limitCents: 2 * N,
      namedCents: 2 * N,
      unnamedCents: 0,
      amountCents: 2 * N,
    })
    expect(stripePayouts(sell)).toEqual([
      {
        payoutId: payout?.stripePayoutId,
        amountCents: 2 * N,
        status: 'pending',
        metadata: { [PAYOUT_LABEL]: payout?.id },
      },
    ])
    for (const id of [sale.paymentId, learner.paymentId]) {
      expect(await paymentOf(id)).toMatchObject({ payoutId: payout?.id, paidOutCents: N })
    }
    expect(
      await t.db.query.auditLog.findFirst({
        where: { action: 'payout.created', entityId: payout?.id },
      }),
    ).toMatchObject({ metadata: { amountCents: 2 * N } })

    const view = await earnings(sell)
    expect(view.payouts).toHaveLength(1)
    expect(view.payouts[0]).toMatchObject({ id: payout?.id, amountCents: 2 * N })
    const className = (await classOf(c.classId))?.name
    expect(view.payouts[0].items.filter((i: { kind: string }) => i.kind === 'payment')).toEqual([
      { kind: 'payment', label: 'Wheel throwing', amountCents: N },
      { kind: 'payment', label: `Wheel throwing: ${className}`, amountCents: N },
    ])
  })

  it('does not pay held money', async () => {
    const sell = await seller(t)
    const sale = await buyCourse(t, sell.courseId)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    settle(sell)
    await run(t)
    const [payout] = await payoutsOf(sell)
    expect(payout).toMatchObject({
      availableCents: 2 * N,
      heldCents: N,
      limitCents: N,
      namedCents: N,
      amountCents: N,
    })
    expect((await paymentOf(sale.paymentId))?.payoutId).toBe(payout?.id)
    expect((await paymentOf(learner.paymentId))?.payoutId).toBeNull()
    const view = await earnings(sell)
    expect(view.heldCents).toBe(N)
    expect(view.heldClasses).toEqual([
      {
        classId: c.classId,
        className: expect.any(String),
        heldCents: N,
        releaseDueAt: new Date(c.lastEndsAt.getTime() + RELEASE_AFTER_MS).toISOString(),
        waitingFor: null,
      },
    ])
  })

  it('stops at the first payment that does not fit, and the one after it waits too', async () => {
    const sell = await seller(t)
    const cheap = await t.createCourse(sell.profileId, { status: 'live', priceCents: 5000 })
    const first = await buyCourse(t, sell.courseId)
    t.setClock(at(MINUTE))
    const second = await buyCourse(t, sell.courseId)
    t.setClock(at(2 * MINUTE))
    const third = await buyCourse(t, cheap.courseId)
    const small = (await paymentOf(third.paymentId))?.teacherNetCents ?? 0
    settle(sell)
    // Room for the first and the third, but the second comes before the third.
    t.payments.moneyOf(sell.accountId).availableCents = N + small
    await run(t)
    const [payout] = await payoutsOf(sell)
    expect(payout).toMatchObject({
      limitCents: N + small,
      namedCents: 2 * N + small,
      unnamedCents: 0,
      amountCents: N,
    })
    expect((await paymentOf(first.paymentId))?.payoutId).toBe(payout?.id)
    expect((await paymentOf(second.paymentId))?.payoutId).toBeNull()
    expect((await paymentOf(third.paymentId))?.payoutId).toBeNull()
  })

  it("takes a cancelled seat's debt from the payout at once", async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell, [block(14)])
    const learner = await seat(t, c.classId)
    const sale = await buyCourse(t, sell.courseId)
    await cancel(sell, c.classId)
    settle(sell)
    await run(t)
    // The seat was refunded in full and the profile bears Stripe's fee: −S$20.00.
    const [payout] = await payoutsOf(sell)
    expect(payout).toMatchObject({ outcome: 'paid', amountCents: N - F, limitCents: N - F })
    expect(await paymentOf(learner.paymentId)).toMatchObject({
      payoutId: payout?.id,
      paidOutCents: -F,
      releasedAt: null,
    })
    expect((await paymentOf(sale.paymentId))?.paidOutCents).toBe(N)
    expect(t.payments.moneyOf(sell.accountId).availableCents).toBe(0)
    // the earnings page names the seat's debt as the refund's Stripe fee, not as a sale
    const className = (await classOf(c.classId))?.name
    expect((await earnings(sell)).payouts[0].items).toEqual([
      expect.objectContaining({
        kind: 'payment',
        label: `Refund on Wheel throwing: ${className}: Stripe’s fee you bear`,
        amountCents: -F,
      }),
      expect.objectContaining({ kind: 'payment', label: 'Wheel throwing', amountCents: N }),
    ])
    // Support's transaction page reads the seat as not released, its debt paid out
    const detail = await t.api('GET', `/api/support/transactions/${learner.paymentId}`, {
      token: agent,
    })
    expect(detail.body.transaction).toMatchObject({
      released: false,
      paidOut: true,
      paidOutCents: -F,
      teacherNetAfterRefundsCents: -F,
    })
  })

  it('pays the opening amounts read when the profile opted in', async () => {
    const sell = await seller(t, { optIn: false })
    const before = await buyCourse(t, sell.courseId)
    settle(sell)
    t.setClock(at(MINUTE))
    await t.optIn(sell.profileId)
    const opening = await t.db.query.payoutAdjustments.findMany({
      where: { payoutAccountId: sell.payoutAccountId },
      orderBy: { kind: 'asc' },
    })
    expect(opening.map((a) => [a.kind, a.amountCents])).toEqual([
      ['opening_available', N],
      ['opening_pending', 0],
    ])
    await run(t)
    const [payout] = await payoutsOf(sell)
    expect(payout).toMatchObject({ amountCents: N, namedCents: N })
    for (const a of await t.db.query.payoutAdjustments.findMany({
      where: { payoutAccountId: sell.payoutAccountId },
    }))
      expect(a.payoutId).toBe(payout?.id)
    // the empty opening pending amount paid nothing, so the earnings page does not list it
    expect((await earnings(sell)).payouts[0].items).toEqual([
      { kind: 'opening_available', label: expect.any(String), amountCents: N },
    ])
    // the sale made before opting in is inside the opening amounts, and is never paid again
    expect((await paymentOf(before.paymentId))?.payoutId).toBeNull()
  })

  it('leaves money no row names unpaid, and records it as unnamed', async () => {
    const sell = await seller(t)
    await buyCourse(t, sell.courseId)
    settle(sell)
    // S$410.12 in the balance that no payment row accounts for (CUJ 11)
    t.payments.moneyOf(sell.accountId).availableCents += N
    await run(t)
    const [payout] = await payoutsOf(sell)
    expect(payout).toMatchObject({
      limitCents: 2 * N,
      namedCents: N,
      unnamedCents: N,
      amountCents: N,
    })
    expect((await overview()).unnamed).toEqual([
      {
        profileName: expect.any(String),
        payoutAccountId: sell.payoutAccountId,
        payDate: payout?.payDate,
        unnamedCents: N,
      },
    ])
  })

  it('records nothing_payable and below_minimum, and marks nothing', async () => {
    const idle = await seller(t)
    const small = await seller(t)
    const path = `/api/support/payout-accounts/${small.payoutAccountId}/corrections`
    const body = { amountCents: 50, reason: 'A fee we owed the profile.' }
    expect((await t.api('POST', path, { token: agent, body })).status).toBe(403)
    expect(
      (await t.api('POST', path, { token: root, body: { ...body, amountCents: 0 } })).status,
    ).toBe(400)
    expect(
      (
        await t.api(
          'POST',
          '/api/support/payout-accounts/00000000-0000-4000-8000-000000000000/corrections',
          { token: root, body },
        )
      ).status,
    ).toBe(404)
    const written = await t.api('POST', path, { token: root, body })
    expect(written.status).toBe(200)
    expect(written.body.adjustment).toMatchObject({ amountCents: 50, reason: body.reason })
    expect(
      await t.db.query.auditLog.findFirst({ where: { action: 'payout.correction' } }),
    ).toMatchObject({ entityId: small.payoutAccountId })
    t.payments.moneyOf(small.accountId).availableCents = 50

    await run(t)
    expect(await payoutsOf(idle)).toEqual([
      expect.objectContaining({ outcome: 'nothing_payable', amountCents: 0, sendStatus: null }),
    ])
    expect(await payoutsOf(small)).toEqual([
      expect.objectContaining({ outcome: 'below_minimum', amountCents: 0, namedCents: 50 }),
    ])
    expect(
      (await t.db.query.payoutAdjustments.findFirst({ where: { id: written.body.adjustment.id } }))
        ?.payoutId,
    ).toBeNull()
    expect(stripePayouts(small)).toEqual([])
  })

  it('pays at most once a Singapore day, and not before 10:00', async () => {
    const sell = await seller(t)
    await buyCourse(t, sell.courseId)
    settle(sell)
    await run(t)
    t.setClock(at(HOUR))
    const later = await buyCourse(t, sell.courseId)
    settle(sell)
    await run(t, at(2 * HOUR))
    expect(await payoutsOf(sell)).toHaveLength(1)
    // 09:59 the next day in Singapore (01:59 UTC), then 10:00
    await run(t, at(DAY - 2 * HOUR - MINUTE))
    expect(await payoutsOf(sell)).toHaveLength(1)
    await run(t, at(DAY - 2 * HOUR))
    const payouts = await payoutsOf(sell)
    expect(payouts.map((p) => [p.payDate, p.amountCents])).toEqual([
      ['2026-11-08', N],
      ['2026-11-09', N],
    ])
    expect((await paymentOf(later.paymentId))?.payoutId).toBe(payouts[1]?.id)
  })

  it('pays once when two runs start together', async () => {
    const sell = await seller(t)
    await buyCourse(t, sell.courseId)
    settle(sell)
    const results = await Promise.all([run(t), run(t)])
    expect(results.map((r) => r.status).sort()).toEqual(['finished', 'locked'])
    expect(await payoutsOf(sell)).toHaveLength(1)
    expect(stripePayouts(sell)).toHaveLength(1)
    expect(await t.db.$count(s.payoutRuns)).toBe(1)
  })

  it('resumes a payout whose run died after Stripe made it, without paying twice', async () => {
    const sell = await seller(t)
    await buyCourse(t, sell.courseId)
    settle(sell)
    await new ReleaseService({
      ...t.deps,
      payments: lostAnswers(t.payments, ['createPayout']),
    }).run(t.now())
    const [stuck] = await payoutsOf(sell)
    expect(stuck).toMatchObject({ outcome: 'paid', sendStatus: 'sending', stripePayoutId: null })
    expect(stuck?.error).toContain('lost the answer')
    expect(stripePayouts(sell)).toHaveLength(1)

    await run(t, at(15 * MINUTE))
    const [sent] = await payoutsOf(sell)
    expect(sent).toMatchObject({
      sendStatus: 'sent',
      stripePayoutId: stripePayouts(sell)[0]?.payoutId,
      error: null,
    })
    expect(stripePayouts(sell)).toHaveLength(1)
  })

  it('finds a payout older than 23 hours by its label instead of sending it again', async () => {
    const sell = await seller(t)
    await buyCourse(t, sell.courseId)
    settle(sell)
    await new ReleaseService({
      ...t.deps,
      payments: lostAnswers(t.payments, ['createPayout']),
    }).run(t.now())
    const watched = counted(t.payments)
    t.setClock(at(DAY))
    await new ReleaseService({ ...t.deps, payments: watched }).run(t.now())
    expect(watched.calls.findPayout).toBe(1)
    expect(watched.calls.createPayout).toBeUndefined()
    const [first] = await payoutsOf(sell)
    expect(first).toMatchObject({
      sendStatus: 'sent',
      stripePayoutId: stripePayouts(sell)[0]?.payoutId,
    })
    expect(stripePayouts(sell)).toHaveLength(1)
  })

  it('clears the marks when Stripe refuses the payout, and tells the owner', async () => {
    const sell = await seller(t)
    const sale = await buyCourse(t, sell.courseId)
    settle(sell)
    t.payments.failNext('createPayout', 'final', 'payouts_not_allowed')
    const result = await run(t)
    const [payout] = await payoutsOf(sell)
    expect(payout).toMatchObject({ outcome: 'failed', sendStatus: null })
    expect(payout?.error).toContain('refused')
    expect(await paymentOf(sale.paymentId)).toMatchObject({ payoutId: null, paidOutCents: null })
    expect(t.mailer.sent.filter((m) => m.to === sell.email).at(-1)?.subject).toContain(
      'did not go through',
    )
    expect(result.status === 'finished' && result.needingAttention).toBe(1)
    expect((await overview()).failedPayouts).toEqual([
      expect.objectContaining({ payoutId: payout?.id, payoutAccountId: sell.payoutAccountId }),
    ])
  })

  it("clears the marks on Stripe's payout.failed, and the next day's payout pays the same items", async () => {
    const sell = await seller(t)
    const sale = await buyCourse(t, sell.courseId)
    settle(sell)
    await run(t)
    const [payout] = await payoutsOf(sell)
    const stripeId = payout?.stripePayoutId as string
    const paid = await t.stripeWebhook(t.payments.payoutEvent(stripeId, 'paid'))
    expect(paid.body.outcome).toBe('applied')
    expect((await payoutsOf(sell))[0]?.payoutStatus).toBe('paid')

    const failed = await t.stripeWebhook(t.payments.payoutEvent(stripeId, 'failed'))
    expect(failed.body.outcome).toBe('applied')
    expect((await payoutsOf(sell))[0]?.payoutStatus).toBe('failed')
    expect((await paymentOf(sale.paymentId))?.payoutId).toBeNull()
    const told = t.mailer.sent.filter((m) => m.subject.includes('did not go through'))
    expect(told).toHaveLength(1)
    // a second notice changes nothing and sends nothing
    const again = await t.stripeWebhook(t.payments.payoutEvent(stripeId, 'failed'))
    expect(again.body.outcome).toBe('ignored')
    expect(t.mailer.sent.filter((m) => m.subject.includes('did not go through'))).toHaveLength(1)

    await run(t, at(DAY))
    const [, next] = await payoutsOf(sell)
    expect(next).toMatchObject({ outcome: 'paid', amountCents: N })
    expect((await paymentOf(sale.paymentId))?.payoutId).toBe(next?.id)
  })

  it('writes an adjustment for a refund after a payout, which the next payout takes', async () => {
    const sell = await seller(t)
    const sale = await buyCourse(t, sell.courseId)
    settle(sell)
    await run(t)
    const refunded = await t.api('POST', `/api/support/transactions/${sale.paymentId}/refund`, {
      token: root,
      body: { reason: 'Bought by mistake' },
    })
    expect(refunded.status).toBe(200)
    const adjustment = await t.db.query.payoutAdjustments.findFirst({
      where: { payoutAccountId: sell.payoutAccountId, kind: 'refund_after_payout' },
    })
    expect(adjustment).toMatchObject({ amountCents: -N, paymentId: sale.paymentId, payoutId: null })
    expect((await earnings(sell)).debtCents).toBe(N)

    await run(t, at(DAY))
    const [, next] = await payoutsOf(sell)
    expect(next).toMatchObject({ outcome: 'nothing_payable', namedCents: -N })
  })

  it('pays nothing to a profile that has not opted in', async () => {
    const sell = await seller(t, { optIn: false })
    await buyCourse(t, sell.courseId)
    settle(sell)
    await run(t)
    expect(await payoutsOf(sell)).toEqual([])
    const view = await earnings(sell)
    expect(view).toMatchObject({ heldCents: 0, heldClasses: [], payouts: [], debtCents: 0 })
  })
})

describe('the opening amounts and a later sale', () => {
  it('counts a sale made after opting in once, beside the opening amounts', async () => {
    const sell = await seller(t, { optIn: false })
    await buyCourse(t, sell.courseId)
    t.setClock(at(MINUTE))
    await t.optIn(sell.profileId)
    t.setClock(at(2 * MINUTE))
    const after = await buyCourse(t, sell.courseId)
    settle(sell)
    await run(t)
    const [payout] = await payoutsOf(sell)
    // the opening pending amount (the first sale) and the second sale
    expect(payout).toMatchObject({ amountCents: 2 * N, namedCents: 2 * N })
    expect((await paymentOf(after.paymentId))?.payoutId).toBe(payout?.id)
  })
})
