import type { Deps } from '../deps'
import type { PaymentsWebhookEvent } from '../providers/payments'
import { ConnectService } from './connect.service'
import { type FulfilmentInput, PaymentsService } from './payments.service'
import { TransactionsService } from './transactions.service'

export type StripeEventOutcome = 'applied' | 'ignored' | 'unmatched'
export type StripeEventHandler = (
  event: PaymentsWebhookEvent,
  deps: Deps,
) => Promise<StripeEventOutcome>

/** Registry of Stripe event handlers. Checkout and refund handlers are added with the payments flow. */
export function createStripeEventHandlers(deps: Deps): Record<string, StripeEventHandler> {
  const connect = new ConnectService(deps)
  const payments = new PaymentsService(deps)
  const transactions = new TransactionsService(deps)
  const fulfil = async (event: PaymentsWebhookEvent): Promise<StripeEventOutcome> => {
    const session = event.data.object
    if (session.payment_status !== 'paid') return 'ignored'
    const input: FulfilmentInput = {
      sessionId: String(session.id),
      paymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : ((session.payment_intent as { id?: string } | null)?.id ?? null),
      amountTotal: typeof session.amount_total === 'number' ? session.amount_total : null,
      customerEmail:
        (session.customer_details as { email?: string } | undefined)?.email ??
        (session.customer_email as string | undefined) ??
        null,
      metadata: (session.metadata as Record<string, string> | undefined) ?? {},
    }
    const outcome = await payments.fulfilCheckout(input)
    // Thrown so the webhook route stores it with the event: the learner has paid and has no
    // enrolment until Support acts on it.
    if (outcome === 'unattributed')
      throw new Error(`unattributed_checkout: session ${input.sessionId} names no payout account`)
    return outcome
  }
  return {
    'account.updated': async (event) => connect.applyAccountUpdated(event.data.object),
    'checkout.session.completed': fulfil,
    'checkout.session.async_payment_succeeded': fulfil,
    'charge.refunded': async (event) => transactions.applyChargeRefunded(event.data.object),
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
