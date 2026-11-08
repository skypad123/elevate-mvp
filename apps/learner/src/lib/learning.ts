import type {
  EnrollmentDetail,
  LessonContentView,
  ProgressUpdate,
  ProgressUpdateResult,
  QuizAnswers,
  QuizAttemptStart,
  QuizSubmitResult,
} from '@elevate/core'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { unwrap } from './api-error'

export const learningKeys = {
  enrollment: (id: string) => ['learning', 'enrollment', id] as const,
  lesson: (id: string, lessonId: string) => ['learning', 'lesson', id, lessonId] as const,
}

export function useEnrollment(id: string) {
  return useQuery({
    queryKey: learningKeys.enrollment(id),
    enabled: !!id,
    queryFn: async () =>
      (await unwrap(await api.me.enrollments[':id'].$get({ param: { id } })))
        .enrollment as EnrollmentDetail,
  })
}

export function useLesson(id: string, lessonId: string) {
  return useQuery({
    queryKey: learningKeys.lesson(id, lessonId),
    enabled: !!id && !!lessonId,
    retry: false,
    queryFn: async () =>
      (
        await unwrap(
          await api.me.enrollments[':id'].lessons[':lessonId'].$get({ param: { id, lessonId } }),
        )
      ).lesson as LessonContentView,
  })
}

export async function saveProgress(
  id: string,
  artefactId: string,
  input: ProgressUpdate,
): Promise<ProgressUpdateResult> {
  return (await unwrap(
    await api.me.enrollments[':id'].artefacts[':artefactId'].progress.$post({
      param: { id, artefactId },
      json: input,
    }),
  )) as ProgressUpdateResult
}

export async function startQuiz(id: string, quizId: string): Promise<QuizAttemptStart> {
  return (await unwrap(
    await api.me.enrollments[':id'].quizzes[':quizId'].attempts.$post({ param: { id, quizId } }),
  )) as QuizAttemptStart
}

export async function submitQuiz(
  id: string,
  quizId: string,
  attemptId: string,
  answers: QuizAnswers,
): Promise<QuizSubmitResult> {
  return (await unwrap(
    await api.me.enrollments[':id'].quizzes[':quizId'].attempts[':attemptId'].submit.$post({
      param: { id, quizId, attemptId },
      json: { answers },
    }),
  )) as QuizSubmitResult
}
