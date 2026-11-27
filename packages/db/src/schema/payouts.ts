import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  snakeCase,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { classes } from './classes'
import { createdAt, id, ts } from './columns'
import { enrollments, payments, refunds } from './commerce'
import {
  elevateCancelReasonEnum,
  payoutAdjustmentKindEnum,
  payoutOutcomeEnum,
  seatRefundKindEnum,
  seatRefundStatusEnum,
} from './enums'
import { payoutAccounts } from './profiles'

/**
 * The records the class-sales money flow adds (docs/designs/scheduled-classes-selling.md, "Data
 * model"). Requests write rows here; only the release job sends a refund or a payout to Stripe.
 * `commerce.ts` and `classes.ts` point back at these tables, hence the typed callbacks there.
 */

/**
 * One row for every refund of a seat that the system starts, written before any money moves. Its
 * amounts are worked out by `seatRefund` in `@elevate/core` when the job first sends it.
 */
export const seatRefunds = snakeCase.table(
  'seat_refunds',
  {
    id: id(),
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollments.id, { onDelete: 'restrict' }),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    classId: uuid()
      .notNull()
      .references(() => classes.id, { onDelete: 'restrict' }),
    kind: seatRefundKindEnum().notNull(),
    status: seatRefundStatusEnum().notNull().default('pending'),
    /** While `waiting`: `manual_mark`, `bank_dispute` or `stripe_fee`. */
    waitingFor: text(),
    /** When `closed`: `mark_settled`, `bank_returned` or `support`. */
    closedReason: text(),
    /** For `discretionary` only: the amount the owner or manager chose. */
    requestedCents: integer(),
    /** R and X. Null until the job first sends the row. */
    learnerRefundCents: integer(),
    feeRefundToProfileCents: integer(),
    stripeRefundId: text().unique(),
    stripeFeeRefundId: text(),
    /** For `dispute_lost` only. */
    stripeReversalId: text(),
    attempts: integer().notNull().default(0),
    firstAttemptAt: ts(),
    /** Set when the row becomes `done` or `closed`. */
    completedAt: ts(),
    error: text(),
    /** Null for `seat_lost` and `dispute_lost`. */
    reason: text(),
    cancellationId: uuid().references(() => classCancellations.id, { onDelete: 'restrict' }),
    /** Null for rows the system writes. */
    requestedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.status),
    index().on(t.paymentId),
    index().on(t.cancellationId),
    // One unfinished row per enrollment.
    uniqueIndex('seat_refunds_one_unfinished_per_enrollment')
      .on(t.enrollmentId)
      .where(sql`${t.status} in ('waiting', 'pending', 'refund_sent', 'failed')`),
    // One `dispute_lost` row per payment, however often Stripe redelivers the event.
    uniqueIndex('seat_refunds_one_dispute_lost_per_payment')
      .on(t.paymentId)
      .where(sql`${t.kind} = 'dispute_lost'`),
  ],
)

/**
 * A class's cancellation, by its profile or by Elevate. It is complete when each of its seat
 * refund rows is `done` or `closed`; `completedAt` is set then, or at once when it wrote none.
 */
export const classCancellations = snakeCase.table('class_cancellations', {
  id: id(),
  classId: uuid()
    .notNull()
    .unique()
    .references(() => classes.id, { onDelete: 'restrict' }),
  cancelledBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  byElevate: boolean().notNull(),
  reason: text().notNull(),
  /** For Elevate's cancellations only: the ground. */
  elevateReason: elevateCancelReasonEnum(),
  afterStart: boolean().notNull(),
  /** Counted when the class is cancelled: a block is untaught when it had not started. */
  blocksTotal: integer().notNull(),
  blocksUntaught: integer().notNull(),
  createdAt: createdAt(),
  completedAt: ts(),
})

/** One execution of the release job. */
export const payoutRuns = snakeCase.table('payout_runs', {
  id: id(),
  startedAt: ts().notNull().defaultNow(),
  finishedAt: ts(),
  error: text(),
  refundsSent: integer().notNull().default(0),
  classesReleased: integer().notNull().default(0),
  payoutsCreated: integer().notNull().default(0),
  needingAttention: integer().notNull().default(0),
})

/** One attempt to pay a profile: at most one a day per payout account. */
export const payouts = snakeCase.table(
  'payouts',
  {
    id: id(),
    runId: uuid()
      .notNull()
      .references(() => payoutRuns.id, { onDelete: 'restrict' }),
    payoutAccountId: uuid()
      .notNull()
      .references(() => payoutAccounts.id, { onDelete: 'restrict' }),
    /** The day in `PAYOUT_TIME_ZONE` (`@elevate/core`). */
    payDate: date({ mode: 'string' }).notNull(),
    /** The Stripe balance the run read. */
    availableCents: integer().notNull(),
    pendingCents: integer().notNull(),
    /** The held total, and the limit: the balance less held. */
    heldCents: integer().notNull(),
    limitCents: integer().notNull(),
    /** Everything payable the database names, and what the limit leaves beyond it. */
    namedCents: integer().notNull(),
    unnamedCents: integer().notNull(),
    /** The sum of the items this payout pays. */
    amountCents: integer().notNull().default(0),
    outcome: payoutOutcomeEnum().notNull(),
    /** `sending` or `sent`; null unless the outcome is `paid`. */
    sendStatus: text(),
    stripePayoutId: text().unique(),
    /** `pending`, `paid` or `failed`, from Stripe's payout events. */
    payoutStatus: text(),
    error: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.payoutAccountId, t.payDate)],
)

/**
 * An amount owed to or by a profile that is not a payment: signed, a debt is negative. Marked by
 * the payout that settles it, like a payment.
 */
export const payoutAdjustments = snakeCase.table(
  'payout_adjustments',
  {
    id: id(),
    payoutAccountId: uuid()
      .notNull()
      .references(() => payoutAccounts.id, { onDelete: 'restrict' }),
    kind: payoutAdjustmentKindEnum().notNull(),
    amountCents: integer().notNull(),
    paymentId: uuid().references((): AnyPgColumn => payments.id, { onDelete: 'restrict' }),
    refundId: uuid().references((): AnyPgColumn => refunds.id, { onDelete: 'restrict' }),
    /** Required for a `correction`, which a Support admin makes. */
    reason: text(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    payoutId: uuid().references(() => payouts.id, { onDelete: 'restrict' }),
  },
  (t) => [
    index().on(t.payoutAccountId, t.payoutId),
    uniqueIndex('payout_adjustments_one_per_refund')
      .on(t.refundId)
      .where(sql`${t.refundId} is not null`),
    uniqueIndex('payout_adjustments_one_bank_dispute_per_payment')
      .on(t.paymentId)
      .where(sql`${t.kind} = 'bank_dispute_after_payout'`),
  ],
)
