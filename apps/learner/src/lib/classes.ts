import type {
  CheckInContext,
  CheckInLocation,
  CheckInMethod,
  CheckInPlatform,
  CheckInResult,
  LearnerClass,
  SeatRefundView,
} from '@elevate/core'
import { intlLocale, type Locale, type Translator } from '@elevate/i18n'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { ApiError, errorMessage, unwrap } from './api-error'

/**
 * A learner's scheduled classes and check-in (docs/designs/scheduled-classes-attendance.md). A
 * class enrollment lives on `/me/classes` only; the course routes never return one.
 */
export const classKeys = {
  mine: ['me', 'classes'] as const,
  checkIn: (blockId: string) => ['me', 'classes', 'block', blockId] as const,
}

/** The learner's class enrolments. Empty while the `CLASSES` setting is off. */
export function useMyClasses(enabled: boolean) {
  return useQuery({
    queryKey: classKeys.mine,
    enabled,
    queryFn: async () => (await unwrap(await api.me.classes.$get())).items as LearnerClass[],
  })
}

/** What the check-in screen needs about one session. 404 when the learner is not in its class. */
export function useCheckInContext(blockId: string, enabled: boolean) {
  return useQuery({
    queryKey: classKeys.checkIn(blockId),
    enabled: enabled && !!blockId,
    retry: false,
    queryFn: async () =>
      (await unwrap(await api.me.classes.blocks[':blockId'].$get({ param: { blockId } })))
        .context as CheckInContext,
  })
}

export type CheckInInput = {
  code: string
  method: CheckInMethod
  platform: CheckInPlatform
  appVersion?: string
  clientTime?: string
  location: CheckInLocation
}

export async function checkIn(blockId: string, input: CheckInInput): Promise<CheckInResult> {
  return (
    await unwrap(
      await api.me.classes.blocks[':blockId']['check-in'].$post({
        param: { blockId },
        json: input,
      }),
    )
  ).result as CheckInResult
}

/** Disputes the learner's own manual mark; answers the class as it now stands. */
export async function disputeMark(eventId: string, reason: string): Promise<LearnerClass> {
  return (
    await unwrap(
      await api.me.classes.attendance[':eventId'].dispute.$post({
        param: { eventId },
        json: { reason },
      }),
    )
  ).class as LearnerClass
}

/**
 * Withdraws the learner from their seat (docs/designs/scheduled-classes-selling.md, "Withdraw").
 * The seat is freed at once and the refund is sent by the release job; answers the class as it
 * now stands, with the refund row in `seat.refund`.
 */
export async function withdraw(enrollmentId: string): Promise<LearnerClass> {
  return (
    await unwrap(await api.me.classes[':enrollmentId'].withdraw.$post({ param: { enrollmentId } }))
  ).class as LearnerClass
}

// ── The seat's state ────────────────────────────────────────────────────────

const WITHDREW: readonly string[] = ['learner_withdrew', 'changed_withdrew']
const CANCELLED: readonly string[] = [
  'teacher_cancelled',
  'teacher_cancelled_part',
  'elevate_cancelled',
]
const UNFINISHED: readonly string[] = ['waiting', 'pending', 'refund_sent', 'failed']

/** A seat refund row that the release job has not finished. */
export const refundUnfinished = (refund: SeatRefundView) => UNFINISHED.includes(refund.status)

/**
 * Counted as attended, from the learner's own states: a check-in that stands (flagged or not) or
 * a manual mark whose time to dispute has passed. The API's `moneyAttendance` rule.
 */
export function countedAsAttended(blocks: LearnerClass['blocks']): boolean {
  return blocks.some(
    (b) =>
      b.state === 'present' ||
      b.state === 'present_flagged' ||
      (b.state === 'marked_by_hand' && b.manualMark?.subState === 'settled'),
  )
}

/** The latest dispute deadline among the learner's open manual marks, or null. */
function openMarkUntil(item: LearnerClass): string | null {
  let latest: string | null = null
  for (const mark of item.seat.openMarks) {
    if (latest === null || Date.parse(mark.disputeUntil) > Date.parse(latest)) {
      latest = mark.disputeUntil
    }
  }
  return latest
}

/**
 * What the class screen says about the seat, from `LearnerSeat`:
 * - `withdrawn`: the learner withdrew; the refund row says where the money is.
 * - `cancelled`: the class was cancelled, and the learner is refunded (in full or in part), waits
 *   on an open manual mark, or is counted as attended with nothing to refund.
 * - `withdraw`: the learner can withdraw now, for the amount (or the rate) until the deadline.
 * - `refund`: a refund the teacher gave is under way, so withdrawing waits for it.
 * - `markOpen`, `attended`, `closed`: why withdrawing is not offered.
 */
export type SeatState =
  | { kind: 'withdrawn'; refund: SeatRefundView }
  | { kind: 'cancelled'; outcome: 'refunded'; part: boolean; refund: SeatRefundView }
  | { kind: 'cancelled'; outcome: 'markOpen'; until: string }
  | { kind: 'cancelled'; outcome: 'attended' }
  | {
      kind: 'withdraw'
      full: boolean
      amountCents: number | null
      closesAt: string
    }
  | { kind: 'refund'; refund: SeatRefundView }
  | { kind: 'markOpen'; until: string }
  | { kind: 'attended' }
  | { kind: 'closed' }

export function seatState(item: LearnerClass): SeatState {
  const { seat } = item
  const refund = seat.refund
  const markUntil = openMarkUntil(item)
  if (refund && WITHDREW.includes(refund.kind)) return { kind: 'withdrawn', refund }
  if (seat.classCancelled) {
    if (refund && CANCELLED.includes(refund.kind)) {
      if (refund.status === 'waiting' && refund.waitingFor === 'manual_mark' && markUntil) {
        return { kind: 'cancelled', outcome: 'markOpen', until: markUntil }
      }
      if (refund.status === 'closed' && refund.closedReason === 'mark_settled') {
        return { kind: 'cancelled', outcome: 'attended' }
      }
      return {
        kind: 'cancelled',
        outcome: 'refunded',
        part: refund.kind === 'teacher_cancelled_part',
        refund,
      }
    }
    if (markUntil) return { kind: 'cancelled', outcome: 'markOpen', until: markUntil }
    return { kind: 'cancelled', outcome: 'attended' }
  }
  if (seat.withdrawKind && seat.withdrawClosesAt) {
    return {
      kind: 'withdraw',
      full: seat.withdrawKind === 'changed_withdrew',
      amountCents: seat.withdrawRefundCents,
      closesAt: seat.withdrawClosesAt,
    }
  }
  if (refund && refundUnfinished(refund)) return { kind: 'refund', refund }
  if (markUntil) return { kind: 'markOpen', until: markUntil }
  if (countedAsAttended(item.blocks)) return { kind: 'attended' }
  return { kind: 'closed' }
}

// ── Times, in the class's own time zone ─────────────────────────────────────

type Zoned = { timeZone: string; locale: Locale }

function day(iso: string, { timeZone, locale }: Zoned, year: boolean): string {
  return new Date(iso).toLocaleDateString(intlLocale(locale), {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(year ? { year: 'numeric' } : {}),
  })
}

function time(iso: string, { timeZone, locale }: Zoned, zoneName: boolean): string {
  return new Date(iso).toLocaleTimeString(intlLocale(locale), {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    ...(zoneName ? { timeZoneName: 'short' } : {}),
  })
}

/** A session's day and times: "Tue, 2 Dec 2026, 9:00 am – 12:00 pm SGT". */
export function formatBlockTime(
  block: { startsAt: string; endsAt: string },
  zoned: Zoned,
  t: Translator,
): string {
  return t('learnerClass.block.time', {
    day: day(block.startsAt, zoned, true),
    start: time(block.startsAt, zoned, false),
    end: time(block.endsAt, zoned, true),
  })
}

/** One instant: "Tue, 2 Dec, 8:30 am SGT". */
export function formatClassInstant(iso: string, zoned: Zoned, t: Translator): string {
  return t('learnerClass.instant', { day: day(iso, zoned, false), time: time(iso, zoned, true) })
}

/** A day, for the last day a mark can be disputed: "Tue, 9 Dec 2026". */
export function formatClassDay(iso: string, zoned: Zoned): string {
  return day(iso, zoned, true)
}

// ── A refused check-in ──────────────────────────────────────────────────────

/** The codes after which the screen empties the code field: the learner types the next one. */
export function isCodeRefusal(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'check_in_code_wrong' || error.code === 'check_in_code_expired')
  )
}

/**
 * A refused check-in in the reader's language, with the variable parts the API sends in
 * `details`: the tries left, and when check-in opens, closed or unlocks. Any other error, or one
 * whose details are missing, is worded by `errorMessage` from its code.
 */
export function checkInErrorMessage(error: unknown, zoned: Zoned, t: Translator): string {
  if (!(error instanceof ApiError)) return errorMessage(error, t)
  const details = (error.details ?? {}) as Record<string, unknown>
  const instant = (key: string) =>
    typeof details[key] === 'string' ? formatClassInstant(details[key], zoned, t) : null

  if (error.code === 'check_in_code_wrong' || error.code === 'check_in_code_expired') {
    const left = details.attemptsLeft
    if (typeof left !== 'number') return errorMessage(error, t)
    const base =
      error.code === 'check_in_code_wrong'
        ? 'learnerClass.checkIn.codeWrong'
        : 'learnerClass.checkIn.codeExpired'
    if (left <= 0) return t(`${base}.none`)
    return t(left === 1 ? `${base}.one` : `${base}.other`, { count: left })
  }
  if (error.code === 'check_in_locked') {
    const at = instant('lockedUntil')
    return at ? t('learnerClass.checkIn.lockedUntil', { time: at }) : errorMessage(error, t)
  }
  if (error.code === 'check_in_not_open') {
    const at = instant('opensAt')
    return at ? t('learnerClass.checkIn.notOpenUntil', { time: at }) : errorMessage(error, t)
  }
  if (error.code === 'check_in_closed') {
    const at = instant('closesAt')
    return at ? t('learnerClass.checkIn.closedAt', { time: at }) : errorMessage(error, t)
  }
  return errorMessage(error, t)
}
