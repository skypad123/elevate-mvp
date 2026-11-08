import { index, integer, pgTable, primaryKey, text, unique, uuid } from 'drizzle-orm/pg-core'
import { citext, createdAt, id, ts, updatedAt } from './columns'
import { audienceEnum, identityProviderEnum, userRoleEnum } from './enums'

export const users = pgTable('users', {
  id: id(),
  email: citext().notNull().unique(),
  name: text(),
  avatarUrl: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/** One row per login method. `email` today; `singpass` (or others) can be linked later. */
export const identities = pgTable(
  'identities',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: identityProviderEnum().notNull(),
    providerSubject: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.provider, t.providerSubject), index().on(t.userId)],
)

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** sha256 of the bearer token; the token itself is never stored. */
    tokenHash: text().notNull().unique(),
    audience: audienceEnum().notNull(),
    userAgent: text(),
    expiresAt: ts().notNull(),
    lastSeenAt: ts().notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId), index().on(t.expiresAt)],
)

export const magicLinks = pgTable(
  'magic_links',
  {
    id: id(),
    email: citext().notNull(),
    audience: audienceEnum().notNull(),
    tokenHash: text().notNull().unique(),
    codeHash: text().notNull(),
    redirectPath: text(),
    attempts: integer().notNull().default(0),
    expiresAt: ts().notNull(),
    consumedAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.email, t.createdAt)],
)

/** Learner is implicit: every user can learn. Extra roles are rows here. */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: userRoleEnum().notNull(),
    grantedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
)
