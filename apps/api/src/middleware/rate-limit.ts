import type { Context, MiddlewareHandler } from 'hono'
import { errors } from '../lib/errors'
import type { AppEnv } from './auth'

type Bucket = { count: number; resetAt: number }

/** Signed-in requests are limited per user, anonymous ones per client address. */
export function clientKey(c: Context<AppEnv>): string {
  const user = c.get('user')
  if (user) return `u:${user.id}`
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming
  return `ip:${forwarded || incoming?.socket?.remoteAddress || 'local'}`
}

/**
 * Fixed-window, in-memory limiter: enough for one API instance and for keeping token guessing,
 * code brute force and quote hammering off the database. Put a shared store behind it when the
 * API runs on more than one instance.
 */
export function rateLimit(options: {
  name: string
  limit: number
  windowMs: number
  key?: (c: Context<AppEnv>) => string
}): MiddlewareHandler<AppEnv> {
  const buckets = new Map<string, Bucket>()
  return async (c, next) => {
    const now = Date.now()
    if (buckets.size > 10_000) {
      for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
    }
    const key = `${options.name}:${options.key ? options.key(c) : clientKey(c)}`
    const bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    } else if (++bucket.count > options.limit) {
      c.header('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))))
      throw errors.tooMany()
    }
    await next()
  }
}
