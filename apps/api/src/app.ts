import { Hono } from 'hono'

export function createApp() {
  const app = new Hono().basePath('/api')
  const routes = app.get('/health', (c) => c.json({ ok: true, service: 'elevate-api' }, 200))
  return routes
}

export type AppType = ReturnType<typeof createApp>
