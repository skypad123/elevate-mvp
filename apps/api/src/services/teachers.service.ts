import {
  ANALYTICS_EVENTS,
  type TeacherApplication,
  type TeacherProfileView,
  type UpdateTeacherProfile,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'
import { recordAudit, trackEvent } from './audit.service'
import { MediaService } from './media.service'

type ProfileRow = typeof s.teacherProfiles.$inferSelect

export function teacherProfileView(profile: ProfileRow, email: string): TeacherProfileView {
  return {
    userId: profile.userId,
    email,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    credentials: profile.credentials,
    teachingSampleUrl: profile.teachingSampleUrl,
    teachingSampleMediaId: profile.teachingSampleMediaId,
    status: profile.status,
    reviewNote: profile.reviewNote,
    commissionBps: profile.commissionBps,
    stripe: {
      connected: !!profile.stripeAccountId,
      detailsSubmitted: profile.stripeDetailsSubmitted,
      chargesEnabled: profile.stripeChargesEnabled,
      payoutsEnabled: profile.stripePayoutsEnabled,
    },
    appliedAt: profile.appliedAt.toISOString(),
    reviewedAt: profile.reviewedAt?.toISOString() ?? null,
  }
}

export class TeachersService {
  private readonly media: MediaService
  constructor(private readonly deps: Deps) {
    this.media = new MediaService(deps)
  }

  async getProfile(userId: string): Promise<TeacherProfileView | null> {
    const profile = await this.deps.db.query.teacherProfiles.findFirst({
      where: { userId },
      with: { user: true },
    })
    return profile ? teacherProfileView(profile, profile.user.email) : null
  }

  async apply(user: SessionUser, input: TeacherApplication): Promise<TeacherProfileView> {
    const { db, env, mailer } = this.deps
    const existing = await db.query.teacherProfiles.findFirst({ where: { userId: user.id } })
    if (existing?.status === 'approved')
      throw errors.conflict('already_teacher', 'You are already an approved teacher')
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
      commissionBps: existing?.commissionBps ?? env.DEFAULT_COMMISSION_BPS,
    }
    const [profile] = await db
      .insert(s.teacherProfiles)
      .values({ userId: user.id, ...values, appliedAt: this.deps.now() })
      .onConflictDoUpdate({
        target: s.teacherProfiles.userId,
        set: { ...values, appliedAt: this.deps.now() },
      })
      .returning()
    if (!profile) throw new Error('failed to save application')

    if (!user.name)
      await db.update(s.users).set({ name: input.displayName }).where(eq(s.users.id, user.id))

    await trackEvent(this.deps, {
      userId: user.id,
      name: ANALYTICS_EVENTS.teacherApplied,
      properties: { reapply: !!existing },
    })
    await mailer.send(
      simpleEmail({
        to: user.email,
        title: 'We received your Elevate Teach application',
        paragraphs: [
          `Thanks, ${input.displayName}. Our team reviews every application by hand, usually within two working days.`,
          'We will email you as soon as there is a decision. You can edit your application from Elevate Teach until then.',
        ],
        cta: { href: `${env.TEACH_URL}/pending`, label: 'View application' },
      }),
    )
    return teacherProfileView(profile, user.email)
  }

  async updateProfile(user: SessionUser, patch: UpdateTeacherProfile): Promise<TeacherProfileView> {
    const [profile] = await this.deps.db
      .update(s.teacherProfiles)
      .set(patch)
      .where(eq(s.teacherProfiles.userId, user.id))
      .returning()
    if (!profile) throw errors.notFound('Teacher profile')
    return teacherProfileView(profile, user.email)
  }

  async approve(
    actor: SessionUser,
    teacherUserId: string,
    note?: string,
  ): Promise<TeacherProfileView> {
    const { db, env, mailer } = this.deps
    const profile = await db.query.teacherProfiles.findFirst({
      where: { userId: teacherUserId },
      with: { user: true },
    })
    if (!profile) throw errors.notFound('Teacher application')
    if (profile.status === 'approved')
      throw errors.conflict('already_approved', 'This teacher is already approved')
    const [updated] = await db
      .update(s.teacherProfiles)
      .set({
        status: 'approved',
        reviewNote: note ?? null,
        reviewedAt: this.deps.now(),
        reviewedBy: actor.id,
      })
      .where(eq(s.teacherProfiles.userId, teacherUserId))
      .returning()
    if (!updated) throw errors.notFound('Teacher application')
    await db
      .insert(s.userRoles)
      .values({ userId: teacherUserId, role: 'teacher', grantedBy: actor.id })
      .onConflictDoNothing()
    await recordAudit(this.deps, {
      actorId: actor.id,
      action: 'teacher.approve',
      entityType: 'teacher_profile',
      entityId: teacherUserId,
      metadata: { note: note ?? null },
    })
    await trackEvent(this.deps, { userId: teacherUserId, name: ANALYTICS_EVENTS.teacherApproved })
    await mailer.send(
      simpleEmail({
        to: profile.user.email,
        title: 'Welcome to Elevate Teach',
        paragraphs: [
          `Your application is approved, ${profile.displayName}.`,
          'Next: connect your Stripe account so learners can pay you, then build your first course. Courses go live after a quick review by our team.',
        ],
        cta: { href: env.TEACH_URL, label: 'Open Elevate Teach' },
      }),
    )
    return teacherProfileView(updated, profile.user.email)
  }

  async reject(
    actor: SessionUser,
    teacherUserId: string,
    reason: string,
  ): Promise<TeacherProfileView> {
    const { db, env, mailer } = this.deps
    const profile = await db.query.teacherProfiles.findFirst({
      where: { userId: teacherUserId },
      with: { user: true },
    })
    if (!profile) throw errors.notFound('Teacher application')
    if (profile.status === 'approved')
      throw errors.conflict(
        'already_approved',
        'Approved teachers cannot be rejected; revoke the role instead',
      )
    const [updated] = await db
      .update(s.teacherProfiles)
      .set({
        status: 'rejected',
        reviewNote: reason,
        reviewedAt: this.deps.now(),
        reviewedBy: actor.id,
      })
      .where(eq(s.teacherProfiles.userId, teacherUserId))
      .returning()
    if (!updated) throw errors.notFound('Teacher application')
    await recordAudit(this.deps, {
      actorId: actor.id,
      action: 'teacher.reject',
      entityType: 'teacher_profile',
      entityId: teacherUserId,
      metadata: { reason },
    })
    await mailer.send(
      simpleEmail({
        to: profile.user.email,
        title: 'About your Elevate Teach application',
        paragraphs: [
          `Thanks for applying, ${profile.displayName}. We are not able to approve the application as submitted.`,
          `Reviewer note: ${reason}`,
          'You are welcome to update your application and resubmit.',
        ],
        cta: { href: `${env.TEACH_URL}/apply`, label: 'Update application' },
      }),
    )
    return teacherProfileView(updated, profile.user.email)
  }

  async setCommission(
    actor: SessionUser,
    teacherUserId: string,
    commissionBps: number,
  ): Promise<TeacherProfileView> {
    const profile = await this.deps.db.query.teacherProfiles.findFirst({
      where: { userId: teacherUserId },
      with: { user: true },
    })
    if (!profile) throw errors.notFound('Teacher profile')
    const [updated] = await this.deps.db
      .update(s.teacherProfiles)
      .set({ commissionBps })
      .where(eq(s.teacherProfiles.userId, teacherUserId))
      .returning()
    if (!updated) throw errors.notFound('Teacher profile')
    await recordAudit(this.deps, {
      actorId: actor.id,
      action: 'teacher.commission',
      entityType: 'teacher_profile',
      entityId: teacherUserId,
      metadata: { from: profile.commissionBps, to: commissionBps },
    })
    return teacherProfileView(updated, profile.user.email)
  }
}
