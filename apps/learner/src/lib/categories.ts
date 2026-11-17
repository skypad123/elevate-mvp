import { COURSE_CATEGORIES, type CourseCategory, categoryLabel } from '@elevate/core'
import type { MessageKey, Translator } from '@elevate/i18n'

/** The contracts type a category as `string`; this narrows it to one of the known slugs. */
export function isCourseCategory(slug: string): slug is CourseCategory {
  return COURSE_CATEGORIES.some((c) => c.slug === slug)
}

/** The message key of a known category, or null for a slug the catalog has no message for. */
export function categoryKey(slug: string): MessageKey | null {
  return isCourseCategory(slug) ? `category.${slug}` : null
}

/** A category's name in the reader's language; an unknown slug shows its English label or itself. */
export function categoryName(slug: string, t: Translator): string {
  const key = categoryKey(slug)
  return key ? t(key) : categoryLabel(slug)
}
