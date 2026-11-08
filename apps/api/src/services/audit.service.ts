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
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await deps.db.insert(s.auditLog).values({
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
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
