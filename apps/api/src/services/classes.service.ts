import {
  type AttendanceEventFacts,
  type AttendanceEventType,
  attendanceState,
  type CheckInMix,
  CLASS_TIME_ZONE,
  type ClassBlockInput,
  type ClassBlockView,
  type ClassDetail,
  type ClassSummary,
  type CreateClass,
  checkInMix,
  checkInWindow,
  type DisputeDecision,
  type Locale,
  type LocationStatus,
  type RefusalReason,
  SEAT_HORIZON_MS,
  type SetVenueLocation,
  type UpdateClass,
  VENUE_ACCURACY_CONFIRM_M,
  validateBlocks,
  zonedToInstant,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, eq, inArray } from 'drizzle-orm'
import type { Deps } from '../deps'
import { classTimesChangedEmail } from '../emails/class-sales'
import { newBlockSecret } from '../lib/class-code'
import { errors, HttpError } from '../lib/errors'
import type { ProfileActor } from '../middleware/auth'
import { AttendanceService } from './attendance.service'
import { recordAudit } from './audit.service'
import { onSale, seatsTaken } from './class-checkout.service'
import type { Tx } from './seat-refunds.service'

export type ClassRow = typeof s.classes.$inferSelect
export type ClassBlockRow = typeof s.classBlocks.$inferSelect
export type AttendanceEventRow = typeof s.attendanceEvents.$inferSelect

type Person = { name: string | null; email: string }

/** A person as the Teach and Support pages show them: their name, else their address. */
export const nameOf = (person: Person): string => person.name?.trim() || person.email

/** The fields of an event row the state rules in `@elevate/core` read. */
export function toFacts(event: AttendanceEventRow): AttendanceEventFacts {
  return {
    id: event.id,
    type: event.type as AttendanceEventType,
    createdAt: event.createdAt,
    locationStatus: event.locationStatus as LocationStatus | null,
    refusalReason: event.refusalReason as RefusalReason | null,
    decision: event.decision as DisputeDecision | null,
    refersToEventId: event.refersToEventId,
  }
}

/** A block as every answer shows it, with its check-in window. Never its code secret. */
export function blockView(
  block: ClassBlockRow,
  frozen: boolean,
  removable: boolean,
): ClassBlockView {
  const { opensAt, closesAt } = checkInWindow(block)
  return {
    id: block.id,
    position: block.position,
    startsAt: block.startsAt.toISOString(),
    endsAt: block.endsAt.toISOString(),
    frozen,
    removable,
    checkInOpensAt: opensAt.toISOString(),
    checkInClosesAt: closesAt.toISOString(),
  }
}

const spanIso = (span: Span) => ({
  startsAt: span.startsAt.toISOString(),
  endsAt: span.endsAt.toISOString(),
})

/** A block whose learner has a check-in or a manual mark: its times can no longer change. */
const FREEZING: readonly string[] = ['check_in', 'manual_mark']

/**
 * The one test of "is this actor the class's assigned instructor", used by every roster action.
 * Staff are never the instructor: the instructor is always the owner or a member.
 */
export function isAssignedInstructor(
  actor: ProfileActor,
  classRow: Pick<ClassRow, 'instructorUserId'>,
): boolean {
  return actor.role !== 'staff' && classRow.instructorUserId === actor.userId
}

const EMPTY_MIX: CheckInMix = {
  enrolled: 0,
  selfCheckIn: 0,
  flaggedFromApp: 0,
  flaggedOther: 0,
  overturned: 0,
  markedByHand: 0,
  notArrived: 0,
}

function addMixes(a: CheckInMix, b: CheckInMix): CheckInMix {
  const out = { ...a }
  for (const key of Object.keys(out) as (keyof CheckInMix)[]) out[key] = a[key] + b[key]
  return out
}

const SUMMARY_RELATIONS = {
  course: { columns: { title: true } },
  instructor: { columns: { id: true, name: true, email: true } },
  blocks: { columns: { startsAt: true, endsAt: true } },
  enrollments: { columns: { id: true }, where: { status: 'active' } },
} as const

type SummaryRow = ClassRow & {
  course: { title: string }
  instructor: { id: string; name: string | null; email: string }
  blocks: { startsAt: Date; endsAt: Date }[]
  enrollments: { id: string }[]
}

function summaryOf(row: SummaryRow): ClassSummary {
  const starts = row.blocks.map((b) => b.startsAt.getTime())
  const ends = row.blocks.map((b) => b.endsAt.getTime())
  return {
    id: row.id,
    name: row.name,
    courseId: row.courseId,
    courseTitle: row.course.title,
    delivery: row.delivery,
    status: row.status,
    seats: row.seats,
    timeZone: row.timeZone,
    instructor: { userId: row.instructor.id, displayName: nameOf(row.instructor) },
    firstBlockStartsAt: starts.length ? new Date(Math.min(...starts)).toISOString() : null,
    lastBlockEndsAt: ends.length ? new Date(Math.max(...ends)).toISOString() : null,
    enrolledCount: row.enrollments.length,
  }
}

type Span = { startsAt: Date; endsAt: Date }

type BlockPlan = {
  /** The blocks as they are now. */
  before: (Span & { id: string })[]
  removed: string[]
  kept: { id: string; startsAt: Date; endsAt: Date; position: number }[]
  added: { startsAt: Date; endsAt: Date; position: number }[]
}

/** A seat holder told of a time change; `canWithdraw` when the edit gave them the right. */
type TimesChangedSeat = {
  enrollmentId: string
  email: string
  locale: Locale | null
  canWithdraw: boolean
}

/** The old and the new times, when an edit moves, adds or removes a block; else null. */
function timesChange(plan: BlockPlan): { before: Span[]; after: Span[] } | null {
  const was = new Map(plan.before.map((b) => [b.id, b]))
  const moved = plan.kept.some((block) => {
    const old = was.get(block.id)
    return (
      !old ||
      old.startsAt.getTime() !== block.startsAt.getTime() ||
      old.endsAt.getTime() !== block.endsAt.getTime()
    )
  })
  if (!moved && plan.removed.length === 0 && plan.added.length === 0) return null
  const byStart = (a: Span, b: Span) => a.startsAt.getTime() - b.startsAt.getTime()
  return {
    before: plan.before.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })).sort(byStart),
    after: [...plan.kept, ...plan.added]
      .map(({ startsAt, endsAt }) => ({ startsAt, endsAt }))
      .sort(byStart),
  }
}

/** A class that was cancelled is closed: nothing about it can change any more. */
function assertNotCancelled(row: ClassRow): void {
  if (row.status === 'cancelled' || row.cancelledAt !== null) {
    throw errors.conflict('class_cancelled', 'This class was cancelled')
  }
}

/**
 * Classes and their blocks (docs/designs/scheduled-classes-attendance.md). Every lookup goes
 * through `load`, which filters by the actor's profile in the same query, and for a writer also
 * by the class's instructor: a class of another profile, or one a writer does not instruct, is
 * not found.
 *
 * It reads `attendance_events` to decide whether a block is frozen and to count the check-in
 * mix; it never writes them.
 */
export class ClassesService {
  constructor(private readonly deps: Deps) {}

  /** The one class lookup every method here and `AttendanceService` use. */
  async load(actor: ProfileActor, id: string): Promise<ClassRow> {
    const row = await this.deps.db.query.classes.findFirst({
      where: {
        id,
        profileId: actor.profileId,
        ...(actor.role === 'writer' ? { instructorUserId: actor.userId } : {}),
      },
    })
    if (!row) throw errors.notFound('Class')
    return row
  }

  async list(actor: ProfileActor): Promise<ClassSummary[]> {
    const rows = await this.deps.db.query.classes.findMany({
      where: {
        profileId: actor.profileId,
        ...(actor.role === 'writer' ? { instructorUserId: actor.userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      with: SUMMARY_RELATIONS,
    })
    return rows.map(summaryOf)
  }

  async get(actor: ProfileActor, id: string): Promise<ClassDetail> {
    const row = await this.load(actor, id)
    return this.detail(row.id, isAssignedInstructor(actor, row))
  }

  /** Summaries for Support's search, by id, in the order given. */
  async summaries(ids: readonly string[]): Promise<Map<string, ClassSummary>> {
    if (ids.length === 0) return new Map()
    const rows = await this.deps.db.query.classes.findMany({
      where: { id: { in: [...ids] } },
      with: SUMMARY_RELATIONS,
    })
    return new Map(rows.map((row) => [row.id, summaryOf(row)]))
  }

  /**
   * One class with its blocks and check-in mix. A block's mix counts each active class
   * enrollment once by state. The class's mix adds up the blocks whose check-in has opened, so a
   * block still to come does not count its learners as not arrived.
   */
  async detail(id: string, viewerIsInstructor: boolean): Promise<ClassDetail> {
    const { db } = this.deps
    const now = this.deps.now()
    const row = await db.query.classes.findFirst({
      where: { id },
      with: {
        ...SUMMARY_RELATIONS,
        course: { columns: { title: true, status: true } },
        profile: { columns: { classSalesAcceptedAt: true }, with: { payoutAccount: true } },
        blocks: { orderBy: { position: 'asc' } },
      },
    })
    if (!row) throw errors.notFound('Class')
    const events = await db.query.attendanceEvents.findMany({ where: { classId: id } })
    const onSaleNow = onSale(this.deps.env, row, now)
    const started = row.blocks.some((b) => b.startsAt.getTime() <= now.getTime())
    const attendance = started
      ? null
      : await new AttendanceService(this.deps).moneyAttendanceByEnrollment(db, id)
    const seatsWithChangeRight = attendance
      ? row.enrollments.filter((e) => !attendance.get(e.id)?.counted).length
      : 0
    const enrollmentIds = row.enrollments.map((e) => e.id)
    const blocks = row.blocks.map((block) => {
      const ofBlock = events.filter((e) => e.blockId === block.id)
      const frozen = ofBlock.some((e) => FREEZING.includes(e.type))
      const mix = checkInMix(
        enrollmentIds.map((enrollmentId) =>
          attendanceState(ofBlock.filter((e) => e.enrollmentId === enrollmentId).map(toFacts), now),
        ),
      )
      return { ...blockView(block, frozen, ofBlock.length === 0), mix }
    })
    const mix = blocks
      .filter((b) => new Date(b.checkInOpensAt).getTime() <= now.getTime())
      .reduce((total, b) => addMixes(total, b.mix), EMPTY_MIX)
    const venue =
      row.venueLat !== null &&
      row.venueLng !== null &&
      row.venueAccuracyM !== null &&
      row.venueSetAt !== null
        ? {
            lat: row.venueLat,
            lng: row.venueLng,
            accuracyM: row.venueAccuracyM,
            radiusM: row.venueRadiusM,
            setAt: row.venueSetAt.toISOString(),
          }
        : null
    return {
      ...summaryOf(row),
      venueAddress: row.venueAddress,
      venue,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      viewerIsInstructor,
      blocks,
      mix,
      notOnSaleReason: onSaleNow === true ? null : onSaleNow,
      cancelReason: row.cancelReason,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      releasedAt: row.releasedAt?.toISOString() ?? null,
      seatsTaken: await seatsTaken(db, id, now),
      seatsWithChangeRight,
    }
  }

  async create(actor: ProfileActor, input: CreateClass): Promise<ClassDetail> {
    const { db } = this.deps
    await this.courseOf(actor, input.courseId)
    await this.assertInstructor(actor.profileId, input.instructorUserId)
    const spans = this.toInstants(input.blocks, CLASS_TIME_ZONE)
    const now = this.deps.now()
    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(s.classes)
        .values({
          profileId: actor.profileId,
          courseId: input.courseId,
          name: input.name,
          delivery: input.delivery,
          venueAddress: input.venueAddress || null,
          instructorUserId: input.instructorUserId,
          seats: input.seats,
          timeZone: CLASS_TIME_ZONE,
          status: 'draft',
          createdBy: actor.userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      if (!created) throw new Error('failed to create the class')
      await tx.insert(s.classBlocks).values(
        this.ordered(spans).map((span) => ({
          classId: created.id,
          position: span.position,
          startsAt: span.startsAt,
          endsAt: span.endsAt,
          codeSecret: newBlockSecret(),
        })),
      )
      return created.id
    })
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'class.created',
      entityType: 'class',
      entityId: id,
      profileId: actor.profileId,
      metadata: { courseId: input.courseId, blocks: spans.length },
    })
    return this.detail(id, isAssignedInstructor(actor, input))
  }

  /**
   * Edits fields and replaces the blocks. A block sent with its `id` keeps it; one sent without is
   * new; one left out is removed. A frozen block can be neither moved nor removed, and a block
   * with only refused attempts can be moved but not removed. Once published, the course and the
   * delivery cannot change. Every check runs before anything is written.
   */
  async update(actor: ProfileActor, id: string, input: UpdateClass): Promise<ClassDetail> {
    const { db } = this.deps
    const row = await this.load(actor, id)
    assertNotCancelled(row)
    const published = row.status === 'published'
    const courseChanges = input.courseId !== undefined && input.courseId !== row.courseId
    const deliveryChanges = input.delivery !== undefined && input.delivery !== row.delivery
    if (published && (courseChanges || deliveryChanges)) {
      throw errors.conflict(
        'class_published',
        'The course and delivery of a published class cannot change',
      )
    }
    if (courseChanges && input.courseId) await this.courseOf(actor, input.courseId)
    const instructorChanges =
      input.instructorUserId !== undefined && input.instructorUserId !== row.instructorUserId
    if (instructorChanges && input.instructorUserId) {
      await this.assertInstructor(actor.profileId, input.instructorUserId)
    }
    const plan = input.blocks ? await this.planBlocks(row, input.blocks) : null
    const change = plan ? timesChange(plan) : null

    const fields = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.delivery !== undefined ? { delivery: input.delivery } : {}),
      ...(input.venueAddress !== undefined ? { venueAddress: input.venueAddress || null } : {}),
      ...(input.seats !== undefined ? { seats: input.seats } : {}),
      ...(input.courseId !== undefined ? { courseId: input.courseId } : {}),
      ...(input.instructorUserId !== undefined ? { instructorUserId: input.instructorUserId } : {}),
    }
    const now = this.deps.now()
    const told = await db.transaction(async (tx) => {
      // The class row is locked first, as checkout and fulfilment lock it, so the seats counted
      // here cannot change before this edit commits.
      await tx
        .select({ id: s.classes.id })
        .from(s.classes)
        .where(eq(s.classes.id, row.id))
        .for('update')
      if (input.seats !== undefined) {
        const taken = await seatsTaken(tx as unknown as Tx, row.id, now)
        if (input.seats < taken) {
          throw errors.unprocessable(
            'capacity_below_taken',
            'More seats are taken than that capacity allows',
            { taken },
          )
        }
      }
      const seats = change
        ? await this.timesChangedSeats(tx as unknown as Tx, row, change, now)
        : []
      await tx
        .update(s.classes)
        .set({ ...fields, updatedAt: now })
        .where(eq(s.classes.id, row.id))
      if (!plan) return seats
      if (plan.removed.length) {
        await tx.delete(s.classBlocks).where(inArray(s.classBlocks.id, plan.removed))
      }
      // Out of the way first, so the new order never collides with the old one.
      for (const [index, block] of plan.kept.entries()) {
        await tx
          .update(s.classBlocks)
          .set({ position: -1 - index })
          .where(eq(s.classBlocks.id, block.id))
      }
      for (const block of plan.kept) {
        await tx
          .update(s.classBlocks)
          .set({
            position: block.position,
            startsAt: block.startsAt,
            endsAt: block.endsAt,
            updatedAt: now,
          })
          .where(eq(s.classBlocks.id, block.id))
      }
      if (plan.added.length) {
        await tx.insert(s.classBlocks).values(
          plan.added.map((block) => ({
            classId: row.id,
            position: block.position,
            startsAt: block.startsAt,
            endsAt: block.endsAt,
            codeSecret: newBlockSecret(),
          })),
        )
      }
      return seats
    })
    if (change && told.length > 0) {
      await recordAudit(this.deps, {
        actorId: actor.userId,
        action: 'class.times_changed',
        entityType: 'class',
        entityId: row.id,
        profileId: actor.profileId,
        metadata: {
          before: change.before.map(spanIso),
          after: change.after.map(spanIso),
          seats: told.length,
          withdrawRight: told.filter((seat) => seat.canWithdraw).length,
        },
      })
      const className = input.name ?? row.name
      for (const seat of told) {
        await this.deps.mailer.send(
          classTimesChangedEmail({
            to: seat.email,
            locale: seat.locale ?? 'en',
            learnerUrl: this.deps.env.LEARNER_URL,
            enrollmentId: seat.enrollmentId,
            className,
            timeZone: row.timeZone,
            before: change.before,
            after: change.after,
            canWithdraw: seat.canWithdraw,
          }),
        )
      }
    }
    if (published) {
      await recordAudit(this.deps, {
        actorId: actor.userId,
        action: 'class.updated',
        entityType: 'class',
        entityId: row.id,
        profileId: actor.profileId,
        metadata: { fields: Object.keys(input).sort() },
      })
    }
    if (instructorChanges) {
      await this.auditInstructor(actor, row, input.instructorUserId as string)
    }
    const instructorUserId = input.instructorUserId ?? row.instructorUserId
    return this.detail(row.id, isAssignedInstructor(actor, { instructorUserId }))
  }

  /**
   * Publishes a draft once every check passes, reporting every failed check together. A class
   * that is already published is answered unchanged.
   */
  async publish(actor: ProfileActor, id: string): Promise<ClassDetail> {
    const { db } = this.deps
    const row = await this.load(actor, id)
    assertNotCancelled(row)
    if (row.status === 'published') return this.detail(row.id, isAssignedInstructor(actor, row))
    const now = this.deps.now()
    const [course, blocks, instructorOk] = await Promise.all([
      db.query.courses.findFirst({
        where: { id: row.courseId, profileId: row.profileId },
        columns: { status: true },
      }),
      db.query.classBlocks.findMany({ where: { classId: row.id }, columns: { endsAt: true } }),
      this.isOwnerOrMember(row.profileId, row.instructorUserId),
    ])
    const problems: string[] = []
    if (course?.status !== 'live') problems.push('course_not_published')
    if (blocks.length === 0) problems.push('no_blocks')
    if (blocks.some((b) => b.endsAt.getTime() <= now.getTime())) problems.push('block_ended')
    if (!instructorOk) problems.push('instructor_not_member')
    if (row.delivery === 'in_person' && !row.venueAddress?.trim()) {
      problems.push('venue_address_missing')
    }
    if (problems.length) {
      throw errors.unprocessable('class_not_publishable', 'The class cannot be published yet', {
        problems,
      })
    }
    await db
      .update(s.classes)
      .set({ status: 'published', publishedAt: now, updatedAt: now })
      .where(and(eq(s.classes.id, row.id), eq(s.classes.status, 'draft')))
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'class.published',
      entityType: 'class',
      entityId: row.id,
      profileId: actor.profileId,
    })
    return this.detail(row.id, isAssignedInstructor(actor, row))
  }

  /** Reassigns the instructor. Choosing the current one changes nothing and is not audited. */
  async setInstructor(actor: ProfileActor, id: string, userId: string): Promise<ClassDetail> {
    const row = await this.load(actor, id)
    assertNotCancelled(row)
    if (userId !== row.instructorUserId) {
      await this.assertInstructor(actor.profileId, userId)
      await this.deps.db
        .update(s.classes)
        .set({ instructorUserId: userId, updatedAt: this.deps.now() })
        .where(eq(s.classes.id, row.id))
      await this.auditInstructor(actor, row, userId)
    }
    return this.detail(row.id, isAssignedInstructor(actor, { instructorUserId: userId }))
  }

  /** Deletes a draft class; its blocks go with it. A published class cannot be deleted. */
  async remove(actor: ProfileActor, id: string): Promise<void> {
    const row = await this.load(actor, id)
    assertNotCancelled(row)
    if (row.status !== 'draft') {
      throw errors.conflict('class_published', 'A published class cannot be deleted')
    }
    await this.deps.db
      .delete(s.classes)
      .where(and(eq(s.classes.id, row.id), eq(s.classes.status, 'draft')))
  }

  /**
   * Sets the venue position from the instructor's device. A reading worse than 100 m needs
   * `confirmPoorAccuracy`. The audit entry records the accuracy and never the coordinates.
   */
  async setVenueLocation(
    actor: ProfileActor,
    id: string,
    input: SetVenueLocation,
  ): Promise<ClassDetail> {
    const row = await this.load(actor, id)
    if (!isAssignedInstructor(actor, row)) throw errors.forbidden()
    if (row.delivery === 'remote') {
      throw errors.conflict('class_is_remote', 'A remote class has no venue position')
    }
    if (input.accuracyM > VENUE_ACCURACY_CONFIRM_M && !input.confirmPoorAccuracy) {
      throw errors.unprocessable(
        'venue_accuracy_poor',
        'The reading is not precise enough. Confirm to use it anyway.',
        { accuracyM: input.accuracyM },
      )
    }
    const now = this.deps.now()
    await this.deps.db
      .update(s.classes)
      .set({
        venueLat: input.lat,
        venueLng: input.lng,
        venueAccuracyM: input.accuracyM,
        venueSetAt: now,
        venueSetBy: actor.userId,
        updatedAt: now,
      })
      .where(eq(s.classes.id, row.id))
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'class.venue_set',
      entityType: 'class',
      entityId: row.id,
      profileId: actor.profileId,
      metadata: { accuracyM: input.accuracyM },
    })
    return this.detail(row.id, true)
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /**
   * A block-time edit in a class with seats (R3), inside the edit's transaction. It is refused
   * when the class would end more than `SEAT_HORIZON_MS` after any seat's payment. Before the
   * class starts, each seat whose learner is not counted as attended gets `classChangedAt`, the
   * right to withdraw in full. Returns every seat holder, to be emailed after the commit.
   */
  private async timesChangedSeats(
    tx: Tx,
    row: ClassRow,
    change: { before: Span[]; after: Span[] },
    now: Date,
  ): Promise<TimesChangedSeat[]> {
    const seats = await tx.query.enrollments.findMany({
      where: { classId: row.id, status: 'active' },
      columns: { id: true, stripeCheckoutSessionId: true },
      with: {
        user: { columns: { email: true, locale: true } },
        payments: { columns: { stripeCheckoutSessionId: true, paidAt: true } },
      },
    })
    if (seats.length === 0) return []
    // The seat's payment is the one its enrollment points at; a seeded seat has none.
    const paidAt = seats.flatMap((seat) =>
      seat.payments
        .filter((p) => p.stripeCheckoutSessionId === seat.stripeCheckoutSessionId)
        .map((p) => p.paidAt.getTime()),
    )
    const newEnd = Math.max(...change.after.map((b) => b.endsAt.getTime()))
    if (paidAt.length > 0) {
      const earliest = Math.min(...paidAt)
      if (newEnd - earliest > SEAT_HORIZON_MS) {
        throw errors.unprocessable(
          'class_too_late_for_seat',
          'The class would end too long after a seat in it was paid for',
          { latestEndsAt: new Date(earliest + SEAT_HORIZON_MS).toISOString() },
        )
      }
    }
    const started = change.before.some((b) => b.startsAt.getTime() <= now.getTime())
    const attendance = started
      ? null
      : await new AttendanceService(this.deps).moneyAttendanceByEnrollment(tx, row.id)
    const withRight = attendance
      ? seats.filter((seat) => !attendance.get(seat.id)?.counted).map((seat) => seat.id)
      : []
    if (withRight.length > 0) {
      await tx
        .update(s.enrollments)
        .set({ classChangedAt: now })
        .where(inArray(s.enrollments.id, withRight))
    }
    return seats.map((seat) => ({
      enrollmentId: seat.id,
      email: seat.user.email,
      locale: seat.user.locale,
      canWithdraw: withRight.includes(seat.id),
    }))
  }

  /** The course, which must belong to the actor's profile. */
  private async courseOf(actor: ProfileActor, courseId: string) {
    const course = await this.deps.db.query.courses.findFirst({
      where: { id: courseId, profileId: actor.profileId },
      columns: { id: true, status: true },
    })
    if (!course) throw errors.notFound('Course')
    return course
  }

  /** Whether the user owns the profile or is a current member of it. */
  async isOwnerOrMember(profileId: string, userId: string): Promise<boolean> {
    const { db } = this.deps
    const profile = await db.query.profiles.findFirst({
      where: { id: profileId },
      columns: { ownerUserId: true },
    })
    if (profile?.ownerUserId === userId) return true
    const membership = await db.query.profileMemberships.findFirst({
      where: { profileId, userId },
      columns: { userId: true },
    })
    return !!membership
  }

  private async assertInstructor(profileId: string, userId: string): Promise<void> {
    if (!(await this.isOwnerOrMember(profileId, userId))) {
      throw errors.unprocessable(
        'instructor_not_member',
        'The instructor must be the owner or a member of the profile',
      )
    }
  }

  private async auditInstructor(actor: ProfileActor, row: ClassRow, to: string) {
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'class.instructor_changed',
      entityType: 'class',
      entityId: row.id,
      profileId: actor.profileId,
      metadata: { from: row.instructorUserId, to },
    })
  }

  /** The blocks as instants in the class's time zone, refused together if any has a problem. */
  private toInstants(blocks: readonly ClassBlockInput[], timeZone: string) {
    const spans = blocks.map((b) => ({
      startsAt: zonedToInstant(b.date, b.startTime, timeZone),
      endsAt: zonedToInstant(b.date, b.endTime, timeZone),
    }))
    const problems = validateBlocks(spans)
    if (problems.length) {
      throw errors.unprocessable('blocks_invalid', 'Check the dates and times', { problems })
    }
    return spans
  }

  /** Positions follow start times. */
  private ordered<T extends { startsAt: Date }>(spans: readonly T[]): (T & { position: number })[] {
    return [...spans]
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((span, position) => ({ ...span, position }))
  }

  private async planBlocks(
    row: ClassRow,
    inputs: NonNullable<UpdateClass['blocks']>,
  ): Promise<BlockPlan> {
    const { db } = this.deps
    const spans = this.toInstants(inputs, row.timeZone).map((span, index) => ({
      ...span,
      id: inputs[index]?.id,
    }))
    const existing = await db.query.classBlocks.findMany({ where: { classId: row.id } })
    const byId = new Map(existing.map((b) => [b.id, b]))
    const seen = new Set<string>()
    for (const span of spans) {
      if (!span.id) continue
      if (!byId.has(span.id) || seen.has(span.id)) throw errors.notFound('Block')
      seen.add(span.id)
    }
    const kinds = existing.length
      ? await db
          .selectDistinct({ blockId: s.attendanceEvents.blockId, type: s.attendanceEvents.type })
          .from(s.attendanceEvents)
          .where(
            inArray(
              s.attendanceEvents.blockId,
              existing.map((b) => b.id),
            ),
          )
      : []
    const frozen = new Set(kinds.filter((k) => FREEZING.includes(k.type)).map((k) => k.blockId))
    const withEvents = new Set(kinds.map((k) => k.blockId))
    const blockError = (code: string, message: string, blockId: string) =>
      new HttpError(409, code, message, { blockId })

    for (const span of spans) {
      const current = span.id ? byId.get(span.id) : undefined
      if (!current || !frozen.has(current.id)) continue
      const moved =
        current.startsAt.getTime() !== span.startsAt.getTime() ||
        current.endsAt.getTime() !== span.endsAt.getTime()
      if (moved) {
        throw blockError('block_frozen', 'This block has attendance and cannot change', current.id)
      }
    }
    const removed = existing.filter((b) => !seen.has(b.id))
    for (const block of removed) {
      if (frozen.has(block.id)) {
        throw blockError('block_frozen', 'This block has attendance and cannot change', block.id)
      }
      if (withEvents.has(block.id)) {
        throw blockError(
          'block_has_attempts',
          'This block has check-in attempts and cannot be removed',
          block.id,
        )
      }
    }
    const ordered = this.ordered(spans)
    return {
      before: existing.map(({ id, startsAt, endsAt }) => ({ id, startsAt, endsAt })),
      removed: removed.map((b) => b.id),
      kept: ordered.flatMap((span) => (span.id ? [{ ...span, id: span.id }] : [])),
      added: ordered.filter((span) => !span.id),
    }
  }
}
