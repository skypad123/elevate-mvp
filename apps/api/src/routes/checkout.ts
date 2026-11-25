import {
  checkoutRequestSchema,
  classCheckoutRequestSchema,
  quoteRequestSchema,
} from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireUser, uuidParam } from '../middleware/auth'
import { requireClasses } from '../middleware/classes-enabled'
import { rateLimit } from '../middleware/rate-limit'
import { ClassCheckoutService } from '../services/class-checkout.service'
import { PaymentsService } from '../services/payments.service'

export const checkoutRoutes = (deps: Deps) => {
  const payments = new PaymentsService(deps)
  const classCheckout = new ClassCheckoutService(deps)
  const classId = uuidParam('classId', 'Class')
  return (
    new Hono<AppEnv>()
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
        const body = c.req.valid('json')
        const result = await payments.startCheckout(ensureUser(c.get('user')), c.req.param('id'), {
          promoCode: body.promoCode,
          locale: body.locale,
        })
        return c.json(result, 200)
      })
      // A seat in a class (docs/designs/scheduled-classes-selling.md, "Buying a seat"). Like every
      // class route, these answer 404 while `CLASSES` is off.
      .get('/classes/:classId', requireUser(), requireClasses(deps), classId, async (c) => {
        const promoCode = c.req.query('promoCode') || undefined
        const view = await classCheckout.view(c.req.param('classId'), promoCode)
        return c.json(view, 200)
      })
      .post(
        '/classes/:classId',
        requireUser(),
        requireClasses(deps),
        classId,
        validate('json', classCheckoutRequestSchema),
        async (c) => {
          const result = await classCheckout.start(
            ensureUser(c.get('user')),
            c.req.param('classId'),
            c.req.valid('json'),
          )
          return c.json(result, 200)
        },
      )
      .get('/sessions/:id/sync', requireUser(), async (c) => {
        const result = await payments.syncSession(ensureUser(c.get('user')), c.req.param('id'))
        return c.json(result, 200)
      })
  )
}
