import type { AnalyticsEventName } from '@elevate/core'
import { schema as s } from '@elevate/db'
import type { Deps } from '../deps'

export async function recordAudit(
  deps: Deps,
  input: {
    actorId: string | null
    action: string
    entityType: string
    entityId?: string | null
    /** The profile the change belongs to, when it has one. */
    profileId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await deps.db.insert(s.auditLog).values({
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    profileId: input.profileId ?? null,
    metadata: input.metadata ?? null,
  })
}

/**
 * One entry per change that platform staff make while acting inside a teacher's profile, written
 * under the staff member's own user ID. `route` is the route pattern, `path` the concrete path.
 */
export async function recordStaffAction(
  deps: Deps,
  actor: { userId: string; profileId: string },
  request: { method: string; route: string; path: string },
): Promise<void> {
  await recordAudit(deps, {
    actorId: actor.userId,
    action: `staff.${request.method} ${request.route}`,
    entityType: 'profile',
    entityId: actor.profileId,
    profileId: actor.profileId,
    metadata: { method: request.method, path: request.path },
  })
}

export async function trackEvent(
  deps: Deps,
  input: { userId?: string | null; name: AnalyticsEventName; properties?: Record<string, unknown> },
): Promise<void> {
  try {
    await deps.db.insert(s.analyticsEvents).values({
      userId: input.userId ?? null,
      name: input.name,
      properties: input.properties ?? null,
    })
  } catch (error) {
    deps.log.warn('analytics insert failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
