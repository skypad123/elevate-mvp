import {
  ANALYTICS_EVENTS,
  type ArtefactView,
  type Capability,
  type CourseSummary,
  type CourseView,
  type CreateCourse,
  can,
  isEmptyDoc,
  type LessonView,
  type QuizDefinition,
  quizDefinitionSchema,
  slugify,
  type UpdateCourse,
  validateCourseForSubmission,
  withSuffix,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import { isPayable } from '../lib/payout'
import type { ProfileActor, SessionUser } from '../middleware/auth'
import { recordAudit, trackEvent } from './audit.service'
import { MediaService } from './media.service'

const EDITABLE_STATUSES = new Set(['draft', 'rejected', 'live'])

/** Any one of these lets an actor change course content; which one applies depends on the course. */
const CONTENT_CAPABILITIES: Capability[] = [
  'course.editDraft',
  'course.editLive',
  'course.proposeLiveEdit',
]

type CourseRow = typeof s.courses.$inferSelect

export class CoursesService {
  private readonly media: MediaService
  constructor(private readonly deps: Deps) {
    this.media = new MediaService(deps)
  }

  // ── loading ──────────────────────────────────────────────────────────────

  /**
   * The full builder view of a course. With `profileId`, the course must belong to that profile;
   * a course of another profile is reported as not found.
   */
  async loadCourseView(courseId: string, profileId?: string): Promise<CourseView> {
    const { db } = this.deps
    const course = await db.query.courses.findFirst({
      where: { id: courseId, ...(profileId ? { profileId } : {}) },
      with: {
        thumbnail: true,
        profile: { with: { owner: true, payoutAccount: true } },
        lessons: {
          orderBy: { position: 'asc', createdAt: 'asc' },
          with: {
            prerequisites: true,
            artefacts: {
              orderBy: { position: 'asc', createdAt: 'asc' },
              with: { media: true, quiz: true },
            },
          },
        },
      },
    })
    if (!course) throw errors.notFound('Course')

    const lessons: LessonView[] = []
    for (const lesson of course.lessons) {
      const artefacts: ArtefactView[] = []
      for (const a of lesson.artefacts) {
        artefacts.push({
          id: a.id,
          lessonId: a.lessonId,
          type: a.type,
          title: a.title,
          position: a.position,
          durationSeconds: a.durationSeconds ?? a.media?.durationSeconds ?? null,
          media: a.media ? await this.media.toView(a.media) : null,
          contentJson: a.contentJson ?? null,
          quiz: a.quiz ? quizFromRow(a.quiz) : null,
        })
      }
      lessons.push({
        id: lesson.id,
        courseId: lesson.courseId,
        title: lesson.title,
        summary: lesson.summary,
        position: lesson.position,
        prerequisiteIds: lesson.prerequisites.map((p) => p.prerequisiteLessonId),
        artefacts,
      })
    }

    const payable = isPayable(course.profile.payoutAccount)
    const thumbnail = course.thumbnail ? await this.media.toView(course.thumbnail) : null
    const checklist = validateCourseForSubmission({
      title: course.title,
      summary: course.summary,
      category: course.category,
      priceCents: course.priceCents,
      hasThumbnail: thumbnail?.status === 'ready',
      hasDescription: !isEmptyDoc(course.descriptionJson),
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        artefacts: l.artefacts.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          mediaStatus: a.media?.status ?? null,
          hasContent: !isEmptyDoc(a.contentJson),
          quizQuestionCount: a.quiz?.questions.length ?? 0,
        })),
      })),
      prerequisites: lessons.flatMap((l) =>
        l.prerequisiteIds.map((prerequisiteId) => ({ lessonId: l.id, prerequisiteId })),
      ),
      payable,
    })

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      descriptionJson: course.descriptionJson ?? null,
      category: course.category,
      priceCents: course.priceCents,
      currency: course.currency,
      status: course.status,
      rejectionReason: course.rejectionReason,
      thumbnail,
      profile: {
        id: course.profile.id,
        displayName: course.profile.displayName,
        ownerEmail: course.profile.owner.email,
        payable,
      },
      lessons,
      checklist,
      enrolCount: course.enrolCount,
      submittedAt: course.submittedAt?.toISOString() ?? null,
      reviewedAt: course.reviewedAt?.toISOString() ?? null,
      publishedAt: course.publishedAt?.toISOString() ?? null,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
    }
  }

  /** Support's read of a course: any profile's, with no actor. */
  async loadForSupport(courseId: string): Promise<CourseView> {
    return this.loadCourseView(courseId)
  }

  /** Lists courses, optionally narrowed to one status and/or one profile. */
  async listSummaries(
    filter: { status?: CourseRow['status']; profileId?: string } = {},
    orderBy: 'updated' | 'submitted' = 'updated',
  ): Promise<CourseSummary[]> {
    const { db } = this.deps
    const rows = await db.query.courses.findMany({
      // Drizzle rejects a filter key whose value is undefined, so absent ones are left out.
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.profileId ? { profileId: filter.profileId } : {}),
      },
      with: {
        thumbnail: true,
        profile: { with: { owner: true } },
        lessons: { with: { artefacts: { columns: { id: true } } }, columns: { id: true } },
      },
      orderBy: orderBy === 'submitted' ? { submittedAt: 'asc' } : { updatedAt: 'desc' },
    })
    const out: CourseSummary[] = []
    for (const c of rows) {
      out.push({
        id: c.id,
        slug: c.slug,
        title: c.title,
        category: c.category,
        status: c.status,
        priceCents: c.priceCents,
        thumbnailUrl: await this.media.publicUrl(c.thumbnail),
        lessonCount: c.lessons.length,
        artefactCount: c.lessons.reduce((n, l) => n + l.artefacts.length, 0),
        enrolCount: c.enrolCount,
        profileId: c.profileId,
        profileName: c.profile.displayName,
        ownerEmail: c.profile.owner.email,
        submittedAt: c.submittedAt?.toISOString() ?? null,
        updatedAt: c.updatedAt.toISOString(),
      })
    }
    return out
  }

  // ── profile operations ───────────────────────────────────────────────────
  //
  // Every function here takes the actor that `requireProfile` resolved. Each lookup filters by the
  // actor's profile in the same query that loads the row, so a course, lesson or artefact of
  // another profile is simply not found.

  async listForProfile(actor: ProfileActor): Promise<CourseSummary[]> {
    return this.listSummaries({ profileId: actor.profileId })
  }

  async view(actor: ProfileActor, courseId: string): Promise<CourseView> {
    return this.loadCourseView(courseId, actor.profileId)
  }

  /** Refuses early when the actor cannot change course content on any course. */
  private assertCanEditContent(actor: ProfileActor): void {
    if (!CONTENT_CAPABILITIES.some((capability) => can(actor, capability))) throw errors.forbidden()
  }

  /** The content rule for one course: locked while under review, otherwise by status. */
  private assertEditable(actor: ProfileActor, course: CourseRow): void {
    if (!EDITABLE_STATUSES.has(course.status)) {
      throw errors.conflict(
        'course_locked',
        'This course is under review and cannot be edited until the review is complete',
      )
    }
    const needed: Capability = course.status === 'live' ? 'course.editLive' : 'course.editDraft'
    if (!can(actor, needed)) throw errors.forbidden()
  }

  private async profileCourse(
    actor: ProfileActor,
    courseId: string,
    options: { forEdit?: boolean } = {},
  ): Promise<CourseRow> {
    if (options.forEdit) this.assertCanEditContent(actor)
    const course = await this.deps.db.query.courses.findFirst({
      where: { id: courseId, profileId: actor.profileId },
    })
    if (!course) throw errors.notFound('Course')
    if (options.forEdit) this.assertEditable(actor, course)
    return course
  }

  private async profileLesson(actor: ProfileActor, lessonId: string) {
    this.assertCanEditContent(actor)
    const lesson = await this.deps.db.query.lessons.findFirst({
      where: { id: lessonId, course: { profileId: actor.profileId } },
      with: { course: true },
    })
    if (!lesson) throw errors.notFound('Lesson')
    this.assertEditable(actor, lesson.course)
    return { lesson, course: lesson.course }
  }

  private async profileArtefact(actor: ProfileActor, artefactId: string) {
    this.assertCanEditContent(actor)
    const artefact = await this.deps.db.query.artefacts.findFirst({
      where: { id: artefactId, lesson: { course: { profileId: actor.profileId } } },
      with: { lesson: { with: { course: true } } },
    })
    if (!artefact) throw errors.notFound('Artefact')
    this.assertEditable(actor, artefact.lesson.course)
    return { artefact, course: artefact.lesson.course }
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title)
    for (let n = 1; n < 100; n++) {
      const candidate = withSuffix(base, n)
      const taken = await this.deps.db.query.courses.findFirst({
        where: { slug: candidate },
        columns: { id: true },
      })
      if (!taken) return candidate
    }
    return `${base}-${Date.now().toString(36)}`
  }

  async create(actor: ProfileActor, input: CreateCourse): Promise<CourseView> {
    const [course] = await this.deps.db
      .insert(s.courses)
      .values({
        profileId: actor.profileId,
        title: input.title,
        slug: await this.uniqueSlug(input.title),
        category: input.category,
      })
      .returning()
    if (!course) throw new Error('failed to create course')
    return this.loadCourseView(course.id)
  }

  /** Course details. Price is not among them: see `setPrice`. */
  async update(
    user: SessionUser,
    actor: ProfileActor,
    courseId: string,
    patch: UpdateCourse,
  ): Promise<CourseView> {
    const course = await this.profileCourse(actor, courseId, { forEdit: true })
    const values: Partial<typeof s.courses.$inferInsert> = {}
    if (patch.title !== undefined) values.title = patch.title
    if (patch.summary !== undefined) values.summary = patch.summary
    if (patch.descriptionJson !== undefined) values.descriptionJson = patch.descriptionJson
    if (patch.category !== undefined) values.category = patch.category
    if (patch.thumbnailMediaId !== undefined) {
      if (patch.thumbnailMediaId)
        await this.media.getOwnedReadyAsset(user, patch.thumbnailMediaId, 'image')
      values.thumbnailMediaId = patch.thumbnailMediaId
    }
    if (patch.title && patch.title !== course.title && course.status !== 'live')
      values.slug = await this.uniqueSlug(patch.title)
    if (Object.keys(values).length)
      await this.deps.db.update(s.courses).set(values).where(eq(s.courses.id, courseId))
    return this.loadCourseView(courseId)
  }

  /** The route requires `course.setPrice`; a price change is always written to the audit log. */
  async setPrice(actor: ProfileActor, courseId: string, priceCents: number): Promise<CourseView> {
    const course = await this.profileCourse(actor, courseId)
    if (!EDITABLE_STATUSES.has(course.status)) {
      throw errors.conflict(
        'course_locked',
        'This course is under review and cannot be edited until the review is complete',
      )
    }
    if (priceCents !== course.priceCents) {
      await this.deps.db.update(s.courses).set({ priceCents }).where(eq(s.courses.id, courseId))
      await recordAudit(this.deps, {
        actorId: actor.userId,
        action: 'course.price',
        entityType: 'course',
        entityId: courseId,
        profileId: actor.profileId,
        metadata: { from: course.priceCents, to: priceCents },
      })
    }
    return this.loadCourseView(courseId)
  }

  async remove(actor: ProfileActor, courseId: string): Promise<void> {
    const course = await this.profileCourse(actor, courseId)
    if (course.status === 'live' || course.status === 'pending_review')
      throw errors.conflict('course_live', 'Live or submitted courses cannot be deleted')
    const [{ count }] = (await this.deps.db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.enrollments)
      .where(eq(s.enrollments.courseId, courseId))) as [{ count: number }]
    if (count > 0)
      throw errors.conflict('has_enrollments', 'Courses with enrolments cannot be deleted')
    await this.deps.db.delete(s.courses).where(eq(s.courses.id, courseId))
  }

  async submit(actor: ProfileActor, courseId: string): Promise<CourseView> {
    const course = await this.profileCourse(actor, courseId)
    if (course.status === 'pending_review')
      throw errors.conflict('already_submitted', 'This course is already under review')
    if (course.status === 'live')
      throw errors.conflict('already_live', 'This course is already live')
    const view = await this.loadCourseView(courseId)
    if (!view.checklist.ok)
      throw errors.unprocessable(
        'not_ready',
        'Fix the checklist before submitting',
        view.checklist.problems,
      )
    await this.deps.db
      .update(s.courses)
      .set({ status: 'pending_review', submittedAt: this.deps.now(), rejectionReason: null })
      .where(eq(s.courses.id, courseId))
    await trackEvent(this.deps, {
      userId: actor.userId,
      name: ANALYTICS_EVENTS.courseSubmitted,
      properties: { courseId, profileId: actor.profileId },
    })
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'course.submit',
      entityType: 'course',
      entityId: courseId,
      profileId: actor.profileId,
    })
    return this.loadCourseView(courseId)
  }

  // lessons

  async addLesson(
    actor: ProfileActor,
    courseId: string,
    input: { title: string; summary?: string | null },
  ): Promise<CourseView> {
    await this.profileCourse(actor, courseId, { forEdit: true })
    const [{ max }] = (await this.deps.db
      .select({ max: sql<number>`coalesce(max(${s.lessons.position}), -1)::int` })
      .from(s.lessons)
      .where(eq(s.lessons.courseId, courseId))) as [{ max: number }]
    await this.deps.db
      .insert(s.lessons)
      .values({ courseId, title: input.title, summary: input.summary ?? null, position: max + 1 })
    return this.loadCourseView(courseId)
  }

  async updateLesson(
    actor: ProfileActor,
    lessonId: string,
    patch: { title?: string; summary?: string | null },
  ): Promise<CourseView> {
    const { course } = await this.profileLesson(actor, lessonId)
    await this.deps.db.update(s.lessons).set(patch).where(eq(s.lessons.id, lessonId))
    return this.loadCourseView(course.id)
  }

  async removeLesson(actor: ProfileActor, lessonId: string): Promise<CourseView> {
    const { course } = await this.profileLesson(actor, lessonId)
    await this.deps.db.delete(s.lessons).where(eq(s.lessons.id, lessonId))
    return this.loadCourseView(course.id)
  }

  async reorderLessons(actor: ProfileActor, courseId: string, ids: string[]): Promise<CourseView> {
    await this.profileCourse(actor, courseId, { forEdit: true })
    const existing = await this.deps.db.query.lessons.findMany({
      where: { courseId },
      columns: { id: true },
    })
    assertSameSet(
      existing.map((l) => l.id),
      ids,
      'lessons',
    )
    for (const [index, id] of ids.entries()) {
      await this.deps.db.update(s.lessons).set({ position: index }).where(eq(s.lessons.id, id))
    }
    return this.loadCourseView(courseId)
  }

  async setPrerequisites(
    actor: ProfileActor,
    lessonId: string,
    prerequisiteIds: string[],
  ): Promise<CourseView> {
    const { course } = await this.profileLesson(actor, lessonId)
    const { db } = this.deps
    const courseLessons = await db.query.lessons.findMany({
      where: { courseId: course.id },
      with: { prerequisites: true },
    })
    const lessonIds = courseLessons.map((l) => l.id)
    const edges = courseLessons
      .filter((l) => l.id !== lessonId)
      .flatMap((l) =>
        l.prerequisites.map((p) => ({ lessonId: l.id, prerequisiteId: p.prerequisiteLessonId })),
      )
      .concat(prerequisiteIds.map((prerequisiteId) => ({ lessonId, prerequisiteId })))
    const { validateDag } = await import('@elevate/core')
    const result = validateDag(lessonIds, edges)
    if (!result.ok) throw errors.unprocessable('prerequisite_cycle', result.message, result)
    await db.delete(s.lessonPrerequisites).where(eq(s.lessonPrerequisites.lessonId, lessonId))
    if (prerequisiteIds.length) {
      await db
        .insert(s.lessonPrerequisites)
        .values(prerequisiteIds.map((prerequisiteLessonId) => ({ lessonId, prerequisiteLessonId })))
    }
    return this.loadCourseView(course.id)
  }

  // artefacts

  async addArtefact(
    actor: ProfileActor,
    lessonId: string,
    input: { type: ArtefactView['type']; title: string },
  ): Promise<CourseView> {
    const { course } = await this.profileLesson(actor, lessonId)
    const { db } = this.deps
    const [{ max }] = (await db
      .select({ max: sql<number>`coalesce(max(${s.artefacts.position}), -1)::int` })
      .from(s.artefacts)
      .where(eq(s.artefacts.lessonId, lessonId))) as [{ max: number }]
    const [artefact] = await db
      .insert(s.artefacts)
      .values({ lessonId, type: input.type, title: input.title, position: max + 1 })
      .returning()
    if (!artefact) throw new Error('failed to create artefact')
    if (input.type === 'quiz') {
      await db
        .insert(s.quizzes)
        .values({ artefactId: artefact.id, passMarkPercent: 70, maxAttempts: 1, questionsJson: [] })
    }
    return this.loadCourseView(course.id)
  }

  async updateArtefact(
    user: SessionUser,
    actor: ProfileActor,
    artefactId: string,
    patch: {
      title?: string
      mediaAssetId?: string | null
      contentJson?: ArtefactView['contentJson']
      durationSeconds?: number | null
    },
  ): Promise<CourseView> {
    const { artefact, course } = await this.profileArtefact(actor, artefactId)
    const values: Partial<typeof s.artefacts.$inferInsert> = {}
    if (patch.title !== undefined) values.title = patch.title
    if (patch.durationSeconds !== undefined) values.durationSeconds = patch.durationSeconds
    if (patch.contentJson !== undefined) {
      if (artefact.type !== 'text')
        throw errors.badRequest('wrong_type', 'Only text artefacts have rich text content')
      values.contentJson = patch.contentJson
    }
    if (patch.mediaAssetId !== undefined) {
      if (artefact.type !== 'video' && artefact.type !== 'audio')
        throw errors.badRequest('wrong_type', 'Only video and audio artefacts have media')
      if (patch.mediaAssetId) {
        const asset = await this.media.getOwnedAsset(user, patch.mediaAssetId)
        if (asset.kind !== artefact.type)
          throw errors.badRequest('wrong_kind', `Expected a ${artefact.type} file`)
        if (asset.durationSeconds && patch.durationSeconds === undefined)
          values.durationSeconds = asset.durationSeconds
      }
      values.mediaAssetId = patch.mediaAssetId
    }
    if (Object.keys(values).length)
      await this.deps.db.update(s.artefacts).set(values).where(eq(s.artefacts.id, artefactId))
    return this.loadCourseView(course.id)
  }

  async removeArtefact(actor: ProfileActor, artefactId: string): Promise<CourseView> {
    const { course } = await this.profileArtefact(actor, artefactId)
    await this.deps.db.delete(s.artefacts).where(eq(s.artefacts.id, artefactId))
    return this.loadCourseView(course.id)
  }

  async reorderArtefacts(
    actor: ProfileActor,
    lessonId: string,
    ids: string[],
  ): Promise<CourseView> {
    const { course } = await this.profileLesson(actor, lessonId)
    const existing = await this.deps.db.query.artefacts.findMany({
      where: { lessonId },
      columns: { id: true },
    })
    assertSameSet(
      existing.map((a) => a.id),
      ids,
      'artefacts',
    )
    for (const [index, id] of ids.entries()) {
      await this.deps.db.update(s.artefacts).set({ position: index }).where(eq(s.artefacts.id, id))
    }
    return this.loadCourseView(course.id)
  }

  async upsertQuiz(
    actor: ProfileActor,
    artefactId: string,
    definition: QuizDefinition,
  ): Promise<CourseView> {
    const { artefact, course } = await this.profileArtefact(actor, artefactId)
    if (artefact.type !== 'quiz')
      throw errors.badRequest('wrong_type', 'Only quiz artefacts have questions')
    const values = {
      passMarkPercent: definition.passMarkPercent,
      maxAttempts: definition.maxAttempts,
      timeLimitMinutes: definition.timeLimitMinutes,
      questionsJson: definition.questions,
    }
    await this.deps.db
      .insert(s.quizzes)
      .values({ artefactId, ...values })
      .onConflictDoUpdate({ target: s.quizzes.artefactId, set: values })
    await this.deps.db
      .update(s.artefacts)
      .set({ durationSeconds: Math.max(60, definition.questions.length * 45) })
      .where(eq(s.artefacts.id, artefactId))
    return this.loadCourseView(course.id)
  }
}

export function quizFromRow(row: typeof s.quizzes.$inferSelect): QuizDefinition {
  const parsed = quizDefinitionSchema.safeParse({
    passMarkPercent: row.passMarkPercent,
    maxAttempts: row.maxAttempts,
    timeLimitMinutes: row.timeLimitMinutes,
    questions: row.questionsJson,
  })
  if (parsed.success) return parsed.data
  // An empty quiz (no questions yet) fails the schema's min(1); return it unvalidated so the builder can show it.
  return {
    passMarkPercent: row.passMarkPercent,
    maxAttempts: row.maxAttempts,
    timeLimitMinutes: row.timeLimitMinutes,
    questions: row.questionsJson,
  }
}

function assertSameSet(existing: string[], incoming: string[], what: string): void {
  const a = new Set(existing)
  const b = new Set(incoming)
  if (a.size !== b.size || [...a].some((id) => !b.has(id))) {
    throw errors.badRequest(
      'order_mismatch',
      `The new order must include every one of the ${what} exactly once`,
    )
  }
}
