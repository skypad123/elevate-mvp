import type { RecoverOwner } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, eq } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'
import { recordAudit } from './audit.service'

type UserRow = typeof s.users.$inferSelect
type ProfileWithOwner = typeof s.profiles.$inferSelect & { owner: UserRow }

/**
 * Owner recovery: the one way a profile's owner changes. It is for an owner who can no longer
 * sign in, and only a `super_admin` can do it (the route checks that).
 *
 * - A personal profile belongs to a person, so the person stays and their email address changes.
 * - A corporate profile belongs to a company, so the company names another person, in writing.
 *
 * Either way the change is audited, both addresses are emailed, and the sessions of whoever lost
 * access are ended. This is a takeover route by design: Support cannot fully verify who is
 * asking, which is why it is limited to `super_admin`, recorded and announced to both sides.
 */
export class RecoveryService {
  constructor(private readonly deps: Deps) {}

  async recoverOwner(staff: SessionUser, profileId: string, input: RecoverOwner): Promise<void> {
    const profile = await this.deps.db.query.profiles.findFirst({
      where: { id: profileId },
      with: { owner: true },
    })
    if (!profile) throw errors.notFound('Profile')
    if ('newEmail' in input) {
      if (profile.type !== 'personal') {
        throw errors.badRequest(
          'wrong_recovery',
          'A company profile is recovered by naming a new owner, not by changing an email address',
        )
      }
      return this.changeOwnerEmail(staff, profile, input.newEmail)
    }
    if (profile.type !== 'corporate') {
      throw errors.badRequest(
        'wrong_recovery',
        'A personal profile is recovered by changing its owner’s email address',
      )
    }
    return this.changeOwner(staff, profile, input)
  }

  /** Personal: the owner's account gets a new address, which is also how they sign in. */
  private async changeOwnerEmail(
    staff: SessionUser,
    profile: ProfileWithOwner,
    newEmail: string,
  ): Promise<void> {
    const { db, env, mailer } = this.deps
    const owner = profile.owner
    const oldEmail = owner.email
    if (oldEmail.toLowerCase() === newEmail) {
      throw errors.conflict('same_email', 'That is already the owner’s address')
    }
    const taken = await db.query.users.findFirst({
      where: { email: newEmail },
      columns: { id: true },
    })
    if (taken) {
      throw errors.conflict('email_taken', 'Another Elevate account already uses that address')
    }
    await db.transaction(async (tx) => {
      await tx.update(s.users).set({ email: newEmail }).where(eq(s.users.id, owner.id))
      // The email identity is what a sign-in link resolves to, so it moves with the address.
      await tx
        .update(s.identities)
        .set({ providerSubject: newEmail })
        .where(and(eq(s.identities.userId, owner.id), eq(s.identities.provider, 'email')))
      // Whoever holds a session under the old address is signed out.
      await tx.delete(s.sessions).where(eq(s.sessions.userId, owner.id))
    })
    await recordAudit(this.deps, {
      actorId: staff.id,
      action: 'profile.recover_owner',
      entityType: 'profile',
      entityId: profile.id,
      profileId: profile.id,
      metadata: { kind: 'personal', userId: owner.id, fromEmail: oldEmail, toEmail: newEmail },
    })
    const signIn = { href: `${env.TEACH_URL}/sign-in`, label: 'Sign in to Elevate Teach' }
    await mailer.send(
      simpleEmail({
        to: oldEmail,
        title: 'The sign-in address of your Elevate account was changed',
        paragraphs: [
          `Elevate Support changed the address of the account that owns "${profile.displayName}" from ${oldEmail} to ${newEmail}. You have been signed out everywhere.`,
          'If you did not ask for this, reply to this email at once.',
        ],
      }),
    )
    await mailer.send(
      simpleEmail({
        to: newEmail,
        title: 'You can now sign in to Elevate with this address',
        paragraphs: [
          `Elevate Support moved the account that owns "${profile.displayName}" to this address. It was ${oldEmail} before.`,
          'Sign in with this address from now on. Your profile, courses and earnings are unchanged.',
        ],
        cta: signIn,
      }),
    )
  }

  /** Corporate: another existing user becomes the owner, on the company officer's authorisation. */
  private async changeOwner(
    staff: SessionUser,
    profile: ProfileWithOwner,
    input: Extract<RecoverOwner, { newOwnerUserId: string }>,
  ): Promise<void> {
    const { db, env, mailer } = this.deps
    const previous = profile.owner
    if (input.newOwnerUserId === previous.id) {
      throw errors.conflict('already_owner', 'That person is already the owner of this profile')
    }
    const next = await db.query.users.findFirst({ where: { id: input.newOwnerUserId } })
    if (!next) throw errors.notFound('User')
    // The authorisation is a finished PDF that the staff member doing the recovery uploaded.
    const authorisation = await db.query.mediaAssets.findFirst({
      where: { id: input.authorisationMediaId },
    })
    if (!authorisation || authorisation.uploaderId !== staff.id) {
      throw errors.notFound('Authorisation document')
    }
    if (authorisation.kind !== 'document') {
      throw errors.badRequest('wrong_kind', 'The authorisation must be a PDF')
    }
    if (authorisation.status !== 'ready') {
      throw errors.conflict('asset_not_ready', 'That file has not finished uploading')
    }

    const keepAsManager = !input.removePreviousOwner
    await db.transaction(async (tx) => {
      await tx.update(s.profiles).set({ ownerUserId: next.id }).where(eq(s.profiles.id, profile.id))
      // The owner is a column on the profile and never a member as well.
      await tx
        .delete(s.profileMemberships)
        .where(
          and(
            eq(s.profileMemberships.profileId, profile.id),
            eq(s.profileMemberships.userId, next.id),
          ),
        )
      if (keepAsManager) {
        await tx
          .insert(s.profileMemberships)
          .values({
            profileId: profile.id,
            userId: previous.id,
            role: 'manager',
            addedBy: staff.id,
            createdAt: this.deps.now(),
          })
          .onConflictDoNothing()
      }
      // The previous owner is signed out; the new owner's sessions are kept.
      await tx.delete(s.sessions).where(eq(s.sessions.userId, previous.id))
    })
    await recordAudit(this.deps, {
      actorId: staff.id,
      action: 'profile.recover_owner',
      entityType: 'profile',
      entityId: profile.id,
      profileId: profile.id,
      metadata: {
        kind: 'corporate',
        fromUserId: previous.id,
        fromEmail: previous.email,
        toUserId: next.id,
        toEmail: next.email,
        authorisationMediaId: authorisation.id,
        previousOwnerKeptAsManager: keepAsManager,
      },
    })
    await mailer.send(
      simpleEmail({
        to: previous.email,
        title: `You are no longer the owner of ${profile.displayName}`,
        paragraphs: [
          `On the company’s written authorisation, Elevate Support made ${next.email} the owner of "${profile.displayName}". You have been signed out.`,
          keepAsManager
            ? 'You are still on the profile, as a manager.'
            : 'You have been removed from the profile.',
          'If you think this is a mistake, reply to this email.',
        ],
      }),
    )
    await mailer.send(
      simpleEmail({
        to: next.email,
        title: `You are now the owner of ${profile.displayName}`,
        paragraphs: [
          `On the company’s written authorisation, Elevate Support made you the owner of "${profile.displayName}". The previous owner was ${previous.email}.`,
          'As the owner you manage the profile’s members and its payout settings.',
        ],
        cta: { href: `${env.TEACH_URL}/p/${profile.id}`, label: 'Open the profile' },
      }),
    )
  }
}
