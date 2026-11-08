import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { citext, createdAt, id, ts, updatedAt } from './columns'
import { courses } from './courses'
import { enrollmentModeEnum, enrollmentStatusEnum, paymentStatusEnum, promoTypeEnum } from './enums'

/** Platform-managed promo codes (not Stripe promotion codes) so the application fee stays exact. */
export const promoCodes = pgTable('promo_codes', {
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

/** Placeholder for class-based attendance (unused in MVP, present per spec). */
export type AttendanceRecord = {
  sessionId: string
  checkedInAt: string
  method: 'qr' | 'gps' | 'manual'
}

export const enrollments = pgTable(
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
    attendanceRecords: jsonb().$type<AttendanceRecord[]>().notNull().default(sql`'[]'::jsonb`),
    promoCodeId: uuid().references(() => promoCodes.id, { onDelete: 'set null' }),
    stripeCheckoutSessionId: text().unique(),
    enrolledAt: ts(),
    completedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.userId, t.courseId),
    index().on(t.courseId),
    index().on(t.userId, t.status),
  ],
)

export const payments = pgTable(
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
    teacherId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
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
  },
  (t) => [index().on(t.teacherId, t.paidAt), index().on(t.courseId), index().on(t.userId)],
)

export const refunds = pgTable('refunds', {
  id: id(),
  paymentId: uuid()
    .notNull()
    .references(() => payments.id, { onDelete: 'restrict' }),
  stripeRefundId: text().notNull().unique(),
  amountCents: integer().notNull(),
  reason: text(),
  requestedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
})
