import type { QuizQuestion, RichTextDoc } from '@elevate/core'
import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  snakeCase,
  text,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { createdAt, id, ts, updatedAt } from './columns'
import { artefactTypeEnum, courseStatusEnum } from './enums'
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.courseId, t.position)],
)

/** Edge of the course DAG: `lessonId` requires `prerequisiteLessonId` to be completed first. */
export const lessonPrerequisites = snakeCase.table(
  'lesson_prerequisites',
  {
    lessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    prerequisiteLessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.lessonId, t.prerequisiteLessonId] }),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.lessonId, t.position)],
)

export const quizzes = snakeCase.table('quizzes', {
  id: id(),
  artefactId: uuid()
    .notNull()
    .unique()
    .references(() => artefacts.id, { onDelete: 'cascade' }),
  passMarkPercent: integer().notNull().default(70),
  maxAttempts: integer().notNull().default(1),
  timeLimitMinutes: integer(),
  questionsJson: jsonb().$type<QuizQuestion[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})
