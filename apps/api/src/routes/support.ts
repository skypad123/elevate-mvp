import {
  commissionSchema,
  grantRoleSchema,
  peopleQuerySchema,
  rejectSchema,
  reviewNoteSchema,
} from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireRole } from '../middleware/auth'
import { PeopleService } from '../services/people.service'
import { TeachersService } from '../services/teachers.service'

export const supportRoutes = (deps: Deps) => {
  const people = new PeopleService(deps)
  const teachers = new TeachersService(deps)
  return new Hono<AppEnv>()
    .use('*', requireRole('support_agent'))
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
}
