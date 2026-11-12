import {
  ANALYTICS_EVENTS,
  type CheckoutStartResponse,
  type CheckoutSyncResponse,
  formatSgd,
  type PromoDiscount,
  type QuoteResponse,
  quote,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors } from '../lib/errors'
import { isPayable } from '../lib/payout'
import type { SessionUser } from '../middleware/auth'
import { recordAudit, trackEvent } from './audit.service'
import { MediaService } from './media.service'

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
 */
export type FulfilmentOutcome = 'applied' | 'ignored' | 'unmatched' | 'unattributed'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
      throw errors.badRequest('promo_invalid', 'That code does not apply to this course')
    if (promo.startsAt && promo.startsAt > now)
      throw errors.badRequest('promo_invalid', 'That code is not active yet')
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
    promoCode?: string,
  ): Promise<CheckoutStartResponse> {
    const { db, env, payments } = this.deps
    const course = await this.loadCourse(courseId)
    if (course.status !== 'live') throw errors.notFound('Course')
    const existing = await db.query.enrollments.findFirst({
      where: { userId: user.id, courseId },
    })
    if (existing?.status === 'active')
      throw errors.conflict('already_enrolled', 'You are already enrolled in this course')

    const { quote: q, promo } = await this.quoteFor(courseId, promoCode)
    const promoRow = promo
      ? await db.query.promoCodes.findFirst({ where: { code: promo.code } })
      : null

    // Free enrolment: no Stripe involved.
    if (q.isFree) {
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
          await tx.update(s.enrollments).set(values).where(eq(s.enrollments.id, existing.id))
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
      await trackEvent(this.deps, {
        userId: user.id,
        name: ANALYTICS_EVENTS.checkoutCompleted,
        properties: { courseId, free: true },
      })
      return { kind: 'enrolled', enrollmentId }
    }

    if (q.belowMinimum)
      throw errors.unprocessable(
        'below_minimum',
        `The discounted price is below the minimum chargeable amount (${formatSgd(100)})`,
      )
    // The error code keeps its old name so clients do not change.
    const account = course.profile.payoutAccount
    if (!isPayable(account)) {
      throw errors.conflict(
        'teacher_not_payable',
        'This teacher cannot accept payments yet. Please try again later.',
      )
    }

    // Reuse the learner's pending enrollment row so retries do not create duplicates.
    let enrollmentId: string
    if (existing) {
      await db
        .update(s.enrollments)
        .set({ status: 'pending_payment', promoCodeId: promoRow?.id ?? null })
        .where(eq(s.enrollments.id, existing.id))
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
      successUrl: `${env.LEARNER_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${env.LEARNER_URL}/course/${course.slug}?checkout=cancelled`,
      metadata: {
        enrollmentId,
        courseId,
        userId: user.id,
        elevatePayoutAccountId: account.id,
        elevateProfileId: course.profileId,
        promoCodeId: promoRow?.id ?? '',
        listPriceCents: String(q.listPriceCents),
        discountCents: String(q.discountCents),
        amountCents: String(q.amountCents),
        stripeFeeEstimateCents: String(q.stripeFeeEstimateCents),
        commissionCents: String(q.commissionCents),
        applicationFeeCents: String(q.applicationFeeCents),
        teacherNetCents: String(q.teacherNetCents),
      },
    })
    await db
      .update(s.enrollments)
      .set({ stripeCheckoutSessionId: session.id })
      .where(eq(s.enrollments.id, enrollmentId))
    await trackEvent(this.deps, {
      userId: user.id,
      name: ANALYTICS_EVENTS.checkoutStarted,
      properties: { courseId, amountCents: q.amountCents },
    })
    return { kind: 'redirect', url: session.url, sessionId: session.id }
  }

  /** Success-page poll and no-webhook fallback: re-read the session and run the same fulfilment. */
  async syncSession(user: SessionUser, sessionId: string): Promise<CheckoutSyncResponse> {
    const { db, payments } = this.deps
    const enrollment = await db.query.enrollments.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
      with: { course: true },
    })
    if (!enrollment || enrollment.userId !== user.id) throw errors.notFound('Checkout session')
    if (enrollment.status === 'active')
      return { status: 'paid', enrollmentId: enrollment.id, courseSlug: enrollment.course.slug }
    const session = await payments.retrieveCheckoutSession(sessionId)
    if (session.paymentStatus === 'paid') {
      const outcome = await this.fulfilCheckout({
        sessionId,
        paymentIntentId: session.paymentIntentId,
        amountTotal: session.amountTotal,
        customerEmail: session.customerEmail,
        metadata: session.metadata,
      })
      if (outcome === 'unattributed') {
        // Paid, but we cannot tell whom it paid. The learner keeps seeing "pending" and the
        // error is logged for Support; the webhook path stores the same failure with its event.
        this.deps.log.error('paid checkout session has no payout account', { sessionId })
        return { status: 'pending' }
      }
      return { status: 'paid', enrollmentId: enrollment.id, courseSlug: enrollment.course.slug }
    }
    return { status: session.status === 'expired' ? 'expired' : 'pending' }
  }

  /** Idempotent: a payment row exists per Checkout session, so webhook + sync cannot double-fulfil. */
  async fulfilCheckout(input: FulfilmentInput): Promise<FulfilmentOutcome> {
    const { db, env, payments, mailer } = this.deps
    const already = await db.query.payments.findFirst({
      where: { stripeCheckoutSessionId: input.sessionId },
    })
    if (already) return 'ignored'
    const enrollment = await db.query.enrollments.findFirst({
      where: { stripeCheckoutSessionId: input.sessionId },
      with: { course: true, user: true },
    })
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
    const promoCodeId = m.promoCodeId || enrollment.promoCodeId || null
    const now = this.deps.now()

    try {
      await db.transaction(async (tx) => {
        await tx.insert(s.payments).values({
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
          status: 'succeeded',
          receiptUrl: details.receiptUrl,
          paidAt: now,
        })
        await tx
          .update(s.enrollments)
          .set({ status: 'active', enrolledAt: now, promoCodeId })
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
      })
    } catch (error) {
      // A concurrent fulfilment (webhook vs sync) inserted first: treat as done.
      const message = error instanceof Error ? error.message : String(error)
      if (/unique|duplicate/i.test(message)) return 'ignored'
      throw error
    }

    await trackEvent(this.deps, {
      userId: enrollment.userId,
      name: ANALYTICS_EVENTS.checkoutCompleted,
      properties: { courseId: enrollment.courseId, amountCents },
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
    await mailer.send(
      simpleEmail({
        to: input.customerEmail ?? enrollment.user.email,
        title: `You're enrolled: ${enrollment.course.title}`,
        paragraphs: [
          `Thanks for your purchase. You paid ${formatSgd(amountCents)} for "${enrollment.course.title}" by ${profile.displayName}.`,
          details.receiptUrl
            ? `Your Stripe receipt: ${details.receiptUrl}`
            : 'A receipt is available from your Stripe payment confirmation.',
          'Start whenever you like; your progress is saved as you go.',
        ],
        cta: { href: `${env.LEARNER_URL}/learn/${enrollment.id}`, label: 'Start learning' },
      }),
    )
    return 'applied'
  }
}
