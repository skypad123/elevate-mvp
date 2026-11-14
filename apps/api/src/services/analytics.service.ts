import { ANALYTICS_EVENTS, type AnalyticsSummary } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { asc, desc, eq, sql } from 'drizzle-orm'
import type { Deps } from '../deps'

const percent = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null)

const median = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}

/** The four spec metrics: completion rate, drop-off lesson, checkout conversion, time to first payout. */
export class AnalyticsService {
  constructor(private readonly deps: Deps) {}

  async summary(): Promise<AnalyticsSummary> {
    const { db } = this.deps
    const completedExpr = sql<number>`count(${s.enrollments.id}) filter (where ${s.enrollments.completedAt} is not null)::int`
    const [totals] = await db
      .select({ enrolled: sql<number>`count(*)::int`, completed: completedExpr })
      .from(s.enrollments)
      .where(eq(s.enrollments.status, 'active'))
    const perCourse = await db
      .select({
        courseId: s.courses.id,
        title: s.courses.title,
        enrolled: sql<number>`count(${s.enrollments.id})::int`,
        completed: completedExpr,
      })
      .from(s.courses)
      .leftJoin(
        s.enrollments,
        sql`${s.enrollments.courseId} = ${s.courses.id} and ${s.enrollments.status} = 'active'`,
      )
      .where(eq(s.courses.status, 'live'))
      .groupBy(s.courses.id, s.courses.title)
      .orderBy(desc(sql`count(${s.enrollments.id})`), asc(s.courses.title))
      .limit(10)
    // Joined through the live view, so a draft copy of a lesson is never counted.
    const starts = await db
      .select({
        position: s.liveLessons.position,
        starts: sql<number>`count(distinct ${s.analyticsEvents.userId})::int`,
      })
      .from(s.analyticsEvents)
      .innerJoin(
        s.liveLessons,
        sql`${s.liveLessons.id}::text = ${s.analyticsEvents.properties}->>'lessonId'`,
      )
      .where(eq(s.analyticsEvents.name, ANALYTICS_EVENTS.lessonStarted))
      .groupBy(s.liveLessons.position)
      .orderBy(asc(s.liveLessons.position))
    const events = await db
      .select({ name: s.analyticsEvents.name, count: sql<number>`count(*)::int` })
      .from(s.analyticsEvents)
      .groupBy(s.analyticsEvents.name)
    const countOf = (name: string) => events.find((e) => e.name === name)?.count ?? 0
    const payouts = await db
      .select({
        seconds: sql<
          number | null
        >`(${s.analyticsEvents.properties}->>'secondsSinceApproval')::float8`,
      })
      .from(s.analyticsEvents)
      .where(eq(s.analyticsEvents.name, ANALYTICS_EVENTS.firstPayout))
    const days = payouts
      .map((r) => (r.seconds === null ? null : Number(r.seconds) / 86_400))
      .filter((d): d is number => d !== null && Number.isFinite(d))

    let dropOffIndex: number | null = null
    let biggestFall = 0
    for (let i = 1; i < starts.length; i++) {
      const fall = (starts[i - 1]?.starts ?? 0) - (starts[i]?.starts ?? 0)
      if (fall > biggestFall) {
        biggestFall = fall
        dropOffIndex = starts[i]?.position ?? null
      }
    }
    const medianDays = median(days)
    return {
      generatedAt: this.deps.now().toISOString(),
      completion: {
        enrolled: totals?.enrolled ?? 0,
        completed: totals?.completed ?? 0,
        ratePercent: percent(totals?.completed ?? 0, totals?.enrolled ?? 0),
      },
      courses: perCourse.map((c) => ({ ...c, ratePercent: percent(c.completed, c.enrolled) })),
      dropOff: { lessons: starts, dropOffIndex },
      checkout: {
        started: countOf(ANALYTICS_EVENTS.checkoutStarted),
        completed: countOf(ANALYTICS_EVENTS.checkoutCompleted),
        ratePercent: percent(
          countOf(ANALYTICS_EVENTS.checkoutCompleted),
          countOf(ANALYTICS_EVENTS.checkoutStarted),
        ),
      },
      firstPayout: {
        teachersPaid: payouts.length,
        medianDays: medianDays === null ? null : Math.round(medianDays * 10) / 10,
      },
    }
  }
}
