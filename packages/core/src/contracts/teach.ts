import { z } from 'zod'
import { courseCategorySchema } from '../domain/categories'
import { quizDefinitionSchema } from '../domain/quiz'
import { richTextDocSchema } from '../domain/richtext'
import { uuidSchema } from './common'

/** The application for a personal profile: one person teaching under their own name. */
export const personalApplicationSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    headline: z.string().trim().min(5).max(120),
    bio: z.string().trim().min(50).max(3000),
    credentials: z.string().trim().min(10).max(3000),
    teachingSampleUrl: z.string().url().max(2048).optional(),
    teachingSampleMediaId: uuidSchema.optional(),
  })
  .refine((v) => v.teachingSampleUrl || v.teachingSampleMediaId, {
    message: 'Share a teaching sample: upload a video or paste a link',
    path: ['teachingSampleUrl'],
  })
export type PersonalApplication = z.infer<typeof personalApplicationSchema>

export const createCourseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  category: courseCategorySchema,
})
export type CreateCourse = z.infer<typeof createCourseSchema>

export const updateCourseSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  summary: z.string().trim().max(400).nullable().optional(),
  descriptionJson: richTextDocSchema.nullable().optional(),
  category: courseCategorySchema.optional(),
  thumbnailMediaId: uuidSchema.nullable().optional(),
})
export type UpdateCourse = z.infer<typeof updateCourseSchema>

/** Price has its own route, so a role can edit a course's details without being able to price it. */
export const setPriceSchema = z.object({ priceCents: z.number().int().min(0).max(1_000_000) })
export type SetPrice = z.infer<typeof setPriceSchema>

export const createLessonSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(400).nullable().optional(),
})
export const updateLessonSchema = createLessonSchema.partial()

export const reorderSchema = z.object({ ids: z.array(uuidSchema).min(1).max(500) })

export const prerequisitesSchema = z.object({ prerequisiteIds: z.array(uuidSchema).max(50) })

export const artefactTypeSchema = z.enum(['video', 'audio', 'text', 'quiz'])

export const createArtefactSchema = z.object({
  type: artefactTypeSchema,
  title: z.string().trim().min(1).max(120),
})
export const updateArtefactSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  mediaAssetId: uuidSchema.nullable().optional(),
  contentJson: richTextDocSchema.nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
})

export const upsertQuizSchema = quizDefinitionSchema

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().min(5).max(120).optional(),
  bio: z.string().trim().min(50).max(3000).optional(),
  /** An uploaded image; `null` removes the avatar. */
  avatarMediaId: uuidSchema.nullable().optional(),
})
export type UpdateProfile = z.infer<typeof updateProfileSchema>

export type PayoutAccountStatus = 'onboarding' | 'active'

/** A profile's Stripe payout account. `active` means it can be paid. */
export type PayoutView = {
  status: PayoutAccountStatus
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

/** What the Stripe page shows; `connected` is false until the profile has a Stripe account. */
export type StripeStatusView = {
  connected: boolean
  status: PayoutAccountStatus | null
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

export type ProfileView = {
  id: string
  type: ProfileType
  status: ProfileStatus
  displayName: string
  headline: string | null
  bio: string | null
  credentials: string | null
  teachingSampleUrl: string | null
  teachingSampleMediaId: string | null
  avatarMediaId: string | null
  avatarUrl: string | null
  reviewNote: string | null
  commissionBps: number
  /** Null until the profile starts Stripe onboarding. */
  payout: PayoutView | null
  owner: { id: string; email: string; name: string | null }
  /** True when the caller is platform staff acting on this profile, not its owner or a member. */
  actingAsStaff: boolean
  appliedAt: string
  reviewedAt: string | null
}

// ── Course builder views ─────────────────────────────────────────────────────
import type { SubmissionCheck } from '../domain/course-validation'
import type { ProfileStatus, ProfileType } from '../domain/permissions'
import type { QuizDefinition } from '../domain/quiz'
import type { RichTextDoc } from '../domain/richtext'
import type { MediaAssetView } from './media'

export type CourseStatus = 'draft' | 'pending_review' | 'live' | 'rejected'
export type ArtefactType = 'video' | 'audio' | 'text' | 'quiz'

export type ArtefactView = {
  id: string
  lessonId: string
  type: ArtefactType
  title: string
  position: number
  durationSeconds: number | null
  media: MediaAssetView | null
  contentJson: RichTextDoc | null
  quiz: QuizDefinition | null
}

export type LessonView = {
  id: string
  courseId: string
  title: string
  summary: string | null
  position: number
  prerequisiteIds: string[]
  artefacts: ArtefactView[]
}

export type CourseView = {
  id: string
  slug: string
  title: string
  summary: string | null
  descriptionJson: RichTextDoc | null
  category: string
  priceCents: number
  currency: string
  status: CourseStatus
  rejectionReason: string | null
  thumbnail: MediaAssetView | null
  /** `payable`: the profile has an active payout account that can take charges. */
  profile: { id: string; displayName: string; ownerEmail: string; payable: boolean }
  lessons: LessonView[]
  checklist: SubmissionCheck
  enrolCount: number
  submittedAt: string | null
  reviewedAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CourseSummary = {
  id: string
  slug: string
  title: string
  category: string
  status: CourseStatus
  priceCents: number
  thumbnailUrl: string | null
  lessonCount: number
  artefactCount: number
  enrolCount: number
  profileId: string
  profileName: string
  ownerEmail: string
  submittedAt: string | null
  updatedAt: string
}

// ── Earnings ───────────────────────────────────────────────────────────────
export type MoneyBreakdown = {
  paymentCount: number
  grossCents: number
  discountCents: number
  stripeFeeCents: number
  commissionCents: number
  netCents: number
  refundedCents: number
}

export type EarningsView = {
  totals: MoneyBreakdown
  courses: Array<MoneyBreakdown & { courseId: string; title: string; slug: string; status: string }>
  recent: Array<{
    paymentId: string
    courseTitle: string
    learner: string
    amountCents: number
    netCents: number
    status: 'succeeded' | 'refunded' | 'partially_refunded'
    paidAt: string
  }>
  stripe: { connected: boolean; chargesEnabled: boolean; payoutsEnabled: boolean }
  commissionBps: number
}

export type ReconciliationView = {
  stripeTransferTotalCents: number
  ledgerNetCents: number
  differenceCents: number
  checkedAt: string
}

export type CourseEarningsView = {
  course: MoneyBreakdown & {
    courseId: string
    title: string
    slug: string
    status: string
    priceCents: number
  }
  payments: Array<{
    paymentId: string
    learner: string
    amountCents: number
    discountCents: number
    stripeFeeCents: number
    commissionCents: number
    netCents: number
    refundedCents: number
    status: 'succeeded' | 'refunded' | 'partially_refunded'
    promoCode: string | null
    paidAt: string
  }>
}
