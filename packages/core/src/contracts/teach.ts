import { z } from 'zod'
import { courseCategorySchema } from '../domain/categories'
import { quizDefinitionSchema } from '../domain/quiz'
import { richTextDocSchema } from '../domain/richtext'
import { uuidSchema } from './common'

export const teacherApplicationSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    headline: z.string().trim().min(5).max(120),
    bio: z.string().trim().min(50).max(3000),
    credentials: z.string().trim().min(10).max(3000),
    teachingSampleUrl: z.string().url().max(2048).optional(),
    teachingSampleMediaId: uuidSchema.optional(),
  })
  .refine((v) => v.teachingSampleUrl || v.teachingSampleMediaId, {
    message: 'Share a teaching sample: upload a video or paste a link',
    path: ['teachingSampleUrl'],
  })
export type TeacherApplication = z.infer<typeof teacherApplicationSchema>

export const createCourseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  category: courseCategorySchema,
})
export type CreateCourse = z.infer<typeof createCourseSchema>

export const updateCourseSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  summary: z.string().trim().max(400).nullable().optional(),
  descriptionJson: richTextDocSchema.nullable().optional(),
  category: courseCategorySchema.optional(),
  thumbnailMediaId: uuidSchema.nullable().optional(),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
})
export type UpdateCourse = z.infer<typeof updateCourseSchema>

export const createLessonSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(400).nullable().optional(),
})
export const updateLessonSchema = createLessonSchema.partial()

export const reorderSchema = z.object({ ids: z.array(uuidSchema).min(1).max(500) })

export const prerequisitesSchema = z.object({ prerequisiteIds: z.array(uuidSchema).max(50) })

export const artefactTypeSchema = z.enum(['video', 'audio', 'text', 'quiz'])

export const createArtefactSchema = z.object({
  type: artefactTypeSchema,
  title: z.string().trim().min(1).max(120),
})
export const updateArtefactSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  mediaAssetId: uuidSchema.nullable().optional(),
  contentJson: richTextDocSchema.nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
})

export const upsertQuizSchema = quizDefinitionSchema

export const updateTeacherProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().min(5).max(120).optional(),
  bio: z.string().trim().min(50).max(3000).optional(),
})
export type UpdateTeacherProfile = z.infer<typeof updateTeacherProfileSchema>

export type TeacherStripeView = {
  connected: boolean
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

export type TeacherProfileView = {
  userId: string
  email: string
  displayName: string
  headline: string | null
  bio: string | null
  credentials: string | null
  teachingSampleUrl: string | null
  teachingSampleMediaId: string | null
  status: 'applied' | 'approved' | 'rejected'
  reviewNote: string | null
  commissionBps: number
  stripe: TeacherStripeView
  appliedAt: string
  reviewedAt: string | null
}

// ── Course builder views ─────────────────────────────────────────────────────
import type { SubmissionCheck } from '../domain/course-validation'
import type { QuizDefinition } from '../domain/quiz'
import type { RichTextDoc } from '../domain/richtext'
import type { MediaAssetView } from './media'

export type CourseStatus = 'draft' | 'pending_review' | 'live' | 'rejected'
export type ArtefactType = 'video' | 'audio' | 'text' | 'quiz'

export type ArtefactView = {
  id: string
  lessonId: string
  type: ArtefactType
  title: string
  position: number
  durationSeconds: number | null
  media: MediaAssetView | null
  contentJson: RichTextDoc | null
  quiz: QuizDefinition | null
}

export type LessonView = {
  id: string
  courseId: string
  title: string
  summary: string | null
  position: number
  prerequisiteIds: string[]
  artefacts: ArtefactView[]
}

export type CourseView = {
  id: string
  slug: string
  title: string
  summary: string | null
  descriptionJson: RichTextDoc | null
  category: string
  priceCents: number
  currency: string
  status: CourseStatus
  rejectionReason: string | null
  thumbnail: MediaAssetView | null
  teacher: { id: string; displayName: string; email: string; stripeChargesEnabled: boolean }
  lessons: LessonView[]
  checklist: SubmissionCheck
  enrolCount: number
  submittedAt: string | null
  reviewedAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CourseSummary = {
  id: string
  slug: string
  title: string
  category: string
  status: CourseStatus
  priceCents: number
  thumbnailUrl: string | null
  lessonCount: number
  artefactCount: number
  enrolCount: number
  teacherName: string
  teacherEmail: string
  submittedAt: string | null
  updatedAt: string
}
