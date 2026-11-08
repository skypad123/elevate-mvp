import { Hono } from 'hono'
import type { Deps } from '../deps'
import type { AppEnv } from '../middleware/auth'

export const healthRoutes = (deps: Deps) =>
  new Hono<AppEnv>().get('/health', (c) =>
    c.json({ ok: true, service: 'elevate-api', time: deps.now().toISOString() }, 200),
  )
