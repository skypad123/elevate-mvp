import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * A class signs in on one venue network, so many learners share one network address
 * (docs/designs/scheduled-classes-selling.md, P.4). The per-address limit must let a class through;
 * the per-email limit in `AuthService` is covered by `auth.test.ts`.
 */
let t: TestApp
beforeAll(async () => {
  t = await createTestApp()
})
afterAll(async () => {
  await t.close()
})

describe('the sign-in limit per network address', () => {
  it('lets 40 learners on one network address ask for a sign-in link', async () => {
    const statuses: number[] = []
    for (let i = 1; i <= 40; i++) {
      const res = await t.api('POST', '/api/auth/magic-link', {
        body: { email: `venue-learner-${i}@example.com`, audience: 'learner' },
        headers: { 'x-forwarded-for': '203.0.113.7' },
      })
      statuses.push(res.status)
    }
    expect(statuses.every((status) => status === 200)).toBe(true)
  })
})
