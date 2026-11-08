import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createDeps } from './deps'
import { loadEnv } from './env'

const env = loadEnv()
const deps = await createDeps(env)
const app = createApp(deps)

const server = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  deps.log.info(`elevate-api listening on http://localhost:${info.port}/api/health`, {
    env: env.NODE_ENV,
    mail: env.MAIL_DRIVER,
    storage: env.STORAGE_DRIVER,
    video: env.VIDEO_DRIVER,
  })
})

const shutdown = async () => {
  server.close()
  await deps.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
