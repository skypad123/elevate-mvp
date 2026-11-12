import type { ChangeSetChoice, PrerequisiteLink, QuizQuestion, RichTextDoc } from '@elevate/core'
import { isNull, sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  snakeCase,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { createdAt, id, ts, updatedAt } from './columns'
import { artefactTypeEnum, changeSetStatusEnum, courseStatusEnum } from './enums'
import { mediaAssets } from './media'
import { profiles } from './profiles'

export const courses = snakeCase.table(
  'courses',
  {
    id: id(),
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    title: text().notNull(),
    slug: text().notNull().unique(),
    summary: text(),
    descriptionJson: jsonb().$type<RichTextDoc>(),
    category: text().notNull(),
    thumbnailMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    priceCents: integer().notNull().default(0),
    currency: text().notNull().default('sgd'),
    status: courseStatusEnum().notNull().default('draft'),
    rejectionReason: text(),
    /** Scheme fields exist from day one but stay null until SkillsFuture / Culture Pass work. */
    schemeStatus: text(),
    schemeType: text(),
    submittedAt: ts(),
    reviewedAt: ts(),
    reviewedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    publishedAt: ts(),
    /** Denormalised for the "most enrolled" sort. */
    enrolCount: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.profileId),
    index().on(t.status, t.publishedAt),
    index().on(t.status, t.enrolCount),
    check('courses_price_cents_non_negative', sql`${t.priceCents} >= 0`),
  ],
)

/**
 * A writer's pending edits to a live course. While it is open, the course's lessons, artefacts,
 * quizzes and prerequisite links exist twice: the live rows learners read, and draft rows that
 * carry this change set's ID. Approval applies the drafts to the live rows; a course has at most
 * one open change set.
 */
export const courseChangeSets = snakeCase.table(
  'course_change_sets',
  {
    id: id(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    openedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    status: changeSetStatusEnum().notNull().default('open'),
    openedAt: createdAt(),
    /** The newest `updated_at` among the live rows when the copy was made. */
    openedAtSnapshot: ts().notNull(),
    /** The live prerequisite links when the copy was made, by live lesson ID. */
    openedPrerequisites: jsonb().$type<PrerequisiteLink[]>().notNull().default(sql`'[]'::jsonb`),
    /** The approver's choice for each conflict, kept until approval. */
    resolutions: jsonb().$type<ChangeSetChoice[]>().notNull().default(sql`'[]'::jsonb`),
    decidedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    decidedAt: ts(),
  },
  (t) => [
    uniqueIndex('course_change_sets_one_open_per_course')
      .on(t.courseId)
      .where(sql`${t.status} = 'open'`),
    index().on(t.courseId),
  ],
)

/**
 * The columns that make a row a draft. All four are empty on a live row.
 *
 * - `changeSetId`: the change set the draft belongs to; the draft goes when the change set does.
 * - `sourceId`: the live row a draft was copied from. Null for a new draft, and set to null if
 *   that live row is deleted.
 * - `copiedFromLive`: tells a copy whose live row was deleted apart from a new draft.
 * - `removed`: the writer removed this copied row; approval deletes its live row.
 */
const draftColumns = (self: () => AnyPgColumn) => ({
  changeSetId: uuid().references(() => courseChangeSets.id, { onDelete: 'cascade' }),
  sourceId: uuid().references(self, { onDelete: 'set null' }),
  removed: boolean().notNull().default(false),
  copiedFromLive: boolean().notNull().default(false),
})

/** A live row carries no draft fields. */
const liveRowIsClean = (t: {
  changeSetId: AnyPgColumn
  sourceId: AnyPgColumn
  removed: AnyPgColumn
  copiedFromLive: AnyPgColumn
}) =>
  sql`${t.changeSetId} is not null or (${t.sourceId} is null and not ${t.removed} and not ${t.copiedFromLive})`

export const lessons = snakeCase.table(
  'lessons',
  {
    id: id(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    summary: text(),
    position: integer().notNull().default(0),
    ...draftColumns((): AnyPgColumn => lessons.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.courseId, t.position),
    index().on(t.changeSetId),
    index().on(t.sourceId),
    check('lessons_live_row_is_clean', liveRowIsClean(t)),
  ],
)

/**
 * Edge of the course DAG: `lessonId` requires `prerequisiteLessonId` to be completed first.
 * A draft link joins two draft lessons, so it never collides with a live link.
 */
export const lessonPrerequisites = snakeCase.table(
  'lesson_prerequisites',
  {
    lessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    prerequisiteLessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    changeSetId: uuid().references(() => courseChangeSets.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.lessonId, t.prerequisiteLessonId] }),
    index().on(t.changeSetId),
    check('lesson_prerequisites_not_self', sql`${t.lessonId} <> ${t.prerequisiteLessonId}`),
  ],
)

export const artefacts = snakeCase.table(
  'artefacts',
  {
    id: id(),
    lessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    type: artefactTypeEnum().notNull(),
    title: text().notNull(),
    position: integer().notNull().default(0),
    /** video / audio */
    mediaAssetId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    /** text */
    contentJson: jsonb().$type<RichTextDoc>(),
    durationSeconds: integer(),
    ...draftColumns((): AnyPgColumn => artefacts.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.lessonId, t.position),
    index().on(t.changeSetId),
    index().on(t.sourceId),
    check('artefacts_live_row_is_clean', liveRowIsClean(t)),
  ],
)

export const quizzes = snakeCase.table(
  'quizzes',
  {
    id: id(),
    artefactId: uuid()
      .notNull()
      .unique()
      .references(() => artefacts.id, { onDelete: 'cascade' }),
    passMarkPercent: integer().notNull().default(70),
    maxAttempts: integer().notNull().default(1),
    timeLimitMinutes: integer(),
    questionsJson: jsonb().$type<QuizQuestion[]>().notNull().default(sql`'[]'::jsonb`),
    ...draftColumns((): AnyPgColumn => quizzes.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.changeSetId),
    index().on(t.sourceId),
    check('quizzes_live_row_is_clean', liveRowIsClean(t)),
  ],
)

// ── What learners read ───────────────────────────────────────────────────────
//
// Each view is its table without the draft rows. Learner-facing code reads course content only
// through these (see `learner-relations.ts`), so a writer's pending edits cannot reach a learner.

export const liveLessons = snakeCase
  .view('live_lessons')
  .as((qb) => qb.select().from(lessons).where(isNull(lessons.changeSetId)))

export const liveArtefacts = snakeCase
  .view('live_artefacts')
  .as((qb) => qb.select().from(artefacts).where(isNull(artefacts.changeSetId)))

export const liveQuizzes = snakeCase
  .view('live_quizzes')
  .as((qb) => qb.select().from(quizzes).where(isNull(quizzes.changeSetId)))

export const liveLessonPrerequisites = snakeCase
  .view('live_lesson_prerequisites')
  .as((qb) => qb.select().from(lessonPrerequisites).where(isNull(lessonPrerequisites.changeSetId)))
