import { z } from 'zod'
import { courseCategorySchema } from '../domain/categories'
import { paginationSchema } from './common'

export const catalogSortSchema = z.enum(['newest', 'popular'])
export type CatalogSort = z.infer<typeof catalogSortSchema>

export const catalogQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  category: courseCategorySchema.optional(),
  sort: catalogSortSchema.default('newest'),
})
export type CatalogQuery = z.infer<typeof catalogQuerySchema>

export type CourseCard = {
  id: string
  slug: string
  title: string
  summary: string | null
  category: string
  priceCents: number
  thumbnailUrl: string | null
  teacherName: string
  enrolCount: number
  lessonCount: number
  publishedAt: string | null
}

export type SyllabusArtefact = {
  id: string
  type: 'video' | 'audio' | 'text' | 'quiz'
  title: string
  durationSeconds: number | null
}

export type SyllabusLesson = {
  id: string
  title: string
  summary: string | null
  position: number
  prerequisiteIds: string[]
  artefacts: SyllabusArtefact[]
}

export type CoursePublicView = {
  id: string
  slug: string
  title: string
  summary: string | null
  descriptionJson: import('../domain/richtext').RichTextDoc | null
  category: string
  priceCents: number
  currency: string
  thumbnailUrl: string | null
  publishedAt: string | null
  enrolCount: number
  lessonCount: number
  artefactCount: number
  durationSeconds: number
  teacher: {
    id: string
    displayName: string
    headline: string | null
    bio: string | null
    avatarUrl: string | null
  }
  lessons: SyllabusLesson[]
  /** Present when the request is authenticated and the viewer has an enrollment. */
  viewer: {
    enrollmentId: string
    status: 'pending_payment' | 'active' | 'refunded' | 'cancelled'
    completedAt: string | null
  } | null
}

export type CategoryCount = { slug: string; label: string; count: number }
