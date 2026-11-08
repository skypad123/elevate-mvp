import { z } from 'zod'
import { roleSchema } from './common'

export const rejectSchema = z.object({ reason: z.string().trim().min(10).max(2000) })
export const reviewNoteSchema = z.object({ note: z.string().trim().max(2000).optional() })
export const commissionSchema = z.object({ commissionBps: z.number().int().min(0).max(5000) })
export const refundSchema = z.object({ reason: z.string().trim().min(3).max(500) })
export const grantRoleSchema = z.object({ role: roleSchema, grant: z.boolean() })
export const peopleQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['teacher', 'learner', 'staff']).optional(),
  status: z.enum(['applied', 'approved', 'rejected']).optional(),
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
  teacher: {
    status: 'applied' | 'approved' | 'rejected'
    displayName: string
    commissionBps: number
    stripeChargesEnabled: boolean
    appliedAt: string
  } | null
}

export type PersonDetail = PersonSummary & {
  teacherProfile: import('./teach').TeacherProfileView | null
  stats: { enrollments: number; courses: number; liveCourses: number }
}

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
  teacherName: string
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

export type PayoutLedgerRow = {
  teacherId: string
  teacherName: string
  teacherEmail: string
  stripeAccountId: string | null
  payoutsEnabled: boolean
  transferCount: number
  transferredCents: number
  refundedCents: number
}

export type AuditEntry = {
  id: string
  action: string
  entityType: string
  entityId: string | null
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
