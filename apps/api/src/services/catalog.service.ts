import {
  type CatalogQuery,
  type CategoryCount,
  COURSE_CATEGORIES,
  type CourseCard,
  type CoursePublicView,
  type Page,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, asc, desc, eq, exists, ilike, or, type SQL, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import { MediaService } from './media.service'

type CourseWithCard = typeof s.courses.$inferSelect & {
  thumbnail: typeof s.mediaAssets.$inferSelect | null
  teacher: typeof s.users.$inferSelect & {
    teacherProfile: typeof s.teacherProfiles.$inferSelect | null
  }
  lessons: Array<{ id: string }>
}

const encodeOffset = (offset: number) => Buffer.from(String(offset)).toString('base64url')
const decodeOffset = (cursor?: string) => {
  if (!cursor) return 0
  const n = Number(Buffer.from(cursor, 'base64url').toString('utf8'))
  return Number.isInteger(n) && n >= 0 ? n : 0
}

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
      teacherName:
        course.teacher.teacherProfile?.displayName ?? course.teacher.name ?? 'Elevate teacher',
      enrolCount: course.enrolCount,
      lessonCount: course.lessons.length,
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
    const { db } = this.deps
    const conditions: SQL[] = [eq(s.courses.status, 'live')]
    if (query.category) conditions.push(eq(s.courses.category, query.category))
    if (query.q) {
      const like = `%${query.q.replace(/[%_]/g, '\\$&')}%`
      const teacherMatch = exists(
        db
          .select({ one: sql`1` })
          .from(s.teacherProfiles)
          .where(
            and(
              eq(s.teacherProfiles.userId, s.courses.teacherId),
              ilike(s.teacherProfiles.displayName, like),
            ),
          ),
      )
      const match = or(ilike(s.courses.title, like), ilike(s.courses.summary, like), teacherMatch)
      if (match) conditions.push(match)
    }
    const offset = decodeOffset(query.cursor)
    const rows = await db.query.courses.findMany({
      where: and(...conditions),
      with: {
        thumbnail: true,
        teacher: { with: { teacherProfile: true } },
        lessons: { columns: { id: true } },
      },
      orderBy:
        query.sort === 'popular'
          ? [desc(s.courses.enrolCount), desc(s.courses.publishedAt)]
          : [desc(s.courses.publishedAt), desc(s.courses.createdAt)],
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

  async detail(slug: string, viewerId: string | null): Promise<CoursePublicView> {
    const { db } = this.deps
    const course = await db.query.courses.findFirst({
      where: eq(s.courses.slug, slug),
      with: {
        thumbnail: true,
        teacher: { with: { teacherProfile: true } },
        lessons: {
          orderBy: [asc(s.lessons.position)],
          with: {
            prerequisites: true,
            artefacts: {
              orderBy: [asc(s.artefacts.position)],
              with: { media: { columns: { durationSeconds: true } } },
            },
          },
        },
      },
    })
    if (!course) throw errors.notFound('Course')
    const viewer = viewerId
      ? await db.query.enrollments.findFirst({
          where: and(eq(s.enrollments.courseId, course.id), eq(s.enrollments.userId, viewerId)),
        })
      : null
    // Teachers and staff may preview unpublished courses; everyone else sees live ones only.
    if (course.status !== 'live') {
      const allowed = viewerId && (viewerId === course.teacherId || (await this.isStaff(viewerId)))
      if (!allowed) throw errors.notFound('Course')
    }
    const lessons = course.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      summary: l.summary,
      position: l.position,
      prerequisiteIds: l.prerequisites.map((p) => p.prerequisiteLessonId),
      artefacts: l.artefacts.map((a) => ({
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
      teacher: {
        id: course.teacher.id,
        displayName:
          course.teacher.teacherProfile?.displayName ?? course.teacher.name ?? 'Elevate teacher',
        headline: course.teacher.teacherProfile?.headline ?? null,
        bio: course.teacher.teacherProfile?.bio ?? null,
        avatarUrl: course.teacher.avatarUrl,
      },
      lessons,
      viewer: viewer
        ? {
            enrollmentId: viewer.id,
            status: viewer.status,
            completedAt: viewer.completedAt?.toISOString() ?? null,
          }
        : null,
    }
  }

  private async isStaff(userId: string): Promise<boolean> {
    const roles = await this.deps.db.query.userRoles.findMany({
      where: eq(s.userRoles.userId, userId),
    })
    return roles.some((r) => r.role === 'support_agent' || r.role === 'super_admin')
  }
}
