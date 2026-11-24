/**
 * Class dates and times. A Teach request carries wall-clock dates and times; the API turns them
 * into instants in the class's time zone, and the portals turn instants back for display. Built
 * on `Intl.DateTimeFormat`, so it needs no date library.
 */

/** The most blocks a class can have. */
export const MAX_BLOCKS = 60
/** Every Part 1 class is in this zone; the API sets it and no request can. */
export const CLASS_TIME_ZONE = 'Asia/Singapore'

/** A wall-clock date and time: `YYYY-MM-DD` and `HH:mm`. */
export type ZonedDateTime = { date: string; time: string }

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{2}):(\d{2})$/
const HOUR_MS = 3_600_000

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, f)
  }
  return f
}

/** The wall clock in `timeZone` at `ms`, read as if it were UTC. */
function wallClockAsUtc(ms: number, timeZone: string): number {
  const parts: Record<string, number> = {}
  for (const part of formatter(timeZone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return Date.UTC(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  )
}

/** The zone's offset from UTC at `ms`, in milliseconds, to the whole second. */
function offsetAt(ms: number, timeZone: string): number {
  const wholeSecond = Math.floor(ms / 1000) * 1000
  return wallClockAsUtc(wholeSecond, timeZone) - wholeSecond
}

function parse({ date, time }: ZonedDateTime): number {
  const d = DATE.exec(date)
  const t = TIME.exec(time)
  if (!d || !t) throw new RangeError(`not a date and time: ${date} ${time}`)
  const [year, month, day, hour, minute] = [d[1], d[2], d[3], t[1], t[2]].map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ]
  const local = Date.UTC(year, month - 1, day, hour, minute)
  const back = new Date(local)
  if (
    hour > 23 ||
    minute > 59 ||
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    throw new RangeError(`not a date and time: ${date} ${time}`)
  }
  return local
}

/** Whether `date` and `time` name a real calendar date and time of day. */
export function isValidZonedDateTime(value: ZonedDateTime): boolean {
  try {
    parse(value)
    return true
  } catch {
    return false
  }
}

/**
 * The instant a wall-clock date and time names in `timeZone`. Where a daylight-saving change makes
 * the time ambiguous it is the earlier instant; where it skips the time it is the instant that
 * far past the change (02:30 on a spring-forward night becomes 03:30), as `Temporal` does by
 * default. Throws a `RangeError` on a date or time that does not exist on the calendar.
 */
export function zonedToInstant(date: string, time: string, timeZone: string): Date {
  const local = parse({ date, time })
  const before = offsetAt(local - 24 * HOUR_MS, timeZone)
  const after = offsetAt(local + 24 * HOUR_MS, timeZone)
  const matches = [local - before, local - after]
    .filter((ms) => wallClockAsUtc(ms, timeZone) === local)
    .sort((a, b) => a - b)
  return new Date(matches[0] ?? local - before)
}

/** The wall-clock date and time of `instant` in `timeZone`, to the minute. */
export function instantToZoned(instant: Date | string | number, timeZone: string): ZonedDateTime {
  const ms = instant instanceof Date ? instant.getTime() : new Date(instant).getTime()
  const iso = new Date(wallClockAsUtc(ms, timeZone)).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

export const BLOCK_PROBLEMS = ['end_not_after_start', 'overlaps', 'too_many'] as const
export type BlockProblem = (typeof BLOCK_PROBLEMS)[number]

/**
 * Every problem with a class's blocks, by index: a block that does not end after it starts; a
 * block that overlaps another (touching ends do not overlap); each block past `MAX_BLOCKS`.
 */
export function validateBlocks(
  blocks: readonly { startsAt: Date | string | number; endsAt: Date | string | number }[],
): { index: number; problem: BlockProblem }[] {
  const toMs = (v: Date | string | number) =>
    v instanceof Date ? v.getTime() : new Date(v).getTime()
  const spans = blocks.map((b, index) => ({ index, start: toMs(b.startsAt), end: toMs(b.endsAt) }))
  const problems: { index: number; problem: BlockProblem }[] = []
  const valid = spans.filter((s) => s.end > s.start)
  for (const s of spans) {
    if (!(s.end > s.start)) problems.push({ index: s.index, problem: 'end_not_after_start' })
    else if (valid.some((o) => o.index !== s.index && o.start < s.end && s.start < o.end)) {
      problems.push({ index: s.index, problem: 'overlaps' })
    }
    if (s.index >= MAX_BLOCKS) problems.push({ index: s.index, problem: 'too_many' })
  }
  return problems
}
