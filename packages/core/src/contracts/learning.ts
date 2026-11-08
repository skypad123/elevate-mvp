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
