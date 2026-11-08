export function slugify(input: string, maxLength = 64): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
  return slug || 'course'
}

/** Appends a numeric suffix: withSuffix('intro', 2) → 'intro-2'. */
export function withSuffix(slug: string, n: number): string {
  return n <= 1 ? slug : `${slug}-${n}`
}
