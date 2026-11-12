import type { StripeStatusView } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors } from '../lib/errors'
import type { ProfileActor } from '../middleware/auth'
import { recordAudit } from './audit.service'

type PayoutAccountRow = typeof s.payoutAccounts.$inferSelect

type AccountFlags = { detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean }

const NOT_CONNECTED: StripeStatusView = {
  connected: false,
  status: null,
  businessType: null,
  detailsSubmitted: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  nameVerified: false,
}

function statusView(account: PayoutAccountRow): StripeStatusView {
  return {
    connected: !!account.stripeAccountId,
    status: account.status,
    businessType: account.businessType,
    detailsSubmitted: account.detailsSubmitted,
    chargesEnabled: account.chargesEnabled,
    payoutsEnabled: account.payoutsEnabled,
    nameVerified: !!account.nameVerifiedAt,
  }
}

/**
 * Whether a payout account can be paid, from what Stripe says and what Support has checked.
 *
 * - An individual account is `active` while Stripe allows charges.
 * - A company account is `active` while Stripe allows charges and Support has recorded that the
 *   legal name Stripe holds matches the company Elevate approved.
 *
 * Anything else is `onboarding`. It is a pure function of the two inputs, so the order in which
 * they arrive does not matter, and an account goes back to `onboarding` if either is withdrawn.
 */
export function payoutStatus(account: {
  businessType: PayoutAccountRow['businessType']
  chargesEnabled: boolean
  nameVerifiedAt: Date | null
}): PayoutAccountRow['status'] {
  const nameOk = account.businessType === 'individual' || account.nameVerifiedAt !== null
  return account.chargesEnabled && nameOk ? 'active' : 'onboarding'
}

/** Stripe Connect for a profile's payout account: creation, onboarding links, status sync. */
export class ConnectService {
  constructor(private readonly deps: Deps) {}

  private async loadProfile(profileId: string) {
    const profile = await this.deps.db.query.profiles.findFirst({
      where: { id: profileId },
      with: { owner: true, payoutAccount: true },
    })
    if (!profile) throw errors.notFound('Profile')
    return profile
  }

  /**
   * The profile's payout account, created on first use. A profile has one account and keeps it:
   * asking again reuses it whatever its status.
   *
   * Creation runs in one transaction: insert our row, create the Stripe account with our row's ID
   * in its metadata, then store Stripe's ID. If Stripe refuses, the row is rolled back.
   */
  private async ensureAccount(
    profileId: string,
  ): Promise<PayoutAccountRow & { stripeAccountId: string }> {
    const { db, payments } = this.deps
    const profile = await this.loadProfile(profileId)
    const existing = profile.payoutAccount
    if (existing?.stripeAccountId) return { ...existing, stripeAccountId: existing.stripeAccountId }

    return db.transaction(async (tx) => {
      const [row] = existing
        ? [existing]
        : await tx
            .insert(s.payoutAccounts)
            .values({
              profileId,
              businessType: profile.type === 'corporate' ? 'company' : 'individual',
            })
            .returning()
      if (!row) throw new Error('failed to create payout account')
      const { accountId } = await payments.createConnectedAccount({
        businessType: row.businessType,
        profileId,
        payoutAccountId: row.id,
        email: profile.owner.email,
        displayName: profile.displayName,
      })
      const [saved] = await tx
        .update(s.payoutAccounts)
        .set({ stripeAccountId: accountId })
        .where(eq(s.payoutAccounts.id, row.id))
        .returning()
      if (!saved) throw new Error('failed to store the Stripe account')
      return { ...saved, stripeAccountId: accountId }
    })
  }

  /** Every Stripe link request is on record and the owner is told, whoever asked for it. */
  private async noteLinkRequest(actor: ProfileActor, kind: 'onboarding' | 'dashboard') {
    const { env, mailer } = this.deps
    const profile = await this.loadProfile(actor.profileId)
    await recordAudit(this.deps, {
      actorId: actor.userId,
      action: `stripe.${kind}_link`,
      entityType: 'profile',
      entityId: actor.profileId,
      profileId: actor.profileId,
    })
    await mailer.send(
      simpleEmail({
        to: profile.owner.email,
        title:
          kind === 'onboarding'
            ? 'Stripe onboarding was opened for your profile'
            : 'The Stripe dashboard was opened for your profile',
        paragraphs: [
          `A link to ${
            kind === 'onboarding' ? 'Stripe onboarding' : 'the Stripe dashboard'
          } for ${profile.displayName} was just requested from your Elevate Teach account.`,
          'If that was you, there is nothing to do. If it was not you, reply to this email and we will help you secure your account.',
        ],
        cta: { href: `${env.TEACH_URL}/p/${actor.profileId}/settings`, label: 'Review payouts' },
      }),
    )
  }

  async onboardingLink(actor: ProfileActor): Promise<{ url: string }> {
    const account = await this.ensureAccount(actor.profileId)
    const base = `${this.deps.env.TEACH_URL}/p/${actor.profileId}/stripe`
    const link = await this.deps.payments.createOnboardingLink({
      accountId: account.stripeAccountId,
      refreshUrl: `${base}/refresh`,
      returnUrl: `${base}/return`,
    })
    await this.noteLinkRequest(actor, 'onboarding')
    return link
  }

  async loginLink(actor: ProfileActor): Promise<{ url: string }> {
    const profile = await this.loadProfile(actor.profileId)
    const account = profile.payoutAccount
    if (!account?.stripeAccountId || !account.detailsSubmitted) {
      throw errors.conflict(
        'stripe_not_onboarded',
        'Finish Stripe onboarding before opening the dashboard',
      )
    }
    const link = await this.deps.payments.createLoginLink(account.stripeAccountId)
    await this.noteLinkRequest(actor, 'dashboard')
    return link
  }

  /**
   * The one place an account's Stripe flags are stored and its status decided (`payoutStatus`).
   * The webhook, the status poll and Support's name check all end here, so none of them can
   * activate an account the others would not, and a company account cannot become payable early
   * by any path. `activatedAt` keeps the first time the account became active.
   */
  async applyAccountState(
    account: PayoutAccountRow,
    flags: AccountFlags,
    nameCheck?: { verifiedBy: string | null; verifiedAt: Date | null },
  ): Promise<PayoutAccountRow> {
    const nameVerifiedAt = nameCheck ? nameCheck.verifiedAt : account.nameVerifiedAt
    const status = payoutStatus({
      businessType: account.businessType,
      chargesEnabled: flags.chargesEnabled,
      nameVerifiedAt,
    })
    const [updated] = await this.deps.db
      .update(s.payoutAccounts)
      .set({
        detailsSubmitted: flags.detailsSubmitted,
        chargesEnabled: flags.chargesEnabled,
        payoutsEnabled: flags.payoutsEnabled,
        status,
        ...(nameCheck
          ? { nameVerifiedBy: nameCheck.verifiedBy, nameVerifiedAt: nameCheck.verifiedAt }
          : {}),
        ...(status === 'active' && !account.activatedAt ? { activatedAt: this.deps.now() } : {}),
      })
      .where(eq(s.payoutAccounts.id, account.id))
      .returning()
    if (!updated) throw new Error(`payout account ${account.id} disappeared`)
    return updated
  }

  /**
   * Reads the live account from Stripe and applies it. Used on return from onboarding, when the
   * webhook may lag; the result is the state the webhook would set.
   */
  async syncStatus(profileId: string): Promise<StripeStatusView> {
    const profile = await this.loadProfile(profileId)
    const account = profile.payoutAccount
    if (!account?.stripeAccountId) return NOT_CONNECTED
    const live = await this.deps.payments.retrieveAccount(account.stripeAccountId)
    return statusView(await this.applyAccountState(account, live))
  }

  /**
   * Webhook: account.updated (Connect scope). An account we have no row for is an error, not
   * something to skip: the webhook route stores the message with the event for Support.
   */
  async applyAccountUpdated(account: Record<string, unknown>): Promise<'applied'> {
    const stripeAccountId = typeof account.id === 'string' ? account.id : null
    const row = stripeAccountId
      ? await this.deps.db.query.payoutAccounts.findFirst({ where: { stripeAccountId } })
      : null
    if (!row) throw new Error(`unknown_account: no payout account for ${stripeAccountId ?? '?'}`)
    await this.applyAccountState(row, {
      detailsSubmitted: !!account.details_submitted,
      chargesEnabled: !!account.charges_enabled,
      payoutsEnabled: !!account.payouts_enabled,
    })
    return 'applied'
  }
}
