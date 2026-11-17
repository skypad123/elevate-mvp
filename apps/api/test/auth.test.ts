import { ANALYTICS_EVENTS } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
beforeAll(async () => {
  t = await createTestApp()
})
afterAll(async () => {
  await t.close()
})

describe('magic link auth', () => {
  it('emails a link and a 6-digit code, then signs in by token', async () => {
    const r = await t.api('POST', '/api/auth/magic-link', {
      body: { email: 'Ada@Example.com', audience: 'learner' },
    })
    expect(r.status).toBe(200)
    const mail = t.mailer.last()
    expect(mail?.to).toBe('ada@example.com')
    expect(mail?.subject).toContain('Elevate')
    const token = new URL(mail?.text.match(/https?:\/\/\S+/)?.[0] ?? '').searchParams.get('token')
    expect(token).toBeTruthy()
    expect(mail?.text).toMatch(/\b\d{6}\b/)

    const v = await t.api('POST', '/api/auth/verify', { body: { token } })
    expect(v.status).toBe(200)
    expect(v.body.user.email).toBe('ada@example.com')
    expect(v.body.user.roles).toEqual([])
    expect(v.body.token).toMatch(/^[A-Za-z0-9_-]{40,}$/)

    const me = await t.api('GET', '/api/auth/me', { token: v.body.token })
    expect(me.status).toBe(200)
    expect(me.body.user.id).toBe(v.body.user.id)

    // single use
    const again = await t.api('POST', '/api/auth/verify', { body: { token } })
    expect(again.status).toBe(400)
    expect(again.body.error.code).toBe('link_invalid')
  })

  it('signs in by code, rejects wrong codes, and locks after five attempts', async () => {
    const email = 'bob@example.com'
    const r = await t.api('POST', '/api/auth/magic-link', { body: { email, audience: 'learner' } })
    const code: string = r.body.dev.code
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 4; i++) {
      const bad = await t.api('POST', '/api/auth/verify', { body: { email, code: wrong } })
      expect(bad.status).toBe(400)
      expect(bad.body.error.code).toBe('code_invalid')
    }
    const fifth = await t.api('POST', '/api/auth/verify', { body: { email, code: wrong } })
    expect(fifth.status).toBe(400)
    const locked = await t.api('POST', '/api/auth/verify', { body: { email, code } })
    expect(locked.status).toBe(400)
    expect(['link_invalid', 'code_locked']).toContain(locked.body.error.code)

    const fresh = await t.signIn(email)
    expect(fresh.status).toBe(200)
    expect(fresh.token).toBeTruthy()
  })

  it('rejects expired links', async () => {
    const email = 'late@example.com'
    const r = await t.api('POST', '/api/auth/magic-link', { body: { email, audience: 'learner' } })
    t.advanceClock(16 * 60 * 1000)
    const v = await t.api('POST', '/api/auth/verify', { body: { email, code: r.body.dev.code } })
    expect(v.status).toBe(400)
    expect(v.body.error.code).toBe('link_expired')
  })

  it('rate limits link requests per email', async () => {
    const email = 'spam@example.com'
    for (let i = 0; i < 5; i++) {
      expect(
        (await t.api('POST', '/api/auth/magic-link', { body: { email, audience: 'learner' } }))
          .status,
      ).toBe(200)
    }
    const sixth = await t.api('POST', '/api/auth/magic-link', {
      body: { email, audience: 'learner' },
    })
    expect(sixth.status).toBe(429)
  })

  it('only staff can sign in to the support portal', async () => {
    const denied = await t.signIn('nobody@example.com', 'support')
    expect(denied.status).toBe(403)
    await t.grantRole('agent@example.com', 'support_agent')
    const allowed = await t.signIn('agent@example.com', 'support')
    expect(allowed.status).toBe(200)
    expect(allowed.body.user.roles).toContain('support_agent')
  })

  it('treats a bad bearer token as an invalid session and sign-out revokes', async () => {
    const bad = await t.api('GET', '/api/auth/me', { token: 'not-a-real-token' })
    expect(bad.status).toBe(401)
    expect(bad.body.error.code).toBe('invalid_session')

    const { token } = await t.signIn('carol@example.com')
    expect((await t.api('POST', '/api/auth/sign-out', { token })).status).toBe(200)
    expect((await t.api('GET', '/api/auth/me', { token })).status).toBe(401)
  })

  it('updates profile name', async () => {
    const { token } = await t.signIn('dora@example.com')
    const r = await t.api('PATCH', '/api/me', { token, body: { name: 'Dora Lim' } })
    expect(r.status).toBe(200)
    expect(r.body.user.name).toBe('Dora Lim')
    const invalid = await t.api('PATCH', '/api/me', { token, body: { name: '' } })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('validation')
  })
})

describe('sign-in with a stale session token', () => {
  // The portals keep their session token in localStorage and send it on every request, the two
  // that sign a user in included. A session the API no longer accepts must not stop them.
  async function revokedToken(email: string): Promise<string> {
    const { token } = await t.signIn(email)
    if (!token) throw new Error(`could not sign in ${email}`)
    expect((await t.api('POST', '/api/auth/sign-out', { token })).status).toBe(200)
    return token
  }

  it('signs in by code although the request carries an unknown token', async () => {
    const email = 'stale-code@example.com'
    const r = await t.api('POST', '/api/auth/magic-link', { body: { email, audience: 'learner' } })
    const v = await t.api('POST', '/api/auth/verify', {
      token: 'not-a-real-token',
      body: { email, code: r.body.dev.code },
    })
    expect(v.status).toBe(200)
    expect(v.body.user.email).toBe(email)
    expect((await t.api('GET', '/api/auth/me', { token: v.body.token })).status).toBe(200)
  })

  it('signs in by link although the request carries a revoked session', async () => {
    const email = 'stale-link@example.com'
    const stale = await revokedToken(email)
    const r = await t.api('POST', '/api/auth/magic-link', { body: { email, audience: 'learner' } })
    const token = new URL(r.body.dev.link).searchParams.get('token')
    const v = await t.api('POST', '/api/auth/verify', { token: stale, body: { token } })
    expect(v.status).toBe(200)
    expect(v.body.user.email).toBe(email)
    expect(v.body.token).not.toBe(stale)
    expect((await t.api('GET', '/api/auth/me', { token: v.body.token })).status).toBe(200)
  })

  it('accepts a magic-link request that carries a stale token', async () => {
    const email = 'stale-request@example.com'
    const stale = await revokedToken(email)
    const r = await t.api('POST', '/api/auth/magic-link', {
      token: stale,
      body: { email, audience: 'learner' },
    })
    expect(r.status).toBe(200)
    expect(t.mailer.last()?.to).toBe(email)
  })

  it('still answers 401 invalid_session for a stale token on any other route', async () => {
    const stale = await revokedToken('stale-other@example.com')
    const routes: [method: string, path: string][] = [
      ['GET', '/api/auth/me'],
      ['POST', '/api/auth/sign-out'],
      ['GET', '/api/me'],
      ['GET', '/api/health'],
      // the exemption is for POST magic-link and POST verify, not other methods on those paths
      ['GET', '/api/auth/magic-link'],
      ['GET', '/api/auth/verify'],
    ]
    for (const [method, path] of routes) {
      const r = await t.api(method, path, { token: stale })
      expect(r.status, `${method} ${path}`).toBe(401)
      expect(r.body.error.code, `${method} ${path}`).toBe('invalid_session')
    }
  })

  it('still signs in when the request carries a valid token', async () => {
    const email = 'valid-token@example.com'
    const { token } = await t.signIn(email)
    const r = await t.api('POST', '/api/auth/magic-link', {
      token,
      body: { email, audience: 'learner' },
    })
    expect(r.status).toBe(200)
    const v = await t.api('POST', '/api/auth/verify', {
      token,
      body: { email, code: r.body.dev.code },
    })
    expect(v.status).toBe(200)
    expect(v.body.user.email).toBe(email)
    expect(v.body.token).not.toBe(token)
  })
})

describe('the account language', () => {
  // Its own app, so these sign-ins do not count against the file's magic-link rate limit.
  let a: TestApp
  beforeAll(async () => {
    a = await createTestApp()
  })
  afterAll(async () => {
    await a.close()
  })

  async function accountLocale(email: string) {
    const user = await a.db.query.users.findFirst({
      where: { email },
      columns: { locale: true, localeChosen: true },
    })
    return user
  }

  async function setAccountLocale(email: string, locale: 'en' | 'zh', localeChosen: boolean) {
    const user = await a.ensureUser(email)
    await a.db.update(s.users).set({ locale, localeChosen }).where(eq(s.users.id, user.id))
    return user
  }

  it('lets a chosen language at verify overwrite the account', async () => {
    const email = 'chosen-zh@example.com'
    await setAccountLocale(email, 'en', true)
    const r = await a.signIn(email, 'learner', { locale: 'zh', localeChosen: true })
    expect(r.status).toBe(200)
    expect(await accountLocale(email)).toEqual({ locale: 'zh', localeChosen: true })
    expect(r.body.user).toMatchObject({ locale: 'zh', localeChosen: true })
  })

  it('does not let a guessed language replace a chosen one', async () => {
    const email = 'keeps-zh@example.com'
    await setAccountLocale(email, 'zh', true)
    const r = await a.signIn(email, 'learner', { locale: 'en', localeChosen: false })
    expect(r.status).toBe(200)
    expect(await accountLocale(email)).toEqual({ locale: 'zh', localeChosen: true })
    expect(r.body.user).toMatchObject({ locale: 'zh', localeChosen: true })
  })

  it('lets a guessed language replace a guessed one', async () => {
    const email = 'guessed-twice@example.com'
    await setAccountLocale(email, 'zh', false)
    await a.signIn(email, 'learner', { locale: 'en' })
    expect(await accountLocale(email)).toEqual({ locale: 'en', localeChosen: false })
  })

  it('fills an empty account with a guessed language', async () => {
    const email = 'new-guess@example.com'
    const r = await a.signIn(email, 'learner', { locale: 'zh' })
    expect(await accountLocale(email)).toEqual({ locale: 'zh', localeChosen: false })
    expect(r.body.user).toMatchObject({ locale: 'zh', localeChosen: false })
  })

  it('leaves the account alone when verify sends no language', async () => {
    const chosen = 'no-locale-chosen@example.com'
    await setAccountLocale(chosen, 'zh', true)
    await a.signIn(chosen)
    expect(await accountLocale(chosen)).toEqual({ locale: 'zh', localeChosen: true })

    const empty = 'no-locale-empty@example.com'
    const r = await a.signIn(empty)
    expect(await accountLocale(empty)).toEqual({ locale: null, localeChosen: false })
    expect(r.body.user).toMatchObject({ locale: null, localeChosen: false })
    const me = await a.api('GET', '/api/auth/me', { token: r.token })
    expect(me.body.user).toMatchObject({ locale: null, localeChosen: false })
  })

  it("adds the request's language to the emailed link, and nothing when none was sent", async () => {
    await a.api('POST', '/api/auth/magic-link', {
      body: { email: 'link-zh@example.com', audience: 'learner', locale: 'zh' },
    })
    const zhLink = new URL(a.mailer.last()?.text.match(/https?:\/\/\S+/)?.[0] ?? '')
    expect(zhLink.searchParams.get('lang')).toBe('zh')
    expect(zhLink.searchParams.get('token')).toBeTruthy()

    await a.api('POST', '/api/auth/magic-link', {
      body: { email: 'link-teach@example.com', audience: 'teach' },
    })
    const teachLink = new URL(a.mailer.last()?.text.match(/https?:\/\/\S+/)?.[0] ?? '')
    expect(teachLink.origin).toBe('http://teach.test')
    expect(teachLink.searchParams.has('lang')).toBe(false)
  })

  it('records a sign_in event with the language, and none for a refused Support sign-in', async () => {
    const email = 'event-zh@example.com'
    const r = await a.signIn(email, 'learner', { locale: 'zh', localeChosen: true })
    const userId = r.body.user.id as string
    const events = await a.db.query.analyticsEvents.findMany({
      where: { name: ANALYTICS_EVENTS.signIn, userId },
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.properties).toEqual({ audience: 'learner', locale: 'zh' })

    const plain = await a.signIn('event-none@example.com')
    const plainEvents = await a.db.query.analyticsEvents.findMany({
      where: { name: ANALYTICS_EVENTS.signIn, userId: plain.body.user.id as string },
    })
    expect(plainEvents[0]?.properties).toEqual({ audience: 'learner', locale: null })

    const refusedEmail = 'event-refused@example.com'
    const refused = await a.signIn(refusedEmail, 'support', { locale: 'en' })
    expect(refused.status).toBe(403)
    const refusedUser = await a.db.query.users.findFirst({ where: { email: refusedEmail } })
    expect(refusedUser).toBeTruthy()
    expect(
      await a.db.query.analyticsEvents.findMany({
        where: { name: ANALYTICS_EVENTS.signIn, userId: refusedUser?.id as string },
      }),
    ).toHaveLength(0)
  })

  it('stores the language PATCH /me sends', async () => {
    const email = 'patch-locale@example.com'
    const { token } = await a.signIn(email)
    const chosen = await a.api('PATCH', '/api/me', {
      token,
      body: { locale: 'zh', localeChosen: true },
    })
    expect(chosen.status).toBe(200)
    expect(chosen.body.user).toMatchObject({ locale: 'zh', localeChosen: true })
    expect(await accountLocale(email)).toEqual({ locale: 'zh', localeChosen: true })

    const followDevice = await a.api('PATCH', '/api/me', { token, body: { localeChosen: false } })
    expect(followDevice.status).toBe(200)
    expect(followDevice.body.user).toMatchObject({ locale: 'zh', localeChosen: false })
    expect(await accountLocale(email)).toEqual({ locale: 'zh', localeChosen: false })

    for (const body of [{ locale: 'fr' }, { localeChosen: 'yes' }]) {
      const invalid = await a.api('PATCH', '/api/me', { token, body })
      expect(invalid.status, JSON.stringify(body)).toBe(400)
      expect(invalid.body.error.code).toBe('validation')
    }
    expect(await accountLocale(email)).toEqual({ locale: 'zh', localeChosen: false })
  })
})
