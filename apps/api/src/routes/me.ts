import { updateMeSchema } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireUser } from '../middleware/auth'
import { AuthService } from '../services/auth.service'
import { EnrollmentsService } from '../services/enrollments.service'
import { MediaService } from '../services/media.service'

export const meRoutes = (deps: Deps) => {
  const auth = new AuthService(deps)
  const media = new MediaService(deps)
  const enrollments = new EnrollmentsService(deps)
  return new Hono<AppEnv>()
    .get('/enrollments', requireUser(), async (c) => {
      const items = await enrollments.listForUser(ensureUser(c.get('user')).id)
      return c.json({ items }, 200)
    })
    .patch('/', requireUser(), validate('json', updateMeSchema), async (c) => {
      const user = ensureUser(c.get('user'))
      const body = c.req.valid('json')
      const patch: Partial<typeof s.users.$inferInsert> = {}
      if (body.name !== undefined) patch.name = body.name
      if (body.avatarMediaId === null) patch.avatarUrl = null
      else if (body.avatarMediaId) {
        const asset = await media.getOwnedReadyAsset(user, body.avatarMediaId, 'image')
        patch.avatarUrl = await media.publicUrl(asset)
      }
      if (Object.keys(patch).length > 0) {
        await deps.db.update(s.users).set(patch).where(eq(s.users.id, user.id))
      }
      return c.json({ user: await auth.buildAuthUser(user.id) }, 200)
    })
}
