import {
  type ClearReview,
  type Correction,
  choosePayoutItems,
  formatSgd,
  type HeldClassView,
  IDEMPOTENCY_TRUST_MS,
  isDue,
  isPayTime,
  MAX_HELD_MS,
  MIN_PAYOUT_CENTS,
  type PaymentReleaseReason,
  type PayoutAdjustmentKind,
  type PayoutOutcome,
  type ProfilePayoutView,
  payDate,
  payoutLimitCents,
  releaseDueAt,
  type SupportPayoutsOverview,
  UNFINISHED_SEAT_REFUND_STATUSES,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, desc, eq, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors } from '../lib/errors'
import { paymentShare } from '../lib/share'
import type { ProfileActor, SessionUser } from '../middleware/auth'
import { PAYOUT_LABEL } from '../providers/payments/types'
import { AttendanceService } from './attendance.service'
import { retryable, type Tx } from './seat-refunds.service'

const HOUR_MS = 60 * 60 * 1000
/** Support's payouts page warns when no run has finished for this long (the alarm's window). */
const RUN_STALE_MS = 30 * 60 * 1000
/** How many payouts Teach's earnings page lists. */
const RECENT_PAYOUTS = 10

type PayoutRow = typeof s.payouts.$inferSelect

/** One thing a payout can pay: a payment, by its share after refunds, or an adjustment. */
export type PayableItem = {
  kind: 'payment' | 'adjustment'
  id: string
  amountCents: number
  /** The payment's time, or the adjustment's: the order a short payout takes them in. */
  paidAt: Date
}

const UNFINISHED = [...UNFINISHED_SEAT_REFUND_STATUSES]

/** What Teach shows for an adjustment a payout paid. */
const ADJUSTMENT_LABEL: Record<PayoutAdjustmentKind, string> = {
  opening_available: 'Balance when class sales began (available then)',
  opening_pending: 'Balance when class sales began (pending then)',
  refund_after_payout: 'A refund after an earlier payout',
  bank_dispute_after_payout: 'A bank dispute lost after an earlier payout',
  correction: 'A correction by Elevate',
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * Held class money and payouts (docs/designs/scheduled-classes-selling.md, "Held money and the
 * release job"). A profile that has opted in is on manual payouts: Stripe pays its bank only what
 * a run asks for. A run marks what is released (step 5) and pays each profile at most once a
 * Singapore day (step 6), within three bounds: the available balance, the balance less what is
 * held, and the payable items the database names. Money in the balance that no row names is
 * never chosen; it is recorded as unnamed.
 *
 * A payout's row and the marks on what it pays are written in one transaction before Stripe is
 * called, so a run that stops after the call is followed by one that finds the same payout.
 */
export class PayoutsService {
  constructor(private readonly deps: Deps) {}

  // ── held and payable ─────────────────────────────────────────────────────

  /** The held total: over class payments not released, the share after refunds above zero. */
  async heldCents(tx: Tx, payoutAccountId: string): Promise<number> {
    const rows = await tx.query.payments.findMany({
      where: { payoutAccountId, classId: { isNotNull: true }, releasedAt: { isNull: true } },
      with: { refunds: { columns: { amountCents: true, applicationFeeRefundedCents: true } } },
    })
    return rows.reduce((sum, p) => sum + Math.max(0, paymentShare(p, p.refunds)), 0)
  }

  /**
   * What a payout may pay: each adjustment no payout has marked; and each payment no payout has
   * marked, made since the opening amounts were read, with no unfinished seat refund, that is
   * self-paced or a class payment marked released, at its share after refunds. A class payment
   * not yet released counts only when its share is below zero: a debt counts at once.
   */
  async payableItems(tx: Tx, payoutAccountId: string): Promise<PayableItem[]> {
    const [account] = await tx
      .select({ manualSince: s.payoutAccounts.manualSince })
      .from(s.payoutAccounts)
      .where(eq(s.payoutAccounts.id, payoutAccountId))
    if (!account?.manualSince) return []
    const adjustments = await tx.query.payoutAdjustments.findMany({
      where: { payoutAccountId, payoutId: { isNull: true } },
    })
    const payments = await tx.query.payments.findMany({
      where: { payoutAccountId, payoutId: { isNull: true }, paidAt: { gte: account.manualSince } },
      with: {
        refunds: { columns: { amountCents: true, applicationFeeRefundedCents: true } },
        seatRefunds: { columns: { status: true } },
      },
    })
    const items: PayableItem[] = adjustments.map((a) => ({
      kind: 'adjustment',
      id: a.id,
      amountCents: a.amountCents,
      paidAt: a.createdAt,
    }))
    for (const p of payments) {
      if (p.seatRefunds.some((r) => (UNFINISHED as string[]).includes(r.status))) continue
      const share = paymentShare(p, p.refunds)
      const released = p.classId === null || p.releasedAt !== null
      if (released || share < 0)
        items.push({ kind: 'payment', id: p.id, amountCents: share, paidAt: p.paidAt })
    }
    return items
  }

  // ── step 5: what is released ─────────────────────────────────────────────

  /**
   * Step 5 of a run. For each account on manual payouts, claimed with a lock a second run skips,
   * in one transaction: a due class with nobody counted as attended goes under review, unless a
   * Support admin cleared it or it was cancelled (a cancelled class's unattended seats were all
   * refunded in full); every other due class is released with `due`, or `support` once cleared;
   * the payments of every released class that have no open bank dispute and no unfinished seat
   * refund are released with the class's reason; and a class payment `MAX_HELD_MS` old is
   * released with `day_limit` whatever else holds it.
   */
  async markReleased(
    now: Date,
    runId: string,
  ): Promise<{ classesReleased: number; paymentsReleased: number }> {
    const { db, log } = this.deps
    const accounts = await db
      .select({ id: s.payoutAccounts.id })
      .from(s.payoutAccounts)
      .where(eq(s.payoutAccounts.payoutMode, 'manual'))
    let classesReleased = 0
    let paymentsReleased = 0
    for (const { id } of accounts) {
      try {
        const counts = await db.transaction((raw) =>
          this.releaseForAccount(raw as unknown as Tx, id, now, runId),
        )
        classesReleased += counts.classesReleased
        paymentsReleased += counts.paymentsReleased
      } catch (error) {
        log.error('could not mark class money released', {
          payoutAccountId: id,
          error: messageOf(error),
        })
      }
    }
    return { classesReleased, paymentsReleased }
  }

  private async releaseForAccount(
    tx: Tx,
    payoutAccountId: string,
    now: Date,
    runId: string,
  ): Promise<{ classesReleased: number; paymentsReleased: number }> {
    const counts = { classesReleased: 0, paymentsReleased: 0 }
    const [claimed] = await tx
      .select({ id: s.payoutAccounts.id })
      .from(s.payoutAccounts)
      .where(
        and(eq(s.payoutAccounts.id, payoutAccountId), eq(s.payoutAccounts.payoutMode, 'manual')),
      )
      .for('update', { skipLocked: true })
    if (!claimed) return counts

    // The classes this account has money in that are not released. A class that sold nothing
    // holds nothing, and is never put under review.
    const classIds = await tx
      .selectDistinct({ id: s.classes.id })
      .from(s.payments)
      .innerJoin(s.classes, eq(s.classes.id, s.payments.classId))
      .where(and(eq(s.payments.payoutAccountId, payoutAccountId), isNull(s.classes.releasedAt)))
    const attendance = new AttendanceService(this.deps)
    for (const { id } of classIds) {
      const row = await tx.query.classes.findFirst({
        where: { id },
        with: { blocks: { columns: { endsAt: true } }, cancellation: true },
      })
      if (!row) continue
      const byEnrollment = [...(await attendance.moneyAttendanceByEnrollment(tx, id)).values()]
      const openMarkUntil = byEnrollment.reduce<Date | null>(
        (latest, a) =>
          a.openMarkUntil && (!latest || a.openMarkUntil > latest) ? a.openMarkUntil : latest,
        null,
      )
      const due = isDue({
        lastBlockEndsAt: lastEnd(row.blocks),
        cancelledAt: row.cancelledAt,
        openMarkUntil,
        cancellationComplete: row.cancellation?.completedAt != null,
        now,
      })
      if (!due) continue
      const counted = byEnrollment.some((a) => a.counted)
      if (!counted && row.cancelledAt === null && row.reviewClearedAt === null) {
        if (row.reviewNeededAt === null) {
          await tx.update(s.classes).set({ reviewNeededAt: now }).where(eq(s.classes.id, id))
        }
        continue
      }
      const [released] = await tx
        .update(s.classes)
        .set({
          releasedAt: now,
          releasedRunId: runId,
          releaseReason: row.reviewClearedAt ? 'support' : 'due',
        })
        .where(and(eq(s.classes.id, id), isNull(s.classes.releasedAt)))
        .returning({ id: s.classes.id })
      if (released) counts.classesReleased++
    }

    // The payments of released classes, whenever the class was released.
    const ready = await tx
      .select({ id: s.payments.id, reason: s.classes.releaseReason })
      .from(s.payments)
      .innerJoin(s.classes, eq(s.classes.id, s.payments.classId))
      .where(
        and(
          eq(s.payments.payoutAccountId, payoutAccountId),
          isNull(s.payments.releasedAt),
          isNotNull(s.classes.releasedAt),
          sql`${s.payments.bankDisputeStatus} is distinct from 'open'`,
          sql`not exists (select 1 from ${s.seatRefunds} where ${s.seatRefunds.paymentId} = ${s.payments.id} and ${s.seatRefunds.status} in ('waiting', 'pending', 'refund_sent', 'failed'))`,
        ),
      )
    for (const reason of ['due', 'support'] as const satisfies PaymentReleaseReason[]) {
      const ids = ready.filter((r) => (r.reason ?? 'due') === reason).map((r) => r.id)
      if (!ids.length) continue
      const done = await tx
        .update(s.payments)
        .set({ releasedAt: now, releasedRunId: runId, releaseReason: reason })
        .where(and(inArray(s.payments.id, ids), isNull(s.payments.releasedAt)))
        .returning({ id: s.payments.id })
      counts.paymentsReleased += done.length
    }

    // The day limit: Stripe keeps a payment's money for 90 days, so none is held past 85.
    const limited = await tx
      .update(s.payments)
      .set({ releasedAt: now, releasedRunId: runId, releaseReason: 'day_limit' })
      .where(
        and(
          eq(s.payments.payoutAccountId, payoutAccountId),
          isNotNull(s.payments.classId),
          isNull(s.payments.releasedAt),
          lte(s.payments.paidAt, new Date(now.getTime() - MAX_HELD_MS)),
        ),
      )
      .returning({ id: s.payments.id })
    counts.paymentsReleased += limited.length
    return counts
  }

  // ── step 6: paying ───────────────────────────────────────────────────────

  /**
   * Step 6 of a run. In the first run at or after 10:00 Singapore time, for each account on manual
   * payouts with no `payouts` row for the day: one transaction claims the account, reads its
   * balance, works out the held total, the limit and the items, and writes the row; for S$1 or
   * more it is `paid` and `sending` and marks each item it pays. Then Stripe is asked for the
   * payout. Returns how many payouts it wrote with the outcome `paid`.
   */
  async payDue(now: Date, runId: string): Promise<{ payoutsCreated: number }> {
    const { db, log } = this.deps
    if (!isPayTime(now)) return { payoutsCreated: 0 }
    const day = payDate(now)
    const accounts = await db
      .select({ id: s.payoutAccounts.id })
      .from(s.payoutAccounts)
      .where(
        and(
          eq(s.payoutAccounts.payoutMode, 'manual'),
          isNotNull(s.payoutAccounts.stripeAccountId),
          sql`not exists (select 1 from ${s.payouts} where ${s.payouts.payoutAccountId} = ${s.payoutAccounts.id} and ${s.payouts.payDate} = ${day})`,
        ),
      )
    let payoutsCreated = 0
    for (const { id } of accounts) {
      try {
        const row = await this.writePayout(id, day, now, runId)
        if (row?.outcome !== 'paid') continue
        payoutsCreated++
        await this.send(row)
      } catch (error) {
        log.error('could not pay a profile', { payoutAccountId: id, error: messageOf(error) })
      }
    }
    return { payoutsCreated }
  }

  /** Step 6.1 to 6.6: the `payouts` row and the marks, in one transaction. */
  private async writePayout(
    payoutAccountId: string,
    day: string,
    now: Date,
    runId: string,
  ): Promise<PayoutRow | null> {
    const { db, payments } = this.deps
    return db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const [account] = await tx
        .select()
        .from(s.payoutAccounts)
        .where(
          and(eq(s.payoutAccounts.id, payoutAccountId), eq(s.payoutAccounts.payoutMode, 'manual')),
        )
        .for('update', { skipLocked: true })
      if (!account?.stripeAccountId) return null
      const [already] = await tx
        .select({ id: s.payouts.id })
        .from(s.payouts)
        .where(and(eq(s.payouts.payoutAccountId, account.id), eq(s.payouts.payDate, day)))
      if (already) return null
      const balance = await payments.retrieveBalance(account.stripeAccountId)
      const heldCents = await this.heldCents(tx, account.id)
      const limitCents = payoutLimitCents({ ...balance, heldCents })
      const choice = choosePayoutItems(await this.payableItems(tx, account.id), limitCents)
      const paying = choice.totalCents >= MIN_PAYOUT_CENTS
      const outcome: PayoutOutcome = paying
        ? 'paid'
        : choice.totalCents > 0
          ? 'below_minimum'
          : 'nothing_payable'
      const [row] = await tx
        .insert(s.payouts)
        .values({
          runId,
          payoutAccountId: account.id,
          payDate: day,
          availableCents: balance.availableCents,
          pendingCents: balance.pendingCents,
          heldCents,
          limitCents,
          namedCents: choice.namedCents,
          unnamedCents: choice.unnamedCents,
          amountCents: paying ? choice.totalCents : 0,
          outcome,
          sendStatus: paying ? 'sending' : null,
          createdAt: now,
        })
        .onConflictDoNothing()
        .returning()
      if (!row) return null
      if (!paying) return row
      for (const item of choice.chosen) {
        if (item.kind === 'payment') {
          await tx
            .update(s.payments)
            .set({ payoutId: row.id, paidOutCents: item.amountCents })
            .where(and(eq(s.payments.id, item.id), isNull(s.payments.payoutId)))
        } else {
          await tx
            .update(s.payoutAdjustments)
            .set({ payoutId: row.id })
            .where(and(eq(s.payoutAdjustments.id, item.id), isNull(s.payoutAdjustments.payoutId)))
        }
      }
      return row
    })
  }

  /**
   * Steps 6.7 and 6.8: asks Stripe for the payout under the row's label and the key
   * `payout:<id>`, then records it as sent. A failure the next run may not meet leaves the row at
   * `sending`, for `resumeSending`; a refusal clears the marks and records `failed`.
   */
  private async send(row: PayoutRow): Promise<'sent' | 'sending' | 'failed'> {
    const { db, log, payments } = this.deps
    const stripeAccountId = await this.stripeAccountOf(row.payoutAccountId)
    try {
      const { payoutId } = await payments.createPayout({
        accountId: stripeAccountId,
        amountCents: row.amountCents,
        metadata: { [PAYOUT_LABEL]: row.id },
        idempotencyKey: `payout:${row.id}`,
      })
      await this.markSent(row, payoutId)
      return 'sent'
    } catch (error) {
      const message = messageOf(error).slice(0, 500)
      log.warn('payout step failed', { payoutId: row.id, error: message })
      if (retryable(error)) {
        await db.update(s.payouts).set({ error: message }).where(eq(s.payouts.id, row.id))
        return 'sending'
      }
      await this.failPayout(row, message)
      return 'failed'
    }
  }

  private async markSent(row: PayoutRow, stripePayoutId: string): Promise<void> {
    await this.deps.db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const [sent] = await tx
        .update(s.payouts)
        .set({
          sendStatus: 'sent',
          stripePayoutId,
          payoutStatus: sql`coalesce(${s.payouts.payoutStatus}, 'pending')`,
          error: null,
        })
        .where(and(eq(s.payouts.id, row.id), eq(s.payouts.sendStatus, 'sending')))
        .returning()
      if (!sent) return
      const account = await tx.query.payoutAccounts.findFirst({
        where: { id: row.payoutAccountId },
        columns: { profileId: true },
      })
      await tx.insert(s.auditLog).values({
        actorId: null,
        action: 'payout.created',
        entityType: 'payout',
        entityId: row.id,
        profileId: account?.profileId ?? null,
        metadata: {
          payoutAccountId: row.payoutAccountId,
          amountCents: row.amountCents,
          payDate: row.payDate,
          stripePayoutId,
        },
        createdAt: this.deps.now(),
      })
    })
  }

  /** Stripe refused the payout: one transaction clears the marks and records `failed`. */
  private async failPayout(row: PayoutRow, message: string): Promise<void> {
    const failed = await this.deps.db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const [updated] = await tx
        .update(s.payouts)
        .set({ outcome: 'failed', sendStatus: null, error: message })
        .where(and(eq(s.payouts.id, row.id), eq(s.payouts.sendStatus, 'sending')))
        .returning()
      if (!updated) return null
      await this.clearMarks(tx, row.id)
      await this.auditFailure(tx, updated, message)
      return updated
    })
    if (failed) await this.failureNotice(failed, message)
  }

  /** Takes a payout's marks off the payments and adjustments it paid, so a later one pays them. */
  private async clearMarks(tx: Tx, payoutId: string): Promise<void> {
    await tx
      .update(s.payments)
      .set({ payoutId: null, paidOutCents: null })
      .where(eq(s.payments.payoutId, payoutId))
    await tx
      .update(s.payoutAdjustments)
      .set({ payoutId: null })
      .where(eq(s.payoutAdjustments.payoutId, payoutId))
  }

  /** The `payout.failed` entry, which the run counts as needing attention for a day. */
  private async auditFailure(tx: Tx, row: PayoutRow, error: string): Promise<void> {
    const account = await tx.query.payoutAccounts.findFirst({
      where: { id: row.payoutAccountId },
      columns: { profileId: true },
    })
    await tx.insert(s.auditLog).values({
      actorId: null,
      action: 'payout.failed',
      entityType: 'payout',
      entityId: row.id,
      profileId: account?.profileId ?? null,
      metadata: { payoutAccountId: row.payoutAccountId, amountCents: row.amountCents, error },
      createdAt: this.deps.now(),
    })
  }

  /** The profile's owner, in English: the payout did not reach the bank. */
  private async failureNotice(row: PayoutRow, error: string): Promise<void> {
    const { db, env, mailer } = this.deps
    const account = await db.query.payoutAccounts.findFirst({
      where: { id: row.payoutAccountId },
      with: { profile: { with: { owner: { columns: { email: true } } } } },
    })
    if (!account) return
    const profile = account.profile
    await mailer.send(
      simpleEmail({
        to: profile.owner.email,
        title: `A payout to ${profile.displayName}'s bank did not go through`,
        paragraphs: [
          `The payout of ${formatSgd(row.amountCents)} planned for ${row.payDate} could not be made. The money stays in your Stripe balance, and the sales it covered will be paid in a later payout.`,
          `Stripe's answer: ${error}`,
          'If your bank details have changed, update them from Payouts in Elevate Teach.',
        ],
        cta: { href: `${env.TEACH_URL}/p/${profile.id}/earnings`, label: 'View earnings' },
      }),
    )
  }

  private async stripeAccountOf(payoutAccountId: string): Promise<string> {
    const account = await this.deps.db.query.payoutAccounts.findFirst({
      where: { id: payoutAccountId },
      columns: { stripeAccountId: true },
    })
    if (!account?.stripeAccountId)
      throw new Error(`payout account ${payoutAccountId} has no Stripe account`)
    return account.stripeAccountId
  }

  /**
   * Each payout row an earlier run left at `sending`: younger than `IDEMPOTENCY_TRUST_MS`, the
   * same request is sent again with the same key; older, Stripe's payouts are searched for the
   * row's label first, and a payout found there is recorded without sending.
   */
  async resumeSending(now: Date): Promise<{ sent: number }> {
    const { db, log, payments } = this.deps
    const rows = await db.query.payouts.findMany({
      where: { sendStatus: 'sending', outcome: 'paid' },
      orderBy: { createdAt: 'asc' },
    })
    let sent = 0
    for (const row of rows) {
      try {
        if (now.getTime() - row.createdAt.getTime() > IDEMPOTENCY_TRUST_MS) {
          const found = await payments.findPayout(
            await this.stripeAccountOf(row.payoutAccountId),
            row.id,
          )
          if (found) {
            await this.markSent(row, found.payoutId)
            sent++
            continue
          }
        }
        if ((await this.send(row)) === 'sent') sent++
      } catch (error) {
        log.error('could not resume a payout', { payoutId: row.id, error: messageOf(error) })
      }
    }
    return { sent }
  }

  // ── Stripe's payout events ───────────────────────────────────────────────

  /**
   * `payout.paid` and `payout.failed`, from the Connect endpoint. Matched by Stripe's id, or by
   * the row's label when the event arrives before the run recorded the id. A failed payout takes
   * its marks off what it paid, so the next day's payout chooses them again, and the profile's
   * owner is told. Safe to run twice: a second `failed` changes nothing.
   */
  async onPayoutEvent(
    stripePayoutId: string,
    status: 'paid' | 'failed',
    label?: string | null,
  ): Promise<'applied' | 'ignored' | 'unmatched'> {
    const { db } = this.deps
    const byId = await db.query.payouts.findFirst({ where: { stripePayoutId } })
    const row =
      byId ??
      (label && UUID.test(label)
        ? await db.query.payouts.findFirst({ where: { id: label } })
        : null)
    if (!row) return 'unmatched'
    if (status === 'paid') {
      const [updated] = await db
        .update(s.payouts)
        .set({
          payoutStatus: 'paid',
          stripePayoutId: row.stripePayoutId ?? stripePayoutId,
          ...(row.sendStatus === 'sending' ? { sendStatus: 'sent' } : {}),
        })
        .where(
          and(
            eq(s.payouts.id, row.id),
            sql`${s.payouts.payoutStatus} is distinct from 'paid'`,
            sql`${s.payouts.payoutStatus} is distinct from 'failed'`,
          ),
        )
        .returning({ id: s.payouts.id })
      return updated ? 'applied' : 'ignored'
    }
    const error = 'Stripe reported the payout failed at the bank'
    const failed = await db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const [updated] = await tx
        .update(s.payouts)
        .set({
          payoutStatus: 'failed',
          stripePayoutId: row.stripePayoutId ?? stripePayoutId,
          ...(row.sendStatus === 'sending' ? { sendStatus: 'sent' } : {}),
        })
        .where(
          and(eq(s.payouts.id, row.id), sql`${s.payouts.payoutStatus} is distinct from 'failed'`),
        )
        .returning()
      if (!updated) return null
      await this.clearMarks(tx, row.id)
      await this.auditFailure(tx, updated, error)
      return updated
    })
    if (!failed) return 'ignored'
    await this.failureNotice(failed, error)
    return 'applied'
  }

  // ── Support ──────────────────────────────────────────────────────────────

  /**
   * A Support admin releases a class under review, with a note. The next run releases it with
   * the reason `support`.
   */
  async clearReview(
    user: SessionUser,
    classId: string,
    input: ClearReview,
  ): Promise<{ classId: string; reviewClearedAt: string }> {
    const { db } = this.deps
    const now = this.deps.now()
    return db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const [row] = await tx
        .update(s.classes)
        .set({ reviewClearedAt: now, reviewClearedBy: user.id, reviewNote: input.note })
        .where(
          and(
            eq(s.classes.id, classId),
            isNotNull(s.classes.reviewNeededAt),
            isNull(s.classes.reviewClearedAt),
            isNull(s.classes.releasedAt),
          ),
        )
        .returning({ id: s.classes.id, profileId: s.classes.profileId })
      if (!row) {
        const exists = await tx.query.classes.findFirst({
          where: { id: classId },
          columns: { id: true },
        })
        if (!exists) throw errors.notFound('Class')
        throw errors.conflict('review_not_needed', 'This class is not under review')
      }
      await tx.insert(s.auditLog).values({
        actorId: user.id,
        action: 'class.review_cleared',
        entityType: 'class',
        entityId: classId,
        profileId: row.profileId,
        metadata: { note: input.note },
        createdAt: now,
      })
      return { classId, reviewClearedAt: now.toISOString() }
    })
  }

  /** A Support admin writes a signed `correction` adjustment, with a reason. */
  async addCorrection(
    user: SessionUser,
    payoutAccountId: string,
    input: Correction,
  ): Promise<{ id: string; payoutAccountId: string; amountCents: number; reason: string }> {
    const { db } = this.deps
    const account = await db.query.payoutAccounts.findFirst({ where: { id: payoutAccountId } })
    if (!account) throw errors.notFound('Payout account')
    const now = this.deps.now()
    return db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const [row] = await tx
        .insert(s.payoutAdjustments)
        .values({
          payoutAccountId,
          kind: 'correction',
          amountCents: input.amountCents,
          reason: input.reason,
          createdBy: user.id,
          createdAt: now,
        })
        .returning()
      if (!row) throw new Error('the correction was not written')
      await tx.insert(s.auditLog).values({
        actorId: user.id,
        action: 'payout.correction',
        entityType: 'payout_account',
        entityId: payoutAccountId,
        profileId: account.profileId,
        metadata: { adjustmentId: row.id, amountCents: input.amountCents, reason: input.reason },
        createdAt: now,
      })
      return { id: row.id, payoutAccountId, amountCents: row.amountCents, reason: input.reason }
    })
  }

  /** Support's payouts page. */
  async overview(): Promise<SupportPayoutsOverview> {
    const { db } = this.deps
    const now = this.deps.now()
    const runs = await db.query.payoutRuns.findMany({ orderBy: { startedAt: 'desc' }, limit: 20 })
    const [lastFinished] = await db
      .select({ finishedAt: s.payoutRuns.finishedAt })
      .from(s.payoutRuns)
      .where(isNotNull(s.payoutRuns.finishedAt))
      .orderBy(desc(s.payoutRuns.finishedAt))
      .limit(1)
    const lastFinishedAt = lastFinished?.finishedAt ?? null
    const attendance = new AttendanceService(this.deps)

    const underReview = await db.query.classes.findMany({
      where: {
        reviewNeededAt: { isNotNull: true },
        reviewClearedAt: { isNull: true },
        releasedAt: { isNull: true },
      },
      with: {
        profile: { columns: { displayName: true } },
        blocks: { columns: { endsAt: true } },
        cancellation: true,
      },
      orderBy: { reviewNeededAt: 'asc' },
    })
    const classesUnderReview: SupportPayoutsOverview['classesUnderReview'] = []
    for (const c of underReview) {
      const held = await db.query.payments.findMany({
        where: { classId: c.id, releasedAt: { isNull: true } },
        with: { refunds: { columns: { amountCents: true, applicationFeeRefundedCents: true } } },
      })
      const dueAt =
        releaseDueAt({
          lastBlockEndsAt: lastEnd(c.blocks),
          cancelledAt: c.cancelledAt,
          openMarkUntil: await attendance.classOpenMarkUntil(db, c.id),
          cancellationComplete: c.cancellation?.completedAt != null,
          now,
        }) ?? c.reviewNeededAt
      classesUnderReview.push({
        classId: c.id,
        className: c.name,
        profileName: c.profile.displayName,
        dueAt: (dueAt ?? now).toISOString(),
        heldCents: held.reduce((sum, p) => sum + Math.max(0, paymentShare(p, p.refunds)), 0),
      })
    }

    const dayAgo = new Date(now.getTime() - 24 * HOUR_MS)
    const attention = await db.query.seatRefunds.findMany({
      where: {
        OR: [
          { status: { in: ['failed', 'waiting'] } },
          {
            status: { in: ['pending', 'refund_sent'] },
            RAW: (t) =>
              sql`coalesce(${t.firstAttemptAt}, ${t.createdAt}) <= ${dayAgo.toISOString()}::timestamptz`,
          },
        ],
      },
      with: { class: { with: { profile: { columns: { displayName: true } } } } },
      orderBy: { createdAt: 'asc' },
      limit: 200,
    })

    const cancellations = await db.query.classCancellations.findMany({
      where: { completedAt: { isNull: true } },
      with: {
        class: { with: { profile: { columns: { displayName: true } } } },
        seatRefunds: { columns: { status: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const dayLimit = await db.query.payments.findMany({
      where: { releaseReason: 'day_limit' },
      with: { class: { with: { profile: { columns: { displayName: true } } } } },
      orderBy: { releasedAt: 'desc' },
      limit: 50,
    })

    const failed = await db.query.payouts.findMany({
      where: { OR: [{ outcome: 'failed' }, { payoutStatus: 'failed' }] },
      with: { payoutAccount: { with: { profile: { columns: { displayName: true } } } } },
      orderBy: { createdAt: 'desc' },
      limit: 50,
    })

    // The latest payout row of each account, where it found money no row names.
    const latest = await db
      .selectDistinctOn([s.payouts.payoutAccountId], {
        payoutAccountId: s.payouts.payoutAccountId,
        payDate: s.payouts.payDate,
        unnamedCents: s.payouts.unnamedCents,
      })
      .from(s.payouts)
      .orderBy(s.payouts.payoutAccountId, desc(s.payouts.payDate))
    const unnamed: SupportPayoutsOverview['unnamed'] = []
    for (const row of latest) {
      if (row.unnamedCents <= 0) continue
      const account = await db.query.payoutAccounts.findFirst({
        where: { id: row.payoutAccountId },
        with: { profile: { columns: { displayName: true } } },
      })
      unnamed.push({
        profileName: account?.profile.displayName ?? '',
        payoutAccountId: row.payoutAccountId,
        payDate: row.payDate,
        unnamedCents: row.unnamedCents,
      })
    }

    return {
      lastFinishedAt: lastFinishedAt?.toISOString() ?? null,
      stale: !lastFinishedAt || now.getTime() - lastFinishedAt.getTime() > RUN_STALE_MS,
      classesUnderReview,
      refundsNeedingAttention: attention.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        waitingFor: r.waitingFor,
        className: r.class.name,
        profileName: r.class.profile.displayName,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
      })),
      openCancellations: cancellations.map((c) => ({
        classId: c.classId,
        className: c.class.name,
        profileName: c.class.profile.displayName,
        afterStart: c.afterStart,
        createdAt: c.createdAt.toISOString(),
        rowsLeft: c.seatRefunds.filter((r) => (UNFINISHED as string[]).includes(r.status)).length,
      })),
      dayLimitReleases: dayLimit.map((p) => ({
        paymentId: p.id,
        className: p.class?.name ?? '',
        profileName: p.class?.profile.displayName ?? '',
        releasedAt: p.releasedAt?.toISOString() ?? '',
      })),
      failedPayouts: failed.map((p) => ({
        payoutId: p.id,
        profileName: p.payoutAccount.profile.displayName,
        payoutAccountId: p.payoutAccountId,
        amountCents: p.amountCents,
        error: p.error,
      })),
      unnamed,
      recentRuns: runs.map((r) => ({
        id: r.id,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        error: r.error,
        refundsSent: r.refundsSent,
        classesReleased: r.classesReleased,
        payoutsCreated: r.payoutsCreated,
      })),
    }
  }

  // ── Teach ────────────────────────────────────────────────────────────────

  /**
   * The four class-sales fields of Teach's earnings: the held total, the classes it is held for
   * with each one's release date or what it waits for, the recent payouts with what each paid,
   * and the debt no payout has covered. Zero and empty unless the profile is on manual payouts.
   */
  async forProfile(actor: ProfileActor): Promise<{
    heldCents: number
    heldClasses: HeldClassView[]
    payouts: ProfilePayoutView[]
    debtCents: number
  }> {
    const { db } = this.deps
    const empty = { heldCents: 0, heldClasses: [], payouts: [], debtCents: 0 }
    const account = await db.query.payoutAccounts.findFirst({
      where: { profileId: actor.profileId },
    })
    if (account?.payoutMode !== 'manual') return empty
    const now = this.deps.now()
    const attendance = new AttendanceService(this.deps)

    const held = await db.query.payments.findMany({
      where: {
        payoutAccountId: account.id,
        classId: { isNotNull: true },
        releasedAt: { isNull: true },
      },
      with: { refunds: { columns: { amountCents: true, applicationFeeRefundedCents: true } } },
    })
    const byClass = new Map<string, number>()
    for (const p of held) {
      const share = Math.max(0, paymentShare(p, p.refunds))
      if (p.classId) byClass.set(p.classId, (byClass.get(p.classId) ?? 0) + share)
    }
    const heldClasses: HeldClassView[] = []
    for (const [classId, heldCents] of byClass) {
      if (heldCents <= 0) continue
      const c = await db.query.classes.findFirst({
        where: { id: classId },
        with: { blocks: { columns: { endsAt: true } }, cancellation: true },
      })
      if (!c) continue
      const openMarkUntil = await attendance.classOpenMarkUntil(db, classId)
      const cancellationOpen = c.cancelledAt !== null && !c.cancellation?.completedAt
      const underReview = c.reviewNeededAt !== null && c.reviewClearedAt === null
      const due = releaseDueAt({
        lastBlockEndsAt: lastEnd(c.blocks),
        cancelledAt: c.cancelledAt,
        openMarkUntil,
        cancellationComplete: !cancellationOpen,
        now,
      })
      heldClasses.push({
        classId,
        className: c.name,
        heldCents,
        releaseDueAt: underReview ? null : (due?.toISOString() ?? null),
        waitingFor: underReview
          ? 'review'
          : cancellationOpen
            ? 'cancellation'
            : openMarkUntil
              ? 'open_marks'
              : null,
      })
    }
    heldClasses.sort((a, b) => (a.releaseDueAt ?? '~').localeCompare(b.releaseDueAt ?? '~'))

    const recent = await db.query.payouts.findMany({
      where: { payoutAccountId: account.id, OR: [{ outcome: 'paid' }, { outcome: 'failed' }] },
      orderBy: { payDate: 'desc' },
      limit: RECENT_PAYOUTS,
      with: {
        payments: {
          columns: { id: true, paidOutCents: true, paidAt: true },
          with: { course: { columns: { title: true } }, class: { columns: { name: true } } },
        },
        adjustments: true,
      },
    })
    const payouts: ProfilePayoutView[] = recent.map((p) => ({
      id: p.id,
      payDate: p.payDate,
      amountCents: p.amountCents,
      payoutStatus: p.outcome === 'failed' ? 'failed' : p.payoutStatus,
      items: [
        ...p.adjustments.map((a) => ({
          kind: a.kind,
          label: a.kind === 'correction' && a.reason ? a.reason : ADJUSTMENT_LABEL[a.kind],
          amountCents: a.amountCents,
          at: a.createdAt.getTime(),
        })),
        ...p.payments.map((m) => {
          const amountCents = m.paidOutCents ?? 0
          const sale = m.class ? `${m.course.title}: ${m.class.name}` : m.course.title
          return {
            kind: 'payment' as const,
            // A seat's share is below zero only after a refund left the profile part of
            // Stripe's fee, which the payout took as a debt.
            label: amountCents < 0 ? `Refund on ${sale}: Stripe’s fee you bear` : sale,
            amountCents,
            at: m.paidAt.getTime(),
          }
        }),
      ]
        // An item of zero, such as an empty opening balance, paid nothing.
        .filter((item) => item.amountCents !== 0)
        .sort((a, b) => a.at - b.at)
        .map(({ at: _at, ...item }) => item),
    }))

    const debt = (await this.payableItems(db, account.id))
      .filter((item) => item.amountCents < 0)
      .reduce((sum, item) => sum - item.amountCents, 0)
    return {
      heldCents: [...byClass.values()].reduce((sum, cents) => sum + cents, 0),
      heldClasses,
      payouts,
      debtCents: debt,
    }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function lastEnd(blocks: readonly { endsAt: Date }[]): Date | null {
  return blocks.length ? new Date(Math.max(...blocks.map((b) => b.endsAt.getTime()))) : null
}
