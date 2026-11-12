import { randomUUID } from 'node:crypto'
import {
  type ChangeSetChoice,
  type ChangeSetConflict,
  type ChangeSetConflictDetails,
  type ChangeSetItem,
  type ChangeSetView,
  validateDag,
} from '@elevate/core'
import { type AnyDb, schema as s } from '@elevate/db'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors, HttpError } from '../lib/errors'
import type { ProfileActor } from '../middleware/auth'
import { recordAudit } from './audit.service'
import { ownerAndManagerEmails } from './recipients'

/**
 * A writer's edits to a live course.
 *
 * A writer cannot change what learners see. Their first edit to a live course opens a change set:
 * the course's lessons, artefacts, quizzes and prerequisite links are copied into draft rows, and
 * the writer edits the copies. Learners keep reading the live rows. An owner or manager then
 * approves the change set, which applies the drafts to the live rows, or discards it.
 *
 * Words used below:
 * - a *copied* draft was copied from a live row (`copiedFromLive`); `sourceId` is that live row,
 *   or null once that live row has been deleted;
 * - a *new* draft was added by the writer, and keeps its own ID when it goes live;
 * - a draft is *removed* when the writer removed it, or removed the lesson or artefact above it.
 */

type Tx = Parameters<Parameters<AnyDb['transaction']>[0]>[0]
type Executor = AnyDb | Tx

type ChangeSetRow = typeof s.courseChangeSets.$inferSelect
type LessonRow = typeof s.lessons.$inferSelect
type ArtefactRow = typeof s.artefacts.$inferSelect
type QuizRow = typeof s.quizzes.$inferSelect
type LinkRow = typeof s.lessonPrerequisites.$inferSelect
type DraftFields = Pick<LessonRow, 'id' | 'sourceId' | 'removed' | 'copiedFromLive'>

/** A course's live rows and the draft rows of one change set. */
type CourseContent = {
  live: {
    lessons: Map<string, LessonRow>
    artefacts: Map<string, ArtefactRow>
    quizzes: Map<string, QuizRow>
    links: LinkRow[]
  }
  draft: { lessons: LessonRow[]; artefacts: ArtefactRow[]; quizzes: QuizRow[]; links: LinkRow[] }
}

/** A copied draft whose live row has been deleted since the change set was opened. */
const isGone = (row: DraftFields) => row.copiedFromLive && row.sourceId === null

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// What approval copies from a draft to its live row. Two rows that agree on these are the same
// as far as a learner can tell, so there is nothing to apply and nothing to clash.
const sameLesson = (a: LessonRow, b: LessonRow) =>
  a.title === b.title && a.summary === b.summary && a.position === b.position

const sameArtefact = (a: ArtefactRow, b: ArtefactRow) =>
  a.type === b.type &&
  a.title === b.title &&
  a.position === b.position &&
  a.mediaAssetId === b.mediaAssetId &&
  a.durationSeconds === b.durationSeconds &&
  sameJson(a.contentJson, b.contentJson)

const sameQuiz = (a: QuizRow, b: QuizRow) =>
  a.passMarkPercent === b.passMarkPercent &&
  a.maxAttempts === b.maxAttempts &&
  a.timeLimitMinutes === b.timeLimitMinutes &&
  sameJson(a.questionsJson, b.questionsJson)

function groupBy<T>(rows: Iterable<T>, key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const group = groups.get(k)
    if (group) group.push(row)
    else groups.set(k, [row])
  }
  return groups
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

const conflictKey = (c: Pick<ChangeSetChoice, 'kind' | 'id' | 'seen'>) =>
  `${c.kind}:${c.id}:${c.seen}`

/**
 * Compares a change set's drafts with the live course as it is now: what the change set would
 * change, and where it clashes with an edit made to the live course since it was opened.
 */
function analyse(changeSet: ChangeSetRow, content: CourseContent) {
  const { live, draft } = content
  const snapshot = changeSet.openedAtSnapshot.getTime()
  const changedSince = (row: { updatedAt: Date }) => row.updatedAt.getTime() > snapshot

  const draftLesson = new Map(draft.lessons.map((l) => [l.id, l]))
  const draftArtefact = new Map(draft.artefacts.map((a) => [a.id, a]))
  const draftArtefactsOf = groupBy(draft.artefacts, (a) => a.lessonId)
  const draftQuizOf = new Map(draft.quizzes.map((q) => [q.artefactId, q]))
  const draftLinksOf = groupBy(draft.links, (l) => l.lessonId)
  const liveArtefactsOf = groupBy(live.artefacts.values(), (a) => a.lessonId)
  const liveQuizOf = new Map([...live.quizzes.values()].map((q) => [q.artefactId, q]))
  const liveLinksOf = groupBy(live.links, (l) => l.lessonId)
  const openedLinksOf = groupBy(changeSet.openedPrerequisites, (l) => l.lessonId)

  /** Removed by the writer, directly or with the lesson above it. */
  const artefactRemoved = (a: ArtefactRow) =>
    a.removed || (draftLesson.get(a.lessonId)?.removed ?? true)
  const quizRemoved = (q: QuizRow) => {
    const artefact = draftArtefact.get(q.artefactId)
    return q.removed || !artefact || artefactRemoved(artefact)
  }

  /** The live ID a draft lesson stands for: its source, or its own ID if it is new. */
  const targetOf = (l: LessonRow) => (l.copiedFromLive && l.sourceId ? l.sourceId : l.id)
  const draftPrerequisites = (lessonId: string) =>
    (draftLinksOf.get(lessonId) ?? []).map((link) => {
      const prerequisite = draftLesson.get(link.prerequisiteLessonId)
      return prerequisite ? targetOf(prerequisite) : link.prerequisiteLessonId
    })
  const livePrerequisites = (lessonId: string) =>
    (liveLinksOf.get(lessonId) ?? []).map((link) => link.prerequisiteLessonId)

  // ── conflicts ──
  const found: Omit<ChangeSetConflict, 'resolution'>[] = []
  const conflict = (
    kind: ChangeSetConflict['kind'],
    item: ChangeSetConflict['item'],
    row: { id: string; sourceId: string | null; draftId?: string },
    title: string,
    seen: string,
    droppedChildren = 0,
  ) =>
    found.push({
      kind,
      item,
      id: kind === 'prerequisites' ? (row.sourceId as string) : row.id,
      liveId: row.sourceId,
      draftId: row.draftId ?? row.id,
      droppedChildren,
      title,
      seen,
    })
  const newest = (rows: Array<{ updatedAt: Date }>) =>
    Math.max(...rows.map((row) => row.updatedAt.getTime()))

  for (const lesson of draft.lessons) {
    if (!lesson.copiedFromLive) continue
    if (lesson.sourceId === null) {
      // The writer removed it and the live row is gone too: both agree, nothing to decide.
      if (lesson.removed) continue
      const added = (draftArtefactsOf.get(lesson.id) ?? []).filter(
        (a) => !a.copiedFromLive && !a.removed,
      )
      conflict('deleted', 'lesson', lesson, lesson.title, 'deleted', added.length)
      continue
    }
    const current = live.lessons.get(lesson.sourceId)
    if (!current) continue
    if (lesson.removed) {
      // Removing a lesson removes everything under it, so an edit anywhere under it clashes.
      const artefacts = liveArtefactsOf.get(current.id) ?? []
      const quizzes = artefacts.flatMap((a) => liveQuizOf.get(a.id) ?? [])
      const latest = newest([current, ...artefacts, ...quizzes])
      if (latest > snapshot) {
        conflict('edited', 'lesson', lesson, lesson.title, new Date(latest).toISOString())
      }
    } else if (changedSince(current) && !sameLesson(lesson, current)) {
      conflict('edited', 'lesson', lesson, lesson.title, current.updatedAt.toISOString())
    }
  }

  for (const artefact of draft.artefacts) {
    if (!artefact.copiedFromLive) continue
    const lesson = draftLesson.get(artefact.lessonId)
    // Under a lesson that was removed or deleted, the lesson's own decision covers it.
    if (!lesson || lesson.removed || isGone(lesson)) continue
    if (artefact.sourceId === null) {
      if (!artefact.removed) conflict('deleted', 'artefact', artefact, artefact.title, 'deleted')
      continue
    }
    const current = live.artefacts.get(artefact.sourceId)
    if (!current) continue
    if (artefact.removed) {
      const quiz = liveQuizOf.get(current.id)
      const latest = newest(quiz ? [current, quiz] : [current])
      if (latest > snapshot) {
        conflict('edited', 'artefact', artefact, artefact.title, new Date(latest).toISOString())
      }
    } else if (changedSince(current) && !sameArtefact(artefact, current)) {
      conflict('edited', 'artefact', artefact, artefact.title, current.updatedAt.toISOString())
    }
  }

  for (const quiz of draft.quizzes) {
    if (!quiz.copiedFromLive) continue
    const artefact = draftArtefact.get(quiz.artefactId)
    if (!artefact || artefactRemoved(artefact) || isGone(artefact)) continue
    const lesson = draftLesson.get(artefact.lessonId)
    if (!lesson || isGone(lesson)) continue
    // A quiz is shown by its artefact, so the conflict names the artefact's two IDs; its own
    // `id` stays the draft quiz row, which is what a choice refers to.
    const shown = { id: quiz.id, sourceId: artefact.sourceId, draftId: artefact.id }
    if (quiz.sourceId === null) {
      if (!quiz.removed) conflict('deleted', 'quiz', shown, artefact.title, 'deleted')
      continue
    }
    const current = live.quizzes.get(quiz.sourceId)
    if (!current || !changedSince(current)) continue
    if (quiz.removed || !sameQuiz(quiz, current)) {
      conflict('edited', 'quiz', shown, artefact.title, current.updatedAt.toISOString())
    }
  }

  for (const lesson of draft.lessons) {
    if (lesson.removed || !lesson.copiedFromLive || lesson.sourceId === null) continue
    const now = livePrerequisites(lesson.sourceId)
    // A prerequisite that was deleted since is that lesson's own conflict, not this one's.
    const opened = (openedLinksOf.get(lesson.sourceId) ?? [])
      .map((link) => link.prerequisiteId)
      .filter((id) => live.lessons.has(id))
    if (sameSet(now, opened)) continue
    if (sameSet(draftPrerequisites(lesson.id), now)) continue
    conflict('prerequisites', null, lesson, lesson.title, [...now].sort().join(',') || 'none')
  }

  const resolutions = new Map(changeSet.resolutions.map((r) => [conflictKey(r), r.keep]))
  const conflicts: ChangeSetConflict[] = found.map((c) => ({
    ...c,
    resolution: resolutions.get(conflictKey(c)) ?? null,
  }))

  // ── what would change ──
  const items: ChangeSetItem[] = []
  const item = (
    kind: ChangeSetItem['kind'],
    row: { id: string; sourceId: string | null },
    change: ChangeSetItem['change'],
    title: string,
  ) => items.push({ kind, liveId: row.sourceId, draftId: row.id, change, title })

  for (const lesson of draft.lessons) {
    if (isGone(lesson)) continue
    if (!lesson.copiedFromLive) {
      item('lesson', lesson, 'added', lesson.title)
    } else if (lesson.removed) {
      item('lesson', lesson, 'removed', lesson.title)
    } else {
      const current = live.lessons.get(lesson.sourceId as string)
      if (current && !sameLesson(lesson, current)) item('lesson', lesson, 'edited', lesson.title)
    }
    if (lesson.removed) continue
    const before = lesson.copiedFromLive ? livePrerequisites(lesson.sourceId as string) : []
    if (!sameSet(draftPrerequisites(lesson.id), before)) {
      item('prerequisites', lesson, lesson.copiedFromLive ? 'edited' : 'added', lesson.title)
    }
  }
  for (const artefact of draft.artefacts) {
    const lesson = draftLesson.get(artefact.lessonId)
    // A removed lesson is listed once, not once more for each thing under it.
    if (!lesson || lesson.removed || isGone(artefact)) continue
    if (!artefact.copiedFromLive) {
      item('artefact', artefact, 'added', artefact.title)
    } else if (artefact.removed) {
      item('artefact', artefact, 'removed', artefact.title)
    } else {
      const current = live.artefacts.get(artefact.sourceId as string)
      if (current && !sameArtefact(artefact, current)) {
        item('artefact', artefact, 'edited', artefact.title)
      }
    }
  }
  for (const quiz of draft.quizzes) {
    const artefact = draftArtefact.get(quiz.artefactId)
    if (!artefact || quizRemoved(quiz) || isGone(quiz)) continue
    // Listed under the artefact's IDs: a screen finds a quiz through its artefact.
    if (!quiz.copiedFromLive) {
      // A new quiz artefact always comes with its quiz; the artefact is already listed.
      if (artefact.copiedFromLive) item('quiz', artefact, 'added', artefact.title)
    } else {
      const current = live.quizzes.get(quiz.sourceId as string)
      if (current && !sameQuiz(quiz, current)) item('quiz', artefact, 'edited', artefact.title)
    }
  }

  return {
    conflicts,
    items,
    draftLesson,
    draftArtefact,
    draftArtefactsOf,
    draftQuizOf,
    draftLinksOf,
    artefactRemoved,
  }
}

export class ChangeSetsService {
  constructor(private readonly deps: Deps) {}

  /** The course's open change set, if it has one. */
  async findOpen(courseId: string, db: Executor = this.deps.db): Promise<ChangeSetRow | null> {
    const [open] = await db
      .select()
      .from(s.courseChangeSets)
      .where(and(eq(s.courseChangeSets.courseId, courseId), eq(s.courseChangeSets.status, 'open')))
    return open ?? null
  }

  /** The course's lessons, artefacts, quizzes and links: live rows and this change set's drafts. */
  private async loadContent(
    db: Executor,
    courseId: string,
    changeSetId: string,
    options: { lock?: boolean } = {},
  ): Promise<CourseContent> {
    // With `lock`, an edit to the live course made at the same moment waits until the caller's
    // transaction ends, so it is either seen here or applied afterwards, never overwritten unseen.
    const lessonRows = db.select().from(s.lessons).where(eq(s.lessons.courseId, courseId))
    const lessons = await (options.lock ? lessonRows.for('update') : lessonRows)
    const lessonIds = lessons.map((l) => l.id)
    const artefactRows = db
      .select()
      .from(s.artefacts)
      .where(inArray(s.artefacts.lessonId, lessonIds))
    const artefacts =
      lessonIds.length === 0 ? [] : await (options.lock ? artefactRows.for('update') : artefactRows)
    const artefactIds = artefacts.map((a) => a.id)
    const quizRows = db.select().from(s.quizzes).where(inArray(s.quizzes.artefactId, artefactIds))
    const quizzes =
      artefactIds.length === 0 ? [] : await (options.lock ? quizRows.for('update') : quizRows)
    const linkRows = db
      .select()
      .from(s.lessonPrerequisites)
      .where(inArray(s.lessonPrerequisites.lessonId, lessonIds))
    const links =
      lessonIds.length === 0 ? [] : await (options.lock ? linkRows.for('update') : linkRows)

    const isLive = (row: { changeSetId: string | null }) => row.changeSetId === null
    const isDraft = (row: { changeSetId: string | null }) => row.changeSetId === changeSetId
    const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]))
    return {
      live: {
        lessons: byId(lessons.filter(isLive)),
        artefacts: byId(artefacts.filter(isLive)),
        quizzes: byId(quizzes.filter(isLive)),
        links: links.filter(isLive),
      },
      draft: {
        lessons: lessons.filter(isDraft),
        artefacts: artefacts.filter(isDraft),
        quizzes: quizzes.filter(isDraft),
        links: links.filter(isDraft),
      },
    }
  }

  /**
   * The course's open change set, opening one if there is none: every live lesson, artefact, quiz
   * and prerequisite link is copied into a draft row that remembers which live row it came from.
   */
  async openFor(
    course: Pick<typeof s.courses.$inferSelect, 'id' | 'title' | 'profileId'>,
    userId: string,
  ): Promise<ChangeSetRow> {
    const { db, env, mailer } = this.deps
    const existing = await this.findOpen(course.id)
    if (existing) return existing

    const opened = await db.transaction(async (tx) => {
      // Two first edits at once: the second waits here, then finds the change set the first made.
      await tx
        .select({ id: s.courses.id })
        .from(s.courses)
        .where(eq(s.courses.id, course.id))
        .for('update')
      const already = await this.findOpen(course.id, tx)
      if (already) return { changeSet: already, created: false }

      const lessons = await tx
        .select()
        .from(s.lessons)
        .where(and(eq(s.lessons.courseId, course.id), isNull(s.lessons.changeSetId)))
      const lessonIds = lessons.map((l) => l.id)
      const artefacts = lessonIds.length
        ? await tx
            .select()
            .from(s.artefacts)
            .where(and(inArray(s.artefacts.lessonId, lessonIds), isNull(s.artefacts.changeSetId)))
        : []
      const artefactIds = artefacts.map((a) => a.id)
      const quizzes = artefactIds.length
        ? await tx
            .select()
            .from(s.quizzes)
            .where(and(inArray(s.quizzes.artefactId, artefactIds), isNull(s.quizzes.changeSetId)))
        : []
      const links = lessonIds.length
        ? await tx
            .select()
            .from(s.lessonPrerequisites)
            .where(
              and(
                inArray(s.lessonPrerequisites.lessonId, lessonIds),
                isNull(s.lessonPrerequisites.changeSetId),
              ),
            )
        : []

      // `updated_at` is written from the real clock, so this is compared with it and not with
      // the app clock that tests control.
      const stamps = [...lessons, ...artefacts, ...quizzes].map((row) => row.updatedAt.getTime())
      const [changeSet] = await tx
        .insert(s.courseChangeSets)
        .values({
          courseId: course.id,
          openedBy: userId,
          openedAt: this.deps.now(),
          openedAtSnapshot: new Date(stamps.length ? Math.max(...stamps) : Date.now()),
          openedPrerequisites: links.map((link) => ({
            lessonId: link.lessonId,
            prerequisiteId: link.prerequisiteLessonId,
          })),
        })
        .returning()
      if (!changeSet) throw new Error('failed to open a change set')

      const draft = { changeSetId: changeSet.id, copiedFromLive: true }
      const lessonCopy = new Map(lessons.map((l) => [l.id, randomUUID()]))
      const artefactCopy = new Map(artefacts.map((a) => [a.id, randomUUID()]))
      if (lessons.length) {
        await tx.insert(s.lessons).values(
          lessons.map((l) => ({
            ...l,
            ...draft,
            id: lessonCopy.get(l.id) as string,
            sourceId: l.id,
          })),
        )
      }
      if (artefacts.length) {
        await tx.insert(s.artefacts).values(
          artefacts.map((a) => ({
            ...a,
            ...draft,
            id: artefactCopy.get(a.id) as string,
            sourceId: a.id,
            lessonId: lessonCopy.get(a.lessonId) as string,
          })),
        )
      }
      if (quizzes.length) {
        await tx.insert(s.quizzes).values(
          quizzes.map((q) => ({
            ...q,
            ...draft,
            id: randomUUID(),
            sourceId: q.id,
            artefactId: artefactCopy.get(q.artefactId) as string,
          })),
        )
      }
      // A link whose other end is not in this course's live lessons has nothing to point at.
      const linkCopies = links.flatMap((link) => {
        const lessonId = lessonCopy.get(link.lessonId)
        const prerequisiteLessonId = lessonCopy.get(link.prerequisiteLessonId)
        return lessonId && prerequisiteLessonId
          ? [{ lessonId, prerequisiteLessonId, changeSetId: changeSet.id }]
          : []
      })
      if (linkCopies.length) await tx.insert(s.lessonPrerequisites).values(linkCopies)
      return { changeSet, created: true }
    })

    if (opened.created) {
      await recordAudit(this.deps, {
        actorId: userId,
        action: 'change_set.open',
        entityType: 'course',
        entityId: course.id,
        profileId: course.profileId,
        metadata: { changeSetId: opened.changeSet.id },
      })
      const writer = await db.query.users.findFirst({ where: { id: userId } })
      const who = writer?.name?.trim() || writer?.email || 'A writer'
      for (const to of await ownerAndManagerEmails(this.deps, course.profileId)) {
        await mailer.send(
          simpleEmail({
            to,
            title: `${who} has changes waiting on "${course.title}"`,
            paragraphs: [
              `${who} started editing "${course.title}", which is live. Learners do not see these edits yet.`,
              'They go live when you approve them. You can also discard them.',
            ],
            cta: {
              href: `${env.TEACH_URL}/p/${course.profileId}/courses/${course.id}/changes`,
              label: 'Review the changes',
            },
          }),
        )
      }
    }
    return opened.changeSet
  }

  private async courseOf(actor: ProfileActor, courseId: string) {
    const course = await this.deps.db.query.courses.findFirst({
      where: { id: courseId, profileId: actor.profileId },
    })
    if (!course) throw errors.notFound('Course')
    return course
  }

  private async view(changeSet: ChangeSetRow, content: CourseContent): Promise<ChangeSetView> {
    const { items, conflicts } = analyse(changeSet, content)
    const opener = changeSet.openedBy
      ? await this.deps.db.query.users.findFirst({ where: { id: changeSet.openedBy } })
      : null
    return {
      id: changeSet.id,
      status: changeSet.status,
      openedBy: opener ? { id: opener.id, name: opener.name, email: opener.email } : null,
      openedAt: changeSet.openedAt.toISOString(),
      items,
      conflicts,
    }
  }

  /** The course's open change set: what it would change and where it clashes. Null if none. */
  async get(actor: ProfileActor, courseId: string): Promise<ChangeSetView | null> {
    await this.courseOf(actor, courseId)
    const changeSet = await this.findOpen(courseId)
    if (!changeSet) return null
    return this.view(changeSet, await this.loadContent(this.deps.db, courseId, changeSet.id))
  }

  /**
   * The course exists but has nothing waiting. Not a 404: on these routes 404 means the course
   * is not on this profile.
   */
  private noneOpen(): HttpError {
    return errors.conflict('no_open_change_set', 'This course has no changes waiting for approval')
  }

  private conflictError(conflicts: ChangeSetConflict[], message: string): HttpError {
    return new HttpError(409, 'change_set_conflict', message, {
      conflicts,
    } satisfies ChangeSetConflictDetails)
  }

  /**
   * Stores the approver's choice for each conflict. Nothing is applied here; `approve` applies
   * them. A choice names the live state it was made against (`seen`), and one made against a
   * state that has changed since is refused, with the conflicts as they are now.
   */
  async resolveConflicts(
    actor: ProfileActor,
    courseId: string,
    choices: ChangeSetChoice[],
  ): Promise<ChangeSetView> {
    const { db } = this.deps
    await this.courseOf(actor, courseId)
    const changeSet = await this.findOpen(courseId)
    if (!changeSet) throw this.noneOpen()
    const content = await this.loadContent(db, courseId, changeSet.id)
    const { conflicts } = analyse(changeSet, content)
    const current = new Set(conflicts.map(conflictKey))
    if (choices.some((choice) => !current.has(conflictKey(choice)))) {
      throw this.conflictError(
        conflicts,
        'The live course changed again. Check each choice against the versions shown now.',
      )
    }
    // Choices for conflicts that no longer exist are dropped; a new choice replaces an old one.
    const chosen = new Set(choices.map((c) => `${c.kind}:${c.id}`))
    const resolutions = [
      ...changeSet.resolutions.filter(
        (r) => current.has(conflictKey(r)) && !chosen.has(`${r.kind}:${r.id}`),
      ),
      ...choices,
    ]
    await db
      .update(s.courseChangeSets)
      .set({ resolutions })
      .where(and(eq(s.courseChangeSets.id, changeSet.id), eq(s.courseChangeSets.status, 'open')))
    return this.view({ ...changeSet, resolutions }, content)
  }

  /**
   * Applies the change set to the live course, all of it or none of it. Live rows keep their IDs,
   * so learner progress and quiz attempts stay attached. A conflict with no choice stops it with
   * `409 change_set_conflict` and changes nothing.
   */
  async approve(actor: ProfileActor, courseId: string): Promise<void> {
    const { db, env, mailer } = this.deps
    const course = await this.courseOf(actor, courseId)

    const changeSet = await db.transaction(async (tx) => {
      // 1. Lock the change set, the course, and (in `loadContent`) every content row.
      const [open] = await tx
        .select()
        .from(s.courseChangeSets)
        .where(
          and(eq(s.courseChangeSets.courseId, courseId), eq(s.courseChangeSets.status, 'open')),
        )
        .for('update')
      if (!open) throw this.noneOpen()
      await tx
        .select({ id: s.courses.id })
        .from(s.courses)
        .where(eq(s.courses.id, courseId))
        .for('update')
      const content = await this.loadContent(tx, courseId, open.id, { lock: true })
      const { live, draft } = content

      // 2. Conflicts: every one needs a choice.
      const a = analyse(open, content)
      if (a.conflicts.some((c) => c.resolution === null)) {
        throw this.conflictError(
          a.conflicts,
          'Some of these changes clash with edits made to the live course. Choose which version to keep for each one.',
        )
      }

      // 3. Apply the choices.
      /** Drafts whose live row stays exactly as it is (`edited`, keep live). */
      const leaveAlone = new Set<string>()
      /** Drafts thrown away with everything under them (`deleted`, keep live). */
      const dropped = new Set<string>()
      /** Drafts of deleted live rows that go live as new rows (`deleted`, keep draft). */
      const adopted = new Set<string>()
      /** Live lessons whose prerequisite links stay (`prerequisites`, keep live). */
      const keepLinks = new Set<string>()

      const under = (c: ChangeSetConflict): DraftFields[] => {
        if (c.item === 'lesson') {
          const artefacts = a.draftArtefactsOf.get(c.id) ?? []
          const quizzes = artefacts.flatMap((x) => a.draftQuizOf.get(x.id) ?? [])
          return [...artefacts, ...quizzes]
        }
        if (c.item === 'artefact') return [a.draftQuizOf.get(c.id)].flatMap((q) => q ?? [])
        return []
      }
      for (const c of a.conflicts) {
        if (c.kind === 'prerequisites') {
          if (c.resolution === 'live') keepLinks.add(c.id)
        } else if (c.kind === 'edited') {
          if (c.resolution === 'live') leaveAlone.add(c.id)
        } else if (c.resolution === 'live') {
          // The owner's deletion stands. Deleting the draft takes its draft children with it.
          dropped.add(c.id)
          for (const row of under(c)) dropped.add(row.id)
          const table =
            c.item === 'lesson' ? s.lessons : c.item === 'artefact' ? s.artefacts : s.quizzes
          await tx.delete(table).where(eq(table.id, c.id))
        } else {
          // The draft goes live as a new row, with the copies under it that lost their live row.
          adopted.add(c.id)
          for (const row of under(c)) if (isGone(row)) adopted.add(row.id)
        }
      }

      // 4. The map from a draft to the live row it becomes: its source, or itself if it is new.
      const isNew = (row: DraftFields) => !row.copiedFromLive || adopted.has(row.id)
      const dead = (row: DraftFields) =>
        dropped.has(row.id) || (isGone(row) && !adopted.has(row.id))
      const liveIdOf = (row: DraftFields) => (isNew(row) ? row.id : (row.sourceId as string))
      const lessonActive = (l: LessonRow) => !dead(l) && !l.removed
      const artefactActive = (x: ArtefactRow) => {
        const lesson = a.draftLesson.get(x.lessonId)
        return !!lesson && lessonActive(lesson) && !dead(x) && !x.removed
      }
      const quizActive = (q: QuizRow) => {
        const artefact = a.draftArtefact.get(q.artefactId)
        return !!artefact && artefactActive(artefact) && !dead(q) && !q.removed
      }

      // 5. Update live rows from their copied drafts, parents first. The drafts are not changed.
      for (const d of draft.lessons) {
        if (!lessonActive(d) || isNew(d) || leaveAlone.has(d.id)) continue
        const current = live.lessons.get(d.sourceId as string)
        if (!current || sameLesson(d, current)) continue
        await tx
          .update(s.lessons)
          .set({ title: d.title, summary: d.summary, position: d.position })
          .where(eq(s.lessons.id, current.id))
      }
      for (const d of draft.artefacts) {
        if (!artefactActive(d) || isNew(d) || leaveAlone.has(d.id)) continue
        const current = live.artefacts.get(d.sourceId as string)
        const lesson = a.draftLesson.get(d.lessonId)
        if (!current || !lesson || sameArtefact(d, current)) continue
        await tx
          .update(s.artefacts)
          .set({
            lessonId: liveIdOf(lesson),
            type: d.type,
            title: d.title,
            position: d.position,
            mediaAssetId: d.mediaAssetId,
            contentJson: d.contentJson,
            durationSeconds: d.durationSeconds,
          })
          .where(eq(s.artefacts.id, current.id))
      }
      for (const d of draft.quizzes) {
        if (!quizActive(d) || isNew(d) || leaveAlone.has(d.id)) continue
        const current = live.quizzes.get(d.sourceId as string)
        if (!current || sameQuiz(d, current)) continue
        await tx
          .update(s.quizzes)
          .set({
            passMarkPercent: d.passMarkPercent,
            maxAttempts: d.maxAttempts,
            timeLimitMinutes: d.timeLimitMinutes,
            questionsJson: d.questionsJson,
          })
          .where(eq(s.quizzes.id, current.id))
      }

      // 6. New drafts become live rows under their own IDs, parents first. Each one is pointed at
      // its live parent before any draft is deleted, so no cascade can take it.
      const goLive = { changeSetId: null, sourceId: null, copiedFromLive: false, removed: false }
      for (const d of draft.lessons) {
        if (!lessonActive(d) || !isNew(d)) continue
        await tx.update(s.lessons).set(goLive).where(eq(s.lessons.id, d.id))
      }
      for (const d of draft.artefacts) {
        if (!artefactActive(d) || !isNew(d)) continue
        const lesson = a.draftLesson.get(d.lessonId) as LessonRow
        await tx
          .update(s.artefacts)
          .set({ ...goLive, lessonId: liveIdOf(lesson) })
          .where(eq(s.artefacts.id, d.id))
      }
      for (const d of draft.quizzes) {
        if (!quizActive(d) || !isNew(d)) continue
        const artefact = a.draftArtefact.get(d.artefactId) as ArtefactRow
        const artefactId = liveIdOf(artefact)
        if (!isNew(artefact)) {
          // An artefact holds one quiz: a live quiz already on it makes way for the new one.
          await tx
            .delete(s.quizzes)
            .where(and(eq(s.quizzes.artefactId, artefactId), isNull(s.quizzes.changeSetId)))
        }
        await tx
          .update(s.quizzes)
          .set({ ...goLive, artefactId })
          .where(eq(s.quizzes.id, d.id))
      }

      // 7. Prerequisites, one lesson at a time, as the editor saves them. The draft links are
      // deleted first: a link between two new lessons has the same key before and after.
      await tx.delete(s.lessonPrerequisites).where(eq(s.lessonPrerequisites.changeSetId, open.id))
      for (const d of draft.lessons) {
        if (!lessonActive(d)) continue
        const lessonId = liveIdOf(d)
        if (!isNew(d)) {
          if (keepLinks.has(lessonId)) continue
          await tx
            .delete(s.lessonPrerequisites)
            .where(
              and(
                eq(s.lessonPrerequisites.lessonId, lessonId),
                isNull(s.lessonPrerequisites.changeSetId),
              ),
            )
        }
        const prerequisites = (a.draftLinksOf.get(d.id) ?? []).flatMap((link) => {
          const prerequisite = a.draftLesson.get(link.prerequisiteLessonId)
          return prerequisite && lessonActive(prerequisite) ? [liveIdOf(prerequisite)] : []
        })
        if (prerequisites.length) {
          await tx
            .insert(s.lessonPrerequisites)
            .values(
              prerequisites.map((prerequisiteLessonId) => ({ lessonId, prerequisiteLessonId })),
            )
        }
      }

      // 8. Delete the live rows the writer removed. Each takes its live children with it, as an
      // owner's delete does.
      for (const d of draft.lessons) {
        if (d.removed && d.copiedFromLive && d.sourceId && !leaveAlone.has(d.id)) {
          await tx.delete(s.lessons).where(eq(s.lessons.id, d.sourceId))
        }
      }
      for (const d of draft.artefacts) {
        const lesson = a.draftLesson.get(d.lessonId)
        if (!lesson || !lessonActive(lesson)) continue
        if (d.removed && d.copiedFromLive && d.sourceId && !leaveAlone.has(d.id)) {
          await tx.delete(s.artefacts).where(eq(s.artefacts.id, d.sourceId))
        }
      }
      for (const d of draft.quizzes) {
        const artefact = a.draftArtefact.get(d.artefactId)
        if (!artefact || !artefactActive(artefact)) continue
        if (d.removed && d.copiedFromLive && d.sourceId && !leaveAlone.has(d.id)) {
          await tx.delete(s.quizzes).where(eq(s.quizzes.id, d.sourceId))
        }
      }

      // 9. Every row still carrying this change set is a draft that has done its work.
      await this.deleteDrafts(tx, open.id)

      // The owner's own edits can combine with the writer's into a loop that neither made alone.
      const lessonsNow = await tx
        .select({ id: s.lessons.id })
        .from(s.lessons)
        .where(and(eq(s.lessons.courseId, courseId), isNull(s.lessons.changeSetId)))
        .orderBy(asc(s.lessons.position), asc(s.lessons.createdAt))
      const idsNow = lessonsNow.map((l) => l.id)
      const linksNow = idsNow.length
        ? await tx
            .select()
            .from(s.lessonPrerequisites)
            .where(
              and(
                inArray(s.lessonPrerequisites.lessonId, idsNow),
                isNull(s.lessonPrerequisites.changeSetId),
              ),
            )
        : []
      const dag = validateDag(
        idsNow,
        linksNow.map((l) => ({ lessonId: l.lessonId, prerequisiteId: l.prerequisiteLessonId })),
      )
      if (!dag.ok) {
        throw errors.unprocessable(
          'prerequisite_cycle',
          'With these changes the lesson prerequisites would loop. Change the prerequisites on the live course or in the change set, then approve again.',
          dag,
        )
      }

      // 10. Done.
      await tx
        .update(s.courseChangeSets)
        .set({ status: 'approved', decidedBy: actor.userId, decidedAt: this.deps.now() })
        .where(eq(s.courseChangeSets.id, open.id))
      return open
    })

    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'change_set.approve',
      entityType: 'course',
      entityId: courseId,
      profileId: actor.profileId,
      metadata: { changeSetId: changeSet.id, openedBy: changeSet.openedBy },
    })
    const writer = changeSet.openedBy
      ? await db.query.users.findFirst({ where: { id: changeSet.openedBy } })
      : null
    if (writer) {
      await mailer.send(
        simpleEmail({
          to: writer.email,
          title: `Your changes to "${course.title}" are live`,
          paragraphs: [`Your edits to "${course.title}" were approved. Learners see them now.`],
          cta: {
            href: `${env.TEACH_URL}/p/${course.profileId}/courses/${course.id}`,
            label: 'Open the course',
          },
        }),
      )
    }
  }

  /** Throws the writer's drafts away. The live course is not touched. */
  async discard(actor: ProfileActor, courseId: string): Promise<void> {
    const { db, env, mailer } = this.deps
    const course = await this.courseOf(actor, courseId)
    const changeSet = await db.transaction(async (tx) => {
      const [open] = await tx
        .select()
        .from(s.courseChangeSets)
        .where(
          and(eq(s.courseChangeSets.courseId, courseId), eq(s.courseChangeSets.status, 'open')),
        )
        .for('update')
      if (!open) throw this.noneOpen()
      await this.deleteDrafts(tx, open.id)
      await tx
        .update(s.courseChangeSets)
        .set({ status: 'discarded', decidedBy: actor.userId, decidedAt: this.deps.now() })
        .where(eq(s.courseChangeSets.id, open.id))
      return open
    })
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'change_set.discard',
      entityType: 'course',
      entityId: courseId,
      profileId: actor.profileId,
      metadata: { changeSetId: changeSet.id, openedBy: changeSet.openedBy },
    })
    const writer = changeSet.openedBy
      ? await db.query.users.findFirst({ where: { id: changeSet.openedBy } })
      : null
    if (writer && writer.id !== actor.userId) {
      await mailer.send(
        simpleEmail({
          to: writer.email,
          title: `Your changes to "${course.title}" were not applied`,
          paragraphs: [
            `Your edits to "${course.title}" were discarded. The live course is as it was.`,
            'Ask the profile owner or a manager if you want to know why.',
          ],
          cta: {
            href: `${env.TEACH_URL}/p/${course.profileId}/courses/${course.id}`,
            label: 'Open the course',
          },
        }),
      )
    }
  }

  private async deleteDrafts(tx: Tx, changeSetId: string): Promise<void> {
    await tx.delete(s.quizzes).where(eq(s.quizzes.changeSetId, changeSetId))
    await tx.delete(s.artefacts).where(eq(s.artefacts.changeSetId, changeSetId))
    await tx.delete(s.lessonPrerequisites).where(eq(s.lessonPrerequisites.changeSetId, changeSetId))
    await tx.delete(s.lessons).where(eq(s.lessons.changeSetId, changeSetId))
  }
}
