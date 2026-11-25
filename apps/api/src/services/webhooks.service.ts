import { schema as s } from '@elevate/db'
import { and, eq } from 'drizzle-orm'
import type { Deps } from '../deps'

export type WebhookProvider = 'stripe' | 'mux'

/**
 * `new`: the first delivery of this event. `retry`: delivered before, and its handling failed
 * (an error is stored) or never finished (no `processed_at` after `STALE_AFTER_MS`). `duplicate`:
 * handled already, or being handled right now.
 */
export type WebhookRecord = 'new' | 'retry' | 'duplicate'

/** How long an event may stay unprocessed before a redelivery handles it again. */
export const STALE_AFTER_MS = 5 * 60 * 1000

/**
 * Idempotency ledger: every provider event is recorded once. A redelivery of an event that was
 * handled is acknowledged and skipped; the caller decides whether to handle a `retry`.
 */
export class WebhookLedger {
  constructor(private readonly deps: Deps) {}

  async record(
    provider: WebhookProvider,
    eventId: string,
    type: string,
    payload: unknown,
  ): Promise<WebhookRecord> {
    const { db } = this.deps
    const now = this.deps.now()
    const inserted = await db
      .insert(s.webhookEvents)
      .values({ provider, eventId, type, payload, receivedAt: now })
      .onConflictDoNothing()
      .returning()
    if (inserted.length > 0) return 'new'
    const stored = await db.query.webhookEvents.findFirst({
      where: { provider, eventId },
      columns: { receivedAt: true, processedAt: true, error: true },
    })
    if (!stored) return 'duplicate'
    if (stored.error !== null) return 'retry'
    if (stored.processedAt === null && now.getTime() - stored.receivedAt.getTime() > STALE_AFTER_MS)
      return 'retry'
    return 'duplicate'
  }

  /** Records the outcome of handling the event; a success clears an earlier error. */
  async markProcessed(provider: WebhookProvider, eventId: string, error?: string): Promise<void> {
    await this.deps.db
      .update(s.webhookEvents)
      .set({ processedAt: this.deps.now(), error: error ?? null })
      .where(and(eq(s.webhookEvents.provider, provider), eq(s.webhookEvents.eventId, eventId)))
  }
}
