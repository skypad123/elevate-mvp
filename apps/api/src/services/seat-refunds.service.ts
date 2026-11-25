import {
  formatSgd,
  IDEMPOTENCY_TRUST_MS,
  profileShareAfterRefunds,
  REFUND_MAX_ATTEMPTS,
  type RefundRowAction,
  type SeatRefundClosedReason,
  type SeatRefundKind,
  type SeatRefundView,
  type SeatRefundWaitingFor,
  seatRefund,
  UNFINISHED_SEAT_REFUND_STATUSES,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import Stripe from 'stripe'
import type { Deps } from '../deps'
import {
  classCancelledAttendedEmail,
  classCancelledEmail,
  seatLostEmail,
  seatRefundedEmail,
  seatWithdrawnEmail,
} from '../emails/class-sales'
import { simpleEmail } from '../emails/templates'
import { errors, HttpError } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'
import type { MailMessage } from '../providers/mailer'
import { AttendanceService, NO_ATTENDANCE } from './attendance.service'
import { TransactionsService } from './transactions.service'

/** A database client or an open transaction: every method here runs inside its caller's. */
export type Tx = Deps['db']

export type SeatRefundRow = typeof s.seatRefunds.$inferSelect

/** The metadata key that names the seat refund row on its Stripe refund and fee refund. */
export const SEAT_REFUND_LABEL = 'seat_refund_id'

/** The statuses the sender works from; `failed` waits for a Support admin. */
const SENDABLE = ['waiting', 'pending', 'refund_sent'] as const

export type SeatRefundRequest = {
  enrollmentId: string
  paymentId: string
  classId: string
  kind: SeatRefundKind
  /** For `discretionary` only: the amount the owner or manager chose. */
  requestedCents?: number
  reason?: string
  /** Null or absent for a row the system writes. */
  requestedBy?: string | null
  cancellationId?: string
  /** The row waits for this before it can be sent; without it the row is `pending`. */
  waitingFor?: SeatRefundWaitingFor
}

/** Where `send` left a row. */
export type SendOutcome =
  | 'skipped'
  | 'waiting'
  | 'pending'
  | 'refund_sent'
  | 'done'
  | 'closed'
  | 'failed'

/** Why each kind of refund was made, in the profile owner's email. */
const KIND_FOR_OWNER: Record<SeatRefundKind, string> = {
  teacher_cancelled: 'the class was cancelled',
  teacher_cancelled_part:
    'the class was cancelled after it started; this is the share of the sessions not taught',
  changed_withdrew: 'the learner withdrew after the class changed',
  learner_withdrew: 'the learner withdrew',
  discretionary: 'a refund granted in Elevate Teach',
  elevate_cancelled: 'Elevate cancelled the class',
  seat_lost: 'the payment arrived after the seat was gone',
  dispute_lost: 'the learner won a bank dispute',
}

/** A seat refund row as Teach and the learner app show it. */
export function seatRefundView(row: SeatRefundRow): SeatRefundView {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    waitingFor: row.waitingFor,
    closedReason: row.closedReason,
    learnerRefundCents: row.learnerRefundCents,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }
}

/**
 * A Stripe error the next run may not meet: a network failure, a rate limit or a Stripe server
 * error. Any other Stripe error is Stripe refusing the request, which a retry cannot fix. An
 * error that is not Stripe's (the database, say) is tried again, except a refusal by the refund
 * rules in `@elevate/core`.
 */
export function retryable(error: unknown): boolean {
  if (error instanceof Stripe.errors.StripeError) {
    return (
      error instanceof Stripe.errors.StripeConnectionError ||
      error instanceof Stripe.errors.StripeRateLimitError ||
      error instanceof Stripe.errors.StripeAPIError ||
      (error.statusCode ?? 0) >= 500
    )
  }
  return !(error instanceof RangeError)
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * Seat refunds (docs/designs/scheduled-classes-selling.md, "Refunds"). Every refund of a seat that
 * the system starts is one `seat_refunds` row, written here and nowhere else, before any money
 * moves. A request only writes the row; the sender, called by the release job, sends it.
 *
 * The sender saves the row's status and Stripe's ids after each step, so a run that stops can be
 * followed by another without sending anything twice. Stripe is called outside any transaction.
 * Nothing is recorded and nobody is emailed until Stripe reports that the refund succeeded.
 */
export class SeatRefundsService {
  constructor(private readonly deps: Deps) {}

  /**
   * Writes one seat refund row inside the caller's transaction: `waiting` when `waitingFor` is
   * given, otherwise `pending`. No amounts are written: the sender works them out from Stripe's
   * fee. The unique index allows one unfinished row per enrollment; a second is refused with
   * `refund_in_progress`, and the caller's transaction is still usable when it catches that.
   */
  async request(tx: Tx, input: SeatRefundRequest): Promise<SeatRefundRow> {
    const [row] = await tx
      .insert(s.seatRefunds)
      .values({
        enrollmentId: input.enrollmentId,
        paymentId: input.paymentId,
        classId: input.classId,
        kind: input.kind,
        status: input.waitingFor ? 'waiting' : 'pending',
        waitingFor: input.waitingFor ?? null,
        requestedCents: input.requestedCents ?? null,
        reason: input.reason ?? null,
        requestedBy: input.requestedBy ?? null,
        cancellationId: input.cancellationId ?? null,
        createdAt: this.deps.now(),
      })
      .onConflictDoNothing()
      .returning()
    if (!row) {
      throw new HttpError(
        409,
        'refund_in_progress',
        'A refund for this seat is already on its way.',
      )
    }
    await tx.insert(s.auditLog).values({
      actorId: input.requestedBy ?? null,
      action: 'seat.refund_requested',
      entityType: 'enrollment',
      entityId: input.enrollmentId,
      metadata: {
        seatRefundId: row.id,
        kind: input.kind,
        paymentId: input.paymentId,
        classId: input.classId,
      },
    })
    return row
  }

  /**
   * What the learner has had back of a payment, or is about to: the payment's ledger rows plus
   * the requested amounts of its unfinished seat refund rows. A discretionary refund may not take
   * the total past the price.
   */
  async hadBackCents(tx: Tx, paymentId: string): Promise<number> {
    const [ledger] = await tx
      .select({ total: sql<number>`coalesce(sum(${s.refunds.amountCents}), 0)::int` })
      .from(s.refunds)
      .where(eq(s.refunds.paymentId, paymentId))
    const [requested] = await tx
      .select({ total: sql<number>`coalesce(sum(${s.seatRefunds.requestedCents}), 0)::int` })
      .from(s.seatRefunds)
      .where(
        and(
          eq(s.seatRefunds.paymentId, paymentId),
          inArray(s.seatRefunds.status, [...UNFINISHED_SEAT_REFUND_STATUSES]),
        ),
      )
    return (ledger?.total ?? 0) + (requested?.total ?? 0)
  }

  /** The enrollment's unfinished row, if it has one. */
  async unfinishedFor(tx: Tx, enrollmentId: string): Promise<SeatRefundRow | null> {
    const [row] = await tx
      .select()
      .from(s.seatRefunds)
      .where(
        and(
          eq(s.seatRefunds.enrollmentId, enrollmentId),
          inArray(s.seatRefunds.status, [...UNFINISHED_SEAT_REFUND_STATUSES]),
        ),
      )
      .limit(1)
    return row ?? null
  }

  // ── the sender ───────────────────────────────────────────────────────────

  /**
   * Sends every row that is `waiting`, `pending` or `refund_sent`, oldest first, catching each
   * failure. A `failed` row is never taken. Called by `ReleaseService.run`, after the run has
   * filled in Stripe's fees. Returns how many rows it finished.
   */
  async sendUnfinished(now: Date): Promise<{ done: number }> {
    const rows = await this.deps.db
      .select({ id: s.seatRefunds.id })
      .from(s.seatRefunds)
      .where(inArray(s.seatRefunds.status, [...SENDABLE]))
      .orderBy(asc(s.seatRefunds.createdAt))
    let done = 0
    for (const { id } of rows) {
      try {
        if ((await this.send(id, now)) === 'done') done++
      } catch (error) {
        this.deps.log.error('seat refund could not be sent', {
          seatRefundId: id,
          error: messageOf(error),
        })
      }
    }
    return { done }
  }

  /**
   * Takes one row as far as it can go now ("How the job sends a row"). It claims the row with a
   * lock a second run skips, adds one to `attempts` when Stripe is to be called, and then works
   * from the row's status, saving it after each step.
   */
  async send(id: string, now: Date): Promise<SendOutcome> {
    await this.fillStripeFee(id)
    const claimed = await this.claim(id, now)
    if (claimed.outcome !== 'go') return claimed.outcome
    try {
      let row = claimed.row
      if (row.kind === 'dispute_lost') return await this.sendReversal(row, now)
      if (row.status === 'pending') {
        row = await this.sendRefund(row, now)
        if (row.status === 'done') return 'done'
      }
      return await this.finish(row, now)
    } catch (error) {
      return this.failStep(id, error)
    }
  }

  /**
   * A row waiting for Stripe's fee, or ready with none recorded, reads it from Stripe first; the
   * release job's own fee step (`PaymentsService.fillStripeFees`) does the same for every
   * payment, before the sender runs.
   */
  private async fillStripeFee(id: string): Promise<void> {
    const { db, payments } = this.deps
    const row = await db.query.seatRefunds.findFirst({
      where: { id },
      columns: { status: true },
      with: { payment: true },
    })
    const p = row?.payment
    if (!row || !p || p.stripeFeeActualCents !== null || !p.stripeChargeId) return
    if (row.status !== 'waiting' && row.status !== 'pending') return
    const fee = await payments.retrieveChargeFee(p.stripeChargeId).catch(() => null)
    if (!fee) return
    await db
      .update(s.payments)
      .set({
        stripeFeeActualCents: fee.stripeFeeCents,
        platformNetCents: p.applicationFeeCents - fee.stripeFeeCents,
        stripeBalanceTransactionId: p.stripeBalanceTransactionId ?? fee.balanceTransactionId,
        stripeTransferId: p.stripeTransferId ?? fee.transferId,
        stripeApplicationFeeId: p.stripeApplicationFeeId ?? fee.applicationFeeId,
      })
      .where(and(eq(s.payments.id, p.id), sql`${s.payments.stripeFeeActualCents} is null`))
  }

  /**
   * The short transaction that claims a row. A `waiting` row is checked against what it waits
   * for; a ready row whose payment has an open bank dispute, or no Stripe fee yet, waits. A row
   * that will call Stripe has its attempt counted. The emails of a row closed here follow the
   * commit.
   */
  private async claim(
    id: string,
    now: Date,
  ): Promise<
    | { outcome: 'go'; row: SeatRefundRow }
    | { outcome: Exclude<SendOutcome, 'done' | 'refund_sent' | 'pending'> }
  > {
    const after: { closed?: SeatRefundRow } = {}
    const result = await this.deps.db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const [row] = await tx
        .select()
        .from(s.seatRefunds)
        .where(eq(s.seatRefunds.id, id))
        .for('update', { skipLocked: true })
      if (!row || !(SENDABLE as readonly string[]).includes(row.status)) {
        return { outcome: 'skipped' as const }
      }
      const [payment] = await tx.select().from(s.payments).where(eq(s.payments.id, row.paymentId))
      if (!payment) throw new Error(`seat refund ${id} has no payment`)
      let current = row
      if (current.status === 'waiting') {
        const next = await this.resolveWait(tx, current, payment)
        if (next.status === 'waiting') return { outcome: 'waiting' as const }
        if (next.status === 'closed') {
          after.closed = await this.close_(tx, current, next.reason, null, now)
          return { outcome: 'closed' as const }
        }
        const [updated] = await tx
          .update(s.seatRefunds)
          .set({ status: 'pending', waitingFor: null, kind: next.kind })
          .where(eq(s.seatRefunds.id, id))
          .returning()
        if (!updated) throw new Error(`seat refund ${id} disappeared`)
        // A cancellation's full refund frees the seat when it is ready to send.
        if (updated.kind === 'teacher_cancelled' || updated.kind === 'elevate_cancelled') {
          await tx
            .update(s.enrollments)
            .set({ status: 'refunded' })
            .where(eq(s.enrollments.id, updated.enrollmentId))
        }
        current = updated
      }
      // A lost bank dispute's row is the reversal that follows the loss: it waits for neither.
      if (current.status === 'pending' && current.kind !== 'dispute_lost') {
        const waitFor: SeatRefundWaitingFor | null =
          payment.bankDisputeStatus === 'open' || payment.bankDisputeStatus === 'lost'
            ? 'bank_dispute'
            : payment.stripeFeeActualCents === null
              ? 'stripe_fee'
              : null
        if (waitFor) {
          await tx
            .update(s.seatRefunds)
            .set({ status: 'waiting', waitingFor: waitFor })
            .where(eq(s.seatRefunds.id, id))
          return { outcome: 'waiting' as const }
        }
      }
      const [claimedRow] = await tx
        .update(s.seatRefunds)
        .set({ attempts: current.attempts + 1, firstAttemptAt: current.firstAttemptAt ?? now })
        .where(eq(s.seatRefunds.id, id))
        .returning()
      if (!claimedRow) throw new Error(`seat refund ${id} disappeared`)
      return { outcome: 'go' as const, row: claimedRow }
    })
    if (after.closed) await this.closedNotices(after.closed)
    return result
  }

  /** What a `waiting` row may do now. */
  private async resolveWait(
    tx: Tx,
    row: SeatRefundRow,
    payment: typeof s.payments.$inferSelect,
  ): Promise<
    | { status: 'waiting' }
    | { status: 'pending'; kind: SeatRefundKind }
    | { status: 'closed'; reason: SeatRefundClosedReason }
  > {
    switch (row.waitingFor) {
      case 'stripe_fee':
        return payment.stripeFeeActualCents === null
          ? { status: 'waiting' }
          : { status: 'pending', kind: row.kind }
      case 'bank_dispute':
        if (payment.bankDisputeStatus === 'open') return { status: 'waiting' }
        if (payment.bankDisputeStatus === 'lost')
          return { status: 'closed', reason: 'bank_returned' }
        return { status: 'pending', kind: row.kind }
      case 'manual_mark': {
        const attendance =
          (await new AttendanceService(this.deps).moneyAttendanceByEnrollment(tx, row.classId)).get(
            row.enrollmentId,
          ) ?? NO_ATTENDANCE
        if (attendance.openMarkUntil !== null) return { status: 'waiting' }
        if (!attendance.counted || row.kind !== 'teacher_cancelled') {
          return { status: 'pending', kind: row.kind }
        }
        // The mark settled: the learner is counted as attended, and is owed only the share of
        // the blocks that were not taught (G12).
        const [cancellation] = row.cancellationId
          ? await tx
              .select({ blocksUntaught: s.classCancellations.blocksUntaught })
              .from(s.classCancellations)
              .where(eq(s.classCancellations.id, row.cancellationId))
          : []
        return (cancellation?.blocksUntaught ?? 0) > 0
          ? { status: 'pending', kind: 'teacher_cancelled_part' }
          : { status: 'closed', reason: 'mark_settled' }
      }
      default:
        return { status: 'pending', kind: row.kind }
    }
  }

  /**
   * Step 2: works out and stores R and X once, then refunds R with the transfer reversed and
   * Elevate's fee kept. Past `IDEMPOTENCY_TRUST_MS` from the first attempt, Stripe's refunds of
   * the payment are searched for the row's label before a new one is sent.
   */
  private async sendRefund(row: SeatRefundRow, now: Date): Promise<SeatRefundRow> {
    const { db, payments } = this.deps
    const p = await db.query.payments.findFirst({
      where: { id: row.paymentId },
      with: { refunds: true },
    })
    if (!p) throw new Error(`seat refund ${row.id} has no payment`)
    let r = row.learnerRefundCents
    let x = row.feeRefundToProfileCents
    if (r === null || x === null) {
      const cancellation = row.cancellationId
        ? await db.query.classCancellations.findFirst({ where: { id: row.cancellationId } })
        : null
      const refundedCents = p.refunds.reduce((sum, ledger) => sum + ledger.amountCents, 0)
      // X already returned, read from the profile's share so that a refund from outside (whose
      // fee refund Stripe made in proportion) counts as `profileShareAfterRefunds` counts it.
      const feeRefundedCents =
        profileShareAfterRefunds({
          teacherNetCents: p.teacherNetCents,
          amountCents: p.amountCents,
          applicationFeeCents: p.applicationFeeCents,
          refunds: p.refunds,
          bankDisputeLost: false,
        }) -
        p.teacherNetCents +
        refundedCents
      const amounts = seatRefund({
        kind: row.kind,
        amountCents: p.amountCents,
        applicationFeeCents: p.applicationFeeCents,
        stripeFeeCents: p.stripeFeeActualCents ?? 0,
        refundedCents,
        feeRefundedCents,
        requestedCents: row.requestedCents ?? undefined,
        blocksUntaught: cancellation?.blocksUntaught,
        blocksTotal: cancellation?.blocksTotal,
      })
      r = amounts.learnerRefundCents
      // Nothing left to return means no ledger row to carry a fee refund.
      x = r === 0 ? 0 : amounts.feeRefundToProfileCents
      await db
        .update(s.seatRefunds)
        .set({ learnerRefundCents: r, feeRefundToProfileCents: x })
        .where(eq(s.seatRefunds.id, row.id))
    }
    if (r === 0) {
      // Nothing to send: the payment has been returned in full already.
      const done = await db.transaction(async (raw) => {
        const tx = raw as unknown as Tx
        return this.markDone(tx, row, now)
      })
      return done
    }
    if (!p.stripePaymentIntentId) throw new RangeError(`payment ${p.id} has no payment intent`)
    let refundId: string | null = null
    if (this.stale(row, now) && p.stripeChargeId) {
      const found = (await payments.listRefunds(p.stripeChargeId)).find(
        (refund) =>
          refund.metadata[SEAT_REFUND_LABEL] === row.id &&
          refund.status !== 'failed' &&
          refund.status !== 'canceled',
      )
      refundId = found?.refundId ?? null
    }
    if (!refundId) {
      const refund = await payments.createRefund({
        paymentIntentId: p.stripePaymentIntentId,
        amountCents: r,
        refundApplicationFee: false,
        metadata: { [SEAT_REFUND_LABEL]: row.id },
        idempotencyKey: this.key('seat-refund', row),
      })
      refundId = refund.refundId
    }
    const [sent] = await db
      .update(s.seatRefunds)
      .set({ stripeRefundId: refundId, status: 'refund_sent', error: null })
      .where(eq(s.seatRefunds.id, row.id))
      .returning()
    if (!sent) throw new Error(`seat refund ${row.id} disappeared`)
    return sent
  }

  /**
   * A lost bank dispute (entry 5.6): the bank has returned the learner's money, so only the
   * profile's share is taken back. One reversal of what is left of the transfer, with Elevate's
   * fee returned in proportion, under the row's label and the key `seat-reversal:<id>`; past
   * `IDEMPOTENCY_TRUST_MS` the transfer's reversals are searched for the label first. Then one
   * transaction stores the reversal and the fee Stripe returned with it, writes a
   * `bank_dispute_after_payout` adjustment of minus what a payout paid for the payment, and marks
   * the row `done`. No ledger row is written and the payment's refunded total is unchanged.
   */
  private async sendReversal(row: SeatRefundRow, now: Date): Promise<SendOutcome> {
    const { db, payments } = this.deps
    const p = await db.query.payments.findFirst({
      where: { id: row.paymentId },
      with: { refunds: true },
    })
    if (!p) throw new Error(`seat refund ${row.id} has no payment`)
    const refundedCents = p.refunds.reduce((sum, ledger) => sum + ledger.amountCents, 0)
    // Elevate's fee already returned, counted as the profile's share counts it.
    const feeBefore = Math.max(
      0,
      profileShareAfterRefunds({
        teacherNetCents: p.teacherNetCents,
        amountCents: p.amountCents,
        applicationFeeCents: p.applicationFeeCents,
        refunds: p.refunds,
        bankDisputeLost: false,
      }) -
        p.teacherNetCents +
        refundedCents,
    )
    const { reversalCents = 0 } = seatRefund({
      kind: 'dispute_lost',
      amountCents: p.amountCents,
      applicationFeeCents: p.applicationFeeCents,
      stripeFeeCents: p.stripeFeeActualCents ?? 0,
      refundedCents,
      feeRefundedCents: feeBefore,
    })
    let reversalId = row.stripeReversalId
    let feeReturned = row.feeRefundToProfileCents
    if (!reversalId && reversalCents > 0) {
      // Filled a few seconds after the payment; until then the next run tries again.
      if (!p.stripeTransferId) throw new Error(`payment ${p.id} has no transfer yet`)
      if (this.stale(row, now)) {
        const found = (await payments.listTransferReversals(p.stripeTransferId)).find(
          (reversal) => reversal.metadata[SEAT_REFUND_LABEL] === row.id,
        )
        reversalId = found?.reversalId ?? null
      }
      if (!reversalId) {
        const reversal = await payments.reverseTransfer({
          transferId: p.stripeTransferId,
          amountCents: reversalCents,
          refundApplicationFee: true,
          metadata: { [SEAT_REFUND_LABEL]: row.id },
          idempotencyKey: this.key('seat-reversal', row),
        })
        reversalId = reversal.reversalId
        // Stripe answers the fee returned on the payment in all; this reversal's part is the
        // rest of it.
        feeReturned =
          reversal.applicationFeeRefundedCents === null
            ? null
            : Math.max(0, reversal.applicationFeeRefundedCents - feeBefore)
      }
    }
    const done = await db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const [stored] = await tx
        .update(s.seatRefunds)
        .set({
          stripeReversalId: reversalId,
          learnerRefundCents: 0,
          feeRefundToProfileCents: feeReturned,
          error: null,
        })
        .where(eq(s.seatRefunds.id, row.id))
        .returning()
      if (!stored) throw new Error(`seat refund ${row.id} disappeared`)
      const [paid] = await tx
        .select({ payoutId: s.payments.payoutId, paidOutCents: s.payments.paidOutCents })
        .from(s.payments)
        .where(eq(s.payments.id, p.id))
      if (paid?.payoutId && (paid.paidOutCents ?? 0) > 0) {
        await tx
          .insert(s.payoutAdjustments)
          .values({
            payoutAccountId: p.payoutAccountId,
            kind: 'bank_dispute_after_payout',
            amountCents: -(paid.paidOutCents ?? 0),
            paymentId: p.id,
            createdAt: now,
          })
          .onConflictDoNothing()
      }
      return this.markDone(tx, stored, now)
    })
    await this.doneNotices({ ...done, learnerRefundCents: reversalCents - (feeReturned ?? 0) })
    return 'done'
  }

  /**
   * Step 3 and 4: once Stripe reports the refund succeeded, returns X of Elevate's fee to the
   * profile, then in one transaction records the refund and marks the row `done`. The emails
   * follow the commit.
   */
  private async finish(row: SeatRefundRow, now: Date): Promise<SendOutcome> {
    const { db, payments } = this.deps
    if (!row.stripeRefundId) throw new Error(`seat refund ${row.id} has no refund`)
    const status = await payments.retrieveRefund(row.stripeRefundId)
    if (status === 'pending') return 'refund_sent'
    if (status === 'failed' || status === 'canceled') {
      // Stripe has not paid the learner; a Support admin retries the row or refunds them another way.
      await db
        .update(s.seatRefunds)
        .set({ status: 'failed', error: 'refund_failed' })
        .where(eq(s.seatRefunds.id, row.id))
      return 'failed'
    }
    const x = row.feeRefundToProfileCents ?? 0
    let current = row
    if (x > 0 && !row.stripeFeeRefundId) {
      const p = await db.query.payments.findFirst({ where: { id: row.paymentId } })
      const applicationFeeId = p?.stripeApplicationFeeId
      if (!applicationFeeId) throw new Error(`payment ${row.paymentId} has no application fee`)
      let feeRefundId: string | null = null
      if (this.stale(row, now)) {
        const found = (await payments.listApplicationFeeRefunds(applicationFeeId)).find(
          (refund) => refund.metadata[SEAT_REFUND_LABEL] === row.id,
        )
        feeRefundId = found?.feeRefundId ?? null
      }
      if (!feeRefundId) {
        feeRefundId = (
          await payments.refundApplicationFee({
            applicationFeeId,
            amountCents: x,
            metadata: { [SEAT_REFUND_LABEL]: row.id },
            idempotencyKey: this.key('seat-fee-refund', row),
          })
        ).feeRefundId
      }
      const [stored] = await db
        .update(s.seatRefunds)
        .set({ stripeFeeRefundId: feeRefundId, error: null })
        .where(eq(s.seatRefunds.id, row.id))
        .returning()
      if (stored) current = stored
    }
    const done = await db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      await new TransactionsService(this.deps).applyRefund({
        tx,
        paymentId: current.paymentId,
        stripeRefundId: current.stripeRefundId as string,
        amountCents: current.learnerRefundCents ?? 0,
        reason: current.reason,
        requestedBy: current.requestedBy,
        applicationFeeRefundedCents: x,
        seatRefundId: current.id,
        // The enrollment was set when the row was requested, or when it became ready.
        enrollment: 'unchanged',
      })
      return this.markDone(tx, current, now)
    })
    await this.doneNotices(done)
    return 'done'
  }

  /** In the caller's transaction: the row `done`, its audit entry, and its cancellation's end. */
  private async markDone(tx: Tx, row: SeatRefundRow, now: Date): Promise<SeatRefundRow> {
    const [done] = await tx
      .update(s.seatRefunds)
      .set({ status: 'done', completedAt: now, error: null })
      .where(eq(s.seatRefunds.id, row.id))
      .returning()
    if (!done) throw new Error(`seat refund ${row.id} disappeared`)
    await tx.insert(s.auditLog).values({
      actorId: null,
      action: 'seat.refund_done',
      entityType: 'enrollment',
      entityId: row.enrollmentId,
      metadata: {
        seatRefundId: row.id,
        kind: row.kind,
        learnerRefundCents: done.learnerRefundCents,
        feeRefundToProfileCents: done.feeRefundToProfileCents,
        stripeRefundId: done.stripeRefundId,
      },
    })
    await this.completeCancellation(tx, done, now)
    return done
  }

  /** In the caller's transaction: the row `closed` with its reason, and its audit entry. */
  private async close_(
    tx: Tx,
    row: SeatRefundRow,
    reason: SeatRefundClosedReason,
    actorId: string | null,
    now: Date,
    note?: string,
  ): Promise<SeatRefundRow> {
    const [closed] = await tx
      .update(s.seatRefunds)
      .set({ status: 'closed', closedReason: reason, waitingFor: null, completedAt: now })
      .where(eq(s.seatRefunds.id, row.id))
      .returning()
    if (!closed) throw new Error(`seat refund ${row.id} disappeared`)
    await tx.insert(s.auditLog).values({
      actorId,
      action: 'seat.refund_closed',
      entityType: 'enrollment',
      entityId: row.enrollmentId,
      metadata: { seatRefundId: row.id, kind: row.kind, closedReason: reason, note: note ?? null },
    })
    await this.completeCancellation(tx, closed, now)
    return closed
  }

  /** A cancellation is complete once each of its rows is `done` or `closed`. */
  private async completeCancellation(tx: Tx, row: SeatRefundRow, now: Date): Promise<void> {
    if (!row.cancellationId) return
    const [left] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(s.seatRefunds)
      .where(
        and(
          eq(s.seatRefunds.cancellationId, row.cancellationId),
          inArray(s.seatRefunds.status, [...UNFINISHED_SEAT_REFUND_STATUSES]),
        ),
      )
    if ((left?.n ?? 0) > 0) return
    await tx
      .update(s.classCancellations)
      .set({ completedAt: now })
      .where(
        and(
          eq(s.classCancellations.id, row.cancellationId),
          sql`${s.classCancellations.completedAt} is null`,
        ),
      )
  }

  /**
   * A step threw. A charge with a bank dispute makes a ready row wait for it; a failure the next
   * run may not meet records the error and leaves the status, until the 96th attempt; anything
   * else Stripe refused makes the row `failed`, which the job does not try again.
   */
  private async failStep(id: string, error: unknown): Promise<SendOutcome> {
    const { db, log } = this.deps
    const row = await db.query.seatRefunds.findFirst({ where: { id } })
    if (!row) throw error
    const message = messageOf(error).slice(0, 500)
    log.warn('seat refund step failed', { seatRefundId: id, status: row.status, error: message })
    const disputed = error instanceof Stripe.errors.StripeError && error.code === 'charge_disputed'
    if (disputed && row.status === 'pending') {
      await db
        .update(s.seatRefunds)
        .set({ status: 'waiting', waitingFor: 'bank_dispute', error: message })
        .where(eq(s.seatRefunds.id, id))
      return 'waiting'
    }
    if (retryable(error) && row.attempts < REFUND_MAX_ATTEMPTS) {
      await db.update(s.seatRefunds).set({ error: message }).where(eq(s.seatRefunds.id, id))
      return row.status as SendOutcome
    }
    await db
      .update(s.seatRefunds)
      .set({ status: 'failed', error: message })
      .where(eq(s.seatRefunds.id, id))
    return 'failed'
  }

  /** Whether Stripe may have forgotten the row's idempotency keys. */
  private stale(row: SeatRefundRow, now: Date): boolean {
    return (
      row.firstAttemptAt !== null &&
      now.getTime() - row.firstAttemptAt.getTime() > IDEMPOTENCY_TRUST_MS
    )
  }

  /**
   * The idempotency key of a step. It names the row and its first attempt, so the repeats of one
   * attempt share it, and a Support retry after Stripe refused a step (which Stripe would answer
   * again under the same key for a day) makes a new one.
   */
  private key(
    step: 'seat-refund' | 'seat-fee-refund' | 'seat-reversal',
    row: SeatRefundRow,
  ): string {
    return `${step}:${row.id}:${row.firstAttemptAt?.getTime() ?? 0}`
  }

  /**
   * For Stripe's notice of a lost bank dispute: closes each unfinished row of the payment, other
   * than its `dispute_lost` row, as `bank_returned`, in the caller's transaction. The bank
   * returned the learner's money, so nothing is left to send. Returns how many it closed.
   */
  async closeForBankLoss(tx: Tx, paymentId: string, now: Date): Promise<number> {
    const rows = await tx
      .select()
      .from(s.seatRefunds)
      .where(
        and(
          eq(s.seatRefunds.paymentId, paymentId),
          inArray(s.seatRefunds.status, [...UNFINISHED_SEAT_REFUND_STATUSES]),
          ne(s.seatRefunds.kind, 'dispute_lost'),
        ),
      )
      .for('update')
    for (const row of rows) await this.close_(tx, row, 'bank_returned', null, now)
    return rows.length
  }

  // ── emails ───────────────────────────────────────────────────────────────

  /** The row's payment, learner, class, course and profile owner, for its emails. */
  private async context(row: SeatRefundRow) {
    return this.deps.db.query.seatRefunds.findFirst({
      where: { id: row.id },
      with: {
        class: { columns: { name: true, timeZone: true } },
        payment: {
          with: {
            user: { columns: { email: true, locale: true } },
            course: { columns: { title: true, slug: true } },
            profile: { with: { owner: { columns: { email: true } } } },
          },
        },
      },
    })
  }

  /**
   * A done row tells the learner, in their language, and the profile's owner, in English. For a
   * lost bank dispute only the owner is told, and `learnerRefundCents` carries the share taken
   * back.
   */
  private async doneNotices(row: SeatRefundRow): Promise<void> {
    const ctx = await this.context(row)
    if (!ctx) return
    const { env, mailer } = this.deps
    const p = ctx.payment
    if (row.kind === 'dispute_lost') {
      const className = ctx.class.name
      await mailer.send(
        simpleEmail({
          to: p.profile.owner.email,
          title: `A learner won a bank dispute in "${className}"`,
          paragraphs: [
            `A learner in "${className}", a class of "${p.course.title}" by ${p.profile.displayName}, disputed their payment with their bank, and the bank decided for them. The bank returned the learner's money, and your share of the sale, ${formatSgd(row.learnerRefundCents ?? 0)}, was taken back from your Stripe balance. Elevate bears Stripe's fee and the dispute fee.`,
            'If you had already been paid for this sale, the amount is taken from your next payouts.',
          ],
          cta: { href: `${env.TEACH_URL}/p/${p.profileId}/earnings`, label: 'View earnings' },
        }),
      )
      return
    }
    const lang = p.user.locale ?? 'en'
    const amountCents = row.learnerRefundCents ?? 0
    const base = { to: p.user.email, locale: lang, learnerUrl: env.LEARNER_URL }
    const className = ctx.class.name
    let learner: MailMessage | null = null
    switch (row.kind) {
      case 'seat_lost':
        learner = seatLostEmail({ ...base, className, courseSlug: p.course.slug, amountCents })
        break
      case 'teacher_cancelled':
      case 'teacher_cancelled_part':
      case 'elevate_cancelled':
        learner = classCancelledEmail({
          ...base,
          enrollmentId: row.enrollmentId,
          className,
          amountCents,
          part: row.kind === 'teacher_cancelled_part',
        })
        break
      case 'learner_withdrew':
      case 'changed_withdrew':
        learner = seatWithdrawnEmail({
          ...base,
          courseSlug: p.course.slug,
          className,
          amountCents,
          full: row.kind === 'changed_withdrew',
        })
        break
      case 'discretionary':
        learner = seatRefundedEmail({
          ...base,
          enrollmentId: row.enrollmentId,
          className,
          amountCents,
          reason: row.reason,
        })
        break
    }
    if (learner) await mailer.send(learner)
    const x = row.feeRefundToProfileCents ?? 0
    await mailer.send(
      simpleEmail({
        to: p.profile.owner.email,
        title: `A refund for "${className}" was made`,
        paragraphs: [
          `${formatSgd(amountCents)} was returned to a learner in "${className}", a class of "${p.course.title}" by ${p.profile.displayName}, because ${KIND_FOR_OWNER[row.kind]}.`,
          ...(row.reason ? [`Reason: ${row.reason}`] : []),
          ...(x > 0
            ? [`${formatSgd(x)} of Elevate's fee on the sale was returned to you with it.`]
            : []),
          'Your earnings in Elevate Teach show the sale after this refund.',
        ],
        cta: { href: `${env.TEACH_URL}/p/${p.profileId}/earnings`, label: 'View earnings' },
      }),
    )
  }

  /** A row closed because the learner's mark settled: no refund is due, and they are told why. */
  private async closedNotices(row: SeatRefundRow): Promise<void> {
    if (row.closedReason !== 'mark_settled') return
    const ctx = await this.context(row)
    if (!ctx) return
    await this.deps.mailer.send(
      classCancelledAttendedEmail({
        to: ctx.payment.user.email,
        locale: ctx.payment.user.locale ?? 'en',
        learnerUrl: this.deps.env.LEARNER_URL,
        enrollmentId: row.enrollmentId,
        className: ctx.class.name,
      }),
    )
  }

  // ── Support ──────────────────────────────────────────────────────────────

  /**
   * `POST /support/seat-refunds/:id`: a Support admin retries or closes a `failed` row. A retry
   * starts the attempts again from where the row stopped: `pending`, or `refund_sent` when the
   * learner's refund was made and only Elevate's fee refund failed. A row whose refund Stripe
   * failed is not retried: the transfer was reversed with it, so a second refund would take the
   * profile's share back twice. Support refunds the learner another way and closes the row.
   * Closing ends a row with the reason `support`.
   */
  async act(user: SessionUser, id: string, input: RefundRowAction): Promise<SeatRefundView> {
    return input.action === 'retry'
      ? this.retry(user, id, input.reason)
      : this.close(user, id, input.reason)
  }

  async retry(user: SessionUser, id: string, reason: string): Promise<SeatRefundView> {
    const { db } = this.deps
    const row = await this.failedRow(id)
    if (row.error === 'refund_failed') {
      throw errors.conflict(
        'refund_failed_at_stripe',
        'Stripe failed this refund after taking the share back from the profile. Refund the learner another way, then close the row.',
      )
    }
    const updated = await db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const [retried] = await tx
        .update(s.seatRefunds)
        .set({
          status: row.stripeRefundId ? 'refund_sent' : 'pending',
          attempts: 0,
          firstAttemptAt: null,
          error: null,
        })
        .where(and(eq(s.seatRefunds.id, id), eq(s.seatRefunds.status, 'failed')))
        .returning()
      if (!retried) throw this.notFailed()
      await tx.insert(s.auditLog).values({
        actorId: user.id,
        action: 'seat.refund_retried',
        entityType: 'enrollment',
        entityId: row.enrollmentId,
        metadata: { seatRefundId: id, kind: row.kind, reason, error: row.error },
      })
      return retried
    })
    return seatRefundView(updated)
  }

  async close(user: SessionUser, id: string, reason: string): Promise<SeatRefundView> {
    const row = await this.failedRow(id)
    const closed = await this.deps.db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const [locked] = await tx
        .select()
        .from(s.seatRefunds)
        .where(eq(s.seatRefunds.id, id))
        .for('update')
      if (locked?.status !== 'failed') throw this.notFailed()
      return this.close_(tx, row, 'support', user.id, this.deps.now(), reason)
    })
    return seatRefundView(closed)
  }

  private async failedRow(id: string): Promise<SeatRefundRow> {
    const row = await this.deps.db.query.seatRefunds.findFirst({ where: { id } })
    if (!row) throw errors.notFound('Seat refund')
    if (row.status !== 'failed') throw this.notFailed()
    return row
  }

  private notFailed() {
    return errors.conflict(
      'refund_not_failed',
      'Only a failed seat refund can be retried or closed',
    )
  }
}
