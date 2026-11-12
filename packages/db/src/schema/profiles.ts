import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  primaryKey,
  snakeCase,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { citext, createdAt, id, ts, updatedAt } from './columns'
import {
  entityCheckStatusEnum,
  entityTypeEnum,
  invitationStatusEnum,
  membershipRoleEnum,
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
    /** Corporate profiles only: the registered company behind the profile. */
    legalEntityId: uuid()
      .unique()
      .references((): AnyPgColumn => legalEntities.id, { onDelete: 'restrict' }),
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
    // A corporate profile is a registered company, and only a corporate profile has one.
    check(
      'profiles_corporate_has_legal_entity',
      sql`(${t.type} = 'corporate') = (${t.legalEntityId} is not null)`,
    ),
  ],
)

/**
 * The registered company behind a corporate profile. One UEN backs at most one profile. Support
 * checks the UEN and legal name against the registry document when it reviews the application.
 */
export const legalEntities = snakeCase.table('legal_entities', {
  id: id(),
  /** Stored trimmed and in upper case, as `normaliseUen` returns it. */
  uen: text().notNull().unique(),
  legalName: text().notNull(),
  entityType: entityTypeEnum().notNull(),
  /** The registry document the applicant uploaded. Empty only for seeded demo companies. */
  registryDocumentMediaId: uuid().references((): AnyPgColumn => mediaAssets.id, {
    onDelete: 'restrict',
  }),
  checkStatus: entityCheckStatusEnum().notNull().default('pending'),
  checkedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  checkedAt: ts(),
  rejectionReason: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

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

/**
 * Managers and writers of a profile. The owner is not here: it is `profiles.owner_user_id`.
 * Managers exist only on corporate profiles; that rule spans two tables, so the membership
 * service enforces it, not a column check.
 */
export const profileMemberships = snakeCase.table(
  'profile_memberships',
  {
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum().notNull(),
    addedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.userId] }), index().on(t.userId)],
)

/**
 * One row per invitation email sent. A resend marks the old row `revoked` and adds a new one, so
 * the rows of the last 24 hours are the count that the sending limit uses.
 */
export const profileInvitations = snakeCase.table(
  'profile_invitations',
  {
    id: id(),
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    email: citext().notNull(),
    role: membershipRoleEnum().notNull(),
    invitedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    /** Keyed hash of the token in the emailed link; the token itself is never stored. */
    tokenHash: text().notNull().unique(),
    status: invitationStatusEnum().notNull().default('pending'),
    /** Who used the link. For a manager invitation this can be a different address. */
    acceptedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    expiresAt: ts().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('profile_invitations_one_pending_per_email')
      .on(t.profileId, t.email)
      .where(sql`${t.status} = 'pending'`),
    index().on(t.profileId, t.createdAt),
  ],
)
