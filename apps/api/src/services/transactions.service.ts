import {
  ANALYTICS_EVENTS,
  type AuditEntry,
  type Page,
  type PayoutLedgerRow,
  type TransactionDetail,
  type TransactionSummary,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, EmptyFilter, eq, exists, ilike, or, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'
import { recordAudit, trackEvent } from './audit.service'

type PaymentWithRelations = typeof s.payments.$inferSelect & {
  user: { email: string }
  course: { title: string; slug: string }
  profile: { displayName: string }
}

/** The relations every transaction row is shown with. */
const SUMMARY_RELATIONS = {
  user: { columns: { email: true } },
  course: { columns: { title: true, slug: true } },
  profile: { columns: { displayName: true } },
} as const

const encodeCursor = (offset: number) => Buffer.from(String(offset)).toString('base64url')
const decodeCursor = (cursor?: string) => {
  const n = cursor ? Number(Buffer.from(cursor, 'base64url').toString('utf8')) : 0
  return Number.isInteger(n) && n >= 0 ? n : 0
}

function summary(p: PaymentWithRelations): TransactionSummary {
  return {
    id: p.id,
    paidAt: p.paidAt.toISOString(),
    status: p.status,
    amountCents: p.amountCents,
    refundedCents: p.refundedCents,
    applicationFeeCents: p.applicationFeeCents,
    teacherNetCents: p.teacherNetCents,
    learnerEmail: p.user.email,
    courseTitle: p.course.title,
    courseSlug: p.course.slug,
    profileId: p.profileId,
    profileName: p.profile.displayName,
    payoutAccountId: p.payoutAccountId,
  }
}

export class TransactionsService {
  constructor(private readonly deps: Deps) {}

  async list(query: {
    status?: TransactionSummary['status']
    q?: string
    cursor?: string
    limit: number
  }): Promise<Page<TransactionSummary>> {
    const { db } = this.deps
    const like = query.q ? `%${query.q.replace(/[%_]/g, '\\$&')}%` : null
    const offset = decodeCursor(query.cursor)
    const rows = await db.query.payments.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        // Search matches the learner's email, the course title or the Stripe payment intent ID.
        // The callback's `payment` is the query's own alias for the table, which the subqueries
        // must refer to.
        ...(like
          ? {
              RAW: (payment) =>
                or(
                  exists(
                    db
                      .select({ one: sql`1` })
                      .from(s.users)
                      .where(and(eq(s.users.id, payment.userId), ilike(s.users.email, like))),
                  ),
                  exists(
                    db
                      .select({ one: sql`1` })
                      .from(s.courses)
                      .where(and(eq(s.courses.id, payment.courseId), ilike(s.courses.title, like))),
                  ),
                  ilike(payment.stripePaymentIntentId, like),
                ) ?? EmptyFilter,
            }
          : {}),
      },
      orderBy: { paidAt: 'desc' },
      limit: query.limit + 1,
      offset,
      with: SUMMARY_RELATIONS,
    })
    return {
      items: rows.slice(0, query.limit).map(summary),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
    }
  }

  async detail(paymentId: string): Promise<TransactionDetail> {
    const p = await this.deps.db.query.payments.findFirst({
      where: { id: paymentId },
      with: {
        ...SUMMARY_RELATIONS,
        enrollment: { columns: { id: true, status: true } },
        promoCode: { columns: { code: true } },
        refunds: true,
      },
    })
    if (!p) throw errors.notFound('Payment')
    const requesters = new Map<string, string>()
    for (const r of p.refunds) {
      if (r.requestedBy && !requesters.has(r.requestedBy)) {
        const u = await this.deps.db.query.users.findFirst({
          where: { id: r.requestedBy },
          columns: { email: true },
        })
        if (u) requesters.set(r.requestedBy, u.email)
      }
    }
    return {
      ...summary(p),
      listPriceCents: p.listPriceCents,
      discountCents: p.discountCents,
      stripeFeeEstimateCents: p.stripeFeeEstimateCents,
      stripeFeeActualCents: p.stripeFeeActualCents,
      commissionCents: p.commissionCents,
      platformNetCents: p.platformNetCents,
      promoCode: p.promoCode?.code ?? null,
      enrollmentId: p.enrollment.id,
      enrollmentStatus: p.enrollment.status,
      stripe: {
        checkoutSessionId: p.stripeCheckoutSessionId,
        paymentIntentId: p.stripePaymentIntentId,
        chargeId: p.stripeChargeId,
        transferId: p.stripeTransferId,
        applicationFeeId: p.stripeApplicationFeeId,
        balanceTransactionId: p.stripeBalanceTransactionId,
        receiptUrl: p.receiptUrl,
      },
      refunds: p.refunds.map((r) => ({
        id: r.id,
        stripeRefundId: r.stripeRefundId,
        amountCents: r.amountCents,
        reason: r.reason,
        requestedBy: r.requestedBy ? (requesters.get(r.requestedBy) ?? null) : null,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  }

  /** Full refund through Stripe (reverses the transfer and the application fee), then revokes access. */
  async refund(actor: SessionUser, paymentId: string, reason: string): Promise<TransactionDetail> {
    const { db, payments } = this.deps
    const p = await db.query.payments.findFirst({ where: { id: paymentId } })
    if (!p) throw errors.notFound('Payment')
    if (p.status === 'refunded')
      throw errors.conflict('already_refunded', 'This payment was already refunded')
    if (!p.stripePaymentIntentId)
      throw errors.conflict('no_payment_intent', 'This payment has no Stripe payment intent')
    const result = await payments.createRefund({
      paymentIntentId: p.stripePaymentIntentId,
      reason,
      metadata: { paymentId, actorId: actor.id },
    })
    const recorded = await this.applyRefund({
      paymentId,
      stripeRefundId: result.refundId,
      amountCents: result.amountCents,
      reason,
      requestedBy: actor.id,
    })
    await recordAudit(this.deps, {
      actorId: actor.id,
      action: 'payment.refund',
      entityType: 'payment',
      entityId: paymentId,
      profileId: p.profileId,
      metadata: { reason, amountCents: result.amountCents, stripeRefundId: result.refundId },
    })
    await trackEvent(this.deps, {
      userId: p.userId,
      name: ANALYTICS_EVENTS.refundIssued,
      properties: { paymentId, amountCents: result.amountCents },
    })
    if (recorded) await this.sendRefundNotices(paymentId, result.amountCents, reason)
    return this.detail(paymentId)
  }

  /**
   * Tells the learner and the owner of the profile that was paid. Sent once per refund: by
   * whichever of the Support action and the `charge.refunded` webhook records the refund first.
   */
  private async sendRefundNotices(
    paymentId: string,
    amountCents: number,
    reason: string,
  ): Promise<void> {
    const { db, env, mailer } = this.deps
    const p = await db.query.payments.findFirst({
      where: { id: paymentId },
      with: { user: true, course: true, profile: { with: { owner: true } } },
    })
    if (!p) return
    const amount = `${(amountCents / 100).toFixed(2)} SGD`
    await mailer.send(
      simpleEmail({
        to: p.user.email,
        title: `Refund issued for ${p.course.title}`,
        paragraphs: [
          `We have refunded ${amount} to your original payment method. It can take 5–10 working days to appear.`,
          `Reason: ${reason}`,
          ...(p.status === 'refunded' ? ['Access to the course has been removed.'] : []),
        ],
      }),
    )
    await mailer.send(
      simpleEmail({
        to: p.profile.owner.email,
        title: `A sale of "${p.course.title}" was refunded`,
        paragraphs: [
          `${amount} was refunded to a learner who bought "${p.course.title}" from ${p.profile.displayName}.`,
          `Reason: ${reason}`,
          'Your earnings in Elevate Teach show the sale after this refund.',
        ],
        cta: { href: `${env.TEACH_URL}/p/${p.profileId}/earnings`, label: 'View earnings' },
      }),
    )
  }

  /**
   * Shared by the Support action and the charge.refunded webhook. Idempotent per Stripe refund
   * id; returns whether this call recorded the refund (false when it was already on record).
   */
  async applyRefund(input: {
    paymentId: string
    stripeRefundId: string
    amountCents: number
    reason: string | null
    requestedBy: string | null
  }): Promise<boolean> {
    const { db } = this.deps
    const inserted = await db
      .insert(s.refunds)
      .values({
        paymentId: input.paymentId,
        stripeRefundId: input.stripeRefundId,
        amountCents: input.amountCents,
        reason: input.reason,
        requestedBy: input.requestedBy,
      })
      .onConflictDoNothing()
      .returning()
    if (inserted.length === 0) return false
    const p = await db.query.payments.findFirst({ where: { id: input.paymentId } })
    if (!p) return true
    const refundedCents = Math.min(p.amountCents, p.refundedCents + input.amountCents)
    const status = refundedCents >= p.amountCents ? 'refunded' : 'partially_refunded'
    await db.update(s.payments).set({ refundedCents, status }).where(eq(s.payments.id, p.id))
    if (status === 'refunded') {
      await db
        .update(s.enrollments)
        .set({ status: 'refunded' })
        .where(eq(s.enrollments.id, p.enrollmentId))
      await db
        .update(s.courses)
        .set({ enrolCount: sql`greatest(${s.courses.enrolCount} - 1, 0)` })
        .where(eq(s.courses.id, p.courseId))
    }
    return true
  }

  /** Webhook: charge.refunded (covers refunds made from the Stripe dashboard). */
  async applyChargeRefunded(
    charge: Record<string, unknown>,
  ): Promise<'applied' | 'ignored' | 'unmatched'> {
    const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
    const chargeId = typeof charge.id === 'string' ? charge.id : null
    const p = await this.deps.db.query.payments.findFirst({
      where: paymentIntentId
        ? { stripePaymentIntentId: paymentIntentId }
        : chargeId
          ? { stripeChargeId: chargeId }
          : { RAW: sql`false` },
    })
    if (!p) return 'unmatched'
    const refundedTotal = typeof charge.amount_refunded === 'number' ? charge.amount_refunded : null
    if (refundedTotal === null || refundedTotal <= p.refundedCents) return 'ignored'
    const refundsObj = charge.refunds as
      | { data?: Array<{ id?: string; amount?: number }> }
      | undefined
    const latest = refundsObj?.data?.[0]
    const amountCents = refundedTotal - p.refundedCents
    const reason = 'Refunded in Stripe'
    const recorded = await this.applyRefund({
      paymentId: p.id,
      stripeRefundId: latest?.id ?? `re_${chargeId ?? paymentIntentId}_${refundedTotal}`,
      amountCents,
      reason,
      requestedBy: null,
    })
    await recordAudit(this.deps, {
      actorId: null,
      action: 'payment.refund.webhook',
      entityType: 'payment',
      entityId: p.id,
      profileId: p.profileId,
      metadata: { refundedTotal },
    })
    // A refund made in the Stripe dashboard reaches us only here, so this is where its two
    // notices are sent. A Support refund is already on record by now and sends nothing more.
    if (recorded) await this.sendRefundNotices(p.id, amountCents, reason)
    return 'applied'
  }

  /** One row per payout account that has been paid, with the profile it belongs to. */
  async payouts(): Promise<PayoutLedgerRow[]> {
    const { db } = this.deps
    const rows = await db
      .select({
        payoutAccountId: s.payments.payoutAccountId,
        transferCount: sql<number>`count(*) filter (where ${s.payments.stripeTransferId} is not null)::int`,
        transferredCents: sql<number>`coalesce(sum(${s.payments.teacherNetCents}), 0)::int`,
        refundedCents: sql<number>`coalesce(sum(${s.payments.refundedCents}), 0)::int`,
      })
      .from(s.payments)
      .groupBy(s.payments.payoutAccountId)
    const out: PayoutLedgerRow[] = []
    for (const r of rows) {
      const account = await db.query.payoutAccounts.findFirst({
        where: { id: r.payoutAccountId },
        with: { profile: { with: { owner: { columns: { email: true } } } } },
      })
      if (!account) continue
      out.push({
        payoutAccountId: account.id,
        stripeAccountId: account.stripeAccountId,
        payoutsEnabled: account.payoutsEnabled,
        profileId: account.profileId,
        profileName: account.profile.displayName,
        ownerEmail: account.profile.owner.email,
        transferCount: r.transferCount,
        transferredCents: r.transferredCents,
        refundedCents: r.refundedCents,
      })
    }
    return out.sort((a, b) => b.transferredCents - a.transferredCents)
  }

  async audit(cursor?: string, limit = 50): Promise<Page<AuditEntry>> {
    const offset = decodeCursor(cursor)
    const rows = await this.deps.db.query.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      limit: limit + 1,
      offset,
    })
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))]
    const actors = new Map<string, string>()
    for (const id of actorIds) {
      const u = await this.deps.db.query.users.findFirst({
        where: { id },
        columns: { email: true },
      })
      if (u) actors.set(id, u.email)
    }
    return {
      items: rows.slice(0, limit).map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        profileId: r.profileId,
        actorEmail: r.actorId ? (actors.get(r.actorId) ?? null) : null,
        metadata: r.metadata ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: rows.length > limit ? encodeCursor(offset + limit) : null,
    }
  }
}
