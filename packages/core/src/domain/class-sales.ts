/**
 * Selling a class (docs/designs/scheduled-classes-selling.md): when a class is on sale, seats and
 * reservations, what a late payment gets, withdrawal and moving, when held money is released, and
 * how a payout is chosen. The API, the release job and the portals read these rules, so they
 * agree on them.
 *
 * Every function is pure and takes `now` from the caller. The refund amounts are in `money.ts`,
 * the one file that computes fees.
 */
import type { MoneyAttendance } from './attendance'
import { instantToZoned } from './class-time'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// ── Constants ───────────────────────────────────────────────────────────────

/** How long a seat is kept for a learner who has started paying; the payment page lasts 30. */
export const SEAT_RESERVATION_MS = 35 * MINUTE_MS
/** Reservations one learner may start for one class in `RESERVATION_WINDOW_MS`. */
export const MAX_RESERVATIONS = 3
export const RESERVATION_WINDOW_MS = 24 * HOUR_MS
/** A learner may withdraw while the first block is more than this far away. */
export const WITHDRAWAL_CLOSES_BEFORE_MS = 7 * DAY_MS
/** A class is due for release this long after its last block ends, or after it was cancelled. */
export const RELEASE_AFTER_MS = 7 * DAY_MS
/**
 * A class's last block must end within this of a sale (counted from now), and of a seat's payment
 * for a move or a time edit.
 */
export const SEAT_HORIZON_MS = 75 * DAY_MS
/** The longest any payment is held, from the payment; then it is released and flagged. */
export const MAX_HELD_MS = 85 * DAY_MS
/** No payout is made for less. */
export const MIN_PAYOUT_CENTS = 100
export const PAYOUT_TIME_ZONE = 'Asia/Singapore'
/** Paying happens in the first run at or after this hour in `PAYOUT_TIME_ZONE`. */
export const PAY_FROM_HOUR = 10
/** The job finishes an opt-in left at `switching` for longer than this. */
export const SWITCHING_STALE_MS = 5 * MINUTE_MS
/** A seat refund row is marked `failed` after this many attempts (one day of runs). */
export const REFUND_MAX_ATTEMPTS = 96
/** Past this age a Stripe step is looked up at Stripe before it is repeated. */
export const IDEMPOTENCY_TRUST_MS = 23 * HOUR_MS
/** The held-payout terms a profile's owner accepts. */
export const CLASS_SALES_TERMS_VERSION = '2026-12'
/** The refund terms a learner is shown before paying for a seat. */
export const REFUND_TERMS_VERSION = '2026-12'
/** The only payment methods a class payment page allows. */
export const CLASS_PAYMENT_METHODS = ['card', 'paynow'] as const
export type ClassPaymentMethod = (typeof CLASS_PAYMENT_METHODS)[number]

// ── Values ──────────────────────────────────────────────────────────────────
// The lists that are Postgres enums are matched by `@elevate/db`'s `enums.ts`.

export const SEAT_REFUND_KINDS = [
  'teacher_cancelled',
  'teacher_cancelled_part',
  'changed_withdrew',
  'learner_withdrew',
  'discretionary',
  'elevate_cancelled',
  'seat_lost',
  'dispute_lost',
] as const
export type SeatRefundKind = (typeof SEAT_REFUND_KINDS)[number]

export const SEAT_REFUND_STATUSES = [
  'waiting',
  'pending',
  'refund_sent',
  'done',
  'closed',
  'failed',
] as const
export type SeatRefundStatus = (typeof SEAT_REFUND_STATUSES)[number]

/** An enrollment may have one row in these at a time; its payment is not released or paid. */
export const UNFINISHED_SEAT_REFUND_STATUSES = [
  'waiting',
  'pending',
  'refund_sent',
  'failed',
] as const satisfies readonly SeatRefundStatus[]

export const SEAT_REFUND_WAITING_FOR = ['manual_mark', 'bank_dispute', 'stripe_fee'] as const
export type SeatRefundWaitingFor = (typeof SEAT_REFUND_WAITING_FOR)[number]

export const SEAT_REFUND_CLOSED_REASONS = ['mark_settled', 'bank_returned', 'support'] as const
export type SeatRefundClosedReason = (typeof SEAT_REFUND_CLOSED_REASONS)[number]

/** The grounds on which Elevate may cancel a class (G17). */
export const ELEVATE_CANCEL_REASONS = [
  'teacher_absent',
  'venue_unavailable',
  'rules_breach',
  'profile_suspended',
  'required_by_law',
] as const
export type ElevateCancelReason = (typeof ELEVATE_CANCEL_REASONS)[number]

export const PAYOUT_OUTCOMES = ['paid', 'below_minimum', 'nothing_payable', 'failed'] as const
export type PayoutOutcome = (typeof PAYOUT_OUTCOMES)[number]

/** Null unless the outcome is `paid`. */
export const PAYOUT_SEND_STATUSES = ['sending', 'sent'] as const
export type PayoutSendStatus = (typeof PAYOUT_SEND_STATUSES)[number]

/** Follows Stripe's payout events. */
export const PAYOUT_STATUSES = ['pending', 'paid', 'failed'] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

export const PAYOUT_MODES = ['automatic', 'switching', 'manual'] as const
export type PayoutMode = (typeof PAYOUT_MODES)[number]

export const PAYOUT_ADJUSTMENT_KINDS = [
  'opening_available',
  'opening_pending',
  'refund_after_payout',
  'bank_dispute_after_payout',
  'correction',
] as const
export type PayoutAdjustmentKind = (typeof PAYOUT_ADJUSTMENT_KINDS)[number]

export const BANK_DISPUTE_STATUSES = ['open', 'won', 'lost'] as const
export type BankDisputeStatus = (typeof BANK_DISPUTE_STATUSES)[number]

export const CLASS_RELEASE_REASONS = ['due', 'support'] as const
export type ClassReleaseReason = (typeof CLASS_RELEASE_REASONS)[number]

export const PAYMENT_RELEASE_REASONS = ['due', 'support', 'day_limit'] as const
export type PaymentReleaseReason = (typeof PAYMENT_RELEASE_REASONS)[number]

/** Why a class is not on sale, in the order `classOnSale` tests them. */
export const NOT_ON_SALE_REASONS = [
  'sales_off',
  'not_published',
  'cancelled',
  'started',
  'too_far_ahead',
  'profile_not_opted_in',
  'profile_leaving',
  'account_not_payable',
  'course_not_on_sale',
] as const
export type NotOnSaleReason = (typeof NOT_ON_SALE_REASONS)[number]

export const MOVE_PROBLEMS = [
  'attended',
  'open_mark',
  'refund_in_progress',
  'bank_dispute_open',
  'different_course',
  'target_not_published',
  'target_started',
  'target_full',
  'beyond_limit',
  'already_in_target',
] as const
export type MoveProblem = (typeof MOVE_PROBLEMS)[number]

/** What `applyRefund` does to the enrollment of a class payment. */
export const ENROLLMENT_REFUND_OUTCOMES = ['refunded', 'cancelled', 'unchanged'] as const
export type EnrollmentRefundOutcome = (typeof ENROLLMENT_REFUND_OUTCOMES)[number]

export const CLASS_SALES_AUDIT_ACTIONS = [
  'class_sales.accepted',
  'class_sales.leave_requested',
  'class_sales.left',
  'class.cancelled',
  'class.cancelled_by_elevate',
  'class.learner_moved',
  'class.times_changed',
  'seat.withdrawn',
  'seat.refund_requested',
  'seat.refund_done',
  'seat.refund_retried',
  'seat.refund_closed',
  'class.review_cleared',
  'payout.created',
  'payout.failed',
  'payout.correction',
] as const
export type ClassSalesAuditAction = (typeof CLASS_SALES_AUDIT_ACTIONS)[number]

// ── Inputs ──────────────────────────────────────────────────────────────────

type Instant = Date | string | number

const toMillis = (value: Instant) =>
  value instanceof Date ? value.getTime() : new Date(value).getTime()

type Blocks = readonly { startsAt: Instant; endsAt: Instant }[]

function firstStart(blocks: Blocks): number | null {
  return blocks.length ? Math.min(...blocks.map((b) => toMillis(b.startsAt))) : null
}

function lastEnd(blocks: Blocks): number | null {
  return blocks.length ? Math.max(...blocks.map((b) => toMillis(b.endsAt))) : null
}

// ── On sale ─────────────────────────────────────────────────────────────────

export type ClassOnSaleInput = {
  class: { status: string; cancelledAt?: Instant | null }
  blocks: Blocks
  profile: { classSalesAcceptedAt: Instant | null }
  /** Null when the profile has no payout account. `payable` is `ConnectService`'s decision. */
  payoutAccount: {
    payoutMode: PayoutMode
    leaveRequestedAt: Instant | null
    payable: boolean
  } | null
  course: { status: string }
  /** The server setting `CLASS_SALES`. */
  salesEnabled: boolean
  now: Instant
}

/**
 * `true` when learners can buy a seat, or the first reason they cannot, tested in the order of
 * `NOT_ON_SALE_REASONS`. A class that was never published (or has no blocks) is `not_published`;
 * one whose status is `cancelled`, or that has a cancellation time, is `cancelled`. A profile is
 * opted in when it accepted the terms and its account's payout mode is `manual`.
 */
export function classOnSale(input: ClassOnSaleInput): true | NotOnSaleReason {
  const now = toMillis(input.now)
  if (!input.salesEnabled) return 'sales_off'
  const cancelled = input.class.status === 'cancelled' || input.class.cancelledAt != null
  if (!cancelled && input.class.status !== 'published') return 'not_published'
  if (cancelled) return 'cancelled'
  const start = firstStart(input.blocks)
  const end = lastEnd(input.blocks)
  if (start === null || end === null) return 'not_published'
  if (now >= start) return 'started'
  if (end - now > SEAT_HORIZON_MS) return 'too_far_ahead'
  const account = input.payoutAccount
  if (input.profile.classSalesAcceptedAt == null || account?.payoutMode !== 'manual') {
    return 'profile_not_opted_in'
  }
  if (account.leaveRequestedAt != null) return 'profile_leaving'
  if (!account.payable) return 'account_not_payable'
  if (input.course.status !== 'live') return 'course_not_on_sale'
  return true
}

// ── Seats and reservations ──────────────────────────────────────────────────

/**
 * Seats left, never below zero. `taken` counts the class's enrollments that are `active`, or
 * `pending_payment` with a reservation in the future.
 */
export function seatsLeft(capacity: number, taken: number): number {
  return Math.max(0, capacity - taken)
}

/**
 * Whether a learner may start another reservation for a class: `count` reservations started since
 * `since`. Three in 24 hours are allowed; a fourth is refused until `since` plus 24 hours, which is
 * returned. Once the window has passed the count starts again, which the caller records.
 */
export function reservationAllowed({
  count,
  since,
  now,
}: {
  count: number
  since: Instant | null
  now: Instant
}): true | Date {
  if (since == null) return true
  const retryAt = toMillis(since) + RESERVATION_WINDOW_MS
  if (toMillis(now) >= retryAt) return true
  return count < MAX_RESERVATIONS ? true : new Date(retryAt)
}

/**
 * What a class payment gets when it arrives (the fulfilment table): the seat when the class is not
 * cancelled and the reservation is current; or, after it ended, when a seat is free and either
 * the first block has not started or Stripe's time for the payment was inside the reservation.
 * Otherwise the seat is lost and the payment is refunded in full.
 */
export function fulfilmentDecision({
  classCancelled,
  reservedUntil,
  seatFree,
  firstBlockStartsAt,
  paidAt,
  now,
}: {
  classCancelled: boolean
  reservedUntil: Instant | null
  /** A seat is free not counting this learner's ended reservation. */
  seatFree: boolean
  firstBlockStartsAt: Instant
  paidAt: Instant
  now: Instant
}): 'seat' | 'seat_lost' {
  if (classCancelled) return 'seat_lost'
  const until = reservedUntil == null ? null : toMillis(reservedUntil)
  const at = toMillis(now)
  if (until !== null && at < until) return 'seat'
  if (!seatFree) return 'seat_lost'
  const notStarted = at < toMillis(firstBlockStartsAt)
  const paidInside = until !== null && toMillis(paidAt) < until
  return notStarted || paidInside ? 'seat' : 'seat_lost'
}

// ── Withdrawal ──────────────────────────────────────────────────────────────

/** The last moment a learner can withdraw for `learner_withdrew`: 7 days before the first block. */
export function withdrawalClosesAt(firstBlockStartsAt: Instant): Date {
  return new Date(toMillis(firstBlockStartsAt) - WITHDRAWAL_CLOSES_BEFORE_MS)
}

export type WithdrawalRefusal =
  | 'not_found'
  | 'class_cancelled'
  | 'refund_in_progress'
  | 'seat_has_no_payment'
  | 'withdrawal_attended'
  | 'withdrawal_closed'

/**
 * The refund kind a learner's withdrawal gives, or why it is refused. A changed class gives
 * `changed_withdrew`, the full refund, until it starts; otherwise `learner_withdrew` while the
 * first block is more than 7 days away. When both hold, `changed_withdrew` wins.
 */
export function withdrawal({
  enrollmentStatus,
  classCancelled,
  hasUnfinishedRefund,
  hasPayment,
  attendance,
  firstBlockStartsAt,
  classChangedAt,
  now,
}: {
  enrollmentStatus: string
  classCancelled: boolean
  hasUnfinishedRefund: boolean
  hasPayment: boolean
  attendance: MoneyAttendance
  firstBlockStartsAt: Instant
  classChangedAt: Instant | null
  now: Instant
}): 'learner_withdrew' | 'changed_withdrew' | WithdrawalRefusal {
  if (enrollmentStatus !== 'active') return 'not_found'
  if (classCancelled) return 'class_cancelled'
  if (hasUnfinishedRefund) return 'refund_in_progress'
  if (!hasPayment) return 'seat_has_no_payment'
  if (attendance.counted || attendance.openMarkUntil !== null) return 'withdrawal_attended'
  const at = toMillis(now)
  const start = toMillis(firstBlockStartsAt)
  if (classChangedAt != null && at < start) return 'changed_withdrew'
  if (start - at > WITHDRAWAL_CLOSES_BEFORE_MS) return 'learner_withdrew'
  return 'withdrawal_closed'
}

// ── Moving ──────────────────────────────────────────────────────────────────

export type MoveInput = {
  /** The learner's attendance in the class they are in. */
  attendance: MoneyAttendance
  hasUnfinishedRefund: boolean
  bankDisputeOpen: boolean
  /** The target is a class of the same course and profile. */
  sameCourse: boolean
  target: {
    status: string
    cancelledAt?: Instant | null
    blocks: Blocks
    seatsLeft: number
  }
  /** The seat's payment. */
  paidAt: Instant
  /** The learner has an enrollment row of any status in the target. */
  hasEnrollmentInTarget: boolean
  now: Instant
}

/** `true` when a learner can be moved to the target, or every move problem that applies. */
export function canMove(input: MoveInput): true | MoveProblem[] {
  const problems: MoveProblem[] = []
  const at = toMillis(input.now)
  const start = firstStart(input.target.blocks)
  const end = lastEnd(input.target.blocks)
  if (input.attendance.counted) problems.push('attended')
  if (input.attendance.openMarkUntil !== null) problems.push('open_mark')
  if (input.hasUnfinishedRefund) problems.push('refund_in_progress')
  if (input.bankDisputeOpen) problems.push('bank_dispute_open')
  if (!input.sameCourse) problems.push('different_course')
  if (input.target.status !== 'published' || input.target.cancelledAt != null || start === null) {
    problems.push('target_not_published')
  }
  if (start !== null && at >= start) problems.push('target_started')
  if (input.target.seatsLeft <= 0) problems.push('target_full')
  if (end !== null && end - toMillis(input.paidAt) > SEAT_HORIZON_MS) problems.push('beyond_limit')
  if (input.hasEnrollmentInTarget) problems.push('already_in_target')
  return problems.length ? problems : true
}

// ── Release ─────────────────────────────────────────────────────────────────

export type ReleaseInput = {
  lastBlockEndsAt: Instant | null
  /** Set when the class was cancelled. */
  cancelledAt: Instant | null
  /** From `moneyAttendance` over the class's learners: the latest open mark's deadline, or null. */
  openMarkUntil: Instant | null
  /** Every refund row of the cancellation is `done` or `closed`. Ignored when not cancelled. */
  cancellationComplete: boolean
  now: Instant
}

/**
 * When a class becomes due for release: 7 days after its last block ends, or after it was
 * cancelled, and not before every open manual mark has settled (one millisecond after its
 * deadline). Null while it waits for something with no date: an incomplete cancellation, or a
 * class with no blocks.
 */
export function releaseDueAt(input: ReleaseInput): Date | null {
  const cancelled = input.cancelledAt != null
  if (cancelled && !input.cancellationComplete) return null
  const base = cancelled ? input.cancelledAt : input.lastBlockEndsAt
  if (base == null) return null
  let due = toMillis(base) + RELEASE_AFTER_MS
  if (input.openMarkUntil != null) due = Math.max(due, toMillis(input.openMarkUntil) + 1)
  return new Date(due)
}

/** Whether a class is due for release now. Due at exactly 7 days. */
export function isDue(input: ReleaseInput): boolean {
  if (input.openMarkUntil != null) return false
  const due = releaseDueAt(input)
  return due !== null && toMillis(input.now) >= due.getTime()
}

// ── Payouts ─────────────────────────────────────────────────────────────────

/**
 * The most a payout may be: the smaller of the available balance and the whole balance less what
 * is held; never below zero.
 */
export function payoutLimitCents({
  availableCents,
  pendingCents,
  heldCents,
}: {
  availableCents: number
  pendingCents: number
  heldCents: number
}): number {
  return Math.max(0, Math.min(availableCents, availableCents + pendingCents - heldCents))
}

export type PayoutItem = { amountCents: number; paidAt: Instant }

export type PayoutChoice<T extends PayoutItem> = {
  chosen: T[]
  totalCents: number
  /** The total of every payable item. */
  namedCents: number
  /** What the limit leaves beyond the named items; never below zero. */
  unnamedCents: number
}

/**
 * The items one payout pays: every item below zero (a debt counts at once), then the others
 * oldest first, each whole, while the total stays within the limit, stopping at the first that
 * does not fit.
 */
export function choosePayoutItems<T extends PayoutItem>(
  items: readonly T[],
  limitCents: number,
): PayoutChoice<T> {
  const debts = items.filter((item) => item.amountCents < 0)
  const others = items
    .filter((item) => item.amountCents >= 0)
    .sort((a, b) => toMillis(a.paidAt) - toMillis(b.paidAt))
  const chosen = [...debts]
  let totalCents = debts.reduce((sum, item) => sum + item.amountCents, 0)
  for (const item of others) {
    if (totalCents + item.amountCents > limitCents) break
    chosen.push(item)
    totalCents += item.amountCents
  }
  const namedCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  return { chosen, totalCents, namedCents, unnamedCents: Math.max(0, limitCents - namedCents) }
}

/** The day in `PAYOUT_TIME_ZONE`, as `YYYY-MM-DD`: the key of at most one payout a day. */
export function payDate(now: Instant): string {
  return instantToZoned(now, PAYOUT_TIME_ZONE).date
}

/** Whether it is 10:00 or later in `PAYOUT_TIME_ZONE`, so a run may pay. */
export function isPayTime(now: Instant): boolean {
  return Number(instantToZoned(now, PAYOUT_TIME_ZONE).time.slice(0, 2)) >= PAY_FROM_HOUR
}
