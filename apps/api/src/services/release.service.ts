import { schema as s } from '@elevate/db'
import { and, eq, gt, inArray, lte, or, type SQL, sql } from 'drizzle-orm'
import pg from 'pg'
import type { Deps } from '../deps'
import { ClassSalesService } from './class-sales.service'
import { PaymentsService } from './payments.service'
import { PayoutsService } from './payouts.service'
import { SeatRefundsService } from './seat-refunds.service'

const DAY_MS = 24 * 60 * 60 * 1000

/** The advisory lock key one release run holds, so that two runs cannot overlap. */
export const RELEASE_LOCK_KEY = 7_310_258_421

/** A held run lock; `release` gives it up. */
export type RunLock = { release: () => Promise<void> }
/** Takes the run lock, or answers null when another run holds it. */
export type TakeRunLock = () => Promise<RunLock | null>

/** The steps of a run, by the service that does each. Tests replace them to watch the order. */
export type ReleaseSteps = {
  finishStale: (now: Date) => Promise<unknown>
  fillStripeFees: () => Promise<unknown>
  sendUnfinished: (now: Date) => Promise<{ done: number }>
  markReleased: (now: Date, runId: string) => Promise<{ classesReleased: number }>
  resumeSending: (now: Date) => Promise<unknown>
  payDue: (now: Date, runId: string) => Promise<{ payoutsCreated: number }>
  finishLeaving: (now: Date) => Promise<unknown>
}

export type ReleaseRunResult =
  | { status: 'locked' }
  | {
      status: 'finished'
      runId: string
      refundsSent: number
      classesReleased: number
      payoutsCreated: number
      needingAttention: number
      /** The failures of the steps that threw, in order; null when none did. */
      error: string | null
    }

/** The databases this process is running a release in; PGlite has one session, so it needs this. */
const running = new WeakSet<object>()

/**
 * The run lock: Postgres's session-level advisory lock, taken with `pg_try_advisory_lock`. On
 * node-postgres it is held on one connection checked out of the pool for the whole run, so the
 * lock and its release are on the same session. PGlite has one session, in which the advisory
 * lock is re-entrant, so within one process a second run is also refused while the first runs.
 */
export function advisoryRunLock(db: Deps['db']): TakeRunLock {
  return async () => {
    if (running.has(db)) return null
    running.add(db)
    try {
      // Drizzle keeps the driver's client on the database object; its types leave it off `AnyDb`.
      const client = (db as unknown as { $client?: unknown }).$client
      if (client instanceof pg.Pool) {
        const session = await client.connect()
        try {
          const { rows } = await session.query<{ locked: boolean }>(
            'select pg_try_advisory_lock($1) as locked',
            [RELEASE_LOCK_KEY],
          )
          if (!rows[0]?.locked) {
            session.release()
            running.delete(db)
            return null
          }
        } catch (error) {
          session.release()
          throw error
        }
        return {
          release: async () => {
            try {
              await session.query('select pg_advisory_unlock($1)', [RELEASE_LOCK_KEY])
            } finally {
              session.release()
              running.delete(db)
            }
          },
        }
      }
      const session = db as unknown as {
        execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }>
      }
      const result = await session.execute(
        sql`select pg_try_advisory_lock(${RELEASE_LOCK_KEY}) as locked`,
      )
      if (!result.rows[0]?.locked) {
        running.delete(db)
        return null
      }
      return {
        release: async () => {
          try {
            await session.execute(sql`select pg_advisory_unlock(${RELEASE_LOCK_KEY})`)
          } finally {
            running.delete(db)
          }
        },
      }
    } catch (error) {
      running.delete(db)
      throw error
    }
  }
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * The release job (docs/designs/scheduled-classes-selling.md, "One run"): the only program that
 * sends a refund or a payout to Stripe. `dist/release.js` runs it every 15 minutes; in
 * development `POST /dev/release-run` runs it inside the API.
 *
 * Every step is safe to repeat, so a run that stops part-way is followed by another that sends
 * nothing twice. A step that throws is recorded in the run's `error`, and the later steps still
 * run.
 */
export class ReleaseService {
  private readonly steps: ReleaseSteps
  private readonly takeLock: TakeRunLock

  constructor(
    private readonly deps: Deps,
    options: { steps?: Partial<ReleaseSteps>; lock?: TakeRunLock } = {},
  ) {
    const classSales = new ClassSalesService(deps)
    const payments = new PaymentsService(deps)
    const seatRefunds = new SeatRefundsService(deps)
    const payouts = new PayoutsService(deps)
    this.steps = {
      finishStale: (now) => classSales.finishStale(now),
      fillStripeFees: () => payments.fillStripeFees(),
      sendUnfinished: (now) => seatRefunds.sendUnfinished(now),
      markReleased: (now, runId) => payouts.markReleased(now, runId),
      resumeSending: (now) => payouts.resumeSending(now),
      payDue: (now, runId) => payouts.payDue(now, runId),
      finishLeaving: (now) => classSales.finishLeaving(now),
      ...options.steps,
    }
    this.takeLock = options.lock ?? advisoryRunLock(deps.db)
  }

  /**
   * One run, in order: take the lock (or log and return), start the `payout_runs` row, finish
   * stale opt-ins, fill Stripe's fees, send the seat refunds, mark what is released, resume
   * payouts left at `sending`, pay what is due, finish due leaves, then count what needs a
   * person, finish the row and write one log line, `release_run_finished`, for the alarms.
   */
  async run(now: Date = this.deps.now()): Promise<ReleaseRunResult> {
    const { db, log } = this.deps
    const lock = await this.takeLock()
    if (!lock) {
      log.info('release run skipped: another run holds the lock', { event: 'release_run_locked' })
      return { status: 'locked' }
    }
    try {
      const [run] = await db.insert(s.payoutRuns).values({ startedAt: now }).returning()
      if (!run) throw new Error('the payout run row was not written')
      const failures: string[] = []
      const step = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
        try {
          return await fn()
        } catch (error) {
          failures.push(`${name}: ${messageOf(error)}`)
          log.error('release run step failed', {
            runId: run.id,
            step: name,
            error: messageOf(error),
          })
          return fallback
        }
      }
      const { steps } = this
      await step('finishStale', () => steps.finishStale(now), null)
      await step('fillStripeFees', () => steps.fillStripeFees(), null)
      const sent = await step('sendUnfinished', () => steps.sendUnfinished(now), { done: 0 })
      const released = await step('markReleased', () => steps.markReleased(now, run.id), {
        classesReleased: 0,
      })
      await step('resumeSending', () => steps.resumeSending(now), null)
      const paid = await step('payDue', () => steps.payDue(now, run.id), { payoutsCreated: 0 })
      await step('finishLeaving', () => steps.finishLeaving(now), null)
      // A step that failed needs a person too, so the alarm on `needingAttention` also fires for a
      // step that fails on every run, not only for the rows and payouts it counts.
      const needingAttention =
        (await step('needingAttention', () => this.needingAttention(now), 0)) + failures.length
      const error = failures.length ? failures.join('; ').slice(0, 2000) : null
      const counts = {
        refundsSent: sent.done,
        classesReleased: released.classesReleased,
        payoutsCreated: paid.payoutsCreated,
        needingAttention,
      }
      await db
        .update(s.payoutRuns)
        .set({ ...counts, finishedAt: this.deps.now(), error })
        .where(eq(s.payoutRuns.id, run.id))
      log.info('release run finished', { event: 'release_run_finished', runId: run.id, ...counts })
      return { status: 'finished', runId: run.id, ...counts, error }
    } finally {
      await lock.release()
    }
  }

  /**
   * What the alarm reports: `failed` seat refund rows; rows that are ready (`pending` or
   * `refund_sent`), or waiting for Stripe's fee, and have not been sent for a day; payouts that
   * failed in the last day, at Stripe or at the bank; and payouts left at `sending` for a day. A
   * row waiting for a manual mark or a bank dispute can wait for weeks by design, so it is not
   * counted.
   */
  async needingAttention(now: Date): Promise<number> {
    const { db } = this.deps
    const dayAgo = new Date(now.getTime() - DAY_MS)
    const failedRows = await db.$count(s.seatRefunds, eq(s.seatRefunds.status, 'failed'))
    const staleRows = await db.$count(
      s.seatRefunds,
      and(
        or(
          inArray(s.seatRefunds.status, ['pending', 'refund_sent']),
          and(eq(s.seatRefunds.status, 'waiting'), eq(s.seatRefunds.waitingFor, 'stripe_fee')),
        ),
        sql`coalesce(${s.seatRefunds.firstAttemptAt}, ${s.seatRefunds.createdAt}) <= ${dayAgo.toISOString()}::timestamptz`,
      ),
    )
    const failedPayouts = await db.$count(
      s.auditLog,
      and(eq(s.auditLog.action, 'payout.failed'), gt(s.auditLog.createdAt, dayAgo)),
    )
    const stuckPayouts = await db.$count(
      s.payouts,
      and(eq(s.payouts.sendStatus, 'sending'), lte(s.payouts.createdAt, dayAgo)),
    )
    return failedRows + staleRows + failedPayouts + stuckPayouts
  }
}
