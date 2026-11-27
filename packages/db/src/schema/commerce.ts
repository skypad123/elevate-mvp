import { isNull, sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  snakeCase,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { classes } from './classes'
import { citext, createdAt, id, ts, updatedAt } from './columns'
import { courses } from './courses'
import { enrollmentModeEnum, enrollmentStatusEnum, paymentStatusEnum, promoTypeEnum } from './enums'
import { payoutRuns, payouts, seatRefunds } from './payouts'
import { payoutAccounts, profiles } from './profiles'

/** Platform-managed promo codes (not Stripe promotion codes) so the application fee stays exact. */
export const promoCodes = snakeCase.table('promo_codes', {
  id: id(),
  code: citext().notNull().unique(),
  type: promoTypeEnum().notNull(),
  /** percent: 0–100 · fixed: cents */
  value: integer().notNull(),
  /** null = platform-wide */
  courseId: uuid().references(() => courses.id, { onDelete: 'cascade' }),
  maxRedemptions: integer(),
  redeemedCount: integer().notNull().default(0),
  startsAt: ts(),
  expiresAt: ts(),
  active: boolean().notNull().default(true),
  createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
})

/**
 * The old placeholder for class attendance. Superseded by `attendance_events` (see `classes.ts`):
 * nothing may write it.
 */
export type AttendanceRecord = {
  sessionId: string
  checkedInAt: string
  method: 'qr' | 'gps' | 'manual'
}

export const enrollments = snakeCase.table(
  'enrollments',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    mode: enrollmentModeEnum().notNull().default('self_directed'),
    status: enrollmentStatusEnum().notNull().default('pending_payment'),
    /** Superseded by `attendance_events`; never written. */
    attendanceRecords: jsonb().$type<AttendanceRecord[]>().notNull().default(sql`'[]'::jsonb`),
    promoCodeId: uuid().references(() => promoCodes.id, { onDelete: 'set null' }),
    stripeCheckoutSessionId: text().unique(),
    /**
     * Null for a self-paced enrollment (every row before scheduled classes); set for a class
     * enrollment. `classes.ts` imports this file, hence the typed callback.
     */
    classId: uuid().references((): AnyPgColumn => classes.id, { onDelete: 'restrict' }),
    // Class enrollments only (docs/designs/scheduled-classes-selling.md).
    /** A `pending_payment` class enrollment with this in the future is a reservation. */
    seatReservedUntil: ts(),
    /** Reservations started for this class since `reservationCountSince`: 3 in 24 hours. */
    reservationCount: integer().notNull().default(0),
    reservationCountSince: ts(),
    /** The version of the refund terms the learner was shown. */
    refundTermsVersion: text(),
    /** Set by a move. */
    movedAt: ts(),
    movedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    movedFromClassId: uuid().references((): AnyPgColumn => classes.id, { onDelete: 'restrict' }),
    /** Set by a move, and by a block-time edit while the learner holds a seat. */
    classChangedAt: ts(),
    enrolledAt: ts(),
    completedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One self-paced enrollment per learner and course, and one enrollment per learner and class.
    uniqueIndex('enrollments_one_self_paced_per_course')
      .on(t.userId, t.courseId)
      .where(sql`${t.classId} is null`),
    uniqueIndex('enrollments_one_per_class')
      .on(t.userId, t.classId)
      .where(sql`${t.classId} is not null`),
    index().on(t.courseId, t.status),
    index().on(t.userId, t.status),
    index().on(t.classId),
    index().on(t.classId, t.status),
  ],
)

/**
 * The enrollments that are not class enrollments. The learner database client's `enrollments`
 * reads this view (see `learner-relations.ts`), so existing learner reads keep meaning
 * "self-paced" and a class enrollment looked up through it is not found.
 */
export const selfPacedEnrollments = snakeCase
  .view('self_paced_enrollments')
  .as((qb) => qb.select().from(enrollments).where(isNull(enrollments.classId)))

export const payments = snakeCase.table(
  'payments',
  {
    id: id(),
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollments.id, { onDelete: 'restrict' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    /** The profile at the time of sale, kept for audit. Money queries go by `payoutAccountId`. */
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    /** The account this sale paid. Set once at fulfilment and never updated. */
    payoutAccountId: uuid()
      .notNull()
      .references(() => payoutAccounts.id, { onDelete: 'restrict' }),
    stripeCheckoutSessionId: text().notNull().unique(),
    stripePaymentIntentId: text().unique(),
    stripeChargeId: text(),
    stripeTransferId: text(),
    stripeApplicationFeeId: text(),
    stripeBalanceTransactionId: text(),
    currency: text().notNull().default('sgd'),
    listPriceCents: integer().notNull(),
    discountCents: integer().notNull().default(0),
    amountCents: integer().notNull(),
    stripeFeeEstimateCents: integer().notNull(),
    stripeFeeActualCents: integer(),
    commissionCents: integer().notNull(),
    applicationFeeCents: integer().notNull(),
    teacherNetCents: integer().notNull(),
    /** applicationFee − actual Stripe fee, filled once the balance transaction is known. */
    platformNetCents: integer(),
    promoCodeId: uuid().references(() => promoCodes.id, { onDelete: 'set null' }),
    status: paymentStatusEnum().notNull().default('succeeded'),
    refundedCents: integer().notNull().default(0),
    receiptUrl: text(),
    paidAt: ts().notNull().defaultNow(),
    createdAt: createdAt(),
    // Class sales (docs/designs/scheduled-classes-selling.md).
    /** Set at fulfilment for a class sale; null for self-paced. Follows the seat on a move. */
    classId: uuid().references((): AnyPgColumn => classes.id, { onDelete: 'restrict' }),
    /** The run in which this payment stopped being held. */
    releasedRunId: uuid().references((): AnyPgColumn => payoutRuns.id, { onDelete: 'restrict' }),
    releasedAt: ts(),
    /** `due`, `support` or `day_limit`. */
    releaseReason: text(),
    bankDisputeId: text(),
    /** `open`, `won` or `lost`. */
    bankDisputeStatus: text(),
    bankDisputedAt: ts(),
    /** The payout that paid this payment, and the amount it counted for. */
    payoutId: uuid().references((): AnyPgColumn => payouts.id, { onDelete: 'restrict' }),
    paidOutCents: integer(),
  },
  (t) => [
    index().on(t.profileId, t.paidAt),
    index().on(t.payoutAccountId, t.paidAt),
    index().on(t.courseId),
    index().on(t.userId),
    index().on(t.paidAt),
    index().on(t.status, t.paidAt),
    index().on(t.classId),
    index().on(t.payoutAccountId, t.payoutId),
  ],
)

export const refunds = snakeCase.table('refunds', {
  id: id(),
  paymentId: uuid()
    .notNull()
    .references(() => payments.id, { onDelete: 'restrict' }),
  stripeRefundId: text().notNull().unique(),
  amountCents: integer().notNull(),
  reason: text(),
  requestedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  /**
   * The part of Elevate's fee returned to the profile with this refund. Null for a refund made
   * before seat refunds, which returned the fee in proportion.
   */
  applicationFeeRefundedCents: integer(),
  /** The seat refund row this refund completes, if the release job sent it. */
  seatRefundId: uuid().references((): AnyPgColumn => seatRefunds.id, { onDelete: 'restrict' }),
})
