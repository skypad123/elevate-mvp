/**
 * Query keys. Every key carries the profile, so two profiles a user belongs to never share a
 * cache entry.
 */
export const teachKeys = {
  profile: (profileId: string) => ['teach', profileId, 'profile'] as const,
  stripe: (profileId: string) => ['teach', profileId, 'stripe'] as const,
  earnings: (profileId: string) => ['teach', profileId, 'earnings'] as const,
  courseEarnings: (profileId: string, courseId: string) =>
    ['teach', profileId, 'earnings', 'course', courseId] as const,
  reconciliation: (profileId: string) => ['teach', profileId, 'earnings', 'reconcile'] as const,
}

export const courseKeys = {
  list: (profileId: string) => ['teach', profileId, 'courses'] as const,
  detail: (profileId: string, courseId: string) =>
    ['teach', profileId, 'course', courseId] as const,
}
