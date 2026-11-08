import { customType, timestamp, uuid } from 'drizzle-orm/pg-core'

/** Case-insensitive text (Postgres `citext` extension) for emails and promo codes. */
export const citext = customType<{ data: string }>({
  dataType: () => 'citext',
})

export const id = () => uuid().primaryKey().defaultRandom()
export const ts = () => timestamp({ withTimezone: true })
export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()
export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
