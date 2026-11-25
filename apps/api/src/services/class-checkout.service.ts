import {
  ANALYTICS_EVENTS,
  type CheckoutStartResponse,
  CLASS_PAYMENT_METHODS,
  type ClassCheckoutRequest,
  type ClassCheckoutView,
  type ClassForSale,
  classOnSale,
  type NotOnSaleReason,
  REFUND_TERMS_VERSION,
  RESERVATION_WINDOW_MS,
  reservationAllowed,
  SEAT_RESERVATION_MS,
  seatsLeft,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, eq, gt, isNotNull, ne, or, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import type { Env } from '../env'
import { errors, HttpError } from '../lib/errors'
import { isPayable } from '../lib/payout'
import type { SessionUser } from '../middleware/auth'
import type { CheckoutSessionResult } from '../providers/payments/types'
import { trackEvent } from './audit.service'
import { loadActor } from './auth.service'
import { nameOf } from './classes.service'
import { MediaService } from './media.service'
import {
  assertChargeable,
  checkoutMetadata,
  fulfilmentInput,
  PaymentsService,
} from './payments.service'
import type { Tx } from './seat-refunds.service'

/**
 * Seats taken in a class: its enrollments that are `active`, or `pending_payment` with a
 * reservation in the future. Counted when read, so a reservation ends by the clock and no job
 * ends it. `exceptEnrollmentId` leaves one learner's row out. The one count of seats: checkout,
 * fulfilment, the course page and class edits all use it.
 */
export async function seatsTaken(
  tx: Tx,
  classId: string,
  now: Date,
  exceptEnrollmentId?: string,
): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(s.enrollments)
    .where(
      and(
        eq(s.enrollments.classId, classId),
        or(
          eq(s.enrollments.status, 'active'),
          and(
            eq(s.enrollments.status, 'pending_payment'),
            gt(s.enrollments.seatReservedUntil, now),
          ),
        ),
        exceptEnrollmentId ? ne(s.enrollments.id, exceptEnrollmentId) : undefined,
      ),
    )
  return row?.n ?? 0
}

/** What `classOnSale` reads, as `loadForSale` and the course page load it. */
export const FOR_SALE_RELATIONS = {
  blocks: { orderBy: { position: 'asc' } },
  course: { with: { thumbnail: true } },
  profile: { with: { payoutAccount: true } },
  instructor: { columns: { name: true, email: true } },
} as const

type ClassRow = typeof s.classes.$inferSelect
export type ClassForSaleRow = ClassRow & {
  blocks: (typeof s.classBlocks.$inferSelect)[]
  course: typeof s.courses.$inferSelect & { thumbnail: typeof s.mediaAssets.$inferSelect | null }
  profile: typeof s.profiles.$inferSelect & {
    payoutAccount: typeof s.payoutAccounts.$inferSelect | null
  }
  instructor: { name: string | null; email: string }
}

/** `true` when learners can buy a seat in the class now, or the first reason they cannot. */
export function onSale(
  env: Pick<Env, 'CLASS_SALES'>,
  row: Pick<ClassRow, 'status' | 'cancelledAt'> & {
    blocks: readonly { startsAt: Date; endsAt: Date }[]
    course: { status: string }
    profile: Pick<typeof s.profiles.$inferSelect, 'classSalesAcceptedAt'> & {
      payoutAccount: typeof s.payoutAccounts.$inferSelect | null
    }
  },
  now: Date,
): true | NotOnSaleReason {
  const account = row.profile.payoutAccount
  return classOnSale({
    class: row,
    blocks: row.blocks,
    profile: row.profile,
    payoutAccount: account
      ? {
          payoutMode: account.payoutMode,
          leaveRequestedAt: account.leaveRequestedAt,
          payable: isPayable(account),
        }
      : null,
    course: row.course,
    salesEnabled: env.CLASS_SALES,
    now,
  })
}

/** A class as the course page and class checkout show it. */
export function toClassForSale(row: ClassForSaleRow, left: number): ClassForSale {
  return {
    id: row.id,
    name: row.name,
    delivery: row.delivery,
    venueAddress: row.venueAddress,
    timeZone: row.timeZone,
    blocks: [...row.blocks]
      .sort((a, b) => a.position - b.position)
      .map((b) => ({ startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString() })),
    seatsLeft: left,
    instructorName: nameOf(row.instructor),
  }
}

const notOnSale = (reason: NotOnSaleReason) =>
  new HttpError(409, 'class_not_on_sale', 'This class is not open for booking.', { reason })

const requiresPayment = () =>
  errors.unprocessable('class_requires_payment', 'This code cannot be used on a class.')

type Reserved =
  | { kind: 'current'; enrollmentId: string; sessionId: string | null }
  | { kind: 'new'; enrollmentId: string; previousSessionId: string | null; ended: string[] }

/**
 * Class checkout (docs/designs/scheduled-classes-selling.md, "Buying a seat"). It shares the quote
 * and the payment page with self-paced checkout and adds the seat steps: a seat is reserved for
 * 35 minutes from the moment the learner starts paying, and fulfilment gives the payment the
 * seat or returns it. This is the one file that makes a class enrollment.
 */
export class ClassCheckoutService {
  private readonly payments: PaymentsService
  private readonly media: MediaService
  constructor(private readonly deps: Deps) {
    this.payments = new PaymentsService(deps)
    this.media = new MediaService(deps)
  }

  private async loadForSale(classId: string): Promise<ClassForSaleRow> {
    const row = await this.deps.db.query.classes.findFirst({
      where: { id: classId },
      with: FOR_SALE_RELATIONS,
    })
    if (!row) throw errors.notFound('Class')
    return row
  }

  private assertOnSale(row: ClassForSaleRow): void {
    const reason = onSale(this.deps.env, row, this.deps.now())
    if (reason !== true) throw notOnSale(reason)
  }

  /**
   * `GET /checkout/classes/:classId`: what the class checkout page shows. A promo code that makes
   * the seat free is refused, and so is a price under the minimum charge.
   */
  async view(classId: string, promoCode?: string): Promise<ClassCheckoutView> {
    const { db, env } = this.deps
    const row = await this.loadForSale(classId)
    this.assertOnSale(row)
    const quoted = await this.payments.quoteFor(row.courseId, promoCode)
    if (quoted.quote.isFree) throw requiresPayment()
    assertChargeable(quoted.quote)
    const taken = await seatsTaken(db, row.id, this.deps.now())
    return {
      class: toClassForSale(row, seatsLeft(row.seats, taken)),
      courseSlug: row.course.slug,
      courseTitle: row.course.title,
      quote: quoted,
      refundTermsVersion: REFUND_TERMS_VERSION,
      stripeFeeBps: env.STRIPE_FEE_BPS,
      stripeFixedCents: env.STRIPE_FEE_FIXED_CENTS,
    }
  }

  /**
   * `POST /checkout/classes/:classId`, in the five steps of "Buying a seat". A current reservation
   * is answered with its own payment page and is never extended.
   */
  async start(
    user: SessionUser,
    classId: string,
    input: ClassCheckoutRequest,
  ): Promise<CheckoutStartResponse> {
    const { db, env, payments } = this.deps
    // 1. The class, on sale.
    const row = await this.loadForSale(classId)
    this.assertOnSale(row)
    // 2. Not the profile's own people, and the terms the page showed are the current ones.
    const actor = await loadActor(this.deps, user, row.profileId)
    if (actor && actor.role !== 'staff') {
      throw new HttpError(
        403,
        'own_class',
        'You cannot book a seat in a class you teach or manage.',
      )
    }
    if (input.termsVersion !== REFUND_TERMS_VERSION) {
      throw new HttpError(
        409,
        'terms_changed',
        'The refund terms have changed. Reload this page to read them.',
        { current: REFUND_TERMS_VERSION },
      )
    }
    // 3. The quote: never free, never under the minimum.
    const { quote: q, promo } = await this.payments.quoteFor(row.courseId, input.promoCode)
    if (q.isFree) throw requiresPayment()
    assertChargeable(q)
    const promoRow = promo
      ? await db.query.promoCodes.findFirst({ where: { code: promo.code } })
      : null
    const account = row.profile.payoutAccount
    if (!isPayable(account)) throw notOnSale('account_not_payable')

    // 4. The reservation, under a lock on the class row.
    const now = this.deps.now()
    const reserved = await db.transaction(async (tx): Promise<Reserved> => {
      const [locked] = await tx
        .select({ seats: s.classes.seats })
        .from(s.classes)
        .where(eq(s.classes.id, row.id))
        .for('update')
      const [existing] = await tx
        .select()
        .from(s.enrollments)
        .where(and(eq(s.enrollments.userId, user.id), eq(s.enrollments.classId, row.id)))
        .for('update')
      if (existing?.status === 'active') {
        throw new HttpError(409, 'already_in_class', 'You already have a seat in this class.', {
          enrollmentId: existing.id,
        })
      }
      if (
        existing?.status === 'pending_payment' &&
        existing.seatReservedUntil !== null &&
        existing.seatReservedUntil.getTime() > now.getTime()
      ) {
        return {
          kind: 'current',
          enrollmentId: existing.id,
          sessionId: existing.stripeCheckoutSessionId,
        }
      }
      const allowed = reservationAllowed({
        count: existing?.reservationCount ?? 0,
        since: existing?.reservationCountSince ?? null,
        now,
      })
      if (allowed !== true) {
        throw new HttpError(
          429,
          'too_many_reservations',
          'You have started paying for this class too many times. Try again later.',
          { retryAt: allowed.toISOString() },
        )
      }
      const since = existing?.reservationCountSince ?? null
      const inWindow =
        since !== null && now.getTime() - since.getTime() < RESERVATION_WINDOW_MS && !!existing
      const taken = await seatsTaken(tx as unknown as Tx, row.id, now, existing?.id)
      if (taken >= (locked?.seats ?? row.seats)) {
        throw new HttpError(409, 'class_full', 'This class is full.')
      }
      // A learner holds one reservation per course: one in another class of it ends here.
      const ended = await tx
        .update(s.enrollments)
        .set({ seatReservedUntil: now })
        .where(
          and(
            eq(s.enrollments.userId, user.id),
            eq(s.enrollments.courseId, row.courseId),
            isNotNull(s.enrollments.classId),
            ne(s.enrollments.classId, row.id),
            eq(s.enrollments.status, 'pending_payment'),
            gt(s.enrollments.seatReservedUntil, now),
          ),
        )
        .returning({ sessionId: s.enrollments.stripeCheckoutSessionId })
      const reservation = {
        status: 'pending_payment' as const,
        seatReservedUntil: new Date(now.getTime() + SEAT_RESERVATION_MS),
        reservationCount: inWindow && existing ? existing.reservationCount + 1 : 1,
        reservationCountSince: inWindow ? since : now,
        refundTermsVersion: input.termsVersion,
        promoCodeId: promoRow?.id ?? null,
      }
      let enrollmentId: string
      if (existing) {
        await tx.update(s.enrollments).set(reservation).where(eq(s.enrollments.id, existing.id))
        enrollmentId = existing.id
      } else {
        const [created] = await tx
          .insert(s.enrollments)
          .values({ userId: user.id, courseId: row.courseId, classId: row.id, ...reservation })
          .returning()
        if (!created) throw new Error('failed to reserve a seat')
        enrollmentId = created.id
      }
      return {
        kind: 'new',
        enrollmentId,
        previousSessionId: existing?.stripeCheckoutSessionId ?? null,
        ended: ended.flatMap((e) => (e.sessionId ? [e.sessionId] : [])),
      }
    })
    const { enrollmentId } = reserved
    const started = () =>
      trackEvent(this.deps, {
        userId: user.id,
        name: ANALYTICS_EVENTS.checkoutStarted,
        properties: {
          courseId: row.courseId,
          classId: row.id,
          amountCents: q.amountCents,
          locale: input.locale ?? null,
        },
      })

    // A current reservation goes back to its open page. One whose page has gone (a double
    // submit read it before the page was stored) gets a page for the same reservation.
    let previousSessionId: string | null
    if (reserved.kind === 'current') {
      const current = reserved.sessionId
        ? await payments.retrieveCheckoutSession(reserved.sessionId).catch(() => null)
        : null
      if (current?.status === 'open' && current.url) {
        await started()
        return { kind: 'redirect', url: current.url, sessionId: current.id }
      }
      if (current && (await this.paid(current, enrollmentId))) {
        return { kind: 'enrolled', enrollmentId }
      }
      previousSessionId = reserved.sessionId
    } else {
      previousSessionId = reserved.previousSessionId
    }

    // 5. The payment page: cards and PayNow only, and no Link button.
    const lang = input.locale ? `&lang=${input.locale}` : ''
    const metadata: Record<string, string> = {
      ...checkoutMetadata({
        enrollmentId,
        courseId: row.courseId,
        userId: user.id,
        payoutAccountId: account.id,
        profileId: row.profileId,
        promoCodeId: promoRow?.id ?? null,
        quote: q,
        locale: input.locale,
      }),
      classId: row.id,
      refundTermsVersion: input.termsVersion,
    }
    let session: { id: string; url: string }
    try {
      session = await payments.createCheckoutSession({
        enrollmentId,
        payoutAccountId: account.id,
        profileId: row.profileId,
        courseTitle: row.course.title,
        productName: `${row.course.title}: ${row.name}`,
        courseImageUrl: await this.media.publicUrl(row.course.thumbnail),
        amountCents: q.amountCents,
        currency: env.PLATFORM_CURRENCY,
        applicationFeeCents: q.applicationFeeCents,
        destinationAccountId: account.stripeAccountId,
        customerEmail: user.email,
        successUrl: `${env.LEARNER_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}${lang}`,
        cancelUrl: `${env.LEARNER_URL}/course/${row.course.slug}?class=${row.id}&checkout=cancelled${lang}`,
        locale: input.locale,
        replacesSessionId: previousSessionId ?? undefined,
        allowedPaymentMethods: CLASS_PAYMENT_METHODS,
        hideLink: true,
        metadata,
      })
    } catch (error) {
      // No page, so no seat held for one: the reservation ends (it still counts toward the limit).
      if (reserved.kind === 'new') {
        await db
          .update(s.enrollments)
          .set({ seatReservedUntil: now })
          .where(
            and(eq(s.enrollments.id, enrollmentId), eq(s.enrollments.status, 'pending_payment')),
          )
      }
      throw error
    }
    const dropNew = () => this.expire(session.id, 'an unused class checkout session')
    // The pages of the reservations this one ended can no longer be paid.
    if (reserved.kind === 'new') {
      for (const sessionId of reserved.ended) await this.expire(sessionId, 'an ended reservation')
    }
    // The row's earlier page is closed. If the learner paid it meanwhile, that payment stands.
    if (previousSessionId && previousSessionId !== session.id) {
      const closed = await this.expire(previousSessionId, 'a replaced class checkout session')
      if (closed && (await this.paid(closed, enrollmentId))) {
        await dropNew()
        return { kind: 'enrolled', enrollmentId }
      }
    }
    const [pointed] = await db
      .update(s.enrollments)
      .set({ stripeCheckoutSessionId: session.id })
      .where(and(eq(s.enrollments.id, enrollmentId), ne(s.enrollments.status, 'active')))
      .returning({ id: s.enrollments.id })
    if (!pointed) {
      await dropNew()
      return { kind: 'enrolled', enrollmentId }
    }
    await started()
    return { kind: 'redirect', url: session.url, sessionId: session.id }
  }

  /** Expires a payment page; a failure is logged, and fulfilment still refuses a lost seat. */
  private async expire(sessionId: string, what: string): Promise<CheckoutSessionResult | null> {
    return this.deps.payments.expireCheckoutSession(sessionId).catch((error) => {
      this.deps.log.warn(`could not expire ${what}`, {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    })
  }

  /** Fulfils a paid page and says whether the learner now has the seat. */
  private async paid(session: CheckoutSessionResult, enrollmentId: string): Promise<boolean> {
    if (session.paymentStatus !== 'paid') return false
    await this.payments.fulfilCheckout(fulfilmentInput(session))
    const enrollment = await this.deps.db.query.enrollments.findFirst({
      where: { id: enrollmentId },
      columns: { status: true },
    })
    return enrollment?.status === 'active'
  }
}
