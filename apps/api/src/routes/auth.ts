import { magicLinkRequestSchema, verifyRequestSchema } from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { AuthService } from '../services/auth.service'

export const authRoutes = (deps: Deps) => {
  const auth = new AuthService(deps)
  return new Hono<AppEnv>()
    .post(
      '/magic-link',
      rateLimit({ name: 'magic-link', limit: 30, windowMs: 15 * 60_000 }),
      validate('json', magicLinkRequestSchema),
      async (c) => {
        const result = await auth.requestMagicLink(c.req.valid('json'))
        return c.json(result, 200)
      },
    )
    .post(
      '/verify',
      rateLimit({ name: 'verify', limit: 60, windowMs: 15 * 60_000 }),
      validate('json', verifyRequestSchema),
      async (c) => {
        const result = await auth.verify(c.req.valid('json'), c.req.header('user-agent'))
        return c.json(result, 200)
      },
    )
    .post('/sign-out', requireUser(), async (c) => {
      await auth.signOut(ensureUser(c.get('user')).sessionId)
      return c.json({ ok: true }, 200)
    })
    .get('/me', requireUser(), (c) => {
      const { sessionId: _sessionId, ...user } = ensureUser(c.get('user'))
      return c.json({ user }, 200)
    })
}
