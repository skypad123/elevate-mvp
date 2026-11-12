import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * Stripe links need a recent sign-in: the session must be less than 24 hours old. A session is
 * created only at sign-in, and renewing it does not move its start, so `sessions.created_at` is
 * the sign-in time.
 */
let t: TestApp
let profileId: string

const HOUR = 60 * 60 * 1000
const teach = (path: string) => `/api/teach/profiles/${profileId}${path}`

beforeAll(async () => {
  t = await createTestApp()
  profileId = (await t.createProfile('owner@example.com', { payable: true })).profile.id
})
afterAll(async () => {
  await t.close()
})

describe('recent sign-in for Stripe links', () => {
  it('returns the links to a session that just signed in', async () => {
    const token = (await t.signIn('owner@example.com', 'teach')).token as string
    const onboarding = await t.api('POST', teach('/stripe/onboarding-link'), { token })
    expect(onboarding.status).toBe(200)
    expect(onboarding.body.url).toContain('fake-stripe')
    const dashboard = await t.api('POST', teach('/stripe/login-link'), { token })
    expect(dashboard.status).toBe(200)
  })

  it('still returns them 23 hours after sign-in', async () => {
    const token = (await t.signIn('owner@example.com', 'teach')).token as string
    t.advanceClock(23 * HOUR)
    expect((await t.api('POST', teach('/stripe/login-link'), { token })).status).toBe(200)
  })

  it('asks a session older than 24 hours to sign in again, for both links', async () => {
    const token = (await t.signIn('owner@example.com', 'teach')).token as string
    t.advanceClock(25 * HOUR)
    for (const path of ['/stripe/onboarding-link', '/stripe/login-link']) {
      const res = await t.api('POST', teach(path), { token })
      expect(res.status, path).toBe(401)
      expect(res.body.error.code, path).toBe('reauth_required')
    }
    // the session itself is still good for everything else
    expect((await t.api('GET', teach('/profile'), { token })).status).toBe(200)
    expect((await t.api('GET', teach('/stripe/status'), { token })).status).toBe(200)
    // signing in again is what it takes
    const fresh = (await t.signIn('owner@example.com', 'teach')).token as string
    expect((await t.api('POST', teach('/stripe/login-link'), { token: fresh })).status).toBe(200)
  })

  it('keeps the original sign-in time when a session is renewed', async () => {
    const user = await t.ensureUser('owner@example.com')
    const sessionIds = async () =>
      (await t.db.query.sessions.findMany({ where: { userId: user.id } })).map((row) => row.id)
    const before = await sessionIds()
    const token = (await t.signIn('owner@example.com', 'teach')).token as string
    // the one session this sign-in created
    const [id] = (await sessionIds()).filter((sessionId) => !before.includes(sessionId))
    const session = () => t.db.query.sessions.findFirst({ where: { id: id as string } })
    const signedInAt = (await session())?.createdAt.getTime()

    // Using the session an hour and more later renews it: last seen and expiry move forward.
    t.advanceClock(20 * HOUR)
    expect((await t.api('GET', teach('/profile'), { token })).status).toBe(200)
    const renewed = await session()
    expect(renewed?.createdAt.getTime()).toBe(signedInAt)
    expect(renewed?.lastSeenAt.getTime()).toBe((signedInAt as number) + 20 * HOUR)
    expect(renewed?.expiresAt.getTime()).toBeGreaterThan((signedInAt as number) + 30 * 24 * HOUR)

    // A renewal is not a sign-in: five hours on, the session is 25 hours old and is asked again.
    t.advanceClock(5 * HOUR)
    const res = await t.api('POST', teach('/stripe/login-link'), { token })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('reauth_required')
  })
})
