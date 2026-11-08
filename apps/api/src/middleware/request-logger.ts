import { createMiddleware } from 'hono/factory'
import type { Logger } from '../lib/logger'
import type { AppEnv } from './auth'

export const requestLogger = (log: Logger) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const started = performance.now()
    await next()
    const ms = Math.round(performance.now() - started)
    const data = { status: c.res.status, ms, requestId: c.get('requestId') }
    if (c.res.status >= 500) log.error(`${c.req.method} ${c.req.path}`, data)
    else log.info(`${c.req.method} ${c.req.path}`, data)
  })
