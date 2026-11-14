import {
  ANALYTICS_EVENTS,
  type CorporateApplication,
  type Page,
  type PersonalApplication,
  type ProfileSummary,
  type ProfileView,
  type SupportPayoutAccount,
  type SupportProfileDetail,
  type SupportProfileSummary,
  type UpdateProfile,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, EmptyFilter, eq, exists, ilike, or, type SQL, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors } from '../lib/errors'
import { isPayable } from '../lib/payout'
import type { ProfileActor, SessionUser } from '../middleware/auth'
import { recordAudit, trackEvent } from './audit.service'
import { CoursesService } from './courses.service'
import { EarningsService } from './earnings.service'
import { LegalEntitiesService, legalEntityView } from './legal-entities.service'
import { MediaService } from './media.service'

type ProfileRow = typeof s.profiles.$inferSelect
type PayoutAccountRow = typeof s.payoutAccounts.$inferSelect
type MediaAssetRow = typeof s.mediaAssets.$inferSelect
type LegalEntityRow = typeof s.legalEntities.$inferSelect

type ProfileWithRelations = ProfileRow & {
  owner: typeof s.users.$inferSelect
  payoutAccount: PayoutAccountRow | null
  avatar: MediaAssetRow | null
  legalEntity: LegalEntityRow | null
}

/** The teaching part of an application: the same fields for a person and for a company. */
type TeachingFields = Pick<
  PersonalApplication,
  'displayName' | 'headline' | 'bio' | 'credentials' | 'teachingSampleUrl' | 'teachingSampleMediaId'
>

export type ProfilesQuery = {
  q?: string
  status?: ProfileRow['status']
  type?: ProfileRow['type']
  cursor?: string
  limit: number
}

function encodeCursor(appliedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify([appliedAt.toISOString(), id])).toString('base64url')
}
function decodeCursor(cursor: string): { appliedAt: Date; id: string } | null {
  try {
    const [iso, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as [
      string,
      string,
    ]
    const appliedAt = new Date(iso)
    if (Number.isNaN(appliedAt.getTime()) || typeof id !== 'string') return null
    return { appliedAt, id }
  } catch {
    return null
  }
}

function payoutAccountView(
  account: PayoutAccountRow,
  nameVerifiedBy: string | null,
): SupportPayoutAccount {
  return {
    id: account.id,
    stripeAccountId: account.stripeAccountId,
    businessType: account.businessType,
    status: account.status,
    detailsSubmitted: account.detailsSubmitted,
    chargesEnabled: account.chargesEnabled,
    payoutsEnabled: account.payoutsEnabled,
    activatedAt: account.activatedAt?.toISOString() ?? null,
    nameVerifiedAt: account.nameVerifiedAt?.toISOString() ?? null,
    nameVerifiedBy,
  }
}

/**
 * The picture shown for a profile. Its own avatar wins. A personal profile without one falls back
 * to its owner's avatar, so a teacher who never set one looks as they did before profiles existed.
 * A corporate profile without one has none, and clients draw initials.
 */
export async function profileAvatarUrl(
  media: MediaService,
  profile: Pick<ProfileRow, 'type'> & {
    avatar: Pick<MediaAssetRow, 'storageKey' | 'status'> | null
    owner: { avatarUrl: string | null }
  },
): Promise<string | null> {
  const own = await media.publicUrl(profile.avatar)
  if (own) return own
  return profile.type === 'personal' ? profile.owner.avatarUrl : null
}

/** Teaching profiles: applications, the profile itself, and Support's review of it. */
export class ProfilesService {
  private readonly media: MediaService
  private readonly courses: CoursesService
  private readonly earnings: EarningsService
  private readonly entities: LegalEntitiesService
  constructor(private readonly deps: Deps) {
    this.media = new MediaService(deps)
    this.courses = new CoursesService(deps)
    this.earnings = new EarningsService(deps)
    this.entities = new LegalEntitiesService(deps)
  }

  private async load(profileId: string): Promise<ProfileWithRelations> {
    const profile = await this.deps.db.query.profiles.findFirst({
      where: { id: profileId },
      with: { owner: true, payoutAccount: true, avatar: true, legalEntity: true },
    })
    if (!profile) throw errors.notFound('Profile')
    return profile
  }

  private async toView(
    profile: ProfileWithRelations,
    actingAsStaff: boolean,
  ): Promise<ProfileView> {
    const account = profile.payoutAccount
    return {
      id: profile.id,
      type: profile.type,
      status: profile.status,
      displayName: profile.displayName,
      headline: profile.headline,
      bio: profile.bio,
      credentials: profile.credentials,
      teachingSampleUrl: profile.teachingSampleUrl,
      teachingSampleMediaId: profile.teachingSampleMediaId,
      avatarMediaId: profile.avatarMediaId,
      avatarUrl: await this.media.publicUrl(profile.avatar),
      reviewNote: profile.reviewNote,
      commissionBps: profile.commissionBps,
      payout: account
        ? {
            status: account.status,
            businessType: account.businessType,
            detailsSubmitted: account.detailsSubmitted,
            chargesEnabled: account.chargesEnabled,
            payoutsEnabled: account.payoutsEnabled,
            nameVerified: !!account.nameVerifiedAt,
            activated: !!account.activatedAt,
          }
        : null,
      legalEntity: profile.legalEntity ? legalEntityView(profile.legalEntity) : null,
      owner: { id: profile.owner.id, email: profile.owner.email, name: profile.owner.name },
      actingAsStaff,
      appliedAt: profile.appliedAt.toISOString(),
      reviewedAt: profile.reviewedAt?.toISOString() ?? null,
    }
  }

  // ── Teach ────────────────────────────────────────────────────────────────

  /** The profiles the user owns or belongs to; the same list the session carries. */
  listForUser(user: SessionUser): ProfileSummary[] {
    return user.profiles
  }

  async getProfile(actor: ProfileActor): Promise<ProfileView> {
    return this.toView(await this.load(actor.profileId), actor.role === 'staff')
  }

  /**
   * Creates the user's personal profile, or resubmits it while it is still `applied` or
   * `rejected`. An approved personal profile cannot be applied for again.
   */
  async apply(user: SessionUser, input: PersonalApplication): Promise<ProfileView> {
    const { db, env, mailer } = this.deps
    const existing = await db.query.profiles.findFirst({
      where: { ownerUserId: user.id, type: 'personal' },
    })
    if (existing?.status === 'approved')
      throw errors.conflict('profile_exists', 'You already have an approved teaching profile')
    const values = await this.applicationValues(user, input)
    let profileId: string
    if (existing) {
      await db.update(s.profiles).set(values).where(eq(s.profiles.id, existing.id))
      profileId = existing.id
    } else {
      const [created] = await db
        .insert(s.profiles)
        .values({
          type: 'personal',
          ownerUserId: user.id,
          commissionBps: env.DEFAULT_COMMISSION_BPS,
          ...values,
        })
        .returning()
      if (!created) throw new Error('failed to save application')
      profileId = created.id
    }

    if (!user.name)
      await db.update(s.users).set({ name: input.displayName }).where(eq(s.users.id, user.id))

    await trackEvent(this.deps, {
      userId: user.id,
      name: ANALYTICS_EVENTS.teacherApplied,
      properties: { reapply: !!existing, profileId },
    })
    await mailer.send(
      simpleEmail({
        to: user.email,
        title: 'We received your Elevate Teach application',
        paragraphs: [
          `Thanks, ${input.displayName}. Our team reviews every application by hand, usually within two working days.`,
          'We will email you as soon as there is a decision. You can edit your application from Elevate Teach until then.',
        ],
        cta: { href: `${env.TEACH_URL}/p/${profileId}`, label: 'View application' },
      }),
    )
    return this.toView(await this.load(profileId), false)
  }

  /** What an application writes to the profile: the teaching fields, and "waiting for review". */
  private async applicationValues(user: SessionUser, input: TeachingFields) {
    if (input.teachingSampleMediaId) {
      const asset = await this.media.getOwnedReadyAsset(user, input.teachingSampleMediaId)
      if (asset.kind !== 'video' && asset.kind !== 'document')
        throw errors.badRequest('wrong_kind', 'Teaching samples must be a video or a PDF')
    }
    return {
      displayName: input.displayName,
      headline: input.headline,
      bio: input.bio,
      credentials: input.credentials,
      teachingSampleUrl: input.teachingSampleUrl ?? null,
      teachingSampleMediaId: input.teachingSampleMediaId ?? null,
      status: 'applied' as const,
      reviewNote: null,
      reviewedAt: null,
      reviewedBy: null,
      appliedAt: this.deps.now(),
    }
  }

  private async sendCorporateReceived(
    user: SessionUser,
    profileId: string,
    input: CorporateApplication,
  ): Promise<void> {
    const { env, mailer } = this.deps
    await mailer.send(
      simpleEmail({
        to: user.email,
        title: `We received the Elevate Teach application for ${input.legalName}`,
        paragraphs: [
          `Thanks. Our team reviews every application by hand, usually within two working days. For a company we also compare the UEN (${input.uen}) and the legal name with the registry document you uploaded.`,
          'We will email you as soon as there is a decision. After approval you connect the company’s Stripe account, and we check that its legal name matches before courses can be bought.',
        ],
        cta: { href: `${env.TEACH_URL}/p/${profileId}`, label: 'View application' },
      }),
    )
  }

  /**
   * A company applies: the profile (`corporate`, `applied`) and its legal entity (`pending`) are
   * created together, with the registry document linked. A UEN that any profile already holds,
   * whatever that profile's status, is refused.
   */
  async applyCorporate(user: SessionUser, input: CorporateApplication): Promise<ProfileView> {
    const { db, env } = this.deps
    const values = await this.applicationValues(user, input)
    await this.entities.assertUenFree(input.uen)
    await this.entities.assertRegistryDocument(user, input.registryDocumentMediaId)

    const profileId = await db.transaction(async (tx) => {
      // Two applications with one UEN at the same moment: the unique index lets one through.
      const [entity] = await tx
        .insert(s.legalEntities)
        .values({
          uen: input.uen,
          legalName: input.legalName,
          entityType: input.entityType,
          registryDocumentMediaId: input.registryDocumentMediaId,
        })
        .onConflictDoNothing()
        .returning()
      if (!entity) {
        throw errors.conflict(
          'uen_in_use',
          'A company with this UEN already has a profile on Elevate. Contact Elevate Support if that is your company.',
        )
      }
      const [profile] = await tx
        .insert(s.profiles)
        .values({
          type: 'corporate',
          ownerUserId: user.id,
          legalEntityId: entity.id,
          commissionBps: env.DEFAULT_COMMISSION_BPS,
          ...values,
        })
        .returning()
      if (!profile) throw new Error('failed to save application')
      return profile.id
    })

    await trackEvent(this.deps, {
      userId: user.id,
      name: ANALYTICS_EVENTS.teacherApplied,
      properties: { reapply: false, profileId, type: 'corporate' },
    })
    await this.sendCorporateReceived(user, profileId, input)
    return this.toView(await this.load(profileId), false)
  }

  /**
   * The owner of a corporate profile that is not approved resubmits its application. The profile
   * and its legal entity are updated in place and go back to `applied` and `pending`, so the
   * application returns to the review queue. The UEN can change only to one no other profile
   * holds. An earlier rejection reason stays in the audit log.
   */
  async reapplyCorporate(
    user: SessionUser,
    actor: ProfileActor,
    input: CorporateApplication,
  ): Promise<ProfileView> {
    const { db } = this.deps
    if (actor.role !== 'owner') {
      throw errors.forbidden('Only the owner of this profile can resubmit its application')
    }
    const profile = await this.load(actor.profileId)
    const entity = profile.legalEntity
    if (profile.type !== 'corporate' || !entity) {
      throw errors.conflict('not_corporate', 'This is not a company profile')
    }
    if (profile.status === 'approved') {
      throw errors.conflict('already_approved', 'This company profile is already approved')
    }
    const values = await this.applicationValues(user, input)
    await this.entities.assertUenFree(input.uen, entity.id)
    if (input.registryDocumentMediaId !== entity.registryDocumentMediaId) {
      await this.entities.assertRegistryDocument(user, input.registryDocumentMediaId)
    }

    await db.transaction(async (tx) => {
      await tx
        .update(s.legalEntities)
        .set({
          uen: input.uen,
          legalName: input.legalName,
          entityType: input.entityType,
          registryDocumentMediaId: input.registryDocumentMediaId,
          checkStatus: 'pending',
          checkedBy: null,
          checkedAt: null,
          rejectionReason: null,
        })
        .where(eq(s.legalEntities.id, entity.id))
      await tx.update(s.profiles).set(values).where(eq(s.profiles.id, profile.id))
    })

    await trackEvent(this.deps, {
      userId: user.id,
      name: ANALYTICS_EVENTS.teacherApplied,
      properties: { reapply: true, profileId: profile.id, type: 'corporate' },
    })
    await this.sendCorporateReceived(user, profile.id, input)
    return this.getProfile(actor)
  }

  async updateProfile(
    user: SessionUser,
    actor: ProfileActor,
    patch: UpdateProfile,
  ): Promise<ProfileView> {
    const { db } = this.deps
    const profile = await this.load(actor.profileId)
    const values: Partial<typeof s.profiles.$inferInsert> = {}
    if (patch.displayName !== undefined) values.displayName = patch.displayName
    if (patch.headline !== undefined) values.headline = patch.headline
    if (patch.bio !== undefined) values.bio = patch.bio
    if (patch.avatarMediaId !== undefined) {
      // The picture is the profile's own file, like its course media.
      if (patch.avatarMediaId) {
        await this.media.getProfileAsset(profile.id, patch.avatarMediaId, {
          ready: true,
          kind: 'image',
        })
      }
      values.avatarMediaId = patch.avatarMediaId
    }
    if (Object.keys(values).length > 0)
      await db.update(s.profiles).set(values).where(eq(s.profiles.id, profile.id))
    // The public name can drift from a name Support has verified, so every change is on record.
    if (patch.displayName !== undefined && patch.displayName !== profile.displayName) {
      await recordAudit(this.deps, {
        actorId: user.id,
        action: 'profile.rename',
        entityType: 'profile',
        entityId: profile.id,
        profileId: profile.id,
        metadata: { from: profile.displayName, to: patch.displayName },
      })
    }
    return this.getProfile(actor)
  }

  // ── Support ──────────────────────────────────────────────────────────────

  async list(query: ProfilesQuery): Promise<Page<SupportProfileSummary>> {
    const { db } = this.deps
    const cursor = query.cursor ? decodeCursor(query.cursor) : null
    const like = query.q ? `%${query.q.replace(/[%_]/g, '\\$&')}%` : null

    // `profile` is the alias the relational query gives the table; subqueries must refer to it.
    const conditionsFor = (profile: typeof s.profiles): SQL[] => {
      const conditions: SQL[] = []
      if (like) {
        const match = or(
          ilike(profile.displayName, like),
          exists(
            db
              .select({ one: sql`1` })
              .from(s.users)
              .where(
                and(
                  eq(s.users.id, profile.ownerUserId),
                  or(ilike(sql`${s.users.email}::text`, like), ilike(s.users.name, like)),
                ),
              ),
          ),
          // a company is also found by its UEN or its legal name
          exists(
            db
              .select({ one: sql`1` })
              .from(s.legalEntities)
              .where(
                and(
                  eq(s.legalEntities.id, profile.legalEntityId),
                  or(ilike(s.legalEntities.uen, like), ilike(s.legalEntities.legalName, like)),
                ),
              ),
          ),
        )
        if (match) conditions.push(match)
      }
      if (cursor)
        conditions.push(
          sql`(${profile.appliedAt}, ${profile.id}) < (${cursor.appliedAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
        )
      return conditions
    }

    const rows = await db.query.profiles.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        RAW: (profile) => and(...conditionsFor(profile)) ?? EmptyFilter,
      },
      with: { owner: true, payoutAccount: true, legalEntity: true },
      orderBy: { appliedAt: 'desc', id: 'desc' },
      limit: query.limit + 1,
    })
    const items = rows.slice(0, query.limit).map(
      (p): SupportProfileSummary => ({
        id: p.id,
        type: p.type,
        status: p.status,
        displayName: p.displayName,
        ownerId: p.owner.id,
        ownerEmail: p.owner.email,
        ownerName: p.owner.name,
        commissionBps: p.commissionBps,
        payable: isPayable(p.payoutAccount),
        uen: p.legalEntity?.uen ?? null,
        legalName: p.legalEntity?.legalName ?? null,
        appliedAt: p.appliedAt.toISOString(),
      }),
    )
    const last = rows.length > query.limit ? rows[query.limit - 1] : null
    return { items, nextCursor: last ? encodeCursor(last.appliedAt, last.id) : null }
  }

  async detail(profileId: string): Promise<SupportProfileDetail> {
    const profile = await this.load(profileId)
    const account = profile.payoutAccount
    const verifier = account?.nameVerifiedBy
      ? await this.deps.db.query.users.findFirst({
          where: { id: account.nameVerifiedBy },
          columns: { email: true },
        })
      : null
    return {
      profile: await this.toView(profile, false),
      courses: await this.courses.listSummaries({ profileId }),
      payoutAccounts: account ? [payoutAccountView(account, verifier?.email ?? null)] : [],
      legalEntity: profile.legalEntity
        ? await this.entities.supportView(profile.legalEntity)
        : null,
      earnings: await this.earnings.totalsForProfile(profileId),
    }
  }

  async approve(staff: SessionUser, profileId: string, note?: string): Promise<ProfileView> {
    const { db, env, mailer } = this.deps
    const profile = await this.load(profileId)
    if (profile.status === 'approved')
      throw errors.conflict('already_approved', 'This profile is already approved')
    const now = this.deps.now()
    const entity = profile.legalEntity
    // One review covers the teaching and, for a company, the company: approving the profile
    // records that its UEN and legal name were checked against the registry document.
    await db.transaction(async (tx) => {
      await tx
        .update(s.profiles)
        .set({
          status: 'approved',
          reviewNote: note ?? null,
          reviewedAt: now,
          reviewedBy: staff.id,
        })
        .where(eq(s.profiles.id, profileId))
      if (entity) {
        await tx
          .update(s.legalEntities)
          .set({
            checkStatus: 'verified',
            checkedBy: staff.id,
            checkedAt: now,
            rejectionReason: null,
          })
          .where(eq(s.legalEntities.id, entity.id))
      }
    })
    await recordAudit(this.deps, {
      actorId: staff.id,
      action: 'profile.approve',
      entityType: 'profile',
      entityId: profileId,
      profileId,
      metadata: {
        note: note ?? null,
        ...(entity ? { uen: entity.uen, legalName: entity.legalName } : {}),
      },
    })
    await trackEvent(this.deps, {
      userId: profile.ownerUserId,
      name: ANALYTICS_EVENTS.teacherApproved,
      properties: { profileId },
    })
    await mailer.send(
      simpleEmail({
        to: profile.owner.email,
        title: 'Welcome to Elevate Teach',
        paragraphs: [
          `Your application is approved, ${profile.displayName}.`,
          entity
            ? `Next: connect a Stripe account in the name of ${entity.legalName}, the company we approved. When Stripe has finished, we check that the legal name on that account matches the company, and then you can build courses and learners can pay for them.`
            : 'Next: connect your Stripe account so learners can pay you, then build your first course. Courses go live after a quick review by our team.',
        ],
        cta: { href: `${env.TEACH_URL}/p/${profileId}`, label: 'Open Elevate Teach' },
      }),
    )
    return this.toView(await this.load(profileId), false)
  }

  async reject(staff: SessionUser, profileId: string, reason: string): Promise<ProfileView> {
    const { db, env, mailer } = this.deps
    const profile = await this.load(profileId)
    if (profile.status === 'approved')
      throw errors.conflict('already_approved', 'An approved profile cannot be rejected')
    const now = this.deps.now()
    const entity = profile.legalEntity
    await db.transaction(async (tx) => {
      await tx
        .update(s.profiles)
        .set({ status: 'rejected', reviewNote: reason, reviewedAt: now, reviewedBy: staff.id })
        .where(eq(s.profiles.id, profileId))
      if (entity) {
        await tx
          .update(s.legalEntities)
          .set({
            checkStatus: 'rejected',
            checkedBy: staff.id,
            checkedAt: now,
            rejectionReason: reason,
          })
          .where(eq(s.legalEntities.id, entity.id))
      }
    })
    await recordAudit(this.deps, {
      actorId: staff.id,
      action: 'profile.reject',
      entityType: 'profile',
      entityId: profileId,
      profileId,
      metadata: { reason },
    })
    await mailer.send(
      simpleEmail({
        to: profile.owner.email,
        title: 'About your Elevate Teach application',
        paragraphs: [
          `Thanks for applying, ${profile.displayName}. We are not able to approve the application as submitted.`,
          `Reviewer note: ${reason}`,
          'You are welcome to update your application and resubmit.',
        ],
        cta: { href: `${env.TEACH_URL}/p/${profileId}`, label: 'Update application' },
      }),
    )
    return this.toView(await this.load(profileId), false)
  }

  async setCommission(
    staff: SessionUser,
    profileId: string,
    commissionBps: number,
  ): Promise<ProfileView> {
    const profile = await this.load(profileId)
    await this.deps.db.update(s.profiles).set({ commissionBps }).where(eq(s.profiles.id, profileId))
    await recordAudit(this.deps, {
      actorId: staff.id,
      action: 'profile.commission',
      entityType: 'profile',
      entityId: profileId,
      profileId,
      metadata: { from: profile.commissionBps, to: commissionBps },
    })
    return this.toView(await this.load(profileId), false)
  }
}
