import { type PrerequisiteEdge, validateDag } from './dag'
import { DEFAULT_MINIMUM_CHARGE_CENTS } from './money'

export type SubmissionArtefact = {
  id: string
  type: 'video' | 'audio' | 'text' | 'quiz'
  title: string
  mediaStatus?: 'pending' | 'processing' | 'ready' | 'errored' | null
  hasContent?: boolean
  quizQuestionCount?: number
}

export type SubmissionLesson = {
  id: string
  title: string
  artefacts: SubmissionArtefact[]
}

export type SubmissionCourse = {
  title: string
  summary: string | null
  category: string | null
  priceCents: number
  hasThumbnail: boolean
  hasDescription: boolean
  lessons: SubmissionLesson[]
  prerequisites: PrerequisiteEdge[]
  /** The course's profile has an active payout account that can take charges. */
  payable: boolean
}

export type SubmissionProblem = {
  code:
    | 'title'
    | 'summary'
    | 'category'
    | 'description'
    | 'thumbnail'
    | 'price'
    | 'no_lessons'
    | 'empty_lesson'
    | 'media_not_ready'
    | 'empty_text'
    | 'empty_quiz'
    | 'prerequisites'
    | 'stripe'
  message: string
  lessonId?: string
  artefactId?: string
}

export type SubmissionCheck = { ok: boolean; problems: SubmissionProblem[] }

/** The same checklist the Teach "Review" tab shows and the API enforces on submit. */
export function validateCourseForSubmission(course: SubmissionCourse): SubmissionCheck {
  const problems: SubmissionProblem[] = []
  if (course.title.trim().length < 3)
    problems.push({ code: 'title', message: 'Give the course a title (3+ characters).' })
  if (!course.summary || course.summary.trim().length < 20)
    problems.push({ code: 'summary', message: 'Write a short summary (20+ characters).' })
  if (!course.category) problems.push({ code: 'category', message: 'Pick a category.' })
  if (!course.hasDescription)
    problems.push({ code: 'description', message: 'Add a course description.' })
  if (!course.hasThumbnail) problems.push({ code: 'thumbnail', message: 'Upload a cover image.' })
  if (course.priceCents !== 0 && course.priceCents < DEFAULT_MINIMUM_CHARGE_CENTS)
    problems.push({ code: 'price', message: 'Price must be free or at least S$1.00.' })
  if (course.lessons.length === 0)
    problems.push({ code: 'no_lessons', message: 'Add at least one lesson.' })

  for (const lesson of course.lessons) {
    if (lesson.artefacts.length === 0) {
      problems.push({
        code: 'empty_lesson',
        lessonId: lesson.id,
        message: `"${lesson.title}" has no content yet.`,
      })
      continue
    }
    for (const artefact of lesson.artefacts) {
      if (
        (artefact.type === 'video' || artefact.type === 'audio') &&
        artefact.mediaStatus !== 'ready'
      ) {
        problems.push({
          code: 'media_not_ready',
          lessonId: lesson.id,
          artefactId: artefact.id,
          message: `"${artefact.title}" is still ${artefact.mediaStatus ?? 'missing its file'}.`,
        })
      }
      if (artefact.type === 'text' && !artefact.hasContent) {
        problems.push({
          code: 'empty_text',
          lessonId: lesson.id,
          artefactId: artefact.id,
          message: `"${artefact.title}" is empty.`,
        })
      }
      if (
        artefact.type === 'quiz' &&
        !(artefact.quizQuestionCount && artefact.quizQuestionCount > 0)
      ) {
        problems.push({
          code: 'empty_quiz',
          lessonId: lesson.id,
          artefactId: artefact.id,
          message: `"${artefact.title}" has no questions.`,
        })
      }
    }
  }

  const dag = validateDag(
    course.lessons.map((l) => l.id),
    course.prerequisites,
  )
  if (!dag.ok) problems.push({ code: 'prerequisites', message: dag.message })

  if (!course.payable)
    problems.push({
      code: 'stripe',
      message: 'Connect your Stripe account before submitting so learners can pay you.',
    })

  return { ok: problems.length === 0, problems }
}
