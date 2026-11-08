import { Hono } from 'hono'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import type { AppEnv } from '../middleware/auth'
import { MediaService } from '../services/media.service'
import { createStripeEventHandlers, dispatchStripeEvent } from '../services/stripe-events'
import { WebhookLedger } from '../services/webhooks.service'

/** Provider webhooks: raw body, signature verification, idempotency ledger, fast 200. */
export const webhookRoutes = (deps: Deps) => {
  const ledger = new WebhookLedger(deps)
  const media = new MediaService(deps)
  const stripeHandlers = createStripeEventHandlers(deps)

  return new Hono<AppEnv>()
    .post('/mux', async (c) => {
      const raw = await c.req.text()
      let event: Awaited<ReturnType<typeof deps.video.parseWebhook>>
      try {
        event = await deps.video.parseWebhook(raw, c.req.raw.headers)
      } catch (error) {
        deps.log.warn('mux webhook rejected', {
          error: error instanceof Error ? error.message : String(error),
        })
        throw errors.badRequest('invalid_signature', 'Webhook signature verification failed')
      }
      const fresh = await ledger.record('mux', event.id, event.type, event)
      if (!fresh) return c.json({ received: true, duplicate: true }, 200)
      try {
        const outcome = await media.applyVideoEvent(event)
        await ledger.markProcessed('mux', event.id)
        return c.json({ received: true, outcome }, 200)
      } catch (error) {
        await ledger.markProcessed(
          'mux',
          event.id,
          error instanceof Error ? error.message : String(error),
        )
        throw error
      }
    })
    .post('/stripe', async (c) => {
      const raw = await c.req.text()
      let event: ReturnType<typeof deps.payments.constructEvent>
      try {
        event = deps.payments.constructEvent(raw, c.req.header('stripe-signature'))
      } catch (error) {
        deps.log.warn('stripe webhook rejected', {
          error: error instanceof Error ? error.message : String(error),
        })
        throw errors.badRequest('invalid_signature', 'Webhook signature verification failed')
      }
      const fresh = await ledger.record('stripe', event.id, event.type, event)
      if (!fresh) return c.json({ received: true, duplicate: true }, 200)
      try {
        const outcome = await dispatchStripeEvent(event, stripeHandlers, deps)
        await ledger.markProcessed('stripe', event.id)
        return c.json({ received: true, outcome }, 200)
      } catch (error) {
        await ledger.markProcessed(
          'stripe',
          event.id,
          error instanceof Error ? error.message : String(error),
        )
        throw error
      }
    })
}
