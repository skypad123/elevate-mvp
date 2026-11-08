import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Deps } from './deps'
import { createErrorHandler } from './lib/errors'
import { type AppEnv, authenticate } from './middleware/auth'
import { requestId } from './middleware/request-id'
import { requestLogger } from './middleware/request-logger'
import { requestOrigin } from './middleware/request-origin'
import { authRoutes } from './routes/auth'
import { catalogRoutes } from './routes/catalog'
import { checkoutRoutes } from './routes/checkout'
import { filesRoutes } from './routes/files'
import { healthRoutes } from './routes/health'
import { meRoutes } from './routes/me'
import { mediaRoutes } from './routes/media'
import { supportRoutes } from './routes/support'
import { teachRoutes } from './routes/teach'
import { webhookRoutes } from './routes/webhooks'

export function createApp(deps: Deps) {
  const { env } = deps
  const allowedOrigins = [env.LEARNER_URL, env.TEACH_URL, env.SUPPORT_URL]

  const app = new Hono<AppEnv>()
    .basePath('/api')
    .use(requestId())
    .use(requestOrigin())
    .use(
      cors({
        // Dev: any origin (Expo web on a LAN IP, Expo Go). Prod: the three portals only.
        origin: (origin) =>
          env.isProd ? (allowedOrigins.includes(origin) ? origin : null) : origin,
        allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
        exposeHeaders: ['X-Request-Id'],
        maxAge: 600,
      }),
    )
    .use(requestLogger(deps.log))
    .use(authenticate(deps))
    .onError(createErrorHandler(deps.log))
    .notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404))

  const routes = app
    .route('/', healthRoutes(deps))
    .route('/auth', authRoutes(deps))
    .route('/me', meRoutes(deps))
    .route('/media', mediaRoutes(deps))
    .route('/files', filesRoutes(deps))
    .route('/webhooks', webhookRoutes(deps))
    .route('/teach', teachRoutes(deps))
    .route('/support', supportRoutes(deps))
    .route('/catalog', catalogRoutes(deps))
    .route('/checkout', checkoutRoutes(deps))

  return routes
}

export type AppType = ReturnType<typeof createApp>
