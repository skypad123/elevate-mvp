import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  snakeCase,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { createdAt, id, ts, updatedAt } from './columns'
import { enrollments } from './commerce'
import { courses } from './courses'
import { attendanceEventTypeEnum, classDeliveryEnum, classStatusEnum } from './enums'
import { profiles } from './profiles'

/**
 * One run of a course at fixed dates, with an instructor and a limited group of learners
 * (docs/designs/scheduled-classes-attendance.md). A learner in a class has a class enrollment:
 * an `enrollments` row whose `class_id` is this class.
 */
export const classes = snakeCase.table(
  'classes',
  {
    id: id(),
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    delivery: classDeliveryEnum().notNull(),
    /** Free text. Required for an in-person class before it is published. */
    venueAddress: text(),
    /** The venue position, set together from the instructor's device. */
    venueLat: doublePrecision(),
    venueLng: doublePrecision(),
    venueAccuracyM: doublePrecision(),
    venueSetAt: ts(),
    venueSetBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    venueRadiusM: integer().notNull().default(200),
    /** The owner, or a current member of the profile. */
    instructorUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Stored now, enforced by Part 2. */
    seats: integer().notNull(),
    /** An IANA name. The API sets it; no request can. */
    timeZone: text().notNull().default('Asia/Singapore'),
    status: classStatusEnum().notNull().default('draft'),
    publishedAt: ts(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.profileId, t.status)],
)

/**
 * One meeting of a class. Its times can change, and it can be removed, until it has a `check_in`
 * or `manual_mark` event; after that the API refuses the change.
 */
export const classBlocks = snakeCase.table(
  'class_blocks',
  {
    id: id(),
    classId: uuid()
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    /** Order within the class. */
    position: integer().notNull(),
    startsAt: ts().notNull(),
    endsAt: ts().notNull(),
    /** 32 random bytes as base64url text; the rotating code is an HMAC with it. Never sent. */
    codeSecret: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.classId, t.position),
    check('class_blocks_ends_after_starts', sql`${t.endsAt} > ${t.startsAt}`),
  ],
)

/**
 * The attendance record: every refused attempt, check-in, overturn, manual mark, dispute and
 * decision. Rows are only inserted, and only by `AttendanceService`; the API's database user
 * holds no update, delete or truncate on this table (see `../roles.ts`). The state of a learner
 * in a block is worked out from these rows by `attendanceState` in `@elevate/core`.
 */
export const attendanceEvents = snakeCase.table(
  'attendance_events',
  {
    id: id(),
    classId: uuid()
      .notNull()
      .references(() => classes.id, { onDelete: 'restrict' }),
    blockId: uuid()
      .notNull()
      .references(() => classBlocks.id, { onDelete: 'restrict' }),
    // `commerce.ts` imports this file for `enrollments.class_id`, hence the typed callback.
    enrollmentId: uuid()
      .notNull()
      .references((): AnyPgColumn => enrollments.id, { onDelete: 'restrict' }),
    /** Copied from the enrollment when the row is written. */
    learnerUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    type: attendanceEventTypeEnum().notNull(),
    actorUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** `learner`, `owner`, `manager` or `writer`, as it was at that moment. */
    actorRole: text().notNull(),
    /** `qr_link` or `typed_code`, for attempts and check-ins. */
    method: text(),
    /** For `attempt_refused`. */
    refusalReason: text(),
    locationStatus: text(),
    accuracyM: doublePrecision(),
    distanceM: doublePrecision(),
    /** A copy of the venue as it was at that moment. */
    venueLat: doublePrecision(),
    venueLng: doublePrecision(),
    venueAccuracyM: doublePrecision(),
    venueRadiusM: integer(),
    /** The code period that matched. */
    codePeriod: bigint({ mode: 'number' }),
    /** The device's clock, as evidence only. */
    clientTime: ts(),
    platform: text(),
    appVersion: text(),
    /** A fixed reason for an overturn or manual mark, so the learner app can word it. */
    reasonCode: text(),
    /** The typed note. */
    reason: text(),
    /** For a manual mark: the type of document checked. Not its number. */
    idDocumentType: text(),
    /** For `dispute_decision`: `upheld` or `voided`. */
    decision: text(),
    /** An overturn points at a check-in, a dispute at a manual mark, a decision at a dispute. */
    refersToEventId: uuid().references((): AnyPgColumn => attendanceEvents.id, {
      onDelete: 'restrict',
    }),
    /** The API request that wrote the row. */
    requestId: text().notNull(),
    /** Set by the service from the API's clock, so no database default. */
    createdAt: ts().notNull(),
  },
  (t) => [
    index().on(t.blockId, t.enrollmentId, t.createdAt),
    index().on(t.classId, t.createdAt),
    uniqueIndex('attendance_events_one_check_in')
      .on(t.blockId, t.enrollmentId)
      .where(sql`${t.type} = 'check_in'`),
    uniqueIndex('attendance_events_one_per_referred_event')
      .on(t.refersToEventId, t.type)
      .where(sql`${t.refersToEventId} is not null`),
  ],
)

/**
 * The coordinates of a reading, kept apart from the event so they can be erased. Deleting a row
 * leaves the event, with its distance, accuracy and status, untouched.
 */
export const attendanceEventLocations = snakeCase.table('attendance_event_locations', {
  eventId: uuid()
    .primaryKey()
    .references(() => attendanceEvents.id, { onDelete: 'restrict' }),
  lat: doublePrecision().notNull(),
  lng: doublePrecision().notNull(),
  createdAt: createdAt(),
})
