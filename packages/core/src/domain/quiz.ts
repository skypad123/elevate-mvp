import { z } from 'zod'

export const quizOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1, 'Option text is required').max(500),
  correct: z.boolean(),
})

export const quizQuestionSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().trim().min(1, 'Question text is required').max(2000),
    explanation: z.string().trim().max(2000).optional(),
    options: z.array(quizOptionSchema).min(2, 'Add at least two options').max(8),
  })
  .refine((q) => q.options.filter((o) => o.correct).length === 1, {
    message: 'Mark exactly one option as correct',
    path: ['options'],
  })
  .refine((q) => new Set(q.options.map((o) => o.id)).size === q.options.length, {
    message: 'Option ids must be unique',
    path: ['options'],
  })

export const quizDefinitionSchema = z
  .object({
    passMarkPercent: z.number().int().min(1).max(100),
    maxAttempts: z.number().int().min(1).max(10).default(1),
    timeLimitMinutes: z.number().int().min(1).max(180).nullable().default(null),
    questions: z.array(quizQuestionSchema).min(1, 'Add at least one question').max(50),
  })
  .refine((q) => new Set(q.questions.map((x) => x.id)).size === q.questions.length, {
    message: 'Question ids must be unique',
    path: ['questions'],
  })

export type QuizOption = z.infer<typeof quizOptionSchema>
export type QuizQuestion = z.infer<typeof quizQuestionSchema>
export type QuizDefinition = z.infer<typeof quizDefinitionSchema>
export type QuizDefinitionInput = z.input<typeof quizDefinitionSchema>

/** What a learner is allowed to see before submitting: no `correct` flags, no explanations. */
export type LearnerQuizQuestion = {
  id: string
  prompt: string
  options: Array<{ id: string; text: string }>
}

export type LearnerQuiz = {
  passMarkPercent: number
  maxAttempts: number
  timeLimitMinutes: number | null
  questions: LearnerQuizQuestion[]
}

export function stripAnswers(quiz: QuizDefinition): LearnerQuiz {
  return {
    passMarkPercent: quiz.passMarkPercent,
    maxAttempts: quiz.maxAttempts,
    timeLimitMinutes: quiz.timeLimitMinutes,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  }
}

/** questionId → chosen optionId */
export type QuizAnswers = Record<string, string>

export const quizAnswersSchema = z.record(z.string().min(1), z.string().min(1))

export type QuizGrade = {
  scorePercent: number
  passed: boolean
  correctCount: number
  totalQuestions: number
  perQuestion: Array<{
    questionId: string
    selectedOptionId: string | null
    correctOptionId: string
    correct: boolean
    explanation?: string
  }>
}

export function gradeQuiz(quiz: QuizDefinition, answers: QuizAnswers): QuizGrade {
  const perQuestion = quiz.questions.map((q) => {
    const correctOption = q.options.find((o) => o.correct)
    const correctOptionId = correctOption ? correctOption.id : ''
    const selectedOptionId = answers[q.id] ?? null
    return {
      questionId: q.id,
      selectedOptionId,
      correctOptionId,
      correct: selectedOptionId !== null && selectedOptionId === correctOptionId,
      ...(q.explanation ? { explanation: q.explanation } : {}),
    }
  })
  const correctCount = perQuestion.filter((p) => p.correct).length
  const totalQuestions = quiz.questions.length
  const scorePercent = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0
  return {
    scorePercent,
    passed: scorePercent >= quiz.passMarkPercent,
    correctCount,
    totalQuestions,
    perQuestion,
  }
}
