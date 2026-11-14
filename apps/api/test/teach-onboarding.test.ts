import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
let applicant: string
let agent: string
let admin: string
let applicantId: string
let profileId: string

/** Every Teach route for the applicant sits under their profile, once they have one. */
const teach = (path: string) => `/api/teach/profiles/${profileId}${path}`

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
  it('validates and records an application as a profile awaiting approval', async () => {
    const invalid = await t.api('POST', '/api/teach/apply', {
      token: applicant,
      body: { ...application, bio: 'too short' },
    })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.details.some((d: { path: string }) => d.path === 'bio')).toBe(true)

    const ok = await t.api('POST', '/api/teach/apply', { token: applicant, body: application })
    expect(ok.status).toBe(200)
    expect(ok.body.profile).toMatchObject({ status: 'applied', type: 'personal', payout: null })
    profileId = ok.body.profile.id
    expect(t.mailer.last()?.subject).toContain('received')

    const me = await t.api('GET', '/api/auth/me', { token: applicant })
    applicantId = me.body.user.id
    expect(me.body.user.roles).toEqual([])
    expect(me.body.user.profiles).toEqual([
      {
        id: profileId,
        type: 'personal',
        displayName: 'Mei Lin Tan',
        status: 'applied',
        role: 'owner',
      },
    ])
    const list = await t.api('GET', '/api/teach/profiles', { token: applicant })
    expect(list.body.items).toEqual(me.body.user.profiles)

    // an applicant can read and edit the profile, and nothing else
    expect((await t.api('GET', teach('/profile'), { token: applicant })).status).toBe(200)
    const stripe = await t.api('POST', teach('/stripe/onboarding-link'), { token: applicant })
    expect(stripe.status).toBe(403)
    const create = await t.api('POST', teach('/courses'), {
      token: applicant,
      body: { title: 'Too early', category: 'craft-making' },
    })
    expect(create.status).toBe(403)
  })

  it('lists the pending application for Support and refuses learners', async () => {
    const list = await t.api('GET', '/api/support/profiles?status=applied', { token: agent })
    expect(list.status).toBe(200)
    expect(list.body.items.map((p: { ownerEmail: string }) => p.ownerEmail)).toContain(
      'applicant@example.com',
    )
    expect(
      (await t.api('GET', '/api/support/profiles?status=approved', { token: agent })).body.items,
    ).toHaveLength(0)
    // found by profile name from the profiles list and from the people list
    const byName = await t.api('GET', '/api/support/profiles?q=mei%20lin', { token: agent })
    expect(byName.body.items.map((p: { id: string }) => p.id)).toEqual([profileId])
    const search = await t.api('GET', '/api/support/people?q=mei%20lin', { token: agent })
    expect(search.body.items).toHaveLength(1)
    expect(search.body.items[0].profiles[0]).toMatchObject({ id: profileId, role: 'owner' })
    // someone with a profile is not listed as a learner
    const learners = await t.api('GET', '/api/support/people?role=learner', { token: agent })
    expect(learners.body.items.map((p: { email: string }) => p.email)).not.toContain(
      'applicant@example.com',
    )
    expect((await t.api('GET', '/api/support/people', { token: applicant })).status).toBe(403)
    expect((await t.api('GET', '/api/support/profiles', { token: applicant })).status).toBe(403)
  })

  it('approval opens the profile, emails the owner and writes an audit row', async () => {
    const res = await t.api('POST', `/api/support/profiles/${profileId}/approve`, {
      token: agent,
      body: { note: 'Strong portfolio' },
    })
    expect(res.status).toBe(200)
    expect(res.body.profile.status).toBe('approved')
    expect(t.mailer.last()?.subject).toContain('Welcome')
    expect(t.mailer.last()?.to).toBe('applicant@example.com')
    // approval is on the profile; the user gets no platform role
    const me = await t.api('GET', '/api/auth/me', { token: applicant })
    expect(me.body.user.roles).toEqual([])
    expect(me.body.user.profiles[0].status).toBe('approved')
    const audit = await t.db.query.auditLog.findMany({ where: { profileId } })
    expect(audit.map((a) => a.action)).toContain('profile.approve')
    expect(
      (
        await t.api('POST', `/api/support/profiles/${profileId}/approve`, {
          token: agent,
          body: {},
        })
      ).status,
    ).toBe(409)
  })

  it('connects Stripe and reflects onboarding completion from the webhook', async () => {
    const link = await t.api('POST', teach('/stripe/onboarding-link'), { token: applicant })
    expect(link.status).toBe(200)
    expect(link.body.url).toContain('fake-stripe')
    const account = await t.db.query.payoutAccounts.findFirst({ where: { profileId } })
    expect(account).toMatchObject({ businessType: 'individual', status: 'onboarding' })
    expect(account?.stripeAccountId).toBeTruthy()
    // the Stripe account carries our IDs, and the owner is told a link was opened
    expect(t.payments.accounts.get(account?.stripeAccountId as string)).toMatchObject({
      businessType: 'individual',
      metadata: { elevateProfileId: profileId, elevatePayoutAccountId: account?.id },
    })
    expect(t.mailer.last()).toMatchObject({ to: 'applicant@example.com' })
    expect(t.mailer.last()?.subject).toContain('Stripe onboarding')

    const before = await t.api('GET', teach('/stripe/status'), { token: applicant })
    expect(before.body.stripe).toMatchObject({
      connected: true,
      status: 'onboarding',
      chargesEnabled: false,
    })
    expect((await t.api('POST', teach('/stripe/login-link'), { token: applicant })).status).toBe(
      409,
    )

    const hook = await t.stripeWebhook(t.payments.enableAccount(account?.stripeAccountId as string))
    expect(hook.status).toBe(200)
    const after = await t.api('GET', teach('/stripe/status'), { token: applicant })
    expect(after.body.stripe).toMatchObject({
      connected: true,
      status: 'active',
      chargesEnabled: true,
      payoutsEnabled: true,
    })
    const login = await t.api('POST', teach('/stripe/login-link'), { token: applicant })
    expect(login.status).toBe(200)
    expect(t.mailer.last()?.subject).toContain('Stripe dashboard')
    const profile = await t.api('GET', teach('/profile'), { token: applicant })
    expect(profile.body.profile.payout).toMatchObject({ status: 'active', chargesEnabled: true })
    expect(profile.body.profile.actingAsStaff).toBe(false)
  })

  it('rejects with a reason and allows a re-application', async () => {
    const other = (await t.signIn('second@example.com', 'teach')).token as string
    const applied = await t.api('POST', '/api/teach/apply', {
      token: other,
      body: { ...application, displayName: 'Second Teacher' },
    })
    const id = applied.body.profile.id
    expect(
      (
        await t.api('POST', `/api/support/profiles/${id}/reject`, {
          token: agent,
          body: { reason: 'short' },
        })
      ).status,
    ).toBe(400)
    const rejected = await t.api('POST', `/api/support/profiles/${id}/reject`, {
      token: agent,
      body: { reason: 'Please add a teaching sample video.' },
    })
    expect(rejected.body.profile.status).toBe('rejected')
    expect(rejected.body.profile.reviewNote).toContain('teaching sample')
    const again = await t.api('POST', '/api/teach/apply', {
      token: other,
      body: { ...application, displayName: 'Second Teacher' },
    })
    // the same profile goes back to "applied": a person has one personal profile
    expect(again.body.profile).toMatchObject({ id, status: 'applied', reviewNote: null })
  })

  it('only super admins change commission or roles', async () => {
    expect(
      (
        await t.api('PATCH', `/api/support/profiles/${profileId}/commission`, {
          token: agent,
          body: { commissionBps: 1800 },
        })
      ).status,
    ).toBe(403)
    const ok = await t.api('PATCH', `/api/support/profiles/${profileId}/commission`, {
      token: admin,
      body: { commissionBps: 1800 },
    })
    expect(ok.status).toBe(200)
    expect(ok.body.profile.commissionBps).toBe(1800)
    expect(
      (
        await t.api('PATCH', `/api/support/profiles/${profileId}/commission`, {
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
    // the person lists their profiles; the profile page has the teaching detail
    const person = await t.api('GET', `/api/support/people/${applicantId}`, { token: agent })
    expect(person.body.person.profiles).toEqual([
      expect.objectContaining({ id: profileId, status: 'approved', role: 'owner' }),
    ])
    expect(person.body.person.stats).toEqual({ enrollments: 0 })
    const detail = await t.api('GET', `/api/support/profiles/${profileId}`, { token: agent })
    expect(detail.status).toBe(200)
    expect(detail.body.profile).toMatchObject({
      id: profileId,
      commissionBps: 1800,
      owner: { id: applicantId, email: 'applicant@example.com' },
    })
    expect(detail.body.payoutAccounts).toHaveLength(1)
    expect(detail.body.payoutAccounts[0]).toMatchObject({ status: 'active', chargesEnabled: true })
    expect(detail.body.courses).toEqual([])
    expect(detail.body.earnings).toMatchObject({ paymentCount: 0, netCents: 0 })
    const commissionAudit = await t.db.query.auditLog.findMany({ where: { profileId } })
    expect(commissionAudit.map((a) => a.action)).toContain('profile.commission')
  })
})
