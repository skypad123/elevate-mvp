import { DISPUTE_WINDOW_MS, WITHDRAWAL_CLOSES_BEFORE_MS } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { translate } from '@elevate/i18n'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { seatsTaken } from '../src/services/class-checkout.service'
import { SeatRefundsService } from '../src/services/seat-refunds.service'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Withdrawing, moving, a discretionary refund and cancelling (docs/designs/scheduled-classes-
 * selling.md, "Withdrawing, moving, changing a block and cancelling", Phase 4 entry 4.11). No
 * route here calls Stripe to move money: each writes rows, and the sender, called here as the
 * release job will call it, sends them.
 */
const A = 50000
const F = 2000
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

let t: TestApp
let root: string
let start: Date
let n = 0

beforeAll(async () => {
  t = await createTestApp()
  start = t.now()
  await t.grantRole('root@example.com', 'super_admin')
  root = (await t.signIn('root@example.com', 'support')).token as string
})
afterAll(async () => {
  await t.close()
})
afterEach(() => {
  t.setClock(start)
})

type Seller = Awaited<ReturnType<typeof seller>>

/** A profile of its own, opted in, with a live S$500 course. */
async function seller(type: 'personal' | 'corporate' = 'personal') {
  const email = `seller-${++n}@example.com`
  const { profile } = await t.createProfile(email, { payable: true, type })
  const course = await t.createCourse(profile.id, { status: 'live', priceCents: A })
  await t.optIn(profile.id)
  return { email, profileId: profile.id, courseId: course.courseId }
}

/** A Teach session for `email`, signed in now so it counts as recent. */
const teach = async (email: string) => (await t.signIn(email, 'teach')).token as string

const block = (startDay: number, hours = 2) => ({
  startMs: startDay * DAY,
  endMs: startDay * DAY + hours * HOUR,
})

async function newClass(sell: Seller, blocks = [block(14)], options: { seats?: number } = {}) {
  return t.createClass(sell.profileId, sell.courseId, { blocks, ...options })
}

async function seat(classId: string, options: Parameters<TestApp['buySeat']>[2] = {}) {
  const email = `learner-${++n}@example.com`
  const bought = await t.buySeat(email, classId, { stripeFeeCents: F, ...options })
  if (!bought.payment) throw new Error('the seat was not paid')
  const user = await t.ensureUser(email)
  return { ...bought, email, userId: user.id, paymentId: bought.payment.id }
}

const send = (id: string) => new SeatRefundsService(t.deps).send(id, t.now())
const rowsOf = (enrollmentId: string) =>
  t.db.query.seatRefunds.findMany({ where: { enrollmentId }, orderBy: { createdAt: 'asc' } })
const enrollmentOf = (id: string) => t.db.query.enrollments.findFirst({ where: { id } })
const mailTo = (email: string) => t.mailer.sent.filter((m) => m.to === email)
const nameOf = async (classId: string) =>
  (await t.db.query.classes.findFirst({ where: { id: classId } }))?.name ?? ''
const withdraw = (enrollmentId: string, token: string) =>
  t.api('POST', `/api/me/classes/${enrollmentId}/withdraw`, { token })
const teachPath = (sell: Seller, classId: string, rest = '') =>
  `/api/teach/profiles/${sell.profileId}/classes/${classId}${rest}`

/** An attendance row for a learner, written straight to the database. */
async function event(
  learner: { enrollmentId: string; userId: string },
  classId: string,
  blockId: string,
  values: Partial<typeof s.attendanceEvents.$inferInsert> & {
    type: 'check_in' | 'manual_mark'
  },
) {
  const profile = await t.db.query.classes.findFirst({
    where: { id: classId },
    with: { profile: true },
  })
  const [row] = await t.db
    .insert(s.attendanceEvents)
    .values({
      classId,
      blockId,
      enrollmentId: learner.enrollmentId,
      learnerUserId: learner.userId,
      actorUserId:
        values.type === 'check_in' ? learner.userId : (profile?.profile.ownerUserId ?? ''),
      actorRole: values.type === 'check_in' ? 'learner' : 'owner',
      requestId: 'fixture',
      createdAt: t.now(),
      ...(values.type === 'check_in'
        ? { method: 'typed_code', locationStatus: 'ok', accuracyM: 10, distanceM: 5 }
        : { reasonCode: 'phone_not_working', idDocumentType: 'nric' }),
      ...values,
    })
    .returning()
  if (!row) throw new Error('failed to write an attendance row')
  return row
}

describe('withdrawing', () => {
  it('gives learner_withdrew until 7 days before the first block, and refuses it after', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const early = await seat(classId)
    const late = await seat(classId)
    const firstStart = new Date(start.getTime() + 14 * DAY)
    // one millisecond before the 7 days: allowed, and the learner is shown what and until when
    t.setClock(new Date(firstStart.getTime() - WITHDRAWAL_CLOSES_BEFORE_MS - 1))
    const mine = await t.api('GET', '/api/me/classes', { token: early.token })
    expect(mine.body.items[0].seat).toMatchObject({
      withdrawKind: 'learner_withdrew',
      withdrawRefundCents: A - F,
      withdrawClosesAt: new Date(firstStart.getTime() - WITHDRAWAL_CLOSES_BEFORE_MS).toISOString(),
      classCancelled: false,
      refund: null,
    })
    const ok = await withdraw(early.enrollmentId, early.token)
    expect(ok.status).toBe(200)
    expect(ok.body.class.seat).toMatchObject({
      withdrawKind: null,
      refund: { kind: 'learner_withdrew', status: 'pending' },
    })
    expect((await enrollmentOf(early.enrollmentId))?.status).toBe('cancelled')
    // exactly 7 days before: closed
    t.setClock(new Date(firstStart.getTime() - WITHDRAWAL_CLOSES_BEFORE_MS))
    const closed = await withdraw(late.enrollmentId, late.token)
    expect(closed.status).toBe(409)
    expect(closed.body.error).toMatchObject({
      code: 'withdrawal_closed',
      details: {
        closesAt: new Date(firstStart.getTime() - WITHDRAWAL_CLOSES_BEFORE_MS).toISOString(),
      },
    })
    const audit = await t.db.query.auditLog.findMany({ where: { action: 'seat.withdrawn' } })
    expect(audit.map((a) => a.entityId)).toContain(early.enrollmentId)
  })

  it('frees the seat in the same request', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell, [block(14)], { seats: 1 })
    const first = await seat(classId)
    expect(await seatsTaken(t.db, classId, t.now())).toBe(1)
    expect((await withdraw(first.enrollmentId, first.token)).status).toBe(200)
    expect(await seatsTaken(t.db, classId, t.now())).toBe(0)
    const second = await seat(classId)
    expect((await enrollmentOf(second.enrollmentId))?.status).toBe('active')
  })

  it('gives changed_withdrew, the full refund, after a changed class until it starts', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell, [block(3)])
    const learner = await seat(classId)
    const refused = await withdraw(learner.enrollmentId, learner.token)
    expect(refused.body.error.code).toBe('withdrawal_closed')
    await t.db
      .update(s.enrollments)
      .set({ classChangedAt: t.now() })
      .where(eq(s.enrollments.id, learner.enrollmentId))
    const res = await withdraw(learner.enrollmentId, learner.token)
    expect(res.status).toBe(200)
    expect((await enrollmentOf(learner.enrollmentId))?.status).toBe('refunded')
    expect((await rowsOf(learner.enrollmentId)).map((r) => r.kind)).toEqual(['changed_withdrew'])
  })

  it('refuses a learner counted as attended or with an open mark, and a cancelled class', async () => {
    const sell = await seller()
    const { classId, blockIds } = await newClass(sell, [block(12), block(13)])
    const checkedIn = await seat(classId)
    const marked = await seat(classId)
    const other = await seat(classId)
    await event(checkedIn, classId, blockIds[0] as string, { type: 'check_in' })
    await event(marked, classId, blockIds[0] as string, { type: 'manual_mark' })
    for (const learner of [checkedIn, marked]) {
      const res = await withdraw(learner.enrollmentId, learner.token)
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('withdrawal_attended')
    }
    const cancelled = await t.api('POST', teachPath(sell, classId, '/cancel'), {
      token: await teach(sell.email),
      body: { reason: 'The teacher is unwell.' },
    })
    expect(cancelled.status).toBe(200)
    // a learner whose cancellation refund is under way, and one whose seat is held for theirs
    const refused = await withdraw(other.enrollmentId, other.token)
    expect(refused.status).toBe(404)
    const markedRefused = await withdraw(marked.enrollmentId, marked.token)
    expect(markedRefused.status).toBe(409)
    expect(markedRefused.body.error.code).toBe('class_cancelled')
  })
})

describe('moving a learner', () => {
  it('moves a seat and its payment to another class of the course, freeing the old seat', async () => {
    const sell = await seller()
    const from = await newClass(sell)
    const to = await newClass(sell, [block(20)])
    const learner = await seat(from.classId)
    const token = await teach(sell.email)
    const targets = await t.api(
      'GET',
      teachPath(sell, from.classId, `/learners/${learner.enrollmentId}/move-targets`),
      { token },
    )
    expect(targets.status).toBe(200)
    expect(targets.body.items).toEqual([
      expect.objectContaining({ classId: to.classId, seatsLeft: 20, problems: [] }),
    ])
    t.mailer.sent.length = 0
    const res = await t.api(
      'POST',
      teachPath(sell, from.classId, `/learners/${learner.enrollmentId}/move`),
      { token, body: { toClassId: to.classId } },
    )
    expect(res.status).toBe(200)
    expect(res.body.seat).toMatchObject({
      enrollmentId: learner.enrollmentId,
      movedAt: t.now().toISOString(),
      classChangedAt: t.now().toISOString(),
    })
    expect(await enrollmentOf(learner.enrollmentId)).toMatchObject({
      classId: to.classId,
      movedFromClassId: from.classId,
      status: 'active',
    })
    const payment = await t.db.query.payments.findFirst({ where: { id: learner.paymentId } })
    expect(payment?.classId).toBe(to.classId)
    expect(await seatsTaken(t.db, from.classId, t.now())).toBe(0)
    expect(await seatsTaken(t.db, to.classId, t.now())).toBe(1)
    expect(mailTo(learner.email).map((m) => m.subject)).toEqual([
      translate('en', 'email.seatMoved.title', { className: await nameOf(to.classId) }),
    ])
    // the move gives the right to withdraw in full until the new class starts
    const mine = await t.api('GET', '/api/me/classes', { token: learner.token })
    expect(mine.body.items[0].seat).toMatchObject({
      withdrawKind: 'changed_withdrew',
      withdrawRefundCents: A,
    })
  })

  it('reports each move problem', async () => {
    const sell = await seller()
    const token = await teach(sell.email)
    const from = await newClass(sell, [block(10), block(11)])
    const otherCourse = await t.createCourse(sell.profileId, { status: 'live', priceCents: A })
    const elsewhere = await t.createClass(sell.profileId, otherCourse.courseId, {
      blocks: [block(20)],
    })
    const draft = await t.createClass(sell.profileId, sell.courseId, {
      status: 'draft',
      blocks: [block(20)],
    })
    const started = await newClass(sell, [{ startMs: -HOUR, endMs: HOUR }])
    const full = await newClass(sell, [block(20)], { seats: 1 })
    await seat(full.classId)
    const tooLate = await newClass(sell, [block(80)])
    const ok = await newClass(sell, [block(20)])

    const attended = await seat(from.classId)
    const marked = await seat(from.classId)
    const disputed = await seat(from.classId)
    const busy = await seat(from.classId)
    const before = await seat(from.classId)
    await event(attended, from.classId, from.blockIds[0] as string, { type: 'check_in' })
    await event(marked, from.classId, from.blockIds[0] as string, { type: 'manual_mark' })
    await t.db
      .update(s.payments)
      .set({ bankDisputeStatus: 'open', bankDisputeId: 'dp_1', bankDisputedAt: t.now() })
      .where(eq(s.payments.id, disputed.paymentId))
    const refund = await t.api(
      'POST',
      teachPath(sell, from.classId, `/learners/${busy.enrollmentId}/refund`),
      { token, body: { amountCents: 1000, reason: 'A goodwill refund.' } },
    )
    expect(refund.status).toBe(200)
    // a learner who was once in the target, and left it
    const earlier = await t.buySeat(before.email, ok.classId)
    expect((await withdraw(earlier.enrollmentId, before.token)).status).toBe(200)

    const move = (learner: { enrollmentId: string }, toClassId: string) =>
      t.api('POST', teachPath(sell, from.classId, `/learners/${learner.enrollmentId}/move`), {
        token,
        body: { toClassId },
      })
    const problems = async (learner: { enrollmentId: string }, toClassId: string) => {
      const res = await move(learner, toClassId)
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('move_not_allowed')
      return res.body.error.details.problems
    }
    expect(await problems(attended, ok.classId)).toEqual(['attended'])
    expect(await problems(marked, ok.classId)).toEqual(['open_mark'])
    expect(await problems(busy, ok.classId)).toEqual(['refund_in_progress'])
    expect(await problems(disputed, ok.classId)).toEqual(['bank_dispute_open'])
    expect(await problems(before, ok.classId)).toEqual(['already_in_target'])
    const fresh = await seat(from.classId)
    expect(await problems(fresh, elsewhere.classId)).toEqual(['different_course'])
    expect(await problems(fresh, draft.classId)).toEqual(['target_not_published'])
    expect(await problems(fresh, started.classId)).toEqual(['target_started'])
    expect(await problems(fresh, full.classId)).toEqual(['target_full'])
    expect(await problems(fresh, tooLate.classId)).toEqual(['beyond_limit'])
    // the list of targets says the same, and leaves out drafts and other courses
    const targets = await t.api(
      'GET',
      teachPath(sell, from.classId, `/learners/${fresh.enrollmentId}/move-targets`),
      { token },
    )
    expect(
      Object.fromEntries(
        targets.body.items.map((x: { classId: string; problems: string[] }) => [
          x.classId,
          x.problems,
        ]),
      ),
    ).toEqual({
      [started.classId]: ['target_started'],
      [full.classId]: ['target_full'],
      [tooLate.classId]: ['beyond_limit'],
      [ok.classId]: [],
    })
    // and the fresh learner can go
    expect((await move(fresh, ok.classId)).status).toBe(200)
  })
})

describe('a discretionary refund', () => {
  it('is the owner’s and a manager’s, never a writer’s, and asks for a recent sign-in', async () => {
    const sell = await seller('corporate')
    const manager = `manager-${++n}@example.com`
    const writer = `writer-${n}@example.com`
    await t.addMember(sell.profileId, manager, 'manager')
    await t.addMember(sell.profileId, writer, 'writer')
    const { classId } = await newClass(sell)
    const one = await seat(classId)
    const two = await seat(classId)
    const three = await seat(classId)
    const refund = (token: string, enrollmentId: string) =>
      t.api('POST', teachPath(sell, classId, `/learners/${enrollmentId}/refund`), {
        token,
        body: { amountCents: 5000, reason: 'A goodwill refund.' },
      })
    expect((await refund(await teach(sell.email), one.enrollmentId)).status).toBe(200)
    expect((await refund(await teach(manager), two.enrollmentId)).status).toBe(200)
    expect((await refund(await teach(writer), three.enrollmentId)).status).toBe(403)
    const old = await teach(sell.email)
    t.advanceClock(25 * HOUR)
    const stale = await refund(old, three.enrollmentId)
    expect(stale.status).toBe(401)
    expect(stale.body.error.code).toBe('reauth_required')
    expect((await rowsOf(one.enrollmentId)).map((r) => [r.kind, r.requestedCents])).toEqual([
      ['discretionary', 5000],
    ])
    // the seat is kept
    expect((await enrollmentOf(one.enrollmentId))?.status).toBe('active')
  })

  it('refuses more than was paid and not had back, a refund under way, and a released payment', async () => {
    const sell = await seller()
    const token = await teach(sell.email)
    const { classId } = await newClass(sell)
    const learner = await seat(classId)
    const refund = (amountCents: number) =>
      t.api('POST', teachPath(sell, classId, `/learners/${learner.enrollmentId}/refund`), {
        token,
        body: { amountCents, reason: 'A goodwill refund.' },
      })
    expect((await refund(30000)).status).toBe(200)
    // the row is unfinished, so it counts as had back, and a second one waits for it
    const busy = await refund(1000)
    expect(busy.status).toBe(409)
    expect(busy.body.error.code).toBe('refund_in_progress')
    const [row] = await rowsOf(learner.enrollmentId)
    expect(await send(row?.id as string)).toBe('done')
    const seats = await t.api('GET', teachPath(sell, classId, '/seats'), { token })
    expect(seats.body.items[0]).toMatchObject({
      refundedCents: 30000,
      canRefundUpToCents: 20000,
      refunds: [expect.objectContaining({ kind: 'discretionary', status: 'done' })],
    })
    const tooLarge = await refund(20001)
    expect(tooLarge.status).toBe(422)
    expect(tooLarge.body.error).toMatchObject({
      code: 'refund_too_large',
      details: { maxCents: 20000 },
    })
    await t.db
      .update(s.payments)
      .set({ releasedAt: t.now(), releaseReason: 'due' })
      .where(eq(s.payments.id, learner.paymentId))
    const released = await refund(100)
    expect(released.status).toBe(409)
    expect(released.body.error.code).toBe('class_released')
  })
})

describe('cancelling a class', () => {
  it('before the start: a full refund for every seat, reservations ended and their pages expired', async () => {
    const sell = await seller()
    const { classId } = await newClass(sell)
    const one = await seat(classId)
    const two = await seat(classId)
    const reserving = await t.buySeat(`learner-${++n}@example.com`, classId, { pay: false })
    const res = await t.api('POST', teachPath(sell, classId, '/cancel'), {
      token: await teach(sell.email),
      body: { reason: 'The teacher is unwell.' },
    })
    expect(res.status).toBe(200)
    expect(res.body.class).toMatchObject({
      status: 'cancelled',
      cancelReason: 'The teacher is unwell.',
      cancelledAt: t.now().toISOString(),
      notOnSaleReason: 'cancelled',
      seatsTaken: 0,
    })
    for (const learner of [one, two]) {
      expect((await rowsOf(learner.enrollmentId)).map((r) => [r.kind, r.status])).toEqual([
        ['teacher_cancelled', 'pending'],
      ])
      expect((await enrollmentOf(learner.enrollmentId))?.status).toBe('refunded')
    }
    expect((await enrollmentOf(reserving.enrollmentId))?.seatReservedUntil).toEqual(t.now())
    expect(t.payments.sessions.get(reserving.sessionId)?.expired).toBe(true)
    expect(await t.db.query.classCancellations.findFirst({ where: { classId } })).toMatchObject({
      byElevate: false,
      afterStart: false,
      blocksTotal: 1,
      blocksUntaught: 1,
      completedAt: null,
    })
    // cancelling twice, and editing a cancelled class, are refused
    const token = await teach(sell.email)
    const again = await t.api('POST', teachPath(sell, classId, '/cancel'), {
      token,
      body: { reason: 'Once more.' },
    })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('class_cancelled')
    const edit = await t.api('PATCH', teachPath(sell, classId), { token, body: { seats: 30 } })
    expect(edit.body.error.code).toBe('class_cancelled')
    // nothing went to Stripe: the job sends the rows
    expect(
      t.payments.refunds.filter((r) => r.paymentIntentId === one.payment?.stripePaymentIntentId),
    ).toEqual([])
    // the cancellation completes when its last row is done
    for (const learner of [one, two]) {
      const [row] = await rowsOf(learner.enrollmentId)
      expect(await send(row?.id as string)).toBe('done')
    }
    expect(
      (await t.db.query.classCancellations.findFirst({ where: { classId } }))?.completedAt,
    ).toEqual(t.now())
  })

  it('after a block: part refunds for those counted, a wait on an open mark, a full refund for the absent', async () => {
    const sell = await seller()
    const { classId, blockIds } = await newClass(sell, [block(10), block(11), block(12), block(13)])
    const checkedIn = await seat(classId)
    const settled = await seat(classId)
    const open = await seat(classId)
    const absent = await seat(classId)
    t.advanceClock(10 * DAY + HOUR)
    const first = blockIds[0] as string
    await event(checkedIn, classId, first, { type: 'check_in' })
    // marked by hand more than 7 days ago in the data, so it has settled
    await event(settled, classId, first, {
      type: 'manual_mark',
      createdAt: new Date(t.now().getTime() - DISPUTE_WINDOW_MS - MINUTE),
    })
    await event(open, classId, first, { type: 'manual_mark' })
    t.mailer.sent.length = 0
    const res = await t.api('POST', teachPath(sell, classId, '/cancel'), {
      token: await teach(sell.email),
      body: { reason: 'The teacher is unwell.' },
    })
    expect(res.status).toBe(200)
    const kinds = async (learner: { enrollmentId: string }) =>
      (await rowsOf(learner.enrollmentId)).map((r) => [r.kind, r.status, r.waitingFor])
    expect(await kinds(checkedIn)).toEqual([['teacher_cancelled_part', 'pending', null]])
    expect(await kinds(settled)).toEqual([['teacher_cancelled_part', 'pending', null]])
    expect(await kinds(open)).toEqual([['teacher_cancelled', 'waiting', 'manual_mark']])
    expect(await kinds(absent)).toEqual([['teacher_cancelled', 'pending', null]])
    expect((await enrollmentOf(checkedIn.enrollmentId))?.status).toBe('active')
    expect((await enrollmentOf(open.enrollmentId))?.status).toBe('active')
    expect((await enrollmentOf(absent.enrollmentId))?.status).toBe('refunded')
    // only the learner whose mark is open is told now; the others hear when refunded
    const learners = [checkedIn, settled, open, absent].map((l) => l.email)
    expect(t.mailer.sent.map((m) => m.to).filter((to) => learners.includes(to))).toEqual([
      open.email,
    ])
    expect(mailTo(open.email)[0]?.subject).toBe(
      translate('en', 'email.classCancelledMarkOpen.title', { className: await nameOf(classId) }),
    )
    const [part] = await rowsOf(checkedIn.enrollmentId)
    expect(await send(part?.id as string)).toBe('done')
    expect((await rowsOf(checkedIn.enrollmentId))[0]?.learnerRefundCents).toBe(37500)

    // the open-mark learner disputes the mark, and gets the whole payment back
    const mark = await t.db.query.attendanceEvents.findFirst({
      where: { enrollmentId: open.enrollmentId, type: 'manual_mark' },
    })
    const [waiting] = await rowsOf(open.enrollmentId)
    expect(await send(waiting?.id as string)).toBe('waiting')
    const dispute = await t.api('POST', `/api/me/classes/attendance/${mark?.id}/dispute`, {
      token: open.token,
      body: { reason: 'I was not there that day.' },
    })
    expect(dispute.status).toBe(200)
    expect(await send(waiting?.id as string)).toBe('done')
    expect((await rowsOf(open.enrollmentId))[0]).toMatchObject({
      kind: 'teacher_cancelled',
      learnerRefundCents: A,
    })
    expect((await enrollmentOf(open.enrollmentId))?.status).toBe('refunded')

    // a cancelled class takes no check-in and shows no code, so nothing changes what was settled
    const second = blockIds[1] as string
    const late = await t.api('GET', `/api/me/classes/blocks/${second}`, { token: checkedIn.token })
    expect(late.status).toBe(409)
    expect(late.body.error.code).toBe('class_cancelled')
    const code = await t.api('GET', teachPath(sell, classId, `/blocks/${second}/code`), {
      token: await teach(sell.email),
    })
    expect(code.status).toBe(409)
    expect(code.body.error.code).toBe('class_cancelled')
  })

  it('closes the open-mark learner’s row when the mark settles and every block had started', async () => {
    const sell = await seller()
    const { classId, blockIds } = await newClass(sell, [block(10)])
    const marked = await seat(classId)
    const present = await seat(classId)
    t.advanceClock(10 * DAY + HOUR)
    await event(marked, classId, blockIds[0] as string, { type: 'manual_mark' })
    await event(present, classId, blockIds[0] as string, { type: 'check_in' })
    t.mailer.sent.length = 0
    const res = await t.api('POST', teachPath(sell, classId, '/cancel'), {
      token: await teach(sell.email),
      body: { reason: 'The venue flooded.' },
    })
    expect(res.status).toBe(200)
    // counted, with nothing untaught: no row, and an email saying why
    expect(await rowsOf(present.enrollmentId)).toEqual([])
    const className = await nameOf(classId)
    expect(mailTo(present.email).map((m) => m.subject)).toEqual([
      translate('en', 'email.classCancelledAttended.title', { className }),
    ])
    const [row] = await rowsOf(marked.enrollmentId)
    t.advanceClock(DISPUTE_WINDOW_MS + MINUTE)
    t.mailer.sent.length = 0
    expect(await send(row?.id as string)).toBe('closed')
    expect((await rowsOf(marked.enrollmentId))[0]).toMatchObject({
      status: 'closed',
      closedReason: 'mark_settled',
    })
    expect(mailTo(marked.email).map((m) => m.subject)).toEqual([
      translate('en', 'email.classCancelledAttended.title', { className }),
    ])
    expect(
      (await t.db.query.classCancellations.findFirst({ where: { classId } }))?.completedAt,
    ).toEqual(t.now())
  })

  it('refuses a draft, a released class for the profile, and a seat whose refund is under way', async () => {
    const sell = await seller()
    const token = await teach(sell.email)
    const draft = await t.createClass(sell.profileId, sell.courseId, {
      status: 'draft',
      blocks: [block(14)],
    })
    const cancel = (classId: string) =>
      t.api('POST', teachPath(sell, classId, '/cancel'), {
        token,
        body: { reason: 'The teacher is unwell.' },
      })
    expect((await cancel(draft.classId)).body.error.code).toBe('class_not_published')
    const busy = await newClass(sell)
    const learner = await seat(busy.classId)
    await t.api('POST', teachPath(sell, busy.classId, `/learners/${learner.enrollmentId}/refund`), {
      token,
      body: { amountCents: 1000, reason: 'A goodwill refund.' },
    })
    const refused = await cancel(busy.classId)
    expect(refused.status).toBe(409)
    expect(refused.body.error).toMatchObject({
      code: 'refund_in_progress',
      details: { enrollmentIds: [learner.enrollmentId] },
    })
    expect((await t.db.query.classes.findFirst({ where: { id: busy.classId } }))?.status).toBe(
      'published',
    )
    const released = await newClass(sell)
    await t.db
      .update(s.classes)
      .set({ releasedAt: t.now(), releaseReason: 'due' })
      .where(eq(s.classes.id, released.classId))
    expect((await cancel(released.classId)).body.error.code).toBe('class_released')
    // a Support admin still can
    const byElevate = await t.api('POST', `/api/support/classes/${released.classId}/cancel`, {
      token: root,
      body: { ground: 'rules_breach', note: 'The profile misled its learners.' },
    })
    expect(byElevate.status).toBe(200)
  })

  it('by Elevate, refunds in full every learner, those who attended too', async () => {
    const sell = await seller()
    const { classId, blockIds } = await newClass(sell, [block(10)])
    const present = await seat(classId)
    const disputed = await seat(classId)
    await t.db
      .update(s.payments)
      .set({ bankDisputeStatus: 'open', bankDisputeId: 'dp_2', bankDisputedAt: t.now() })
      .where(eq(s.payments.id, disputed.paymentId))
    t.advanceClock(10 * DAY + HOUR)
    await event(present, classId, blockIds[0] as string, { type: 'check_in' })
    const agent = await t.grantRole(`agent-${++n}@example.com`, 'support_agent')
    const agentToken = (await t.signIn(agent.email, 'support')).token as string
    const body = { ground: 'venue_unavailable', note: 'The venue was closed by the landlord.' }
    expect(
      (await t.api('POST', `/api/support/classes/${classId}/cancel`, { token: agentToken, body }))
        .status,
    ).toBe(403)
    const res = await t.api('POST', `/api/support/classes/${classId}/cancel`, {
      token: root,
      body,
    })
    expect(res.status).toBe(200)
    expect(await t.db.query.classCancellations.findFirst({ where: { classId } })).toMatchObject({
      byElevate: true,
      elevateReason: 'venue_unavailable',
      reason: body.note,
      afterStart: true,
    })
    expect((await rowsOf(present.enrollmentId)).map((r) => [r.kind, r.status])).toEqual([
      ['elevate_cancelled', 'pending'],
    ])
    expect(
      (await rowsOf(disputed.enrollmentId)).map((r) => [r.kind, r.status, r.waitingFor]),
    ).toEqual([['elevate_cancelled', 'waiting', 'bank_dispute']])
    expect((await enrollmentOf(present.enrollmentId))?.status).toBe('refunded')
    expect((await enrollmentOf(disputed.enrollmentId))?.status).toBe('active')
    const [row] = await rowsOf(present.enrollmentId)
    expect(await send(row?.id as string)).toBe('done')
    expect((await rowsOf(present.enrollmentId))[0]?.learnerRefundCents).toBe(A)
    const audit = await t.db.query.auditLog.findMany({
      where: { action: 'class.cancelled_by_elevate', entityId: classId },
    })
    expect(audit).toHaveLength(1)
  })
})
