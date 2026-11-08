import { index, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { createdAt, id, ts } from './columns'
import { webhookProviderEnum } from './enums'

/** Idempotency ledger for Stripe and Mux webhooks. */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    provider: webhookProviderEnum().notNull(),
    eventId: text().notNull(),
    type: text().notNull(),
    payload: jsonb().$type<unknown>().notNull(),
    receivedAt: createdAt(),
    processedAt: ts(),
    error: text(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.eventId] })],
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.entityType, t.entityId), index().on(t.createdAt)],
)

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: id(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    name: text().notNull(),
    properties: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.name, t.createdAt)],
)
