import { z } from 'zod'
import { quizAnswersSchema } from '../domain/quiz'

export const progressUpdateSchema = z.object({
  status: z.enum(['in_progress', 'completed']).optional(),
  positionSeconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .optional(),
})
export type ProgressUpdate = z.infer<typeof progressUpdateSchema>

export const quizSubmitSchema = z.object({ answers: quizAnswersSchema })
export type QuizSubmit = z.infer<typeof quizSubmitSchema>

export type EnrollmentSummary = {
  id: string
  status: 'pending_payment' | 'active' | 'refunded' | 'cancelled'
  enrolledAt: string | null
  completedAt: string | null
  course: import('./catalog').CourseCard
  progress: { completedArtefacts: number; totalArtefacts: number; percent: number }
  certificateId: string | null
  lastActivityAt: string | null
}

// ── Player ──────────────────────────────────────────────────────────────────
import type { LessonStatus, ProgressStatus, ResumeTarget } from '../domain/lesson-state'
import type { LearnerQuiz, QuizGrade } from '../domain/quiz'
import type { RichTextDoc } from '../domain/richtext'
import type { SyllabusArtefact, SyllabusLesson } from './catalog'
import type { PlaybackInfo } from './media'

export type ArtefactProgressView = {
  status: ProgressStatus
  positionSeconds: number
  completedAt: string | null
}

export type LessonProgressView = Omit<SyllabusLesson, 'artefacts'> & {
  status: LessonStatus
  percent: number
  /** Titles of incomplete prerequisite lessons. */
  blockedBy: string[]
  artefacts: Array<SyllabusArtefact & { progress: ArtefactProgressView }>
}

export type CourseProgressView = {
  percent: number
  completedLessons: number
  totalLessons: number
  isComplete: boolean
  resume: ResumeTarget | null
}

export type EnrollmentDetail = {
  id: string
  status: 'pending_payment' | 'active' | 'refunded' | 'cancelled'
  enrolledAt: string | null
  completedAt: string | null
  course: {
    id: string
    slug: string
    title: string
    thumbnailUrl: string | null
    teacherName: string
  }
  lessons: LessonProgressView[]
  progress: CourseProgressView
  certificateId: string | null
}

export type QuizAttemptSummary = {
  used: number
  max: number
  bestScore: number | null
  passed: boolean
  open: { id: string; startedAt: string; expiresAt: string | null } | null
}

export type ArtefactContentView = SyllabusArtefact & { progress: ArtefactProgressView } & (
    | { type: 'text'; content: RichTextDoc | null }
    | {
        type: 'video' | 'audio'
        playback: PlaybackInfo | null
        mediaStatus: 'pending' | 'processing' | 'ready' | 'errored' | null
      }
    | {
        type: 'quiz'
        quiz: LearnerQuiz | null
        quizId: string | null
        attempts: QuizAttemptSummary
      }
  )

export type LessonContentView = {
  lesson: { id: string; title: string; summary: string | null; position: number }
  course: { id: string; slug: string; title: string }
  artefacts: ArtefactContentView[]
  previous: { lessonId: string; title: string; status: LessonStatus } | null
  next: { lessonId: string; title: string; status: LessonStatus } | null
}

export type QuizAttemptStart = {
  attempt: { id: string; startedAt: string; expiresAt: string | null }
  quiz: LearnerQuiz
}

export type QuizSubmitResult = {
  grade: QuizGrade
  passed: boolean
  attemptsRemaining: number
  progress: CourseProgressView
}

export type ProgressUpdateResult = { artefact: ArtefactProgressView; progress: CourseProgressView }
