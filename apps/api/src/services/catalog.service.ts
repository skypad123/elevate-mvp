import {
  type CatalogQuery,
  type CategoryCount,
  COURSE_CATEGORIES,
  type CourseCard,
  type CoursePublicView,
  type Page,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, EmptyFilter, eq, exists, ilike, or, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import { hasRole, type SessionUser } from '../middleware/auth'
import { loadActor } from './auth.service'
import { MediaService } from './media.service'
import { profileAvatarUrl } from './profiles.service'

type CourseWithCard = typeof s.courses.$inferSelect & {
  thumbnail: typeof s.mediaAssets.$inferSelect | null
  profile: Pick<typeof s.profiles.$inferSelect, 'displayName'>
  liveLessons: Array<{ id: string }>
}

/** Who is looking: only used to show unpublished courses to the people who may preview them. */
type Viewer = Pick<SessionUser, 'id' | 'roles'>

const encodeOffset = (offset: number) => Buffer.from(String(offset)).toString('base64url')
const decodeOffset = (cursor?: string) => {
  if (!cursor) return 0
  const n = Number(Buffer.from(cursor, 'base64url').toString('utf8'))
  return Number.isInteger(n) && n >= 0 ? n : 0
}

/**
 * The public catalogue. Course content is read through `learnerDb`, which sees only live rows:
 * a writer's pending edits to a live course are not part of what a learner is shown or sold.
 */
export class CatalogService {
  private readonly media: MediaService
  constructor(private readonly deps: Deps) {
    this.media = new MediaService(deps)
  }

  async toCard(course: CourseWithCard): Promise<CourseCard> {
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      category: course.category,
      priceCents: course.priceCents,
      thumbnailUrl: await this.media.publicUrl(course.thumbnail),
      teacherName: course.profile.displayName,
      enrolCount: course.enrolCount,
      lessonCount: course.liveLessons.length,
      publishedAt: course.publishedAt?.toISOString() ?? null,
    }
  }

  async categories(): Promise<CategoryCount[]> {
    const rows = await this.deps.db
      .select({ category: s.courses.category, count: sql<number>`count(*)::int` })
      .from(s.courses)
      .where(eq(s.courses.status, 'live'))
      .groupBy(s.courses.category)
    const counts = new Map(rows.map((r) => [r.category, r.count]))
    return COURSE_CATEGORIES.map((c) => ({
      slug: c.slug,
      label: c.label,
      count: counts.get(c.slug) ?? 0,
    }))
  }

  async list(query: CatalogQuery): Promise<Page<CourseCard>> {
    const { learnerDb: db } = this.deps
    const like = query.q ? `%${query.q.replace(/[%_]/g, '\\$&')}%` : null
    const offset = decodeOffset(query.cursor)
    const rows = await db.query.courses.findMany({
      where: {
        status: 'live',
        ...(query.category ? { category: query.category } : {}),
        // Search matches the title, the summary or the profile's display name. The callback's
        // `course` is the query's own alias for the table, which the subquery must refer to.
        ...(like
          ? {
              RAW: (course) =>
                or(
                  ilike(course.title, like),
                  ilike(course.summary, like),
                  exists(
                    db
                      .select({ one: sql`1` })
                      .from(s.profiles)
                      .where(
                        and(
                          eq(s.profiles.id, course.profileId),
                          ilike(s.profiles.displayName, like),
                        ),
                      ),
                  ),
                ) ?? EmptyFilter,
            }
          : {}),
      },
      with: {
        thumbnail: true,
        profile: true,
        liveLessons: { columns: { id: true } },
      },
      orderBy:
        query.sort === 'popular'
          ? { enrolCount: 'desc', publishedAt: 'desc' }
          : { publishedAt: 'desc', createdAt: 'desc' },
      limit: query.limit + 1,
      offset,
    })
    const items: CourseCard[] = []
    for (const row of rows.slice(0, query.limit)) items.push(await this.toCard(row))
    return {
      items,
      nextCursor: rows.length > query.limit ? encodeOffset(offset + query.limit) : null,
    }
  }

  async detail(slug: string, viewer: Viewer | null): Promise<CoursePublicView> {
    const { db, learnerDb } = this.deps
    const course = await learnerDb.query.courses.findFirst({
      where: { slug },
      with: {
        thumbnail: true,
        profile: { with: { owner: true, avatar: true } },
        liveLessons: {
          orderBy: { position: 'asc' },
          with: {
            livePrerequisites: true,
            liveArtefacts: {
              orderBy: { position: 'asc' },
              with: { media: { columns: { durationSeconds: true } } },
            },
          },
        },
      },
    })
    if (!course) throw errors.notFound('Course')
    const enrollment = viewer
      ? await db.query.enrollments.findFirst({
          where: { courseId: course.id, userId: viewer.id },
        })
      : null
    // Anyone on the course's profile, and staff, may preview an unpublished course; everyone
    // else sees live ones only.
    if (course.status !== 'live') {
      const allowed =
        viewer &&
        (hasRole(viewer, 'support_agent') ||
          (await loadActor(this.deps, viewer, course.profileId)) !== null)
      if (!allowed) throw errors.notFound('Course')
    }
    const lessons = course.liveLessons.map((l) => ({
      id: l.id,
      title: l.title,
      summary: l.summary,
      position: l.position,
      prerequisiteIds: l.livePrerequisites.map((p) => p.prerequisiteLessonId),
      artefacts: l.liveArtefacts.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        durationSeconds: a.durationSeconds ?? a.media?.durationSeconds ?? null,
      })),
    }))
    const artefactCount = lessons.reduce((n, l) => n + l.artefacts.length, 0)
    const durationSeconds = lessons.reduce(
      (n, l) => n + l.artefacts.reduce((m, a) => m + (a.durationSeconds ?? 0), 0),
      0,
    )
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      descriptionJson: course.descriptionJson ?? null,
      category: course.category,
      priceCents: course.priceCents,
      currency: course.currency,
      thumbnailUrl: await this.media.publicUrl(course.thumbnail),
      publishedAt: course.publishedAt?.toISOString() ?? null,
      enrolCount: course.enrolCount,
      lessonCount: lessons.length,
      artefactCount,
      durationSeconds,
      // The public card keeps its field names; `id` is the profile's ID.
      teacher: {
        id: course.profile.id,
        displayName: course.profile.displayName,
        headline: course.profile.headline,
        bio: course.profile.bio,
        avatarUrl: await profileAvatarUrl(this.media, course.profile),
      },
      lessons,
      viewer: enrollment
        ? {
            enrollmentId: enrollment.id,
            status: enrollment.status,
            completedAt: enrollment.completedAt?.toISOString() ?? null,
          }
        : null,
    }
  }
}
