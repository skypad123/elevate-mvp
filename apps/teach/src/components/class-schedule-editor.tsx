import {
  type BlockProblem,
  type ClassBlockInput,
  type ClassBlockView,
  instantToZoned,
  isValidZonedDateTime,
  MAX_BLOCKS,
  validateBlocks,
  zonedToInstant,
} from '@elevate/core'
import { Button, Input } from '@elevate/web-ui'
import { CalendarPlus, Lock, Plus, Trash2 } from 'lucide-react'
import { zoneLabel } from '../lib/classes'

/**
 * One row of the schedule: a wall-clock date and times in the class's zone. `id` is the stored
 * block's, for a row that came from the API; a row without one is a new block. `key` keeps React's
 * rows steady while rows are added and removed.
 */
export type ScheduleRow = {
  key: string
  id?: string
  date: string
  startTime: string
  endTime: string
  /** The block has a check-in or a manual mark, so its times can no longer change. */
  frozen: boolean
  /** The block has no attendance event of any kind, so it can be removed. */
  removable: boolean
}

let nextKey = 0
const newKey = () => `row-${++nextKey}`

export function emptyRow(date = '', startTime = '09:00', endTime = '12:00'): ScheduleRow {
  return { key: newKey(), date, startTime, endTime, frozen: false, removable: true }
}

/** The stored blocks as rows, in the class's zone. */
export function rowsFromBlocks(blocks: readonly ClassBlockView[], timeZone: string): ScheduleRow[] {
  return blocks.map((block) => {
    const start = instantToZoned(block.startsAt, timeZone)
    const end = instantToZoned(block.endsAt, timeZone)
    return {
      key: block.id,
      id: block.id,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      frozen: block.frozen,
      removable: block.removable,
    }
  })
}

/** What the API takes: new rows without an id, kept rows with theirs. */
export function blocksFromRows(
  rows: readonly ScheduleRow[],
): (ClassBlockInput & { id?: string })[] {
  return rows.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
  }))
}

const PROBLEM_TEXT: Record<BlockProblem | 'incomplete', string> = {
  incomplete: 'Enter a date, a start time and an end time.',
  end_not_after_start: 'The end time must be after the start time.',
  overlaps: 'This overlaps another block.',
  too_many: `A class can have at most ${MAX_BLOCKS} blocks.`,
}

/** The text for a problem the API reports in `blocks_invalid`. */
export function blockProblemText(problem: string): string {
  return PROBLEM_TEXT[problem as BlockProblem] ?? 'Check this block.'
}

/** Whether a row is a whole date with a start and end time. */
export function rowIsComplete(row: Pick<ScheduleRow, 'date' | 'startTime' | 'endTime'>): boolean {
  return (
    isValidZonedDateTime({ date: row.date, time: row.startTime }) &&
    isValidZonedDateTime({ date: row.date, time: row.endTime })
  )
}

/**
 * The problem with each row, by row key, worked out with the same `validateBlocks` the API runs.
 * A row that is not a whole date and time is "incomplete" and is left out of the overlap check.
 */
export function scheduleProblems(
  rows: readonly ScheduleRow[],
  timeZone: string,
): Map<string, string> {
  const out = new Map<string, string>()
  const complete: { key: string; startsAt: Date; endsAt: Date }[] = []
  for (const row of rows) {
    if (!rowIsComplete(row)) {
      out.set(row.key, PROBLEM_TEXT.incomplete)
      continue
    }
    complete.push({
      key: row.key,
      startsAt: zonedToInstant(row.date, row.startTime, timeZone),
      endsAt: zonedToInstant(row.date, row.endTime, timeZone),
    })
  }
  for (const { index, problem } of validateBlocks(complete)) {
    const key = complete[index]?.key
    if (key && !out.has(key)) out.set(key, PROBLEM_TEXT[problem])
  }
  if (rows.length > MAX_BLOCKS) {
    for (const row of rows.slice(MAX_BLOCKS)) out.set(row.key, PROBLEM_TEXT.too_many)
  }
  return out
}

/** The next calendar day after `date` (`YYYY-MM-DD`), or '' when `date` is not a date. */
function dayAfter(date: string): string {
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms)) return ''
  return new Date(ms + 86_400_000).toISOString().slice(0, 10)
}

/** `time` plus `minutes`, kept within the same day. */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return ''
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * The class's schedule: one row per block, each a date with a start and end time, in the class's
 * zone (shown as "SGT"). `@elevate/web-ui` has no date or time picker, so these are the browser's
 * own `date` and `time` inputs. A frozen block is read-only and cannot be removed.
 *
 * `problems` are the messages to show beside each row, by row key: the form passes the local
 * checks and anything the API refused.
 */
export function ClassScheduleEditor({
  rows,
  onChange,
  timeZone,
  problems,
  disabled,
}: {
  rows: ScheduleRow[]
  onChange: (rows: ScheduleRow[]) => void
  timeZone: string
  problems: Map<string, string>
  disabled?: boolean
}) {
  const zone = zoneLabel(timeZone)
  const set = (key: string, patch: Partial<ScheduleRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  const remove = (key: string) => onChange(rows.filter((row) => row.key !== key))
  const insertAfter = (key: string, row: ScheduleRow) => {
    const at = rows.findIndex((r) => r.key === key)
    onChange([...rows.slice(0, at + 1), row, ...rows.slice(at + 1)])
  }
  const last = rows[rows.length - 1]
  const full = rows.length >= MAX_BLOCKS

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-small text-ink-tertiary">No blocks yet. Add the first day.</p>
      ) : null}
      <ol className="space-y-3">
        {rows.map((row, index) => {
          const problem = problems.get(row.key)
          const locked = disabled || row.frozen
          const label = `Block ${index + 1}`
          return (
            <li
              key={row.key}
              className="rounded-control border border-border bg-surface-muted p-3"
              aria-label={label}
            >
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  type="date"
                  label="Date"
                  value={row.date}
                  onChange={(e) => set(row.key, { date: e.target.value })}
                  disabled={locked}
                  required
                  aria-invalid={problem ? true : undefined}
                  wrapperClassName="w-44"
                />
                <div className="flex items-end gap-2">
                  <Input
                    type="time"
                    label="Starts"
                    value={row.startTime}
                    onChange={(e) => set(row.key, { startTime: e.target.value })}
                    disabled={locked}
                    required
                    aria-invalid={problem ? true : undefined}
                    wrapperClassName="w-32"
                  />
                  <span className="pb-3 text-small text-ink-tertiary">{zone}</span>
                </div>
                <div className="flex items-end gap-2">
                  <Input
                    type="time"
                    label="Ends"
                    value={row.endTime}
                    onChange={(e) => set(row.key, { endTime: e.target.value })}
                    disabled={locked}
                    required
                    aria-invalid={problem ? true : undefined}
                    wrapperClassName="w-32"
                  />
                  <span className="pb-3 text-small text-ink-tertiary">{zone}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1 pb-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Plus}
                    disabled={disabled || full}
                    onClick={() =>
                      insertAfter(
                        row.key,
                        emptyRow(row.date, row.endTime, addMinutes(row.endTime, 60)),
                      )
                    }
                  >
                    Add another block on this day
                  </Button>
                  {row.frozen || !row.removable ? null : (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${label.toLowerCase()}`}
                      disabled={disabled || rows.length <= 1}
                      onClick={() => remove(row.key)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
              {row.frozen ? (
                <p className="mt-2 flex items-center gap-1.5 text-small text-ink-secondary">
                  <Lock className="size-3.5" aria-hidden />
                  Attendance has been taken for this block, so its times can no longer change.
                </p>
              ) : !row.removable ? (
                <p className="mt-2 flex items-center gap-1.5 text-small text-ink-secondary">
                  <Lock className="size-3.5" aria-hidden />
                  Check-in attempts were made for this block, so it can move but cannot be removed.
                </p>
              ) : null}
              {problem ? (
                <p role="alert" className="mt-2 text-small text-danger">
                  {problem}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
      <Button
        variant="secondary"
        icon={CalendarPlus}
        disabled={disabled || full}
        onClick={() =>
          onChange([
            ...rows,
            emptyRow(
              last ? dayAfter(last.date) : '',
              last?.startTime ?? '09:00',
              last?.endTime ?? '12:00',
            ),
          ])
        }
      >
        Add a day
      </Button>
      <p className="text-small text-ink-tertiary">
        Times are in {zone} ({timeZone}).
      </p>
    </div>
  )
}
