import {
  type Capability,
  can,
  type InvitationAccepted,
  type InvitationPreview,
  type InvitationStatus,
  type InvitationView,
  type Invite,
  type MembershipRole,
  type MembersView,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, eq, gt, lt, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { hmacHex, randomToken } from '../lib/crypto'
import { errors } from '../lib/errors'
import type { ProfileActor, SessionUser } from '../middleware/auth'
import { recordAudit } from './audit.service'

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const INVITATION_WINDOW_MS = 24 * 60 * 60 * 1000
/** Invitation emails a profile may send in any 24 hours; a resend counts as one. */
export const INVITATIONS_PER_WINDOW = 20

type UserRow = typeof s.users.$inferSelect
type InvitationRow = typeof s.profileInvitations.$inferSelect
type Person = Pick<UserRow, 'name' | 'email'>

const nameOf = (person: Person | null | undefined): string | null =>
  person ? person.name?.trim() || person.email : null

const article = (role: MembershipRole) => (role === 'manager' ? 'a manager' : 'a writer')

/** Inviting, removing or revoking a role needs the capability for that role. */
const capabilityFor = (role: MembershipRole): Capability =>
  role === 'manager' ? 'members.manageManagers' : 'members.manageWriters'

const WHAT_A_ROLE_DOES: Record<MembershipRole, string> = {
  writer:
    'Writers create and edit course content. They cannot change prices, publish courses or see earnings.',
  manager:
    'Managers run the profile with the owner: courses, prices, members and earnings. Payout settings stay with the owner.',
}

function invitationView(
  row: InvitationRow & { inviter: Person | null; accepter: Person | null },
): InvitationView {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: nameOf(row.inviter),
    acceptedByEmail: row.accepter?.email ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Managers, writers and the invitations that bring them in.
 *
 * The owner is not a member: it is a column on the profile, and only Support's recovery changes
 * it. Managers exist only on corporate profiles. Every function that changes something takes the
 * actor `requireProfile` resolved and checks the capability for the role involved.
 */
export class MembersService {
  constructor(private readonly deps: Deps) {}

  private hash(token: string): string {
    return hmacHex(this.deps.env.SESSION_SECRET, token)
  }

  private assertCanManage(actor: ProfileActor, role: MembershipRole): void {
    if (!can(actor, capabilityFor(role))) throw errors.forbidden()
  }

  private async profile(profileId: string) {
    const profile = await this.deps.db.query.profiles.findFirst({
      where: { id: profileId },
      with: { owner: true },
    })
    if (!profile) throw errors.notFound('Profile')
    return profile
  }

  private async membership(profileId: string, userId: string) {
    return this.deps.db.query.profileMemberships.findFirst({
      where: { profileId, userId },
      with: { user: true },
    })
  }

  private async invitation(profileId: string, invitationId: string) {
    const invitation = await this.deps.db.query.profileInvitations.findFirst({
      where: { id: invitationId, profileId },
      with: { accepter: true },
    })
    if (!invitation) throw errors.notFound('Invitation')
    return invitation
  }

  /**
   * Expiry is applied when invitations are read: a pending invitation past its date becomes
   * `expired`. So an expired one never blocks a new invitation to the same address.
   */
  private async expireOverdue(profileId: string): Promise<void> {
    await this.deps.db
      .update(s.profileInvitations)
      .set({ status: 'expired' })
      .where(
        and(
          eq(s.profileInvitations.profileId, profileId),
          eq(s.profileInvitations.status, 'pending'),
          lt(s.profileInvitations.expiresAt, this.deps.now()),
        ),
      )
  }

  private async assertUnderLimit(profileId: string): Promise<void> {
    const since = new Date(this.deps.now().getTime() - INVITATION_WINDOW_MS)
    const [sent] = await this.deps.db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.profileInvitations)
      .where(
        and(
          eq(s.profileInvitations.profileId, profileId),
          gt(s.profileInvitations.createdAt, since),
        ),
      )
    if ((sent?.count ?? 0) >= INVITATIONS_PER_WINDOW) {
      throw errors.tooMany(
        `This profile has sent ${INVITATIONS_PER_WINDOW} invitations in the last 24 hours. Try again later.`,
      )
    }
  }

  async list(actor: ProfileActor): Promise<MembersView> {
    const { db } = this.deps
    await this.expireOverdue(actor.profileId)
    const members = await db.query.profileMemberships.findMany({
      where: { profileId: actor.profileId },
      with: { user: true, adder: true },
      orderBy: { createdAt: 'asc' },
    })
    const invitations = await db.query.profileInvitations.findMany({
      where: {
        profileId: actor.profileId,
        status: { in: ['pending', 'awaiting_confirmation'] },
      },
      with: { inviter: true, accepter: true },
      orderBy: { createdAt: 'desc' },
    })
    return {
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        addedAt: m.createdAt.toISOString(),
        addedBy: nameOf(m.adder),
      })),
      invitations: invitations.map(invitationView),
    }
  }

  /**
   * Sends an invitation. A second invitation to an address that already has a pending one, for
   * the same role, sends a new link and stops the old one.
   */
  async invite(
    user: SessionUser,
    actor: ProfileActor,
    input: Invite,
  ): Promise<{ invitation: InvitationView; dev?: { link: string } }> {
    const { db } = this.deps
    this.assertCanManage(actor, input.role)
    const profile = await this.profile(actor.profileId)
    if (input.role === 'manager' && profile.type !== 'corporate') {
      throw errors.conflict('managers_corporate_only', 'Only a company profile can have managers')
    }
    const invitee = await db.query.users.findFirst({ where: { email: input.email } })
    if (invitee) {
      if (invitee.id === profile.ownerUserId) {
        throw errors.conflict('already_owner', 'That address belongs to the owner of this profile')
      }
      if (await this.membership(profile.id, invitee.id)) {
        throw errors.conflict('already_member', 'That person is already a member of this profile')
      }
    }
    await this.expireOverdue(profile.id)
    const pending = await db.query.profileInvitations.findFirst({
      where: { profileId: profile.id, email: input.email, status: 'pending' },
    })
    if (pending && pending.role !== input.role) {
      throw errors.conflict(
        'invitation_pending',
        `That address already has a pending invitation as ${article(pending.role)}. Revoke it first to change the role.`,
      )
    }
    return this.send(user, profile, input, pending ?? null)
  }

  /** A new link and a new 7 days for a pending invitation. The old link stops working. */
  async resend(
    user: SessionUser,
    actor: ProfileActor,
    invitationId: string,
  ): Promise<{ invitation: InvitationView; dev?: { link: string } }> {
    const profile = await this.profile(actor.profileId)
    await this.expireOverdue(profile.id)
    const invitation = await this.invitation(profile.id, invitationId)
    this.assertCanManage(actor, invitation.role)
    if (invitation.status !== 'pending') {
      throw errors.conflict(
        `invitation_${invitation.status}`,
        'Only an invitation that is still waiting can be sent again',
      )
    }
    return this.send(user, profile, { email: invitation.email, role: invitation.role }, invitation)
  }

  private async send(
    user: SessionUser,
    profile: Awaited<ReturnType<MembersService['profile']>>,
    input: Invite,
    replaces: InvitationRow | null,
  ): Promise<{ invitation: InvitationView; dev?: { link: string } }> {
    const { db, env, mailer } = this.deps
    await this.assertUnderLimit(profile.id)
    const token = randomToken(32)
    const now = this.deps.now()
    const created = await db.transaction(async (tx) => {
      if (replaces) {
        await tx
          .update(s.profileInvitations)
          .set({ status: 'revoked' })
          .where(
            and(
              eq(s.profileInvitations.id, replaces.id),
              eq(s.profileInvitations.status, 'pending'),
            ),
          )
      }
      // Two invitations to one address at the same moment: the index lets one through.
      const [row] = await tx
        .insert(s.profileInvitations)
        .values({
          profileId: profile.id,
          email: input.email,
          role: input.role,
          invitedBy: user.id,
          tokenHash: this.hash(token),
          expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
          createdAt: now,
        })
        .onConflictDoNothing()
        .returning()
      return row
    })
    if (!created) {
      throw errors.conflict('invitation_pending', 'An invitation to that address was just sent')
    }

    const inviter = nameOf(user) ?? 'Someone'
    const link = `${env.TEACH_URL}/invitations/${token}`
    await mailer.send(
      simpleEmail({
        to: input.email,
        title: `${inviter} invited you to ${profile.displayName} on Elevate Teach`,
        paragraphs: [
          `${inviter} invited you to join "${profile.displayName}" as ${article(input.role)}.`,
          WHAT_A_ROLE_DOES[input.role],
          'The link works for 7 days. If you were not expecting this, you can ignore this email.',
        ],
        cta: { href: link, label: 'View the invitation' },
      }),
    )
    await recordAudit(this.deps, {
      actorId: user.id,
      action: replaces ? 'member.invite.resend' : 'member.invite',
      entityType: 'profile_invitation',
      entityId: created.id,
      profileId: profile.id,
      metadata: { email: input.email, role: input.role },
    })
    const invitation = invitationView({ ...created, inviter: user, accepter: null })
    return env.DEV_ENDPOINTS_ENABLED && !env.isProd ? { invitation, dev: { link } } : { invitation }
  }

  /** Withdraws an invitation that has not become a membership yet. */
  async revoke(user: SessionUser, actor: ProfileActor, invitationId: string): Promise<MembersView> {
    await this.expireOverdue(actor.profileId)
    const invitation = await this.invitation(actor.profileId, invitationId)
    this.assertCanManage(actor, invitation.role)
    if (invitation.status !== 'pending' && invitation.status !== 'awaiting_confirmation') {
      throw errors.conflict(
        `invitation_${invitation.status}`,
        'Only an invitation that is still waiting can be revoked',
      )
    }
    await this.deps.db
      .update(s.profileInvitations)
      .set({ status: 'revoked' })
      .where(eq(s.profileInvitations.id, invitation.id))
    await recordAudit(this.deps, {
      actorId: user.id,
      action: 'member.invite.revoke',
      entityType: 'profile_invitation',
      entityId: invitation.id,
      profileId: actor.profileId,
      metadata: { email: invitation.email, role: invitation.role },
    })
    return this.list(actor)
  }

  /** Finds an invitation by its link token and applies expiry to it. */
  private async byToken(token: string) {
    const { db } = this.deps
    const invitation = await db.query.profileInvitations.findFirst({
      where: { tokenHash: this.hash(token) },
      with: { profile: { with: { owner: true } }, inviter: true },
    })
    if (!invitation) throw errors.notFound('Invitation')
    let status: InvitationStatus = invitation.status
    if (status === 'pending' && invitation.expiresAt.getTime() < this.deps.now().getTime()) {
      await db
        .update(s.profileInvitations)
        .set({ status: 'expired' })
        .where(
          and(
            eq(s.profileInvitations.id, invitation.id),
            eq(s.profileInvitations.status, 'pending'),
          ),
        )
      status = 'expired'
    }
    return { invitation, status }
  }

  /** What the invitation page shows. Needs no sign-in: the token is the proof. */
  async preview(token: string): Promise<InvitationPreview> {
    const { invitation, status } = await this.byToken(token)
    return {
      profileName: invitation.profile.displayName,
      profileType: invitation.profile.type,
      role: invitation.role,
      invitedByName: nameOf(invitation.inviter),
      expiresAt: invitation.expiresAt.toISOString(),
      status,
    }
  }

  /**
   * The signed-in user takes the invitation. A writer invitation, or one used from the invited
   * address, makes them a member at once. A manager invitation used from another address waits
   * for the owner to confirm it.
   */
  async accept(token: string, user: SessionUser): Promise<InvitationAccepted> {
    const { db, env, mailer } = this.deps
    const { invitation, status } = await this.byToken(token)
    if (status !== 'pending') {
      const why: Record<Exclude<InvitationStatus, 'pending'>, string> = {
        expired: 'This invitation has expired. Ask for a new one.',
        revoked: 'This invitation was withdrawn. Ask for a new one.',
        accepted: 'This invitation was already used.',
        awaiting_confirmation: 'This invitation was already used and is waiting for the owner.',
      }
      throw errors.conflict(`invitation_${status}`, why[status])
    }
    const profile = invitation.profile
    if (profile.status !== 'approved') {
      throw errors.conflict('profile_not_approved', 'This profile cannot take new members')
    }
    if (profile.ownerUserId === user.id) {
      throw errors.conflict('already_owner', 'You are the owner of this profile')
    }
    if (await this.membership(profile.id, user.id)) {
      throw errors.conflict('already_member', 'You are already a member of this profile')
    }
    if (invitation.role === 'manager' && profile.type !== 'corporate') {
      throw errors.conflict('managers_corporate_only', 'Only a company profile can have managers')
    }

    const sameAddress = user.email.toLowerCase() === invitation.email.toLowerCase()
    const joins = invitation.role === 'writer' || sameAddress
    const next = joins ? 'accepted' : 'awaiting_confirmation'
    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(s.profileInvitations)
        .set({ status: next, acceptedBy: user.id })
        .where(
          and(
            eq(s.profileInvitations.id, invitation.id),
            eq(s.profileInvitations.status, 'pending'),
          ),
        )
        .returning()
      if (claimed.length === 0) {
        throw errors.conflict('invitation_accepted', 'This invitation was already used.')
      }
      if (joins) {
        await tx.insert(s.profileMemberships).values({
          profileId: profile.id,
          userId: user.id,
          role: invitation.role,
          addedBy: invitation.invitedBy,
          createdAt: this.deps.now(),
        })
      }
    })
    await recordAudit(this.deps, {
      actorId: user.id,
      action: 'member.accept',
      entityType: 'profile_invitation',
      entityId: invitation.id,
      profileId: profile.id,
      metadata: { role: invitation.role, status: next, invitedEmail: invitation.email },
    })

    const who = nameOf(user) ?? user.email
    const members = { href: `${env.TEACH_URL}/p/${profile.id}/members`, label: 'Open members' }
    if (joins) {
      // The inviter hears about it, and so does the owner when someone else sent the invitation.
      const recipients = new Set<string>()
      if (invitation.inviter) recipients.add(invitation.inviter.email)
      if (invitation.invitedBy !== profile.ownerUserId) recipients.add(profile.owner.email)
      for (const to of recipients) {
        await mailer.send(
          simpleEmail({
            to,
            title: `${who} joined ${profile.displayName} as ${article(invitation.role)}`,
            paragraphs: [
              `${who} (${user.email}) accepted the invitation sent to ${invitation.email}.`,
              'If this is not who you meant to invite, remove them on the members page.',
            ],
            cta: members,
          }),
        )
      }
    } else {
      await mailer.send(
        simpleEmail({
          to: profile.owner.email,
          title: `Confirm ${who} as a manager of ${profile.displayName}`,
          paragraphs: [
            `The manager invitation sent to ${invitation.email} was accepted from a different address: ${user.email}.`,
            'They are not a manager yet. Confirm them on the members page if this is the right person, or revoke the invitation.',
          ],
          cta: members,
        }),
      )
    }
    return {
      profileId: profile.id,
      profileName: profile.displayName,
      role: invitation.role,
      status: next,
    }
  }

  /** The owner confirms a manager who accepted from an address other than the invited one. */
  async confirm(
    user: SessionUser,
    actor: ProfileActor,
    invitationId: string,
  ): Promise<MembersView> {
    const { db, env, mailer } = this.deps
    const profile = await this.profile(actor.profileId)
    const invitation = await this.invitation(profile.id, invitationId)
    this.assertCanManage(actor, invitation.role)
    if (invitation.status !== 'awaiting_confirmation' || !invitation.accepter) {
      throw errors.conflict(
        'invitation_not_awaiting',
        'This invitation is not waiting for confirmation',
      )
    }
    const accepter = invitation.accepter
    if (accepter.id === profile.ownerUserId) {
      throw errors.conflict('already_owner', 'That person is the owner of this profile')
    }
    if (await this.membership(profile.id, accepter.id)) {
      throw errors.conflict('already_member', 'That person is already a member of this profile')
    }
    if (invitation.role === 'manager' && profile.type !== 'corporate') {
      throw errors.conflict('managers_corporate_only', 'Only a company profile can have managers')
    }
    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(s.profileInvitations)
        .set({ status: 'accepted' })
        .where(
          and(
            eq(s.profileInvitations.id, invitation.id),
            eq(s.profileInvitations.status, 'awaiting_confirmation'),
          ),
        )
        .returning()
      if (claimed.length === 0) {
        throw errors.conflict(
          'invitation_not_awaiting',
          'This invitation is not waiting for confirmation',
        )
      }
      await tx.insert(s.profileMemberships).values({
        profileId: profile.id,
        userId: accepter.id,
        role: invitation.role,
        addedBy: user.id,
        createdAt: this.deps.now(),
      })
    })
    await recordAudit(this.deps, {
      actorId: user.id,
      action: 'member.confirm',
      entityType: 'profile_invitation',
      entityId: invitation.id,
      profileId: profile.id,
      metadata: { userId: accepter.id, role: invitation.role, invitedEmail: invitation.email },
    })
    await mailer.send(
      simpleEmail({
        to: accepter.email,
        title: `You are now ${article(invitation.role)} of ${profile.displayName}`,
        paragraphs: [
          `${nameOf(user) ?? 'The owner'} confirmed you as ${article(invitation.role)} of "${profile.displayName}" on Elevate Teach.`,
          WHAT_A_ROLE_DOES[invitation.role],
        ],
        cta: { href: `${env.TEACH_URL}/p/${profile.id}`, label: 'Open the profile' },
      }),
    )
    return this.list(actor)
  }

  /** The owner removes anyone; a manager removes writers only. */
  async remove(user: SessionUser, actor: ProfileActor, userId: string): Promise<MembersView> {
    const membership = await this.membership(actor.profileId, userId)
    if (!membership) throw errors.notFound('Member')
    this.assertCanManage(actor, membership.role)
    await this.deleteMembership(actor.profileId, userId)
    await recordAudit(this.deps, {
      actorId: user.id,
      action: 'member.remove',
      entityType: 'profile_membership',
      entityId: userId,
      profileId: actor.profileId,
      metadata: { email: membership.user.email, role: membership.role },
    })
    return this.list(actor)
  }

  /** A manager or writer removes their own membership. The owner cannot leave. */
  async leave(actor: ProfileActor): Promise<void> {
    if (actor.role === 'owner') {
      throw errors.conflict(
        'owner_cannot_leave',
        'The owner cannot leave a profile. Contact Elevate Support to change the owner.',
      )
    }
    // Staff act inside a profile without belonging to it, so there is nothing to leave.
    if (actor.role === 'staff') throw errors.notFound('Member')
    await this.deleteMembership(actor.profileId, actor.userId)
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: 'member.leave',
      entityType: 'profile_membership',
      entityId: actor.userId,
      profileId: actor.profileId,
      metadata: { role: actor.role },
    })
  }

  private async deleteMembership(profileId: string, userId: string): Promise<void> {
    await this.deps.db
      .delete(s.profileMemberships)
      .where(
        and(eq(s.profileMemberships.profileId, profileId), eq(s.profileMemberships.userId, userId)),
      )
  }

  /**
   * Writer to manager, or manager to writer. The route lets only the owner in, and only a
   * corporate profile has managers, so on a personal profile there is no role to change to.
   */
  async changeRole(
    user: SessionUser,
    actor: ProfileActor,
    userId: string,
    role: MembershipRole,
  ): Promise<MembersView> {
    const { db, env, mailer } = this.deps
    const profile = await this.profile(actor.profileId)
    if (profile.type !== 'corporate') {
      throw errors.conflict('managers_corporate_only', 'Only a company profile can have managers')
    }
    const membership = await this.membership(profile.id, userId)
    if (!membership) throw errors.notFound('Member')
    if (membership.role !== role) {
      await db
        .update(s.profileMemberships)
        .set({ role })
        .where(
          and(
            eq(s.profileMemberships.profileId, profile.id),
            eq(s.profileMemberships.userId, userId),
          ),
        )
      await recordAudit(this.deps, {
        actorId: user.id,
        action: 'member.role',
        entityType: 'profile_membership',
        entityId: userId,
        profileId: profile.id,
        metadata: { email: membership.user.email, from: membership.role, to: role },
      })
      await mailer.send(
        simpleEmail({
          to: membership.user.email,
          title: `You are now ${article(role)} of ${profile.displayName}`,
          paragraphs: [
            `${nameOf(user) ?? 'The owner'} changed your role on "${profile.displayName}" from ${membership.role} to ${role}.`,
            WHAT_A_ROLE_DOES[role],
          ],
          cta: { href: `${env.TEACH_URL}/p/${profile.id}`, label: 'Open the profile' },
        }),
      )
    }
    return this.list(actor)
  }
}
