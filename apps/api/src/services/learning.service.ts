import {
  ANALYTICS_EVENTS,
  type ArtefactContentView,
  type ArtefactProgressView,
  type CourseProgressView,
  computeLessonStates,
  type EnrollmentDetail,
  gradeQuiz,
  type LessonContentView,
  type ProgressUpdate,
  type ProgressUpdateResult,
  type QuizAnswers,
  type QuizAttemptStart,
  type QuizAttemptSummary,
  type QuizSubmitResult,
  stripAnswers,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, asc, eq } from 'drizzle-orm'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'
import { recordAudit, trackEvent } from './audit.service'
import { quizFromRow } from './courses.service'
import { MediaService } from './media.service'

type EnrollmentGraph = NonNullable<Awaited<ReturnType<LearningService['loadGraph']>>>

const progressView = (
  row: typeof s.artefactProgress.$inferSelect | undefined,
): ArtefactProgressView => ({
  status: row?.status ?? 'not_started',
  positionSeconds: row?.positionSeconds ?? 0,
  completedAt: row?.completedAt?.toISOString() ?? null,
})

export class LearningService {
  private readonly media: MediaService
  constructor(private readonly deps: Deps) {
    this.media = new MediaService(deps)
  }

  /** Loads an active enrollment with its course graph and the learner's progress rows. */
  private async loadGraph(user: SessionUser, enrollmentId: string) {
    const enrollment = await this.deps.db.query.enrollments.findFirst({
      where: eq(s.enrollments.id, enrollmentId),
      with: {
        course: {
          with: {
            thumbnail: true,
            teacher: { with: { teacherProfile: true } },
            lessons: {
              orderBy: [asc(s.lessons.position), asc(s.lessons.createdAt)],
              with: {
                prerequisites: true,
                artefacts: {
                  orderBy: [asc(s.artefacts.position), asc(s.artefacts.createdAt)],
                  with: { media: true, quiz: true },
                },
              },
            },
          },
        },
        progress: true,
        attempts: true,
        certificate: true,
      },
    })
    if (!enrollment || enrollment.userId !== user.id) throw errors.notFound('Enrollment')
    if (enrollment.status !== 'active') throw errors.forbidden('This enrollment is not active')
    return enrollment
  }

  private states(enrollment: EnrollmentGraph) {
    return computeLessonStates(
      enrollment.course.lessons.map((l) => ({
        id: l.id,
        position: l.position,
        artefactIds: l.artefacts.map((a) => a.id),
        prerequisiteIds: l.prerequisites.map((p) => p.prerequisiteLessonId),
      })),
      enrollment.progress.map((p) => ({
        artefactId: p.artefactId,
        status: p.status,
        positionSeconds: p.positionSeconds,
        updatedAt: p.updatedAt,
      })),
    )
  }

  private progressView(enrollment: EnrollmentGraph): CourseProgressView {
    const st = this.states(enrollment)
    return {
      percent: st.percent,
      completedLessons: st.completedLessons,
      totalLessons: st.totalLessons,
      isComplete: st.isComplete,
      resume: st.resume,
    }
  }

  async detail(user: SessionUser, enrollmentId: string): Promise<EnrollmentDetail> {
    const enrollment = await this.loadGraph(user, enrollmentId)
    const st = this.states(enrollment)
    const byLesson = new Map(st.lessons.map((l) => [l.id, l]))
    const byArtefact = new Map(enrollment.progress.map((p) => [p.artefactId, p]))
    const titles = new Map(enrollment.course.lessons.map((l) => [l.id, l.title]))
    return {
      id: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt?.toISOString() ?? null,
      completedAt: enrollment.completedAt?.toISOString() ?? null,
      course: {
        id: enrollment.course.id,
        slug: enrollment.course.slug,
        title: enrollment.course.title,
        thumbnailUrl: await this.media.publicUrl(enrollment.course.thumbnail),
        teacherName:
          enrollment.course.teacher.teacherProfile?.displayName ??
          enrollment.course.teacher.name ??
          'Elevate teacher',
      },
      lessons: enrollment.course.lessons.map((l) => {
        const state = byLesson.get(l.id)
        return {
          id: l.id,
          title: l.title,
          summary: l.summary,
          position: l.position,
          prerequisiteIds: l.prerequisites.map((p) => p.prerequisiteLessonId),
          status: state?.status ?? 'available',
          percent: state?.percent ?? 0,
          blockedBy: (state?.blockedBy ?? []).map((id) => titles.get(id) ?? 'another lesson'),
          artefacts: l.artefacts.map((a) => ({
            id: a.id,
            type: a.type,
            title: a.title,
            durationSeconds: a.durationSeconds ?? a.media?.durationSeconds ?? null,
            progress: progressView(byArtefact.get(a.id)),
          })),
        }
      }),
      progress: {
        percent: st.percent,
        completedLessons: st.completedLessons,
        totalLessons: st.totalLessons,
        isComplete: st.isComplete,
        resume: st.resume,
      },
      certificateId: enrollment.certificate?.id ?? null,
    }
  }

  async lessonContent(
    user: SessionUser,
    enrollmentId: string,
    lessonId: string,
  ): Promise<LessonContentView> {
    const enrollment = await this.loadGraph(user, enrollmentId)
    const lessons = enrollment.course.lessons
    const index = lessons.findIndex((l) => l.id === lessonId)
    const lesson = lessons[index]
    if (!lesson) throw errors.notFound('Lesson')
    const st = this.states(enrollment)
    const state = st.lessons.find((l) => l.id === lessonId)
    if (state?.status === 'locked') {
      const titles = new Map(lessons.map((l) => [l.id, l.title]))
      throw new (await import('../lib/errors')).HttpError(
        403,
        'lesson_locked',
        `Finish ${state.blockedBy.map((id) => titles.get(id) ?? 'the previous lesson').join(' and ')} first`,
        {
          blockedBy: state.blockedBy,
        },
      )
    }
    const byArtefact = new Map(enrollment.progress.map((p) => [p.artefactId, p]))
    const artefacts: ArtefactContentView[] = []
    for (const a of lesson.artefacts) {
      const base = {
        id: a.id,
        type: a.type,
        title: a.title,
        durationSeconds: a.durationSeconds ?? a.media?.durationSeconds ?? null,
        progress: progressView(byArtefact.get(a.id)),
      }
      if (a.type === 'text')
        artefacts.push({ ...base, type: 'text', content: a.contentJson ?? null })
      else if (a.type === 'quiz') {
        const quiz = a.quiz ? quizFromRow(a.quiz) : null
        artefacts.push({
          ...base,
          type: 'quiz',
          quizId: a.quiz?.id ?? null,
          quiz: quiz?.questions.length ? stripAnswers(quiz) : null,
          attempts: this.attemptSummary(enrollment, a.quiz?.id ?? null, quiz?.maxAttempts ?? 1),
        })
      } else {
        let playback = null
        if (a.media?.status === 'ready') {
          try {
            playback = await this.media.playbackFor(a.media)
          } catch {
            playback = null
          }
        }
        artefacts.push({ ...base, type: a.type, playback, mediaStatus: a.media?.status ?? null })
      }
    }
    const neighbour = (i: number) => {
      const l = lessons[i]
      if (!l) return null
      return {
        lessonId: l.id,
        title: l.title,
        status: st.lessons.find((x) => x.id === l.id)?.status ?? 'available',
      }
    }
    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        position: lesson.position,
      },
      course: {
        id: enrollment.course.id,
        slug: enrollment.course.slug,
        title: enrollment.course.title,
      },
      artefacts,
      previous: neighbour(index - 1),
      next: neighbour(index + 1),
    }
  }

  private attemptSummary(
    enrollment: EnrollmentGraph,
    quizId: string | null,
    max: number,
  ): QuizAttemptSummary {
    const attempts = quizId ? enrollment.attempts.filter((x) => x.quizId === quizId) : []
    const submitted = attempts.filter((x) => x.submittedAt)
    const now = this.deps.now()
    const open = attempts.find((x) => !x.submittedAt && (!x.expiresAt || x.expiresAt > now))
    return {
      used: submitted.length,
      max,
      bestScore: submitted.length ? Math.max(...submitted.map((x) => x.scorePercent ?? 0)) : null,
      passed: submitted.some((x) => x.passed),
      open: open
        ? {
            id: open.id,
            startedAt: open.startedAt.toISOString(),
            expiresAt: open.expiresAt?.toISOString() ?? null,
          }
        : null,
    }
  }

  /** Progress is monotonic: a completed artefact stays completed; positions always update. */
  async updateProgress(
    user: SessionUser,
    enrollmentId: string,
    artefactId: string,
    input: ProgressUpdate,
  ): Promise<ProgressUpdateResult> {
    const enrollment = await this.loadGraph(user, enrollmentId)
    const lesson = enrollment.course.lessons.find((l) =>
      l.artefacts.some((a) => a.id === artefactId),
    )
    const artefact = lesson?.artefacts.find((a) => a.id === artefactId)
    if (!lesson || !artefact) throw errors.notFound('Artefact')
    const st = this.states(enrollment)
    if (st.lessons.find((l) => l.id === lesson.id)?.status === 'locked')
      throw errors.forbidden('This lesson is locked')
    if (artefact.type === 'quiz' && input.status === 'completed')
      throw errors.badRequest('quiz_completion', 'Quizzes are completed by passing them')

    const existing = enrollment.progress.find((p) => p.artefactId === artefactId)
    const now = this.deps.now()
    const status =
      existing?.status === 'completed'
        ? 'completed'
        : (input.status ??
          (existing?.status === 'not_started' || !existing ? 'in_progress' : existing.status))
    const values = {
      status,
      positionSeconds: input.positionSeconds ?? existing?.positionSeconds ?? 0,
      completedAt: status === 'completed' ? (existing?.completedAt ?? now) : null,
      updatedAt: now,
    }
    const [row] = await this.deps.db
      .insert(s.artefactProgress)
      .values({ enrollmentId, artefactId, ...values })
      .onConflictDoUpdate({
        target: [s.artefactProgress.enrollmentId, s.artefactProgress.artefactId],
        set: values,
      })
      .returning()
    if (!existing)
      await trackEvent(this.deps, {
        userId: user.id,
        name: ANALYTICS_EVENTS.lessonStarted,
        properties: { courseId: enrollment.courseId, lessonId: lesson.id },
      })
    const progress = await this.recomputeCompletion(user, enrollmentId)
    return { artefact: progressView(row), progress }
  }

  async startAttempt(
    user: SessionUser,
    enrollmentId: string,
    quizId: string,
  ): Promise<QuizAttemptStart> {
    const enrollment = await this.loadGraph(user, enrollmentId)
    const lesson = enrollment.course.lessons.find((l) =>
      l.artefacts.some((a) => a.quiz?.id === quizId),
    )
    const artefact = lesson?.artefacts.find((a) => a.quiz?.id === quizId)
    if (!lesson || !artefact?.quiz) throw errors.notFound('Quiz')
    const st = this.states(enrollment)
    if (st.lessons.find((l) => l.id === lesson.id)?.status === 'locked')
      throw errors.forbidden('This lesson is locked')
    const quiz = quizFromRow(artefact.quiz)
    if (!quiz.questions.length)
      throw errors.conflict('quiz_empty', 'This quiz has no questions yet')
    const summary = this.attemptSummary(enrollment, quizId, quiz.maxAttempts)
    if (summary.passed) throw errors.conflict('already_passed', 'You have already passed this quiz')
    if (summary.open) return { attempt: summary.open, quiz: stripAnswers(quiz) }
    if (summary.used >= quiz.maxAttempts)
      throw errors.conflict('no_attempts_left', 'You have used all attempts for this quiz')
    const now = this.deps.now()
    const expiresAt = quiz.timeLimitMinutes
      ? new Date(now.getTime() + quiz.timeLimitMinutes * 60_000)
      : null
    const [attempt] = await this.deps.db
      .insert(s.quizAttempts)
      .values({ enrollmentId, quizId, startedAt: now, expiresAt })
      .returning()
    if (!attempt) throw new Error('failed to start attempt')
    return {
      attempt: {
        id: attempt.id,
        startedAt: attempt.startedAt.toISOString(),
        expiresAt: attempt.expiresAt?.toISOString() ?? null,
      },
      quiz: stripAnswers(quiz),
    }
  }

  async submitAttempt(
    user: SessionUser,
    enrollmentId: string,
    quizId: string,
    attemptId: string,
    answers: QuizAnswers,
  ): Promise<QuizSubmitResult> {
    const enrollment = await this.loadGraph(user, enrollmentId)
    const artefact = enrollment.course.lessons
      .flatMap((l) => l.artefacts)
      .find((a) => a.quiz?.id === quizId)
    if (!artefact?.quiz) throw errors.notFound('Quiz')
    const attempt = enrollment.attempts.find((x) => x.id === attemptId && x.quizId === quizId)
    if (!attempt) throw errors.notFound('Attempt')
    if (attempt.submittedAt)
      throw errors.conflict('already_submitted', 'This attempt was already submitted')
    const now = this.deps.now()
    const quiz = quizFromRow(artefact.quiz)
    const expired = !!attempt.expiresAt && attempt.expiresAt.getTime() + 15_000 < now.getTime()
    const grade = expired
      ? { ...gradeQuiz(quiz, {}), scorePercent: 0, passed: false, correctCount: 0 }
      : gradeQuiz(quiz, answers)

    await this.deps.db
      .update(s.quizAttempts)
      .set({
        answersJson: answers,
        scorePercent: grade.scorePercent,
        passed: grade.passed,
        submittedAt: now,
      })
      .where(eq(s.quizAttempts.id, attemptId))
    if (grade.passed) {
      await this.deps.db
        .insert(s.artefactProgress)
        .values({
          enrollmentId,
          artefactId: artefact.id,
          status: 'completed',
          positionSeconds: 0,
          completedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [s.artefactProgress.enrollmentId, s.artefactProgress.artefactId],
          set: { status: 'completed', completedAt: now, updatedAt: now },
        })
    } else {
      await this.deps.db
        .insert(s.artefactProgress)
        .values({
          enrollmentId,
          artefactId: artefact.id,
          status: 'in_progress',
          positionSeconds: 0,
          updatedAt: now,
        })
        .onConflictDoNothing()
    }
    await trackEvent(this.deps, {
      userId: user.id,
      name: ANALYTICS_EVENTS.quizSubmitted,
      properties: {
        courseId: enrollment.courseId,
        quizId,
        score: grade.scorePercent,
        passed: grade.passed,
        expired,
      },
    })
    const progress = await this.recomputeCompletion(user, enrollmentId)
    const used = enrollment.attempts.filter((x) => x.quizId === quizId && x.submittedAt).length + 1
    if (expired)
      throw new (await import('../lib/errors')).HttpError(
        409,
        'attempt_expired',
        'Time ran out for this attempt',
        { attemptsRemaining: Math.max(0, quiz.maxAttempts - used) },
      )
    return {
      grade,
      passed: grade.passed,
      attemptsRemaining: grade.passed ? 0 : Math.max(0, quiz.maxAttempts - used),
      progress,
    }
  }

  /** Marks the enrollment complete the first time every lesson (and every quiz) is done. */
  async recomputeCompletion(user: SessionUser, enrollmentId: string): Promise<CourseProgressView> {
    const enrollment = await this.loadGraph(user, enrollmentId)
    const view = this.progressView(enrollment)
    if (view.isComplete && !enrollment.completedAt) {
      const now = this.deps.now()
      await this.deps.db
        .update(s.enrollments)
        .set({ completedAt: now })
        .where(and(eq(s.enrollments.id, enrollmentId), eq(s.enrollments.userId, user.id)))
      await trackEvent(this.deps, {
        userId: user.id,
        name: ANALYTICS_EVENTS.courseCompleted,
        properties: { courseId: enrollment.courseId },
      })
      await recordAudit(this.deps, {
        actorId: user.id,
        action: 'enrollment.completed',
        entityType: 'enrollment',
        entityId: enrollmentId,
      })
      await this.onCompleted?.(enrollmentId)
    }
    return view
  }

  /** Hook for certificate issuance (set by the certificates service). */
  onCompleted: ((enrollmentId: string) => Promise<void>) | null = null
}
