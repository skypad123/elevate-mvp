import {
  type AcceptClassSales,
  CLASS_SALES_TERMS_VERSION,
  type ClassSalesStatus,
  SWITCHING_STALE_MS,
  UNFINISHED_SEAT_REFUND_STATUSES,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors, HttpError } from '../lib/errors'
import { isPayable } from '../lib/payout'
import type { ProfileActor } from '../middleware/auth'
import { recordAudit } from './audit.service'

/** How long notice to leave lasts (G16). */
const LEAVE_NOTICE_MS = 30 * 24 * 60 * 60 * 1000

type PayoutAccountRow = typeof s.payoutAccounts.$inferSelect

/**
 * A profile's opting in to class sales, and its leaving (docs/designs/scheduled-classes-selling.md,
 * "Opting in"). Opting in changes a Stripe account and a profile together, so the intent is
 * recorded first (`switching`) and the Stripe steps follow; a request that dies after the first
 * step leaves a state the release job finishes with `finishStale`. While an account is not
 * `manual`, none of its profile's classes is on sale and the job does not pay it.
 */
export class ClassSalesService {
  constructor(private readonly deps: Deps) {}

  private async load(profileId: string) {
    const profile = await this.deps.db.query.profiles.findFirst({
      where: { id: profileId },
      with: { payoutAccount: true },
    })
    if (!profile) throw errors.notFound('Profile')
    return profile
  }

  /** The Teach settings card. */
  async status(profileId: string): Promise<ClassSalesStatus> {
    const profile = await this.load(profileId)
    const account = profile.payoutAccount
    return {
      payoutMode: account?.payoutMode ?? null,
      payable: isPayable(account),
      acceptedAt: profile.classSalesAcceptedAt?.toISOString() ?? null,
      termsVersion: profile.classSalesTermsVersion,
      currentTermsVersion: CLASS_SALES_TERMS_VERSION,
      leaveRequestedAt: account?.leaveRequestedAt?.toISOString() ?? null,
      leaveOn: account?.leaveOn?.toISOString() ?? null,
    }
  }

  /**
   * The owner accepts the held-payout terms. Step 1 records the acceptance and sets the account to
   * `switching` in one transaction; `finishSwitching` then does the Stripe steps. If those fail,
   * the account stays `switching` and the answer says so; the job finishes it.
   */
  async accept(actor: ProfileActor, input: AcceptClassSales): Promise<ClassSalesStatus> {
    const { db, log } = this.deps
    if (input.termsVersion !== CLASS_SALES_TERMS_VERSION) {
      throw new HttpError(422, 'terms_version', 'These are not the current held-payout terms', {
        current: CLASS_SALES_TERMS_VERSION,
      })
    }
    const profile = await this.load(actor.profileId)
    const account = profile.payoutAccount
    if (account && account.payoutMode !== 'automatic') {
      throw errors.conflict('already_opted_in', 'This profile already sells classes')
    }
    if (!account || !isPayable(account)) {
      throw errors.conflict('not_payable', 'Finish setting up payouts before selling classes')
    }
    const now = this.deps.now()
    const switched = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(s.payoutAccounts)
        .set({ payoutMode: 'switching' })
        .where(
          and(eq(s.payoutAccounts.id, account.id), eq(s.payoutAccounts.payoutMode, 'automatic')),
        )
        .returning({ id: s.payoutAccounts.id })
      if (!row) return false
      await tx
        .update(s.profiles)
        .set({
          classSalesAcceptedAt: now,
          classSalesAcceptedBy: actor.userId,
          classSalesTermsVersion: input.termsVersion,
        })
        .where(eq(s.profiles.id, profile.id))
      return true
    })
    if (!switched) throw errors.conflict('already_opted_in', 'This profile already sells classes')
    try {
      await this.finishSwitching(account.id)
    } catch (error) {
      log.warn('opting in to class sales stopped after it was recorded', {
        payoutAccountId: account.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return this.status(profile.id)
  }

  /**
   * Steps 2 to 4 of opting in: manual payouts at Stripe (safe to repeat), the balance read, then
   * in one transaction the mode `manual`, `manualSince` at the moment of the read, the two
   * opening amounts and the audit entry. Does nothing unless the account is `switching`; returns
   * whether it finished it.
   */
  async finishSwitching(payoutAccountId: string): Promise<boolean> {
    const { db, payments } = this.deps
    const account = await db.query.payoutAccounts.findFirst({
      where: { id: payoutAccountId },
      with: { profile: true },
    })
    if (account?.payoutMode !== 'switching' || !account.stripeAccountId) return false
    await payments.setManualPayouts(account.stripeAccountId)
    const balance = await payments.retrieveBalance(account.stripeAccountId)
    const readAt = this.deps.now()
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(s.payoutAccounts)
        .set({ payoutMode: 'manual', manualSince: readAt })
        .where(
          and(eq(s.payoutAccounts.id, account.id), eq(s.payoutAccounts.payoutMode, 'switching')),
        )
        .returning({ id: s.payoutAccounts.id })
      if (!row) return false
      // Money earned before opting in, which no payment row can be marked for.
      await tx.insert(s.payoutAdjustments).values([
        {
          payoutAccountId: account.id,
          kind: 'opening_available',
          amountCents: balance.availableCents,
          createdAt: readAt,
        },
        {
          payoutAccountId: account.id,
          kind: 'opening_pending',
          amountCents: balance.pendingCents,
          createdAt: readAt,
        },
      ])
      await tx.insert(s.auditLog).values({
        actorId: account.profile.classSalesAcceptedBy,
        action: 'class_sales.accepted',
        entityType: 'profile',
        entityId: account.profileId,
        profileId: account.profileId,
        metadata: {
          termsVersion: account.profile.classSalesTermsVersion,
          payoutAccountId: account.id,
          openingAvailableCents: balance.availableCents,
          openingPendingCents: balance.pendingCents,
        },
      })
      return true
    })
  }

  /**
   * For the release job: finishes each opt-in left at `switching` for longer than
   * `SWITCHING_STALE_MS`, counted from the acceptance. Returns how many it finished.
   */
  async finishStale(now: Date): Promise<number> {
    const { db, log } = this.deps
    const stale = await db.query.payoutAccounts.findMany({
      where: { payoutMode: 'switching' },
      columns: { id: true },
      with: { profile: { columns: { classSalesAcceptedAt: true } } },
    })
    let finished = 0
    for (const account of stale) {
      const since = account.profile.classSalesAcceptedAt
      if (since && now.getTime() - since.getTime() <= SWITCHING_STALE_MS) continue
      try {
        if (await this.finishSwitching(account.id)) finished++
      } catch (error) {
        log.warn('could not finish opting in to class sales', {
          payoutAccountId: account.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return finished
  }

  /**
   * The owner gives 30 days' notice to leave (G16). From now the profile's classes are not on
   * sale; seats already sold are untouched. `finishLeaving` ends it once nothing is held.
   */
  async leave(actor: ProfileActor): Promise<ClassSalesStatus> {
    const { db } = this.deps
    const profile = await this.load(actor.profileId)
    const account = profile.payoutAccount
    const now = this.deps.now()
    const leaveOn = new Date(now.getTime() + LEAVE_NOTICE_MS)
    const [row] = account
      ? await db
          .update(s.payoutAccounts)
          .set({ leaveRequestedAt: now, leaveOn })
          .where(
            and(
              eq(s.payoutAccounts.id, account.id),
              eq(s.payoutAccounts.payoutMode, 'manual'),
              isNull(s.payoutAccounts.leaveRequestedAt),
            ),
          )
          .returning({ id: s.payoutAccounts.id })
      : []
    if (!row) {
      throw errors.conflict('not_opted_in', 'This profile does not sell classes, or is leaving')
    }
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'class_sales.leave_requested',
      entityType: 'profile',
      entityId: profile.id,
      profileId: profile.id,
      metadata: { payoutAccountId: row.id, leaveOn: leaveOn.toISOString() },
    })
    return this.status(profile.id)
  }

  /**
   * For the release job, after paying: ends each leave whose date has passed and that has no
   * class payment still held, no seat refund unfinished and no payout at `sending`. The Stripe
   * account goes back to automatic payouts, the leave and `manualSince` are cleared, and the
   * owner is emailed. Returns how many it finished.
   */
  async finishLeaving(now: Date): Promise<number> {
    const { db, log } = this.deps
    const due = await db.query.payoutAccounts.findMany({
      where: { payoutMode: 'manual', leaveOn: { lte: now } },
    })
    let finished = 0
    for (const account of due) {
      try {
        if (await this.finishLeave(account, now)) finished++
      } catch (error) {
        log.warn('could not finish leaving class sales', {
          payoutAccountId: account.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return finished
  }

  /** Whether the account still holds class money or has money moving. */
  private async busy(payoutAccountId: string): Promise<boolean> {
    const { db } = this.deps
    const held = await db.$count(
      s.payments,
      and(
        eq(s.payments.payoutAccountId, payoutAccountId),
        isNotNull(s.payments.classId),
        isNull(s.payments.releasedAt),
      ),
    )
    if (held > 0) return true
    const [refund] = await db
      .select({ id: s.seatRefunds.id })
      .from(s.seatRefunds)
      .innerJoin(s.payments, eq(s.payments.id, s.seatRefunds.paymentId))
      .where(
        and(
          eq(s.payments.payoutAccountId, payoutAccountId),
          inArray(s.seatRefunds.status, [...UNFINISHED_SEAT_REFUND_STATUSES]),
        ),
      )
      .limit(1)
    if (refund) return true
    const sending = await db.$count(
      s.payouts,
      and(eq(s.payouts.payoutAccountId, payoutAccountId), eq(s.payouts.sendStatus, 'sending')),
    )
    return sending > 0
  }

  private async finishLeave(account: PayoutAccountRow, now: Date): Promise<boolean> {
    const { db, env, mailer, payments } = this.deps
    if (!account.leaveOn || account.leaveOn > now || !account.stripeAccountId) return false
    if (await this.busy(account.id)) return false
    await payments.setAutomaticPayouts(account.stripeAccountId)
    const left = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(s.payoutAccounts)
        .set({ payoutMode: 'automatic', leaveRequestedAt: null, leaveOn: null, manualSince: null })
        .where(
          and(
            eq(s.payoutAccounts.id, account.id),
            eq(s.payoutAccounts.payoutMode, 'manual'),
            lte(s.payoutAccounts.leaveOn, now),
          ),
        )
        .returning({ id: s.payoutAccounts.id })
      if (!row) return false
      await tx.insert(s.auditLog).values({
        actorId: null,
        action: 'class_sales.left',
        entityType: 'profile',
        entityId: account.profileId,
        profileId: account.profileId,
        metadata: { payoutAccountId: account.id },
      })
      return true
    })
    if (!left) return false
    const profile = await db.query.profiles.findFirst({
      where: { id: account.profileId },
      with: { owner: true },
    })
    if (profile) {
      // Teacher emails stay English; the profile's name goes in only through `simpleEmail`.
      await mailer.send(
        simpleEmail({
          to: profile.owner.email,
          title: `${profile.displayName} no longer sells classes`,
          paragraphs: [
            `Your notice to stop selling classes has ended. Stripe now pays ${profile.displayName}'s balance to your bank on its own schedule again, including any amount under S$1.`,
            'You can opt in to selling classes again from Settings in Elevate Teach.',
          ],
          cta: { href: `${env.TEACH_URL}/p/${profile.id}/settings`, label: 'Open Settings' },
        }),
      )
    }
    return true
  }
}
