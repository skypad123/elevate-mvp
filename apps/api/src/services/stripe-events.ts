import { schema as s } from '@elevate/db'
import { and, eq, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import type { PaymentsWebhookEvent } from '../providers/payments'
import { PAYOUT_LABEL } from '../providers/payments/types'
import { ConnectService } from './connect.service'
import { type FulfilmentInput, PaymentsService } from './payments.service'
import { PayoutsService } from './payouts.service'
import { SeatRefundsService, type Tx } from './seat-refunds.service'
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
  const payouts = new PayoutsService(deps)
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
    // Also stored with the event: the learner paid twice and the second payment needs a refund.
    if (outcome === 'duplicate_unrefunded')
      throw new Error(`duplicate_unrefunded: session ${input.sessionId} paid an active enrolment`)
    // A lost seat is handled: the payment is recorded with the seat refund row that returns it.
    return outcome === 'duplicate' || outcome === 'seat_lost' ? 'applied' : outcome
  }
  const payoutEvent =
    (status: 'paid' | 'failed'): StripeEventHandler =>
    async (event) => {
      const payout = event.data.object
      if (typeof payout.id !== 'string') return 'ignored'
      const metadata = (payout.metadata as Record<string, string> | null | undefined) ?? {}
      return payouts.onPayoutEvent(payout.id, status, metadata[PAYOUT_LABEL] ?? null)
    }
  return {
    'account.updated': async (event) => connect.applyAccountUpdated(event.data.object),
    'checkout.session.completed': fulfil,
    'checkout.session.async_payment_succeeded': fulfil,
    'charge.refunded': async (event) => transactions.applyChargeRefunded(event.data.object),
    'charge.dispute.created': async (event) => applyDisputeCreated(deps, event.data.object),
    'charge.dispute.closed': async (event) => applyDisputeClosed(deps, event.data.object),
    // Sent on the Connect endpoint: a payout is made on the profile's own account.
    'payout.paid': payoutEvent('paid'),
    'payout.failed': payoutEvent('failed'),
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

// ── bank disputes (docs/designs/scheduled-classes-selling.md, "Bank disputes") ──

type Dispute = { id: string; paymentIntentId: string | null; chargeId: string | null }

function readDispute(object: Record<string, unknown>): Dispute | null {
  if (typeof object.id !== 'string') return null
  const pi = object.payment_intent
  const charge = object.charge
  return {
    id: object.id,
    paymentIntentId: typeof pi === 'string' ? pi : ((pi as { id?: string } | null)?.id ?? null),
    chargeId:
      typeof charge === 'string' ? charge : ((charge as { id?: string } | null)?.id ?? null),
  }
}

/** A bank dispute is matched to a payment by its payment intent, or else by its charge. */
async function paymentOf(deps: Deps, dispute: Dispute) {
  if (dispute.paymentIntentId) {
    const p = await deps.db.query.payments.findFirst({
      where: { stripePaymentIntentId: dispute.paymentIntentId },
    })
    if (p) return p
  }
  if (!dispute.chargeId) return null
  return (
    (await deps.db.query.payments.findFirst({ where: { stripeChargeId: dispute.chargeId } })) ??
    null
  )
}

/**
 * `charge.dispute.created`: the payment carries the bank dispute as `open`. A class payment not
 * yet released then stays held, and a seat refund row that is ready waits, since Stripe refuses a
 * refund of a disputed charge. A second delivery, or one after the dispute closed, changes
 * nothing.
 */
async function applyDisputeCreated(
  deps: Deps,
  object: Record<string, unknown>,
): Promise<StripeEventOutcome> {
  const dispute = readDispute(object)
  if (!dispute) return 'ignored'
  const p = await paymentOf(deps, dispute)
  if (!p) return 'unmatched'
  const now = deps.now()
  const opened = await deps.db.transaction(async (raw) => {
    const tx = raw as unknown as Tx
    const [updated] = await tx
      .update(s.payments)
      .set({ bankDisputeId: dispute.id, bankDisputeStatus: 'open', bankDisputedAt: now })
      .where(
        and(
          eq(s.payments.id, p.id),
          sql`(${s.payments.bankDisputeStatus} is null or ${s.payments.bankDisputeId} is distinct from ${dispute.id})`,
        ),
      )
      .returning({ id: s.payments.id })
    if (!updated) return false
    await tx
      .update(s.seatRefunds)
      .set({ status: 'waiting', waitingFor: 'bank_dispute' })
      .where(
        and(
          eq(s.seatRefunds.paymentId, p.id),
          eq(s.seatRefunds.status, 'pending'),
          sql`${s.seatRefunds.kind} <> 'dispute_lost'`,
        ),
      )
    return true
  })
  return opened ? 'applied' : 'ignored'
}

/**
 * `charge.dispute.closed`. Won (or closed as a warning, with no money taken): the status, and
 * the next run releases the payment if its class is and resumes a waiting row. Lost, in one
 * transaction: the status; the payment's unfinished seat refund rows closed as `bank_returned`;
 * and for a class payment, the seat ended as `refunded` and a `dispute_lost` row written, which
 * the job sends as one reversal of the transfer. A self-paced payment only records the loss. The
 * unique index on `dispute_lost` rows makes a second delivery write nothing.
 */
async function applyDisputeClosed(
  deps: Deps,
  object: Record<string, unknown>,
): Promise<StripeEventOutcome> {
  const dispute = readDispute(object)
  if (!dispute) return 'ignored'
  const p = await paymentOf(deps, dispute)
  if (!p) return 'unmatched'
  const now = deps.now()
  if (object.status !== 'lost') {
    const [won] = await deps.db
      .update(s.payments)
      .set({
        bankDisputeStatus: 'won',
        bankDisputeId: dispute.id,
        bankDisputedAt: p.bankDisputedAt ?? now,
      })
      .where(
        and(
          eq(s.payments.id, p.id),
          sql`${s.payments.bankDisputeStatus} is distinct from 'won'`,
          sql`${s.payments.bankDisputeStatus} is distinct from 'lost'`,
        ),
      )
      .returning({ id: s.payments.id })
    return won ? 'applied' : 'ignored'
  }
  const seatRefunds = new SeatRefundsService(deps)
  const changed = await deps.db.transaction(async (raw) => {
    const tx = raw as unknown as Tx
    // The enrollment first, in the order fulfilment and refunds lock it.
    const [enrollment] = await tx
      .select()
      .from(s.enrollments)
      .where(eq(s.enrollments.id, p.enrollmentId))
      .for('update')
    const [payment] = await tx
      .select()
      .from(s.payments)
      .where(eq(s.payments.id, p.id))
      .for('update')
    if (!payment) return false
    let changed = false
    if (payment.bankDisputeStatus !== 'lost') {
      await tx
        .update(s.payments)
        .set({
          bankDisputeStatus: 'lost',
          bankDisputeId: dispute.id,
          bankDisputedAt: payment.bankDisputedAt ?? now,
        })
        .where(eq(s.payments.id, payment.id))
      changed = true
    }
    if (payment.classId === null) return changed
    if ((await seatRefunds.closeForBankLoss(tx, payment.id, now)) > 0) changed = true
    if (
      enrollment?.status === 'active' &&
      enrollment.stripeCheckoutSessionId === payment.stripeCheckoutSessionId
    ) {
      await tx
        .update(s.enrollments)
        .set({ status: 'refunded' })
        .where(eq(s.enrollments.id, enrollment.id))
      changed = true
    }
    const [existing] = await tx
      .select({ id: s.seatRefunds.id })
      .from(s.seatRefunds)
      .where(and(eq(s.seatRefunds.paymentId, payment.id), eq(s.seatRefunds.kind, 'dispute_lost')))
    if (!existing) {
      await seatRefunds.request(tx, {
        enrollmentId: payment.enrollmentId,
        paymentId: payment.id,
        classId: payment.classId,
        kind: 'dispute_lost',
      })
      changed = true
    }
    return changed
  })
  return changed ? 'applied' : 'ignored'
}
