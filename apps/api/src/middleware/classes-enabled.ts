import { createMiddleware } from 'hono/factory'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import type { AppEnv } from './auth'

/**
 * Class routes exist only while the `CLASSES` setting is on (ADR 012). Off, they answer 404, as an
 * unknown route does. The one exception, `GET /me/classes`, answers an empty list instead and does
 * not use this guard.
 */
export const requireClasses = (deps: Deps) =>
  createMiddleware<AppEnv>(async (_c, next) => {
    if (!deps.env.CLASSES) throw errors.notFound()
    await next()
  })
