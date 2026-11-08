import { serve } from '@hono/node-server'
import { createApp } from './app'

const port = Number(process.env.API_PORT ?? 4000)
const app = createApp()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`elevate-api listening on http://localhost:${info.port}/api/health`)
})
