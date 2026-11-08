import { ANALYTICS_EVENTS, type CourseSummary, type CourseView } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'
import { recordAudit, trackEvent } from './audit.service'
import { CoursesService } from './courses.service'

/** Support-side course review. Approval here is the only way a course becomes live. */
export class ReviewService {
  private readonly courses: CoursesService
  constructor(private readonly deps: Deps) {
    this.courses = new CoursesService(deps)
  }

  async queue(): Promise<CourseSummary[]> {
    return this.courses.listSummaries(eq(s.courses.status, 'pending_review'), 'submitted')
  }

  async all(status?: 'draft' | 'pending_review' | 'live' | 'rejected'): Promise<CourseSummary[]> {
    return this.courses.listSummaries(status ? eq(s.courses.status, status) : undefined)
  }

  async view(courseId: string): Promise<CourseView> {
    return this.courses.loadCourseView(courseId)
  }

  async approve(actor: SessionUser, courseId: string): Promise<CourseView> {
    const { db, env, mailer } = this.deps
    const course = await db.query.courses.findFirst({
      where: eq(s.courses.id, courseId),
      with: { teacher: { with: { teacherProfile: true } } },
    })
    if (!course) throw errors.notFound('Course')
    if (course.status !== 'pending_review')
      throw errors.conflict('not_pending', 'Only courses under review can be approved')
    const now = this.deps.now()
    await db
      .update(s.courses)
      .set({
        status: 'live',
        reviewedAt: now,
        reviewedBy: actor.id,
        publishedAt: course.publishedAt ?? now,
        rejectionReason: null,
      })
      .where(eq(s.courses.id, courseId))
    await recordAudit(this.deps, {
      actorId: actor.id,
      action: 'course.approve',
      entityType: 'course',
      entityId: courseId,
    })
    await trackEvent(this.deps, {
      userId: course.teacherId,
      name: ANALYTICS_EVENTS.courseApproved,
      properties: { courseId },
    })
    await mailer.send(
      simpleEmail({
        to: course.teacher.email,
        title: `"${course.title}" is live on Elevate`,
        paragraphs: [
          `Good news, ${course.teacher.teacherProfile?.displayName ?? 'there'}: your course passed review and is now listed for learners.`,
          'Share the course page to start enrolments. Earnings appear in Elevate Teach as learners pay.',
        ],
        cta: { href: `${env.LEARNER_URL}/course/${course.slug}`, label: 'View course page' },
      }),
    )
    return this.courses.loadCourseView(courseId)
  }

  async reject(actor: SessionUser, courseId: string, reason: string): Promise<CourseView> {
    const { db, env, mailer } = this.deps
    const course = await db.query.courses.findFirst({
      where: eq(s.courses.id, courseId),
      with: { teacher: { with: { teacherProfile: true } } },
    })
    if (!course) throw errors.notFound('Course')
    if (course.status !== 'pending_review')
      throw errors.conflict('not_pending', 'Only courses under review can be rejected')
    await db
      .update(s.courses)
      .set({
        status: 'rejected',
        reviewedAt: this.deps.now(),
        reviewedBy: actor.id,
        rejectionReason: reason,
      })
      .where(eq(s.courses.id, courseId))
    await recordAudit(this.deps, {
      actorId: actor.id,
      action: 'course.reject',
      entityType: 'course',
      entityId: courseId,
      metadata: { reason },
    })
    await trackEvent(this.deps, {
      userId: course.teacherId,
      name: ANALYTICS_EVENTS.courseRejected,
      properties: { courseId },
    })
    await mailer.send(
      simpleEmail({
        to: course.teacher.email,
        title: `Changes requested for "${course.title}"`,
        paragraphs: [
          `Our reviewer could not approve the course yet. Their note:`,
          reason,
          'Make the changes in Elevate Teach and submit again; most courses are approved on the second pass.',
        ],
        cta: { href: `${env.TEACH_URL}/courses/${course.id}`, label: 'Open the course builder' },
      }),
    )
    return this.courses.loadCourseView(courseId)
  }
}
