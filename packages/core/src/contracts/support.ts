import { z } from 'zod'
import type { ProfileStatus, ProfileType } from '../domain/permissions'
import type { ProfileSummary } from './auth'
import { emailSchema, roleSchema, uuidSchema } from './common'
import type { MediaAssetView } from './media'
import type {
  CourseSummary,
  LegalEntityView,
  MoneyBreakdown,
  PayoutAccountStatus,
  ProfileView,
} from './teach'

export const rejectSchema = z.object({ reason: z.string().trim().min(10).max(2000) })
export const reviewNoteSchema = z.object({ note: z.string().trim().max(2000).optional() })
export const commissionSchema = z.object({ commissionBps: z.number().int().min(0).max(5000) })
export const refundSchema = z.object({ reason: z.string().trim().min(3).max(500) })
export const grantRoleSchema = z.object({ role: roleSchema, grant: z.boolean() })
export const peopleQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  /** `learner`: owns no profile and is not staff. Teachers are found through the profiles list. */
  role: z.enum(['learner', 'staff']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})
export const profilesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['applied', 'approved', 'rejected']).optional(),
  type: z.enum(['personal', 'corporate']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export type PersonSummary = {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  roles: z.infer<typeof roleSchema>[]
  createdAt: string
  /** The teaching profiles this person owns or belongs to. */
  profiles: ProfileSummary[]
}

export type PersonDetail = PersonSummary & {
  stats: { enrollments: number }
}

export type SupportProfileSummary = {
  id: string
  type: ProfileType
  status: ProfileStatus
  displayName: string
  ownerId: string
  ownerEmail: string
  ownerName: string | null
  commissionBps: number
  /** The profile has an active payout account that can take charges. */
  payable: boolean
  /** Corporate profiles only: the company's UEN and legal name. */
  uen: string | null
  legalName: string | null
  appliedAt: string
}

export type SupportPayoutAccount = {
  id: string
  stripeAccountId: string | null
  businessType: 'individual' | 'company'
  status: PayoutAccountStatus
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  activatedAt: string | null
  /** Company accounts: when Support recorded that the legal name matches, and who did. */
  nameVerifiedAt: string | null
  nameVerifiedBy: string | null
}

/** The company behind a corporate profile, with what Support needs to check it. */
export type SupportLegalEntity = LegalEntityView & {
  id: string
  checkedBy: string | null
  checkedAt: string | null
  registryDocument: MediaAssetView | null
}

export type SupportProfileDetail = {
  profile: ProfileView
  courses: CourseSummary[]
  payoutAccounts: SupportPayoutAccount[]
  /** Corporate profiles only. */
  legalEntity: SupportLegalEntity | null
  /** Totals over every payment made to the profile's payout account. */
  earnings: MoneyBreakdown
}

/**
 * The legal-name check on a company's payout account: the name Stripe holds for the account
 * beside the name Support verified against the registry document. When Stripe returns no name,
 * Support reads it in the Stripe dashboard instead (`dashboardUrl`).
 */
export type NameCheckView = {
  payoutAccountId: string
  stripeAccountId: string
  stripeLegalName: string | null
  entityLegalName: string
  uen: string
  dashboardUrl: string
  status: PayoutAccountStatus
  chargesEnabled: boolean
  nameVerifiedAt: string | null
  nameVerifiedBy: string | null
  /** The decision recorded most recently, read from the audit log; `null` before the first. */
  lastDecision: NameCheckRecord | null
}

/** One recorded name-check decision, as the audit log holds it. */
export type NameCheckRecord = {
  match: boolean
  source: 'api' | 'dashboard'
  /** The Stripe name as it was seen when the decision was made. */
  stripeLegalName: string | null
  note: string | null
  decidedBy: string | null
  decidedAt: string
}

/**
 * Support's decision on the name check. `source` says where the Stripe name was read: from the
 * API (shown on the page) or in the Stripe dashboard. Read in the dashboard, the name is typed in
 * with the decision, so the audit entry holds both names whichever way it was read. A mismatch
 * needs a note for the owner.
 */
export const nameCheckSchema = z
  .object({
    match: z.boolean(),
    source: z.enum(['api', 'dashboard']),
    /** The legal name as the Stripe dashboard shows it. Needed, and only used, with `dashboard`. */
    stripeLegalName: z.string().trim().min(1).max(300).optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.match && (value.note?.length ?? 0) < 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Say what does not match, so the owner can put it right',
      })
    }
    if (value.source === 'dashboard' && !value.stripeLegalName) {
      ctx.addIssue({
        code: 'custom',
        path: ['stripeLegalName'],
        message: 'Type the legal name as the Stripe dashboard shows it',
      })
    }
  })
export type NameCheckDecision = z.infer<typeof nameCheckSchema>

/**
 * Owner recovery, `super_admin` only. A personal profile's owner gets a new email address. A
 * corporate profile gets a new owner, on the company officer's written authorisation.
 */
export const recoverOwnerSchema = z.union([
  z.object({ newEmail: emailSchema }).strict(),
  z
    .object({
      newOwnerUserId: uuidSchema,
      /** The uploaded authorisation from an officer of the company. */
      authorisationMediaId: uuidSchema,
      /** False keeps the previous owner on the profile as a manager. */
      removePreviousOwner: z.boolean(),
    })
    .strict(),
])
export type RecoverOwner = z.infer<typeof recoverOwnerSchema>

export type TransactionSummary = {
  id: string
  paidAt: string
  status: 'succeeded' | 'refunded' | 'partially_refunded'
  amountCents: number
  refundedCents: number
  applicationFeeCents: number
  teacherNetCents: number
  learnerEmail: string
  courseTitle: string
  courseSlug: string
  profileId: string
  profileName: string
  payoutAccountId: string
}

export type TransactionDetail = TransactionSummary & {
  listPriceCents: number
  discountCents: number
  stripeFeeEstimateCents: number
  stripeFeeActualCents: number | null
  commissionCents: number
  platformNetCents: number | null
  promoCode: string | null
  enrollmentId: string
  enrollmentStatus: 'pending_payment' | 'active' | 'refunded' | 'cancelled'
  stripe: {
    checkoutSessionId: string
    paymentIntentId: string | null
    chargeId: string | null
    transferId: string | null
    applicationFeeId: string | null
    balanceTransactionId: string | null
    receiptUrl: string | null
  }
  refunds: Array<{
    id: string
    stripeRefundId: string
    amountCents: number
    reason: string | null
    requestedBy: string | null
    createdAt: string
  }>
}

/** One row per payout account; the profile is shown beside it. */
export type PayoutLedgerRow = {
  payoutAccountId: string
  stripeAccountId: string | null
  payoutsEnabled: boolean
  profileId: string
  profileName: string
  ownerEmail: string
  transferCount: number
  transferredCents: number
  refundedCents: number
}

export type AuditEntry = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  profileId: string | null
  actorEmail: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export const transactionsQuerySchema = z.object({
  status: z.enum(['succeeded', 'refunded', 'partially_refunded']).optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/** Funnel metrics derived from analytics_events and enrolments (spec step 15). */
export type AnalyticsSummary = {
  generatedAt: string
  completion: { enrolled: number; completed: number; ratePercent: number | null }
  courses: Array<{
    courseId: string
    title: string
    enrolled: number
    completed: number
    ratePercent: number | null
  }>
  dropOff: { lessons: Array<{ position: number; starts: number }>; dropOffIndex: number | null }
  checkout: { started: number; completed: number; ratePercent: number | null }
  firstPayout: { teachersPaid: number; medianDays: number | null }
}
