import { pgEnum } from 'drizzle-orm/pg-core'

export const identityProviderEnum = pgEnum('identity_provider', ['email', 'singpass'])
export const audienceEnum = pgEnum('audience', ['learner', 'teach', 'support'])
export const userRoleEnum = pgEnum('user_role', ['teacher', 'support_agent', 'super_admin'])
export const teacherStatusEnum = pgEnum('teacher_status', ['applied', 'approved', 'rejected'])
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
