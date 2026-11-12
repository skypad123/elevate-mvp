import {
  type Actor,
  type Audience,
  type AuthUser,
  type Capability,
  can,
  type Role,
} from '@elevate/core'
import { createMiddleware } from 'hono/factory'
import { routePath } from 'hono/route'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import { recordStaffAction } from '../services/audit.service'
import { AuthService, loadActor } from '../services/auth.service'

/** `signedInAt` is when the session was created: sessions start only at sign-in and are never re-created. */
export type SessionUser = AuthUser & { sessionId: string; audience: Audience; signedInAt: Date }

/** Who is acting on which profile. Resolved once per request by `requireProfile`. */
export type ProfileActor = Actor & { profileId: string; userId: string }

export type AppEnv = {
  Variables: {
    requestId: string
    user: SessionUser | null
    /** Set on routes under `/teach/profiles/:profileId`. */
    actor: ProfileActor | undefined
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RECENT_SIGN_IN_MS = 24 * 60 * 60 * 1000

/** Resolves the bearer token on every request. A present-but-invalid token is a 401. */
export const authenticate = (deps: Deps) => {
  const auth = new AuthService(deps)
  // Signing in must not depend on an old session: the portals send the token they still hold on
  // every request, so on these two a dead token means "no user" instead of a 401.
  const signInRoutes = new Set(['POST /api/auth/magic-link', 'POST /api/auth/verify'])
  return createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header('authorization')
    if (!header) {
      c.set('user', null)
      return next()
    }
    const [scheme, token] = header.split(' ')
    const user =
      scheme?.toLowerCase() === 'bearer' && token ? await auth.getSessionUser(token) : null
    if (!user && !signInRoutes.has(`${c.req.method} ${c.req.path}`)) throw errors.invalidSession()
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

/** For Support routes. super_admin satisfies every role check. */
export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) throw errors.unauthorized()
    if (!hasRole(user, ...roles)) throw errors.forbidden()
    await next()
  })

/**
 * For every route under `/teach/profiles/:profileId`. Works out who the caller is on that profile
 * and stores it on the context; with a capability, also checks it.
 *
 * A profile the caller cannot access answers 404, not 403, so its ID is not confirmed to exist.
 * A change made by platform staff is written to the audit log once the request has succeeded.
 */
export const requireProfile = (deps: Deps, capability?: Capability) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) throw errors.unauthorized()
    const profileId = c.req.param('profileId')
    if (!profileId || !UUID.test(profileId)) throw errors.notFound('Profile')
    const actor = await loadActor(deps, user, profileId)
    if (!actor) throw errors.notFound('Profile')
    if (capability && !can(actor, capability)) throw errors.forbidden()
    c.set('actor', actor)
    await next()
    if (actor.role === 'staff' && c.req.method !== 'GET' && !c.error && c.res.ok) {
      await recordStaffAction(deps, actor, {
        method: c.req.method,
        route: routePath(c).replace(/^\/api/, ''),
        path: c.req.path,
      })
    }
  })

/**
 * Answers 404 for a path parameter that is not a UUID, before it reaches a query. Postgres would
 * otherwise reject the value and the caller would see a server error.
 */
export const uuidParam = (name: string, what: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const value = c.req.param(name)
    if (!value || !UUID.test(value)) throw errors.notFound(what)
    await next()
  })

/**
 * For actions that reach Stripe on the owner's behalf. The caller must have signed in within the
 * last 24 hours; an older session gets `401 reauth_required` and signs in again. This limits what
 * a stolen session can do, not a stolen inbox.
 */
export const requireRecentSignIn = (deps: Deps, maxAgeMs = RECENT_SIGN_IN_MS) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) throw errors.unauthorized()
    if (deps.now().getTime() - user.signedInAt.getTime() > maxAgeMs) throw errors.reauthRequired()
    await next()
  })

export function ensureUser(user: SessionUser | null): SessionUser {
  if (!user) throw errors.unauthorized()
  return user
}

export function ensureActor(actor: ProfileActor | undefined): ProfileActor {
  if (!actor) throw new Error('route is missing requireProfile')
  return actor
}
