import type {
  ELEVATE_CANCEL_REASONS,
  PAYOUT_ADJUSTMENT_KINDS,
  PAYOUT_MODES,
  PAYOUT_OUTCOMES,
  SEAT_REFUND_KINDS,
  SEAT_REFUND_STATUSES,
  supportedLocales,
} from '@elevate/core'
import { pgEnum } from 'drizzle-orm/pg-core'

export const identityProviderEnum = pgEnum('identity_provider', ['email', 'singpass'])
export const audienceEnum = pgEnum('audience', ['learner', 'teach', 'support'])
/**
 * The account's language (ADR 010). Typecheck fails until this list matches `supportedLocales`;
 * a new language also needs `npm run db:generate` for its migration.
 */
export const localeEnum = pgEnum('locale', ['en', 'zh'] as const satisfies typeof supportedLocales)
/** Platform staff roles. Teaching is not a role: it comes from owning or belonging to a profile. */
export const userRoleEnum = pgEnum('user_role', ['support_agent', 'super_admin'])
export const profileStatusEnum = pgEnum('profile_status', ['applied', 'approved', 'rejected'])
export const profileTypeEnum = pgEnum('profile_type', ['personal', 'corporate'])
export const payoutAccountStatusEnum = pgEnum('payout_account_status', ['onboarding', 'active'])
export const stripeBusinessTypeEnum = pgEnum('stripe_business_type', ['individual', 'company'])
/** The roles a member holds on a profile. The owner is a column on the profile, not a member. */
export const membershipRoleEnum = pgEnum('membership_role', ['manager', 'writer'])
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'awaiting_confirmation',
  'accepted',
  'revoked',
  'expired',
])
export const changeSetStatusEnum = pgEnum('change_set_status', ['open', 'approved', 'discarded'])
/** The legal forms a corporate profile can have. */
export const entityTypeEnum = pgEnum('entity_type', ['private_limited', 'llp'])
/** Support's check of a company against its registry document. */
export const entityCheckStatusEnum = pgEnum('entity_check_status', [
  'pending',
  'verified',
  'rejected',
])
export const courseStatusEnum = pgEnum('course_status', [
  'draft',
  'pending_review',
  'live',
  'rejected',
])
export const artefactTypeEnum = pgEnum('artefact_type', ['video', 'audio', 'text', 'quiz'])
export const mediaKindEnum = pgEnum('media_kind', ['video', 'audio', 'image', 'document'])
export const mediaProviderEnum = pgEnum('media_provider', ['local', 'mux', 's3'])
export const mediaStatusEnum = pgEnum('media_status', ['pending', 'processing', 'ready', 'errored'])
export const promoTypeEnum = pgEnum('promo_type', ['percent', 'fixed'])
export const enrollmentModeEnum = pgEnum('enrollment_mode', ['self_directed', 'class_based'])
export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'pending_payment',
  'active',
  'refunded',
  'cancelled',
])
export const paymentStatusEnum = pgEnum('payment_status', [
  'succeeded',
  'refunded',
  'partially_refunded',
])
export const progressStatusEnum = pgEnum('progress_status', [
  'not_started',
  'in_progress',
  'completed',
])
export const webhookProviderEnum = pgEnum('webhook_provider', ['stripe', 'mux'])
/** How a scheduled class meets. An in-person class measures check-ins against its venue. */
export const classDeliveryEnum = pgEnum('class_delivery', ['in_person', 'remote'])
/** A scheduled class's status. A cancelled class also has `classes.cancelled_at`. */
export const classStatusEnum = pgEnum('class_status', ['draft', 'published', 'cancelled'])
/** What one attendance row records. Rows are only ever inserted (see `classes.ts`). */
export const attendanceEventTypeEnum = pgEnum('attendance_event_type', [
  'attempt_refused',
  'check_in',
  'overturn',
  'manual_mark',
  'dispute',
  'dispute_decision',
])

// Selling a class (docs/designs/scheduled-classes-selling.md). Typecheck fails until each list
// matches its list in `@elevate/core`'s `class-sales.ts`.

/** Why a seat refund row exists; decides its amounts (`seatRefund` in `@elevate/core`). */
export const seatRefundKindEnum = pgEnum('seat_refund_kind', [
  'teacher_cancelled',
  'teacher_cancelled_part',
  'changed_withdrew',
  'learner_withdrew',
  'discretionary',
  'elevate_cancelled',
  'seat_lost',
  'dispute_lost',
] as const satisfies typeof SEAT_REFUND_KINDS)
/** `waiting`, `pending`, `refund_sent` and `failed` are unfinished. */
export const seatRefundStatusEnum = pgEnum('seat_refund_status', [
  'waiting',
  'pending',
  'refund_sent',
  'done',
  'closed',
  'failed',
] as const satisfies typeof SEAT_REFUND_STATUSES)
/** The grounds on which Elevate may cancel a class. */
export const elevateCancelReasonEnum = pgEnum('elevate_cancel_reason', [
  'teacher_absent',
  'venue_unavailable',
  'rules_breach',
  'profile_suspended',
  'required_by_law',
] as const satisfies typeof ELEVATE_CANCEL_REASONS)
export const payoutOutcomeEnum = pgEnum('payout_outcome', [
  'paid',
  'below_minimum',
  'nothing_payable',
  'failed',
] as const satisfies typeof PAYOUT_OUTCOMES)
/** How Stripe pays a profile's balance out. The release job pays only `manual` accounts. */
export const payoutModeEnum = pgEnum('payout_mode', [
  'automatic',
  'switching',
  'manual',
] as const satisfies typeof PAYOUT_MODES)
export const payoutAdjustmentKindEnum = pgEnum('payout_adjustment_kind', [
  'opening_available',
  'opening_pending',
  'refund_after_payout',
  'bank_dispute_after_payout',
  'correction',
] as const satisfies typeof PAYOUT_ADJUSTMENT_KINDS)
