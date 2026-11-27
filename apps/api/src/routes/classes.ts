import { checkInSchema, disputeSchema } from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireUser, uuidParam } from '../middleware/auth'
import { requireClasses } from '../middleware/classes-enabled'
import { rateLimit } from '../middleware/rate-limit'
import { AttendanceService } from '../services/attendance.service'
import { SeatsService } from '../services/seats.service'

/**
 * A learner's classes and check-in (docs/designs/scheduled-classes-attendance.md), mounted at
 * `/me/classes`. Class data lives on these routes only, so the existing learner routes, and the
 * app versions that use them, are unaffected.
 *
 * With the `CLASSES` setting off, the list answers an empty list and the other routes 404.
 */
export const classRoutes = (deps: Deps) => {
  const attendance = new AttendanceService(deps)
  const seats = new SeatsService(deps)
  const enabled = requireClasses(deps)
  const blockId = uuidParam('blockId', 'Class')
  const eventId = uuidParam('eventId', 'Mark')
  const enrollmentId = uuidParam('enrollmentId', 'Class')
  // Wrong codes are already counted and locked out per block; this keeps hammering off the API.
  const checkInLimit = rateLimit({ name: 'check-in', limit: 20, windowMs: 60_000 })

  return (
    new Hono<AppEnv>()
      .get('/', requireUser(), async (c) => {
        if (!deps.env.CLASSES) return c.json({ items: [] }, 200)
        const items = await attendance.listForLearner(ensureUser(c.get('user')))
        return c.json({ items }, 200)
      })
      .get('/blocks/:blockId', requireUser(), enabled, blockId, async (c) => {
        const context = await attendance.checkInContext(
          ensureUser(c.get('user')),
          c.req.param('blockId'),
        )
        return c.json({ context }, 200)
      })
      .post(
        '/blocks/:blockId/check-in',
        requireUser(),
        enabled,
        checkInLimit,
        blockId,
        validate('json', checkInSchema),
        async (c) => {
          const result = await attendance.checkIn(
            ensureUser(c.get('user')),
            c.req.param('blockId'),
            c.req.valid('json'),
            c.get('requestId'),
          )
          return c.json({ result }, 200)
        },
      )
      .post(
        '/attendance/:eventId/dispute',
        requireUser(),
        enabled,
        eventId,
        validate('json', disputeSchema),
        async (c) => {
          const updated = await attendance.dispute(
            ensureUser(c.get('user')),
            c.req.param('eventId'),
            c.req.valid('json'),
            c.get('requestId'),
          )
          return c.json({ class: updated }, 200)
        },
      )
      // Withdrawing a seat (docs/designs/scheduled-classes-selling.md, "Withdraw"). It writes the
      // refund row and frees the seat; the release job sends the refund.
      .post('/:enrollmentId/withdraw', requireUser(), enabled, enrollmentId, async (c) => {
        const updated = await seats.withdraw(ensureUser(c.get('user')), c.req.param('enrollmentId'))
        return c.json({ class: updated }, 200)
      })
  )
}
