import {
  boolean,
  index,
  integer,
  primaryKey,
  snakeCase,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { citext, createdAt, id, ts, updatedAt } from './columns'
import { audienceEnum, identityProviderEnum, localeEnum, userRoleEnum } from './enums'

export const users = snakeCase.table('users', {
  id: id(),
  email: citext().notNull().unique(),
  name: text(),
  avatarUrl: text(),
  /** The account's language, for emails and Stripe. Null until a device sends one (ADR 010). */
  locale: localeEnum(),
  /** True when a person picked `locale`; false when a device guessed it. */
  localeChosen: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/** One row per login method. `email` today; `singpass` (or others) can be linked later. */
export const identities = snakeCase.table(
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

export const sessions = snakeCase.table(
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

export const magicLinks = snakeCase.table(
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
export const userRoles = snakeCase.table(
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
