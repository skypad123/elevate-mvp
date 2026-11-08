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
