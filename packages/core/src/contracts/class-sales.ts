/**
 * Selling a class (docs/designs/scheduled-classes-selling.md): the request schemas the API
 * validates with, and the answers the learner app, Teach and Support type against. Instants are
 * ISO strings; money is integer cents.
 */
import { z } from 'zod'
import {
  ELEVATE_CANCEL_REASONS,
  type MoveProblem,
  type PayoutAdjustmentKind,
  type PayoutMode,
  type SeatRefundKind,
  type SeatRefundStatus,
} from '../domain/class-sales'
import { checkoutRequestSchema, type QuoteResponse } from './checkout'
import type { ClassDelivery } from './classes'
import { uuidSchema } from './common'

// ── Requests ────────────────────────────────────────────────────────────────

const termsVersionSchema = z.string().trim().min(1).max(40)
const reasonSchema = z.string().trim().min(3).max(500)

/** `POST /teach/profiles/:profileId/class-sales/accept`. */
export const acceptClassSalesSchema = z.object({ termsVersion: termsVersionSchema })
export type AcceptClassSales = z.infer<typeof acceptClassSalesSchema>

/** `POST /checkout/classes/:classId`: as self-paced checkout, plus the refund terms shown. */
export const classCheckoutRequestSchema = checkoutRequestSchema.extend({
  termsVersion: termsVersionSchema,
})
export type ClassCheckoutRequest = z.infer<typeof classCheckoutRequestSchema>

/** `POST classes/:id/cancel`, by the profile. */
export const cancelClassSchema = z.object({ reason: reasonSchema })
export type CancelClass = z.infer<typeof cancelClassSchema>

/** `POST /support/classes/:id/cancel`: one of the grounds, and a note. */
export const elevateCancelClassSchema = z.object({
  ground: z.enum(ELEVATE_CANCEL_REASONS),
  note: reasonSchema,
})
export type ElevateCancelClass = z.infer<typeof elevateCancelClassSchema>

/** `POST classes/:id/learners/:enrollmentId/move`. */
export const moveSeatSchema = z.object({ toClassId: uuidSchema })
export type MoveSeat = z.infer<typeof moveSeatSchema>

/** `POST classes/:id/learners/:enrollmentId/refund`: a discretionary refund. */
export const seatRefundRequestSchema = z.object({
  amountCents: z.number().int().positive(),
  reason: reasonSchema,
})
export type SeatRefundRequest = z.infer<typeof seatRefundRequestSchema>

/** Support releases a class under review. */
export const clearReviewSchema = z.object({ note: reasonSchema })
export type ClearReview = z.infer<typeof clearReviewSchema>

/** Support retries or closes a failed seat refund row. */
export const refundRowActionSchema = z.object({
  action: z.enum(['retry', 'close']),
  reason: reasonSchema,
})
export type RefundRowAction = z.infer<typeof refundRowActionSchema>

/** Support writes a `correction` adjustment: signed, never zero. */
export const correctionSchema = z.object({
  amountCents: z
    .number()
    .int()
    .refine((value) => value !== 0, 'Not zero'),
  reason: reasonSchema,
})
export type Correction = z.infer<typeof correctionSchema>

// ── Answers ─────────────────────────────────────────────────────────────────

/** `GET /teach/profiles/:profileId/class-sales`: the Teach settings card. */
export type ClassSalesStatus = {
  /** Null when the profile has no payout account yet. */
  payoutMode: PayoutMode | null
  /** The payout account can take payments, which opting in requires. */
  payable: boolean
  acceptedAt: string | null
  /** The version the owner accepted, and the one an opt-in must name now. */
  termsVersion: string | null
  currentTermsVersion: string
  /** Set when the owner has given notice to leave; `leaveOn` is 30 days later. */
  leaveRequestedAt: string | null
  leaveOn: string | null
}

/** A class on sale, as the course page and class checkout show it. */
export type ClassForSale = {
  id: string
  name: string
  delivery: ClassDelivery
  venueAddress: string | null
  timeZone: string
  blocks: { startsAt: string; endsAt: string }[]
  seatsLeft: number
  instructorName: string
}

/** The signed-in learner's seat in a class of the course. */
export type ViewerClassSeat = {
  classId: string
  enrollmentId: string
  status: 'pending_payment' | 'active' | 'refunded' | 'cancelled'
}

/** `GET /checkout/classes/:classId`. */
export type ClassCheckoutView = {
  class: ClassForSale
  courseSlug: string
  courseTitle: string
  quote: QuoteResponse
  refundTermsVersion: string
  /** The fee estimate's rate, for the refund terms shown before Stripe's fee is known. */
  stripeFeeBps: number
  stripeFixedCents: number
}

export type SeatRefundView = {
  id: string
  kind: SeatRefundKind
  status: SeatRefundStatus
  waitingFor: string | null
  closedReason: string | null
  learnerRefundCents: number | null
  reason: string | null
  createdAt: string
  completedAt: string | null
}

/** One seat on a class's Teach page. */
export type SeatView = {
  enrollmentId: string
  learner: { displayName: string; email: string }
  status: 'pending_payment' | 'active' | 'refunded' | 'cancelled'
  paidAt: string | null
  paidCents: number
  refundedCents: number
  counted: boolean
  openMarkUntil: string | null
  movedAt: string | null
  classChangedAt: string | null
  bankDisputeStatus: string | null
  released: boolean
  refunds: SeatRefundView[]
  canRefundUpToCents: number
  canMove: boolean
}

/** `GET classes/:id/move-targets`. */
export type MoveTarget = {
  classId: string
  className: string
  firstBlockStartsAt: string
  seatsLeft: number
  /** Empty when the move is allowed. */
  problems: MoveProblem[]
}

/** The seat part of a learner's class. */
export type LearnerSeat = {
  withdrawKind: 'learner_withdrew' | 'changed_withdrew' | null
  /** Null until Stripe's fee is recorded. */
  withdrawRefundCents: number | null
  withdrawClosesAt: string | null
  movedAt: string | null
  classChangedAt: string | null
  classCancelled: boolean
  /** The latest. */
  refund: SeatRefundView | null
  openMarks: { blockId: string; disputeUntil: string }[]
}

/** A class whose money is held, on the Teach earnings page. */
export type HeldClassView = {
  classId: string
  className: string
  heldCents: number
  releaseDueAt: string | null
  waitingFor: 'open_marks' | 'cancellation' | 'review' | null
}

/**
 * One payout to the profile. Named so because `contracts/teach.ts` already exports a
 * `PayoutView`, the payout account.
 */
export type ProfilePayoutView = {
  id: string
  payDate: string
  amountCents: number
  payoutStatus: string | null
  items: { kind: 'payment' | PayoutAdjustmentKind; label: string; amountCents: number }[]
}

/** Support's payouts page. */
export type SupportPayoutsOverview = {
  lastFinishedAt: string | null
  /** No run has finished recently. */
  stale: boolean
  classesUnderReview: {
    classId: string
    className: string
    profileName: string
    dueAt: string
    heldCents: number
  }[]
  refundsNeedingAttention: {
    id: string
    kind: SeatRefundKind
    status: SeatRefundStatus
    waitingFor: string | null
    className: string
    profileName: string
    error: string | null
    createdAt: string
  }[]
  openCancellations: {
    classId: string
    className: string
    profileName: string
    afterStart: boolean
    createdAt: string
    rowsLeft: number
  }[]
  dayLimitReleases: {
    paymentId: string
    className: string
    profileName: string
    releasedAt: string
  }[]
  failedPayouts: {
    payoutId: string
    profileName: string
    payoutAccountId: string
    amountCents: number
    error: string | null
  }[]
  unnamed: {
    profileName: string
    payoutAccountId: string
    payDate: string
    unnamedCents: number
  }[]
  recentRuns: {
    id: string
    startedAt: string
    finishedAt: string | null
    error: string | null
    refundsSent: number
    classesReleased: number
    payoutsCreated: number
  }[]
}
