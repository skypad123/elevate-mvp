import { teacherApplicationSchema, updateTeacherProfileSchema } from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireRole, requireUser } from '../middleware/auth'
import { ConnectService } from '../services/connect.service'
import { TeachersService } from '../services/teachers.service'

export const teachRoutes = (deps: Deps) => {
  const teachers = new TeachersService(deps)
  const connect = new ConnectService(deps)
  return new Hono<AppEnv>()
    .get('/profile', requireUser(), async (c) => {
      const profile = await teachers.getProfile(ensureUser(c.get('user')).id)
      return c.json({ profile }, 200)
    })
    .post('/apply', requireUser(), validate('json', teacherApplicationSchema), async (c) => {
      const profile = await teachers.apply(ensureUser(c.get('user')), c.req.valid('json'))
      return c.json({ profile }, 200)
    })
    .patch(
      '/profile',
      requireRole('teacher'),
      validate('json', updateTeacherProfileSchema),
      async (c) => {
        const profile = await teachers.updateProfile(ensureUser(c.get('user')), c.req.valid('json'))
        return c.json({ profile }, 200)
      },
    )
    .post('/stripe/onboarding-link', requireRole('teacher'), async (c) => {
      const link = await connect.onboardingLink(ensureUser(c.get('user')).id)
      return c.json(link, 200)
    })
    .get('/stripe/status', requireRole('teacher'), async (c) => {
      const status = await connect.syncStatus(ensureUser(c.get('user')).id)
      return c.json({ stripe: status }, 200)
    })
    .post('/stripe/login-link', requireRole('teacher'), async (c) => {
      const link = await connect.loginLink(ensureUser(c.get('user')).id)
      return c.json(link, 200)
    })
}
