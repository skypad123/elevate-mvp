import {
  ANALYTICS_EVENTS,
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
import { MediaService } from './media.service'

type ProfileRow = typeof s.profiles.$inferSelect
type PayoutAccountRow = typeof s.payoutAccounts.$inferSelect
type MediaAssetRow = typeof s.mediaAssets.$inferSelect

type ProfileWithRelations = ProfileRow & {
  owner: typeof s.users.$inferSelect
  payoutAccount: PayoutAccountRow | null
  avatar: MediaAssetRow | null
}

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

function payoutAccountView(account: PayoutAccountRow): SupportPayoutAccount {
  return {
    id: account.id,
    stripeAccountId: account.stripeAccountId,
    businessType: account.businessType,
    status: account.status,
    detailsSubmitted: account.detailsSubmitted,
    chargesEnabled: account.chargesEnabled,
    payoutsEnabled: account.payoutsEnabled,
    activatedAt: account.activatedAt?.toISOString() ?? null,
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
  constructor(private readonly deps: Deps) {
    this.media = new MediaService(deps)
    this.courses = new CoursesService(deps)
    this.earnings = new EarningsService(deps)
  }

  private async load(profileId: string): Promise<ProfileWithRelations> {
    const profile = await this.deps.db.query.profiles.findFirst({
      where: { id: profileId },
      with: { owner: true, payoutAccount: true, avatar: true },
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
            detailsSubmitted: account.detailsSubmitted,
            chargesEnabled: account.chargesEnabled,
            payoutsEnabled: account.payoutsEnabled,
          }
        : null,
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
    if (input.teachingSampleMediaId) {
      const asset = await this.media.getOwnedReadyAsset(user, input.teachingSampleMediaId)
      if (asset.kind !== 'video' && asset.kind !== 'document')
        throw errors.badRequest('wrong_kind', 'Teaching samples must be a video or a PDF')
    }
    const values = {
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
      if (patch.avatarMediaId)
        await this.media.getOwnedReadyAsset(user, patch.avatarMediaId, 'image')
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
      with: { owner: true, payoutAccount: true },
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
        appliedAt: p.appliedAt.toISOString(),
      }),
    )
    const last = rows.length > query.limit ? rows[query.limit - 1] : null
    return { items, nextCursor: last ? encodeCursor(last.appliedAt, last.id) : null }
  }

  async detail(profileId: string): Promise<SupportProfileDetail> {
    const profile = await this.load(profileId)
    return {
      profile: await this.toView(profile, false),
      courses: await this.courses.listSummaries({ profileId }),
      payoutAccounts: profile.payoutAccount ? [payoutAccountView(profile.payoutAccount)] : [],
      earnings: await this.earnings.totalsForProfile(profileId),
    }
  }

  async approve(staff: SessionUser, profileId: string, note?: string): Promise<ProfileView> {
    const { db, env, mailer } = this.deps
    const profile = await this.load(profileId)
    if (profile.status === 'approved')
      throw errors.conflict('already_approved', 'This profile is already approved')
    await db
      .update(s.profiles)
      .set({
        status: 'approved',
        reviewNote: note ?? null,
        reviewedAt: this.deps.now(),
        reviewedBy: staff.id,
      })
      .where(eq(s.profiles.id, profileId))
    await recordAudit(this.deps, {
      actorId: staff.id,
      action: 'profile.approve',
      entityType: 'profile',
      entityId: profileId,
      profileId,
      metadata: { note: note ?? null },
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
          'Next: connect your Stripe account so learners can pay you, then build your first course. Courses go live after a quick review by our team.',
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
    await db
      .update(s.profiles)
      .set({
        status: 'rejected',
        reviewNote: reason,
        reviewedAt: this.deps.now(),
        reviewedBy: staff.id,
      })
      .where(eq(s.profiles.id, profileId))
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
