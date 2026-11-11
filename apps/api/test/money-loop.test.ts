import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * The headline loop from docs/spec.md, scripted end to end on the fake Stripe/Mux/mail providers:
 * teacher applies → Support approves → Stripe Connect → builds a course → submits → Support approves
 * → learner quotes and pays → webhook fulfils → lessons + quiz → certificate → public verify →
 * teacher earnings reconcile against Stripe transfers → Support sees the transaction and payout.
 * Runs on an empty platform (no seed) so nothing here depends on demo data.
 */
let t: TestApp
let teacher: string
let teacherId: string
let agent: string
let admin: string
let learner: string
let courseId: string
let courseSlug: string
let lessonA: string
let lessonB: string
let enrollmentId: string
let certificateToken: string

const stripePost = (event: unknown) =>
  t.app.request('/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 'fake-valid' },
    body: JSON.stringify(event),
  })

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

beforeAll(async () => {
  t = await createTestApp()
  await t.grantRole('admin@example.com', 'super_admin')
  await t.grantRole('agent@example.com', 'support_agent')
  admin = (await t.signIn('admin@example.com', 'support')).token as string
  agent = (await t.signIn('agent@example.com', 'support')).token as string
  const signedTeacher = await t.signIn('noor@example.com', 'teach')
  teacher = signedTeacher.token as string
  teacherId = signedTeacher.body.user.id
  learner = (await t.signIn('amira@example.com')).token as string
  await t.api('PATCH', '/api/me', { token: learner, body: { name: 'Amira Binte Rahman' } })
})
afterAll(async () => {
  await t.close()
})

describe('money loop', () => {
  it('1. a teacher applies and Support approves the application', async () => {
    const applied = await t.api('POST', '/api/teach/apply', {
      token: teacher,
      body: {
        displayName: 'Noor Hassan',
        headline: 'Batik artist and workshop lead',
        bio: 'Fifteen years of hand-drawn batik in Kampong Glam, and eight years teaching weekend workshops for complete beginners.',
        credentials:
          'NAFA Diploma in Fine Art. Featured in the Singapore Design Week batik showcase.',
        teachingSampleUrl: 'https://example.com/batik-sample',
      },
    })
    expect(applied.status).toBe(200)
    expect(applied.body.profile.status).toBe('applied')
    expect((await t.api('GET', '/api/teach/courses', { token: teacher })).status).toBe(403)

    const approved = await t.api('POST', `/api/support/teachers/${teacherId}/approve`, {
      token: agent,
      body: {},
    })
    expect(approved.status).toBe(200)
    expect(approved.body.profile.status).toBe('approved')
    expect((await t.api('GET', '/api/teach/courses', { token: teacher })).status).toBe(200)
  })

  it('2. the teacher connects a Stripe account and charges get enabled by webhook', async () => {
    const link = await t.api('POST', '/api/teach/stripe/onboarding-link', { token: teacher })
    expect(link.status).toBe(200)
    expect(link.body.url).toContain('connect.fake-stripe.test')
    const profile = await t.db.query.teacherProfiles.findFirst({
      where: { userId: teacherId },
    })
    const accountId = profile?.stripeAccountId as string
    expect(accountId).toMatch(/^acct_fake_/)
    const hook = await stripePost(t.payments.enableAccount(accountId))
    expect(await hook.json()).toMatchObject({ outcome: 'applied' })
    const status = await t.api('GET', '/api/teach/stripe/status', { token: teacher })
    expect(status.body.stripe).toMatchObject({ chargesEnabled: true, payoutsEnabled: true })
  })

  it('3. the teacher builds a gated two-lesson course with a quiz and submits it', async () => {
    const created = await t.api('POST', '/api/teach/courses', {
      token: teacher,
      body: { title: 'Hand-drawn Batik: Wax, Dye, Finish', category: 'craft-making' },
    })
    expect(created.status).toBe(200)
    courseId = created.body.course.id
    courseSlug = created.body.course.slug

    const a = await t.api('POST', `/api/teach/courses/${courseId}/lessons`, {
      token: teacher,
      body: { title: 'Tools, wax and the canting' },
    })
    lessonA = a.body.course.lessons[0].id
    const b = await t.api('POST', `/api/teach/courses/${courseId}/lessons`, {
      token: teacher,
      body: { title: 'Dye baths and finishing' },
    })
    lessonB = b.body.course.lessons[1].id

    const text = await t.api('POST', `/api/teach/lessons/${lessonA}/artefacts`, {
      token: teacher,
      body: { type: 'text', title: 'Setting up a safe wax station' },
    })
    const textId = text.body.course.lessons[0].artefacts[0].id
    await t.api('PATCH', `/api/teach/artefacts/${textId}`, {
      token: teacher,
      body: { contentJson: doc('Heat the wax to about 70°C and keep a damp cloth within reach.') },
    })
    const quiz = await t.api('POST', `/api/teach/lessons/${lessonB}/artefacts`, {
      token: teacher,
      body: { type: 'quiz', title: 'Final check' },
    })
    const quizArtefactId = quiz.body.course.lessons[1].artefacts[0].id
    const upserted = await t.api('PUT', `/api/teach/artefacts/${quizArtefactId}/quiz`, {
      token: teacher,
      body: {
        passMarkPercent: 70,
        questions: [
          {
            id: 'q1',
            prompt: 'Which tool draws the wax lines?',
            options: [
              { id: 'a', text: 'A canting', correct: true },
              { id: 'b', text: 'A paint roller', correct: false },
            ],
          },
          {
            id: 'q2',
            prompt: 'Which comes first?',
            options: [
              { id: 'a', text: 'Dye, then wax', correct: false },
              { id: 'b', text: 'Wax, then dye', correct: true },
            ],
          },
        ],
      },
    })
    expect(upserted.status).toBe(200)
    const gated = await t.api('PUT', `/api/teach/lessons/${lessonB}/prerequisites`, {
      token: teacher,
      body: { prerequisiteIds: [lessonA] },
    })
    expect(gated.status).toBe(200)

    const upload = await t.api('POST', '/api/media/uploads', {
      token: teacher,
      body: { kind: 'image', filename: 'cover.png', mimeType: 'image/png', sizeBytes: 10 },
    })
    const asset = await t.db.query.mediaAssets.findFirst({
      where: { id: upload.body.asset.id },
    })
    await t.storage.put(asset?.storageKey as string, new Uint8Array([1]), 'image/png')
    await t.api('POST', `/api/media/assets/${upload.body.asset.id}/complete`, { token: teacher })
    const patched = await t.api('PATCH', `/api/teach/courses/${courseId}`, {
      token: teacher,
      body: {
        summary: 'Draw with hot wax, dye in layers and finish a cloth you will actually use.',
        descriptionJson: doc('Two evenings: one at the wax table, one at the dye bath.'),
        priceCents: 7900,
        thumbnailMediaId: upload.body.asset.id,
      },
    })
    expect(patched.status).toBe(200)
    const ready = await t.api('GET', `/api/teach/courses/${courseId}`, { token: teacher })
    expect(ready.body.course.checklist.ok).toBe(true)
    const submitted = await t.api('POST', `/api/teach/courses/${courseId}/submit`, {
      token: teacher,
    })
    expect(submitted.body.course.status).toBe('pending_review')
    // not on the public catalogue until Support approves
    expect((await t.api('GET', `/api/catalog/courses/${courseSlug}`)).status).toBe(404)
  })

  it('4. Support approves the course from the review queue and it goes live', async () => {
    const queue = await t.api('GET', '/api/support/review-queue', { token: agent })
    expect(queue.body.items.map((c: { id: string }) => c.id)).toContain(courseId)
    const approved = await t.api('POST', `/api/support/courses/${courseId}/approve`, {
      token: agent,
    })
    expect(approved.status).toBe(200)
    expect(approved.body.course.status).toBe('live')
    const pub = await t.api('GET', `/api/catalog/courses/${courseSlug}`)
    expect(pub.status).toBe(200)
    expect(pub.body.course.priceCents).toBe(7900)
    expect(pub.body.course.teacher.displayName).toBe('Noor Hassan')
  })

  it('5. a learner quotes, pays through Stripe Checkout and is enrolled by the webhook', async () => {
    const quote = await t.api('POST', '/api/checkout/quote', {
      token: learner,
      body: { courseId },
    })
    expect(quote.status).toBe(200)
    expect(quote.body.quote).toMatchObject({ amountCents: 7900, discountCents: 0 })

    const start = await t.api('POST', `/api/checkout/courses/${courseId}`, {
      token: learner,
      body: {},
    })
    expect(start.body.kind).toBe('redirect')
    const hook = await stripePost(t.payments.completeCheckout(start.body.sessionId))
    expect(await hook.json()).toMatchObject({ outcome: 'applied' })

    // S$79.00 at 3.4% + S$0.50 and 15% commission on the net after fees
    const payment = await t.db.query.payments.findFirst({
      where: { stripeCheckoutSessionId: start.body.sessionId },
    })
    expect(payment).toMatchObject({
      listPriceCents: 7900,
      amountCents: 7900,
      stripeFeeEstimateCents: 319,
      stripeFeeActualCents: 319,
      commissionCents: 1137,
      applicationFeeCents: 1456,
      teacherNetCents: 6444,
      platformNetCents: 1137,
      status: 'succeeded',
    })
    expect(payment?.stripeTransferId).toMatch(/^tr_/)
    enrollmentId = payment?.enrollmentId as string

    const mine = await t.api('GET', '/api/me/enrollments', { token: learner })
    expect(mine.body.items).toHaveLength(1)
    expect(mine.body.items[0]).toMatchObject({ id: enrollmentId, status: 'active' })
    // our own confirmation email (Stripe sends no receipts in test mode)
    expect(t.mailer.sent.filter((m) => m.to === 'amira@example.com').length).toBeGreaterThan(1)
  })

  it('6. the learner finishes the lessons in order, passes the quiz and earns a certificate', async () => {
    const base = `/api/me/enrollments/${enrollmentId}`
    const detail = (await t.api('GET', base, { token: learner })).body.enrollment
    expect(detail.lessons.map((l: { status: string }) => l.status)).toEqual(['available', 'locked'])
    expect((await t.api('GET', `${base}/lessons/${lessonB}`, { token: learner })).status).toBe(403)

    const first = (await t.api('GET', `${base}/lessons/${lessonA}`, { token: learner })).body.lesson
    const done = await t.api('POST', `${base}/artefacts/${first.artefacts[0].id}/progress`, {
      token: learner,
      body: { status: 'completed' },
    })
    expect(done.body.progress).toMatchObject({ completedLessons: 1, isComplete: false })

    const second = (await t.api('GET', `${base}/lessons/${lessonB}`, { token: learner })).body
      .lesson
    const quizId: string = second.artefacts[0].quizId
    const attempt = await t.api('POST', `${base}/quizzes/${quizId}/attempts`, { token: learner })
    expect(attempt.status).toBe(200)
    expect(JSON.stringify(attempt.body.quiz)).not.toContain('correct')
    const result = await t.api(
      'POST',
      `${base}/quizzes/${quizId}/attempts/${attempt.body.attempt.id}/submit`,
      { token: learner, body: { answers: { q1: 'a', q2: 'b' } } },
    )
    expect(result.status).toBe(200)
    expect(result.body.passed).toBe(true)
    expect(result.body.progress.isComplete).toBe(true)

    const cert = await t.api('GET', `${base}/certificate`, { token: learner })
    expect(cert.status).toBe(200)
    expect(cert.body.certificate).toMatchObject({
      learnerName: 'Amira Binte Rahman',
      courseTitle: 'Hand-drawn Batik: Wax, Dye, Finish',
      teacherName: 'Noor Hassan',
    })
    certificateToken = cert.body.certificate.token
    expect(t.mailer.last()?.subject).toContain('Your certificate')
  })

  it('7. anyone can verify the certificate and open the PDF without signing in', async () => {
    const verify = await t.api('GET', `/api/certificates/verify/${certificateToken}`)
    expect(verify.status).toBe(200)
    expect(verify.body).toMatchObject({ valid: true, courseSlug })
    expect(verify.body.certificate.learnerName).toBe('Amira Binte Rahman')
    const pdf = await t.app.request(`/api/certificates/${certificateToken}/pdf`)
    expect(pdf.status).toBe(200)
    expect(pdf.headers.get('content-type')).toBe('application/pdf')
  })

  it('8. the teacher sees the payout and the ledger reconciles with Stripe transfers', async () => {
    const earnings = await t.api('GET', '/api/teach/earnings', { token: teacher })
    expect(earnings.status).toBe(200)
    expect(earnings.body.earnings.totals).toMatchObject({
      paymentCount: 1,
      grossCents: 7900,
      stripeFeeCents: 319,
      commissionCents: 1137,
      netCents: 6444,
      refundedCents: 0,
    })
    expect(earnings.body.earnings.courses[0]).toMatchObject({ slug: courseSlug, netCents: 6444 })
    const reconcile = await t.api('GET', '/api/teach/earnings/reconcile', { token: teacher })
    expect(reconcile.body.reconciliation).toMatchObject({
      stripeTransferTotalCents: 6444,
      ledgerNetCents: 6444,
      differenceCents: 0,
    })
  })

  it('9. Support sees the transaction, the payout ledger and the audit trail', async () => {
    const list = await t.api('GET', '/api/support/transactions', { token: agent })
    expect(list.body.items).toHaveLength(1)
    expect(list.body.items[0]).toMatchObject({
      learnerEmail: 'amira@example.com',
      teacherName: 'Noor Hassan',
      amountCents: 7900,
      applicationFeeCents: 1456,
      teacherNetCents: 6444,
      status: 'succeeded',
    })
    const payouts = await t.api('GET', '/api/support/payouts', { token: admin })
    expect(payouts.body.items).toHaveLength(1)
    expect(payouts.body.items[0]).toMatchObject({
      teacherEmail: 'noor@example.com',
      transferCount: 1,
      transferredCents: 6444,
      payoutsEnabled: true,
    })
    const audit = await t.api('GET', '/api/support/audit-log', { token: agent })
    expect(audit.body.items.map((a: { action: string }) => a.action)).toEqual(
      expect.arrayContaining(['payment.succeeded', 'enrollment.completed', 'certificate.issue']),
    )
  })

  it('10. the funnel metrics reflect the loop: completion, drop-off, conversion, first payout', async () => {
    const res = await t.api('GET', '/api/support/analytics', { token: agent })
    expect(res.status).toBe(200)
    const a = res.body.analytics
    expect(a.completion).toEqual({ enrolled: 1, completed: 1, ratePercent: 100 })
    expect(a.courses[0]).toMatchObject({ courseId, enrolled: 1, completed: 1, ratePercent: 100 })
    expect(a.dropOff.lessons).toEqual([
      { position: 0, starts: 1 },
      { position: 1, starts: 1 },
    ])
    expect(a.dropOff.dropOffIndex).toBeNull()
    expect(a.checkout.completed).toBe(1)
    expect(a.checkout.started).toBeGreaterThanOrEqual(1)
    expect(a.firstPayout.teachersPaid).toBe(1)
    expect(a.firstPayout.medianDays).toBe(0)
    expect((await t.api('GET', '/api/support/analytics', { token: learner })).status).toBe(403)
  })
})
