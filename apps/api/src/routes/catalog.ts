import { catalogQuerySchema } from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import type { AppEnv } from '../middleware/auth'
import { CatalogService } from '../services/catalog.service'

/** Public catalogue. Authentication is optional and only adds the viewer's enrollment state. */
export const catalogRoutes = (deps: Deps) => {
  const catalog = new CatalogService(deps)
  return new Hono<AppEnv>()
    .get('/categories', async (c) => c.json({ items: await catalog.categories() }, 200))
    .get('/courses', validate('query', catalogQuerySchema), async (c) =>
      c.json(await catalog.list(c.req.valid('query')), 200),
    )
    .get('/courses/:slug', async (c) => {
      const course = await catalog.detail(c.req.param('slug'), c.get('user'))
      return c.json({ course }, 200)
    })
}
