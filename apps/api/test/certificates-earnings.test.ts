import { profileShareAfterRefunds, RELEASE_AFTER_MS } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { seedDatabase } from '@elevate/db/seed'
import { translate } from '@elevate/i18n'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SeatRefundsService } from '../src/services/seat-refunds.service'
import { A, block, F, K, N, newClass, seat, seller, teachToken } from './helpers/selling'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
let learner: string
let teacher: string
let admin: string
let agent: string
let courseId: string
let profileId: string

/** Every Teach route for the teacher sits under their profile. */
const teach = (path: string) => `/api/teach/profiles/${profileId}${path}`

const stripePost = (event: unknown) =>
  t.app.request('/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 'fake-valid' },
    body: JSON.stringify(event),
  })

/** Buys the seeded Sourdough course as `token` and returns the enrollment id. */
async function buy(token: string, promo?: string) {
  const start = await t.api('POST', `/api/checkout/courses/${courseId}`, {
    token,
    body: promo ? { promoCode: promo } : {},
  })
  expect(start.body.kind).toBe('redirect')
  const event = t.payments.completeCheckout(start.body.sessionId)
  expect(await (await stripePost(event)).json()).toMatchObject({ outcome: 'applied' })
  const enrollment = await t.db.query.enrollments.findFirst({
    where: { stripeCheckoutSessionId: start.body.sessionId },
  })
  return enrollment?.id as string
}

/** Completes every artefact: non-quiz by progress, quizzes by answering correctly. */
async function completeCourse(token: string, enrollmentId: string) {
  const base = `/api/me/enrollments/${enrollmentId}`
  const detail = (await t.api('GET', base, { token })).body.enrollment
  for (const lesson of detail.lessons) {
    const content = (await t.api('GET', `${base}/lessons/${lesson.id}`, { token })).body.lesson
    for (const a of content.artefacts) {
      if (a.type !== 'quiz') {
        await t.api('POST', `${base}/artefacts/${a.id}/progress`, {
          token,
          body: { status: 'completed' },
        })
        continue
      }
      const start = await t.api('POST', `${base}/quizzes/${a.quizId}/attempts`, { token })
      const row = await t.db.query.quizzes.findFirst({ where: { id: a.quizId } })
      const answers = Object.fromEntries(
        (row?.questionsJson ?? []).map((q) => [q.id, q.options.find((o) => o.correct)?.id]),
      )
      await t.api('POST', `${base}/quizzes/${a.quizId}/attempts/${start.body.attempt.id}/submit`, {
        token,
        body: { answers },
      })
    }
  }
}

beforeAll(async () => {
  t = await createTestApp()
  await seedDatabase(t.db, { superAdminEmail: 'admin@test.local', mode: 'demo', storage: null })
  const signed = await t.signIn('grad@example.com')
  learner = signed.token as string
  await t.api('PATCH', '/api/me', { token: learner, body: { name: 'Grace Lim' } })
  const course = await t.db.query.courses.findFirst({
    where: { slug: 'sourdough-from-scratch' },
  })
  courseId = course?.id as string
  profileId = course?.profileId as string
  await t.makePayable(profileId)
  teacher = (await t.signIn('daniel@example.com', 'teach')).token as string
  admin = (await t.signIn('admin@test.local', 'support')).token as string
  await t.grantRole('agent@example.com', 'support_agent')
  agent = (await t.signIn('agent@example.com', 'support')).token as string
})
afterAll(async () => {
  await t.close()
})

describe('certificates', () => {
  it('issues a certificate on completion with a public verify URL and PDF', async () => {
    const enrollmentId = await buy(learner, 'WELCOME10')
    await completeCourse(learner, enrollmentId)
    const detail = await t.api('GET', `/api/me/enrollments/${enrollmentId}`, { token: learner })
    expect(detail.body.enrollment.progress.isComplete).toBe(true)
    expect(detail.body.enrollment.completedAt).toBeTruthy()
    expect(detail.body.enrollment.certificateId).toBeTruthy()

    const mine = await t.api('GET', `/api/me/enrollments/${enrollmentId}/certificate`, {
      token: learner,
    })
    expect(mine.status).toBe(200)
    expect(mine.body.certificate).toMatchObject({
      learnerName: 'Grace Lim',
      courseTitle: 'Sourdough from Scratch',
      teacherName: 'Daniel Goh',
      revokedAt: null,
    })
    const token: string = mine.body.certificate.token
    expect(token).toMatch(/^[0-9A-HJKMNP-TV-Z]{20}$/)
    expect(mine.body.certificate.verifyUrl).toBe(`http://learner.test/c/${token}`)
    expect(t.mailer.sent.some((m) => m.subject.includes('Your certificate'))).toBe(true)

    // public, no auth
    const verify = await t.api('GET', `/api/certificates/verify/${token}`)
    expect(verify.status).toBe(200)
    expect(verify.body.valid).toBe(true)
    expect(verify.body.certificate.teacherName).toBe('Daniel Goh')
    expect(verify.body.courseSlug).toBe('sourdough-from-scratch')

    const pdf = await t.app.request(`/api/certificates/${token}/pdf`)
    expect(pdf.status).toBe(200)
    expect(pdf.headers.get('content-type')).toBe('application/pdf')
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    expect(bytes.length).toBeGreaterThan(2000)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')

    const missing = await t.api('GET', '/api/certificates/verify/0000000000000000NOPE')
    expect(missing.body).toEqual({ valid: false, reason: 'not_found' })
    expect((await t.app.request('/api/certificates/0000000000000000NOPE/pdf')).status).toBe(404)

    // asking again returns the same certificate instead of issuing twice
    const again = await t.api('GET', `/api/me/enrollments/${enrollmentId}/certificate`, {
      token: learner,
    })
    expect(again.body.certificate.token).toBe(token)
    expect(await t.db.$count(s.certificates)).toBe(1)

    // fixing the profile name reprints the PDF under the same token (verify links stay valid)
    await t.api('PATCH', '/api/me', { token: learner, body: { name: 'Grace Lim Mei Ling' } })
    const renamed = await t.api('GET', `/api/me/enrollments/${enrollmentId}/certificate`, {
      token: learner,
    })
    expect(renamed.body.certificate).toMatchObject({ token, learnerName: 'Grace Lim Mei Ling' })
    const reverified = await t.api('GET', `/api/certificates/verify/${token}`)
    expect(reverified.body.certificate.learnerName).toBe('Grace Lim Mei Ling')
    expect(await t.db.$count(s.certificates)).toBe(1)
  })

  it('does not hand out a certificate for an unfinished enrollment', async () => {
    const other = (await t.signIn('half-way@example.com')).token as string
    const enrollmentId = await buy(other)
    const res = await t.api('GET', `/api/me/enrollments/${enrollmentId}/certificate`, {
      token: other,
    })
    expect(res.status).toBe(404)
  })
})

describe('earnings and transactions', () => {
  let second: string
  let secondEnrollment: string
  let netBefore: number

  it('totals teacher earnings per course and reconciles with Stripe transfers', async () => {
    t.advanceClock(60_000)
    second = (await t.signIn('second-buyer@example.com')).token as string
    secondEnrollment = await buy(second)
    const earnings = await t.api('GET', teach('/earnings'), { token: teacher })
    expect(earnings.status).toBe(200)
    const { totals, courses, recent, stripe } = earnings.body.earnings
    expect(totals.paymentCount).toBe(3)
    expect(totals.grossCents).toBe(8010 + 8900 + 8900)
    expect(totals.discountCents).toBe(890)
    expect(totals.refundedCents).toBe(0)
    expect(totals.stripeFeeCents + totals.commissionCents + totals.netCents).toBe(totals.grossCents)
    const sourdough = courses.find((c: { slug: string }) => c.slug === 'sourdough-from-scratch')
    expect(sourdough.paymentCount).toBe(3)
    expect(sourdough.netCents).toBe(totals.netCents)
    expect(recent[0].learner).toBe('s***@example.com')
    expect(recent).toHaveLength(3)
    expect(stripe).toEqual({ connected: true, chargesEnabled: true, payoutsEnabled: true })
    // a profile that has not opted in to class sales holds nothing and has no payouts here
    expect(earnings.body.earnings).toMatchObject({
      heldCents: 0,
      heldClasses: [],
      payouts: [],
      debtCents: 0,
    })
    netBefore = totals.netCents

    const reconcile = await t.api('GET', teach('/earnings/reconcile'), { token: teacher })
    expect(reconcile.status).toBe(200)
    expect(reconcile.body.reconciliation.stripeTransferTotalCents).toBe(totals.netCents)
    expect(reconcile.body.reconciliation.differenceCents).toBe(0)

    const perCourse = await t.api('GET', teach(`/earnings/courses/${courseId}`), {
      token: teacher,
    })
    expect(perCourse.status).toBe(200)
    expect(perCourse.body.earnings.course).toMatchObject({ paymentCount: 3, priceCents: 8900 })
    expect(perCourse.body.earnings.payments).toHaveLength(3)
    expect(perCourse.body.earnings.payments[0].promoCode).toBeNull()
    expect(
      perCourse.body.earnings.payments
        .map((p: { promoCode: string | null }) => p.promoCode)
        .filter(Boolean),
    ).toEqual(['WELCOME10'])

    // someone outside the profile cannot read its earnings, or learn that the profile exists
    expect((await t.api('GET', teach('/earnings'), { token: learner })).status).toBe(404)
    expect(
      (await t.api('GET', teach(`/earnings/courses/${courseId}`), { token: learner })).status,
    ).toBe(404)
  })

  it('lists transactions for Support and lets a super admin refund through Stripe', async () => {
    const list = await t.api('GET', '/api/support/transactions', { token: agent })
    expect(list.status).toBe(200)
    expect(list.body.items).toHaveLength(3)
    expect(list.body.items[0].learnerEmail).toBe('second-buyer@example.com')
    const searched = await t.api('GET', '/api/support/transactions?q=second-buyer', {
      token: agent,
    })
    expect(searched.body.items).toHaveLength(1)
    const target = searched.body.items[0]
    expect(target).toMatchObject({ status: 'succeeded', amountCents: 8900, refundedCents: 0 })

    const detail = await t.api('GET', `/api/support/transactions/${target.id}`, { token: agent })
    expect(detail.body.transaction.stripe.transferId).toMatch(/^tr_/)
    expect(detail.body.transaction.enrollmentId).toBe(secondEnrollment)
    expect(detail.body.transaction.enrollmentStatus).toBe('active')
    expect(detail.body.transaction.promoCode).toBeNull()
    expect(detail.body.transaction.refunds).toEqual([])

    // agents cannot refund; super admins can
    const denied = await t.api('POST', `/api/support/transactions/${target.id}/refund`, {
      token: agent,
      body: { reason: 'Duplicate purchase' },
    })
    expect(denied.status).toBe(403)
    const refunded = await t.api('POST', `/api/support/transactions/${target.id}/refund`, {
      token: admin,
      body: { reason: 'Duplicate purchase' },
    })
    expect(refunded.status).toBe(200)
    expect(refunded.body.transaction).toMatchObject({
      status: 'refunded',
      refundedCents: 8900,
      enrollmentStatus: 'refunded',
    })
    expect(refunded.body.transaction.refunds).toHaveLength(1)
    expect(refunded.body.transaction.refunds[0]).toMatchObject({
      amountCents: 8900,
      reason: 'Duplicate purchase',
      requestedBy: 'admin@test.local',
    })
    // the learner and the owner of the profile that was paid are each told once
    const notices = t.mailer.sent.slice(-2)
    expect(notices[0]?.subject).toContain('Refund issued')
    expect(notices[1]).toMatchObject({ to: 'daniel@example.com' })
    expect(notices[1]?.subject).toContain('was refunded')
    expect(t.payments.refunds).toHaveLength(1)
    // access is revoked, with its own code so the app can word it
    const revoked = await t.api('GET', `/api/me/enrollments/${secondEnrollment}`, { token: second })
    expect(revoked.status).toBe(403)
    expect(revoked.body.error.code).toBe('enrollment_inactive')
    // a second refund is rejected
    const twice = await t.api('POST', `/api/support/transactions/${target.id}/refund`, {
      token: admin,
      body: { reason: 'again' },
    })
    expect(twice.status).toBe(409)

    // Stripe's charge.refunded webhook for the same refund changes nothing
    const hook = await stripePost(
      t.payments.refundedEvent(detail.body.transaction.stripe.paymentIntentId),
    )
    expect(await hook.json()).toMatchObject({ outcome: 'ignored' })
    expect(await t.db.$count(s.refunds)).toBe(1)

    const filtered = await t.api('GET', '/api/support/transactions?status=refunded', {
      token: agent,
    })
    expect(filtered.body.items.map((x: { id: string }) => x.id)).toEqual([target.id])
  })

  it('applies a refund made in the Stripe dashboard via charge.refunded', async () => {
    const list = await t.api('GET', '/api/support/transactions?status=succeeded', {
      token: agent,
    })
    const victim = list.body.items.find(
      (x: { learnerEmail: string }) => x.learnerEmail === 'half-way@example.com',
    )
    const detail = await t.api('GET', `/api/support/transactions/${victim.id}`, { token: agent })
    const paymentIntentId = detail.body.transaction.stripe.paymentIntentId as string
    await t.payments.createRefund({ paymentIntentId })
    const hook = await stripePost(t.payments.refundedEvent(paymentIntentId))
    expect(await hook.json()).toMatchObject({ outcome: 'applied' })
    const after = await t.api('GET', `/api/support/transactions/${victim.id}`, { token: agent })
    expect(after.body.transaction).toMatchObject({ status: 'refunded', refundedCents: 8900 })
    expect(after.body.transaction.refunds[0]).toMatchObject({
      reason: 'Refunded in Stripe',
      requestedBy: null,
    })
  })

  it('reflects refunds in earnings, the payout ledger and the audit log', async () => {
    const after = await t.api('GET', teach('/earnings'), { token: teacher })
    expect(after.body.earnings.totals.refundedCents).toBe(8900 * 2)
    expect(after.body.earnings.totals.netCents).toBeLessThan(netBefore)
    const reconcile = await t.api('GET', teach('/earnings/reconcile'), { token: teacher })
    expect(reconcile.body.reconciliation.differenceCents).toBe(0)

    const payouts = await t.api('GET', '/api/support/payouts', { token: agent })
    expect(payouts.body.items[0]).toMatchObject({
      profileId,
      profileName: 'Daniel Goh',
      ownerEmail: 'daniel@example.com',
      payoutsEnabled: true,
      transferCount: 3,
      refundedCents: 8900 * 2,
    })

    const audit = await t.api('GET', '/api/support/audit-log', { token: agent })
    const actions = audit.body.items.map((a: { action: string }) => a.action)
    expect(actions).toEqual(
      expect.arrayContaining([
        'payment.refund',
        'payment.refund.webhook',
        'certificate.issue',
        'payment.succeeded',
      ]),
    )
    const manual = audit.body.items.find((a: { action: string }) => a.action === 'payment.refund')
    expect(manual.actorEmail).toBe('admin@test.local')
    expect(manual.metadata).toMatchObject({ reason: 'Duplicate purchase', amountCents: 8900 })
    expect((await t.api('GET', '/api/support/audit-log', { token: learner })).status).toBe(403)
  })
})

describe('learner email language', () => {
  const lastTo = (email: string) => t.mailer.sent.filter((m) => m.to === email).at(-1)

  it("sends a Chinese account's certificate and refund emails in Chinese, the teacher's in English", async () => {
    const zh = (
      await t.signIn('zh-grad@example.com', 'learner', { locale: 'zh', localeChosen: true })
    ).token as string
    const enrollmentId = await buy(zh)
    await completeCourse(zh, enrollmentId)
    const certificate = lastTo('zh-grad@example.com')
    expect(certificate?.html).toContain('<html lang="zh">')
    expect(certificate?.subject).toBe(
      translate('zh', 'email.certificate.title', { course: 'Sourdough from Scratch' }),
    )

    const payment = await t.db.query.payments.findFirst({ where: { enrollmentId } })
    const refunded = await t.api('POST', `/api/support/transactions/${payment?.id}/refund`, {
      token: admin,
      body: { reason: 'Bought by mistake' },
    })
    expect(refunded.status).toBe(200)
    const refund = lastTo('zh-grad@example.com')
    expect(refund?.html).toContain('<html lang="zh">')
    expect(refund?.subject).toBe(
      translate('zh', 'email.refund.title', { course: 'Sourdough from Scratch' }),
    )
    expect(refund?.text).toContain(
      translate('zh', 'email.refund.reason', { reason: 'Bought by mistake' }),
    )
    expect(refund?.text).toContain(translate('zh', 'email.refund.accessRemoved'))
    const owner = lastTo('daniel@example.com')
    expect(owner?.html).toContain('<html lang="en">')
    expect(owner?.subject).toContain('was refunded')
  })

  it('translates the reason of a refund made in the Stripe dashboard', async () => {
    const zh = (
      await t.signIn('zh-dashboard@example.com', 'learner', { locale: 'zh', localeChosen: true })
    ).token as string
    const enrollmentId = await buy(zh)
    const payment = await t.db.query.payments.findFirst({ where: { enrollmentId } })
    await t.payments.createRefund({ paymentIntentId: payment?.stripePaymentIntentId as string })
    await stripePost(t.payments.refundedEvent(payment?.stripePaymentIntentId as string))
    const refund = lastTo('zh-dashboard@example.com')
    expect(refund?.text).toContain(
      translate('zh', 'email.refund.reason', {
        reason: translate('zh', 'email.refund.reasonStripe'),
      }),
    )
    // the stored reason stays the constant, whatever the learner's language
    const row = await t.db.query.refunds.findFirst({ where: { paymentId: payment?.id as string } })
    expect(row?.reason).toBe('Refunded in Stripe')
  })

  it('sends English to an account with no language', async () => {
    const none = (await t.signIn('no-language@example.com')).token as string
    const enrollmentId = await buy(none)
    await completeCourse(none, enrollmentId)
    const certificate = lastTo('no-language@example.com')
    expect(certificate?.html).toContain('<html lang="en">')
    expect(certificate?.subject).toBe('Your certificate: Sourdough from Scratch')
  })
})

describe('class sales in earnings', () => {
  it('counts each seat by its share after refunds, and reconciles after a part refund', async () => {
    const sell = await seller(t)
    const first = await newClass(t, sell, [block(14)])
    const second = await newClass(t, sell, [block(20)])
    const withdrawn = await seat(t, first.classId)
    const part = await seat(t, first.classId)
    const cancelled = await seat(t, second.classId)
    const token = await teachToken(t, sell)
    const base = `/api/teach/profiles/${sell.profileId}`
    expect(
      (
        await t.api('POST', `/api/me/classes/${withdrawn.enrollmentId}/withdraw`, {
          token: withdrawn.token,
        })
      ).status,
    ).toBe(200)
    const refund = await t.api(
      'POST',
      `${base}/classes/${first.classId}/learners/${part.enrollmentId}/refund`,
      { token, body: { amountCents: 10000, reason: 'The room was too cold.' } },
    )
    expect(refund.status).toBe(200)
    const cancel = await t.api('POST', `${base}/classes/${second.classId}/cancel`, {
      token,
      body: { reason: 'The teacher is unwell.' },
    })
    expect(cancel.status).toBe(200)
    await new SeatRefundsService(t.deps).sendUnfinished(t.now())

    const rows = await t.db.query.payments.findMany({
      where: { payoutAccountId: sell.payoutAccountId },
      with: { refunds: true },
    })
    const share = (id: string) => {
      const p = rows.find((r) => r.id === id)
      if (!p) throw new Error('no payment')
      return profileShareAfterRefunds({ ...p, bankDisputeLost: false })
    }
    // the amounts table: a withdrawal leaves the profile at zero, a cancelled seat −F
    expect(share(withdrawn.paymentId)).toBe(0)
    expect(share(cancelled.paymentId)).toBe(-F)
    const partShare = N - 10000 + Math.floor((K * 10000) / A)
    expect(share(part.paymentId)).toBe(partShare)

    const earnings = (await t.api('GET', `${base}/earnings`, { token })).body.earnings
    expect(earnings.totals.netCents).toBe(partShare - F)
    // The summary's parts add up to the net: the withdrawal and the cancellation each return K of
    // Elevate's fee to the profile, the part refund its share of K.
    type Parts = {
      grossCents: number
      stripeFeeCents: number
      commissionCents: number
      refundedCents: number
      feeReturnedCents: number
      netCents: number
    }
    const added = (b: Parts) =>
      b.grossCents - b.stripeFeeCents - b.commissionCents - b.refundedCents + b.feeReturnedCents
    expect(earnings.totals.feeReturnedCents).toBe(2 * K + Math.floor((K * 10000) / A))
    expect(earnings.totals.refundedCents).toBe(A - F + 10000 + A)
    expect(added(earnings.totals)).toBe(earnings.totals.netCents)
    for (const course of earnings.courses) expect(added(course)).toBe(course.netCents)

    // Support's transaction page: each side's net after the refunds, beside the nets before
    const detail = async (id: string) =>
      (await t.api('GET', `/api/support/transactions/${id}`, { token: agent })).body.transaction
    expect(await detail(withdrawn.paymentId)).toMatchObject({
      teacherNetCents: N,
      platformNetCents: K,
      teacherNetAfterRefundsCents: 0,
      platformNetAfterRefundsCents: 0,
    })
    expect(await detail(cancelled.paymentId)).toMatchObject({
      teacherNetAfterRefundsCents: -F,
      platformNetAfterRefundsCents: 0,
    })
    expect(await detail(part.paymentId)).toMatchObject({
      teacherNetAfterRefundsCents: partShare,
      platformNetAfterRefundsCents: K - Math.floor((K * 10000) / A),
    })
    expect(
      Object.fromEntries(
        earnings.recent.map((r: { paymentId: string; netCents: number }) => [
          r.paymentId,
          r.netCents,
        ]),
      ),
    ).toEqual({
      [withdrawn.paymentId]: 0,
      [part.paymentId]: partShare,
      [cancelled.paymentId]: -F,
    })
    expect(earnings).toMatchObject({
      heldCents: partShare,
      heldClasses: [
        {
          classId: first.classId,
          className: expect.any(String),
          heldCents: partShare,
          releaseDueAt: new Date(first.lastEndsAt.getTime() + RELEASE_AFTER_MS).toISOString(),
          waitingFor: null,
        },
      ],
      payouts: [],
      // the cancelled seat's debt counts at once
      debtCents: F,
    })
    const perCourse = await t.api('GET', `${base}/earnings/courses/${sell.courseId}`, { token })
    expect(perCourse.body.earnings.course.netCents).toBe(partShare - F)
    expect(added(perCourse.body.earnings.course)).toBe(partShare - F)
    for (const p of perCourse.body.earnings.payments)
      expect(added({ ...p, grossCents: p.amountCents })).toBe(p.netCents)

    const reconcile = await t.api('GET', `${base}/earnings/reconcile`, { token })
    expect(reconcile.body.reconciliation).toMatchObject({
      ledgerNetCents: partShare - F,
      stripeTransferTotalCents: partShare - F,
      differenceCents: 0,
    })
  })
})
