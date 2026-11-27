import { Hono } from 'hono'
import { z } from 'zod'
import type { Deps } from '../deps'
import { validate } from '../lib/validate'
import type { AppEnv } from '../middleware/auth'
import { FakePaymentsProvider } from '../providers/payments/fake'
import { ReleaseService } from '../services/release.service'

const releaseRunSchema = z.object({ now: z.iso.datetime({ offset: true }).optional() }).optional()

/**
 * Development only: `createApp` mounts this router only when `DEV_ENDPOINTS_ENABLED` is on and
 * the server is not in production.
 *
 * `POST /dev/release-run` runs the release job inside the API. The fake payments provider keeps
 * its state in this process, so `dist/release.js` started as a second process would see an empty
 * fake; the local walkthrough uses this instead. `now` moves the run's clock, for instance past a
 * class's release date; every step of the run, attendance included, reads that clock. With the
 * fake provider, each fake account's pending balance is settled first, as Stripe would in a few
 * days.
 */
export const devRoutes = (deps: Deps) =>
  new Hono<AppEnv>().post('/release-run', validate('json', releaseRunSchema), async (c) => {
    const body = c.req.valid('json')
    const now = body?.now ? new Date(body.now) : deps.now()
    const { payments } = deps
    if (payments instanceof FakePaymentsProvider) {
      for (const accountId of new Set([...payments.accounts.keys(), ...payments.money.keys()])) {
        payments.settle(accountId)
      }
    }
    const result = await new ReleaseService({ ...deps, now: () => now }).run(now)
    return c.json({ run: result }, 200)
  })
