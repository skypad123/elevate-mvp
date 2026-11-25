import {
  commissionSchema,
  eraseCoordinatesSchema,
  grantRoleSchema,
  nameCheckSchema,
  peopleQuerySchema,
  profilesQuerySchema,
  recoverOwnerSchema,
  refundSchema,
  rejectSchema,
  reviewNoteSchema,
  type SupportFeatures,
  supportClassSearchSchema,
  transactionsQuerySchema,
} from '@elevate/core'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireRole, uuidParam } from '../middleware/auth'
import { requireClasses } from '../middleware/classes-enabled'
import { AnalyticsService } from '../services/analytics.service'
import { AttendanceService } from '../services/attendance.service'
import { LegalEntitiesService } from '../services/legal-entities.service'
import { PeopleService } from '../services/people.service'
import { ProfilesService } from '../services/profiles.service'
import { RecoveryService } from '../services/recovery.service'
import { ReviewService } from '../services/review.service'
import { TransactionsService } from '../services/transactions.service'

const courseListQuerySchema = z.object({
  status: z.enum(['draft', 'pending_review', 'live', 'rejected']).optional(),
})
const auditQuerySchema = z.object({ cursor: z.string().optional() })

export const supportRoutes = (deps: Deps) => {
  const people = new PeopleService(deps)
  const profiles = new ProfilesService(deps)
  const entities = new LegalEntitiesService(deps)
  const recovery = new RecoveryService(deps)
  const profileId = uuidParam('id', 'Profile')
  const review = new ReviewService(deps)
  const transactions = new TransactionsService(deps)
  const analytics = new AnalyticsService(deps)
  const attendance = new AttendanceService(deps)
  const classesOn = requireClasses(deps)
  const classId = uuidParam('id', 'Class')
  const blockId = uuidParam('blockId', 'Block')
  const learnerId = uuidParam('userId', 'Learner')
  return (
    new Hono<AppEnv>()
      .use('*', requireRole('support_agent'))
      // ── people ──
      .get('/people', validate('query', peopleQuerySchema), async (c) => {
        const page = await people.list(c.req.valid('query'))
        return c.json(page, 200)
      })
      .get('/people/:id', async (c) => {
        const person = await people.detail(c.req.param('id'))
        return c.json({ person }, 200)
      })
      .post(
        '/people/:id/roles',
        requireRole('super_admin'),
        validate('json', grantRoleSchema),
        async (c) => {
          const { role, grant } = c.req.valid('json')
          const person = await people.setRole(
            ensureUser(c.get('user')),
            c.req.param('id'),
            role,
            grant,
          )
          return c.json({ person }, 200)
        },
      )
      // ── profiles: applications, review and commission ──
      .get('/profiles', validate('query', profilesQuerySchema), async (c) => {
        const page = await profiles.list(c.req.valid('query'))
        return c.json(page, 200)
      })
      .get('/profiles/:id', profileId, async (c) => {
        const detail = await profiles.detail(c.req.param('id'))
        return c.json(detail, 200)
      })
      .post('/profiles/:id/approve', profileId, validate('json', reviewNoteSchema), async (c) => {
        const profile = await profiles.approve(
          ensureUser(c.get('user')),
          c.req.param('id'),
          c.req.valid('json').note,
        )
        return c.json({ profile }, 200)
      })
      .post('/profiles/:id/reject', profileId, validate('json', rejectSchema), async (c) => {
        const profile = await profiles.reject(
          ensureUser(c.get('user')),
          c.req.param('id'),
          c.req.valid('json').reason,
        )
        return c.json({ profile }, 200)
      })
      .patch(
        '/profiles/:id/commission',
        requireRole('super_admin'),
        profileId,
        validate('json', commissionSchema),
        async (c) => {
          const profile = await profiles.setCommission(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json').commissionBps,
          )
          return c.json({ profile }, 200)
        },
      )
      // ── a company's payout account: Stripe's legal name against the company's ──
      // Any Support staff can run this check, like the review. It is audited under their name.
      .get('/profiles/:id/payout-account/name-check', profileId, async (c) => {
        const nameCheck = await entities.nameCheck(c.req.param('id'))
        return c.json({ nameCheck }, 200)
      })
      .post(
        '/profiles/:id/payout-account/name-check',
        profileId,
        validate('json', nameCheckSchema),
        async (c) => {
          const nameCheck = await entities.decideNameCheck(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json({ nameCheck }, 200)
        },
      )
      // ── owner recovery: the only way a profile's owner changes ──
      .post(
        '/profiles/:id/recover-owner',
        requireRole('super_admin'),
        profileId,
        validate('json', recoverOwnerSchema),
        async (c) => {
          await recovery.recoverOwner(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json'),
          )
          return c.json(await profiles.detail(c.req.param('id')), 200)
        },
      )
      // ── course review (approval is the only path to live) ──
      .get('/review-queue', async (c) => {
        const items = await review.queue()
        return c.json({ items }, 200)
      })
      .get('/courses', validate('query', courseListQuerySchema), async (c) => {
        const items = await review.all(c.req.valid('query').status)
        return c.json({ items }, 200)
      })
      .get('/courses/:id', async (c) => {
        const course = await review.view(c.req.param('id'))
        return c.json({ course }, 200)
      })
      .post('/courses/:id/approve', async (c) => {
        const course = await review.approve(ensureUser(c.get('user')), c.req.param('id'))
        return c.json({ course }, 200)
      })
      .post('/courses/:id/reject', validate('json', rejectSchema), async (c) => {
        const course = await review.reject(
          ensureUser(c.get('user')),
          c.req.param('id'),
          c.req.valid('json').reason,
        )
        return c.json({ course }, 200)
      })
      // ── transactions, payouts, audit ──
      .get('/transactions', validate('query', transactionsQuerySchema), async (c) =>
        c.json(await transactions.list(c.req.valid('query')), 200),
      )
      .get('/transactions/:id', async (c) =>
        c.json({ transaction: await transactions.detail(c.req.param('id')) }, 200),
      )
      .post(
        '/transactions/:id/refund',
        requireRole('super_admin'),
        validate('json', refundSchema),
        async (c) => {
          const transaction = await transactions.refund(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json').reason,
          )
          return c.json({ transaction }, 200)
        },
      )
      .get('/payouts', async (c) => c.json({ items: await transactions.payouts() }, 200))
      .get('/audit-log', validate('query', auditQuerySchema), async (c) =>
        c.json(await transactions.audit(c.req.valid('query').cursor), 200),
      )
      .get('/analytics', async (c) => c.json({ analytics: await analytics.summary() }, 200))
      // ── scheduled classes: read only; there is no write route ──
      // What the portal's navigation needs; answers whether or not classes are on.
      .get('/features', async (c) => {
        const features: SupportFeatures = { classes: deps.env.CLASSES }
        return c.json(features, 200)
      })
      .get('/classes', classesOn, validate('query', supportClassSearchSchema), async (c) => {
        const items = await attendance.supportSearch(c.req.valid('query'))
        return c.json({ items }, 200)
      })
      .get('/classes/:id', classesOn, classId, async (c) => {
        const detail = await attendance.supportClass(c.req.param('id'))
        return c.json({ class: detail }, 200)
      })
      .get('/classes/:id/blocks/:blockId', classesOn, classId, blockId, async (c) => {
        const block = await attendance.supportBlock(
          ensureUser(c.get('user')),
          c.req.param('id'),
          c.req.param('blockId'),
        )
        return c.json({ block }, 200)
      })
      // ── a learner's coordinates, erased on a privacy request ──
      // docs/runbooks/erase-coordinates.md. Not under `/classes`, which stays read only, and not
      // behind `CLASSES`, so a request can be met whether or not classes are on.
      .post(
        '/learners/:userId/erase-coordinates',
        requireRole('super_admin'),
        learnerId,
        validate('json', eraseCoordinatesSchema),
        async (c) => {
          const result = await attendance.eraseCoordinates(
            ensureUser(c.get('user')),
            c.req.param('userId'),
            c.req.valid('json'),
          )
          return c.json(result, 200)
        },
      )
  )
}
