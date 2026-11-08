import {
  commissionSchema,
  grantRoleSchema,
  peopleQuerySchema,
  refundSchema,
  rejectSchema,
  reviewNoteSchema,
  transactionsQuerySchema,
} from '@elevate/core'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireRole } from '../middleware/auth'
import { PeopleService } from '../services/people.service'
import { ReviewService } from '../services/review.service'
import { TeachersService } from '../services/teachers.service'
import { TransactionsService } from '../services/transactions.service'

const courseListQuerySchema = z.object({
  status: z.enum(['draft', 'pending_review', 'live', 'rejected']).optional(),
})
const auditQuerySchema = z.object({ cursor: z.string().optional() })

export const supportRoutes = (deps: Deps) => {
  const people = new PeopleService(deps)
  const teachers = new TeachersService(deps)
  const review = new ReviewService(deps)
  const transactions = new TransactionsService(deps)
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
      // ── teacher applications ──
      .post('/teachers/:id/approve', validate('json', reviewNoteSchema), async (c) => {
        const profile = await teachers.approve(
          ensureUser(c.get('user')),
          c.req.param('id'),
          c.req.valid('json').note,
        )
        return c.json({ profile }, 200)
      })
      .post('/teachers/:id/reject', validate('json', rejectSchema), async (c) => {
        const profile = await teachers.reject(
          ensureUser(c.get('user')),
          c.req.param('id'),
          c.req.valid('json').reason,
        )
        return c.json({ profile }, 200)
      })
      .patch(
        '/teachers/:id/commission',
        requireRole('super_admin'),
        validate('json', commissionSchema),
        async (c) => {
          const profile = await teachers.setCommission(
            ensureUser(c.get('user')),
            c.req.param('id'),
            c.req.valid('json').commissionBps,
          )
          return c.json({ profile }, 200)
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
  )
}
