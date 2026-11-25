/**
 * What an attendance record means (docs/designs/scheduled-classes-attendance.md, "The state of
 * one learner in one block"). The API, both portals and the learner app read a learner's state
 * through these functions, so they agree on one definition.
 *
 * Every function is pure and takes `now` from the caller: the API passes `deps.now()`, the one
 * clock every window, lockout and code period reads.
 */
import type { CheckInMix } from '../contracts/classes'

const MINUTE_MS = 60_000

// ── Constants ───────────────────────────────────────────────────────────────

/** Check-in opens this long before a block starts. */
export const CHECK_IN_OPENS_BEFORE_MS = 30 * MINUTE_MS
/** Check-in closes this long after a block ends. */
export const CHECK_IN_CLOSES_AFTER_MS = 30 * MINUTE_MS
/** Refused attempts with a wrong or expired code that lock a learner out of a block. */
export const LOCKOUT_REFUSALS = 5
/** Refusals are counted over this window. */
export const LOCKOUT_WINDOW_MS = 10 * MINUTE_MS
/** Locked while now is before the latest counted refusal plus this. */
export const LOCKOUT_MS = 5 * MINUTE_MS
/** A manual mark can be disputed while now is at or before the mark's time plus this. */
export const DISPUTE_WINDOW_MS = 7 * 24 * 60 * MINUTE_MS
/** A learner's reading with accuracy worse than this has status `inaccurate`. */
export const READING_ACCURACY_LIMIT_M = 500
/** A venue reading with accuracy worse than this needs confirming. */
export const VENUE_ACCURACY_CONFIRM_M = 100
export const DEFAULT_VENUE_RADIUS_M = 200
/** Support's "attempts by reason" covers this window. */
export const ATTEMPTS_SUMMARY_WINDOW_MS = 15 * MINUTE_MS
/** The roster shows "not updating" after this long without a successful answer. */
export const ROSTER_STALE_MS = 10_000

// ── Values ──────────────────────────────────────────────────────────────────

/** A learner's state in a block, in the order `attendanceState` tests them. */
export const ATTENDANCE_STATES = [
  'marked_by_hand',
  'present',
  'present_flagged',
  'mark_voided',
  'overturned',
  'not_arrived',
] as const
export type AttendanceState = (typeof ATTENDANCE_STATES)[number]

/** The sub-state of a standing manual mark, in the order they are tested. */
export const MANUAL_MARK_SUB_STATES = ['upheld', 'disputed', 'settled', 'open'] as const
export type ManualMarkSubState = (typeof MANUAL_MARK_SUB_STATES)[number]

export const LOCATION_STATUSES = [
  'not_required',
  'ok',
  'out_of_range',
  'inaccurate',
  'denied',
  'unavailable',
  'unsupported',
] as const
export type LocationStatus = (typeof LOCATION_STATUSES)[number]

/** The location statuses that flag a check-in: all but `not_required` and `ok`. */
export const FLAG_REASONS = [
  'out_of_range',
  'inaccurate',
  'denied',
  'unavailable',
  'unsupported',
] as const satisfies readonly LocationStatus[]
export type FlagReason = (typeof FLAG_REASONS)[number]

/** What a learner's device can say instead of sending a reading. */
export const NO_READING_STATUSES = [
  'denied',
  'unavailable',
  'unsupported',
] as const satisfies readonly LocationStatus[]
export type NoReadingStatus = (typeof NO_READING_STATUSES)[number]

export const REFUSAL_REASONS = [
  'code_wrong',
  'code_expired',
  'not_open_yet',
  'closed',
  'too_many_attempts',
] as const
export type RefusalReason = (typeof REFUSAL_REASONS)[number]

export const CHECK_IN_METHODS = ['qr_link', 'typed_code'] as const
export type CheckInMethod = (typeof CHECK_IN_METHODS)[number]

export const CHECK_IN_PLATFORMS = ['web', 'ios', 'android'] as const
export type CheckInPlatform = (typeof CHECK_IN_PLATFORMS)[number]

export const DISPUTE_DECISIONS = ['upheld', 'voided'] as const
export type DisputeDecision = (typeof DISPUTE_DECISIONS)[number]

export const OVERTURN_REASON_CODES = ['not_in_room', 'wrong_person', 'other'] as const
export type OverturnReasonCode = (typeof OVERTURN_REASON_CODES)[number]

export const MANUAL_MARK_REASON_CODES = [
  'phone_not_working',
  'no_phone',
  'no_network',
  'app_problem',
  'other',
] as const
export type ManualMarkReasonCode = (typeof MANUAL_MARK_REASON_CODES)[number]

export const ID_DOCUMENT_TYPES = [
  'nric',
  'fin',
  'passport',
  'driving_licence',
  'student_or_staff_pass',
  'other',
] as const
export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number]

/** Matches the `attendance_event_type` enum in `@elevate/db`. */
export const ATTENDANCE_EVENT_TYPES = [
  'attempt_refused',
  'check_in',
  'overturn',
  'manual_mark',
  'dispute',
  'dispute_decision',
] as const
export type AttendanceEventType = (typeof ATTENDANCE_EVENT_TYPES)[number]

/** Who wrote an attendance row, as it was at that moment. */
export const ATTENDANCE_ACTOR_ROLES = ['learner', 'owner', 'manager', 'writer'] as const
export type AttendanceActorRole = (typeof ATTENDANCE_ACTOR_ROLES)[number]

export const CLASS_AUDIT_ACTIONS = [
  'class.created',
  'class.published',
  'class.updated',
  'class.instructor_changed',
  'class.venue_set',
  'attendance.overturned',
  'attendance.manual_marked',
  'attendance.dispute_decided',
] as const
export type ClassAuditAction = (typeof CLASS_AUDIT_ACTIONS)[number]

// ── Inputs ──────────────────────────────────────────────────────────────────

type Instant = Date | string | number

const toMillis = (value: Instant) =>
  value instanceof Date ? value.getTime() : new Date(value).getTime()

/**
 * The fields of an `attendance_events` row these rules read. A caller passes one learner's events
 * for one block, in any order.
 */
export type AttendanceEventFacts = {
  id: string
  type: AttendanceEventType
  createdAt: Instant
  locationStatus?: LocationStatus | null
  refusalReason?: RefusalReason | null
  decision?: DisputeDecision | null
  refersToEventId?: string | null
}

export type BlockTimes = { startsAt: Instant; endsAt: Instant }

// ── The check-in window ─────────────────────────────────────────────────────

export function checkInWindow(block: BlockTimes): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: new Date(toMillis(block.startsAt) - CHECK_IN_OPENS_BEFORE_MS),
    closesAt: new Date(toMillis(block.endsAt) + CHECK_IN_CLOSES_AFTER_MS),
  }
}

/** Open from `opensAt` to `closesAt`, both included. */
export function checkInWindowStatus(
  block: BlockTimes,
  now: Instant,
): 'not_open_yet' | 'open' | 'closed' {
  const { opensAt, closesAt } = checkInWindow(block)
  const at = toMillis(now)
  if (at < opensAt.getTime()) return 'not_open_yet'
  if (at > closesAt.getTime()) return 'closed'
  return 'open'
}

// ── Location ────────────────────────────────────────────────────────────────

export type LatLng = { lat: number; lng: number }

/** The mean radius of the Earth (IUGG), in metres. */
const EARTH_RADIUS_M = 6_371_008.8

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export type Venue = LatLng & { accuracyM: number; radiusM: number }
export type Reading = LatLng & { accuracyM: number }
/** What a check-in sent: a reading, or the reason there is none. */
export type SentLocation = Reading | { status: NoReadingStatus }

/**
 * Step 7 of check-in. A remote class needs no location. For an in-person class a missing reading
 * keeps its reason; a reading worse than 500 m is `inaccurate`; a reading whose distance, less
 * both accuracies, is more than the radius is `out_of_range`.
 *
 * An in-person class always has a venue by the time a learner can check in (no code is shown
 * until it is set), so a missing venue there is a bug and throws.
 */
export function locationStatus({
  delivery,
  venue,
  sent,
}: {
  delivery: 'in_person' | 'remote'
  venue: Venue | null
  sent: SentLocation
}): LocationStatus {
  if (delivery === 'remote') return 'not_required'
  if ('status' in sent) return sent.status
  if (!venue) throw new Error('an in-person check-in needs the venue position')
  if (sent.accuracyM > READING_ACCURACY_LIMIT_M) return 'inaccurate'
  const slack = distanceMeters(sent, venue) - sent.accuracyM - venue.accuracyM
  return slack > venue.radiusM ? 'out_of_range' : 'ok'
}

// ── Lockout ─────────────────────────────────────────────────────────────────

/** Refusals with a wrong or expired code in the last 10 minutes, the edge included. */
function countedRefusals(events: readonly AttendanceEventFacts[], now: Instant): number[] {
  const at = toMillis(now)
  return events
    .filter(
      (e) =>
        e.type === 'attempt_refused' &&
        (e.refusalReason === 'code_wrong' || e.refusalReason === 'code_expired'),
    )
    .map((e) => toMillis(e.createdAt))
    .filter((t) => t <= at && at - t <= LOCKOUT_WINDOW_MS)
}

/**
 * When the learner's lockout for the block ends, or null when they are not locked out. Five
 * counted refusals lock the learner until 5 minutes after the latest of them.
 */
export function lockedUntil(events: readonly AttendanceEventFacts[], now: Instant): Date | null {
  const counted = countedRefusals(events, now)
  if (counted.length < LOCKOUT_REFUSALS) return null
  const until = Math.max(...counted) + LOCKOUT_MS
  return toMillis(now) < until ? new Date(until) : null
}

/** Wrong or expired codes left before a lockout, counting any refusal just stored; never below 0. */
export function attemptsLeft(events: readonly AttendanceEventFacts[], now: Instant): number {
  return Math.max(0, LOCKOUT_REFUSALS - countedRefusals(events, now).length)
}

// ── State ───────────────────────────────────────────────────────────────────

export type AttendanceStateView = {
  state: AttendanceState
  /** Set only when the state is `present_flagged`. */
  flagReason: FlagReason | null
  /** Set only when the state is `marked_by_hand`. */
  subState: ManualMarkSubState | null
  /** When the standing manual mark can no longer be disputed; set only with `marked_by_hand`. */
  disputeUntil: Date | null
}

function isFlagReason(status: LocationStatus | null | undefined): status is FlagReason {
  return (FLAG_REASONS as readonly string[]).includes(status ?? '')
}

/** Reads one learner's events for one block. */
function facts(events: readonly AttendanceEventFacts[]) {
  const byTime = [...events].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))
  const referring = (type: AttendanceEventType, id: string) =>
    byTime.find((e) => e.type === type && e.refersToEventId === id)

  const disputeOf = (mark: AttendanceEventFacts) => referring('dispute', mark.id)
  const decisionOf = (dispute: AttendanceEventFacts) => referring('dispute_decision', dispute.id)
  /** A manual mark stands when no `voided` decision refers to a dispute of it. */
  const markStands = (mark: AttendanceEventFacts) => {
    const dispute = disputeOf(mark)
    return !(dispute && decisionOf(dispute)?.decision === 'voided')
  }
  /** A check-in stands when no overturn refers to it. */
  const checkInStands = (checkIn: AttendanceEventFacts) => !referring('overturn', checkIn.id)

  const latest = (type: AttendanceEventType) => byTime.filter((e) => e.type === type).at(-1)
  const checkIn = latest('check_in')
  const latestMark = latest('manual_mark')
  return {
    byTime,
    checkIn,
    latestMark,
    disputeOf,
    decisionOf,
    markStands,
    checkInStands,
    standingCheckIn: checkIn && checkInStands(checkIn) ? checkIn : undefined,
    standingMark: latestMark && markStands(latestMark) ? latestMark : undefined,
  }
}

const NO_DETAIL = { flagReason: null, subState: null, disputeUntil: null } as const

/**
 * A learner's state in a block. The rows are tested from the top; the first that matches wins:
 * a standing latest manual mark; a standing check-in with no flag; a standing check-in with a
 * flag; a manual mark that does not stand; a check-in that does not stand; nothing.
 */
export function attendanceState(
  events: readonly AttendanceEventFacts[],
  now: Instant,
): AttendanceStateView {
  const f = facts(events)

  if (f.standingMark) {
    const markedAt = toMillis(f.standingMark.createdAt)
    const disputeUntil = new Date(markedAt + DISPUTE_WINDOW_MS)
    const dispute = f.disputeOf(f.standingMark)
    const decision = dispute ? f.decisionOf(dispute) : undefined
    let subState: ManualMarkSubState
    if (decision?.decision === 'upheld') subState = 'upheld'
    else if (dispute) subState = 'disputed'
    else if (toMillis(now) > disputeUntil.getTime()) subState = 'settled'
    else subState = 'open'
    return { state: 'marked_by_hand', flagReason: null, subState, disputeUntil }
  }

  if (f.standingCheckIn) {
    const status = f.standingCheckIn.locationStatus
    if (isFlagReason(status)) return { ...NO_DETAIL, state: 'present_flagged', flagReason: status }
    return { ...NO_DETAIL, state: 'present' }
  }

  if (f.latestMark) return { ...NO_DETAIL, state: 'mark_voided' }
  if (f.checkIn) return { ...NO_DETAIL, state: 'overturned' }
  return { ...NO_DETAIL, state: 'not_arrived' }
}

// ── Attendance for money ────────────────────────────────────────────────────

/** What a learner's attendance in a class means for refunds and release (Part 2, decision 3). */
export type MoneyAttendance = {
  /**
   * Counted as attended: some block has a check-in that stands (flagged or not) or a manual mark
   * whose sub-state is `settled`. A mark the learner disputed never counts, even when upheld.
   */
  counted: boolean
  /** The latest dispute deadline among the learner's manual marks that are `open`, or null. */
  openMarkUntil: Date | null
}

/**
 * Reads one learner's events in a class, grouped by block (a map or a record keyed by block id),
 * through `attendanceState` and its manual mark sub-states.
 */
export function moneyAttendance(
  eventsByBlock:
    | ReadonlyMap<string, readonly AttendanceEventFacts[]>
    | Readonly<Record<string, readonly AttendanceEventFacts[]>>,
  now: Instant,
): MoneyAttendance {
  const blocks =
    eventsByBlock instanceof Map
      ? [...eventsByBlock.values()]
      : Object.values(eventsByBlock as Readonly<Record<string, readonly AttendanceEventFacts[]>>)
  let counted = false
  let openMarkUntil: Date | null = null
  for (const events of blocks) {
    const view = attendanceState(events, now)
    if (view.state === 'present' || view.state === 'present_flagged') counted = true
    if (view.state === 'marked_by_hand' && view.subState === 'settled') counted = true
    if (view.state === 'marked_by_hand' && view.subState === 'open' && view.disputeUntil) {
      if (!openMarkUntil || view.disputeUntil > openMarkUntil) openMarkUntil = view.disputeUntil
    }
  }
  return { counted, openMarkUntil }
}

// ── What may follow what ────────────────────────────────────────────────────

/** A check-in may be overturned only while it stands and carries a location flag. */
export function canOverturn(
  events: readonly AttendanceEventFacts[],
  now: Instant,
): true | 'no_check_in' | 'not_flagged' {
  if (!facts(events).standingCheckIn) return 'no_check_in'
  return attendanceState(events, now).state === 'present_flagged' ? true : 'not_flagged'
}

/**
 * A learner may be marked present by hand only when Not arrived, Overturned or Mark voided: so
 * again after a void, and to repair a mistaken overturn.
 */
export function canManualMark(
  events: readonly AttendanceEventFacts[],
  now: Instant,
): true | 'already_present' {
  const { state } = attendanceState(events, now)
  return state === 'not_arrived' || state === 'overturned' || state === 'mark_voided'
    ? true
    : 'already_present'
}

/**
 * Whether the learner may dispute the manual mark `markEventId`. The events are the learner's own
 * for the block, so a mark among them is the learner's own. The mark must stand, be 7 days old or
 * less, and have no dispute yet.
 */
export function canDispute(
  events: readonly AttendanceEventFacts[],
  markEventId: string,
  now: Instant,
): true | 'not_found' | 'dispute_window_closed' | 'already_disputed' {
  const f = facts(events)
  const mark = f.byTime.find((e) => e.id === markEventId && e.type === 'manual_mark')
  if (!mark || !f.markStands(mark)) return 'not_found'
  if (toMillis(now) > toMillis(mark.createdAt) + DISPUTE_WINDOW_MS) return 'dispute_window_closed'
  if (f.disputeOf(mark)) return 'already_disputed'
  return true
}

/** Whether the dispute `disputeEventId` may be decided: it exists and has no decision yet. */
export function canDecide(
  events: readonly AttendanceEventFacts[],
  disputeEventId: string,
  _now: Instant,
): true | 'not_found' | 'dispute_already_decided' {
  const f = facts(events)
  const dispute = f.byTime.find((e) => e.id === disputeEventId && e.type === 'dispute')
  if (!dispute) return 'not_found'
  return f.decisionOf(dispute) ? 'dispute_already_decided' : true
}

/**
 * Whether a check-in may be written: the learner has no check-in row for the block and no standing
 * manual mark. `repeat` means the learner is already present and the API answers with the
 * existing state; `overturned` means the learner's check-in was overturned and cannot be redone.
 */
export function canCheckIn(
  events: readonly AttendanceEventFacts[],
): true | 'repeat' | 'overturned' {
  const f = facts(events)
  if (f.standingCheckIn || f.standingMark) return 'repeat'
  if (f.checkIn) return 'overturned'
  return true
}

// ── The check-in mix ────────────────────────────────────────────────────────

/**
 * Counts each learner once by state. A flag of `unsupported` is "flagged from the app"; any other
 * flag is "flagged, other". Mark voided counts as not arrived.
 */
export function checkInMix(
  rows: readonly { state: AttendanceState; flagReason: FlagReason | null }[],
): CheckInMix {
  const mix: CheckInMix = {
    enrolled: rows.length,
    selfCheckIn: 0,
    flaggedFromApp: 0,
    flaggedOther: 0,
    overturned: 0,
    markedByHand: 0,
    notArrived: 0,
  }
  for (const { state, flagReason } of rows) {
    switch (state) {
      case 'present':
        mix.selfCheckIn++
        break
      case 'present_flagged':
        if (flagReason === 'unsupported') mix.flaggedFromApp++
        else mix.flaggedOther++
        break
      case 'overturned':
        mix.overturned++
        break
      case 'marked_by_hand':
        mix.markedByHand++
        break
      case 'mark_voided':
      case 'not_arrived':
        mix.notArrived++
        break
    }
  }
  return mix
}
