import { pgEnum } from 'drizzle-orm/pg-core'

export const identityProviderEnum = pgEnum('identity_provider', ['email', 'singpass'])
export const audienceEnum = pgEnum('audience', ['learner', 'teach', 'support'])
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
