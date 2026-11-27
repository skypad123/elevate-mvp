import {
  ANALYTICS_EVENTS,
  type CheckoutStartResponse,
  type CheckoutSyncResponse,
  DEFAULT_MINIMUM_CHARGE_CENTS,
  formatSgd,
  fulfilmentDecision,
  type Locale,
  localeSchema,
  type PromoDiscount,
  type Quote,
  type QuoteResponse,
  quote,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { translate } from '@elevate/i18n'
import { and, eq, min, ne, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { classReceiptEmail } from '../emails/class-sales'
import { simpleEmail } from '../emails/templates'
import { errors, HttpError } from '../lib/errors'
import { isPayable } from '../lib/payout'
import type { SessionUser } from '../middleware/auth'
import type { CheckoutSessionResult } from '../providers/payments/types'
import { recordAudit, trackEvent } from './audit.service'
import { seatsTaken } from './class-checkout.service'
import { MediaService } from './media.service'
import { SeatRefundsService, type Tx } from './seat-refunds.service'
import { TransactionsService } from './transactions.service'

type PromoRow = typeof s.promoCodes.$inferSelect

export type FulfilmentInput = {
  sessionId: string
  paymentIntentId: string | null
  amountTotal: number | null
  customerEmail: string | null
  metadata: Record<string, string>
}

/**
 * `unattributed`: the session's metadata does not say which payout account was paid, or names one
 * that does not exist. No payment is written; the caller reports it so Support can act.
 * `duplicate`: the enrolment was already active, so this payment was recorded and refunded.
 * `duplicate_unrefunded`: the same, but the refund failed; the payment stays for Support to refund.
 * `seat_lost`: a class payment that arrived when its seat was gone. It is recorded with a
 * `seat_lost` seat refund row, which the release job sends; the learner gets no seat.
 */
export type FulfilmentOutcome =
  | 'applied'
  | 'ignored'
  | 'unmatched'
  | 'unattributed'
  | 'duplicate'
  | 'duplicate_unrefunded'
  | 'seat_lost'

/**
 * A class payment whose seat was lost, for an enrollment that already has an unfinished seat
 * refund: the one-unfinished-row rule cannot take its `seat_lost` row yet. Nothing is recorded;
 * the webhook stores the error and Stripe's redelivery is handled again once that row finishes.
 */
export class SeatLostBlockedError extends Error {
  constructor(sessionId: string) {
    super(
      `seat_lost_blocked: session ${sessionId} lost its seat and its enrollment has a refund under way`,
    )
    this.name = 'SeatLostBlockedError'
  }
}

/** What makes two checkout attempts the same: a session is reused only when all of these match. */
const ATTEMPT_KEYS = [
  'enrollmentId',
  'elevatePayoutAccountId',
  'promoCodeId',
  'amountCents',
  'locale',
]
const sameAttempt = (a: Record<string, string>, b: Record<string, string>) =>
  ATTEMPT_KEYS.every((key) => (a[key] ?? '') === (b[key] ?? ''))

export const fulfilmentInput = (session: CheckoutSessionResult): FulfilmentInput => ({
  sessionId: session.id,
  paymentIntentId: session.paymentIntentId,
  amountTotal: session.amountTotal,
  customerEmail: session.customerEmail,
  metadata: session.metadata,
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The payment page's metadata, which fulfilment reads: the payee is fixed when checkout starts and
 * travels here, never read from the course as it is later. Class checkout adds its own keys.
 */
export function checkoutMetadata(input: {
  enrollmentId: string
  courseId: string
  userId: string
  payoutAccountId: string
  profileId: string
  promoCodeId: string | null
  quote: Quote
  locale?: Locale
}): Record<string, string> {
  const q = input.quote
  return {
    enrollmentId: input.enrollmentId,
    courseId: input.courseId,
    userId: input.userId,
    elevatePayoutAccountId: input.payoutAccountId,
    elevateProfileId: input.profileId,
    promoCodeId: input.promoCodeId ?? '',
    listPriceCents: String(q.listPriceCents),
    discountCents: String(q.discountCents),
    amountCents: String(q.amountCents),
    stripeFeeEstimateCents: String(q.stripeFeeEstimateCents),
    commissionCents: String(q.commissionCents),
    applicationFeeCents: String(q.applicationFeeCents),
    teacherNetCents: String(q.teacherNetCents),
    ...(input.locale ? { locale: input.locale } : {}),
  }
}

/** Refuses a price above zero that is under the minimum Stripe charge. */
export function assertChargeable(q: Quote): void {
  if (q.belowMinimum)
    throw errors.unprocessable(
      'below_minimum',
      `The discounted price is below the minimum chargeable amount (${formatSgd(DEFAULT_MINIMUM_CHARGE_CENTS)})`,
      { minimumCents: DEFAULT_MINIMUM_CHARGE_CENTS },
    )
}

export class PaymentsService {
  private readonly media: MediaService
  constructor(private readonly deps: Deps) {
    this.media = new MediaService(deps)
  }

  private async loadCourse(courseId: string) {
    const course = await this.deps.db.query.courses.findFirst({
      where: { id: courseId },
      with: {
        thumbnail: true,
        profile: { with: { payoutAccount: true } },
      },
    })
    if (!course) throw errors.notFound('Course')
    return course
  }

  /** Validates a promo code for a course; returns null when no code was given. */
  async resolvePromo(code: string | undefined, courseId: string): Promise<PromoRow | null> {
    if (!code) return null
    const promo = await this.deps.db.query.promoCodes.findFirst({ where: { code } })
    const now = this.deps.now()
    if (!promo?.active) throw errors.badRequest('promo_invalid', 'That promo code is not valid')
    if (promo.courseId && promo.courseId !== courseId)
      throw errors.badRequest('promo_wrong_course', 'That code does not apply to this course')
    if (promo.startsAt && promo.startsAt > now)
      throw errors.badRequest('promo_not_started', 'That code is not active yet')
    if (promo.expiresAt && promo.expiresAt < now)
      throw errors.badRequest('promo_expired', 'That promo code has expired')
    if (promo.maxRedemptions !== null && promo.redeemedCount >= promo.maxRedemptions)
      throw errors.badRequest('promo_exhausted', 'That promo code has been fully redeemed')
    return promo
  }

  async quoteFor(courseId: string, promoCode?: string): Promise<QuoteResponse> {
    const course = await this.loadCourse(courseId)
    if (course.status !== 'live') throw errors.notFound('Course')
    const promo = await this.resolvePromo(promoCode, courseId)
    const discount: PromoDiscount | null = promo ? { type: promo.type, value: promo.value } : null
    const { env } = this.deps
    const q = quote({
      listPriceCents: course.priceCents,
      promo: discount,
      commissionBps: course.profile.commissionBps,
      stripeFeeBps: env.STRIPE_FEE_BPS,
      stripeFixedCents: env.STRIPE_FEE_FIXED_CENTS,
    })
    return {
      quote: q,
      promo: promo ? { code: promo.code, type: promo.type, value: promo.value } : null,
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        priceCents: course.priceCents,
        thumbnailUrl: await this.media.publicUrl(course.thumbnail),
        teacherName: course.profile.displayName,
      },
    }
  }

  async startCheckout(
    user: SessionUser,
    courseId: string,
    { promoCode, locale }: { promoCode?: string; locale?: Locale } = {},
  ): Promise<CheckoutStartResponse> {
    const { db, env, payments } = this.deps
    const course = await this.loadCourse(courseId)
    if (course.status !== 'live') throw errors.notFound('Course')
    // The self-paced enrollment only: a class enrollment for the same course is neither
    // "already enrolled" nor a row to reuse.
    const existing = await db.query.enrollments.findFirst({
      where: { userId: user.id, courseId, classId: { isNull: true } },
    })
    if (existing?.status === 'active')
      throw errors.conflict('already_enrolled', 'You are already enrolled in this course')

    const { quote: q, promo } = await this.quoteFor(courseId, promoCode)
    const promoRow = promo
      ? await db.query.promoCodes.findFirst({ where: { code: promo.code } })
      : null

    // The session the learner started before, as Stripe has it now. If they paid it, that payment
    // stands and nothing new is opened.
    const replaced = existing?.stripeCheckoutSessionId ?? null
    const current = replaced
      ? await payments.retrieveCheckoutSession(replaced).catch(() => null)
      : null
    if (
      existing &&
      current?.paymentStatus === 'paid' &&
      (await this.fulfilled(current, existing.id))
    )
      return { kind: 'enrolled', enrollmentId: existing.id }

    // Free enrolment: no Stripe involved.
    if (q.isFree) {
      if (existing && replaced && (await this.closeReplacedSession(replaced, existing.id)))
        return { kind: 'enrolled', enrollmentId: existing.id }
      const enrollmentId = await db.transaction(async (tx) => {
        const now = this.deps.now()
        const values = {
          status: 'active' as const,
          enrolledAt: now,
          promoCodeId: promoRow?.id ?? null,
          stripeCheckoutSessionId: null,
        }
        let id: string
        if (existing) {
          // A payment that activated the enrolment since it was read above wins.
          const [row] = await tx
            .update(s.enrollments)
            .set(values)
            .where(and(eq(s.enrollments.id, existing.id), ne(s.enrollments.status, 'active')))
            .returning()
          if (!row) return null
          id = existing.id
        } else {
          const [row] = await tx
            .insert(s.enrollments)
            .values({ userId: user.id, courseId, ...values })
            .returning()
          if (!row) throw new Error('failed to enrol')
          id = row.id
        }
        await tx
          .update(s.courses)
          .set({ enrolCount: sql`${s.courses.enrolCount} + 1` })
          .where(eq(s.courses.id, courseId))
        if (promoRow)
          await tx
            .update(s.promoCodes)
            .set({ redeemedCount: sql`${s.promoCodes.redeemedCount} + 1` })
            .where(eq(s.promoCodes.id, promoRow.id))
        return id
      })
      if (enrollmentId === null) return { kind: 'enrolled', enrollmentId: existing?.id as string }
      await trackEvent(this.deps, {
        userId: user.id,
        name: ANALYTICS_EVENTS.checkoutCompleted,
        properties: { courseId, free: true, locale: locale ?? null },
      })
      return { kind: 'enrolled', enrollmentId }
    }

    assertChargeable(q)
    // The error code keeps its old name so clients do not change.
    const account = course.profile.payoutAccount
    if (!isPayable(account)) {
      throw errors.conflict(
        'teacher_not_payable',
        'This teacher cannot accept payments yet. Please try again later.',
      )
    }

    // Reuse the learner's pending enrollment row so retries do not create duplicates. One that a
    // payment activated since it was read above is left as it is.
    let enrollmentId: string
    if (existing) {
      const [row] = await db
        .update(s.enrollments)
        .set({ status: 'pending_payment', promoCodeId: promoRow?.id ?? null })
        .where(and(eq(s.enrollments.id, existing.id), ne(s.enrollments.status, 'active')))
        .returning()
      if (!row) return { kind: 'enrolled', enrollmentId: existing.id }
      enrollmentId = existing.id
    } else {
      const [row] = await db
        .insert(s.enrollments)
        .values({
          userId: user.id,
          courseId,
          status: 'pending_payment',
          promoCodeId: promoRow?.id ?? null,
        })
        .returning()
      if (!row) throw new Error('failed to create enrollment')
      enrollmentId = row.id
    }

    // The payee is fixed here, when checkout starts, and travels in the session's metadata.
    // Fulfilment reads it from there, never from the course as it is later.
    // The return pages open in the language checkout started in.
    const lang = locale ? `&lang=${locale}` : ''
    const metadata = checkoutMetadata({
      enrollmentId,
      courseId,
      userId: user.id,
      payoutAccountId: account.id,
      profileId: course.profileId,
      promoCodeId: promoRow?.id ?? null,
      quote: q,
      locale,
    })
    const started = () =>
      trackEvent(this.deps, {
        userId: user.id,
        name: ANALYTICS_EVENTS.checkoutStarted,
        properties: { courseId, amountCents: q.amountCents, locale: locale ?? null },
      })
    // A retry of the same attempt goes back to its open session.
    if (current?.status === 'open' && current.url && sameAttempt(current.metadata, metadata)) {
      await started()
      return { kind: 'redirect', url: current.url, sessionId: current.id }
    }
    const session = await payments.createCheckoutSession({
      enrollmentId,
      payoutAccountId: account.id,
      profileId: course.profileId,
      courseTitle: course.title,
      courseImageUrl: await this.media.publicUrl(course.thumbnail),
      amountCents: q.amountCents,
      currency: env.PLATFORM_CURRENCY,
      applicationFeeCents: q.applicationFeeCents,
      destinationAccountId: account.stripeAccountId,
      customerEmail: user.email,
      successUrl: `${env.LEARNER_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}${lang}`,
      cancelUrl: `${env.LEARNER_URL}/course/${course.slug}?checkout=cancelled${lang}`,
      locale,
      replacesSessionId: replaced ?? undefined,
      metadata,
    })
    const dropNew = () =>
      payments.expireCheckoutSession(session.id).catch((error) =>
        this.deps.log.warn('could not expire an unused checkout session', {
          sessionId: session.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    // A changed language, promo code or payee opened a new session: close the old one, so the
    // learner cannot pay both. If they paid it in the meantime, that payment stands instead.
    if (replaced && replaced !== session.id) {
      if (await this.closeReplacedSession(replaced, enrollmentId)) {
        await dropNew()
        return { kind: 'enrolled', enrollmentId }
      }
    }
    const [pointed] = await db
      .update(s.enrollments)
      .set({ stripeCheckoutSessionId: session.id })
      .where(and(eq(s.enrollments.id, enrollmentId), ne(s.enrollments.status, 'active')))
      .returning()
    if (!pointed) {
      await dropNew()
      return { kind: 'enrolled', enrollmentId }
    }
    await started()
    return { kind: 'redirect', url: session.url, sessionId: session.id }
  }

  /**
   * Closes the session a restarted checkout replaces. Returns true when the learner had already
   * paid it: that payment is fulfilled, and the enrolment is active. A failure to close it is
   * logged and ignored; fulfilment refunds a second payment if one gets through.
   */
  private async closeReplacedSession(sessionId: string, enrollmentId: string): Promise<boolean> {
    const closed = await this.deps.payments.expireCheckoutSession(sessionId).catch((error) => {
      this.deps.log.warn('could not expire a replaced checkout session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    })
    if (closed?.paymentStatus !== 'paid') return false
    return this.fulfilled(closed, enrollmentId)
  }

  /** Fulfils a paid session and says whether the enrolment is now active. */
  private async fulfilled(session: CheckoutSessionResult, enrollmentId: string): Promise<boolean> {
    await this.fulfilCheckout(fulfilmentInput(session))
    const enrollment = await this.deps.db.query.enrollments.findFirst({
      where: { id: enrollmentId },
    })
    return enrollment?.status === 'active'
  }

  /**
   * The enrolment a Checkout session belongs to. Starting checkout again (in another language, or
   * with another promo code) opens a new session, points the enrolment at it and closes the old
   * one. The old one can still be paid if the learner paid it before it was closed. So a session
   * the enrolment no longer points at is matched through its metadata, and only to the learner
   * who started it.
   */
  private async enrollmentForSession(sessionId: string, metadata: Record<string, string>) {
    const { db } = this.deps
    const current = await db.query.enrollments.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
      with: { course: true, user: true },
    })
    if (current) return current
    const enrollmentId = metadata.enrollmentId
    if (!enrollmentId || !UUID.test(enrollmentId)) return undefined
    const earlier = await db.query.enrollments.findFirst({
      where: { id: enrollmentId },
      with: { course: true, user: true },
    })
    return earlier && earlier.userId === metadata.userId ? earlier : undefined
  }

  /** Success-page poll and no-webhook fallback: re-read the session and run the same fulfilment. */
  async syncSession(user: SessionUser, sessionId: string): Promise<CheckoutSyncResponse> {
    const { db, payments } = this.deps
    let session: CheckoutSessionResult | null = null
    let enrollment = await db.query.enrollments.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
      with: { course: true, user: true },
    })
    const pointsHere = enrollment !== undefined
    if (!enrollment) {
      // An earlier session of a checkout that was started again.
      session = await payments.retrieveCheckoutSession(sessionId).catch(() => null)
      if (session) enrollment = await this.enrollmentForSession(sessionId, session.metadata)
    }
    if (!enrollment || enrollment.userId !== user.id) throw errors.notFound('Checkout session')
    if (enrollment.classId) return this.syncClassSession(sessionId, enrollment, session)
    const paid = { status: 'paid', enrollmentId: enrollment.id, courseSlug: enrollment.course.slug }
    if (enrollment.status === 'active' && pointsHere) return paid as CheckoutSyncResponse
    // Another session of an active enrolment is still read: if it was paid too, fulfilment
    // records and refunds it, even when no webhook arrives.
    session ??= await payments.retrieveCheckoutSession(sessionId)
    if (session.paymentStatus === 'paid') {
      const outcome = await this.fulfilCheckout(fulfilmentInput(session))
      if (outcome === 'unattributed') {
        // Paid, but we cannot tell whom it paid. The learner keeps seeing "pending" and the
        // error is logged for Support; the webhook path stores the same failure with its event.
        this.deps.log.error('paid checkout session has no payout account', { sessionId })
        return { status: 'pending' }
      }
      return paid as CheckoutSyncResponse
    }
    if (enrollment.status === 'active') return paid as CheckoutSyncResponse
    return { status: session.status === 'expired' ? 'expired' : 'pending' }
  }

  /**
   * The success page of a class checkout. A recorded payment answers `paid` with its class, or
   * `seat_lost` when it got a `seat_lost` row; an unrecorded paid session is fulfilled first.
   */
  private async syncClassSession(
    sessionId: string,
    enrollment: { id: string; classId: string | null; course: { slug: string } },
    session: CheckoutSessionResult | null,
  ): Promise<CheckoutSyncResponse> {
    const { db, payments, log } = this.deps
    const courseSlug = enrollment.course.slug
    const recorded = async (): Promise<CheckoutSyncResponse | null> => {
      const payment = await db.query.payments.findFirst({
        where: { stripeCheckoutSessionId: sessionId },
        with: { seatRefunds: { columns: { kind: true } } },
      })
      if (!payment) return null
      const classId = payment.classId ?? enrollment.classId ?? ''
      if (payment.seatRefunds.some((row) => row.kind === 'seat_lost'))
        return { status: 'seat_lost', classId, courseSlug }
      return { status: 'paid', enrollmentId: enrollment.id, courseSlug, classId }
    }
    const known = await recorded()
    if (known) return known
    const current = session ?? (await payments.retrieveCheckoutSession(sessionId))
    if (current.paymentStatus !== 'paid')
      return { status: current.status === 'expired' ? 'expired' : 'pending' }
    try {
      const outcome = await this.fulfilCheckout(fulfilmentInput(current))
      if (outcome === 'unattributed') {
        log.error('paid checkout session has no payout account', { sessionId })
        return { status: 'pending' }
      }
    } catch (error) {
      if (!(error instanceof SeatLostBlockedError)) throw error
      log.error('a lost seat could not be recorded yet', { sessionId, error: error.message })
      return { status: 'pending' }
    }
    return (await recorded()) ?? { status: 'pending' }
  }

  /**
   * Step 3 of a release run: Stripe's fee, and the balance transaction, transfer and application
   * fee ids, are empty for a few seconds after a payment on the pinned API version. For each
   * payment with a charge and no fee recorded, reads them from Stripe and stores the fee, the
   * platform's net and any id that is still empty. A payment Stripe has not filled yet is left for
   * the next run; a failure on one does not stop the others. Returns how many it filled.
   */
  async fillStripeFees(): Promise<number> {
    const { db, log, payments } = this.deps
    const rows = await db.query.payments.findMany({
      where: { stripeChargeId: { isNotNull: true }, stripeFeeActualCents: { isNull: true } },
      columns: {
        id: true,
        stripeChargeId: true,
        applicationFeeCents: true,
        stripeBalanceTransactionId: true,
        stripeTransferId: true,
        stripeApplicationFeeId: true,
      },
    })
    let filled = 0
    for (const p of rows) {
      if (!p.stripeChargeId) continue
      try {
        const fee = await payments.retrieveChargeFee(p.stripeChargeId)
        if (!fee) continue
        const [updated] = await db
          .update(s.payments)
          .set({
            stripeFeeActualCents: fee.stripeFeeCents,
            platformNetCents: p.applicationFeeCents - fee.stripeFeeCents,
            stripeBalanceTransactionId: p.stripeBalanceTransactionId ?? fee.balanceTransactionId,
            stripeTransferId: p.stripeTransferId ?? fee.transferId,
            stripeApplicationFeeId: p.stripeApplicationFeeId ?? fee.applicationFeeId,
          })
          .where(and(eq(s.payments.id, p.id), sql`${s.payments.stripeFeeActualCents} is null`))
          .returning({ id: s.payments.id })
        if (updated) filled++
      } catch (error) {
        log.warn('could not read the Stripe fee of a payment', {
          paymentId: p.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return filled
  }

  /**
   * Idempotent: a payment row exists per Checkout session, so webhook + sync cannot double-fulfil.
   * An enrolment is fulfilled once: a second paid session for it is recorded and refunded.
   */
  async fulfilCheckout(input: FulfilmentInput): Promise<FulfilmentOutcome> {
    const { db, env, payments, mailer } = this.deps
    const already = await db.query.payments.findFirst({
      where: { stripeCheckoutSessionId: input.sessionId },
    })
    if (already) return this.retryDuplicateRefund(already)
    const enrollment = await this.enrollmentForSession(input.sessionId, input.metadata)
    if (!enrollment) return 'unmatched'
    if (!input.paymentIntentId)
      throw new Error(`checkout session ${input.sessionId} has no payment intent`)

    // Who was paid comes from the session, as it was when checkout started.
    const m = input.metadata
    const payoutAccountId = m.elevatePayoutAccountId
    const profileId = m.elevateProfileId
    if (!payoutAccountId || !profileId || !UUID.test(payoutAccountId) || !UUID.test(profileId))
      return 'unattributed'
    const [payoutAccount, profile] = await Promise.all([
      db.query.payoutAccounts.findFirst({ where: { id: payoutAccountId } }),
      db.query.profiles.findFirst({ where: { id: profileId } }),
    ])
    if (!payoutAccount || !profile) return 'unattributed'

    const details = await payments.retrievePaymentDetails(input.paymentIntentId)
    const num = (key: string, fallback: number) =>
      m[key] !== undefined && m[key] !== '' ? Number(m[key]) : fallback
    const amountCents =
      details.amountCents || input.amountTotal || num('amountCents', enrollment.course.priceCents)
    const listPriceCents = num('listPriceCents', enrollment.course.priceCents)
    const discountCents = num('discountCents', Math.max(0, listPriceCents - amountCents))
    const stripeFeeEstimateCents = num('stripeFeeEstimateCents', 0)
    const commissionCents = num('commissionCents', 0)
    const applicationFeeCents = num('applicationFeeCents', stripeFeeEstimateCents + commissionCents)
    const teacherNetCents = num('teacherNetCents', amountCents - applicationFeeCents)
    // The session's own promo code: a restart may have put another one on the enrolment since.
    // Stripe drops an empty metadata value, so a session with no promo has no key at all; only a
    // session from before payees were recorded falls back to the enrolment.
    const promoCodeId = m.elevatePayoutAccountId
      ? m.promoCodeId || null
      : (m.promoCodeId ?? enrollment.promoCodeId)
    const parsedLocale = localeSchema.safeParse(m.locale)
    const locale = parsedLocale.success ? parsedLocale.data : null
    const now = this.deps.now()
    const paymentValues = {
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      profileId,
      payoutAccountId,
      stripeCheckoutSessionId: input.sessionId,
      stripePaymentIntentId: input.paymentIntentId,
      stripeChargeId: details.chargeId,
      stripeTransferId: details.transferId,
      stripeApplicationFeeId: details.applicationFeeId,
      stripeBalanceTransactionId: details.balanceTransactionId,
      currency: env.PLATFORM_CURRENCY,
      listPriceCents,
      discountCents,
      amountCents,
      stripeFeeEstimateCents,
      stripeFeeActualCents: details.stripeFeeCents,
      commissionCents,
      applicationFeeCents,
      teacherNetCents,
      platformNetCents:
        details.stripeFeeCents === null ? null : applicationFeeCents - details.stripeFeeCents,
      promoCodeId,
      status: 'succeeded' as const,
      receiptUrl: details.receiptUrl,
      paidAt: now,
    }

    // A class sale: the seat steps differ, and a class payment never reaches the duplicate paths.
    if (m.classId !== undefined) {
      if (!UUID.test(m.classId)) return 'unmatched'
      return this.fulfilClass({
        sessionId: input.sessionId,
        to: input.customerEmail ?? enrollment.user.email,
        classId: m.classId,
        enrollment,
        paymentValues,
        profile,
        stripePaidAt: details.paidAt ?? null,
        locale,
      })
    }

    const result = await db.transaction(async (tx) => {
      // The enrolment is locked first, so fulfilments of one enrolment run one after the other:
      // the same session twice (webhook against sync), or two of its sessions.
      const [locked] = await tx
        .select({ status: s.enrollments.status })
        .from(s.enrollments)
        .where(eq(s.enrollments.id, enrollment.id))
        .for('update')
      // The same session fulfilled meanwhile: its payment is there, so nothing is inserted.
      const [payment] = await tx
        .insert(s.payments)
        .values(paymentValues)
        .onConflictDoNothing()
        .returning()
      if (!payment) return null
      if (locked?.status === 'active') return { paymentId: payment.id, duplicate: true }
      // The enrolment points at the session that paid for it; a refund of that payment, and only
      // that one, removes access.
      await tx
        .update(s.enrollments)
        .set({
          status: 'active',
          enrolledAt: now,
          promoCodeId,
          stripeCheckoutSessionId: input.sessionId,
        })
        .where(eq(s.enrollments.id, enrollment.id))
      await tx
        .update(s.courses)
        .set({ enrolCount: sql`${s.courses.enrolCount} + 1` })
        .where(eq(s.courses.id, enrollment.courseId))
      if (promoCodeId)
        await tx
          .update(s.promoCodes)
          .set({ redeemedCount: sql`${s.promoCodes.redeemedCount} + 1` })
          .where(eq(s.promoCodes.id, promoCodeId))
      return { paymentId: payment.id, duplicate: false }
    })
    if (!result) return 'ignored'
    if (result.duplicate)
      return this.refundDuplicate({
        sessionId: input.sessionId,
        paymentIntentId: input.paymentIntentId,
        paymentId: result.paymentId,
        amountCents,
        profileId,
        to: input.customerEmail ?? enrollment.user.email,
        courseTitle: enrollment.course.title,
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        locale: enrollment.user.locale,
        classId: null,
      })

    await trackEvent(this.deps, {
      userId: enrollment.userId,
      name: ANALYTICS_EVENTS.checkoutCompleted,
      properties: { courseId: enrollment.courseId, amountCents, locale },
    })
    await recordAudit(this.deps, {
      actorId: null,
      action: 'payment.succeeded',
      entityType: 'enrollment',
      entityId: enrollment.id,
      profileId,
      metadata: { sessionId: input.sessionId, amountCents, payoutAccountId },
    })
    // Counted once per profile: the first payment on its payout account.
    const paidToAccount = await db.$count(
      s.payments,
      eq(s.payments.payoutAccountId, payoutAccountId),
    )
    if (paidToAccount === 1) {
      const approvedAt = profile.reviewedAt ?? null
      await trackEvent(this.deps, {
        userId: profile.ownerUserId,
        name: ANALYTICS_EVENTS.firstPayout,
        properties: {
          profileId,
          payoutAccountId,
          courseId: enrollment.courseId,
          amountCents,
          teacherNetCents,
          secondsSinceApproval: approvedAt
            ? Math.round((now.getTime() - approvedAt.getTime()) / 1000)
            : null,
        },
      })
    }
    // In the account's language, like every learner email (ADR 010).
    const lang = enrollment.user.locale ?? 'en'
    const course = enrollment.course.title
    await mailer.send(
      simpleEmail({
        to: input.customerEmail ?? enrollment.user.email,
        locale: lang,
        title: translate(lang, 'email.receipt.title', { course }),
        paragraphs: [
          translate(lang, 'email.receipt.paid', {
            amount: formatSgd(amountCents),
            course,
            teacher: profile.displayName,
          }),
          details.receiptUrl
            ? translate(lang, 'email.receipt.stripeReceipt', { url: details.receiptUrl })
            : translate(lang, 'email.receipt.noReceipt'),
          translate(lang, 'email.receipt.start'),
        ],
        cta: {
          href: `${env.LEARNER_URL}/learn/${enrollment.id}`,
          label: translate(lang, 'email.receipt.button'),
        },
      }),
    )
    return 'applied'
  }

  /**
   * The class branch of `fulfilCheckout`, by the fulfilment table. One transaction locks the class
   * row and then the enrollment row, always in that order, records the payment with its class,
   * and either gives it the seat or writes a `seat_lost` seat refund row. The seat is refused when
   * the enrollment is already active on another payment. Neither branch touches
   * `courses.enrol_count`: a class seat is not counted as an enrolment in the course.
   */
  private async fulfilClass(input: {
    sessionId: string
    to: string
    classId: string
    enrollment: {
      id: string
      userId: string
      courseId: string
      user: { locale: Locale | null }
      course: { title: string }
    }
    paymentValues: typeof s.payments.$inferInsert & { amountCents: number }
    profile: { ownerUserId: string; displayName: string; reviewedAt: Date | null }
    /** Stripe's time for the payment, when the provider reports it. */
    stripePaidAt: Date | null
    locale: Locale | null
  }): Promise<FulfilmentOutcome> {
    const { db, env, mailer } = this.deps
    const { enrollment, classId, paymentValues } = input
    const now = this.deps.now()
    const promoCodeId = paymentValues.promoCodeId ?? null
    let result: { paymentId: string; seat: boolean } | null
    try {
      result = await db.transaction(async (tx) => {
        const [cls] = await tx
          .select({
            seats: s.classes.seats,
            status: s.classes.status,
            cancelledAt: s.classes.cancelledAt,
          })
          .from(s.classes)
          .where(eq(s.classes.id, classId))
          .for('update')
        const [locked] = await tx
          .select({
            status: s.enrollments.status,
            classId: s.enrollments.classId,
            seatReservedUntil: s.enrollments.seatReservedUntil,
          })
          .from(s.enrollments)
          .where(eq(s.enrollments.id, enrollment.id))
          .for('update')
        if (!cls || !locked) throw new Error(`class checkout ${input.sessionId} has no class`)
        // The same session fulfilled meanwhile: its payment is there, so nothing is inserted.
        const [payment] = await tx
          .insert(s.payments)
          .values({ ...paymentValues, classId })
          .onConflictDoNothing()
          .returning()
        if (!payment) return null
        const [first] = await tx
          .select({ startsAt: min(s.classBlocks.startsAt) })
          .from(s.classBlocks)
          .where(eq(s.classBlocks.classId, classId))
        const taken = await seatsTaken(tx as unknown as Tx, classId, now, enrollment.id)
        const decision =
          locked.status === 'active' || locked.classId !== classId
            ? 'seat_lost'
            : fulfilmentDecision({
                classCancelled: cls.status === 'cancelled' || cls.cancelledAt !== null,
                reservedUntil: locked.seatReservedUntil,
                seatFree: taken < cls.seats,
                firstBlockStartsAt: first?.startsAt ?? now,
                paidAt: input.stripePaidAt ?? now,
                now,
              })
        if (decision === 'seat_lost') {
          await new SeatRefundsService(this.deps).request(tx as unknown as Tx, {
            enrollmentId: enrollment.id,
            paymentId: payment.id,
            classId,
            kind: 'seat_lost',
          })
          return { paymentId: payment.id, seat: false }
        }
        // The enrolment points at the session that paid for its seat, as for a self-paced one.
        await tx
          .update(s.enrollments)
          .set({
            status: 'active',
            enrolledAt: now,
            promoCodeId,
            stripeCheckoutSessionId: input.sessionId,
            seatReservedUntil: null,
          })
          .where(eq(s.enrollments.id, enrollment.id))
        if (promoCodeId)
          await tx
            .update(s.promoCodes)
            .set({ redeemedCount: sql`${s.promoCodes.redeemedCount} + 1` })
            .where(eq(s.promoCodes.id, promoCodeId))
        return { paymentId: payment.id, seat: true }
      })
    } catch (error) {
      if (error instanceof HttpError && error.code === 'refund_in_progress')
        throw new SeatLostBlockedError(input.sessionId)
      throw error
    }
    if (!result) return 'ignored'
    const { amountCents, profileId, payoutAccountId } = paymentValues
    await recordAudit(this.deps, {
      actorId: null,
      action: 'payment.succeeded',
      entityType: 'enrollment',
      entityId: enrollment.id,
      profileId,
      metadata: {
        sessionId: input.sessionId,
        amountCents,
        payoutAccountId,
        classId,
        seatLost: !result.seat,
      },
    })
    if (!result.seat) return 'seat_lost'
    await trackEvent(this.deps, {
      userId: enrollment.userId,
      name: ANALYTICS_EVENTS.checkoutCompleted,
      properties: { courseId: enrollment.courseId, classId, amountCents, locale: input.locale },
    })
    const paidToAccount = await db.$count(
      s.payments,
      eq(s.payments.payoutAccountId, payoutAccountId),
    )
    if (paidToAccount === 1) {
      const approvedAt = input.profile.reviewedAt ?? null
      await trackEvent(this.deps, {
        userId: input.profile.ownerUserId,
        name: ANALYTICS_EVENTS.firstPayout,
        properties: {
          profileId,
          payoutAccountId,
          courseId: enrollment.courseId,
          classId,
          amountCents,
          teacherNetCents: paymentValues.teacherNetCents,
          secondsSinceApproval: approvedAt
            ? Math.round((now.getTime() - approvedAt.getTime()) / 1000)
            : null,
        },
      })
    }
    const cls = await db.query.classes.findFirst({
      where: { id: classId },
      with: { blocks: { columns: { startsAt: true, endsAt: true } } },
    })
    if (cls) {
      await mailer.send(
        classReceiptEmail({
          to: input.to,
          locale: enrollment.user.locale ?? 'en',
          learnerUrl: env.LEARNER_URL,
          enrollmentId: enrollment.id,
          class: cls,
          courseTitle: enrollment.course.title,
          teacher: input.profile.displayName,
          amountCents,
          receiptUrl: paymentValues.receiptUrl ?? null,
        }),
      )
    }
    return 'applied'
  }

  /**
   * A payment already on record for this session. If it is a duplicate whose refund did not
   * happen (the refund failed, or the process stopped after the payment was written), the refund
   * is tried again; anything else is done.
   */
  private async retryDuplicateRefund(
    payment: typeof s.payments.$inferSelect,
  ): Promise<FulfilmentOutcome> {
    // A class payment that got no seat has a `seat_lost` row instead; it never comes here.
    if (payment.classId) return 'ignored'
    if (payment.status !== 'succeeded' || !payment.stripePaymentIntentId) return 'ignored'
    const enrollment = await this.deps.db.query.enrollments.findFirst({
      where: { id: payment.enrollmentId },
      with: { course: true, user: true },
    })
    if (
      enrollment?.status !== 'active' ||
      enrollment.stripeCheckoutSessionId === payment.stripeCheckoutSessionId
    )
      return 'ignored'
    return this.refundDuplicate({
      sessionId: payment.stripeCheckoutSessionId,
      paymentIntentId: payment.stripePaymentIntentId,
      paymentId: payment.id,
      amountCents: payment.amountCents,
      profileId: payment.profileId,
      to: enrollment.user.email,
      courseTitle: enrollment.course.title,
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      locale: enrollment.user.locale,
      classId: payment.classId,
    })
  }

  /**
   * A second paid session for an enrolment that is already active: the learner paid in two tabs,
   * or paid the old session before a restart could close it. The payment stays on record and is
   * refunded in full; the enrolment, the counts and the promo code stay as the first payment left
   * them. The learner gets one email. A failed refund is logged and audited for Support.
   */
  private async refundDuplicate(input: {
    sessionId: string
    paymentIntentId: string
    paymentId: string
    amountCents: number
    profileId: string
    to: string
    courseTitle: string
    enrollmentId: string
    userId: string
    /** The learner's account language, for the email. */
    locale: Locale | null
    /** Set for a class payment, which is never refunded here. */
    classId: string | null
  }): Promise<FulfilmentOutcome> {
    if (input.classId) return 'ignored'
    const { env, payments, mailer, log } = this.deps
    const reason = 'Duplicate payment: already enrolled through another checkout'
    const audit = (metadata: Record<string, unknown>) =>
      recordAudit(this.deps, {
        actorId: null,
        action: 'payment.duplicate',
        entityType: 'payment',
        entityId: input.paymentId,
        profileId: input.profileId,
        metadata: { sessionId: input.sessionId, amountCents: input.amountCents, ...metadata },
      })
    let refund: Awaited<ReturnType<typeof payments.createRefund>>
    try {
      refund = await payments.createRefund({
        paymentIntentId: input.paymentIntentId,
        reason,
        metadata: { paymentId: input.paymentId, enrollmentId: input.enrollmentId },
        idempotencyKey: `duplicate-refund:${input.sessionId}`,
      })
    } catch (error) {
      // A webhook and a success-page poll can refund the same duplicate at once; if the other
      // one got there, this is not a failure.
      const now = await this.deps.db.query.payments.findFirst({ where: { id: input.paymentId } })
      if (now?.status === 'refunded') return 'duplicate'
      const message = error instanceof Error ? error.message : String(error)
      log.error('could not refund a duplicate payment', {
        sessionId: input.sessionId,
        paymentId: input.paymentId,
        error: message,
      })
      await audit({ refunded: false, error: message })
      return 'duplicate_unrefunded'
    }
    const recorded = await new TransactionsService(this.deps).applyRefund({
      paymentId: input.paymentId,
      stripeRefundId: refund.refundId,
      amountCents: refund.amountCents,
      reason,
      requestedBy: null,
    })
    // Recorded once: a second call for the same refund (a racing poll, or the charge.refunded
    // webhook first, which has told the learner itself) adds nothing.
    if (!recorded) return 'duplicate'
    await audit({ refunded: true, stripeRefundId: refund.refundId })
    await trackEvent(this.deps, {
      userId: input.userId,
      name: ANALYTICS_EVENTS.refundIssued,
      properties: { paymentId: input.paymentId, amountCents: refund.amountCents, duplicate: true },
    })
    // Normally the first payment still stands. If Support refunded that one meanwhile, this
    // refund was the last payment and access has gone; the email says which.
    const enrollment = await this.deps.db.query.enrollments.findFirst({
      where: { id: input.enrollmentId },
    })
    const kept = enrollment?.status === 'active'
    const lang = input.locale ?? 'en'
    const course = input.courseTitle
    await mailer.send(
      simpleEmail({
        to: input.to,
        locale: lang,
        title: translate(lang, 'email.duplicate.title', { course }),
        paragraphs: [
          translate(lang, 'email.duplicate.refunded', {
            course,
            amount: formatSgd(refund.amountCents),
          }),
          translate(lang, kept ? 'email.duplicate.kept' : 'email.duplicate.removed'),
        ],
        ...(kept
          ? {
              cta: {
                href: `${env.LEARNER_URL}/learn/${input.enrollmentId}`,
                label: translate(lang, 'email.duplicate.button'),
              },
            }
          : {}),
      }),
    )
    return 'duplicate'
  }
}
