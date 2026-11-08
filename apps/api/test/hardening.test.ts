import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

let t: TestApp
beforeAll(async () => {
  t = await createTestApp()
})
afterAll(async () => {
  await t.close()
})

describe('hardening', () => {
  it('sets security headers on every response', async () => {
    const res = await t.app.request('/api/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  it('rate limits public certificate lookups per client address', async () => {
    const path = '/api/certificates/verify/0000000000000000NOPE'
    let last: Response | null = null
    for (let i = 0; i < 121; i++) last = await t.app.request(path)
    const limited = last as Response
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/)
    expect(((await limited.json()) as { error: { code: string } }).error.code).toBe('rate_limited')
    // another client is unaffected
    const other = await t.app.request(path, { headers: { 'x-forwarded-for': '203.0.113.9' } })
    expect(other.status).toBe(200)
  })

  it('rate limits sign-in code attempts per client before the per-email lockout matters', async () => {
    await t.api('POST', '/api/auth/magic-link', {
      body: { email: 'bruteforce@example.com', audience: 'learner' },
    })
    let last = 0
    for (let i = 0; i < 61; i++) {
      last = (
        await t.api('POST', '/api/auth/verify', {
          body: { email: 'bruteforce@example.com', code: '000000' },
          headers: { 'x-forwarded-for': '198.51.100.7' },
        })
      ).status
    }
    expect(last).toBe(429)
  })
})
