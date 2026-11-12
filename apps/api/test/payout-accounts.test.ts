import { ANALYTICS_EVENTS } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkoutIdempotencyKey } from '../src/providers/payments/types'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Payout accounts: every sale records the account it paid, taken from the checkout and not from
 * the course as it is later; money is totalled per account; and an account is created once and
 * activated by one rule.
 */
let t: TestApp
let owner: string
let ownerUserId: string
let admin: string
let profileId: string
let payoutAccountId: string
let stripeAccountId: string
type Fixture = Awaited<ReturnType<TestApp['createCourse']>>
let course: Fixture
let secondCourse: Fixture

const teach = (path: string) => `/api/teach/profiles/${profileId}${path}`

/** A learner starts checkout for a course; returns the Stripe session ID. */
async function startCheckout(email: string, courseId: string) {
  const token = (await t.signIn(email)).token as string
  const start = await t.api('POST', `/api/checkout/courses/${courseId}`, { token, body: {} })
  expect(start.body.kind, JSON.stringify(start.body)).toBe('redirect')
  return { token, sessionId: start.body.sessionId as string }
}

/** A learner buys a course end to end; returns the payment row. */
async function buy(email: string, courseId: string) {
  const { sessionId } = await startCheckout(email, courseId)
  const hook = await t.stripeWebhook(t.payments.completeCheckout(sessionId))
  expect(hook.body.outcome, JSON.stringify(hook.body)).toBe('applied')
  const payment = await t.db.query.payments.findFirst({
    where: { stripeCheckoutSessionId: sessionId },
  })
  if (!payment) throw new Error('no payment written')
  return payment
}

beforeAll(async () => {
  t = await createTestApp()
  const created = await t.createProfile('seller@example.com', {
    displayName: 'Seller Studio',
    payable: true,
  })
  profileId = created.profile.id
  ownerUserId = created.user.id
  payoutAccountId = created.payoutAccount?.id as string
  stripeAccountId = created.payoutAccount?.stripeAccountId as string
  course = await t.createCourse(profileId, { status: 'live', priceCents: 8000, title: 'First' })
  secondCourse = await t.createCourse(profileId, {
    status: 'live',
    priceCents: 4000,
    title: 'Second',
  })
  owner = (await t.signIn('seller@example.com', 'teach')).token as string
  await t.grantRole('admin@example.com', 'super_admin')
  admin = (await t.signIn('admin@example.com', 'support')).token as string
})
afterAll(async () => {
  await t.close()
})

describe('who a sale pays', () => {
  it('sends the checkout to the payout account and names it in the metadata', async () => {
    const { sessionId } = await startCheckout('first-buyer@example.com', course.courseId)
    const session = t.payments.sessions.get(sessionId)
    expect(session).toMatchObject({
      destinationAccountId: stripeAccountId,
      payoutAccountId,
      profileId,
    })
    expect(session?.metadata).toMatchObject({
      elevatePayoutAccountId: payoutAccountId,
      elevateProfileId: profileId,
    })
    expect(session?.metadata).not.toHaveProperty('teacherId')
    expect(session?.idempotencyKey).toBe(
      checkoutIdempotencyKey({
        enrollmentId: session?.enrollmentId as string,
        amountCents: 8000,
        payoutAccountId,
      }),
    )
  })

  it('builds the idempotency key from the enrolment, the amount and the payout account', () => {
    const base = { enrollmentId: 'enr_1', amountCents: 8000, payoutAccountId: 'acc_1' }
    expect(checkoutIdempotencyKey(base)).toBe('checkout:enr_1:8000:acc_1')
    // a different payee is a different key, so a retry never reuses a session that pays the old one
    expect(checkoutIdempotencyKey({ ...base, payoutAccountId: 'acc_2' })).not.toBe(
      checkoutIdempotencyKey(base),
    )
    expect(checkoutIdempotencyKey({ ...base, amountCents: 7000 })).not.toBe(
      checkoutIdempotencyKey(base),
    )
  })

  it('writes the payee from the checkout, not from the course as it is at payment time', async () => {
    const { sessionId } = await startCheckout('mover@example.com', secondCourse.courseId)
    // Between checkout and payment the course moves to another profile with its own account.
    const other = await t.createProfile('other-seller@example.com', { payable: true })
    await t.db
      .update(s.courses)
      .set({ profileId: other.profile.id })
      .where(eq(s.courses.id, secondCourse.courseId))
    const hook = await t.stripeWebhook(t.payments.completeCheckout(sessionId))
    expect(hook.body.outcome).toBe('applied')
    const payment = await t.db.query.payments.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
    })
    expect(payment).toMatchObject({ payoutAccountId, profileId })
    // put the course back for the tests below
    await t.db.update(s.courses).set({ profileId }).where(eq(s.courses.id, secondCourse.courseId))
  })

  it('writes no payment when the session does not say whom it paid', async () => {
    for (const [email, tamper] of [
      [
        'no-account@example.com',
        (m: Record<string, string>) => {
          delete m.elevatePayoutAccountId
        },
      ],
      [
        'no-profile@example.com',
        (m: Record<string, string>) => {
          delete m.elevateProfileId
        },
      ],
      [
        'gone-account@example.com',
        (m: Record<string, string>) => {
          m.elevatePayoutAccountId = '00000000-0000-4000-8000-000000000000'
        },
      ],
    ] as const) {
      const { token, sessionId } = await startCheckout(email, course.courseId)
      tamper(t.payments.sessions.get(sessionId)?.metadata as Record<string, string>)
      const event = t.payments.completeCheckout(sessionId)

      // The success page polls first: it reports the session as still pending.
      const sync = await t.api('GET', `/api/checkout/sessions/${sessionId}/sync`, { token })
      expect(sync.body, email).toEqual({ status: 'pending' })

      // The webhook fails, and the failure is stored with the event for Support.
      const hook = await t.stripeWebhook(event)
      expect(hook.status, email).toBe(500)
      const [stored] = await t.db.query.webhookEvents.findMany({ where: { eventId: event.id } })
      expect(stored?.error, email).toContain('unattributed_checkout')
      expect(stored?.error, email).toContain(sessionId)

      const payments = await t.db.query.payments.findMany({
        where: { stripeCheckoutSessionId: sessionId },
      })
      expect(payments, email).toEqual([])
      const enrollment = await t.db.query.enrollments.findFirst({
        where: { stripeCheckoutSessionId: sessionId },
      })
      expect(enrollment?.status, email).toBe('pending_payment')
    }
  })
})

describe('money per payout account', () => {
  it('totals earnings, reconciliation and the ledger from the payments of the account', async () => {
    await buy('second-buyer@example.com', course.courseId)
    await buy('third-buyer@example.com', secondCourse.courseId)
    const rows = await t.db.query.payments.findMany({ where: { payoutAccountId } })
    // one from "the payee comes from the checkout" above, two from here
    expect(rows).toHaveLength(3)
    const net = rows.reduce((sum, p) => sum + p.teacherNetCents, 0)
    const gross = rows.reduce((sum, p) => sum + p.amountCents, 0)
    expect(gross).toBe(4000 + 8000 + 4000)

    const earnings = (await t.api('GET', teach('/earnings'), { token: owner })).body.earnings
    expect(earnings.totals).toMatchObject({ paymentCount: 3, grossCents: gross, netCents: net })
    const perCourse = Object.fromEntries(
      earnings.courses.map((c: { courseId: string; paymentCount: number; grossCents: number }) => [
        c.courseId,
        [c.paymentCount, c.grossCents],
      ]),
    )
    expect(perCourse).toEqual({
      [course.courseId]: [1, 8000],
      [secondCourse.courseId]: [2, 8000],
    })

    const one = await t.api('GET', teach(`/earnings/courses/${secondCourse.courseId}`), {
      token: owner,
    })
    expect(one.body.earnings.course).toMatchObject({ paymentCount: 2, grossCents: 8000 })

    // Reconciliation compares the ledger with what Stripe transferred to the account. The three
    // paid sessions that could not be attributed above are in Stripe and not in the ledger, and
    // that is exactly the difference it reports.
    const unrecorded = [...t.payments.sessions.values()].filter(
      (session) =>
        session.paid &&
        session.destinationAccountId === stripeAccountId &&
        !rows.some((p) => p.stripeCheckoutSessionId === session.id),
    )
    expect(unrecorded).toHaveLength(3)
    const missing = unrecorded.reduce(
      (sum, session) => sum + session.amountCents - session.applicationFeeCents,
      0,
    )
    const reconcile = await t.api('GET', teach('/earnings/reconcile'), { token: owner })
    expect(reconcile.body.reconciliation).toMatchObject({
      ledgerNetCents: net,
      stripeTransferTotalCents: net + missing,
      differenceCents: missing,
    })

    const ledger = (await t.api('GET', '/api/support/payouts', { token: admin })).body.items
    expect(ledger).toHaveLength(1)
    expect(ledger[0]).toMatchObject({
      payoutAccountId,
      stripeAccountId,
      profileId,
      profileName: 'Seller Studio',
      ownerEmail: 'seller@example.com',
      transferCount: 3,
      transferredCents: net,
    })

    const detail = await t.api('GET', `/api/support/profiles/${profileId}`, { token: admin })
    expect(detail.body.earnings).toMatchObject({ paymentCount: 3, netCents: net })
    const transactions = await t.api('GET', '/api/support/transactions', { token: admin })
    for (const row of transactions.body.items) {
      expect(row).toMatchObject({ payoutAccountId, profileId, profileName: 'Seller Studio' })
    }
  })

  it('counts the first payout once per profile, under the owner', async () => {
    const events = await t.db.query.analyticsEvents.findMany({
      where: { name: ANALYTICS_EVENTS.firstPayout },
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.userId).toBe(ownerUserId)
    expect(events[0]?.properties).toMatchObject({ profileId, payoutAccountId })
    expect(events[0]?.properties).toHaveProperty('secondsSinceApproval')
  })
})

describe('refund notices', () => {
  const noticesTo = (email: string, phrase: string) =>
    t.mailer.sent.filter((m) => m.to === email && m.subject.includes(phrase))

  it('emails the learner and the owner once for a Support refund, webhook included', async () => {
    const payment = await buy('refund-me@example.com', course.courseId)
    const refunded = await t.api('POST', `/api/support/transactions/${payment.id}/refund`, {
      token: admin,
      body: { reason: 'Bought by mistake' },
    })
    expect(refunded.status).toBe(200)
    // Stripe then sends charge.refunded for the same refund.
    const hook = await t.stripeWebhook(
      t.payments.refundedEvent(payment.stripePaymentIntentId as string),
    )
    expect(hook.status).toBe(200)
    expect(noticesTo('refund-me@example.com', 'Refund issued')).toHaveLength(1)
    expect(noticesTo('seller@example.com', 'was refunded')).toHaveLength(1)
  })

  it('emails the learner and the owner once for a refund made in the Stripe dashboard', async () => {
    const before = noticesTo('seller@example.com', 'was refunded').length
    const payment = await buy('dashboard-refund@example.com', course.courseId)
    // Refunded in Stripe, not through Support: the webhook is the only thing we hear.
    await t.payments.createRefund({ paymentIntentId: payment.stripePaymentIntentId as string })
    const event = t.payments.refundedEvent(payment.stripePaymentIntentId as string)
    expect((await t.stripeWebhook(event)).body.outcome).toBe('applied')
    expect(noticesTo('dashboard-refund@example.com', 'Refund issued')).toHaveLength(1)
    expect(noticesTo('seller@example.com', 'was refunded')).toHaveLength(before + 1)
    // Stripe may deliver a second event for the same refund: nothing more is sent.
    await t.stripeWebhook({ ...event, id: `${event.id}_again` })
    expect(noticesTo('dashboard-refund@example.com', 'Refund issued')).toHaveLength(1)
    expect(noticesTo('seller@example.com', 'was refunded')).toHaveLength(before + 1)
  })
})

describe('onboarding and activation', () => {
  let newProfileId: string
  let newOwner: string
  const onNew = (path: string) => `/api/teach/profiles/${newProfileId}${path}`

  beforeAll(async () => {
    newProfileId = (await t.createProfile('fresh@example.com', { displayName: 'Fresh' })).profile.id
    newOwner = (await t.signIn('fresh@example.com', 'teach')).token as string
  })

  it('creates one payout account and reuses it for every later link', async () => {
    const accountsBefore = t.payments.accounts.size
    const first = await t.api('POST', onNew('/stripe/onboarding-link'), { token: newOwner })
    const second = await t.api('POST', onNew('/stripe/onboarding-link'), { token: newOwner })
    expect([first.status, second.status]).toEqual([200, 200])
    const rows = await t.db.query.payoutAccounts.findMany({ where: { profileId: newProfileId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'onboarding', businessType: 'individual' })
    expect(t.payments.accounts.size).toBe(accountsBefore + 1)
    // both links are for the same Stripe account
    expect(first.body.url).toContain(rows[0]?.stripeAccountId as string)
    expect(second.body.url).toContain(rows[0]?.stripeAccountId as string)
    // each request is on record and the owner was told each time
    const audit = await t.db.query.auditLog.findMany({ where: { profileId: newProfileId } })
    expect(audit.filter((a) => a.action === 'stripe.onboarding_link')).toHaveLength(2)
    expect(
      t.mailer.sent.filter(
        (m) => m.to === 'fresh@example.com' && m.subject.includes('Stripe onboarding'),
      ),
    ).toHaveLength(2)
  })

  it('cannot be paid while the account is still onboarding', async () => {
    const draft = await t.createCourse(newProfileId, { status: 'live', priceCents: 3000 })
    const buyer = (await t.signIn('too-early@example.com')).token as string
    const start = await t.api('POST', `/api/checkout/courses/${draft.courseId}`, {
      token: buyer,
      body: {},
    })
    expect(start.status).toBe(409)
    expect(start.body.error.code).toBe('teacher_not_payable')
  })

  it('activates an individual account from the status check, as the webhook would', async () => {
    const [account] = await t.db.query.payoutAccounts.findMany({
      where: { profileId: newProfileId },
    })
    // Stripe finishes onboarding, but the webhook has not arrived: only the fake's state changes.
    t.payments.enableAccount(account?.stripeAccountId as string)
    const status = await t.api('GET', onNew('/stripe/status'), { token: newOwner })
    expect(status.body.stripe).toMatchObject({
      connected: true,
      status: 'active',
      chargesEnabled: true,
      payoutsEnabled: true,
    })
    const activated = await t.db.query.payoutAccounts.findFirst({ where: { id: account?.id } })
    expect(activated?.status).toBe('active')
    expect(activated?.activatedAt).toBeInstanceOf(Date)
    // the late webhook changes nothing
    const hook = await t.stripeWebhook(t.payments.enableAccount(account?.stripeAccountId as string))
    expect(hook.body.outcome).toBe('applied')
    const after = await t.db.query.payoutAccounts.findFirst({ where: { id: account?.id } })
    expect(after?.activatedAt?.getTime()).toBe(activated?.activatedAt?.getTime())
  })

  it('stops selling when Stripe withdraws charges from an active account', async () => {
    const [account] = await t.db.query.payoutAccounts.findMany({
      where: { profileId: newProfileId },
    })
    const hook = await t.stripeWebhook({
      id: 'evt_charges_off',
      type: 'account.updated',
      data: {
        object: {
          id: account?.stripeAccountId,
          details_submitted: true,
          charges_enabled: false,
          payouts_enabled: true,
        },
      },
    })
    expect(hook.body.outcome).toBe('applied')
    const after = await t.db.query.payoutAccounts.findFirst({ where: { id: account?.id } })
    expect(after).toMatchObject({ status: 'active', chargesEnabled: false })
    const view = await t.api('GET', onNew('/profile'), { token: newOwner })
    expect(view.body.profile.payout).toMatchObject({ status: 'active', chargesEnabled: false })
    const courses = await t.db.query.courses.findMany({ where: { profileId: newProfileId } })
    const buyer = (await t.signIn('too-late@example.com')).token as string
    const start = await t.api('POST', `/api/checkout/courses/${courses[0]?.id}`, {
      token: buyer,
      body: {},
    })
    expect(start.body.error.code).toBe('teacher_not_payable')
  })

  it('keeps a company account onboarding until its name has been checked', async () => {
    const company = await t.createProfile('company-owner@example.com', {
      displayName: 'Kiln Collective Pte Ltd',
      type: 'corporate',
    })
    const token = (await t.signIn('company-owner@example.com', 'teach')).token as string
    const path = (p: string) => `/api/teach/profiles/${company.profile.id}${p}`
    expect((await t.api('POST', path('/stripe/onboarding-link'), { token })).status).toBe(200)
    const account = await t.db.query.payoutAccounts.findFirst({
      where: { profileId: company.profile.id },
    })
    expect(account?.businessType).toBe('company')
    expect(t.payments.accounts.get(account?.stripeAccountId as string)?.businessType).toBe(
      'company',
    )
    await t.stripeWebhook(t.payments.enableAccount(account?.stripeAccountId as string))
    const status = await t.api('GET', path('/stripe/status'), { token })
    expect(status.body.stripe).toMatchObject({ status: 'onboarding', chargesEnabled: true })
  })
})
