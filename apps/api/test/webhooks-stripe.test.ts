import { schema as s } from '@elevate/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PaymentsWebhookEvent } from '../src/providers/payments'
import { createStripeEventHandlers, dispatchStripeEvent } from '../src/services/stripe-events'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
beforeAll(async () => {
  t = await createTestApp()
})
afterAll(async () => {
  await t.close()
})

const stripePost = (event: unknown, signature = 'fake-valid') =>
  t.app.request('/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
    body: JSON.stringify(event),
  })

describe('stripe webhooks', () => {
  it('updates the payout account on account.updated, dedupes, and ignores unknown types', async () => {
    const { profile } = await t.createProfile('connect-teacher@example.com', { displayName: 'T' })
    const [account] = await t.db
      .insert(s.payoutAccounts)
      .values({ profileId: profile.id, businessType: 'individual' })
      .returning()
    const { accountId } = await t.payments.createConnectedAccount({
      businessType: 'individual',
      profileId: profile.id,
      payoutAccountId: account?.id as string,
      email: 'connect-teacher@example.com',
      displayName: 'T',
    })
    await t.db.update(s.payoutAccounts).set({ stripeAccountId: accountId })

    const event = t.payments.enableAccount(accountId)
    const first = await stripePost(event)
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ received: true, outcome: 'applied' })
    const updated = await t.db.query.payoutAccounts.findFirst({ where: { profileId: profile.id } })
    expect(updated).toMatchObject({
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      // an individual account becomes active the first time charges are enabled
      status: 'active',
    })
    expect(updated?.activatedAt).toBeInstanceOf(Date)

    const replay = await stripePost(event)
    expect(await replay.json()).toMatchObject({ duplicate: true })

    const unknown = await stripePost({ id: 'evt_x', type: 'payout.paid', data: { object: {} } })
    expect(await unknown.json()).toMatchObject({ outcome: 'ignored' })
  })

  it('stores an error for an account.updated about an account it does not know', async () => {
    const orphan = {
      id: 'evt_y',
      type: 'account.updated',
      data: { object: { id: 'acct_nobody', charges_enabled: true } },
    }
    const res = await stripePost(orphan)
    expect(res.status).toBe(500)
    const [stored] = await t.db.query.webhookEvents.findMany({ where: { eventId: 'evt_y' } })
    expect(stored?.error).toContain('unknown_account')
    expect(stored?.error).toContain('acct_nobody')
    // Stripe redelivers a failed event, and it is handled again: it still fails
    const retry = await stripePost(orphan)
    expect(retry.status).toBe(500)

    // Once the account exists, the next redelivery succeeds and clears the stored error
    const { profile } = await t.createProfile('late-account@example.com')
    await t.db
      .insert(s.payoutAccounts)
      .values({ profileId: profile.id, businessType: 'individual', stripeAccountId: 'acct_nobody' })
    const third = await stripePost(orphan)
    expect(third.status).toBe(200)
    expect(await third.json()).toMatchObject({ received: true, outcome: 'applied' })
    const [handled] = await t.db.query.webhookEvents.findMany({ where: { eventId: 'evt_y' } })
    expect(handled).toMatchObject({ error: null })
    expect(handled?.processedAt).toBeInstanceOf(Date)
    expect(
      await t.db.query.payoutAccounts.findFirst({ where: { stripeAccountId: 'acct_nobody' } }),
    ).toMatchObject({ chargesEnabled: true })

    // A handled event is answered as a duplicate
    const fourth = await stripePost(orphan)
    expect(fourth.status).toBe(200)
    expect(await fourth.json()).toMatchObject({ duplicate: true })
  })

  it('rejects bad signatures', async () => {
    const res = await stripePost(
      { id: 'evt_bad', type: 'account.updated', data: { object: {} } },
      'wrong',
    )
    expect(res.status).toBe(400)
    const ledger = await t.db.query.webhookEvents.findMany({
      where: { eventId: 'evt_bad' },
    })
    expect(ledger).toHaveLength(0)
  })
})

describe('redelivered Stripe events', () => {
  let courseId: string
  let stripeAccountId: string
  let handlers: ReturnType<typeof createStripeEventHandlers>

  beforeAll(async () => {
    const created = await t.createProfile('redelivery-seller@example.com', { payable: true })
    stripeAccountId = created.payoutAccount?.stripeAccountId as string
    courseId = (await t.createCourse(created.profile.id, { status: 'live', priceCents: 5000 }))
      .courseId
    handlers = createStripeEventHandlers(t.deps)
  })

  /** A learner starts checkout and pays; returns the checkout.session.completed event. */
  async function pay(email: string) {
    const token = (await t.signIn(email)).token as string
    const start = await t.api('POST', `/api/checkout/courses/${courseId}`, { token, body: {} })
    expect(start.body.kind, JSON.stringify(start.body)).toBe('redirect')
    return t.payments.completeCheckout(start.body.sessionId as string)
  }

  /**
   * Everything a Stripe handler writes or sends. `updatedAt` is left out: it records that a row
   * was written, and a second run that writes the same values moves it on.
   */
  async function snapshot() {
    const rows = (list: Array<Record<string, unknown>>) =>
      list.map(({ updatedAt: _, ...row }) => JSON.stringify(row)).sort()
    return {
      payments: rows(await t.db.select().from(s.payments)),
      enrollments: rows(await t.db.select().from(s.enrollments)),
      refunds: rows(await t.db.select().from(s.refunds)),
      payoutAccounts: rows(await t.db.select().from(s.payoutAccounts)),
      courses: rows(await t.db.select().from(s.courses)),
      promoCodes: rows(await t.db.select().from(s.promoCodes)),
      auditLog: rows(await t.db.select().from(s.auditLog)),
      analyticsEvents: rows(await t.db.select().from(s.analyticsEvents)),
      emails: t.mailer.sent.map((m) => `${m.to} ${m.subject}`),
      stripeRefunds: t.payments.refunds.map((r) => r.refundId),
    }
  }

  /** Runs the event's handler twice, as a retry after a half-finished run would. */
  async function runTwice(event: PaymentsWebhookEvent) {
    const first = await dispatchStripeEvent(event, handlers, t.deps)
    const after = await snapshot()
    const second = await dispatchStripeEvent(event, handlers, t.deps)
    expect(await snapshot()).toEqual(after)
    return [first, second]
  }

  it('leaves the same rows when account.updated is handled twice', async () => {
    const [first] = await runTwice(t.payments.enableAccount(stripeAccountId))
    expect(first).toBe('applied')
  })

  it('leaves the same rows when checkout.session.completed is handled twice', async () => {
    const event = await pay('twice-completed@example.com')
    const [first] = await runTwice(event)
    expect(first).toBe('applied')
    const sessionId = String(event.data.object.id)
    expect(
      await t.db.query.payments.findMany({ where: { stripeCheckoutSessionId: sessionId } }),
    ).toHaveLength(1)
  })

  it('leaves the same rows when checkout.session.async_payment_succeeded is handled twice', async () => {
    const event = await pay('twice-async@example.com')
    const [first] = await runTwice({ ...event, type: 'checkout.session.async_payment_succeeded' })
    expect(first).toBe('applied')
  })

  it('leaves the same rows when charge.refunded is handled twice', async () => {
    const event = await pay('twice-refunded@example.com')
    await t.stripeWebhook(event)
    const paymentIntentId = String(event.data.object.payment_intent)
    await t.payments.createRefund({ paymentIntentId })
    const [first] = await runTwice(t.payments.refundedEvent(paymentIntentId))
    expect(first).toBe('applied')
    const payment = await t.db.query.payments.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    })
    expect(await t.db.query.refunds.findMany({ where: { paymentId: payment?.id } })).toHaveLength(1)
  })

  it('fulfils a payment whose first webhook failed when Stripe redelivers it', async () => {
    const event = await pay('redelivered@example.com')
    const sessionId = String(event.data.object.id)
    const retrieve = t.payments.retrievePaymentDetails
    t.payments.retrievePaymentDetails = async () => {
      throw new Error('Stripe is unreachable')
    }
    try {
      expect((await t.stripeWebhook(event)).status).toBe(500)
    } finally {
      t.payments.retrievePaymentDetails = retrieve
    }
    const [failed] = await t.db.query.webhookEvents.findMany({ where: { eventId: event.id } })
    expect(failed?.error).toContain('Stripe is unreachable')
    expect(
      await t.db.query.payments.findMany({ where: { stripeCheckoutSessionId: sessionId } }),
    ).toHaveLength(0)

    const again = await t.stripeWebhook(event)
    expect(again.status).toBe(200)
    expect(again.body).toMatchObject({ received: true, outcome: 'applied' })
    expect(
      await t.db.query.payments.findMany({ where: { stripeCheckoutSessionId: sessionId } }),
    ).toHaveLength(1)
    expect(
      await t.db.query.enrollments.findFirst({ where: { stripeCheckoutSessionId: sessionId } }),
    ).toMatchObject({ status: 'active' })
    const [handled] = await t.db.query.webhookEvents.findMany({ where: { eventId: event.id } })
    expect(handled).toMatchObject({ error: null })
    const receipts = t.mailer.sent.filter(
      (m) => m.to === 'redelivered@example.com' && m.subject.startsWith("You're enrolled"),
    )
    expect(receipts).toHaveLength(1)

    expect((await t.stripeWebhook(event)).body).toMatchObject({ duplicate: true })
  })

  // Last in the file: it moves the clock on.
  it('answers an event still being handled as a duplicate, and handles it again after five minutes', async () => {
    const event = t.payments.enableAccount(stripeAccountId)
    // An earlier delivery was recorded and its handling has not finished (or the process died).
    await t.db.insert(s.webhookEvents).values({
      provider: 'stripe',
      eventId: event.id,
      type: event.type,
      payload: event,
      receivedAt: t.now(),
    })
    expect((await t.stripeWebhook(event)).body).toMatchObject({ duplicate: true })
    t.advanceClock(4 * 60 * 1000)
    expect((await t.stripeWebhook(event)).body).toMatchObject({ duplicate: true })
    t.advanceClock(2 * 60 * 1000)
    const stale = await t.stripeWebhook(event)
    expect(stale.status).toBe(200)
    expect(stale.body).toMatchObject({ received: true, outcome: 'applied' })
    expect((await t.stripeWebhook(event)).body).toMatchObject({ duplicate: true })
  })
})
