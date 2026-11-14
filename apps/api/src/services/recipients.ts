import type { Deps } from '../deps'

/**
 * The people who run a profile's courses: its owner and, on a corporate profile, its managers.
 * They hear about course reviews and about writer changes waiting for approval. Money notices go
 * to the owner alone and do not use this.
 */
export async function ownerAndManagerEmails(deps: Deps, profileId: string): Promise<string[]> {
  const profile = await deps.db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { id: true },
    with: {
      owner: { columns: { email: true } },
      memberships: {
        where: { role: 'manager' },
        columns: { userId: true },
        with: { user: { columns: { email: true } } },
      },
    },
  })
  if (!profile) return []
  return [...new Set([profile.owner.email, ...profile.memberships.map((m) => m.user.email)])]
}
