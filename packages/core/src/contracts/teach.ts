import { z } from 'zod'
import { courseCategorySchema } from '../domain/categories'
import { quizDefinitionSchema } from '../domain/quiz'
import { richTextDocSchema } from '../domain/richtext'
import { ENTITY_TYPES, type EntityType, isValidUen, normaliseUen, UEN_EXAMPLE } from '../domain/uen'
import { emailSchema, uuidSchema } from './common'

/** What every application says about the teaching: the same for a person and for a company. */
const teachingFields = {
  displayName: z.string().trim().min(2).max(80),
  headline: z.string().trim().min(5).max(120),
  bio: z.string().trim().min(50).max(3000),
  credentials: z.string().trim().min(10).max(3000),
  teachingSampleUrl: z.string().url().max(2048).optional(),
  teachingSampleMediaId: uuidSchema.optional(),
}
const NEEDS_SAMPLE = 'Share a teaching sample: upload a video or paste a link'

/** The application for a personal profile: one person teaching under their own name. */
export const personalApplicationSchema = z
  .object(teachingFields)
  .refine((v) => v.teachingSampleUrl || v.teachingSampleMediaId, {
    message: NEEDS_SAMPLE,
    path: ['teachingSampleUrl'],
  })
export type PersonalApplication = z.infer<typeof personalApplicationSchema>

export const entityTypeSchema = z.enum(ENTITY_TYPES)

/**
 * The application for a corporate profile: a registered company. Beside the teaching fields it
 * names the company (UEN, legal name, legal form) and carries its registry document, which
 * Support compares them with. The UEN is checked for format only (`domain/uen.ts`).
 */
export const corporateApplicationSchema = z
  .object({
    uen: z.string().max(40).transform(normaliseUen),
    legalName: z.string().trim().min(2).max(200),
    entityType: entityTypeSchema,
    /** An uploaded `document`: the company's business profile from the registry. */
    registryDocumentMediaId: uuidSchema,
    ...teachingFields,
  })
  .superRefine((v, ctx) => {
    if (!isValidUen(v.uen, v.entityType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['uen'],
        message: `That is not the UEN of this kind of company. It looks like ${UEN_EXAMPLE[v.entityType]}.`,
      })
    }
    if (!v.teachingSampleUrl && !v.teachingSampleMediaId) {
      ctx.addIssue({ code: 'custom', path: ['teachingSampleUrl'], message: NEEDS_SAMPLE })
    }
  })
export type CorporateApplication = z.infer<typeof corporateApplicationSchema>
/** What a client sends: the UEN as typed, before it is trimmed and upper-cased. */
export type CorporateApplicationInput = z.input<typeof corporateApplicationSchema>

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

/** `GET courses/:id`: `draft=1` asks for the rows of the course's open change set. */
export const courseViewQuerySchema = z.object({ draft: z.literal('1').optional() })

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

// ── Members and invitations ──────────────────────────────────────────────────

/** The roles a member can hold. The owner is not a member and has no row here. */
export const membershipRoleSchema = z.enum(['manager', 'writer'])
export type MembershipRole = z.infer<typeof membershipRoleSchema>

export const inviteSchema = z.object({ email: emailSchema, role: membershipRoleSchema })
export type Invite = z.infer<typeof inviteSchema>

export const changeRoleSchema = z.object({ role: membershipRoleSchema })

export type MemberView = {
  userId: string
  name: string | null
  email: string
  role: MembershipRole
  addedAt: string
  /** The name or email of whoever added them; null when that account no longer exists. */
  addedBy: string | null
}

export type InvitationStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'accepted'
  | 'revoked'
  | 'expired'

export type InvitationView = {
  id: string
  email: string
  role: MembershipRole
  status: InvitationStatus
  /** The name or email of whoever sent it. */
  invitedBy: string | null
  /** Set once the link was used: the address that used it, which can differ from `email`. */
  acceptedByEmail: string | null
  expiresAt: string
  createdAt: string
}

/** `GET members`: managers and writers, and the invitations still waiting on someone. */
export type MembersView = { members: MemberView[]; invitations: InvitationView[] }

/** What the invitation page shows before the invitee signs in. */
export type InvitationPreview = {
  profileName: string
  profileType: ProfileType
  role: MembershipRole
  invitedByName: string | null
  expiresAt: string
  status: InvitationStatus
}

/** The result of using an invitation link. */
export type InvitationAccepted = {
  profileId: string
  profileName: string
  role: MembershipRole
  /** `awaiting_confirmation`: a manager invitation used from another address waits for the owner. */
  status: 'accepted' | 'awaiting_confirmation'
}

export type PayoutAccountStatus = 'onboarding' | 'active'

export type StripeBusinessType = 'individual' | 'company'

/**
 * A profile's Stripe payout account. `active` means it can be paid. A `company` account is
 * active only once Stripe allows charges and Support has recorded that Stripe's legal name for it
 * matches the company (`nameVerified`); an `individual` account needs no name check.
 */
export type PayoutView = {
  status: PayoutAccountStatus
  businessType: StripeBusinessType
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  nameVerified: boolean
  /** The account has been active at some point, even if it is not now. */
  activated: boolean
}

/** What the Stripe page shows; `connected` is false until the profile has a Stripe account. */
export type StripeStatusView = {
  connected: boolean
  status: PayoutAccountStatus | null
  businessType: StripeBusinessType | null
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  nameVerified: boolean
}

export type EntityCheckStatus = 'pending' | 'verified' | 'rejected'

/** The registered company behind a corporate profile, as the people on the profile see it. */
export type LegalEntityView = {
  uen: string
  legalName: string
  entityType: EntityType
  checkStatus: EntityCheckStatus
  rejectionReason: string | null
  /** The uploaded registry document. Its file is for Support, and for the applicant until review. */
  registryDocumentMediaId: string | null
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
  /** Corporate profiles only. */
  legalEntity: LegalEntityView | null
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
  /** In a draft tree: the live artefact this one was copied from; null for a new one. */
  sourceId: string | null
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
  /** In a draft tree: the live lesson this one was copied from; null for a new one. */
  sourceId: string | null
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
  /**
   * Which tree `lessons` is: the live rows, or the rows of the open change set (asked for with
   * `?draft=1`). A draft tree has its own IDs; each item's `sourceId` is its live counterpart.
   */
  viewing: 'live' | 'draft'
  /** The course's open change set, if a writer has edits waiting for approval. */
  changeSet: { id: string; openedBy: string | null; openedAt: string } | null
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
  /** A writer's edits to this live course are waiting for approval. */
  pendingChanges: boolean
  submittedAt: string | null
  updatedAt: string
}

// ── Change sets: a writer's edits to a live course ───────────────────────────

/** A prerequisite link between two lessons, as stored when a change set is opened. */
export type PrerequisiteLink = { lessonId: string; prerequisiteId: string }

export type ChangeSetStatus = 'open' | 'approved' | 'discarded'

/**
 * One thing the change set would change. The IDs are those of the lesson or artefact in the live
 * tree and in the draft tree, so a screen can show the two versions:
 * - `prerequisites` is a lesson whose prerequisite list changed; its IDs are the lesson's;
 * - `quiz` is an artefact whose quiz changed; its IDs are the artefact's.
 */
export type ChangeSetItem = {
  kind: 'lesson' | 'artefact' | 'quiz' | 'prerequisites'
  liveId: string | null
  draftId: string | null
  change: 'added' | 'edited' | 'removed'
  title: string
}

export const changeSetConflictKindSchema = z.enum(['edited', 'deleted', 'prerequisites'])
export type ChangeSetConflictKind = z.infer<typeof changeSetConflictKindSchema>

/**
 * A live row that changed after the change set was opened, so the two versions cannot both apply.
 *
 * - `edited`: the live row was edited. `id` is the draft's ID.
 * - `deleted`: the live row was deleted. `id` is the draft's ID; `droppedChildren` is how many new
 *   items under it are lost if the deletion stands.
 * - `prerequisites`: the live lesson's prerequisite list changed. `id` is the live lesson's ID and
 *   `item` is null.
 *
 * `id` is what a choice refers to. `liveId` and `draftId` are for showing the two versions: the
 * lesson's or artefact's ID in each tree (for a quiz, its artefact's).
 *
 * `seen` identifies the live state this conflict describes. A choice carries it back, so a choice
 * made against an older state is not applied to a newer one.
 */
export type ChangeSetConflict = {
  kind: ChangeSetConflictKind
  item: 'lesson' | 'artefact' | 'quiz' | null
  id: string
  liveId: string | null
  draftId: string | null
  droppedChildren: number
  title: string
  seen: string
  /** The approver's stored choice for this state of the conflict, if they have made one. */
  resolution: 'live' | 'draft' | null
}

export type ChangeSetView = {
  id: string
  status: ChangeSetStatus
  openedBy: { id: string; name: string | null; email: string } | null
  openedAt: string
  items: ChangeSetItem[]
  conflicts: ChangeSetConflict[]
}

export const changeSetChoiceSchema = z.object({
  kind: changeSetConflictKindSchema,
  id: uuidSchema,
  keep: z.enum(['live', 'draft']),
  seen: z.string().min(1).max(4000),
})
export type ChangeSetChoice = z.infer<typeof changeSetChoiceSchema>

export const resolveChangeSetSchema = z.object({
  choices: z.array(changeSetChoiceSchema).min(1).max(500),
})
export type ResolveChangeSet = z.infer<typeof resolveChangeSetSchema>

/** The body of `409 change_set_conflict`, under `error.details`. */
export type ChangeSetConflictDetails = { conflicts: ChangeSetConflict[] }

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
