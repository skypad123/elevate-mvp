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
    expect(wrong.body.error.code).toBe('promo_invalid')
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

  it('fulfils an earlier session that is paid after checkout was started again', async () => {
    const { token, userId } = await buyer('pays-first-tab@example.com')
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    const en = await start(token, sourdoughId, { locale: 'en' })
    // the learner pays in the first tab, which is still open
    t.payments.completeCheckout(zh.sessionId)
    const synced = await t.api('GET', `/api/checkout/sessions/${zh.sessionId}/sync`, { token })
    expect(synced.body.status).toBe('paid')
    const enrollmentId = t.payments.sessions.get(en.sessionId)?.enrollmentId
    expect(enrollmentId).toBeDefined()
    const enrollment = await t.db.query.enrollments.findFirst({
      where: { id: enrollmentId as string },
    })
    expect(enrollment?.status).toBe('active')
    expect(await eventProps(userId, ANALYTICS_EVENTS.checkoutCompleted)).toMatchObject({
      locale: 'zh',
    })
  })

  it('fulfils an earlier session through the webhook as well', async () => {
    const { token } = await buyer('pays-first-tab-webhook@example.com')
    const zh = await start(token, sourdoughId, { locale: 'zh' })
    await start(token, sourdoughId, { locale: 'en' })
    const hook = await stripePost(t.payments.completeCheckout(zh.sessionId))
    expect(((await hook.json()) as { outcome: string }).outcome).toBe('applied')
  })

  it("does not match another learner's earlier session", async () => {
    const { token: ownerToken } = await buyer('session-owner@example.com')
    const first = await start(ownerToken, sourdoughId, { locale: 'zh' })
    await start(ownerToken, sourdoughId, { locale: 'en' })
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
