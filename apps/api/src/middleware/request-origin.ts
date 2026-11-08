import { createMiddleware } from 'hono/factory'
import { runWithRequest } from '../lib/request-context'
import type { AppEnv } from './auth'

/** Captures the scheme + host the client used, honouring reverse-proxy headers. */
export const requestOrigin = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const url = new URL(c.req.url)
    const proto = c.req.header('x-forwarded-proto') ?? url.protocol.replace(':', '')
    const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? url.host
    await runWithRequest({ origin: `${proto}://${host}` }, next)
  })
