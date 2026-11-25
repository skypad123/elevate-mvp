import {
  ATTEMPTS_SUMMARY_WINDOW_MS,
  type AttendanceActorRole,
  type AttendanceEventType,
  type AttendanceStateView,
  attemptsLeft,
  attendanceState,
  type CheckIn,
  type CheckInContext,
  type CheckInMethod,
  type CheckInResult,
  CODE_PERIOD_MS,
  CODES_PER_ANSWER,
  type CodeView,
  can,
  canCheckIn,
  canDecide,
  canDispute,
  canManualMark,
  canOverturn,
  checkInWindow,
  checkInWindowStatus,
  codePeriod,
  DISPUTE_WINDOW_MS,
  type Dispute,
  type DisputeDecisionInput,
  type DisputeView,
  distanceMeters,
  type LearnerClass,
  locationStatus,
  lockedUntil,
  type ManualMark,
  type ManualMarkReasonCode,
  type ManualMarkView,
  type Overturn,
  type OverturnReasonCode,
  REFUSAL_REASONS,
  type RefusalReason,
  type RosterRow,
  type RosterView,
  type SupportClass,
  type SupportClassBlock,
  type SupportClassSearch,
  type SupportClassSummary,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, desc, eq, exists, ilike, or, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { codesFor, matchCode, periodStartMs, qrSvg } from '../lib/class-code'
import { errors, HttpError } from '../lib/errors'
import type { ProfileActor, SessionUser } from '../middleware/auth'
import { recordAudit } from './audit.service'
import {
  type AttendanceEventRow,
  blockView,
  type ClassBlockRow,
  ClassesService,
  type ClassRow,
  isAssignedInstructor,
  nameOf,
  toFacts,
} from './classes.service'

type EventInsert = typeof s.attendanceEvents.$inferInsert
type Reading = { lat: number; lng: number; accuracyM: number }
type EnrollmentRow = typeof s.enrollments.$inferSelect
type UserRef = { id: string; name: string | null; email: string }

const FROZEN_BY: readonly string[] = ['check_in', 'manual_mark']

const iso = (date: Date | null | undefined) => date?.toISOString() ?? null

const byTime = (a: AttendanceEventRow, b: AttendanceEventRow) =>
  a.createdAt.getTime() - b.createdAt.getTime()

/** The latest event of a type, of events already in time order. */
const latest = (events: readonly AttendanceEventRow[], type: AttendanceEventType) =>
  events.filter((e) => e.type === type).at(-1)

/** The manual mark a learner's state rests on, with its sub-state; null unless marked by hand. */
function manualMarkView(
  events: readonly AttendanceEventRow[],
  state: AttendanceStateView,
): ManualMarkView | null {
  if (state.state !== 'marked_by_hand' || !state.subState || !state.disputeUntil) return null
  const mark = latest(events, 'manual_mark')
  if (!mark) return null
  return {
    eventId: mark.id,
    reasonCode: mark.reasonCode as ManualMarkReasonCode,
    reason: mark.reason,
    markedAt: mark.createdAt.toISOString(),
    subState: state.subState,
    disputeUntil: state.disputeUntil.toISOString(),
  }
}

function roleOf(actor: ProfileActor): AttendanceActorRole {
  // Staff never hold `attendance.take` or `attendance.review`, so never reach a write.
  if (actor.role === 'staff') throw errors.forbidden()
  return actor.role
}

/**
 * The attendance record (docs/designs/scheduled-classes-attendance.md): check-in, the roster and
 * its corrections, disputes, and Support's read-only view.
 *
 * This is the only file that inserts into `attendance_events` and `attendance_event_locations`,
 * and nothing anywhere updates or deletes an attendance row (the API's database user cannot).
 * Every row's `createdAt` is `deps.now()`, the clock every window, lockout and code period reads.
 */
export class AttendanceService {
  private readonly classes: ClassesService

  constructor(private readonly deps: Deps) {
    this.classes = new ClassesService(deps)
  }

  // ── learner ──────────────────────────────────────────────────────────────

  /**
   * The block and the learner's active class enrollment for its class. No enrollment answers 404,
   * the same as an unknown block.
   */
  private async learnerBlock(user: SessionUser, blockId: string) {
    const { db } = this.deps
    const block = await db.query.classBlocks.findFirst({
      where: { id: blockId },
      with: { class: true },
    })
    if (!block) throw errors.notFound('Class')
    const enrollment = await db.query.enrollments.findFirst({
      where: { userId: user.id, classId: block.classId, status: 'active' },
    })
    if (!enrollment) throw errors.notFound('Class')
    return { block, classRow: block.class, enrollment }
  }

  /** One learner's events for one block, oldest first. */
  private async eventsOf(blockId: string, enrollmentId: string, tx = this.deps.db) {
    const rows = await tx.query.attendanceEvents.findMany({
      where: { blockId, enrollmentId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.sort(byTime)
  }

  async checkInContext(user: SessionUser, blockId: string): Promise<CheckInContext> {
    const { block, classRow, enrollment } = await this.learnerBlock(user, blockId)
    const events = await this.eventsOf(block.id, enrollment.id)
    const { opensAt, closesAt } = checkInWindow(block)
    return {
      blockId: block.id,
      enrollmentId: enrollment.id,
      className: classRow.name,
      startsAt: block.startsAt.toISOString(),
      endsAt: block.endsAt.toISOString(),
      timeZone: classRow.timeZone,
      asksLocation: classRow.delivery === 'in_person',
      checkInOpensAt: opensAt.toISOString(),
      checkInClosesAt: closesAt.toISOString(),
      state: attendanceState(events.map(toFacts), this.deps.now()).state,
    }
  }

  /** The location columns of an event and, for a reading at an in-person class, its coordinates. */
  private locationFields(
    classRow: ClassRow,
    sent: CheckIn['location'],
    { strict }: { strict: boolean },
  ): { fields: Partial<EventInsert>; reading: Reading | null } {
    if (classRow.delivery === 'remote') {
      // A remote class needs no location; a reading sent anyway is not kept.
      return { fields: { locationStatus: 'not_required' }, reading: null }
    }
    if ('status' in sent) return { fields: { locationStatus: sent.status }, reading: null }
    const venue =
      classRow.venueLat !== null && classRow.venueLng !== null && classRow.venueAccuracyM !== null
        ? {
            lat: classRow.venueLat,
            lng: classRow.venueLng,
            accuracyM: classRow.venueAccuracyM,
            radiusM: classRow.venueRadiusM,
          }
        : null
    // A refused attempt can come before the venue is set; it keeps the reading without a status.
    // A check-in cannot (no code is shown until then), and `locationStatus` throws if it does.
    if (!venue && !strict) {
      return { fields: { accuracyM: sent.accuracyM }, reading: sent }
    }
    const status = locationStatus({ delivery: classRow.delivery, venue, sent })
    return {
      fields: {
        locationStatus: status,
        accuracyM: sent.accuracyM,
        distanceM: venue ? distanceMeters(sent, venue) : null,
        venueLat: venue?.lat ?? null,
        venueLng: venue?.lng ?? null,
        venueAccuracyM: venue?.accuracyM ?? null,
        venueRadiusM: venue?.radiusM ?? null,
      },
      reading: sent,
    }
  }

  /**
   * Inserts one event, and its coordinates when a reading was sent, in one transaction. A
   * check-in that loses a race with another for the same block and enrollment inserts nothing and
   * returns null.
   */
  private async insertEvent(values: EventInsert, reading: Reading | null) {
    return this.deps.db.transaction(async (tx) => {
      const [event] = await tx
        .insert(s.attendanceEvents)
        .values(values)
        .onConflictDoNothing()
        .returning()
      if (event && reading) {
        await tx.insert(s.attendanceEventLocations).values({
          eventId: event.id,
          lat: reading.lat,
          lng: reading.lng,
          createdAt: values.createdAt,
        })
      }
      return event ?? null
    })
  }

  /**
   * Check-in, in the eight steps of the design. Steps 1 to 3 store nothing; 4 to 6 store a refused
   * attempt; 7 and 8 store the check-in. Every attempt writes one log line, with no coordinates.
   */
  async checkIn(
    user: SessionUser,
    blockId: string,
    input: CheckIn,
    requestId: string,
  ): Promise<CheckInResult> {
    const now = this.deps.now()
    // 1. The learner's active class enrollment for the block's class, else 404.
    const { block, classRow, enrollment } = await this.learnerBlock(user, blockId)
    const events = await this.eventsOf(block.id, enrollment.id)
    const facts = events.map(toFacts)
    const log = (outcome: 'check_in' | 'refused' | 'repeat', reason: string | null) =>
      this.deps.log.info('class check-in', {
        requestId,
        classId: classRow.id,
        blockId: block.id,
        learnerUserId: enrollment.userId,
        outcome,
        reason,
      })

    // 2. Already present: answer with the state, store nothing. 3. Overturned: refuse.
    const allowed = canCheckIn(facts)
    if (allowed === 'repeat') {
      log('repeat', null)
      return this.checkInResult(events, now)
    }
    if (allowed === 'overturned') {
      log('refused', 'check_in_overturned')
      throw new HttpError(
        409,
        'check_in_overturned',
        'Your check-in for this class was overturned. Speak to your instructor.',
      )
    }

    const base: EventInsert = {
      classId: classRow.id,
      blockId: block.id,
      enrollmentId: enrollment.id,
      learnerUserId: enrollment.userId,
      type: 'attempt_refused',
      actorUserId: user.id,
      actorRole: 'learner',
      method: input.method,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
      clientTime: input.clientTime ? new Date(input.clientTime) : null,
      requestId,
      createdAt: now,
    }
    const refuse = async (reason: RefusalReason) => {
      const { fields, reading } = this.locationFields(classRow, input.location, { strict: false })
      const stored = await this.insertEvent(
        { ...base, ...fields, type: 'attempt_refused', refusalReason: reason },
        reading,
      )
      log('refused', reason)
      return stored
    }

    // 4. The window.
    const window = checkInWindowStatus(block, now)
    const { opensAt, closesAt } = checkInWindow(block)
    if (window === 'not_open_yet') {
      await refuse('not_open_yet')
      throw new HttpError(409, 'check_in_not_open', 'Check-in for this class is not open yet.', {
        opensAt: opensAt.toISOString(),
      })
    }
    if (window === 'closed') {
      await refuse('closed')
      throw new HttpError(409, 'check_in_closed', 'Check-in for this class has closed.', {
        closesAt: closesAt.toISOString(),
      })
    }

    // 5. The lockout.
    const locked = lockedUntil(facts, now)
    if (locked) {
      await refuse('too_many_attempts')
      throw new HttpError(
        429,
        'check_in_locked',
        'Too many wrong codes. Try again in a few minutes.',
        { lockedUntil: locked.toISOString() },
      )
    }

    // 6. The code.
    const match = matchCode(block.codeSecret, input.code, now)
    if (match.kind === 'none' || match.kind === 'expired') {
      const reason = match.kind === 'none' ? 'code_wrong' : 'code_expired'
      const stored = await refuse(reason)
      const left = attemptsLeft(stored ? [...facts, toFacts(stored)] : facts, now)
      throw match.kind === 'none'
        ? new HttpError(
            422,
            'check_in_code_wrong',
            'That code is not right. Type the code showing now.',
            { attemptsLeft: left },
          )
        : new HttpError(
            422,
            'check_in_code_expired',
            'That code has expired. Type the code showing now.',
            { attemptsLeft: left },
          )
    }

    // 7. The location status. 8. One check-in event, and its coordinates, in one transaction.
    const { fields, reading } = this.locationFields(classRow, input.location, { strict: true })
    const stored = await this.insertEvent(
      { ...base, ...fields, type: 'check_in', codePeriod: match.period },
      reading,
    )
    log(stored ? 'check_in' : 'repeat', (fields.locationStatus as string | undefined) ?? null)
    return this.checkInResult(
      stored ? [...events, stored] : await this.eventsOf(block.id, enrollment.id),
      now,
    )
  }

  private checkInResult(events: AttendanceEventRow[], now: Date): CheckInResult {
    const state = attendanceState(events.map(toFacts), now)
    const checkIn = latest(events, 'check_in')
    const mark = latest(events, 'manual_mark')
    const at = state.state === 'marked_by_hand' ? mark?.createdAt : checkIn?.createdAt
    return { state: state.state, flagReason: state.flagReason, checkedInAt: iso(at) }
  }

  /** The learner's class enrollments, each with its class, blocks and the learner's own state. */
  async listForLearner(user: SessionUser): Promise<LearnerClass[]> {
    const { db } = this.deps
    const enrollments = await db.query.enrollments.findMany({
      where: { userId: user.id, classId: { isNotNull: true }, status: 'active' },
      orderBy: { createdAt: 'desc' },
      with: {
        class: {
          with: {
            course: { columns: { title: true } },
            blocks: { orderBy: { position: 'asc' } },
          },
        },
        attendanceEvents: { orderBy: { createdAt: 'asc' } },
      },
    })
    const now = this.deps.now()
    return enrollments.flatMap((enrollment) => {
      const c = enrollment.class
      if (!c) return []
      return [
        {
          enrollmentId: enrollment.id,
          class: {
            id: c.id,
            name: c.name,
            courseTitle: c.course.title,
            delivery: c.delivery,
            venueAddress: c.venueAddress,
            timeZone: c.timeZone,
          },
          blocks: c.blocks.map((block) => {
            const events = enrollment.attendanceEvents
              .filter((e) => e.blockId === block.id)
              .sort(byTime)
            const state = attendanceState(events.map(toFacts), now)
            const checkIn = latest(events, 'check_in')
            const overturn = checkIn
              ? events.find((e) => e.type === 'overturn' && e.refersToEventId === checkIn.id)
              : undefined
            return {
              id: block.id,
              startsAt: block.startsAt.toISOString(),
              endsAt: block.endsAt.toISOString(),
              checkInOpen: checkInWindowStatus(block, now) === 'open',
              state: state.state,
              flagReason: state.flagReason,
              manualMark: manualMarkView(events, state),
              overturn: overturn
                ? {
                    reasonCode: overturn.reasonCode as OverturnReasonCode,
                    at: overturn.createdAt.toISOString(),
                  }
                : null,
            }
          }),
        },
      ]
    })
  }

  /** Disputes the learner's own standing manual mark, within 7 days of it. */
  async dispute(
    user: SessionUser,
    eventId: string,
    input: Dispute,
    requestId: string,
  ): Promise<LearnerClass> {
    const { db } = this.deps
    const mark = await db.query.attendanceEvents.findFirst({
      where: { id: eventId, type: 'manual_mark', learnerUserId: user.id },
      with: { enrollment: { columns: { userId: true, classId: true, status: true } } },
    })
    if (!mark || mark.enrollment.userId !== user.id || mark.enrollment.status !== 'active') {
      throw errors.notFound('Mark')
    }
    const now = this.deps.now()
    await this.underLock(mark.enrollmentId, async (tx) => {
      const events = await this.eventsOf(mark.blockId, mark.enrollmentId, tx)
      const allowed = canDispute(events.map(toFacts), mark.id, now)
      if (allowed === 'not_found') throw errors.notFound('Mark')
      if (allowed === 'dispute_window_closed') {
        throw new HttpError(409, 'dispute_window_closed', 'The time to dispute this has passed.', {
          disputeUntil: new Date(mark.createdAt.getTime() + DISPUTE_WINDOW_MS).toISOString(),
        })
      }
      if (allowed === 'already_disputed') {
        throw new HttpError(409, 'already_disputed', 'You have already disputed this.')
      }
      await tx.insert(s.attendanceEvents).values({
        classId: mark.classId,
        blockId: mark.blockId,
        enrollmentId: mark.enrollmentId,
        learnerUserId: mark.learnerUserId,
        type: 'dispute',
        actorUserId: user.id,
        actorRole: 'learner',
        reason: input.reason,
        refersToEventId: mark.id,
        requestId,
        createdAt: now,
      })
    })
    this.deps.log.info('class mark disputed', {
      requestId,
      classId: mark.classId,
      blockId: mark.blockId,
      learnerUserId: mark.learnerUserId,
    })
    const mine = await this.listForLearner(user)
    const updated = mine.find((c) => c.enrollmentId === mark.enrollmentId)
    if (!updated) throw errors.notFound('Mark')
    return updated
  }

  /**
   * Runs `fn` in a transaction that first locks the enrollment row, so two corrections of one
   * learner run one after the other and each sees the other's row.
   */
  private async underLock<T>(enrollmentId: string, fn: (tx: Deps['db']) => Promise<T>): Promise<T> {
    return this.deps.db.transaction(async (tx) => {
      await tx
        .select({ id: s.enrollments.id })
        .from(s.enrollments)
        .where(eq(s.enrollments.id, enrollmentId))
        .for('update')
      return fn(tx as unknown as Deps['db'])
    })
  }

  // ── Teach: the roster ────────────────────────────────────────────────────

  private async blockOf(classRow: ClassRow, blockId: string): Promise<ClassBlockRow> {
    const block = await this.deps.db.query.classBlocks.findFirst({
      where: { id: blockId, classId: classRow.id },
    })
    if (!block) throw errors.notFound('Block')
    return block
  }

  private async classEnrollment(classRow: ClassRow, enrollmentId: string) {
    const enrollment = await this.deps.db.query.enrollments.findFirst({
      where: { id: enrollmentId, classId: classRow.id, status: 'active' },
    })
    if (!enrollment) throw errors.notFound('Learner')
    return enrollment
  }

  /** Each active class learner's row for one block. Never coordinates. */
  private async rosterRows(classRow: ClassRow, block: ClassBlockRow) {
    const { db } = this.deps
    const now = this.deps.now()
    const [enrollments, events] = await Promise.all([
      db.query.enrollments.findMany({
        where: { classId: classRow.id, status: 'active' },
        with: { user: { columns: { id: true, name: true, email: true } } },
      }),
      db.query.attendanceEvents.findMany({
        where: { blockId: block.id },
        orderBy: { createdAt: 'asc' },
      }),
    ])
    const rows = enrollments.map((enrollment) => {
      const own = events.filter((e) => e.enrollmentId === enrollment.id).sort(byTime)
      return { enrollment, events: own, row: this.rosterRow(enrollment, own, now) }
    })
    rows.sort((a, b) => a.row.learner.displayName.localeCompare(b.row.learner.displayName))
    return {
      rows,
      frozen: events.some((e) => FROZEN_BY.includes(e.type)),
    }
  }

  private rosterRow(
    enrollment: EnrollmentRow & { user: UserRef },
    events: AttendanceEventRow[],
    now: Date,
  ): RosterRow {
    const facts = events.map(toFacts)
    const state = attendanceState(facts, now)
    const checkIn = latest(events, 'check_in')
    const refusal = latest(events, 'attempt_refused')
    return {
      enrollmentId: enrollment.id,
      learner: {
        userId: enrollment.user.id,
        displayName: nameOf(enrollment.user),
        email: enrollment.user.email,
      },
      state: state.state,
      flagReason: state.flagReason,
      distanceM: checkIn?.distanceM ?? null,
      accuracyM: checkIn?.accuracyM ?? null,
      checkedInAt: iso(checkIn?.createdAt),
      method: (checkIn?.method as CheckInMethod | undefined) ?? null,
      lastRefusal: refusal
        ? { reason: refusal.refusalReason as RefusalReason, at: refusal.createdAt.toISOString() }
        : null,
      lockedUntil: iso(lockedUntil(facts, now)),
      manualMark: manualMarkView(events, state),
    }
  }

  private async rosterView(classRow: ClassRow, block: ClassBlockRow): Promise<RosterView> {
    const { rows, frozen } = await this.rosterRows(classRow, block)
    return {
      block: blockView(block, frozen, !rows.some((r) => r.events.length > 0)),
      serverTime: this.deps.now().toISOString(),
      venueSet: classRow.venueSetAt !== null,
      learners: rows.map((r) => r.row),
    }
  }

  /** Anyone with `attendance.read`, and the assigned instructor; for anyone else, not found. */
  async roster(actor: ProfileActor, classId: string, blockId: string): Promise<RosterView> {
    const classRow = await this.classes.load(actor, classId)
    if (!this.canRead(actor, classRow)) throw errors.notFound('Class')
    return this.rosterView(classRow, await this.blockOf(classRow, blockId))
  }

  private canRead(actor: ProfileActor, classRow: ClassRow): boolean {
    return can(actor, 'attendance.read') || isAssignedInstructor(actor, classRow)
  }

  /** The instructor's class, block and, when given, class learner; 403 for anyone else. */
  private async instructorTarget(
    actor: ProfileActor,
    classId: string,
    blockId: string,
    enrollmentId?: string,
  ) {
    const classRow = await this.classes.load(actor, classId)
    if (!isAssignedInstructor(actor, classRow)) throw errors.forbidden()
    const block = await this.blockOf(classRow, blockId)
    const enrollment = enrollmentId ? await this.classEnrollment(classRow, enrollmentId) : null
    return { classRow, block, enrollment }
  }

  /** The current period's code and the next two, each with its QR image and timing. */
  async codes(actor: ProfileActor, classId: string, blockId: string): Promise<CodeView> {
    const { classRow, block } = await this.instructorTarget(actor, classId, blockId)
    if (classRow.delivery === 'in_person' && classRow.venueSetAt === null) {
      throw errors.conflict(
        'venue_not_set',
        'Set the venue location before showing the code for an in-person class',
      )
    }
    const now = this.deps.now().getTime()
    const current = codePeriod(now)
    const codes: CodeView['codes'] = []
    for (let i = 0; i < CODES_PER_ANSWER; i++) {
      const period = current + i
      const { typed, link } = codesFor(block.codeSecret, period)
      const url = `${this.deps.env.LEARNER_URL}/class/check-in/${block.id}?c=${link}`
      codes.push({
        typed,
        qrSvg: await qrSvg(url),
        startsInMs: Math.max(0, periodStartMs(period) - now),
        endsInMs: periodStartMs(period) + CODE_PERIOD_MS - now,
      })
    }
    return { codes, checkInClosesAt: checkInWindow(block).closesAt.toISOString() }
  }

  /** Overturns a standing check-in that carries a location flag. The check-in row is unchanged. */
  async overturn(
    actor: ProfileActor,
    classId: string,
    blockId: string,
    enrollmentId: string,
    input: Overturn,
    requestId: string,
  ): Promise<RosterView> {
    const { classRow, block, enrollment } = await this.instructorTarget(
      actor,
      classId,
      blockId,
      enrollmentId,
    )
    if (!enrollment) throw errors.notFound('Learner')
    const now = this.deps.now()
    const event = await this.underLock(enrollment.id, async (tx) => {
      const events = await this.eventsOf(block.id, enrollment.id, tx)
      const allowed = canOverturn(events.map(toFacts), now)
      if (allowed === 'no_check_in') {
        throw errors.conflict('no_check_in', 'This learner has no check-in to overturn')
      }
      if (allowed === 'not_flagged') {
        throw errors.conflict('not_flagged', 'Only a flagged check-in can be overturned')
      }
      const checkIn = latest(events, 'check_in')
      if (!checkIn) throw new Error('a standing check-in disappeared')
      const [row] = await tx
        .insert(s.attendanceEvents)
        .values({
          ...this.correctionBase(actor, classRow, block, enrollment, requestId, now),
          type: 'overturn',
          reasonCode: input.reasonCode,
          reason: input.reason || null,
          refersToEventId: checkIn.id,
        })
        .returning()
      return row
    })
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'attendance.overturned',
      entityType: 'attendance_event',
      entityId: event?.id ?? null,
      profileId: actor.profileId,
      metadata: { classId: classRow.id, blockId: block.id, enrollmentId: enrollment.id },
    })
    return this.rosterView(classRow, block)
  }

  /** Marks a learner present by hand, with the reason and the type of document checked. */
  async manualMark(
    actor: ProfileActor,
    classId: string,
    blockId: string,
    enrollmentId: string,
    input: ManualMark,
    requestId: string,
  ): Promise<RosterView> {
    const { classRow, block, enrollment } = await this.instructorTarget(
      actor,
      classId,
      blockId,
      enrollmentId,
    )
    if (!enrollment) throw errors.notFound('Learner')
    const now = this.deps.now()
    const event = await this.underLock(enrollment.id, async (tx) => {
      const events = await this.eventsOf(block.id, enrollment.id, tx)
      if (canManualMark(events.map(toFacts), now) !== true) {
        throw errors.conflict('already_present', 'This learner is already present')
      }
      const [row] = await tx
        .insert(s.attendanceEvents)
        .values({
          ...this.correctionBase(actor, classRow, block, enrollment, requestId, now),
          type: 'manual_mark',
          reasonCode: input.reasonCode,
          reason: input.reason || null,
          idDocumentType: input.idDocumentType,
        })
        .returning()
      return row
    })
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'attendance.manual_marked',
      entityType: 'attendance_event',
      entityId: event?.id ?? null,
      profileId: actor.profileId,
      metadata: { classId: classRow.id, blockId: block.id, enrollmentId: enrollment.id },
    })
    return this.rosterView(classRow, block)
  }

  private correctionBase(
    actor: ProfileActor,
    classRow: ClassRow,
    block: ClassBlockRow,
    enrollment: EnrollmentRow,
    requestId: string,
    now: Date,
  ) {
    return {
      classId: classRow.id,
      blockId: block.id,
      enrollmentId: enrollment.id,
      learnerUserId: enrollment.userId,
      actorUserId: actor.userId,
      actorRole: roleOf(actor),
      requestId,
      createdAt: now,
    }
  }

  // ── Teach: disputes ──────────────────────────────────────────────────────

  private async disputeViews(classId: string, disputeId?: string): Promise<DisputeView[]> {
    const { db } = this.deps
    const disputes = await db.query.attendanceEvents.findMany({
      where: { classId, type: 'dispute', ...(disputeId ? { id: disputeId } : {}) },
      orderBy: { createdAt: 'desc' },
      with: { learner: { columns: { name: true, email: true } } },
    })
    if (disputes.length === 0) return []
    const related = await db.query.attendanceEvents.findMany({
      where: { classId, type: { in: ['manual_mark', 'dispute_decision'] } },
      with: { actor: { columns: { name: true, email: true } } },
    })
    const views = disputes.flatMap((dispute): DisputeView[] => {
      const mark = related.find((e) => e.id === dispute.refersToEventId)
      if (!mark) return []
      const decision = related.find(
        (e) => e.type === 'dispute_decision' && e.refersToEventId === dispute.id,
      )
      return [
        {
          disputeEventId: dispute.id,
          markEventId: mark.id,
          blockId: dispute.blockId,
          learnerName: nameOf(dispute.learner),
          markReasonCode: mark.reasonCode as ManualMarkReasonCode,
          markReason: mark.reason,
          markedByName: nameOf(mark.actor),
          markedAt: mark.createdAt.toISOString(),
          disputeReason: dispute.reason ?? '',
          disputedAt: dispute.createdAt.toISOString(),
          decision: decision
            ? {
                decision: decision.decision as 'upheld' | 'voided',
                reason: decision.reason ?? '',
                decidedByName: nameOf(decision.actor),
                decidedAt: decision.createdAt.toISOString(),
              }
            : null,
        },
      ]
    })
    // Open disputes first, newest first within each group.
    return [...views.filter((v) => !v.decision), ...views.filter((v) => v.decision)]
  }

  async disputes(actor: ProfileActor, classId: string): Promise<DisputeView[]> {
    const classRow = await this.classes.load(actor, classId)
    return this.disputeViews(classRow.id)
  }

  /** Upholds or voids a dispute that has no decision yet. */
  async decideDispute(
    actor: ProfileActor,
    classId: string,
    disputeEventId: string,
    input: DisputeDecisionInput,
    requestId: string,
  ): Promise<DisputeView> {
    const { db } = this.deps
    const classRow = await this.classes.load(actor, classId)
    const dispute = await db.query.attendanceEvents.findFirst({
      where: { id: disputeEventId, classId: classRow.id, type: 'dispute' },
    })
    if (!dispute) throw errors.notFound('Dispute')
    const now = this.deps.now()
    const event = await this.underLock(dispute.enrollmentId, async (tx) => {
      const events = await this.eventsOf(dispute.blockId, dispute.enrollmentId, tx)
      const allowed = canDecide(events.map(toFacts), dispute.id, now)
      if (allowed === 'not_found') throw errors.notFound('Dispute')
      if (allowed === 'dispute_already_decided') {
        throw errors.conflict('dispute_already_decided', 'This dispute has been decided already')
      }
      const [row] = await tx
        .insert(s.attendanceEvents)
        .values({
          classId: dispute.classId,
          blockId: dispute.blockId,
          enrollmentId: dispute.enrollmentId,
          learnerUserId: dispute.learnerUserId,
          type: 'dispute_decision',
          actorUserId: actor.userId,
          actorRole: roleOf(actor),
          decision: input.decision,
          reason: input.reason,
          refersToEventId: dispute.id,
          requestId,
          createdAt: now,
        })
        .returning()
      return row
    })
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'attendance.dispute_decided',
      entityType: 'attendance_event',
      entityId: event?.id ?? null,
      profileId: actor.profileId,
      metadata: { classId: classRow.id, disputeEventId: dispute.id, decision: input.decision },
    })
    const [view] = await this.disputeViews(classRow.id, dispute.id)
    if (!view) throw errors.notFound('Dispute')
    return view
  }

  // ── Support: read only ───────────────────────────────────────────────────

  /** Classes whose name, profile name or a learner's address contains the query. */
  async supportSearch(query: SupportClassSearch): Promise<SupportClassSummary[]> {
    const { db } = this.deps
    const like = `%${query.q.replace(/[%_\\]/g, '\\$&')}%`
    const rows = await db
      .select({ id: s.classes.id, profileId: s.profiles.id, profileName: s.profiles.displayName })
      .from(s.classes)
      .innerJoin(s.profiles, eq(s.profiles.id, s.classes.profileId))
      .where(
        or(
          ilike(s.classes.name, like),
          ilike(s.profiles.displayName, like),
          exists(
            db
              .select({ one: sql`1` })
              .from(s.enrollments)
              .innerJoin(s.users, eq(s.users.id, s.enrollments.userId))
              .where(
                and(
                  eq(s.enrollments.classId, s.classes.id),
                  ilike(sql`${s.users.email}::text`, like),
                ),
              ),
          ),
        ),
      )
      .orderBy(desc(s.classes.createdAt), desc(s.classes.id))
      .limit(query.limit)
    const summaries = await this.classes.summaries(rows.map((r) => r.id))
    return rows.flatMap((r) => {
      const summary = summaries.get(r.id)
      return summary
        ? [{ ...summary, profile: { id: r.profileId, displayName: r.profileName } }]
        : []
    })
  }

  async supportClass(id: string): Promise<SupportClass> {
    const row = await this.deps.db.query.classes.findFirst({
      where: { id },
      with: { profile: { columns: { id: true, displayName: true } } },
    })
    if (!row) throw errors.notFound('Class')
    return { ...(await this.classes.detail(row.id, false)), profile: row.profile }
  }

  /**
   * One block as Support reads it: attempts by reason over the last 15 minutes, and each learner's
   * roster row with coordinates and every event. The coordinates are those of the learner's
   * check-in, else of their latest refused attempt: `'erased'` when that event has an accuracy and
   * no location row, null when it sent no reading.
   */
  async supportBlock(classId: string, blockId: string): Promise<SupportClassBlock> {
    const { db } = this.deps
    const classView = await this.supportClass(classId)
    const classRow = await db.query.classes.findFirst({ where: { id: classView.id } })
    if (!classRow) throw errors.notFound('Class')
    const block = await this.blockOf(classRow, blockId)
    const { rows, frozen } = await this.rosterRows(classRow, block)
    const eventIds = rows.flatMap((r) => r.events.map((e) => e.id))
    const [locations, actors] = await Promise.all([
      eventIds.length
        ? db.query.attendanceEventLocations.findMany({ where: { eventId: { in: eventIds } } })
        : Promise.resolve([]),
      db.query.attendanceEvents.findMany({
        where: { blockId: block.id },
        columns: { id: true },
        with: { actor: { columns: { name: true, email: true } } },
      }),
    ])
    const locationOf = new Map(locations.map((l) => [l.eventId, l]))
    const actorOf = new Map(actors.map((a) => [a.id, nameOf(a.actor)]))

    const since = this.deps.now().getTime() - ATTEMPTS_SUMMARY_WINDOW_MS
    const attemptsByReason = Object.fromEntries(REFUSAL_REASONS.map((r) => [r, 0])) as Record<
      RefusalReason,
      number
    >
    for (const { events } of rows) {
      for (const e of events) {
        if (e.type !== 'attempt_refused' || e.createdAt.getTime() < since) continue
        const reason = e.refusalReason as RefusalReason
        if (reason in attemptsByReason) attemptsByReason[reason]++
      }
    }

    return {
      class: classView,
      block: blockView(block, frozen, !rows.some((r) => r.events.length > 0)),
      attemptsByReason,
      learners: rows.map(({ row, events }) => {
        const source = latest(events, 'check_in') ?? latest(events, 'attempt_refused')
        const location = source ? locationOf.get(source.id) : undefined
        const coordinates: SupportClassBlock['learners'][number]['coordinates'] = location
          ? { lat: location.lat, lng: location.lng }
          : source?.accuracyM !== null && source?.accuracyM !== undefined
            ? 'erased'
            : null
        return {
          ...row,
          coordinates,
          events: events.map((e) => ({
            type: e.type as AttendanceEventType,
            at: e.createdAt.toISOString(),
            actorName: actorOf.get(e.id) ?? '',
            reasonCode: e.reasonCode ?? e.refusalReason,
            reason: e.reason,
            decision: e.decision ?? null,
          })),
        }
      }),
    }
  }
}
