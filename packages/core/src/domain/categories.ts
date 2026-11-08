import { z } from 'zod'

export const COURSE_CATEGORIES = [
  { slug: 'arts-culture', label: 'Arts & Culture' },
  { slug: 'business', label: 'Business' },
  { slug: 'craft-making', label: 'Craft & Making' },
  { slug: 'design', label: 'Design' },
  { slug: 'food-drink', label: 'Food & Drink' },
  { slug: 'language', label: 'Language' },
  { slug: 'music', label: 'Music' },
  { slug: 'photography-film', label: 'Photography & Film' },
  { slug: 'technology', label: 'Technology' },
  { slug: 'wellness', label: 'Wellness' },
] as const

export type CourseCategory = (typeof COURSE_CATEGORIES)[number]['slug']

export const courseCategorySchema = z.enum(
  COURSE_CATEGORIES.map((c) => c.slug) as [CourseCategory, ...CourseCategory[]],
)

export function categoryLabel(slug: string): string {
  return COURSE_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug
}
