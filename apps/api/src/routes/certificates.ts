import { Hono } from 'hono'
import type { Deps } from '../deps'
import type { AppEnv } from '../middleware/auth'
import { CertificatesService } from '../services/certificates.service'

/** Public: anyone with the token can verify or download. */
export const certificateRoutes = (deps: Deps, certificates = new CertificatesService(deps)) =>
  new Hono<AppEnv>()
    .get('/verify/:token', async (c) =>
      c.json(await certificates.verify(c.req.param('token')), 200),
    )
    .get('/:token/pdf', async (c) => {
      const file = await certificates.pdf(c.req.param('token'))
      c.header('Content-Type', 'application/pdf')
      c.header('Content-Length', String(file.size))
      c.header('Content-Disposition', `inline; filename="${file.filename}"`)
      c.header('Cache-Control', 'private, max-age=0')
      return c.body(file.body)
    })
