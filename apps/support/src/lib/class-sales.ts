/**
 * English words for the values of selling a class (docs/designs/scheduled-classes-selling.md), as
 * the payouts page, the class view and a transaction's page show them. Support is English.
 */
import type {
  ElevateCancelReason,
  SeatRefundClosedReason,
  SeatRefundKind,
  SeatRefundStatus,
  SeatRefundWaitingFor,
} from '@elevate/core'
import { type StatusTone, statusLabel } from '@elevate/web-ui'

export const seatRefundKindLabel: Record<SeatRefundKind, string> = {
  teacher_cancelled: 'Cancelled by the profile',
  teacher_cancelled_part: 'Cancelled by the profile, blocks not taught',
  changed_withdrew: 'Withdrew after a time change',
  learner_withdrew: 'Withdrew',
  discretionary: 'Refund by the profile',
  elevate_cancelled: 'Cancelled by Elevate',
  seat_lost: 'Seat lost while paying',
  dispute_lost: 'Bank dispute lost',
}

export const seatRefundStatusLabel: Record<SeatRefundStatus, string> = {
  waiting: 'Waiting',
  pending: 'Ready to send',
  refund_sent: 'Sent to Stripe',
  done: 'Done',
  closed: 'Closed',
  failed: 'Failed',
}

export const seatRefundStatusTone: Record<SeatRefundStatus, StatusTone> = {
  waiting: 'warning',
  pending: 'info',
  refund_sent: 'info',
  done: 'success',
  closed: 'neutral',
  failed: 'danger',
}

const waitingForLabel: Record<SeatRefundWaitingFor, string> = {
  manual_mark: 'an open manual mark',
  bank_dispute: 'an open bank dispute',
  stripe_fee: 'Stripe’s fee',
}

const closedReasonLabel: Record<SeatRefundClosedReason, string> = {
  mark_settled: 'the manual mark settled, so the learner counts as attended',
  bank_returned: 'the bank returned the money',
  support: 'closed by Support',
}

/** "waiting for an open manual mark", "closed: the bank returned the money", or nothing. */
export function seatRefundDetail(row: {
  status: SeatRefundStatus
  waitingFor: string | null
  closedReason: string | null
}): string | null {
  if (row.status === 'waiting' && row.waitingFor) {
    return `for ${waitingForLabel[row.waitingFor as SeatRefundWaitingFor] ?? statusLabel(row.waitingFor).toLowerCase()}`
  }
  if (row.status === 'closed' && row.closedReason) {
    return closedReasonLabel[row.closedReason as SeatRefundClosedReason] ?? row.closedReason
  }
  return null
}

/**
 * The error the sender stores when Stripe accepted a refund and then failed it. Such a row cannot
 * be retried (`refund_failed_at_stripe`): the profile's share was already taken back.
 */
export const REFUND_FAILED_AT_STRIPE = 'refund_failed'

export const groundLabel: Record<ElevateCancelReason, string> = {
  teacher_absent: 'The teacher did not turn up, or cannot teach the class',
  venue_unavailable: 'The venue is unsafe or cannot be used',
  rules_breach: 'The profile broke Elevate’s rules or acted dishonestly',
  profile_suspended: 'The profile is suspended',
  required_by_law: 'Elevate is required to by law',
}

export const bankDisputeLabel: Record<string, string> = {
  open: 'Bank dispute open',
  won: 'Bank dispute won',
  lost: 'Bank dispute lost',
}

export const bankDisputeTone: Record<string, StatusTone> = {
  open: 'warning',
  won: 'success',
  lost: 'danger',
}
