import { sql } from 'drizzle-orm'
import { boolean, check, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { createdAt, ts, updatedAt } from './columns'
import { teacherStatusEnum } from './enums'
import { mediaAssets } from './media'

export const teacherProfiles = pgTable(
  'teacher_profiles',
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text().notNull(),
    headline: text(),
    bio: text(),
    credentials: text(),
    teachingSampleUrl: text(),
    teachingSampleMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    status: teacherStatusEnum().notNull().default('applied'),
    reviewNote: text(),
    /** Per-teacher platform commission in basis points (1500 = 15%). Not a constant. */
    commissionBps: integer().notNull().default(1500),
    stripeAccountId: text().unique(),
    stripeDetailsSubmitted: boolean().notNull().default(false),
    stripeChargesEnabled: boolean().notNull().default(false),
    stripePayoutsEnabled: boolean().notNull().default(false),
    appliedAt: createdAt(),
    reviewedAt: ts(),
    reviewedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('teacher_profiles_commission_bps_range', sql`${t.commissionBps} between 0 and 10000`),
  ],
)
