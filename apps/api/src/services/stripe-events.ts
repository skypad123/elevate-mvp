import type { Deps } from '../deps'
import type { PaymentsWebhookEvent } from '../providers/payments'
import { ConnectService } from './connect.service'

export type StripeEventOutcome = 'applied' | 'ignored' | 'unmatched'
export type StripeEventHandler = (
  event: PaymentsWebhookEvent,
  deps: Deps,
) => Promise<StripeEventOutcome>

/** Registry of Stripe event handlers. Checkout and refund handlers are added with the payments flow. */
export function createStripeEventHandlers(deps: Deps): Record<string, StripeEventHandler> {
  const connect = new ConnectService(deps)
  return {
    'account.updated': async (event) => connect.applyAccountUpdated(event.data.object),
  }
}

export async function dispatchStripeEvent(
  event: PaymentsWebhookEvent,
  handlers: Record<string, StripeEventHandler>,
  deps: Deps,
): Promise<StripeEventOutcome> {
  const handler = handlers[event.type]
  if (!handler) return 'ignored'
  return handler(event, deps)
}
