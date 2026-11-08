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
