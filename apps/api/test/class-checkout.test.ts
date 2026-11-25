import {
  CLASS_TIME_ZONE,
  instantToZoned,
  REFUND_TERMS_VERSION,
  SEAT_HORIZON_MS,
  SEAT_RESERVATION_MS,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { translate } from '@elevate/i18n'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { escapeHtml } from '../src/emails/templates'
import { ClassSalesService } from '../src/services/class-sales.service'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Buying a seat (docs/designs/scheduled-classes-selling.md, "Buying a seat", Phase 3 entry 3.12):
 * when a class is on sale, the checks before a payment page, the reservation, the payment page
 * itself, each row of the fulfilment table, the receipt, and the class's Teach page and edits
 * once seats are sold.
 */
let t: TestApp
let profileId: string
let courseId: string
let courseSlug: string
let ownerEmail: string
let n = 0
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

beforeAll(async () => {
  t = await createTestApp()
  ownerEmail = 'seller@example.com'
  const { profile } = await t.createProfile(ownerEmail, { payable: true, displayName: 'Mei Lin' })
  profileId = profile.id
  const course = await t.createCourse(profileId, {
    status: 'live',
    priceCents: 50000,
    title: 'Wheel throwing',
  })
  courseId = course.courseId
  courseSlug = course.slug
  await t.optIn(profileId)
})
afterAll(async () => {
  await t.close()
})

/** A published in-person class of the course, two weeks away unless told otherwise. */
async function newClass(
  options: Parameters<TestApp['createClass']>[2] & { course?: string; profile?: string } = {},
) {
  const { classId, blockIds } = await t.createClass(
    options.profile ?? profileId,
    options.course ?? courseId,
    {
      blocks: [{ startMs: 14 * DAY, endMs: 14 * DAY + 3 * HOUR }],
      ...options,
    },
  )
  return { classId, blockIds }
}

const learner = () => `learner-${++n}@example.com`

async function start(
  classId: string,
  token: string,
  body: Record<string, unknown> = { termsVersion: REFUND_TERMS_VERSION },
) {
  return t.api('POST', `/api/checkout/classes/${classId}`, { token, body })
}

const enrollmentOf = async (email: string, classId: string) => {
  const user = await t.ensureUser(email)
  return t.db.query.enrollments.findFirst({ where: { userId: user.id, classId } })
}

const sync = async (sessionId: string, token: string) =>
  (await t.api('GET', `/api/checkout/sessions/${sessionId}/sync`, { token })).body

/** Pays a session through the fake and delivers the webhook. */
async function pay(sessionId: string, paidAt?: Date) {
  const hook = await t.stripeWebhook(t.payments.completeCheckout(sessionId, 'card', paidAt))
  return hook
}

/** Everything a lost seat leaves: the payment, its seat_lost row, no seat, no receipt, no refund. */
async function expectSeatLost(sessionId: string, email: string, classId: string) {
  const payment = await t.db.query.payments.findFirst({
    where: { stripeCheckoutSessionId: sessionId },
    with: { seatRefunds: true },
  })
  expect(payment).toMatchObject({ classId, status: 'succeeded', refundedCents: 0 })
  expect(payment?.seatRefunds.map((r) => [r.kind, r.status, r.learnerRefundCents])).toEqual([
    ['seat_lost', 'pending', null],
  ])
  // nothing was refunded by the old duplicate path: the release job sends the row
  expect(
    t.payments.refunds.filter((r) => r.paymentIntentId === payment?.stripePaymentIntentId),
  ).toEqual([])
  expect(t.mailer.sent.filter((m) => m.to === email)).toEqual([])
  const token = await t.learnerToken(email)
  expect(await sync(sessionId, token)).toEqual({ status: 'seat_lost', classId, courseSlug })
}

describe('when a class is on sale', () => {
  it('answers each reason a class is not on sale, and 404 while classes are off', async () => {
    const token = await t.learnerToken(learner())
    const reason = async (classId: string) => {
      const res = await t.api('GET', `/api/checkout/classes/${classId}`, { token })
      if (res.status === 200) return true
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error.code).toBe('class_not_on_sale')
      // a start is refused the same way, and makes no reservation
      const started = await start(classId, token)
      expect(started.body.error).toMatchObject({ code: 'class_not_on_sale' })
      return res.body.error.details.reason as string
    }
    const env = t.deps.env as { CLASS_SALES: boolean; CLASSES: boolean }

    const onSale = await newClass()
    expect(await reason(onSale.classId)).toBe(true)
    env.CLASS_SALES = false
    expect(await reason(onSale.classId)).toBe('sales_off')
    env.CLASS_SALES = true
    env.CLASSES = false
    expect((await t.api('GET', `/api/checkout/classes/${onSale.classId}`, { token })).status).toBe(
      404,
    )
    env.CLASSES = true

    expect(await reason((await newClass({ status: 'draft' })).classId)).toBe('not_published')
    const cancelled = await newClass()
    await t.db
      .update(s.classes)
      .set({ status: 'cancelled', cancelledAt: t.now() })
      .where(eq(s.classes.id, cancelled.classId))
    expect(await reason(cancelled.classId)).toBe('cancelled')
    expect(
      await reason((await newClass({ blocks: [{ startMs: -MINUTE, endMs: 2 * HOUR }] })).classId),
    ).toBe('started')
    // the last block must end within 75 days: exactly 75 is on sale, a minute more is not
    const edge = SEAT_HORIZON_MS
    expect(
      await reason((await newClass({ blocks: [{ startMs: edge - HOUR, endMs: edge }] })).classId),
    ).toBe(true)
    expect(
      await reason(
        (await newClass({ blocks: [{ startMs: edge - HOUR, endMs: edge + MINUTE }] })).classId,
      ),
    ).toBe('too_far_ahead')

    // a profile that has not opted in, one that is leaving, one that cannot be paid
    const other = await t.createProfile('other-seller@example.com', { payable: true })
    const otherCourse = await t.createCourse(other.profile.id, {
      status: 'live',
      priceCents: 50000,
    })
    const otherClass = await newClass({ profile: other.profile.id, course: otherCourse.courseId })
    expect(await reason(otherClass.classId)).toBe('profile_not_opted_in')
    await t.optIn(other.profile.id)
    expect(await reason(otherClass.classId)).toBe(true)
    await t.db
      .update(s.payoutAccounts)
      .set({ chargesEnabled: false })
      .where(eq(s.payoutAccounts.id, other.payoutAccount?.id as string))
    expect(await reason(otherClass.classId)).toBe('account_not_payable')
    await t.db
      .update(s.payoutAccounts)
      .set({ chargesEnabled: true })
      .where(eq(s.payoutAccounts.id, other.payoutAccount?.id as string))
    await t.db
      .update(s.courses)
      .set({ status: 'draft' })
      .where(eq(s.courses.id, otherCourse.courseId))
    expect(await reason(otherClass.classId)).toBe('course_not_on_sale')
    await t.db
      .update(s.courses)
      .set({ status: 'live' })
      .where(eq(s.courses.id, otherCourse.courseId))
    const owner = await t.ensureUser('other-seller@example.com')
    await new ClassSalesService(t.deps).leave({
      role: 'owner',
      profileId: other.profile.id,
      userId: owner.id,
      profileType: 'personal',
      profileStatus: 'approved',
    })
    expect(await reason(otherClass.classId)).toBe('profile_leaving')

    // nothing was reserved by any refused start
    expect(await t.db.$count(s.enrollments, eq(s.enrollments.status, 'pending_payment'))).toBe(0)
    expect(
      (await t.api('GET', `/api/checkout/classes/00000000-0000-4000-8000-000000000000`, { token }))
        .status,
    ).toBe(404)
  })

  it('gives the checkout page the class, the quote, the seats left and the refund terms', async () => {
    const { classId } = await newClass({ seats: 12, venueAddress: '2 Clay Street' })
    const res = await t.api('GET', `/api/checkout/classes/${classId}`, {
      token: await t.learnerToken(learner()),
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      courseSlug,
      courseTitle: 'Wheel throwing',
      refundTermsVersion: REFUND_TERMS_VERSION,
      stripeFeeBps: 340,
      stripeFixedCents: 50,
      class: {
        id: classId,
        delivery: 'in_person',
        venueAddress: '2 Clay Street',
        timeZone: CLASS_TIME_ZONE,
        seatsLeft: 12,
        instructorName: ownerEmail,
      },
      quote: { quote: { amountCents: 50000, applicationFeeCents: 8988, teacherNetCents: 41012 } },
    })
    expect(res.body.class.blocks).toHaveLength(1)
  })

  it('refuses the profile’s own people, a free seat, a price under the minimum and old terms', async () => {
    const { classId } = await newClass()
    await t.addMember(profileId, 'class-writer@example.com', 'writer')
    for (const email of [ownerEmail, 'class-writer@example.com']) {
      const res = await start(classId, await t.learnerToken(email))
      expect(res.status, email).toBe(403)
      expect(res.body.error.code).toBe('own_class')
    }
    await t.db.insert(s.promoCodes).values([
      { code: 'FREECLASS', type: 'percent', value: 100, courseId },
      { code: 'ALMOSTFREE', type: 'fixed', value: 49950, courseId },
    ])
    const token = await t.learnerToken(learner())
    for (const [promoCode, status, code] of [
      ['FREECLASS', 422, 'class_requires_payment'],
      ['ALMOSTFREE', 422, 'below_minimum'],
    ] as const) {
      const viewed = await t.api('GET', `/api/checkout/classes/${classId}?promoCode=${promoCode}`, {
        token,
      })
      expect(viewed.status).toBe(status)
      expect(viewed.body.error.code).toBe(code)
      const started = await start(classId, token, { termsVersion: REFUND_TERMS_VERSION, promoCode })
      expect(started.status).toBe(status)
      expect(started.body.error.code).toBe(code)
    }
    const stale = await start(classId, token, { termsVersion: '2025-01' })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toMatchObject({
      code: 'terms_changed',
      details: { current: REFUND_TERMS_VERSION },
    })
    expect((await start(classId, token, {})).status).toBe(400)
    expect(await t.db.$count(s.enrollments, eq(s.enrollments.classId, classId))).toBe(0)
  })
})

describe('seats and reservations', () => {
  it('sells the last seat to one of two learners, and frees it when the reservation ends', async () => {
    const { classId } = await newClass({ seats: 1 })
    const a = learner()
    const b = learner()
    const first = await t.buySeat(a, classId, { pay: false })
    const refused = await start(classId, await t.learnerToken(b))
    expect(refused.status).toBe(409)
    expect(refused.body.error.code).toBe('class_full')
    const page = await t.api('GET', `/api/catalog/courses/${courseSlug}`)
    expect(page.body.course.classes.find((c: { id: string }) => c.id === classId)?.seatsLeft).toBe(
      0,
    )

    // A abandons the page: 35 minutes after it began, the seat is free again
    t.advanceClock(SEAT_RESERVATION_MS - 1)
    expect((await start(classId, await t.learnerToken(b))).status).toBe(409)
    t.advanceClock(1)
    const second = await t.buySeat(b, classId)
    expect(second.payment?.classId).toBe(classId)
    expect((await enrollmentOf(b, classId))?.status).toBe('active')
    const again = await start(classId, first.token)
    expect(again.body.error.code).toBe('class_full')
  })

  it('answers a second start during a reservation with the same page and the same end', async () => {
    const { classId } = await newClass()
    const email = learner()
    const first = await t.buySeat(email, classId, { pay: false })
    const before = await enrollmentOf(email, classId)
    t.advanceClock(10 * MINUTE)
    const again = await start(classId, first.token)
    expect(again.body).toMatchObject({ kind: 'redirect', sessionId: first.sessionId })
    const after = await enrollmentOf(email, classId)
    expect(after?.seatReservedUntil?.toISOString()).toBe(before?.seatReservedUntil?.toISOString())
    expect(after?.reservationCount).toBe(1)
    expect(t.payments.sessions.size).toBeGreaterThan(0)
  })

  it('refuses a fourth reservation of one class in 24 hours', async () => {
    const { classId } = await newClass({ blocks: [{ startMs: 20 * DAY, endMs: 20 * DAY + HOUR }] })
    const email = learner()
    const firstAt = t.now()
    const sessions: string[] = []
    for (let i = 0; i < 3; i++) {
      sessions.push((await t.buySeat(email, classId, { pay: false })).sessionId)
      t.advanceClock(SEAT_RESERVATION_MS + MINUTE)
    }
    expect(new Set(sessions).size).toBe(3)
    // each new page closed the one before it
    expect(sessions.slice(0, 2).every((id) => t.payments.sessions.get(id)?.expired)).toBe(true)
    const fourth = await start(classId, await t.learnerToken(email))
    expect(fourth.status).toBe(429)
    expect(fourth.body.error).toMatchObject({
      code: 'too_many_reservations',
      details: { retryAt: new Date(firstAt.getTime() + DAY).toISOString() },
    })
    t.setClock(new Date(firstAt.getTime() + DAY))
    expect((await start(classId, await t.learnerToken(email))).status).toBe(200)
    expect((await enrollmentOf(email, classId))?.reservationCount).toBe(1)
  })

  it('ends a reservation in another class of the course when the learner starts paying for a second', async () => {
    const x = await newClass()
    const y = await newClass({ blocks: [{ startMs: 21 * DAY, endMs: 21 * DAY + HOUR }] })
    const email = learner()
    const first = await t.buySeat(email, x.classId, { pay: false })
    await t.buySeat(email, y.classId, { pay: false })
    const ended = await enrollmentOf(email, x.classId)
    expect(ended?.status).toBe('pending_payment')
    expect(ended?.seatReservedUntil?.toISOString()).toBe(t.now().toISOString())
    expect(t.payments.sessions.get(first.sessionId)?.expired).toBe(true)
    expect((await enrollmentOf(email, y.classId))?.seatReservedUntil?.getTime()).toBe(
      t.now().getTime() + SEAT_RESERVATION_MS,
    )
  })

  it('lets a learner who owns the self-paced course buy a seat and keep both', async () => {
    const { classId } = await newClass()
    const email = learner()
    const selfPaced = await t.enrol(email, courseId)
    const seat = await t.buySeat(email, classId)
    expect(seat.payment?.status).toBe('succeeded')
    expect(t.payments.refunds).toEqual([])
    expect((await t.db.query.enrollments.findFirst({ where: { id: selfPaced.id } }))?.status).toBe(
      'active',
    )
    expect((await enrollmentOf(email, classId))?.status).toBe('active')
    const page = await t.api('GET', `/api/catalog/courses/${courseSlug}`, { token: seat.token })
    expect(page.body.course.viewer).toMatchObject({ enrollmentId: selfPaced.id, status: 'active' })
    expect(page.body.course.viewerClassSeats).toEqual([
      { classId, enrollmentId: seat.enrollmentId, status: 'active' },
    ])
    // a second start for the same class is refused: the seat is theirs
    const again = await start(classId, seat.token)
    expect(again.status).toBe(409)
    expect(again.body.error).toMatchObject({
      code: 'already_in_class',
      details: { enrollmentId: seat.enrollmentId },
    })
  })

  it('lists the course’s classes that are on sale, full ones with no seats left', async () => {
    const other = await t.createCourse(profileId, { status: 'live', priceCents: 50000 })
    const open = await newClass({ course: other.courseId, seats: 3 })
    const full = await newClass({
      course: other.courseId,
      seats: 1,
      blocks: [{ startMs: 15 * DAY, endMs: 15 * DAY + HOUR }],
    })
    await newClass({ course: other.courseId, status: 'draft' })
    await t.buySeat(learner(), full.classId)
    const page = await t.api('GET', `/api/catalog/courses/${other.slug}`)
    expect(
      page.body.course.classes.map((c: { id: string; seatsLeft: number }) => [c.id, c.seatsLeft]),
    ).toEqual([
      [open.classId, 3],
      [full.classId, 0],
    ])
    expect(page.body.course.viewerClassSeats).toEqual([])
    expect(page.body.course.viewer).toBeNull()
  })
})

describe('the payment page', () => {
  it('allows cards and PayNow only, hides Link, and carries the class and the terms', async () => {
    const { classId } = await newClass()
    const email = learner()
    const token = await t.learnerToken(email)
    const res = await start(classId, token, { termsVersion: REFUND_TERMS_VERSION, locale: 'zh' })
    expect(res.body.kind).toBe('redirect')
    const session = t.payments.sessions.get(res.body.sessionId)
    const enrollment = await enrollmentOf(email, classId)
    expect(session).toMatchObject({
      allowedPaymentMethods: ['card', 'paynow'],
      hideLink: true,
      productName: expect.stringContaining('Wheel throwing'),
      amountCents: 50000,
      applicationFeeCents: 8988,
      successUrl: 'http://learner.test/checkout/success?session_id={CHECKOUT_SESSION_ID}&lang=zh',
      cancelUrl: `http://learner.test/course/${courseSlug}?class=${classId}&checkout=cancelled&lang=zh`,
    })
    expect(session?.metadata).toMatchObject({
      enrollmentId: enrollment?.id,
      courseId,
      classId,
      refundTermsVersion: REFUND_TERMS_VERSION,
      amountCents: '50000',
      teacherNetCents: '41012',
      locale: 'zh',
    })
    expect(enrollment).toMatchObject({
      status: 'pending_payment',
      refundTermsVersion: REFUND_TERMS_VERSION,
      stripeCheckoutSessionId: res.body.sessionId,
    })
    // PayNow is one of the two
    await t.stripeWebhook(t.payments.completeCheckout(res.body.sessionId, 'paynow'))
    expect((await enrollmentOf(email, classId))?.status).toBe('active')
  })
})

describe('fulfilment', () => {
  it('activates the seat, records the class on the payment and sends the class receipt in the learner’s language', async () => {
    const { classId } = await newClass({ name: 'Clay class', venueAddress: '2 Clay Street' })
    const email = learner()
    await t.learnerToken(email)
    const user = await t.ensureUser(email)
    await t.db.update(s.users).set({ locale: 'zh' }).where(eq(s.users.id, user.id))
    const course = await t.db.query.courses.findFirst({ where: { id: courseId } })
    await t.db
      .insert(s.promoCodes)
      .values({ code: 'CLASS10', type: 'percent', value: 10, courseId })
    t.mailer.sent.length = 0
    const seat = await t.buySeat(email, classId, { promoCode: 'CLASS10' })
    expect(seat.payment).toMatchObject({ classId, amountCents: 45000, discountCents: 5000 })
    const enrollment = await enrollmentOf(email, classId)
    expect(enrollment).toMatchObject({
      status: 'active',
      seatReservedUntil: null,
      stripeCheckoutSessionId: seat.sessionId,
    })
    // a class seat is not an enrolment in the course, and the promo code counts once
    expect((await t.db.query.courses.findFirst({ where: { id: courseId } }))?.enrolCount).toBe(
      course?.enrolCount,
    )
    expect(
      (await t.db.query.promoCodes.findFirst({ where: { code: 'CLASS10' } }))?.redeemedCount,
    ).toBe(1)
    expect(await sync(seat.sessionId, seat.token)).toEqual({
      status: 'paid',
      enrollmentId: seat.enrollmentId,
      courseSlug,
      classId,
    })

    const mails = t.mailer.sent.filter((m) => m.to === email)
    expect(mails).toHaveLength(1)
    const mail = mails[0]
    expect(mail?.subject).toBe(
      translate('zh', 'email.classReceipt.title', { className: 'Clay class' }),
    )
    expect(mail?.html).toContain('<html lang="zh">')
    expect(mail?.html).toContain(
      escapeHtml(translate('zh', 'email.classReceipt.where', { address: '2 Clay Street' })),
    )
    expect(mail?.text).toContain('S$450.00')
    expect(mail?.text).toContain(`http://learner.test/class/${seat.enrollmentId}`)
    expect(mail?.text).not.toContain(translate('zh', 'email.receipt.start'))
  })

  it('writes the class, the times, the place and the terms into an English receipt', async () => {
    const { classId } = await newClass({ name: 'Saturday mornings' })
    const email = learner()
    await t.learnerToken(email)
    t.mailer.sent.length = 0
    const seat = await t.buySeat(email, classId)
    const mail = t.mailer.sent.find((m) => m.to === email)
    const start = new Date(t.now().getTime() + 14 * DAY)
    const local = instantToZoned(start, CLASS_TIME_ZONE)
    expect(mail?.subject).toBe('Your seat is booked: Saturday mornings')
    expect(mail?.text).toContain(
      'You paid S$500.00 for a seat in "Saturday mornings", a class of "Wheel throwing" by Mei Lin.',
    )
    expect(mail?.text).toContain('Singapore Standard Time')
    expect(mail?.text).toContain(`${local.time}–`)
    expect(mail?.text).toContain('Where: 1 Fixture Road')
    // the deadline with its time and time zone, as the checkout page states it
    expect(mail?.text).toMatch(
      /You can withdraw until \w+, \d+ \w+ \d{4}, \d{1,2}:\d{2}\s(am|pm) SGT, as long/,
    )
    expect(mail?.text).toContain(`View your class: http://learner.test/class/${seat.enrollmentId}`)
  })

  it('gives a late payment the seat when one is free and the class has not started', async () => {
    const { classId } = await newClass({ seats: 1 })
    const email = learner()
    const first = await t.buySeat(email, classId, { pay: false })
    t.advanceClock(SEAT_RESERVATION_MS + HOUR)
    await pay(first.sessionId)
    expect((await enrollmentOf(email, classId))?.status).toBe('active')
    expect(await sync(first.sessionId, first.token)).toMatchObject({ status: 'paid', classId })
  })

  it('after the class starts, gives a late payment the seat only if Stripe took it inside the reservation', async () => {
    // inside: paid at 10 minutes, reported after the class began
    const inside = await newClass({ blocks: [{ startMs: 20 * MINUTE, endMs: 3 * HOUR }] })
    const a = learner()
    const at = t.now()
    const paidA = await t.buySeat(a, inside.classId, { pay: false })
    t.advanceClock(SEAT_RESERVATION_MS + 5 * MINUTE)
    await pay(paidA.sessionId, new Date(at.getTime() + 10 * MINUTE))
    expect((await enrollmentOf(a, inside.classId))?.status).toBe('active')

    // outside: Stripe gives no time inside the reservation
    const outside = await newClass({ blocks: [{ startMs: 20 * MINUTE, endMs: 3 * HOUR }] })
    const b = learner()
    const paidB = await t.buySeat(b, outside.classId, { pay: false })
    t.advanceClock(SEAT_RESERVATION_MS + 5 * MINUTE)
    t.mailer.sent.length = 0
    await pay(paidB.sessionId)
    expect((await enrollmentOf(b, outside.classId))?.status).toBe('pending_payment')
    await expectSeatLost(paidB.sessionId, b, outside.classId)
  })

  it('returns a late payment when the class filled meanwhile', async () => {
    const { classId } = await newClass({ seats: 1 })
    const late = learner()
    const lateSeat = await t.buySeat(late, classId, { pay: false })
    t.advanceClock(SEAT_RESERVATION_MS + MINUTE)
    const winner = await t.buySeat(learner(), classId)
    expect(winner.payment?.classId).toBe(classId)
    t.mailer.sent.length = 0
    const hook = await pay(lateSeat.sessionId)
    expect(hook.body.outcome).toBe('applied')
    expect((await enrollmentOf(late, classId))?.status).toBe('pending_payment')
    await expectSeatLost(lateSeat.sessionId, late, classId)
    // the webhook again records nothing more
    expect((await pay(lateSeat.sessionId)).status).toBe(200)
    expect(await t.db.$count(s.seatRefunds, eq(s.seatRefunds.classId, classId))).toBe(1)
  })

  it('returns a payment that arrives after the class was cancelled, even inside the reservation', async () => {
    const { classId } = await newClass()
    const email = learner()
    const seat = await t.buySeat(email, classId, { pay: false })
    await t.db
      .update(s.classes)
      .set({ status: 'cancelled', cancelledAt: t.now() })
      .where(eq(s.classes.id, classId))
    t.mailer.sent.length = 0
    await pay(seat.sessionId)
    expect((await enrollmentOf(email, classId))?.status).toBe('pending_payment')
    await expectSeatLost(seat.sessionId, email, classId)
  })

  it('returns a second payment for a seat that is already active, without the duplicate refund', async () => {
    const { classId } = await newClass()
    const email = learner()
    const first = await t.buySeat(email, classId, { pay: false })
    t.advanceClock(SEAT_RESERVATION_MS + MINUTE)
    // the first page could not be closed when checkout started again
    t.payments.failNext('expireCheckoutSession', 'retryable')
    const second = await t.buySeat(email, classId)
    expect(second.sessionId).not.toBe(first.sessionId)
    expect((await enrollmentOf(email, classId))?.stripeCheckoutSessionId).toBe(second.sessionId)
    t.mailer.sent.length = 0
    await pay(first.sessionId)
    const enrollment = await enrollmentOf(email, classId)
    expect(enrollment).toMatchObject({
      status: 'active',
      stripeCheckoutSessionId: second.sessionId,
    })
    await expectSeatLost(first.sessionId, email, classId)
    expect(await sync(second.sessionId, second.token)).toMatchObject({ status: 'paid', classId })
  })

  it('records a second lost seat of one learner once the first one’s refund is finished', async () => {
    const { classId } = await newClass({ seats: 1 })
    const email = learner()
    const first = await t.buySeat(email, classId, { pay: false })
    t.advanceClock(SEAT_RESERVATION_MS + MINUTE)
    t.payments.failNext('expireCheckoutSession', 'retryable')
    const second = await t.buySeat(email, classId, { pay: false })
    t.advanceClock(SEAT_RESERVATION_MS + MINUTE)
    await t.buySeat(learner(), classId)
    await pay(first.sessionId)
    // the seat already has an unfinished refund row, so the second loss cannot be written yet
    const event = t.payments.completeCheckout(second.sessionId)
    const refused = await t.stripeWebhook(event)
    expect(refused.status).toBe(500)
    expect(
      await t.db.query.payments.findFirst({ where: { stripeCheckoutSessionId: second.sessionId } }),
    ).toBeUndefined()
    expect(await sync(second.sessionId, second.token)).toEqual({ status: 'pending' })
    // once the first row is done, Stripe's redelivery records it
    await t.db
      .update(s.seatRefunds)
      .set({ status: 'done', completedAt: t.now() })
      .where(eq(s.seatRefunds.classId, classId))
    expect((await t.stripeWebhook(event)).status).toBe(200)
    t.mailer.sent.length = 0
    await expectSeatLost(second.sessionId, email, classId)
  })
})

describe('the Teach class page and edits once seats are sold', () => {
  const teachToken = () => t.signIn(ownerEmail, 'teach').then((r) => r.token as string)
  let token: string
  beforeAll(async () => {
    token = await teachToken()
  })
  const classPath = (classId: string) => `/api/teach/profiles/${profileId}/classes/${classId}`
  const blocksOf = async (classId: string) =>
    (
      await t.db.query.classBlocks.findMany({ where: { classId }, orderBy: { position: 'asc' } })
    ).map((b) => ({ id: b.id, startsAt: b.startsAt, endsAt: b.endsAt }))
  const asInput = (block: { id?: string; startsAt: Date; endsAt: Date }) => {
    const from = instantToZoned(block.startsAt, CLASS_TIME_ZONE)
    const to = instantToZoned(block.endsAt, CLASS_TIME_ZONE)
    return {
      ...(block.id ? { id: block.id } : {}),
      date: from.date,
      startTime: from.time,
      endTime: to.time,
    }
  }

  it('says why a class is not on sale and counts the seats taken', async () => {
    const { classId } = await newClass({ seats: 5 })
    await t.buySeat(learner(), classId)
    await t.buySeat(learner(), classId, { pay: false })
    const detail = (await t.api('GET', classPath(classId), { token })).body.class
    expect(detail).toMatchObject({
      notOnSaleReason: null,
      cancelReason: null,
      cancelledAt: null,
      seatsTaken: 2,
      seatsWithChangeRight: 1,
    })
    const draft = await newClass({ status: 'draft' })
    expect((await t.api('GET', classPath(draft.classId), { token })).body.class).toMatchObject({
      notOnSaleReason: 'not_published',
      seatsTaken: 0,
    })
  })

  it('refuses a capacity below the seats taken', async () => {
    const { classId } = await newClass({ seats: 5 })
    await t.buySeat(learner(), classId)
    await t.buySeat(learner(), classId, { pay: false })
    const low = await t.api('PATCH', classPath(classId), { token, body: { seats: 1 } })
    expect(low.status).toBe(422)
    expect(low.body.error).toMatchObject({ code: 'capacity_below_taken', details: { taken: 2 } })
    expect((await t.api('PATCH', classPath(classId), { token, body: { seats: 2 } })).status).toBe(
      200,
    )
  })

  it('gives each seat holder the right to withdraw in full when a block’s time changes, and tells them', async () => {
    const { classId } = await newClass({ name: 'Evening wheel' })
    const a = learner()
    const b = learner()
    const seatA = await t.buySeat(a, classId)
    const seatB = await t.buySeat(b, classId)
    const [block] = await blocksOf(classId)
    if (!block) throw new Error('no block')
    // a change of name alone tells nobody
    t.mailer.sent.length = 0
    await t.api('PATCH', classPath(classId), { token, body: { name: 'Evening wheel' } })
    expect(t.mailer.sent).toEqual([])

    const moved = {
      ...block,
      startsAt: new Date(block.startsAt.getTime() + DAY),
      endsAt: new Date(block.endsAt.getTime() + DAY),
    }
    const res = await t.api('PATCH', classPath(classId), {
      token,
      body: { blocks: [asInput(moved)] },
    })
    expect(res.status).toBe(200)
    expect(res.body.class.seatsWithChangeRight).toBe(2)
    for (const seat of [seatA, seatB]) {
      expect(
        (
          await t.db.query.enrollments.findFirst({ where: { id: seat.enrollmentId } })
        )?.classChangedAt?.toISOString(),
      ).toBe(t.now().toISOString())
    }
    const mails = t.mailer.sent.filter((m) => m.to === a || m.to === b)
    expect(mails).toHaveLength(2)
    expect(mails[0]?.subject).toBe('New times for Evening wheel')
    expect(mails[0]?.text).toContain('The times were')
    expect(mails[0]?.text).toContain(translate('en', 'email.classTimesChanged.withdraw'))
    expect(mails[0]?.text).toContain(`http://learner.test/class/`)
    const audit = await t.db.query.auditLog.findFirst({
      where: { action: 'class.times_changed', entityId: classId },
    })
    expect(audit?.metadata).toMatchObject({ seats: 2, withdrawRight: 2 })
  })

  it('refuses a time edit that would end the class more than 75 days after a seat’s payment', async () => {
    const { classId } = await newClass()
    const seat = await t.buySeat(learner(), classId)
    const paidAt = seat.payment?.paidAt as Date
    const [block] = await blocksOf(classId)
    if (!block) throw new Error('no block')
    const tooLate = {
      startsAt: new Date(paidAt.getTime() + SEAT_HORIZON_MS),
      endsAt: new Date(paidAt.getTime() + SEAT_HORIZON_MS + HOUR),
    }
    t.mailer.sent.length = 0
    const res = await t.api('PATCH', classPath(classId), {
      token,
      body: { blocks: [asInput(block), asInput(tooLate)] },
    })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatchObject({
      code: 'class_too_late_for_seat',
      details: { latestEndsAt: new Date(paidAt.getTime() + SEAT_HORIZON_MS).toISOString() },
    })
    expect(await blocksOf(classId)).toHaveLength(1)
    expect(t.mailer.sent).toEqual([])
    expect(
      (await t.db.query.enrollments.findFirst({ where: { id: seat.enrollmentId } }))
        ?.classChangedAt,
    ).toBeNull()
  })

  it('gives no right to withdraw for an edit after the class started, and still tells the learners', async () => {
    const { classId } = await newClass({
      blocks: [
        { startMs: 2 * HOUR, endMs: 3 * HOUR },
        { startMs: 7 * DAY, endMs: 7 * DAY + HOUR },
      ],
    })
    const email = learner()
    const seat = await t.buySeat(email, classId)
    t.advanceClock(4 * HOUR)
    const [first, second] = await blocksOf(classId)
    if (!first || !second) throw new Error('no blocks')
    t.mailer.sent.length = 0
    const later = {
      ...second,
      startsAt: new Date(second.startsAt.getTime() + DAY),
      endsAt: new Date(second.endsAt.getTime() + DAY),
    }
    const res = await t.api('PATCH', classPath(classId), {
      token,
      body: { blocks: [asInput(first), asInput(later)] },
    })
    expect(res.status).toBe(200)
    expect(res.body.class.seatsWithChangeRight).toBe(0)
    expect(
      (await t.db.query.enrollments.findFirst({ where: { id: seat.enrollmentId } }))
        ?.classChangedAt,
    ).toBeNull()
    const mail = t.mailer.sent.find((m) => m.to === email)
    expect(mail?.text).not.toContain(translate('en', 'email.classTimesChanged.withdraw'))
  })
})
