import { Hono } from 'hono'
import type { Deps } from '../deps'
import type { AppEnv } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { CertificatesService } from '../services/certificates.service'

/** Public: anyone with the token can verify or download. */
export const certificateRoutes = (deps: Deps, certificates = new CertificatesService(deps)) =>
  new Hono<AppEnv>()
    .get(
      '/verify/:token',
      rateLimit({ name: 'certificate-verify', limit: 120, windowMs: 60_000 }),
      async (c) => c.json(await certificates.verify(c.req.param('token')), 200),
    )
    .get(
      '/:token/pdf',
      rateLimit({ name: 'certificate-pdf', limit: 60, windowMs: 60_000 }),
      async (c) => {
        const file = await certificates.pdf(c.req.param('token'))
        c.header('Content-Type', 'application/pdf')
        c.header('Content-Length', String(file.size))
        c.header('Content-Disposition', `inline; filename="${file.filename}"`)
        c.header('Cache-Control', 'private, max-age=0')
        return c.body(file.body)
      },
    )
