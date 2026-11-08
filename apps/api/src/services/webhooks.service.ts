import { schema as s } from '@elevate/db'
import { and, eq } from 'drizzle-orm'
import type { Deps } from '../deps'

export type WebhookProvider = 'stripe' | 'mux'

/** Idempotency ledger: every provider event is recorded once; replays are acknowledged but skipped. */
export class WebhookLedger {
  constructor(private readonly deps: Deps) {}

  /** @returns false when this event id was already recorded. */
  async record(
    provider: WebhookProvider,
    eventId: string,
    type: string,
    payload: unknown,
  ): Promise<boolean> {
    const inserted = await this.deps.db
      .insert(s.webhookEvents)
      .values({ provider, eventId, type, payload })
      .onConflictDoNothing()
      .returning()
    return inserted.length > 0
  }

  async markProcessed(provider: WebhookProvider, eventId: string, error?: string): Promise<void> {
    await this.deps.db
      .update(s.webhookEvents)
      .set({ processedAt: this.deps.now(), error: error ?? null })
      .where(and(eq(s.webhookEvents.provider, provider), eq(s.webhookEvents.eventId, eventId)))
  }
}
