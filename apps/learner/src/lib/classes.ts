import type {
  CheckInContext,
  CheckInLocation,
  CheckInMethod,
  CheckInPlatform,
  CheckInResult,
  LearnerClass,
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
