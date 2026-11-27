import {
  type AttendanceEventFacts,
  attendanceState,
  type CancelClass,
  type ClassDetail,
  canMove,
  type ElevateCancelClass,
  type ElevateCancelReason,
  type LearnerClass,
  type LearnerSeat,
  type MoneyAttendance,
  type MoveSeat,
  type MoveTarget,
  moneyAttendance,
  type SeatRefundRequest,
  type SeatView,
  seatRefund,
  seatsLeft,
  UNFINISHED_SEAT_REFUND_STATUSES,
  withdrawal,
  withdrawalClosesAt,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, eq, gt, inArray } from 'drizzle-orm'
import type { Deps } from '../deps'
import {
  classCancelledAttendedEmail,
  classCancelledMarkOpenEmail,
  seatMovedEmail,
} from '../emails/class-sales'
import { simpleEmail } from '../emails/templates'
import { errors, HttpError } from '../lib/errors'
import type { ProfileActor, SessionUser } from '../middleware/auth'
import { AttendanceService, NO_ATTENDANCE } from './attendance.service'
import { recordAudit } from './audit.service'
import { seatsTaken } from './class-checkout.service'
import {
  type AttendanceEventRow,
  ClassesService,
  type ClassRow,
  isAssignedInstructor,
  nameOf,
  toFacts,
} from './classes.service'
import { SeatRefundsService, seatRefundView, type Tx } from './seat-refunds.service'

type EnrollmentRow = typeof s.enrollments.$inferSelect
type PaymentRow = typeof s.payments.$inferSelect

/** The grounds for Elevate's cancellation, as the profile's owner reads them. */
const GROUND_FOR_OWNER: Record<ElevateCancelReason, string> = {
  teacher_absent: 'the teacher did not turn up, or cannot teach the class',
  venue_unavailable: 'the venue is unsafe or cannot be used',
  rules_breach: "the profile broke Elevate's rules or acted dishonestly",
  profile_suspended: 'the profile is suspended',
  required_by_law: 'Elevate is required to by law',
}

const isCancelled = (row: Pick<ClassRow, 'status' | 'cancelledAt'>) =>
  row.status === 'cancelled' || row.cancelledAt !== null

const conflict = (code: string, message: string, details?: unknown) =>
  new HttpError(409, code, message, details)

const classCancelled = () => conflict('class_cancelled', 'This class was cancelled')
const classReleased = () =>
  conflict('class_released', 'The money for this class has been released to the profile')
const seatNotActive = () => conflict('seat_not_active', 'This learner does not hold a seat')
const noPayment = () =>
  conflict('seat_has_no_payment', 'This seat was not paid for, so there is nothing to refund.')
const inProgress = () =>
  conflict('refund_in_progress', 'A refund for this seat is already on its way.')

/** The payment that bought the seat: the one the enrollment's session points at. */
async function seatPayment(
  tx: Tx,
  enrollment: Pick<EnrollmentRow, 'id' | 'stripeCheckoutSessionId'>,
): Promise<PaymentRow | null> {
  if (!enrollment.stripeCheckoutSessionId) return null
  const [payment] = await tx
    .select()
    .from(s.payments)
    .where(
      and(
        eq(s.payments.enrollmentId, enrollment.id),
        eq(s.payments.stripeCheckoutSessionId, enrollment.stripeCheckoutSessionId),
      ),
    )
  return payment ?? null
}

/** Locks a class row; every method here locks the class before any enrollment row. */
async function lockClass(tx: Tx, classId: string) {
  const [row] = await tx.select().from(s.classes).where(eq(s.classes.id, classId)).for('update')
  if (!row) throw errors.notFound('Class')
  return row
}

async function lockEnrollment(tx: Tx, enrollmentId: string) {
  const [row] = await tx
    .select()
    .from(s.enrollments)
    .where(eq(s.enrollments.id, enrollmentId))
    .for('update')
  return row ?? null
}

const firstStartOf = (blocks: readonly { startsAt: Date }[]) =>
  blocks.length ? new Date(Math.min(...blocks.map((b) => b.startsAt.getTime()))) : null

/** What a cancellation tells learners itself, after the commit; the rest hear when refunded. */
type CancelNotice = {
  enrollmentId: string
  userId: string
  kind: 'attended' | 'mark_open'
  disputeUntil: Date | null
}

/**
 * Seats (docs/designs/scheduled-classes-selling.md, "Withdrawing, moving, changing a block and
 * cancelling"): a learner withdrawing, the profile moving a learner, a discretionary refund, and
 * a cancellation by the profile or by Elevate. Each is a seat rule plus a refund request, written
 * in one transaction that locks the class row before any enrollment row, always in that order.
 * None calls Stripe to move money: the rows written here are sent by the release job.
 *
 * With `class-checkout.service.ts`, this is the only file that sets an enrollment's class: a
 * move re-points the enrollment, and its payment, at the target class.
 */
export class SeatsService {
  private readonly classes: ClassesService
  private readonly refunds: SeatRefundsService

  constructor(private readonly deps: Deps) {
    this.classes = new ClassesService(deps)
    this.refunds = new SeatRefundsService(deps)
  }

  private attendanceOf(tx: Tx, classId: string): Promise<Map<string, MoneyAttendance>> {
    return new AttendanceService(this.deps).moneyAttendanceByEnrollment(tx, classId)
  }

  // ── Teach ────────────────────────────────────────────────────────────────

  /** `GET classes/:id/seats`: every seat that was bought, with its money and what can be done. */
  async list(actor: ProfileActor, classId: string): Promise<SeatView[]> {
    const { db } = this.deps
    const row = await this.classes.load(actor, classId)
    const enrollments = await db.query.enrollments.findMany({
      where: { classId: row.id, status: { in: ['active', 'refunded', 'cancelled'] } },
      with: { user: { columns: { name: true, email: true } } },
    })
    if (enrollments.length === 0) return []
    const attendance = await this.attendanceOf(db, row.id)
    const rows = await db.query.seatRefunds.findMany({
      where: { enrollmentId: { in: enrollments.map((e) => e.id) } },
      orderBy: { createdAt: 'asc' },
    })
    const closed = isCancelled(row) || row.releasedAt !== null
    const out: SeatView[] = []
    for (const enrollment of enrollments) {
      const payment = await seatPayment(db, enrollment)
      const a = attendance.get(enrollment.id) ?? NO_ATTENDANCE
      const refunds = rows.filter((r) => r.enrollmentId === enrollment.id)
      const unfinished = refunds.some((r) =>
        (UNFINISHED_SEAT_REFUND_STATUSES as readonly string[]).includes(r.status),
      )
      const open = enrollment.status === 'active' && !!payment && !unfinished
      const disputeOpen = payment?.bankDisputeStatus === 'open'
      const refundable =
        open && !disputeOpen && payment?.releasedAt === null && row.releasedAt === null
      out.push({
        enrollmentId: enrollment.id,
        learner: { displayName: nameOf(enrollment.user), email: enrollment.user.email },
        status: enrollment.status,
        paidAt: payment?.paidAt.toISOString() ?? null,
        paidCents: payment?.amountCents ?? 0,
        refundedCents: payment?.refundedCents ?? 0,
        counted: a.counted,
        openMarkUntil: a.openMarkUntil?.toISOString() ?? null,
        movedAt: enrollment.movedAt?.toISOString() ?? null,
        classChangedAt: enrollment.classChangedAt?.toISOString() ?? null,
        bankDisputeStatus: payment?.bankDisputeStatus ?? null,
        released: payment?.releasedAt != null,
        refunds: refunds.map(seatRefundView),
        canRefundUpToCents:
          refundable && payment
            ? Math.max(0, payment.amountCents - (await this.refunds.hadBackCents(db, payment.id)))
            : 0,
        canMove: open && !closed && !disputeOpen && !a.counted && a.openMarkUntil === null,
      })
    }
    return out.sort((x, y) => x.learner.displayName.localeCompare(y.learner.displayName))
  }

  /**
   * `GET classes/:id/learners/:enrollmentId/move-targets`: the profile's other published classes
   * of the course, each with the move problems `canMove` finds; an empty list means allowed.
   */
  async moveTargets(
    actor: ProfileActor,
    classId: string,
    enrollmentId: string,
  ): Promise<MoveTarget[]> {
    const { db } = this.deps
    const now = this.deps.now()
    const row = await this.classes.load(actor, classId)
    const enrollment = await db.query.enrollments.findFirst({
      where: { id: enrollmentId, classId: row.id },
    })
    if (!enrollment) throw errors.notFound('Learner')
    const payment = await seatPayment(db, enrollment)
    const a = (await this.attendanceOf(db, row.id)).get(enrollment.id) ?? NO_ATTENDANCE
    const unfinished = await this.refunds.unfinishedFor(db, enrollment.id)
    const targets = await db.query.classes.findMany({
      where: {
        profileId: row.profileId,
        courseId: row.courseId,
        status: 'published',
        cancelledAt: { isNull: true },
        id: { ne: row.id },
      },
      with: { blocks: { columns: { startsAt: true, endsAt: true } } },
    })
    const out: MoveTarget[] = []
    for (const target of targets) {
      const first = firstStartOf(target.blocks)
      if (!first) continue
      const left = seatsLeft(target.seats, await seatsTaken(db, target.id, now))
      const inTarget = await db.query.enrollments.findFirst({
        where: { userId: enrollment.userId, classId: target.id },
        columns: { id: true },
      })
      const result = canMove({
        attendance: a,
        hasUnfinishedRefund: unfinished !== null,
        bankDisputeOpen: payment?.bankDisputeStatus === 'open',
        sameCourse: true,
        target: { ...target, seatsLeft: left },
        paidAt: payment?.paidAt ?? now,
        hasEnrollmentInTarget: !!inTarget,
        now,
      })
      out.push({
        classId: target.id,
        className: target.name,
        firstBlockStartsAt: first.toISOString(),
        seatsLeft: left,
        problems: result === true ? [] : result,
      })
    }
    return out.sort((x, y) => x.firstBlockStartsAt.localeCompare(y.firstBlockStartsAt))
  }

  /**
   * `POST classes/:id/learners/:enrollmentId/move`. In one transaction that locks both class rows
   * in id order, the enrollment and its payment are pointed at the target, and the move columns
   * and `classChangedAt` are set: the learner may now withdraw in full until the new class starts.
   * The learner is emailed after the commit.
   */
  async move(
    actor: ProfileActor,
    classId: string,
    enrollmentId: string,
    input: MoveSeat,
  ): Promise<SeatView> {
    const { db } = this.deps
    const row = await this.classes.load(actor, classId)
    if (isCancelled(row)) throw classCancelled()
    if (row.releasedAt) throw classReleased()
    const target = await db.query.classes.findFirst({
      where: { id: input.toClassId, profileId: actor.profileId },
      columns: { id: true },
    })
    if (!target) throw errors.notFound('Class')
    const now = this.deps.now()
    const moved = await db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const locked = new Map<string, ClassRow>()
      for (const id of [...new Set([row.id, target.id])].sort()) {
        locked.set(id, await lockClass(tx, id))
      }
      const from = locked.get(row.id) as ClassRow
      const to = locked.get(target.id) as ClassRow
      if (isCancelled(from)) throw classCancelled()
      const enrollment = await lockEnrollment(tx, enrollmentId)
      if (!enrollment || enrollment.classId !== row.id) throw errors.notFound('Learner')
      if (enrollment.status !== 'active') throw seatNotActive()
      const payment = await seatPayment(tx, enrollment)
      if (!payment) throw noPayment()
      if (payment.releasedAt) throw classReleased()
      const a = (await this.attendanceOf(tx, row.id)).get(enrollment.id) ?? NO_ATTENDANCE
      const unfinished = await this.refunds.unfinishedFor(tx, enrollment.id)
      const blocks = await tx
        .select({ startsAt: s.classBlocks.startsAt, endsAt: s.classBlocks.endsAt })
        .from(s.classBlocks)
        .where(eq(s.classBlocks.classId, to.id))
      const [inTarget] = await tx
        .select({ id: s.enrollments.id })
        .from(s.enrollments)
        .where(and(eq(s.enrollments.userId, enrollment.userId), eq(s.enrollments.classId, to.id)))
        .limit(1)
      const result = canMove({
        attendance: a,
        hasUnfinishedRefund: unfinished !== null,
        bankDisputeOpen: payment.bankDisputeStatus === 'open',
        sameCourse: to.courseId === from.courseId && to.profileId === from.profileId,
        target: {
          status: to.status,
          cancelledAt: to.cancelledAt,
          blocks,
          seatsLeft: seatsLeft(to.seats, await seatsTaken(tx, to.id, now)),
        },
        paidAt: payment.paidAt,
        hasEnrollmentInTarget: !!inTarget,
        now,
      })
      if (result !== true) {
        throw errors.unprocessable('move_not_allowed', 'This learner cannot be moved there', {
          problems: result,
        })
      }
      await tx
        .update(s.enrollments)
        .set({
          classId: to.id,
          movedAt: now,
          movedBy: actor.userId,
          movedFromClassId: from.id,
          classChangedAt: now,
        })
        .where(eq(s.enrollments.id, enrollment.id))
      await tx.update(s.payments).set({ classId: to.id }).where(eq(s.payments.id, payment.id))
      return { enrollment, from, to, blocks }
    })
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'class.learner_moved',
      entityType: 'enrollment',
      entityId: enrollmentId,
      profileId: actor.profileId,
      metadata: { fromClassId: moved.from.id, toClassId: moved.to.id },
    })
    const [learner, course] = await Promise.all([
      db.query.users.findFirst({
        where: { id: moved.enrollment.userId },
        columns: { email: true, locale: true },
      }),
      db.query.courses.findFirst({ where: { id: moved.to.courseId }, columns: { title: true } }),
    ])
    if (learner) {
      await this.deps.mailer.send(
        seatMovedEmail({
          to: learner.email,
          locale: learner.locale ?? 'en',
          learnerUrl: this.deps.env.LEARNER_URL,
          enrollmentId,
          fromClass: moved.from.name,
          courseTitle: course?.title ?? '',
          class: { ...moved.to, blocks: moved.blocks },
        }),
      )
    }
    return this.seatIn(actor, moved.to.id, enrollmentId)
  }

  /**
   * `POST classes/:id/learners/:enrollmentId/refund`: a discretionary refund of any amount up to
   * what the learner paid and has not had back (unfinished rows count as had back), until the
   * payment is released. The learner keeps the seat.
   */
  async refund(
    actor: ProfileActor,
    classId: string,
    enrollmentId: string,
    input: SeatRefundRequest,
  ): Promise<SeatView> {
    const { db } = this.deps
    const row = await this.classes.load(actor, classId)
    if (row.releasedAt) throw classReleased()
    await db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      await lockClass(tx, row.id)
      const enrollment = await lockEnrollment(tx, enrollmentId)
      if (!enrollment || enrollment.classId !== row.id) throw errors.notFound('Learner')
      if (enrollment.status !== 'active') throw seatNotActive()
      const payment = await seatPayment(tx, enrollment)
      if (!payment) throw noPayment()
      if (payment.releasedAt) throw classReleased()
      if (await this.refunds.unfinishedFor(tx, enrollment.id)) throw inProgress()
      if (payment.bankDisputeStatus === 'open') {
        throw conflict('bank_dispute_open', 'The learner has opened a bank dispute on this payment')
      }
      const maxCents = Math.max(
        0,
        payment.amountCents - (await this.refunds.hadBackCents(tx, payment.id)),
      )
      if (input.amountCents > maxCents) {
        throw errors.unprocessable(
          'refund_too_large',
          'That is more than the learner paid and has not had back',
          { maxCents },
        )
      }
      await this.refunds.request(tx, {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
        classId: row.id,
        kind: 'discretionary',
        requestedCents: input.amountCents,
        reason: input.reason,
        requestedBy: actor.userId,
        waitingFor: payment.stripeFeeActualCents === null ? 'stripe_fee' : undefined,
      })
    })
    return this.seatIn(actor, row.id, enrollmentId)
  }

  /** `POST classes/:id/cancel`, by the profile's owner or a manager, at any time before release. */
  async cancelClass(
    actor: ProfileActor,
    classId: string,
    input: CancelClass,
  ): Promise<ClassDetail> {
    const row = await this.classes.load(actor, classId)
    if (row.releasedAt) throw classReleased()
    await this.cancel(row, { actorId: actor.userId, reason: input.reason, ground: null })
    return this.classes.detail(row.id, isAssignedInstructor(actor, row))
  }

  /**
   * `POST /support/classes/:id/cancel`, by a Support admin, on one of the grounds (G17). Every
   * active seat gets an `elevate_cancelled` row, whether or not the learner attended (R4), and the
   * profile's owner is emailed the ground and the note. A released class can still be cancelled.
   */
  async cancelClassByElevate(
    user: SessionUser,
    classId: string,
    input: ElevateCancelClass,
  ): Promise<void> {
    const { db, env, mailer } = this.deps
    const row = await db.query.classes.findFirst({
      where: { id: classId },
      with: {
        course: { columns: { title: true } },
        profile: { with: { owner: { columns: { email: true } } } },
      },
    })
    if (!row) throw errors.notFound('Class')
    await this.cancel(row, { actorId: user.id, reason: input.note, ground: input.ground })
    await mailer.send(
      simpleEmail({
        to: row.profile.owner.email,
        title: `Elevate cancelled "${row.name}"`,
        paragraphs: [
          `Elevate has cancelled "${row.name}", a class of "${row.course.title}" by ${row.profile.displayName}.`,
          `The ground: ${GROUND_FOR_OWNER[input.ground]}.`,
          `Elevate's note: ${input.note}`,
          'Every learner with a seat gets back what they paid. Each refund is taken back from your Stripe balance as it is made, never more than is returned to the learner.',
          'If you have questions, contact Elevate Support.',
        ],
        cta: {
          href: `${env.TEACH_URL}/p/${row.profileId}/classes/${row.id}`,
          label: 'View the class',
        },
      }),
    )
  }

  /**
   * The steps under "Cancel": in one transaction, mark the class cancelled, write its
   * cancellation, end every reservation and write a refund row for each active seat that has a
   * payment. After the commit, the payment pages of the ended reservations are expired (if that
   * fails, fulfilment still refuses the seat) and the learners whose refund is not automatic are
   * emailed.
   */
  private async cancel(
    row: ClassRow,
    how: { actorId: string; reason: string; ground: ElevateCancelReason | null },
  ): Promise<void> {
    const { db } = this.deps
    if (isCancelled(row)) throw classCancelled()
    if (row.status === 'draft') {
      throw conflict('class_not_published', 'A draft class cannot be cancelled. Delete it instead.')
    }
    const byElevate = how.ground !== null
    const now = this.deps.now()
    const done = await db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const locked = await lockClass(tx, row.id)
      if (isCancelled(locked)) throw classCancelled()
      const blocks = await tx
        .select({ startsAt: s.classBlocks.startsAt })
        .from(s.classBlocks)
        .where(eq(s.classBlocks.classId, row.id))
      const blocksTotal = blocks.length
      const blocksUntaught = blocks.filter((b) => b.startsAt.getTime() > now.getTime()).length
      const seats = await tx
        .select()
        .from(s.enrollments)
        .where(and(eq(s.enrollments.classId, row.id), eq(s.enrollments.status, 'active')))
        .for('update')
      // One unfinished row per seat: a cancellation waits for a refund already under way.
      const busy = seats.length
        ? await tx
            .select({ enrollmentId: s.seatRefunds.enrollmentId })
            .from(s.seatRefunds)
            .where(
              and(
                inArray(
                  s.seatRefunds.enrollmentId,
                  seats.map((e) => e.id),
                ),
                inArray(s.seatRefunds.status, [...UNFINISHED_SEAT_REFUND_STATUSES]),
              ),
            )
        : []
      if (busy.length) {
        throw conflict(
          'refund_in_progress',
          'A refund for a seat in this class is under way. Cancel once it is finished.',
          { enrollmentIds: busy.map((b) => b.enrollmentId) },
        )
      }
      await tx
        .update(s.classes)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          cancelledBy: how.actorId,
          cancelReason: how.reason,
          updatedAt: now,
        })
        .where(eq(s.classes.id, row.id))
      const [cancellation] = await tx
        .insert(s.classCancellations)
        .values({
          classId: row.id,
          cancelledBy: how.actorId,
          byElevate,
          reason: how.reason,
          elevateReason: how.ground,
          afterStart: blocksUntaught < blocksTotal,
          blocksTotal,
          blocksUntaught,
          createdAt: now,
        })
        .returning()
      if (!cancellation) throw new Error('failed to record the cancellation')
      const ended = await tx
        .update(s.enrollments)
        .set({ seatReservedUntil: now })
        .where(
          and(
            eq(s.enrollments.classId, row.id),
            eq(s.enrollments.status, 'pending_payment'),
            gt(s.enrollments.seatReservedUntil, now),
          ),
        )
        .returning({ sessionId: s.enrollments.stripeCheckoutSessionId })
      const attendance = await this.attendanceOf(tx, row.id)
      const notices: CancelNotice[] = []
      let written = 0
      const write = async (
        enrollment: EnrollmentRow,
        payment: PaymentRow,
        kind: 'teacher_cancelled' | 'teacher_cancelled_part' | 'elevate_cancelled',
        waitingFor?: 'manual_mark' | 'bank_dispute',
      ) => {
        await this.refunds.request(tx, {
          enrollmentId: enrollment.id,
          paymentId: payment.id,
          classId: row.id,
          kind,
          reason: how.reason,
          requestedBy: how.actorId,
          cancellationId: cancellation.id,
          waitingFor,
        })
        written++
        // A cancellation's full refund frees the seat once its row is ready to send.
        if (!waitingFor && kind !== 'teacher_cancelled_part') {
          await tx
            .update(s.enrollments)
            .set({ status: 'refunded' })
            .where(eq(s.enrollments.id, enrollment.id))
        }
      }
      for (const enrollment of seats) {
        // A seat with no payment, which only the demo seed makes, has nothing to return.
        const payment = await seatPayment(tx, enrollment)
        if (!payment) continue
        const a = attendance.get(enrollment.id) ?? NO_ATTENDANCE
        if (byElevate) {
          await write(
            enrollment,
            payment,
            'elevate_cancelled',
            payment.bankDisputeStatus === 'open' ? 'bank_dispute' : undefined,
          )
        } else if (!a.counted && a.openMarkUntil === null) {
          await write(enrollment, payment, 'teacher_cancelled')
        } else if (!a.counted) {
          await write(enrollment, payment, 'teacher_cancelled', 'manual_mark')
          notices.push({
            enrollmentId: enrollment.id,
            userId: enrollment.userId,
            kind: 'mark_open',
            disputeUntil: a.openMarkUntil,
          })
        } else if (blocksUntaught > 0) {
          await write(enrollment, payment, 'teacher_cancelled_part')
        } else {
          notices.push({
            enrollmentId: enrollment.id,
            userId: enrollment.userId,
            kind: 'attended',
            disputeUntil: null,
          })
        }
      }
      if (written === 0) {
        await tx
          .update(s.classCancellations)
          .set({ completedAt: now })
          .where(eq(s.classCancellations.id, cancellation.id))
      }
      await tx.insert(s.auditLog).values({
        actorId: how.actorId,
        action: byElevate ? 'class.cancelled_by_elevate' : 'class.cancelled',
        entityType: 'class',
        entityId: row.id,
        profileId: row.profileId,
        metadata: {
          cancellationId: cancellation.id,
          reason: how.reason,
          ground: how.ground,
          blocksTotal,
          blocksUntaught,
          refundRows: written,
          reservationsEnded: ended.length,
        },
      })
      return { ended, notices }
    })
    for (const { sessionId } of done.ended) {
      if (!sessionId) continue
      await this.deps.payments.expireCheckoutSession(sessionId).catch((error) => {
        this.deps.log.warn('could not expire a reservation ended by a cancellation', {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }
    for (const notice of done.notices) {
      const learner = await db.query.users.findFirst({
        where: { id: notice.userId },
        columns: { email: true, locale: true },
      })
      if (!learner) continue
      const base = {
        to: learner.email,
        locale: learner.locale ?? 'en',
        learnerUrl: this.deps.env.LEARNER_URL,
        enrollmentId: notice.enrollmentId,
        className: row.name,
      }
      await this.deps.mailer.send(
        notice.kind === 'mark_open' && notice.disputeUntil
          ? classCancelledMarkOpenEmail({
              ...base,
              timeZone: row.timeZone,
              disputeUntil: notice.disputeUntil,
            })
          : classCancelledAttendedEmail(base),
      )
    }
  }

  /** One seat of a class, as the Teach class page shows it. */
  private async seatIn(actor: ProfileActor, classId: string, enrollmentId: string) {
    const seat = (await this.list(actor, classId)).find((x) => x.enrollmentId === enrollmentId)
    if (!seat) throw errors.notFound('Learner')
    return seat
  }

  // ── the learner ──────────────────────────────────────────────────────────

  /**
   * `POST /me/classes/:enrollmentId/withdraw`. `withdrawal` decides the kind: in one transaction
   * the enrollment becomes `cancelled` for `learner_withdrew` or `refunded` for
   * `changed_withdrew`, which frees the seat at once, and the refund row is written. The row
   * waits for Stripe's fee when the payment has none yet.
   */
  async withdraw(user: SessionUser, enrollmentId: string): Promise<LearnerClass> {
    const { db } = this.deps
    const found = await db.query.enrollments.findFirst({
      where: { id: enrollmentId, userId: user.id, classId: { isNotNull: true } },
      columns: { classId: true },
    })
    if (!found?.classId) throw errors.notFound('Class')
    const classId = found.classId
    const now = this.deps.now()
    await db.transaction(async (raw) => {
      const tx = raw as unknown as Tx
      const cls = await lockClass(tx, classId)
      const enrollment = await lockEnrollment(tx, enrollmentId)
      if (!enrollment || enrollment.classId !== classId) throw errors.notFound('Class')
      const blocks = await tx
        .select({ startsAt: s.classBlocks.startsAt })
        .from(s.classBlocks)
        .where(eq(s.classBlocks.classId, classId))
      const first = firstStartOf(blocks) ?? now
      const payment = await seatPayment(tx, enrollment)
      const decision = withdrawal({
        enrollmentStatus: enrollment.status,
        classCancelled: isCancelled(cls),
        hasUnfinishedRefund: (await this.refunds.unfinishedFor(tx, enrollment.id)) !== null,
        hasPayment: payment !== null,
        attendance: (await this.attendanceOf(tx, classId)).get(enrollment.id) ?? NO_ATTENDANCE,
        firstBlockStartsAt: first,
        classChangedAt: enrollment.classChangedAt,
        now,
      })
      switch (decision) {
        case 'not_found':
          throw errors.notFound('Class')
        case 'class_cancelled':
          throw conflict(
            'class_cancelled',
            'This class was cancelled. Your refund is handled with the cancellation.',
          )
        case 'refund_in_progress':
          throw inProgress()
        case 'seat_has_no_payment':
          throw noPayment()
        case 'withdrawal_attended':
          throw conflict(
            'withdrawal_attended',
            "You have attended this class, so a refund is the teacher's decision.",
          )
        case 'withdrawal_closed':
          throw conflict(
            'withdrawal_closed',
            'Withdrawal has closed for this class. Contact the teacher.',
            { closesAt: withdrawalClosesAt(first).toISOString() },
          )
      }
      if (!payment) throw noPayment()
      await tx
        .update(s.enrollments)
        .set({ status: decision === 'learner_withdrew' ? 'cancelled' : 'refunded' })
        .where(eq(s.enrollments.id, enrollment.id))
      await this.refunds.request(tx, {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
        classId,
        kind: decision,
        requestedBy: user.id,
        waitingFor: payment.stripeFeeActualCents === null ? 'stripe_fee' : undefined,
      })
      await tx.insert(s.auditLog).values({
        actorId: user.id,
        action: 'seat.withdrawn',
        entityType: 'enrollment',
        entityId: enrollment.id,
        profileId: cls.profileId,
        metadata: { classId, kind: decision, paymentId: payment.id },
      })
    })
    const mine = await new AttendanceService(this.deps).listForLearner(user)
    const updated = mine.find((c) => c.enrollmentId === enrollmentId)
    if (!updated) throw errors.notFound('Class')
    return updated
  }

  /**
   * The seat part of a learner's class: whether and how they can withdraw, for how much (once
   * Stripe's fee is known) and until when; a move or a changed class; the latest refund; and the
   * manual marks they can still dispute.
   */
  async learnerSeat(input: {
    enrollment: EnrollmentRow
    classRow: Pick<ClassRow, 'status' | 'cancelledAt'>
    blocks: readonly { id: string; startsAt: Date }[]
    events: readonly AttendanceEventRow[]
  }): Promise<LearnerSeat> {
    const { db } = this.deps
    const now = this.deps.now()
    const { enrollment } = input
    const payment = await seatPayment(db, enrollment)
    const rows = await db.query.seatRefunds.findMany({
      where: { enrollmentId: enrollment.id },
      orderBy: { createdAt: 'desc' },
    })
    const byBlock = new Map<string, AttendanceEventFacts[]>()
    for (const event of [...input.events].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )) {
      byBlock.set(event.blockId, [...(byBlock.get(event.blockId) ?? []), toFacts(event)])
    }
    const first = firstStartOf(input.blocks)
    const classCancelledNow = isCancelled({
      status: input.classRow.status,
      cancelledAt: input.classRow.cancelledAt,
    })
    const decision = first
      ? withdrawal({
          enrollmentStatus: enrollment.status,
          classCancelled: classCancelledNow,
          hasUnfinishedRefund: rows.some((r) =>
            (UNFINISHED_SEAT_REFUND_STATUSES as readonly string[]).includes(r.status),
          ),
          hasPayment: payment !== null,
          attendance: moneyAttendance(byBlock, now),
          firstBlockStartsAt: first,
          classChangedAt: enrollment.classChangedAt,
          now,
        })
      : null
    const kind =
      decision === 'learner_withdrew' || decision === 'changed_withdrew' ? decision : null
    const fee = payment?.stripeFeeActualCents ?? null
    return {
      withdrawKind: kind,
      withdrawRefundCents:
        kind && payment && fee !== null
          ? seatRefund({
              kind,
              amountCents: payment.amountCents,
              applicationFeeCents: payment.applicationFeeCents,
              stripeFeeCents: fee,
              refundedCents: payment.refundedCents,
              feeRefundedCents: 0,
            }).learnerRefundCents
          : null,
      withdrawClosesAt:
        kind && first
          ? (kind === 'changed_withdrew' ? first : withdrawalClosesAt(first)).toISOString()
          : null,
      movedAt: enrollment.movedAt?.toISOString() ?? null,
      classChangedAt: enrollment.classChangedAt?.toISOString() ?? null,
      classCancelled: classCancelledNow,
      refund: rows[0] ? seatRefundView(rows[0]) : null,
      openMarks: input.blocks.flatMap((block) => {
        const view = attendanceState(byBlock.get(block.id) ?? [], now)
        return view.state === 'marked_by_hand' && view.subState === 'open' && view.disputeUntil
          ? [{ blockId: block.id, disputeUntil: view.disputeUntil.toISOString() }]
          : []
      }),
    }
  }
}
