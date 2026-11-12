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
  validateDag,
  withSuffix,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import { isPayable } from '../lib/payout'
import type { ProfileActor } from '../middleware/auth'
import { recordAudit, trackEvent } from './audit.service'
import { ChangeSetsService } from './change-sets.service'
import { MediaService } from './media.service'

const EDITABLE_STATUSES = new Set(['draft', 'rejected', 'live'])

/** Any one of these lets an actor change course content; which one applies depends on the course. */
const CONTENT_CAPABILITIES: Capability[] = [
  'course.editDraft',
  'course.editLive',
  'course.proposeLiveEdit',
]

type CourseRow = typeof s.courses.$inferSelect
type LessonRow = typeof s.lessons.$inferSelect
type ArtefactRow = typeof s.artefacts.$inferSelect

/**
 * Which rows an edit reaches: the live rows (`null`), or the draft rows of a change set. Every
 * read and write inside an edit is limited to one of the two, so a draft and its live row are
 * never mixed.
 */
type Scope = string | null

const inScope = (column: typeof s.lessons.changeSetId, scope: Scope) =>
  scope === null ? isNull(column) : eq(column, scope)

/**
 * The course builder: reads and edits of course content for Teach, and the read Support uses to
 * preview a course.
 *
 * This file and `change-sets.service.ts` are the only two that touch the `lessons`, `artefacts`,
 * `quizzes` and `lesson_prerequisites` tables directly. Those tables hold a writer's draft rows
 * beside the live ones, so everything learner-facing reads the live views through `learnerDb`
 * instead (`schema-guard.test.ts` enforces this).
 */
export class CoursesService {
  private readonly media: MediaService
  private readonly changeSets: ChangeSetsService
  constructor(private readonly deps: Deps) {
    this.media = new MediaService(deps)
    this.changeSets = new ChangeSetsService(deps)
  }

  // ── loading ──────────────────────────────────────────────────────────────

  /**
   * The full builder view of a course.
   *
   * - `profileId`: the course must belong to that profile; another profile's course is reported
   *   as not found.
   * - `draft`: show the open change set's rows in place of the live ones. With no open change
   *   set there is nothing else to show, and the live rows are returned.
   *
   * This is the one place where a filter in code, not a view, keeps drafts out of a read: a draft
   * artefact always sits under a draft lesson, so choosing the lessons chooses the whole tree.
   */
  async loadCourseView(
    courseId: string,
    options: { profileId?: string; draft?: boolean } = {},
  ): Promise<CourseView> {
    const { db } = this.deps
    const course = await db.query.courses.findFirst({
      where: { id: courseId, ...(options.profileId ? { profileId: options.profileId } : {}) },
      with: {
        thumbnail: true,
        profile: { with: { owner: true, payoutAccount: true } },
        changeSets: { where: { status: 'open' }, with: { opener: true } },
      },
    })
    if (!course) throw errors.notFound('Course')
    const open = course.changeSets[0] ?? null
    const scope: Scope = options.draft && open ? open.id : null
    const lessonRows = await db.query.lessons.findMany({
      where: {
        courseId,
        removed: false,
        ...(scope ? { changeSetId: scope } : { changeSetId: { isNull: true } }),
      },
      orderBy: { position: 'asc', createdAt: 'asc' },
      with: {
        prerequisites: true,
        artefacts: {
          where: { removed: false },
          orderBy: { position: 'asc', createdAt: 'asc' },
          with: { media: true, quiz: true },
        },
      },
    })

    const lessons: LessonView[] = []
    for (const lesson of lessonRows) {
      const artefacts: ArtefactView[] = []
      for (const a of lesson.artefacts) {
        artefacts.push({
          id: a.id,
          sourceId: a.sourceId,
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
        sourceId: lesson.sourceId,
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
      viewing: scope ? 'draft' : 'live',
      changeSet: open
        ? {
            id: open.id,
            openedBy: open.opener ? open.opener.name?.trim() || open.opener.email : null,
            openedAt: open.openedAt.toISOString(),
          }
        : null,
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

  /** Support's read of a course: any profile's, with no actor. Always the live rows. */
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
        lessons: {
          where: { changeSetId: { isNull: true } },
          with: { artefacts: { columns: { id: true } } },
          columns: { id: true },
        },
        changeSets: { where: { status: 'open' }, columns: { id: true } },
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
        pendingChanges: c.changeSets.length > 0,
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
  //
  // A content edit (lessons, artefacts, quizzes, prerequisites) first works out its scope: the
  // live rows, or the draft rows of the course's change set. Owners, managers and staff edit a
  // live course's live rows. A writer cannot, so their edit goes to the draft rows, and the first
  // one opens the change set. Course details and price are not part of a change set.

  async listForProfile(actor: ProfileActor): Promise<CourseSummary[]> {
    return this.listSummaries({ profileId: actor.profileId })
  }

  /** `draft` asks for the open change set's rows; see `loadCourseView`. */
  async view(
    actor: ProfileActor,
    courseId: string,
    options: { draft?: boolean } = {},
  ): Promise<CourseView> {
    return this.loadCourseView(courseId, { profileId: actor.profileId, draft: options.draft })
  }

  /** Refuses early when the actor cannot change course content on any course. */
  private assertCanEditContent(actor: ProfileActor): void {
    if (!CONTENT_CAPABILITIES.some((capability) => can(actor, capability))) throw errors.forbidden()
  }

  /** A course under review is locked for everyone. */
  private assertUnlocked(course: CourseRow): void {
    if (!EDITABLE_STATUSES.has(course.status)) {
      throw errors.conflict(
        'course_locked',
        'This course is under review and cannot be edited until the review is complete',
      )
    }
  }

  /**
   * The rows this actor's content edit reaches on this course. An actor who may not edit a live
   * course directly, but may propose edits to it, gets the course's change set, opened here if
   * the course has none.
   */
  private async editScope(actor: ProfileActor, course: CourseRow): Promise<Scope> {
    this.assertUnlocked(course)
    if (course.status !== 'live') {
      if (!can(actor, 'course.editDraft')) throw errors.forbidden()
      return null
    }
    if (can(actor, 'course.editLive')) return null
    if (!can(actor, 'course.proposeLiveEdit')) throw errors.forbidden()
    return (await this.changeSets.openFor(course, actor.userId)).id
  }

  private async profileCourse(actor: ProfileActor, courseId: string): Promise<CourseRow> {
    const course = await this.deps.db.query.courses.findFirst({
      where: { id: courseId, profileId: actor.profileId },
    })
    if (!course) throw errors.notFound('Course')
    return course
  }

  private async courseForEdit(
    actor: ProfileActor,
    courseId: string,
  ): Promise<{ course: CourseRow; scope: Scope }> {
    this.assertCanEditContent(actor)
    const course = await this.profileCourse(actor, courseId)
    return { course, scope: await this.editScope(actor, course) }
  }

  /**
   * The lesson an edit applies to. With a draft scope the caller may name the live lesson or its
   * draft copy, and gets the copy either way. With the live scope a draft's ID finds nothing.
   */
  private async lessonForEdit(
    actor: ProfileActor,
    lessonId: string,
  ): Promise<{ lesson: LessonRow; course: CourseRow; scope: Scope }> {
    this.assertCanEditContent(actor)
    const { db } = this.deps
    const found = await db.query.lessons.findFirst({
      where: { id: lessonId, course: { profileId: actor.profileId } },
      with: { course: true },
    })
    if (!found) throw errors.notFound('Lesson')
    const { course, ...row } = found
    const scope = await this.editScope(actor, course)
    let lesson: LessonRow | undefined
    if (row.changeSetId === scope) lesson = row
    else if (scope !== null && row.changeSetId === null) {
      lesson = await db.query.lessons.findFirst({ where: { changeSetId: scope, sourceId: row.id } })
    }
    if (!lesson || lesson.removed) throw errors.notFound('Lesson')
    return { lesson, course, scope }
  }

  /** As `lessonForEdit`, for an artefact. An artefact under a removed lesson is gone too. */
  private async artefactForEdit(
    actor: ProfileActor,
    artefactId: string,
  ): Promise<{ artefact: ArtefactRow; course: CourseRow; scope: Scope }> {
    this.assertCanEditContent(actor)
    const { db } = this.deps
    const found = await db.query.artefacts.findFirst({
      where: { id: artefactId, lesson: { course: { profileId: actor.profileId } } },
      with: { lesson: { with: { course: true } } },
    })
    if (!found) throw errors.notFound('Artefact')
    const { lesson: parent, ...row } = found
    const scope = await this.editScope(actor, parent.course)
    let artefact: ArtefactRow | undefined
    if (row.changeSetId === scope) artefact = row
    else if (scope !== null && row.changeSetId === null) {
      artefact = await db.query.artefacts.findFirst({
        where: { changeSetId: scope, sourceId: row.id },
      })
    }
    if (!artefact || artefact.removed) throw errors.notFound('Artefact')
    if (artefact.lessonId !== parent.id) {
      const lesson = await db.query.lessons.findFirst({
        where: { id: artefact.lessonId },
        columns: { removed: true },
      })
      if (!lesson || lesson.removed) throw errors.notFound('Artefact')
    } else if (parent.removed) throw errors.notFound('Artefact')
    return { artefact, course: parent.course, scope }
  }

  /** The course after an edit, showing the rows the edit was made to. */
  private edited(courseId: string, scope: Scope): Promise<CourseView> {
    return this.loadCourseView(courseId, { draft: scope !== null })
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

  /**
   * Course details: title, summary, description, category and thumbnail. Price is not among them
   * (see `setPrice`), and they are not part of a change set: on a live course they need
   * `course.editLive`, which a writer does not have.
   */
  async update(actor: ProfileActor, courseId: string, patch: UpdateCourse): Promise<CourseView> {
    this.assertCanEditContent(actor)
    const course = await this.profileCourse(actor, courseId)
    this.assertUnlocked(course)
    if (!can(actor, course.status === 'live' ? 'course.editLive' : 'course.editDraft')) {
      throw errors.forbidden()
    }
    const values: Partial<typeof s.courses.$inferInsert> = {}
    if (patch.title !== undefined) values.title = patch.title
    if (patch.summary !== undefined) values.summary = patch.summary
    if (patch.descriptionJson !== undefined) values.descriptionJson = patch.descriptionJson
    if (patch.category !== undefined) values.category = patch.category
    if (patch.thumbnailMediaId !== undefined) {
      if (patch.thumbnailMediaId) {
        await this.media.getProfileAsset(actor.profileId, patch.thumbnailMediaId, {
          ready: true,
          kind: 'image',
        })
      }
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
    this.assertUnlocked(course)
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
    const { course, scope } = await this.courseForEdit(actor, courseId)
    const { db } = this.deps
    const [{ max }] = (await db
      .select({ max: sql<number>`coalesce(max(${s.lessons.position}), -1)::int` })
      .from(s.lessons)
      .where(
        and(
          eq(s.lessons.courseId, course.id),
          inScope(s.lessons.changeSetId, scope),
          eq(s.lessons.removed, false),
        ),
      )) as [{ max: number }]
    await db.insert(s.lessons).values({
      courseId: course.id,
      title: input.title,
      summary: input.summary ?? null,
      position: max + 1,
      changeSetId: scope,
    })
    return this.edited(course.id, scope)
  }

  async updateLesson(
    actor: ProfileActor,
    lessonId: string,
    patch: { title?: string; summary?: string | null },
  ): Promise<CourseView> {
    const { lesson, course, scope } = await this.lessonForEdit(actor, lessonId)
    await this.deps.db.update(s.lessons).set(patch).where(eq(s.lessons.id, lesson.id))
    return this.edited(course.id, scope)
  }

  async removeLesson(actor: ProfileActor, lessonId: string): Promise<CourseView> {
    const { lesson, course, scope } = await this.lessonForEdit(actor, lessonId)
    if (scope !== null && lesson.copiedFromLive) {
      // The copy stays as a marker, so approval knows to delete the live lesson. Its links go
      // now, in both directions, as they would with the lesson itself.
      await this.deps.db.transaction(async (tx) => {
        await tx.update(s.lessons).set({ removed: true }).where(eq(s.lessons.id, lesson.id))
        await tx
          .delete(s.lessonPrerequisites)
          .where(
            or(
              eq(s.lessonPrerequisites.lessonId, lesson.id),
              eq(s.lessonPrerequisites.prerequisiteLessonId, lesson.id),
            ),
          )
      })
    } else {
      // A live lesson, or a draft the writer added: nothing else refers to it.
      await this.deps.db.delete(s.lessons).where(eq(s.lessons.id, lesson.id))
    }
    return this.edited(course.id, scope)
  }

  async reorderLessons(actor: ProfileActor, courseId: string, ids: string[]): Promise<CourseView> {
    const { course, scope } = await this.courseForEdit(actor, courseId)
    const { db } = this.deps
    const existing = await db
      .select({ id: s.lessons.id, sourceId: s.lessons.sourceId })
      .from(s.lessons)
      .where(
        and(
          eq(s.lessons.courseId, course.id),
          inScope(s.lessons.changeSetId, scope),
          eq(s.lessons.removed, false),
        ),
      )
    const order = toScope(existing, ids)
    assertSameSet(
      existing.map((l) => l.id),
      order,
      'lessons',
    )
    for (const [index, id] of order.entries()) {
      await db.update(s.lessons).set({ position: index }).where(eq(s.lessons.id, id))
    }
    return this.edited(course.id, scope)
  }

  async setPrerequisites(
    actor: ProfileActor,
    lessonId: string,
    prerequisiteIds: string[],
  ): Promise<CourseView> {
    const { lesson, course, scope } = await this.lessonForEdit(actor, lessonId)
    const { db } = this.deps
    const courseLessons = await db.query.lessons.findMany({
      where: {
        courseId: course.id,
        removed: false,
        ...(scope ? { changeSetId: scope } : { changeSetId: { isNull: true } }),
      },
      with: { prerequisites: true },
    })
    const wanted = [...new Set(toScope(courseLessons, prerequisiteIds))]
    const edges = courseLessons
      .filter((l) => l.id !== lesson.id)
      .flatMap((l) =>
        l.prerequisites.map((p) => ({ lessonId: l.id, prerequisiteId: p.prerequisiteLessonId })),
      )
      .concat(wanted.map((prerequisiteId) => ({ lessonId: lesson.id, prerequisiteId })))
    const result = validateDag(
      courseLessons.map((l) => l.id),
      edges,
    )
    if (!result.ok) throw errors.unprocessable('prerequisite_cycle', result.message, result)
    await db.transaction(async (tx) => {
      await tx.delete(s.lessonPrerequisites).where(eq(s.lessonPrerequisites.lessonId, lesson.id))
      if (wanted.length) {
        await tx.insert(s.lessonPrerequisites).values(
          wanted.map((prerequisiteLessonId) => ({
            lessonId: lesson.id,
            prerequisiteLessonId,
            changeSetId: scope,
          })),
        )
      }
    })
    return this.edited(course.id, scope)
  }

  // artefacts

  async addArtefact(
    actor: ProfileActor,
    lessonId: string,
    input: { type: ArtefactView['type']; title: string },
  ): Promise<CourseView> {
    const { lesson, course, scope } = await this.lessonForEdit(actor, lessonId)
    const { db } = this.deps
    const [{ max }] = (await db
      .select({ max: sql<number>`coalesce(max(${s.artefacts.position}), -1)::int` })
      .from(s.artefacts)
      .where(and(eq(s.artefacts.lessonId, lesson.id), eq(s.artefacts.removed, false)))) as [
      { max: number },
    ]
    const [artefact] = await db
      .insert(s.artefacts)
      .values({
        lessonId: lesson.id,
        type: input.type,
        title: input.title,
        position: max + 1,
        changeSetId: scope,
      })
      .returning()
    if (!artefact) throw new Error('failed to create artefact')
    if (input.type === 'quiz') {
      await db.insert(s.quizzes).values({
        artefactId: artefact.id,
        passMarkPercent: 70,
        maxAttempts: 1,
        questionsJson: [],
        changeSetId: scope,
      })
    }
    return this.edited(course.id, scope)
  }

  async updateArtefact(
    actor: ProfileActor,
    artefactId: string,
    patch: {
      title?: string
      mediaAssetId?: string | null
      contentJson?: ArtefactView['contentJson']
      durationSeconds?: number | null
    },
  ): Promise<CourseView> {
    const { artefact, course, scope } = await this.artefactForEdit(actor, artefactId)
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
        const asset = await this.media.getProfileAsset(actor.profileId, patch.mediaAssetId)
        if (asset.kind !== artefact.type)
          throw errors.badRequest('wrong_kind', `Expected a ${artefact.type} file`)
        if (asset.durationSeconds && patch.durationSeconds === undefined)
          values.durationSeconds = asset.durationSeconds
      }
      values.mediaAssetId = patch.mediaAssetId
    }
    if (Object.keys(values).length)
      await this.deps.db.update(s.artefacts).set(values).where(eq(s.artefacts.id, artefact.id))
    return this.edited(course.id, scope)
  }

  async removeArtefact(actor: ProfileActor, artefactId: string): Promise<CourseView> {
    const { artefact, course, scope } = await this.artefactForEdit(actor, artefactId)
    const { db } = this.deps
    if (scope !== null && artefact.copiedFromLive) {
      // As with a lesson: the copy stays as a marker for approval.
      await db.update(s.artefacts).set({ removed: true }).where(eq(s.artefacts.id, artefact.id))
    } else {
      await db.delete(s.artefacts).where(eq(s.artefacts.id, artefact.id))
    }
    return this.edited(course.id, scope)
  }

  async reorderArtefacts(
    actor: ProfileActor,
    lessonId: string,
    ids: string[],
  ): Promise<CourseView> {
    const { lesson, course, scope } = await this.lessonForEdit(actor, lessonId)
    const { db } = this.deps
    const existing = await db
      .select({ id: s.artefacts.id, sourceId: s.artefacts.sourceId })
      .from(s.artefacts)
      .where(and(eq(s.artefacts.lessonId, lesson.id), eq(s.artefacts.removed, false)))
    const order = toScope(existing, ids)
    assertSameSet(
      existing.map((a) => a.id),
      order,
      'artefacts',
    )
    for (const [index, id] of order.entries()) {
      await db.update(s.artefacts).set({ position: index }).where(eq(s.artefacts.id, id))
    }
    return this.edited(course.id, scope)
  }

  async upsertQuiz(
    actor: ProfileActor,
    artefactId: string,
    definition: QuizDefinition,
  ): Promise<CourseView> {
    const { artefact, course, scope } = await this.artefactForEdit(actor, artefactId)
    if (artefact.type !== 'quiz')
      throw errors.badRequest('wrong_type', 'Only quiz artefacts have questions')
    const values = {
      passMarkPercent: definition.passMarkPercent,
      maxAttempts: definition.maxAttempts,
      timeLimitMinutes: definition.timeLimitMinutes,
      questionsJson: definition.questions,
    }
    // A draft artefact has its own quiz row, so this never touches the live quiz.
    await this.deps.db
      .insert(s.quizzes)
      .values({ artefactId: artefact.id, changeSetId: scope, ...values })
      .onConflictDoUpdate({ target: s.quizzes.artefactId, set: values })
    await this.deps.db
      .update(s.artefacts)
      .set({ durationSeconds: Math.max(60, definition.questions.length * 45) })
      .where(eq(s.artefacts.id, artefact.id))
    return this.edited(course.id, scope)
  }
}

/**
 * A writer's request may still name live rows, from before their change set was opened. Each
 * live ID stands for its draft copy. On live rows `sourceId` is empty and nothing is changed.
 */
function toScope(rows: Array<{ id: string; sourceId: string | null }>, ids: string[]): string[] {
  const copyOf = new Map(
    rows.flatMap((row) => (row.sourceId ? [[row.sourceId, row.id] as const] : [])),
  )
  return ids.map((id) => copyOf.get(id) ?? id)
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
