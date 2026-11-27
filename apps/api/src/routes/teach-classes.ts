import {
  acceptClassSalesSchema,
  type Capability,
  cancelClassSchema,
  createClassSchema,
  disputeDecisionSchema,
  manualMarkSchema,
  moveSeatSchema,
  overturnSchema,
  seatRefundRequestSchema,
  setInstructorSchema,
  setVenueLocationSchema,
  updateClassSchema,
} from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import {
  type AppEnv,
  ensureActor,
  requireProfile,
  requireRecentSignIn,
  uuidParam,
} from '../middleware/auth'
import { requireClasses } from '../middleware/classes-enabled'
import { AttendanceService } from '../services/attendance.service'
import { ClassSalesService } from '../services/class-sales.service'
import { ClassesService } from '../services/classes.service'
import { SeatsService } from '../services/seats.service'

/**
 * Scheduled classes in Elevate Teach (docs/designs/scheduled-classes-attendance.md), mounted at
 * `/teach` beside `teach.ts`. Every route is under `/profiles/:profileId` and names its
 * capability; all of them answer 404 while the `CLASSES` setting is off.
 *
 * The capability is not the whole rule. A writer reaches only the classes they instruct (any
 * other is not found), and the code, venue-location, overturn and manual-mark routes also need
 * the actor to be the class's assigned instructor (else 403). The roster asks only `class.read`
 * here; `AttendanceService` then lets in anyone with `attendance.read` and the instructor.
 *
 * Opting in to class sales and leaving them (docs/designs/scheduled-classes-selling.md, "Opting
 * in") change the profile's Stripe account, so they need `stripe.links`, which only the owner
 * holds, and a recent sign-in, as the Stripe link routes do.
 *
 * Seats show money, so they need `earnings.read`. Cancelling a class and a discretionary refund
 * send money out and cannot be undone, so they also ask for a recent sign-in. None of these
 * routes calls Stripe: they write refund rows, which the release job sends.
 */
export const teachClassRoutes = (deps: Deps) => {
  const classes = new ClassesService(deps)
  const attendance = new AttendanceService(deps)
  const classSales = new ClassSalesService(deps)
  const seats = new SeatsService(deps)
  const enabled = requireClasses(deps)
  const recentSignIn = requireRecentSignIn(deps)
  const on = (capability: Capability) => requireProfile(deps, capability)
  const classId = uuidParam('id', 'Class')
  const blockId = uuidParam('blockId', 'Block')
  const enrollmentId = uuidParam('enrollmentId', 'Learner')
  const eventId = uuidParam('eventId', 'Dispute')
  const base = '/profiles/:profileId/classes'

  const sales = '/profiles/:profileId/class-sales'

  return new Hono<AppEnv>()
    .get(sales, enabled, on('profile.read'), async (c) => {
      const status = await classSales.status(ensureActor(c.get('actor')).profileId)
      return c.json({ classSales: status }, 200)
    })
    .post(
      `${sales}/accept`,
      enabled,
      on('stripe.links'),
      recentSignIn,
      validate('json', acceptClassSalesSchema),
      async (c) => {
        const status = await classSales.accept(ensureActor(c.get('actor')), c.req.valid('json'))
        return c.json({ classSales: status }, 200)
      },
    )
    .post(`${sales}/leave`, enabled, on('stripe.links'), recentSignIn, async (c) => {
      const status = await classSales.leave(ensureActor(c.get('actor')))
      return c.json({ classSales: status }, 200)
    })
    .get(base, enabled, on('class.read'), async (c) => {
      const items = await classes.list(ensureActor(c.get('actor')))
      return c.json({ items }, 200)
    })
    .post(base, enabled, on('class.manage'), validate('json', createClassSchema), async (c) => {
      const created = await classes.create(ensureActor(c.get('actor')), c.req.valid('json'))
      return c.json({ class: created }, 200)
    })
    .get(`${base}/:id`, enabled, on('class.read'), classId, async (c) => {
      const detail = await classes.get(ensureActor(c.get('actor')), c.req.param('id'))
      return c.json({ class: detail }, 200)
    })
    .patch(
      `${base}/:id`,
      enabled,
      on('class.manage'),
      classId,
      validate('json', updateClassSchema),
      async (c) => {
        const updated = await classes.update(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.valid('json'),
        )
        return c.json({ class: updated }, 200)
      },
    )
    .post(`${base}/:id/publish`, enabled, on('class.manage'), classId, async (c) => {
      const published = await classes.publish(ensureActor(c.get('actor')), c.req.param('id'))
      return c.json({ class: published }, 200)
    })
    .put(
      `${base}/:id/instructor`,
      enabled,
      on('class.manage'),
      classId,
      validate('json', setInstructorSchema),
      async (c) => {
        const updated = await classes.setInstructor(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.valid('json').userId,
        )
        return c.json({ class: updated }, 200)
      },
    )
    .get(
      `${base}/:id/blocks/:blockId/roster`,
      enabled,
      on('class.read'),
      classId,
      blockId,
      async (c) => {
        const roster = await attendance.roster(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.param('blockId'),
        )
        return c.json({ roster }, 200)
      },
    )
    .get(
      `${base}/:id/blocks/:blockId/code`,
      enabled,
      on('attendance.take'),
      classId,
      blockId,
      async (c) => {
        const code = await attendance.codes(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.param('blockId'),
        )
        return c.json({ code }, 200)
      },
    )
    .put(
      `${base}/:id/venue-location`,
      enabled,
      on('attendance.take'),
      classId,
      validate('json', setVenueLocationSchema),
      async (c) => {
        const updated = await classes.setVenueLocation(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.valid('json'),
        )
        return c.json({ class: updated }, 200)
      },
    )
    .post(
      `${base}/:id/blocks/:blockId/learners/:enrollmentId/overturn`,
      enabled,
      on('attendance.take'),
      classId,
      blockId,
      enrollmentId,
      validate('json', overturnSchema),
      async (c) => {
        const roster = await attendance.overturn(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.param('blockId'),
          c.req.param('enrollmentId'),
          c.req.valid('json'),
          c.get('requestId'),
        )
        return c.json({ roster }, 200)
      },
    )
    .post(
      `${base}/:id/blocks/:blockId/learners/:enrollmentId/manual-mark`,
      enabled,
      on('attendance.take'),
      classId,
      blockId,
      enrollmentId,
      validate('json', manualMarkSchema),
      async (c) => {
        const roster = await attendance.manualMark(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.param('blockId'),
          c.req.param('enrollmentId'),
          c.req.valid('json'),
          c.get('requestId'),
        )
        return c.json({ roster }, 200)
      },
    )
    .get(`${base}/:id/disputes`, enabled, on('attendance.review'), classId, async (c) => {
      const items = await attendance.disputes(ensureActor(c.get('actor')), c.req.param('id'))
      return c.json({ items }, 200)
    })
    .post(
      `${base}/:id/disputes/:eventId/decision`,
      enabled,
      on('attendance.review'),
      classId,
      eventId,
      validate('json', disputeDecisionSchema),
      async (c) => {
        const dispute = await attendance.decideDispute(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.param('eventId'),
          c.req.valid('json'),
          c.get('requestId'),
        )
        return c.json({ dispute }, 200)
      },
    )
    .get(`${base}/:id/seats`, enabled, on('earnings.read'), classId, async (c) => {
      const items = await seats.list(ensureActor(c.get('actor')), c.req.param('id'))
      return c.json({ items }, 200)
    })
    .get(
      `${base}/:id/learners/:enrollmentId/move-targets`,
      enabled,
      on('class.manage'),
      classId,
      enrollmentId,
      async (c) => {
        const items = await seats.moveTargets(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.param('enrollmentId'),
        )
        return c.json({ items }, 200)
      },
    )
    .post(
      `${base}/:id/learners/:enrollmentId/move`,
      enabled,
      on('class.manage'),
      classId,
      enrollmentId,
      validate('json', moveSeatSchema),
      async (c) => {
        const seat = await seats.move(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.param('enrollmentId'),
          c.req.valid('json'),
        )
        return c.json({ seat }, 200)
      },
    )
    .post(
      `${base}/:id/learners/:enrollmentId/refund`,
      enabled,
      on('class.refund'),
      recentSignIn,
      classId,
      enrollmentId,
      validate('json', seatRefundRequestSchema),
      async (c) => {
        const seat = await seats.refund(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.param('enrollmentId'),
          c.req.valid('json'),
        )
        return c.json({ seat }, 200)
      },
    )
    .post(
      `${base}/:id/cancel`,
      enabled,
      on('class.manage'),
      recentSignIn,
      classId,
      validate('json', cancelClassSchema),
      async (c) => {
        const cancelled = await seats.cancelClass(
          ensureActor(c.get('actor')),
          c.req.param('id'),
          c.req.valid('json'),
        )
        return c.json({ class: cancelled }, 200)
      },
    )
    .delete(`${base}/:id`, enabled, on('class.manage'), classId, async (c) => {
      await classes.remove(ensureActor(c.get('actor')), c.req.param('id'))
      return c.json({ ok: true }, 200)
    })
}
