import type { Env } from '../../env'
import { StripePaymentsProvider } from './stripe'
import { type PaymentsProvider, UnconfiguredPaymentsProvider } from './types'

export * from './fake'
export * from './stripe'
export * from './types'

export function createPaymentsProvider(env: Env): PaymentsProvider {
  if (!env.STRIPE_SECRET_KEY) return new UnconfiguredPaymentsProvider()
  return new StripePaymentsProvider({
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    connectWebhookSecret: env.STRIPE_CONNECT_WEBHOOK_SECRET,
    country: 'SG',
  })
}
