import type { Audience, AuthUser, Role } from '@elevate/core'
import { createMiddleware } from 'hono/factory'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import { AuthService } from '../services/auth.service'

export type SessionUser = AuthUser & { sessionId: string; audience: Audience }

export type AppEnv = {
  Variables: {
    requestId: string
    user: SessionUser | null
  }
}

/** Resolves the bearer token on every request. A present-but-invalid token is a 401. */
export const authenticate = (deps: Deps) => {
  const auth = new AuthService(deps)
  return createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header('authorization')
    if (!header) {
      c.set('user', null)
      return next()
    }
    const [scheme, token] = header.split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw errors.invalidSession()
    const user = await auth.getSessionUser(token)
    if (!user) throw errors.invalidSession()
    c.set('user', user)
    await next()
  })
}

export const requireUser = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!c.get('user')) throw errors.unauthorized()
    await next()
  })

export function hasRole(user: Pick<AuthUser, 'roles'>, ...roles: Role[]): boolean {
  if (user.roles.includes('super_admin')) return true
  return roles.some((r) => user.roles.includes(r))
}

/** super_admin satisfies every role check. */
export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) throw errors.unauthorized()
    if (!hasRole(user, ...roles)) throw errors.forbidden()
    await next()
  })

export function ensureUser(user: SessionUser | null): SessionUser {
  if (!user) throw errors.unauthorized()
  return user
}
