import type {
  LegalEntityView,
  NameCheckDecision,
  NameCheckRecord,
  NameCheckView,
  SupportLegalEntity,
} from '@elevate/core'
import type { schema as s } from '@elevate/db'
import type { Deps } from '../deps'
import { simpleEmail } from '../emails/templates'
import { errors } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'
import { recordAudit } from './audit.service'
import { ConnectService } from './connect.service'
import { MediaService } from './media.service'

type LegalEntityRow = typeof s.legalEntities.$inferSelect

/** The audit action of a name-check decision. The check's history is read back by this name. */
const NAME_CHECK_ACTION = 'payout_account.name_check'

/** The company as the people on its profile see it. */
export function legalEntityView(entity: LegalEntityRow): LegalEntityView {
  return {
    uen: entity.uen,
    legalName: entity.legalName,
    entityType: entity.entityType,
    checkStatus: entity.checkStatus,
    rejectionReason: entity.rejectionReason,
    registryDocumentMediaId: entity.registryDocumentMediaId,
  }
}

/**
 * The registered company behind a corporate profile, and the two things Support checks about it:
 * the company against its registry document (when the application is reviewed), and the legal
 * name on its Stripe account against the company (before its payout account can be paid).
 */
export class LegalEntitiesService {
  private readonly media: MediaService
  private readonly connect: ConnectService
  constructor(private readonly deps: Deps) {
    this.media = new MediaService(deps)
    this.connect = new ConnectService(deps)
  }

  /** One UEN backs one profile, whatever that profile's status. */
  async assertUenFree(uen: string, exceptEntityId?: string): Promise<void> {
    const holder = await this.deps.db.query.legalEntities.findFirst({
      where: { uen },
      columns: { id: true },
    })
    if (holder && holder.id !== exceptEntityId) {
      throw errors.conflict(
        'uen_in_use',
        'A company with this UEN already has a profile on Elevate. Contact Elevate Support if that is your company.',
      )
    }
  }

  /** The registry document is a finished `document` upload of the applicant's own. */
  async assertRegistryDocument(user: SessionUser, mediaId: string): Promise<void> {
    const asset = await this.deps.db.query.mediaAssets.findFirst({ where: { id: mediaId } })
    if (!asset || asset.uploaderId !== user.id) throw errors.notFound('Registry document')
    if (asset.kind !== 'document')
      throw errors.badRequest('wrong_kind', 'The registry document must be a PDF')
    if (asset.status !== 'ready')
      throw errors.conflict('asset_not_ready', 'That file has not finished uploading')
  }

  async supportView(entity: LegalEntityRow): Promise<SupportLegalEntity> {
    const { db } = this.deps
    const checker = entity.checkedBy
      ? await db.query.users.findFirst({
          where: { id: entity.checkedBy },
          columns: { email: true },
        })
      : null
    const document = entity.registryDocumentMediaId
      ? await db.query.mediaAssets.findFirst({ where: { id: entity.registryDocumentMediaId } })
      : null
    return {
      ...legalEntityView(entity),
      id: entity.id,
      checkedBy: checker?.email ?? null,
      checkedAt: entity.checkedAt?.toISOString() ?? null,
      registryDocument: document ? await this.media.toView(document) : null,
    }
  }

  /** The company, its payout account and what Stripe says about that account right now. */
  private async companyAccount(profileId: string) {
    const { db, payments } = this.deps
    const profile = await db.query.profiles.findFirst({
      where: { id: profileId },
      with: { owner: true, legalEntity: true, payoutAccount: true },
    })
    if (!profile) throw errors.notFound('Profile')
    const entity = profile.legalEntity
    if (profile.type !== 'corporate' || !entity) {
      throw errors.conflict('not_corporate', 'Only a company profile has a legal-name check')
    }
    const account = profile.payoutAccount
    if (!account?.stripeAccountId) {
      throw errors.conflict(
        'no_payout_account',
        'This company has not started Stripe onboarding yet, so there is no name to compare',
      )
    }
    const live = await payments.retrieveAccount(account.stripeAccountId)
    return { profile, entity, account, stripeAccountId: account.stripeAccountId, live }
  }

  private async nameCheckView(
    found: Awaited<ReturnType<LegalEntitiesService['companyAccount']>>,
    account = found.account,
  ): Promise<NameCheckView> {
    const verifier = account.nameVerifiedBy
      ? await this.deps.db.query.users.findFirst({
          where: { id: account.nameVerifiedBy },
          columns: { email: true },
        })
      : null
    return {
      payoutAccountId: account.id,
      stripeAccountId: found.stripeAccountId,
      stripeLegalName: found.live.legalName,
      entityLegalName: found.entity.legalName,
      uen: found.entity.uen,
      dashboardUrl: this.deps.payments.accountDashboardUrl(found.stripeAccountId),
      status: account.status,
      chargesEnabled: account.chargesEnabled,
      nameVerifiedAt: account.nameVerifiedAt?.toISOString() ?? null,
      nameVerifiedBy: verifier?.email ?? null,
      lastDecision: await this.lastDecision(account.id),
    }
  }

  /**
   * The newest decision for a payout account, from the audit log: the only place a mismatch and
   * its note are kept, so the next person to open the check sees what was already said.
   */
  private async lastDecision(payoutAccountId: string): Promise<NameCheckRecord | null> {
    const { db } = this.deps
    const entry = await db.query.auditLog.findFirst({
      where: { action: NAME_CHECK_ACTION, entityType: 'payout_account', entityId: payoutAccountId },
      orderBy: { createdAt: 'desc' },
    })
    if (!entry) return null
    const actor = entry.actorId
      ? await db.query.users.findFirst({ where: { id: entry.actorId }, columns: { email: true } })
      : null
    const meta = entry.metadata ?? {}
    return {
      match: meta.match === true,
      source: meta.source === 'dashboard' ? 'dashboard' : 'api',
      stripeLegalName: typeof meta.stripeLegalName === 'string' ? meta.stripeLegalName : null,
      note: typeof meta.note === 'string' ? meta.note : null,
      decidedBy: actor?.email ?? null,
      decidedAt: entry.createdAt.toISOString(),
    }
  }

  /** The two names side by side. Reads Stripe; changes nothing. */
  async nameCheck(profileId: string): Promise<NameCheckView> {
    return this.nameCheckView(await this.companyAccount(profileId))
  }

  /**
   * Records whether the legal name on the company's Stripe account matches the company Elevate
   * approved. It needs no particular Stripe state: a match recorded before Stripe enables charges
   * activates the account when charges arrive. A mismatch keeps the account, or puts it back, in
   * `onboarding`, and the owner is told why. The audit entry holds both names as they were seen
   * and where the Stripe name was read: from Stripe's API, or typed in from the Stripe dashboard.
   */
  async decideNameCheck(
    staff: SessionUser,
    profileId: string,
    decision: NameCheckDecision,
  ): Promise<NameCheckView> {
    const { env, mailer } = this.deps
    const found = await this.companyAccount(profileId)
    const { profile, entity, account, live } = found
    if (decision.source === 'api' && !live.legalName) {
      throw errors.conflict(
        'no_stripe_name',
        'Stripe returned no legal name for this account. Read it in the Stripe dashboard and record the check with the dashboard as its source.',
      )
    }
    // Stripe's flags were just read, so the account is re-evaluated against them, not a stale copy.
    const updated = await this.connect.applyAccountState(account, live, {
      verifiedBy: decision.match ? staff.id : null,
      verifiedAt: decision.match ? this.deps.now() : null,
    })
    await recordAudit(this.deps, {
      actorId: staff.id,
      action: NAME_CHECK_ACTION,
      entityType: 'payout_account',
      entityId: account.id,
      profileId,
      metadata: {
        match: decision.match,
        source: decision.source,
        // As seen: Stripe's own answer, or what the staff member read in the dashboard.
        stripeLegalName:
          decision.source === 'api' ? live.legalName : (decision.stripeLegalName ?? null),
        entityLegalName: entity.legalName,
        uen: entity.uen,
        note: decision.note ?? null,
        status: updated.status,
      },
    })
    const settings = { href: `${env.TEACH_URL}/p/${profileId}`, label: 'Open Elevate Teach' }
    if (!decision.match) {
      await mailer.send(
        simpleEmail({
          to: profile.owner.email,
          title: `The legal name on ${profile.displayName}'s Stripe account does not match`,
          paragraphs: [
            `We compared the legal name on the Stripe account with the company we approved, ${entity.legalName} (UEN ${entity.uen}). They do not match, so learners cannot pay for this profile's courses yet.`,
            `Reviewer note: ${decision.note ?? ''}`,
            'Correct the company details in Stripe, then reply to this email and we will check again.',
          ],
          cta: settings,
        }),
      )
    } else if (updated.status === 'active' && account.status !== 'active') {
      await mailer.send(
        simpleEmail({
          to: profile.owner.email,
          title: `${profile.displayName} can now be paid`,
          paragraphs: [
            `The legal name on the Stripe account is ${entity.legalName}, the company we approved. Learners can now buy this profile's courses.`,
          ],
          cta: settings,
        }),
      )
    }
    return this.nameCheckView(found, updated)
  }
}
