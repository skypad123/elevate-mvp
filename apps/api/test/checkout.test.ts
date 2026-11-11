import { schema as s } from '@elevate/db'
import { seedDatabase } from '@elevate/db/seed'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
let learner: string
let sourdoughId: string
let sourdoughTeacherId: string

const stripePost = (event: unknown) =>
  t.app.request('/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 'fake-valid' },
    body: JSON.stringify(event),
  })

beforeAll(async () => {
  t = await createTestApp()
  await seedDatabase(t.db, { superAdminEmail: 'admin@test.local', storageDir: null })
  learner = (await t.signIn('buyer@example.com')).token as string
  const course = await t.db.query.courses.findFirst({
    where: { slug: 'sourdough-from-scratch' },
  })
  sourdoughId = course?.id as string
  sourdoughTeacherId = course?.teacherId as string
  // the teacher must be payable: give them a fake connected account with charges enabled
  const { accountId } = await t.payments.createConnectedAccount({
    email: 'daniel@example.com',
    userId: sourdoughTeacherId,
    displayName: 'Daniel',
  })
  t.payments.enableAccount(accountId)
  await t.db
    .update(s.teacherProfiles)
    .set({ stripeAccountId: accountId, stripeChargesEnabled: true, stripeDetailsSubmitted: true })
    .where(eq(s.teacherProfiles.userId, sourdoughTeacherId))
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
