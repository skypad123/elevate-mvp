/**
 * Scheduled classes and attendance: the request schemas the API validates with, and the answers
 * the Teach portal, the Support portal and the learner app type against
 * (docs/designs/scheduled-classes-attendance.md). Instants are ISO strings.
 *
 * No answer carries a block's code secret. Only `SupportClassBlock` carries coordinates.
 */
import { z } from 'zod'
import {
  type AttendanceEventType,
  type AttendanceState,
  CHECK_IN_METHODS,
  CHECK_IN_PLATFORMS,
  type CheckInMethod,
  DISPUTE_DECISIONS,
  type DisputeDecision,
  type FlagReason,
  ID_DOCUMENT_TYPES,
  MANUAL_MARK_REASON_CODES,
  type ManualMarkReasonCode,
  type ManualMarkSubState,
  NO_READING_STATUSES,
  OVERTURN_REASON_CODES,
  type OverturnReasonCode,
  type RefusalReason,
} from '../domain/attendance'
import { LINK_CODE_LENGTH, normaliseTypedCode, TYPED_CODE_LENGTH } from '../domain/class-code'
import { isValidZonedDateTime, MAX_BLOCKS } from '../domain/class-time'
import { uuidSchema } from './common'

// ── Requests ────────────────────────────────────────────────────────────────

export const classDeliverySchema = z.enum(['in_person', 'remote'])
export type ClassDelivery = z.infer<typeof classDeliverySchema>
export const classStatusSchema = z.enum(['draft', 'published'])
export type ClassStatus = z.infer<typeof classStatusSchema>

/** One block as the Teach form sends it: a wall-clock date and times in the class's time zone. */
export const classBlockInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm'),
  })
  .superRefine((block, ctx) => {
    for (const key of ['startTime', 'endTime'] as const) {
      if (!isValidZonedDateTime({ date: block.date, time: block[key] })) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'Not a real date and time' })
      }
    }
  })
export type ClassBlockInput = z.infer<typeof classBlockInputSchema>

const classFields = {
  courseId: uuidSchema,
  name: z.string().trim().min(1).max(120),
  delivery: classDeliverySchema,
  venueAddress: z.string().trim().max(300).optional(),
  seats: z.number().int().min(1).max(500),
  instructorUserId: uuidSchema,
}

/** No `timeZone`: the API sets it. */
export const createClassSchema = z.object({
  ...classFields,
  blocks: z.array(classBlockInputSchema).min(1).max(MAX_BLOCKS),
})
export type CreateClass = z.infer<typeof createClassSchema>

/** A block with an `id` changes that block; one without is new; a block left out is removed. */
export const updateClassSchema = z
  .object({
    ...classFields,
    blocks: z
      .array(classBlockInputSchema.and(z.object({ id: uuidSchema.optional() })))
      .min(1)
      .max(MAX_BLOCKS),
  })
  .partial()
export type UpdateClass = z.infer<typeof updateClassSchema>

export const setInstructorSchema = z.object({ userId: uuidSchema })
export type SetInstructor = z.infer<typeof setInstructorSchema>

export const setVenueLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0),
  confirmPoorAccuracy: z.boolean().optional(),
})
export type SetVenueLocation = z.infer<typeof setVenueLocationSchema>

export const checkInMethodSchema = z.enum(CHECK_IN_METHODS)
export const checkInPlatformSchema = z.enum(CHECK_IN_PLATFORMS)

/** A reading from the device, or the reason there is none. */
export const checkInLocationSchema = z.union([
  z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().min(0),
  }),
  z.object({ status: z.enum(NO_READING_STATUSES) }),
])
export type CheckInLocation = z.infer<typeof checkInLocationSchema>

/**
 * The code is normalised as typed (upper case, no spaces or dashes), then must be 6 characters
 * for `typed_code` or 20 for `qr_link`.
 */
export const checkInSchema = z
  .object({
    code: z.string().max(40).transform(normaliseTypedCode),
    method: checkInMethodSchema,
    platform: checkInPlatformSchema,
    appVersion: z.string().max(40).optional(),
    clientTime: z.iso.datetime({ offset: true }).optional(),
    location: checkInLocationSchema,
  })
  .superRefine((value, ctx) => {
    const length = value.method === 'typed_code' ? TYPED_CODE_LENGTH : LINK_CODE_LENGTH
    if (value.code.length !== length) {
      ctx.addIssue({ code: 'custom', path: ['code'], message: `The code has ${length} characters` })
    }
  })
export type CheckIn = z.infer<typeof checkInSchema>

/** A typed note: required, as 1 to 500 characters, when the reason code is `other`. */
function requireReasonForOther(
  value: { reasonCode: string; reason?: string },
  ctx: z.RefinementCtx,
) {
  if (value.reasonCode === 'other' && !value.reason) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Say what the reason is' })
  }
}

export const overturnSchema = z
  .object({
    reasonCode: z.enum(OVERTURN_REASON_CODES),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine(requireReasonForOther)
export type Overturn = z.infer<typeof overturnSchema>

export const manualMarkSchema = z
  .object({
    reasonCode: z.enum(MANUAL_MARK_REASON_CODES),
    reason: z.string().trim().max(500).optional(),
    idDocumentType: z.enum(ID_DOCUMENT_TYPES),
  })
  .superRefine(requireReasonForOther)
export type ManualMark = z.infer<typeof manualMarkSchema>

export const disputeSchema = z.object({ reason: z.string().trim().min(1).max(500) })
export type Dispute = z.infer<typeof disputeSchema>

export const disputeDecisionSchema = z.object({
  decision: z.enum(DISPUTE_DECISIONS),
  reason: z.string().trim().min(1).max(500),
})
export type DisputeDecisionInput = z.infer<typeof disputeDecisionSchema>

export const supportClassSearchSchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type SupportClassSearch = z.infer<typeof supportClassSearchSchema>

// ── Answers ─────────────────────────────────────────────────────────────────
// Every list route answers `{ items: T[] }`.

/** Each learner counted once by state. The last six add up to `enrolled`. */
export type CheckInMix = {
  enrolled: number
  selfCheckIn: number
  flaggedFromApp: number
  flaggedOther: number
  overturned: number
  markedByHand: number
  notArrived: number
}

export type ClassBlockView = {
  id: string
  position: number
  startsAt: string
  endsAt: string
  /** A check-in or manual mark exists, so the block's times can no longer change. */
  frozen: boolean
  checkInOpensAt: string
  checkInClosesAt: string
}

/** `GET classes`. */
export type ClassSummary = {
  id: string
  name: string
  courseId: string
  courseTitle: string
  delivery: ClassDelivery
  status: ClassStatus
  seats: number
  timeZone: string
  instructor: { userId: string; displayName: string }
  firstBlockStartsAt: string | null
  lastBlockEndsAt: string | null
  enrolledCount: number
}

/** `GET classes/:id` and the answer to every class write. */
export type ClassDetail = ClassSummary & {
  venueAddress: string | null
  venue: {
    lat: number
    lng: number
    accuracyM: number
    radiusM: number
    setAt: string
  } | null
  publishedAt: string | null
  viewerIsInstructor: boolean
  blocks: (ClassBlockView & { mix: CheckInMix })[]
  mix: CheckInMix
}

export type ManualMarkView = {
  eventId: string
  reasonCode: ManualMarkReasonCode
  reason: string | null
  markedAt: string
  subState: ManualMarkSubState
  disputeUntil: string
}

export type RosterRow = {
  enrollmentId: string
  learner: { userId: string; displayName: string; email: string }
  state: AttendanceState
  flagReason: FlagReason | null
  distanceM: number | null
  accuracyM: number | null
  checkedInAt: string | null
  method: CheckInMethod | null
  lastRefusal: { reason: RefusalReason; at: string } | null
  lockedUntil: string | null
  manualMark: ManualMarkView | null
}

/** `GET .../roster`, and the answer to an overturn or a manual mark. */
export type RosterView = {
  block: ClassBlockView
  serverTime: string
  venueSet: boolean
  learners: RosterRow[]
}

/** `GET .../code`: the current period's code and the next two. */
export type CodeView = {
  codes: { typed: string; qrSvg: string; startsInMs: number; endsInMs: number }[]
  checkInClosesAt: string
}

/** `GET /me/classes`. */
export type LearnerClass = {
  enrollmentId: string
  class: {
    id: string
    name: string
    courseTitle: string
    delivery: ClassDelivery
    venueAddress: string | null
    timeZone: string
  }
  blocks: {
    id: string
    startsAt: string
    endsAt: string
    checkInOpen: boolean
    state: AttendanceState
    flagReason: FlagReason | null
    manualMark: ManualMarkView | null
    overturn: { reasonCode: OverturnReasonCode; at: string } | null
  }[]
}

/** `GET /me/classes/blocks/:blockId`. */
export type CheckInContext = {
  blockId: string
  className: string
  startsAt: string
  endsAt: string
  timeZone: string
  asksLocation: boolean
  checkInOpensAt: string
  checkInClosesAt: string
  state: AttendanceState
}

/** `POST /me/classes/blocks/:blockId/check-in`. */
export type CheckInResult = {
  state: AttendanceState
  flagReason: FlagReason | null
  checkedInAt: string | null
}

/** `GET classes/:id/disputes`, and the answer to a decision. */
export type DisputeView = {
  disputeEventId: string
  markEventId: string
  blockId: string
  learnerName: string
  markReasonCode: ManualMarkReasonCode
  markReason: string | null
  markedByName: string
  markedAt: string
  disputeReason: string
  disputedAt: string
  decision: {
    decision: DisputeDecision
    reason: string
    decidedByName: string
    decidedAt: string
  } | null
}

type ProfileRef = { profile: { id: string; displayName: string } }

/** `GET /support/classes`. */
export type SupportClassSummary = ClassSummary & ProfileRef
/** `GET /support/classes/:id`. */
export type SupportClass = ClassDetail & ProfileRef

/** `GET /support/classes/:id/blocks/:blockId`. */
export type SupportClassBlock = {
  class: SupportClass
  block: ClassBlockView
  /** Refused attempts per reason over the last 15 minutes. */
  attemptsByReason: Record<RefusalReason, number>
  learners: (RosterRow & {
    /** The reading; `'erased'` when the check-in has an accuracy but no location row; null when no reading was sent. */
    coordinates: { lat: number; lng: number } | 'erased' | null
    events: {
      type: AttendanceEventType
      at: string
      actorName: string
      reasonCode: string | null
      reason: string | null
    }[]
  })[]
}

/** `GET /support/features`. */
export type SupportFeatures = { classes: boolean }
