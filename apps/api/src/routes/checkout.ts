import { checkoutRequestSchema, quoteRequestSchema } from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { PaymentsService } from '../services/payments.service'

export const checkoutRoutes = (deps: Deps) => {
  const payments = new PaymentsService(deps)
  return new Hono<AppEnv>()
    .post(
      '/quote',
      requireUser(),
      rateLimit({ name: 'quote', limit: 60, windowMs: 60_000 }),
      validate('json', quoteRequestSchema),
      async (c) => {
        const { courseId, promoCode } = c.req.valid('json')
        return c.json(await payments.quoteFor(courseId, promoCode), 200)
      },
    )
    .post('/courses/:id', requireUser(), validate('json', checkoutRequestSchema), async (c) => {
      const result = await payments.startCheckout(
        ensureUser(c.get('user')),
        c.req.param('id'),
        c.req.valid('json').promoCode,
      )
      return c.json(result, 200)
    })
    .get('/sessions/:id/sync', requireUser(), async (c) => {
      const result = await payments.syncSession(ensureUser(c.get('user')), c.req.param('id'))
      return c.json(result, 200)
    })
}
