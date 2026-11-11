import { schema as s } from '@elevate/db'
import { eq } from 'drizzle-orm'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'

export type TeacherStripeStatus = {
  connected: boolean
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

/** Stripe Connect for teachers: account creation, onboarding links, status sync. */
export class ConnectService {
  constructor(private readonly deps: Deps) {}

  private async profileFor(userId: string) {
    const profile = await this.deps.db.query.teacherProfiles.findFirst({
      where: { userId },
      with: { user: true },
    })
    if (!profile) throw errors.notFound('Teacher profile')
    if (profile.status !== 'approved')
      throw errors.forbidden('Your teacher application has not been approved yet')
    return profile
  }

  async ensureAccount(userId: string): Promise<string> {
    const profile = await this.profileFor(userId)
    if (profile.stripeAccountId) return profile.stripeAccountId
    const { accountId } = await this.deps.payments.createConnectedAccount({
      email: profile.user.email,
      userId,
      displayName: profile.displayName,
    })
    await this.deps.db
      .update(s.teacherProfiles)
      .set({ stripeAccountId: accountId })
      .where(eq(s.teacherProfiles.userId, userId))
    return accountId
  }

  async onboardingLink(userId: string): Promise<{ url: string }> {
    const accountId = await this.ensureAccount(userId)
    const base = this.deps.env.TEACH_URL
    return this.deps.payments.createOnboardingLink({
      accountId,
      refreshUrl: `${base}/stripe/refresh`,
      returnUrl: `${base}/stripe/return`,
    })
  }

  async loginLink(userId: string): Promise<{ url: string }> {
    const profile = await this.profileFor(userId)
    if (!profile.stripeAccountId || !profile.stripeDetailsSubmitted) {
      throw errors.conflict(
        'stripe_not_onboarded',
        'Finish Stripe onboarding before opening the dashboard',
      )
    }
    return this.deps.payments.createLoginLink(profile.stripeAccountId)
  }

  /** Pulls the live account state (used on return from onboarding, when webhooks may lag). */
  async syncStatus(userId: string): Promise<TeacherStripeStatus> {
    const profile = await this.profileFor(userId)
    if (!profile.stripeAccountId)
      return {
        connected: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      }
    const status = await this.deps.payments.retrieveAccount(profile.stripeAccountId)
    await this.deps.db
      .update(s.teacherProfiles)
      .set({
        stripeDetailsSubmitted: status.detailsSubmitted,
        stripeChargesEnabled: status.chargesEnabled,
        stripePayoutsEnabled: status.payoutsEnabled,
      })
      .where(eq(s.teacherProfiles.userId, userId))
    return { connected: true, ...status }
  }

  /** Webhook: account.updated (Connect scope). */
  async applyAccountUpdated(account: Record<string, unknown>): Promise<'applied' | 'unmatched'> {
    const accountId = typeof account.id === 'string' ? account.id : null
    if (!accountId) return 'unmatched'
    const updated = await this.deps.db
      .update(s.teacherProfiles)
      .set({
        stripeDetailsSubmitted: !!account.details_submitted,
        stripeChargesEnabled: !!account.charges_enabled,
        stripePayoutsEnabled: !!account.payouts_enabled,
      })
      .where(eq(s.teacherProfiles.stripeAccountId, accountId))
      .returning()
    return updated.length > 0 ? 'applied' : 'unmatched'
  }
}
