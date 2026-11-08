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
