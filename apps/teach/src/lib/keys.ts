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
  members: (profileId: string) => ['teach', profileId, 'members'] as const,
}

export const courseKeys = {
  list: (profileId: string) => ['teach', profileId, 'courses'] as const,
  /** The builder's tree: live rows, or the open change set's rows for someone who proposes edits. */
  detail: (profileId: string, courseId: string) =>
    ['teach', profileId, 'course', courseId] as const,
  /** One named tree, for the screen that shows a change set's two versions side by side. */
  tree: (profileId: string, courseId: string, version: 'live' | 'draft') =>
    ['teach', profileId, 'course', courseId, version] as const,
  changeSet: (profileId: string, courseId: string) =>
    ['teach', profileId, 'course', courseId, 'change-set'] as const,
}
