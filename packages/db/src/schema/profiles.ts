import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  snakeCase,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { createdAt, id, ts, updatedAt } from './columns'
import {
  payoutAccountStatusEnum,
  profileStatusEnum,
  profileTypeEnum,
  stripeBusinessTypeEnum,
} from './enums'
import { mediaAssets } from './media'

/**
 * A teaching profile: what learners buy from. It is its own record, separate from the users who
 * run it. The owner is a column, not a membership row, so a profile always has exactly one.
 */
export const profiles = snakeCase.table(
  'profiles',
  {
    id: id(),
    /** Fixed once the profile exists. */
    type: profileTypeEnum().notNull(),
    ownerUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    displayName: text().notNull(),
    headline: text(),
    bio: text(),
    credentials: text(),
    teachingSampleUrl: text(),
    // `media_assets` points back at `profiles`, so these two callbacks carry an explicit type.
    teachingSampleMediaId: uuid().references((): AnyPgColumn => mediaAssets.id, {
      onDelete: 'set null',
    }),
    avatarMediaId: uuid().references((): AnyPgColumn => mediaAssets.id, { onDelete: 'set null' }),
    /** Corporate profiles only. The `legal_entities` table and this column's foreign key come later. */
    legalEntityId: uuid().unique(),
    status: profileStatusEnum().notNull().default('applied'),
    reviewNote: text(),
    /** Per-profile platform commission in basis points (1500 = 15%). Not a constant. */
    commissionBps: integer().notNull().default(1500),
    appliedAt: createdAt(),
    reviewedAt: ts(),
    reviewedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    updatedAt: updatedAt(),
  },
  (t) => [
    // A user may own many profiles, but only one personal profile.
    uniqueIndex('profiles_one_personal_per_owner')
      .on(t.ownerUserId)
      .where(sql`${t.type} = 'personal'`),
    index().on(t.ownerUserId),
    check('profiles_commission_bps_range', sql`${t.commissionBps} between 0 and 10000`),
  ],
)

/**
 * One row per Stripe connected account. A profile has at most one for now; payments point at the
 * account they paid, and that never changes.
 */
export const payoutAccounts = snakeCase.table('payout_accounts', {
  id: id(),
  profileId: uuid()
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  /** Null between inserting the row and Stripe returning the account ID. */
  stripeAccountId: text().unique(),
  /** Taken from the profile type when the account is created. */
  businessType: stripeBusinessTypeEnum().notNull(),
  status: payoutAccountStatusEnum().notNull().default('onboarding'),
  detailsSubmitted: boolean().notNull().default(false),
  chargesEnabled: boolean().notNull().default(false),
  payoutsEnabled: boolean().notNull().default(false),
  activatedAt: ts(),
  /** Company accounts: the Support check that Stripe's legal name matches the registry. */
  nameVerifiedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  nameVerifiedAt: ts(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})
