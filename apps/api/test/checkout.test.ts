import { ANALYTICS_EVENTS, type AnalyticsEventName } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { seedDatabase } from '@elevate/db/seed'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
let learner: string
let sourdoughId: string

const stripePost = (event: unknown) =>
  t.app.request('/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 'fake-valid' },
    body: JSON.stringify(event),
  })

beforeAll(async () => {
  t = await createTestApp()
  await seedDatabase(t.db, { superAdminEmail: 'admin@test.local', mode: 'demo', storage: null })
  learner = (await t.signIn('buyer@example.com')).token as string
  const course = await t.db.query.courses.findFirst({
    where: { slug: 'sourdough-from-scratch' },
  })
  sourdoughId = course?.id as string
  // the course's profile must be payable: give it an active payout account with charges enabled
  await t.makePayable(course?.profileId as string)
})
afterAll(async () => {
  await t.close()
})

describe('catalogue', () => {
  it('lists live courses with filters, search and sorting', async () => {
    const all = await t.api('GET', '/api/catalog/courses?limit=50')
    expect(all.status).toBe(200)
    expect(all.body.items.length).toBe(6)
    expect(all.body.items.every((c: { publishedAt: string | null }) => c.publishedAt)).toBe(true)
    const food = await t.api('GET', '/api/catalog/courses?category=food-drink')
    expect(food.body.items.map((c: { slug: string }) => c.slug)).toEqual(['sourdough-from-scratch'])
    const search = await t.api('GET', '/api/catalog/courses?q=mei%20lin')
    expect(search.body.items.length).toBe(2)
    const popular = await t.api('GET', '/api/catalog/courses?sort=popular')
    expect(popular.body.items[0].slug).toBe('sourdough-from-scratch')
    const paged = await t.api('GET', '/api/catalog/courses?limit=2')
    expect(paged.body.items).toHaveLength(2)
    expect(paged.body.nextCursor).toBeTruthy()
    const next = await t.api('GET', `/api/catalog/courses?limit=2&cursor=${paged.body.nextCursor}`)
    expect(next.body.items[0].id).not.toBe(paged.body.items[0].id)
    const categories = await t.api('GET', '/api/catalog/categories')
    expect(
      categories.body.items.find((c: { slug: string }) => c.slug === 'craft-making').count,
    ).toBe(2)
  })

  it('serves a public course detail with syllabus and hides drafts', async () => {
    const detail = await t.api('GET', '/api/catalog/courses/sourdough-from-scratch')
    expect(detail.status).toBe(200)
    expect(detail.body.course.lessons).toHaveLength(3)
    expect(detail.body.course.lessons[1].prerequisiteIds).toHaveLength(1)
    expect(detail.body.course.lessons[0].artefacts[0]).not.toHaveProperty('contentJson')
    expect(detail.body.course.viewer).toBeNull()
    expect(detail.body.course.teacher.displayName).toBe('Daniel Goh')
    expect((await t.api('GET', '/api/catalog/courses/raku-firing-weekend')).status).toBe(404)
  })
})

describe('checkout', () => {
  it('quotes with and without a promo code', async () => {
    const plain = await t.api('POST', '/api/checkout/quote', {
      token: learner,
      body: { courseId: sourdoughId },
    })
    expect(plain.status).toBe(200)
    expect(plain.body.quote.amountCents).toBe(8900)
    expect(plain.body.promo).toBeNull()
    const promo = await t.api('POST', '/api/checkout/quote', {
      token: learner,
      body: { courseId: sourdoughId, promoCode: 'welcome10' },
    })
    expect(promo.body.quote.discountCents).toBe(890)
    expect(promo.body.quote.amountCents).toBe(8010)
    expect(promo.body.promo.code).toBe('WELCOME10')
    const wrong = await t.api('POST', '/api/checkout/quote', {
      token: learner,
      body: { courseId: sourdoughId, promoCode: 'CERAMICS20' },
    })
    expect(wrong.status).toBe(400)
    // each promo failure has its own code, so the app can word it
    expect(wrong.body.error.code).toBe('promo_wrong_course')
    expect(
      (
        await t.api('POST', '/api/checkout/quote', {
          token: learner,
          body: { courseId: sourdoughId, promoCode: 'NOPE123' },
        })
      ).status,
    ).toBe(400)
  })

  it('starts a Stripe checkout, fulfils via webhook once, and syncs idempotently', async () => {
    const start = await t.api('POST', `/api/checkout/courses/${sourdoughId}`, {
      token: learner,
      body: { promoCode: 'WELCOME10' },
    })
    expect(start.status).toBe(200)
    expect(start.body.kind).toBe('redirect')
    expect(start.body.url).toContain('checkout.fake-stripe.test')
    const sessionId: string = start.body.sessionId

    const pending = await t.api('GET', `/api/checkout/sessions/${sessionId}/sync`, {
      token: learner,
    })
    expect(pending.body.status).toBe('pending')
    expect((await t.api('GET', '/api/me/enrollments', { token: learner })).body.items).toHaveLength(
      0,
    )

    // retrying checkout reuses the pending enrollment and session
    const again = await t.api('POST', `/api/checkout/courses/${sourdoughId}`, {
      token: learner,
      body: { promoCode: 'WELCOME10' },
    })
    expect(again.body.sessionId).toBe(sessionId)

    const event = t.payments.completeCheckout(sessionId)
    const hook = await stripePost(event)
    expect(await hook.json()).toMatchObject({ outcome: 'applied' })

    const payment = await t.db.query.payments.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
    })
    expect(payment?.amountCents).toBe(8010)
    expect(payment?.discountCents).toBe(890)
    expect(payment?.stripeFeeEstimateCents).toBe(322)
    expect(payment?.stripeFeeActualCents).toBe(322)
    expect(payment?.commissionCents).toBe(Math.round((8010 - 322) * 0.15))
    expect(payment?.applicationFeeCents).toBe(8010 - (payment?.teacherNetCents ?? 0))
    expect(payment?.stripeTransferId).toContain('tr_')
    expect(t.mailer.last()?.subject).toContain("You're enrolled")

    const course = await t.db.query.courses.findFirst({ where: { id: sourdoughId } })
    expect(course?.enrolCount).toBe(2) // seed learner + this purchase
    const promo = await t.db.query.promoCodes.findFirst({
      where: { code: 'WELCOME10' },
    })
    expect(promo?.redeemedCount).toBe(1)

    const replay = await stripePost(event)
    expect(await replay.json()).toMatchObject({ duplicate: true })
    const synced = await t.api('GET', `/api/checkout/sessions/${sessionId}/sync`, {
      token: learner,
    })
    expect(synced.body).toMatchObject({ status: 'paid', courseSlug: 'sourdough-from-scratch' })
    expect(await t.db.$count(s.payments)).toBe(1)

    const mine = await t.api('GET', '/api/me/enrollments', { token: learner })
    expect(mine.body.items).toHaveLength(1)
    expect(mine.body.items[0].course.slug).toBe('sourdough-from-scratch')
    expect(mine.body.items[0].progress.totalArtefacts).toBe(5)

    const detail = await t.api('GET', '/api/catalog/courses/sourdough-from-scratch', {
      token: learner,
    })
    expect(detail.body.course.viewer.status).toBe('active')
    expect(
      (await t.api('POST', `/api/checkout/courses/${sourdoughId}`, { token: learner, body: {} }))
        .status,
    ).toBe(409)
  })

  it('refuses teachers who cannot be paid, and enrols free courses directly', async () => {
    const figma = await t.db.query.courses.findFirst({
      where: { slug: 'figma-to-prototype' },
    })
    const blocked = await t.api('POST', `/api/checkout/courses/${figma?.id}`, {
      token: learner,
      body: {},
    })
    expect(blocked.status).toBe(409)
    expect(blocked.body.error.code).toBe('teacher_not_payable')

    await t.db
      .update(s.courses)
      .set({ priceCents: 0 })
      .where(eq(s.courses.id, figma?.id as string))
    const free = await t.api('POST', `/api/checkout/courses/${figma?.id}`, {
      token: learner,
      body: {},
    })
    expect(free.status).toBe(200)
    expect(free.body.kind).toBe('enrolled')
    const mine = await t.api('GET', '/api/me/enrollments', { token: learner })
    expect(mine.body.items.map((e: { course: { slug: string } }) => e.course.slug).sort()).toEqual([
      'figma-to-prototype',
      'sourdough-from-scratch',
    ])
  })
})

describe('error codes a learner can see', () => {
  const quote = (promoCode: string) =>
    t.api('POST', '/api/checkout/quote', {
      token: learner,
      body: { courseId: sourdoughId, promoCode },
    })

  it('gives a promo code that has not started its own code', async () => {
    await t.db.insert(s.promoCodes).values({
      code: 'LATER50',
      type: 'percent',
      value: 50,
      startsAt: new Date('2099-01-01T00:00:00.000Z'),
    })
    const res = await quote('LATER50')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('promo_not_started')
  })

  it('sends the minimum charge as data when a promo takes the price below it', async () => {
    await t.db.insert(s.promoCodes).values({ code: 'ALMOSTFREE', type: 'fixed', value: 8850 })
    const { token } = await t.signIn('below-minimum@example.com')
    const res = await t.api('POST', `/api/checkout/courses/${sourdoughId}`, {
      token: token as string,
      body: { promoCode: 'ALMOSTFREE' },
    })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatchObject({ code: 'below_minimum', details: { minimumCents: 100 } })
  })
})

describe('checkout language', () => {
  async function buyer(email: string) {
    const r = await t.signIn(email)
    return { token: r.token as string, userId: r.body.user.id as string }
  }

  async function start(token: string, courseId: string, body: Record<string, unknown>) {
    const r = await t.api('POST', `/api/checkout/courses/${courseId}`, { token, body })
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    return r.body
  }

  async function eventProps(userId: string, name: AnalyticsEventName) {
    const events = await t.db.query.analyticsEvents.findMany({ where: { name, userId } })
    expect(events).toHaveLength(1)
    return events[0]?.properties
  }

  it('sends the language to Stripe, the metadata and both return URLs', async () => {
    const { token, userId } = await buyer('zh-buyer@example.com')
    const { sessionId } = await start(token, sourdoughId, { locale: 'zh' })
    const session = t.payments.sessions.get(sessionId)
    expect(session?.locale).toBe('zh')
    expect(session?.metadata.locale).toBe('zh')
    expect(session?.successUrl).toMatch(/\?session_id=\{CHECKOUT_SESSION_ID\}&lang=zh$/)
    expect(session?.cancelUrl).toMatch(/\?checkout=cancelled&lang=zh$/)
    expect(await eventProps(userId, ANALYTICS_EVENTS.checkoutStarted)).toMatchObject({
      locale: 'zh',
    })

    // completed by the webhook: the language comes back from the session's metadata
    expect(await (await stripePost(t.payments.completeCheckout(sessionId))).json()).toMatchObject({
      outcome: 'applied',
    })
    expect(await eventProps(userId, ANALYTICS_EVENTS.checkoutCompleted)).toMatchObject({
      locale: 'zh',
    })
  })

  it('adds no language when the request sends none', async () => {
    const { token, userId } = await buyer('no-locale-buyer@example.com')
    const { sessionId } = await start(token, sourdoughId, {})
    const session = t.payments.sessions.get(sessionId)
    expect(session?.locale).toBeUndefined()
    expect(session?.metadata).not.toHaveProperty('locale')
    expect(session?.successUrl).not.toContain('lang=')
    expect(session?.cancelUrl).not.toContain('lang=')
    expect(await eventProps(userId, ANALYTICS_EVENTS.checkoutStarted)).toMatchObject({
      locale: null,
    })
    await stripePost(t.payments.completeCheckout(sessionId))
    expect(await eventProps(userId, ANALYTICS_EVENTS.checkoutCompleted)).toMatchObject({
      locale: null,
    })
  })

  it('opens a new Stripe session when the language changes between attempts', async () => {
    const { token } = await buyer('switcher@example.com')
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await start(token, sourdoughId, { locale: 'en' })
    expect(en.sessionId).not.toBe(zh.sessionId)
    const first = t.payments.sessions.get(zh.sessionId)
    const second = t.payments.sessions.get(en.sessionId)
    expect(second?.enrollmentId).toBe(first?.enrollmentId)
    expect(second?.idempotencyKey).not.toBe(first?.idempotencyKey)
    // the same language again reuses the open session
    expect((await start(token, sourdoughId, { locale: 'en' })).sessionId).toBe(en.sessionId)
  })

  async function enrollmentOf(sessionId: string) {
    const id = t.payments.sessions.get(sessionId)?.enrollmentId
    expect(id).toBeDefined()
    return t.db.query.enrollments.findFirst({ where: { id: id as string } })
  }

  async function paymentsOf(userId: string) {
    // paidAt comes from the test clock, which stands still; createdAt is the database's time
    return t.db.query.payments.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
  }

  async function paymentFor(sessionId: string) {
    return t.db.query.payments.findFirst({ where: { stripeCheckoutSessionId: sessionId } })
  }

  async function enrolCount() {
    const course = await t.db.query.courses.findFirst({ where: { id: sourdoughId } })
    return course?.enrolCount as number
  }

  /** Starts checkout while Stripe refuses to expire sessions, so the replaced one stays payable. */
  async function startWithoutExpiry(token: string, body: Record<string, unknown>) {
    const expire = t.payments.expireCheckoutSession
    t.payments.expireCheckoutSession = async () => {
      throw new Error('Stripe is unreachable')
    }
    try {
      return await start(token, sourdoughId, body)
    } finally {
      t.payments.expireCheckoutSession = expire
    }
  }

  it('closes the earlier session when checkout starts again in another language', async () => {
    const { token } = await buyer('closes-first-tab@example.com')
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await start(token, sourdoughId, { locale: 'en' })
    expect(t.payments.sessions.get(zh.sessionId)?.expired).toBe(true)
    expect(t.payments.sessions.get(en.sessionId)?.expired).toBe(false)
    expect(() => t.payments.completeCheckout(zh.sessionId)).toThrow(/expired/)
    expect((await enrollmentOf(en.sessionId))?.stripeCheckoutSessionId).toBe(en.sessionId)
    // the first tab's success page now reports the session as expired
    const synced = await t.api('GET', `/api/checkout/sessions/${zh.sessionId}/sync`, { token })
    expect(synced.body.status).toBe('expired')
  })

  it('opens a fresh session when the learner switches back to the first language', async () => {
    const { token } = await buyer('switches-back@example.com')
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await start(token, sourdoughId, { locale: 'en' })
    const back = await start(token, sourdoughId, { locale: 'zh' })
    expect(new Set([zh.sessionId, en.sessionId, back.sessionId]).size).toBe(3)
    expect(t.payments.sessions.get(en.sessionId)?.expired).toBe(true)
    const keys = [zh, en, back].map((x) => t.payments.sessions.get(x.sessionId)?.idempotencyKey)
    expect(new Set(keys).size).toBe(3)
    // and a plain retry goes back to the open session
    expect((await start(token, sourdoughId, { locale: 'zh' })).sessionId).toBe(back.sessionId)
  })

  it('keeps a payment made in the earlier tab before checkout started again', async () => {
    const { token, userId } = await buyer('paid-first-tab@example.com')
    const before = await enrolCount()
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    // paid in the first tab; its webhook has not arrived yet
    t.payments.completeCheckout(zh.sessionId)
    const restarted = await start(token, sourdoughId, { locale: 'en' })
    expect(restarted.kind).toBe('enrolled')
    const enrollment = await enrollmentOf(zh.sessionId)
    expect(enrollment).toMatchObject({ status: 'active', stripeCheckoutSessionId: zh.sessionId })
    expect(await paymentsOf(userId)).toHaveLength(1)
    expect(await enrolCount()).toBe(before + 1)
    // the session opened for the restart is closed again, unpaid
    const opened = [...t.payments.sessions.values()].filter(
      (x) => x.enrollmentId === enrollment?.id && x.id !== zh.sessionId,
    )
    expect(opened.every((x) => x.expired && !x.paid)).toBe(true)
    expect(await eventProps(userId, ANALYTICS_EVENTS.checkoutCompleted)).toMatchObject({
      locale: 'zh',
    })
    // the webhook that arrives later changes nothing
    const hook = await stripePost(t.payments.completeCheckout(zh.sessionId))
    expect(((await hook.json()) as { outcome: string }).outcome).toBe('ignored')
  })

  it("credits a paid earlier session with its own promo code, not the restart's", async () => {
    const { token, userId } = await buyer('promo-after-paying@example.com')
    const welcome = await t.db.query.promoCodes.findFirst({ where: { code: 'WELCOME10' } })
    const plain = await start(token, sourdoughId, { locale: 'en' })
    t.payments.completeCheckout(plain.sessionId)
    const restarted = await start(token, sourdoughId, { locale: 'en', promoCode: 'WELCOME10' })
    expect(restarted.kind).toBe('enrolled')
    const [payment] = await paymentsOf(userId)
    expect(payment?.promoCodeId).toBeNull()
    const after = await t.db.query.promoCodes.findFirst({ where: { code: 'WELCOME10' } })
    expect(after?.redeemedCount).toBe(welcome?.redeemedCount)
    expect((await enrollmentOf(plain.sessionId))?.promoCodeId).toBeNull()
  })

  it('keeps no promo code on an earlier session paid after a restart that applied one', async () => {
    const { token, userId } = await buyer('promo-then-old-tab@example.com')
    const welcome = await t.db.query.promoCodes.findFirst({ where: { code: 'WELCOME10' } })
    const plain = await start(token, sourdoughId, { locale: 'en' })
    // like Stripe, the session stores no promoCodeId key at all
    expect(t.payments.sessions.get(plain.sessionId)?.metadata).not.toHaveProperty('promoCodeId')
    await startWithoutExpiry(token, { locale: 'en', promoCode: 'WELCOME10' })
    await stripePost(t.payments.completeCheckout(plain.sessionId))
    const [payment] = await paymentsOf(userId)
    expect(payment).toMatchObject({ stripeCheckoutSessionId: plain.sessionId, promoCodeId: null })
    const after = await t.db.query.promoCodes.findFirst({ where: { code: 'WELCOME10' } })
    expect(after?.redeemedCount).toBe(welcome?.redeemedCount)
  })

  it('leaves an enrolment that a payment activates while checkout restarts', async () => {
    const { token, userId } = await buyer('activated-meanwhile@example.com')
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    // Stripe answers with the session as it was a moment ago, while its webhook lands
    const retrieve = t.payments.retrieveCheckoutSession
    t.payments.retrieveCheckoutSession = async (id: string) => {
      const before = await retrieve.call(t.payments, id)
      if (id === zh.sessionId) await stripePost(t.payments.completeCheckout(zh.sessionId))
      return before
    }
    try {
      const restarted = await start(token, sourdoughId, { locale: 'en' })
      expect(restarted.kind).toBe('enrolled')
    } finally {
      t.payments.retrieveCheckoutSession = retrieve
    }
    expect(await enrollmentOf(zh.sessionId)).toMatchObject({
      status: 'active',
      stripeCheckoutSessionId: zh.sessionId,
    })
    expect(await paymentsOf(userId)).toHaveLength(1)
  })

  it('refunds a second payment found by the success page when no webhook arrives', async () => {
    const { token, userId } = await buyer('second-tab-sync@example.com')
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await startWithoutExpiry(token, { locale: 'en' })
    await stripePost(t.payments.completeCheckout(zh.sessionId))
    t.payments.completeCheckout(en.sessionId)
    const synced = await t.api('GET', `/api/checkout/sessions/${en.sessionId}/sync`, { token })
    expect(synced.body.status).toBe('paid')
    const [, extra] = await paymentsOf(userId)
    expect(extra).toMatchObject({ stripeCheckoutSessionId: en.sessionId, status: 'refunded' })
    // polling again does not refund twice
    await t.api('GET', `/api/checkout/sessions/${en.sessionId}/sync`, { token })
    expect(
      t.payments.refunds.filter((r) => r.paymentIntentId === extra?.stripePaymentIntentId),
    ).toHaveLength(1)
  })

  it('fulfils an earlier session that could not be closed and is paid alone', async () => {
    const { token, userId } = await buyer('unclosed-first-tab@example.com')
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await startWithoutExpiry(token, { locale: 'en' })
    expect(t.payments.sessions.get(zh.sessionId)?.expired).toBe(false)
    t.payments.completeCheckout(zh.sessionId)
    const synced = await t.api('GET', `/api/checkout/sessions/${zh.sessionId}/sync`, { token })
    expect(synced.body.status).toBe('paid')
    const enrollment = await enrollmentOf(en.sessionId)
    // the enrolment now points at the session that paid for it
    expect(enrollment).toMatchObject({ status: 'active', stripeCheckoutSessionId: zh.sessionId })
    expect(await eventProps(userId, ANALYTICS_EVENTS.checkoutCompleted)).toMatchObject({
      locale: 'zh',
    })
  })

  it('refunds a second payment when both sessions were paid', async () => {
    const { token, userId } = await buyer('pays-twice@example.com')
    const before = await enrolCount()
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await startWithoutExpiry(token, { locale: 'en' })
    const first = await stripePost(t.payments.completeCheckout(zh.sessionId))
    expect(((await first.json()) as { outcome: string }).outcome).toBe('applied')
    const second = await stripePost(t.payments.completeCheckout(en.sessionId))
    expect(second.status).toBe(200)
    expect(((await second.json()) as { outcome: string }).outcome).toBe('applied')

    const [kept, extra] = await paymentsOf(userId)
    expect(kept).toMatchObject({ stripeCheckoutSessionId: zh.sessionId, status: 'succeeded' })
    expect(extra).toMatchObject({
      stripeCheckoutSessionId: en.sessionId,
      status: 'refunded',
      refundedCents: extra?.amountCents,
    })
    const enEnrollment = await enrollmentOf(en.sessionId)
    expect(enEnrollment).toMatchObject({ status: 'active', stripeCheckoutSessionId: zh.sessionId })
    expect(await enrolCount()).toBe(before + 1)
    expect(
      t.payments.refunds.filter((r) => r.paymentIntentId === extra?.stripePaymentIntentId),
    ).toHaveLength(1)
    // one checkout_completed, one enrolment email and one refund email
    expect(await eventProps(userId, ANALYTICS_EVENTS.checkoutCompleted)).toMatchObject({
      locale: 'zh',
    })
    const mail = t.mailer.sent.filter((m) => m.to === 'pays-twice@example.com')
    expect(mail.filter((m) => m.subject.startsWith("You're enrolled"))).toHaveLength(1)
    expect(mail.filter((m) => m.subject.includes('you paid twice'))).toHaveLength(1)

    // Stripe's charge.refunded for that refund keeps the course, and sends nothing more
    const sentBefore = t.mailer.sent.length
    await stripePost(t.payments.refundedEvent(extra?.stripePaymentIntentId as string))
    expect((await enrollmentOf(en.sessionId))?.status).toBe('active')
    expect(t.mailer.sent.length).toBe(sentBefore)
    // the success page of the second tab shows the course as paid
    const synced = await t.api('GET', `/api/checkout/sessions/${en.sessionId}/sync`, { token })
    expect(synced.body.status).toBe('paid')
  })

  it('records a second payment it could not refund, for Support', async () => {
    const { token, userId } = await buyer('refund-fails@example.com')
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await startWithoutExpiry(token, { locale: 'en' })
    await stripePost(t.payments.completeCheckout(zh.sessionId))
    const createRefund = t.payments.createRefund
    t.payments.createRefund = async () => {
      throw new Error('Stripe is unreachable')
    }
    try {
      const hook = await stripePost(t.payments.completeCheckout(en.sessionId))
      expect(hook.status).toBe(500)
    } finally {
      t.payments.createRefund = createRefund
    }
    const [, extra] = await paymentsOf(userId)
    expect(extra).toMatchObject({ stripeCheckoutSessionId: en.sessionId, status: 'succeeded' })
    const stored = await t.db.query.webhookEvents.findMany({ where: { provider: 'stripe' } })
    expect(stored.some((e) => e.error?.startsWith('duplicate_unrefunded'))).toBe(true)

    // Support refunds it: the learner keeps the course paid for by the first payment, and the
    // notice does not say access was removed
    await t.grantRole('duplicate-desk@example.com', 'super_admin')
    const desk = (await t.signIn('duplicate-desk@example.com', 'support')).token as string
    const refunded = await t.api('POST', `/api/support/transactions/${extra?.id}/refund`, {
      token: desk,
      body: { reason: 'Paid twice' },
    })
    expect(refunded.status).toBe(200)
    expect((await enrollmentOf(en.sessionId))?.status).toBe('active')
    const notice = t.mailer.sent.find(
      (m) => m.to === 'refund-fails@example.com' && m.subject.startsWith('Refund issued for'),
    )
    expect(notice?.text).not.toContain('Access to the course has been removed')
  })

  it('moves access to an unrefunded duplicate when Support refunds the first payment', async () => {
    const { token, userId } = await buyer('refund-the-first@example.com')
    const before = await enrolCount()
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await startWithoutExpiry(token, { locale: 'en' })
    await stripePost(t.payments.completeCheckout(zh.sessionId))
    const createRefund = t.payments.createRefund
    t.payments.createRefund = async () => {
      throw new Error('Stripe is unreachable')
    }
    try {
      await stripePost(t.payments.completeCheckout(en.sessionId))
    } finally {
      t.payments.createRefund = createRefund
    }
    const first = await paymentFor(zh.sessionId)
    await t.grantRole('refund-first-desk@example.com', 'super_admin')
    const desk = (await t.signIn('refund-first-desk@example.com', 'support')).token as string
    const refunded = await t.api('POST', `/api/support/transactions/${first?.id}/refund`, {
      token: desk,
      body: { reason: 'Refunded the wrong one' },
    })
    expect(refunded.status).toBe(200)
    // the learner still has one payment standing, so they keep the course
    expect(await enrollmentOf(zh.sessionId)).toMatchObject({
      status: 'active',
      stripeCheckoutSessionId: en.sessionId,
    })
    expect(await enrolCount()).toBe(before + 1)
    // and the remaining payment is no longer treated as a duplicate
    await t.api('GET', `/api/checkout/sessions/${en.sessionId}/sync`, { token })
    expect((await paymentFor(en.sessionId))?.status).toBe('succeeded')
  })

  it('tells the learner access is gone when Support refunds the first payment during a duplicate refund', async () => {
    const { token } = await buyer('both-refunded@example.com')
    const before = await enrolCount()
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await startWithoutExpiry(token, { locale: 'en' })
    await stripePost(t.payments.completeCheckout(zh.sessionId))
    const createRefund = t.payments.createRefund
    t.payments.createRefund = async () => {
      throw new Error('Stripe is unreachable')
    }
    try {
      await stripePost(t.payments.completeCheckout(en.sessionId))
    } finally {
      t.payments.createRefund = createRefund
    }
    const first = await paymentFor(zh.sessionId)
    const second = await paymentFor(en.sessionId)
    await t.grantRole('both-refunded-desk@example.com', 'super_admin')
    const desk = (await t.signIn('both-refunded-desk@example.com', 'support')).token as string
    // the poll's retry of the duplicate refund is at Stripe when Support refunds the first payment
    t.payments.createRefund = async (input) => {
      if (input.paymentIntentId === second?.stripePaymentIntentId) {
        t.payments.createRefund = createRefund
        const support = await t.api('POST', `/api/support/transactions/${first?.id}/refund`, {
          token: desk,
          body: { reason: 'Refunded the wrong one' },
        })
        expect(support.status).toBe(200)
      }
      return createRefund.call(t.payments, input)
    }
    try {
      await t.api('GET', `/api/checkout/sessions/${en.sessionId}/sync`, { token })
    } finally {
      t.payments.createRefund = createRefund
    }
    expect((await paymentFor(zh.sessionId))?.status).toBe('refunded')
    expect((await paymentFor(en.sessionId))?.status).toBe('refunded')
    expect((await enrollmentOf(en.sessionId))?.status).toBe('refunded')
    expect(await enrolCount()).toBe(before)
    const twice = t.mailer.sent.find(
      (m) => m.to === 'both-refunded@example.com' && m.subject.includes('you paid twice'),
    )
    expect(twice?.text).toContain('access to the course has been removed')
    expect(twice?.text).not.toContain('not affected')
  })

  it('retries a failed duplicate refund when the success page polls again', async () => {
    const { token, userId } = await buyer('refund-retried@example.com')
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await startWithoutExpiry(token, { locale: 'en' })
    await stripePost(t.payments.completeCheckout(zh.sessionId))
    const createRefund = t.payments.createRefund
    t.payments.createRefund = async () => {
      throw new Error('Stripe is unreachable')
    }
    try {
      await stripePost(t.payments.completeCheckout(en.sessionId))
    } finally {
      t.payments.createRefund = createRefund
    }
    const synced = await t.api('GET', `/api/checkout/sessions/${en.sessionId}/sync`, { token })
    expect(synced.body.status).toBe('paid')
    const [, extra] = await paymentsOf(userId)
    expect(extra).toMatchObject({ status: 'refunded' })
    const mail = t.mailer.sent.filter((m) => m.to === 'refund-retried@example.com')
    expect(mail.filter((m) => m.subject.includes('you paid twice'))).toHaveLength(1)
  })

  it('answers both a webhook and a sync that fulfil the same session at once', async () => {
    const { token, userId } = await buyer('two-confirmations@example.com')
    const { sessionId } = await start(token, sourdoughId, { locale: 'zh' })
    const event = t.payments.completeCheckout(sessionId)
    const [hook, synced] = await Promise.all([
      stripePost(event),
      t.api('GET', `/api/checkout/sessions/${sessionId}/sync`, { token }),
    ])
    expect(hook.status).toBe(200)
    expect(synced.status).toBe(200)
    expect(synced.body.status).toBe('paid')
    expect(await paymentsOf(userId)).toHaveLength(1)
  })

  it("does not match another learner's earlier session", async () => {
    const { token: ownerToken } = await buyer('session-owner@example.com')
    const first = await start(ownerToken, sourdoughId, { locale: 'zh' })
    await startWithoutExpiry(ownerToken, { locale: 'en' })
    const { token: otherToken } = await buyer('session-snooper@example.com')
    t.payments.completeCheckout(first.sessionId)
    const res = await t.api('GET', `/api/checkout/sessions/${first.sessionId}/sync`, {
      token: otherToken,
    })
    expect(res.status).toBe(404)
  })

  it('records the language when sync completes a paid checkout', async () => {
    const { token, userId } = await buyer('sync-buyer@example.com')
    const { sessionId } = await start(token, sourdoughId, { locale: 'en' })
    t.payments.completeCheckout(sessionId)
    const synced = await t.api('GET', `/api/checkout/sessions/${sessionId}/sync`, { token })
    expect(synced.body.status).toBe('paid')
    expect(await eventProps(userId, ANALYTICS_EVENTS.checkoutCompleted)).toMatchObject({
      locale: 'en',
    })
  })

  it("records the request's language for a free enrolment", async () => {
    const { profile } = await t.createProfile('free-teacher@example.com')
    const free = await t.createCourse(profile.id, { status: 'live', priceCents: 0 })
    const { token, userId } = await buyer('free-buyer@example.com')
    expect((await start(token, free.courseId, { locale: 'zh' })).kind).toBe('enrolled')
    expect(await eventProps(userId, ANALYTICS_EVENTS.checkoutCompleted)).toMatchObject({
      free: true,
      locale: 'zh',
    })
  })
})
