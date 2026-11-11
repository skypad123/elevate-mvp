import type { QuizAnswers } from '@elevate/core'
import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  snakeCase,
  text,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, ts, updatedAt } from './columns'
import { enrollments } from './commerce'
import { artefacts, quizzes } from './courses'
import { progressStatusEnum } from './enums'

export const artefactProgress = snakeCase.table(
  'artefact_progress',
  {
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    artefactId: uuid()
      .notNull()
      .references(() => artefacts.id, { onDelete: 'cascade' }),
    status: progressStatusEnum().notNull().default('not_started'),
    positionSeconds: integer().notNull().default(0),
    completedAt: ts(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.enrollmentId, t.artefactId] }),
    index().on(t.enrollmentId, t.updatedAt),
  ],
)

export const quizAttempts = snakeCase.table(
  'quiz_attempts',
  {
    id: id(),
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    quizId: uuid()
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    answersJson: jsonb().$type<QuizAnswers>().notNull().default(sql`'{}'::jsonb`),
    scorePercent: integer(),
    passed: boolean(),
    startedAt: createdAt(),
    submittedAt: ts(),
    expiresAt: ts(),
  },
  (t) => [index().on(t.enrollmentId, t.quizId)],
)

export const certificates = snakeCase.table('certificates', {
  id: id(),
  enrollmentId: uuid()
    .notNull()
    .unique('certificates_enrollmentId_unique')
    .references(() => enrollments.id, { onDelete: 'cascade' }),
  /** Public, unguessable token used in /c/{token}. */
  token: text().notNull().unique(),
  pdfStorageKey: text(),
  learnerName: text().notNull(),
  courseTitle: text().notNull(),
  teacherName: text().notNull(),
  issuedAt: createdAt(),
  revokedAt: ts(),
})
