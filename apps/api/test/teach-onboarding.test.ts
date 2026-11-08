import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
let applicant: string
let agent: string
let admin: string
let applicantId: string

const application = {
  displayName: 'Mei Lin Tan',
  headline: 'Ceramicist and studio teacher',
  bio: 'Twelve years of throwing pots and eight years teaching beginners how to read clay with their hands.',
  credentials: 'Diploma in Fine Arts (Ceramics). Resident artist at a clay studio since 2018.',
  teachingSampleUrl: 'https://example.com/sample',
}

beforeAll(async () => {
  t = await createTestApp()
  applicant = (await t.signIn('applicant@example.com', 'teach')).token as string
  await t.grantRole('agent@example.com', 'support_agent')
  await t.grantRole('admin@example.com', 'super_admin')
  agent = (await t.signIn('agent@example.com', 'support')).token as string
  admin = (await t.signIn('admin@example.com', 'support')).token as string
})
afterAll(async () => {
  await t.close()
})

describe('teacher onboarding', () => {
  it('validates and records an application without granting the teacher role', async () => {
    const invalid = await t.api('POST', '/api/teach/apply', {
      token: applicant,
      body: { ...application, bio: 'too short' },
    })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.details.some((d: { path: string }) => d.path === 'bio')).toBe(true)

    const ok = await t.api('POST', '/api/teach/apply', { token: applicant, body: application })
    expect(ok.status).toBe(200)
    expect(ok.body.profile.status).toBe('applied')
    applicantId = ok.body.profile.userId
    expect(t.mailer.last()?.subject).toContain('received')

    const me = await t.api('GET', '/api/auth/me', { token: applicant })
    expect(me.body.user.roles).not.toContain('teacher')
    expect(me.body.user.teacher.status).toBe('applied')

    const stripe = await t.api('POST', '/api/teach/stripe/onboarding-link', { token: applicant })
    expect(stripe.status).toBe(403)
  })

  it('lists the pending application for Support and refuses learners', async () => {
    const list = await t.api('GET', '/api/support/people?role=teacher&status=applied', {
      token: agent,
    })
    expect(list.status).toBe(200)
    expect(list.body.items.map((p: { email: string }) => p.email)).toContain(
      'applicant@example.com',
    )
    const search = await t.api('GET', '/api/support/people?q=mei%20lin', { token: agent })
    expect(search.body.items).toHaveLength(1)
    expect((await t.api('GET', '/api/support/people', { token: applicant })).status).toBe(403)
  })

  it('approval grants the role, emails the teacher and writes an audit row', async () => {
    const res = await t.api('POST', `/api/support/teachers/${applicantId}/approve`, {
      token: agent,
      body: { note: 'Strong portfolio' },
    })
    expect(res.status).toBe(200)
    expect(res.body.profile.status).toBe('approved')
    expect(t.mailer.last()?.subject).toContain('Welcome')
    const me = await t.api('GET', '/api/auth/me', { token: applicant })
    expect(me.body.user.roles).toContain('teacher')
    const audit = await t.db.query.auditLog.findMany({
      where: eq(s.auditLog.entityId, applicantId),
    })
    expect(audit.map((a) => a.action)).toContain('teacher.approve')
    expect(
      (
        await t.api('POST', `/api/support/teachers/${applicantId}/approve`, {
          token: agent,
          body: {},
        })
      ).status,
    ).toBe(409)
  })

  it('connects Stripe and reflects onboarding completion from the webhook', async () => {
    const link = await t.api('POST', '/api/teach/stripe/onboarding-link', { token: applicant })
    expect(link.status).toBe(200)
    expect(link.body.url).toContain('fake-stripe')
    const profile = await t.db.query.teacherProfiles.findFirst({
      where: eq(s.teacherProfiles.userId, applicantId),
    })
    expect(profile?.stripeAccountId).toBeTruthy()

    const before = await t.api('GET', '/api/teach/stripe/status', { token: applicant })
    expect(before.body.stripe).toMatchObject({ connected: true, chargesEnabled: false })
    expect((await t.api('POST', '/api/teach/stripe/login-link', { token: applicant })).status).toBe(
      409,
    )

    const event = t.payments.enableAccount(profile?.stripeAccountId as string)
    const hook = await t.app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'fake-valid' },
      body: JSON.stringify(event),
    })
    expect(hook.status).toBe(200)
    const after = await t.api('GET', '/api/teach/stripe/status', { token: applicant })
    expect(after.body.stripe).toMatchObject({
      connected: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    })
    const login = await t.api('POST', '/api/teach/stripe/login-link', { token: applicant })
    expect(login.status).toBe(200)
    const me = await t.api('GET', '/api/auth/me', { token: applicant })
    expect(me.body.user.teacher.stripeChargesEnabled).toBe(true)
  })

  it('rejects with a reason and allows a re-application', async () => {
    const other = (await t.signIn('second@example.com', 'teach')).token as string
    const applied = await t.api('POST', '/api/teach/apply', {
      token: other,
      body: { ...application, displayName: 'Second Teacher' },
    })
    const id = applied.body.profile.userId
    expect(
      (
        await t.api('POST', `/api/support/teachers/${id}/reject`, {
          token: agent,
          body: { reason: 'short' },
        })
      ).status,
    ).toBe(400)
    const rejected = await t.api('POST', `/api/support/teachers/${id}/reject`, {
      token: agent,
      body: { reason: 'Please add a teaching sample video.' },
    })
    expect(rejected.body.profile.status).toBe('rejected')
    expect(rejected.body.profile.reviewNote).toContain('teaching sample')
    const again = await t.api('POST', '/api/teach/apply', {
      token: other,
      body: { ...application, displayName: 'Second Teacher' },
    })
    expect(again.body.profile.status).toBe('applied')
    expect(again.body.profile.reviewNote).toBeNull()
  })

  it('only super admins change commission or roles', async () => {
    expect(
      (
        await t.api('PATCH', `/api/support/teachers/${applicantId}/commission`, {
          token: agent,
          body: { commissionBps: 1800 },
        })
      ).status,
    ).toBe(403)
    const ok = await t.api('PATCH', `/api/support/teachers/${applicantId}/commission`, {
      token: admin,
      body: { commissionBps: 1800 },
    })
    expect(ok.status).toBe(200)
    expect(ok.body.profile.commissionBps).toBe(1800)
    expect(
      (
        await t.api('PATCH', `/api/support/teachers/${applicantId}/commission`, {
          token: admin,
          body: { commissionBps: 9000 },
        })
      ).status,
    ).toBe(400)

    const learner = await t.ensureUser('newstaff@example.com')
    const granted = await t.api('POST', `/api/support/people/${learner.id}/roles`, {
      token: admin,
      body: { role: 'support_agent', grant: true },
    })
    expect(granted.status).toBe(200)
    expect(granted.body.person.roles).toContain('support_agent')
    expect(
      (
        await t.api('POST', `/api/support/people/${learner.id}/roles`, {
          token: admin,
          body: { role: 'teacher', grant: true },
        })
      ).status,
    ).toBe(400)
    const detail = await t.api('GET', `/api/support/people/${applicantId}`, { token: agent })
    expect(detail.body.person.teacherProfile.status).toBe('approved')
    expect(detail.body.person.stats).toMatchObject({ enrollments: 0, courses: 0 })
  })
})
