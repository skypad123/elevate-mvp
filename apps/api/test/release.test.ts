import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Logger } from '../src/lib/logger'
import { ReleaseService, type ReleaseSteps } from '../src/services/release.service'
import {
  attendance,
  block,
  buyCourse,
  DAY,
  F,
  HOUR,
  lostAnswers,
  MINUTE,
  N,
  newClass,
  run,
  seat,
  seller,
  teachToken,
} from './helpers/selling'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * The release job's run (docs/designs/scheduled-classes-selling.md, "One run", Phase 5 entries
 * 5.2, 5.3 and 5.9): the order of its steps, a step that throws, the lock, the log line the
 * alarms read, what needs attention, a run that stops part-way followed by one that sends nothing
 * twice, and the dev-only route that runs it inside the API.
 */

let t: TestApp

beforeEach(async () => {
  t = await createTestApp()
})
afterEach(async () => {
  await t.close()
})

/** A logger that keeps what it is given. */
function recordingLogger() {
  const lines: { level: string; msg: string; data?: Record<string, unknown> }[] = []
  const at =
    (level: string) =>
    (msg: string, data?: Record<string, unknown>): void => {
      lines.push({ level, msg, data })
    }
  const log: Logger = { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') }
  return { log, lines }
}

/** Steps that record their names, in place of the services. */
function recordingSteps(order: string[], overrides: Partial<ReleaseSteps> = {}): ReleaseSteps {
  const note =
    <T>(name: string, answer: T) =>
    async () => {
      order.push(name)
      return answer
    }
  return {
    finishStale: note('finishStale', 0),
    fillStripeFees: note('fillStripeFees', 0),
    sendUnfinished: note('sendUnfinished', { done: 2 }),
    markReleased: note('markReleased', { classesReleased: 3 }),
    resumeSending: note('resumeSending', null),
    payDue: note('payDue', { payoutsCreated: 4 }),
    finishLeaving: note('finishLeaving', 0),
    ...overrides,
  }
}

describe('one run', () => {
  it('runs its steps in order and writes one log line with its counts', async () => {
    const order: string[] = []
    const { log, lines } = recordingLogger()
    const result = await new ReleaseService(
      { ...t.deps, log },
      { steps: recordingSteps(order) },
    ).run(t.now())
    expect(order).toEqual([
      'finishStale',
      'fillStripeFees',
      'sendUnfinished',
      'markReleased',
      'resumeSending',
      'payDue',
      'finishLeaving',
    ])
    if (result.status !== 'finished') throw new Error('the run did not finish')
    expect(result).toMatchObject({
      refundsSent: 2,
      classesReleased: 3,
      payoutsCreated: 4,
      needingAttention: 0,
      error: null,
    })
    const finished = lines.filter((l) => l.data?.event === 'release_run_finished')
    expect(finished).toEqual([
      {
        level: 'info',
        msg: 'release run finished',
        data: {
          event: 'release_run_finished',
          runId: result.runId,
          refundsSent: 2,
          classesReleased: 3,
          payoutsCreated: 4,
          needingAttention: 0,
        },
      },
    ])
    expect(await t.db.query.payoutRuns.findFirst({ where: { id: result.runId } })).toMatchObject({
      startedAt: t.now(),
      finishedAt: t.now(),
      error: null,
      refundsSent: 2,
      classesReleased: 3,
      payoutsCreated: 4,
      needingAttention: 0,
    })
  })

  it('records a step that throws and still runs the later steps', async () => {
    const order: string[] = []
    const { log, lines } = recordingLogger()
    const result = await new ReleaseService(
      { ...t.deps, log },
      {
        steps: recordingSteps(order, {
          sendUnfinished: async () => {
            order.push('sendUnfinished')
            throw new Error('the database went away')
          },
        }),
      },
    ).run(t.now())
    expect(order).toEqual([
      'finishStale',
      'fillStripeFees',
      'sendUnfinished',
      'markReleased',
      'resumeSending',
      'payDue',
      'finishLeaving',
    ])
    if (result.status !== 'finished') throw new Error('the run did not finish')
    expect(result.refundsSent).toBe(0)
    expect(result.needingAttention).toBe(1)
    expect(result.error).toBe('sendUnfinished: the database went away')
    expect((await t.db.query.payoutRuns.findFirst({ where: { id: result.runId } }))?.error).toBe(
      'sendUnfinished: the database went away',
    )
    expect(lines.some((l) => l.level === 'error' && l.data?.step === 'sendUnfinished')).toBe(true)
    expect(lines.filter((l) => l.data?.event === 'release_run_finished')).toHaveLength(1)
  })

  it('returns at once while another run holds the lock, and runs again once it is free', async () => {
    let free: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      free = resolve
    })
    const order: string[] = []
    const slow = new ReleaseService(t.deps, {
      steps: recordingSteps(order, {
        finishStale: async () => {
          order.push('finishStale')
          await held
        },
      }),
    })
    const first = slow.run(t.now())
    await new Promise((resolve) => setTimeout(resolve, 20))
    const { log, lines } = recordingLogger()
    const second = await new ReleaseService({ ...t.deps, log }).run(t.now())
    expect(second).toEqual({ status: 'locked' })
    expect(lines.map((l) => l.data?.event)).toEqual(['release_run_locked'])
    free()
    expect((await first).status).toBe('finished')
    expect(await t.db.$count(s.payoutRuns)).toBe(1)
    expect((await new ReleaseService(t.deps).run(t.now())).status).toBe('finished')
  })

  it('writes a run row and nothing else when no profile has opted in', async () => {
    const audit = await t.db.$count(s.auditLog)
    const result = await run(t)
    expect(result).toMatchObject({
      status: 'finished',
      refundsSent: 0,
      classesReleased: 0,
      payoutsCreated: 0,
      needingAttention: 0,
      error: null,
    })
    expect(await t.db.$count(s.payoutRuns)).toBe(1)
    expect(await t.db.$count(s.payouts)).toBe(0)
    expect(await t.db.$count(s.payoutAdjustments)).toBe(0)
    expect(await t.db.$count(s.auditLog)).toBe(audit)
  })

  it('finishes an opt-in left at switching, and fills in a late Stripe fee', async () => {
    const sell = await seller(t, { optIn: false })
    t.payments.failNext('setManualPayouts', 'retryable')
    const token = (await t.signIn(sell.email, 'teach')).token as string
    const accepted = await t.api(
      'POST',
      `/api/teach/profiles/${sell.profileId}/class-sales/accept`,
      {
        token,
        body: { termsVersion: '2026-12' },
      },
    )
    expect(accepted.body.classSales.payoutMode).toBe('switching')
    // a sale whose fee Stripe had not filled when it was recorded
    const sale = await buyCourse(t, sell.courseId)
    await t.db
      .update(s.payments)
      .set({ stripeFeeActualCents: null, platformNetCents: null })
      .where(eq(s.payments.id, sale.paymentId))

    await run(t, new Date(t.now().getTime() + 10 * MINUTE))
    const account = await t.db.query.payoutAccounts.findFirst({
      where: { id: sell.payoutAccountId },
    })
    expect(account?.payoutMode).toBe('manual')
    expect(await t.db.query.payments.findFirst({ where: { id: sale.paymentId } })).toMatchObject({
      stripeFeeActualCents: F,
      platformNetCents: 8988 - F,
    })
  })
})

describe('what needs attention', () => {
  it('counts failed rows, rows not sent for a day, and payouts that failed or are stuck', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell, [block(14)])
    const seats = []
    for (let i = 0; i < 6; i++) seats.push(await seat(t, c.classId))
    const now = t.now().getTime()
    const old = new Date(now - 25 * HOUR)
    const recent = new Date(now - HOUR)
    const rows: Array<Partial<typeof s.seatRefunds.$inferInsert>> = [
      { status: 'failed', createdAt: recent },
      { status: 'pending', createdAt: old },
      { status: 'waiting', waitingFor: 'stripe_fee', createdAt: old },
      // waits for weeks by design: not counted
      { status: 'waiting', waitingFor: 'manual_mark', createdAt: old },
      { status: 'waiting', waitingFor: 'bank_dispute', createdAt: old },
      // ready, and not yet a day old
      { status: 'pending', createdAt: recent },
    ]
    for (const [i, row] of rows.entries()) {
      const learner = seats[i]
      if (!learner) throw new Error('no seat')
      await t.db.insert(s.seatRefunds).values({
        enrollmentId: learner.enrollmentId,
        paymentId: learner.paymentId,
        classId: c.classId,
        kind: 'learner_withdrew',
        ...row,
      })
    }
    const service = new ReleaseService(t.deps)
    expect(await service.needingAttention(t.now())).toBe(3)

    const [runRow] = await t.db.insert(s.payoutRuns).values({ startedAt: old }).returning()
    if (!runRow) throw new Error('no run')
    const payout = {
      runId: runRow.id,
      payoutAccountId: sell.payoutAccountId,
      availableCents: N,
      pendingCents: 0,
      heldCents: 0,
      limitCents: N,
      namedCents: N,
      unnamedCents: 0,
      amountCents: N,
      outcome: 'paid' as const,
    }
    // left at sending for a day; and one at sending for an hour, which the next run resumes
    await t.db.insert(s.payouts).values([
      { ...payout, payDate: '2026-11-01', sendStatus: 'sending', createdAt: old },
      { ...payout, payDate: '2026-11-02', sendStatus: 'sending', createdAt: recent },
    ])
    // a payout that failed an hour ago counts; one that failed two days ago no longer does
    await t.db.insert(s.auditLog).values([
      { actorId: null, action: 'payout.failed', entityType: 'payout', createdAt: recent },
      {
        actorId: null,
        action: 'payout.failed',
        entityType: 'payout',
        createdAt: new Date(now - 2 * DAY),
      },
    ])
    expect(await service.needingAttention(t.now())).toBe(5)
  })
})

describe('a run that stops part-way', () => {
  it('is followed by one that sends nothing twice', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell, [block(14)])
    const learner = await seat(t, c.classId)
    const sale = await buyCourse(t, sell.courseId)
    const token = await teachToken(t, sell)
    const cancelled = await t.api(
      'POST',
      `/api/teach/profiles/${sell.profileId}/classes/${c.classId}/cancel`,
      { token, body: { reason: 'The teacher is unwell.' } },
    )
    expect(cancelled.status).toBe(200)
    t.payments.settle(sell.accountId)
    const refunds = () =>
      t.payments.refunds.filter((r) => r.paymentIntentId === learner.paymentIntentId)
    const feeRefunds = () =>
      t.payments.feeRefunds.filter((r) => r.applicationFeeId === `fee_${learner.paymentIntentId}`)
    const lossy = (...methods: Parameters<typeof lostAnswers>[1]) =>
      new ReleaseService({ ...t.deps, payments: lostAnswers(t.payments, methods) })
    const mailBefore = t.mailer.sent.length

    // Stripe makes the refund and its answer is lost; then the fee refund, and its answer is lost.
    await lossy('createRefund').run(t.now())
    expect(refunds()).toHaveLength(1)
    t.advanceClock(15 * MINUTE)
    await lossy('refundApplicationFee').run(t.now())
    expect(feeRefunds()).toHaveLength(1)
    expect(await t.db.$count(s.refunds)).toBe(0)
    await run(t, new Date(t.now().getTime() + 15 * MINUTE))
    expect(refunds()).toHaveLength(1)
    expect(feeRefunds()).toHaveLength(1)
    expect(
      await t.db.query.seatRefunds.findFirst({ where: { enrollmentId: learner.enrollmentId } }),
    ).toMatchObject({ status: 'done', learnerRefundCents: 50000 })
    expect(await t.db.$count(s.refunds)).toBe(1)
    const told = t.mailer.sent.slice(mailBefore)
    expect(told.filter((m) => m.to === learner.email)).toHaveLength(1)
    expect(told.filter((m) => m.to === sell.email)).toHaveLength(1)

    // The next day's payout is made and its answer is lost; the next run records it.
    t.setClock(new Date(t.now().getTime() + DAY))
    await lossy('createPayout').run(t.now())
    for (let i = 0; i < 2; i++) await run(t, new Date(t.now().getTime() + 15 * MINUTE))
    expect(t.payments.moneyOf(sell.accountId).payouts).toHaveLength(1)
    const paid = await t.db.query.payouts.findMany({
      where: { payoutAccountId: sell.payoutAccountId, outcome: 'paid' },
    })
    expect(paid).toHaveLength(1)
    expect(paid[0]).toMatchObject({ sendStatus: 'sent', amountCents: N - F })
    expect((await t.db.query.payments.findFirst({ where: { id: sale.paymentId } }))?.payoutId).toBe(
      paid[0]?.id,
    )
  })
})

describe('POST /dev/release-run', () => {
  it('runs the job inside the API at the time given, settling the fake balances first', async () => {
    const sell = await seller(t)
    const c = await newClass(t, sell)
    const learner = await seat(t, c.classId)
    t.setClock(new Date(t.now().getTime() + DAY + 10 * MINUTE))
    await attendance(t, learner, c.classId, c.blockId)
    expect(t.payments.moneyOf(sell.accountId).pendingCents).toBe(N)
    const now = new Date(c.lastEndsAt.getTime() + 7 * DAY)
    const res = await t.api('POST', '/api/dev/release-run', { body: { now: now.toISOString() } })
    expect(res.status).toBe(200)
    expect(res.body.run).toMatchObject({
      status: 'finished',
      classesReleased: 1,
      payoutsCreated: 1,
    })
    expect(
      await t.db.query.payoutRuns.findFirst({ where: { id: res.body.run.runId } }),
    ).toMatchObject({ startedAt: now, finishedAt: now })
    expect(t.payments.moneyOf(sell.accountId)).toMatchObject({ pendingCents: 0, availableCents: 0 })
    expect(
      (await t.api('POST', '/api/dev/release-run', { body: { now: 'tomorrow' } })).status,
    ).toBe(400)
    expect((await t.api('POST', '/api/dev/release-run')).status).toBe(200)
  })

  it('is not there when the dev endpoints setting is off', async () => {
    const off = await createTestApp({ DEV_ENDPOINTS_ENABLED: 'false' })
    try {
      const res = await off.api('POST', '/api/dev/release-run', { body: {} })
      expect(res.status).toBe(404)
      expect(off.app.routes.some((r) => r.path.startsWith('/api/dev'))).toBe(false)
      expect(await off.db.$count(s.payoutRuns)).toBe(0)
    } finally {
      await off.close()
    }
  })
})
