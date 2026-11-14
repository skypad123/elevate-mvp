import type {
  CourseEarningsView,
  EarningsView,
  MoneyBreakdown,
  ReconciliationView,
} from '@elevate/core'
import type { schema as s } from '@elevate/db'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import type { ProfileActor } from '../middleware/auth'

type PaymentRow = typeof s.payments.$inferSelect

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

/** Teacher net left after refunds (a full refund reverses the whole transfer; partial pro-rata). */
export function netAfterRefunds(p: PaymentRow): number {
  if (p.refundedCents <= 0) return p.teacherNetCents
  if (p.refundedCents >= p.amountCents) return 0
  return p.teacherNetCents - Math.round((p.refundedCents * p.teacherNetCents) / p.amountCents)
}

export function breakdown(rows: PaymentRow[]): MoneyBreakdown {
  const sum = (f: (p: PaymentRow) => number) => rows.reduce((n, p) => n + f(p), 0)
  return {
    paymentCount: rows.length,
    grossCents: sum((p) => p.amountCents),
    discountCents: sum((p) => p.discountCents),
    stripeFeeCents: sum((p) => p.stripeFeeActualCents ?? p.stripeFeeEstimateCents),
    commissionCents: sum((p) => p.commissionCents),
    netCents: sum(netAfterRefunds),
    refundedCents: sum((p) => p.refundedCents),
  }
}

/**
 * Earnings are derived from stored Stripe events (payments + refunds), never settled separately.
 *
 * Every query here selects payments by payout account, not by profile or by course ownership:
 * earnings follow the account that was paid.
 */
export class EarningsService {
  constructor(private readonly deps: Deps) {}

  private async profileWithAccount(profileId: string) {
    const profile = await this.deps.db.query.profiles.findFirst({
      where: { id: profileId },
      with: { payoutAccount: true },
    })
    if (!profile) throw errors.notFound('Profile')
    return profile
  }

  /** Totals over every payment made to the profile's payout account. */
  async totalsForProfile(profileId: string): Promise<MoneyBreakdown> {
    const { payoutAccount } = await this.profileWithAccount(profileId)
    if (!payoutAccount) return breakdown([])
    return breakdown(
      await this.deps.db.query.payments.findMany({ where: { payoutAccountId: payoutAccount.id } }),
    )
  }

  async forProfile(actor: ProfileActor): Promise<EarningsView> {
    const { db } = this.deps
    const profile = await this.profileWithAccount(actor.profileId)
    const account = profile.payoutAccount
    const rows = account
      ? await db.query.payments.findMany({
          where: { payoutAccountId: account.id },
          orderBy: { paidAt: 'desc', createdAt: 'desc' },
          with: {
            course: { columns: { id: true, title: true, slug: true, status: true } },
            user: { columns: { email: true } },
          },
        })
      : []
    const byCourse = new Map<string, typeof rows>()
    for (const row of rows) byCourse.set(row.courseId, [...(byCourse.get(row.courseId) ?? []), row])

    // The per-course figures come from the account's payments. The profile's own courses that
    // have not sold yet are listed too, with zeros, so the page shows every course as before.
    const listed = new Map(rows.map((row) => [row.courseId, row.course]))
    const ownCourses = await db.query.courses.findMany({
      where: { profileId: actor.profileId },
      columns: { id: true, title: true, slug: true, status: true },
    })
    for (const course of ownCourses) if (!listed.has(course.id)) listed.set(course.id, course)

    const courses = [...listed.values()]
      .map((c) => ({
        ...breakdown(byCourse.get(c.id) ?? []),
        courseId: c.id,
        title: c.title,
        slug: c.slug,
        status: c.status,
      }))
      .sort((a, b) => b.netCents - a.netCents || a.title.localeCompare(b.title))
    return {
      totals: breakdown(rows),
      courses,
      recent: rows.slice(0, 20).map((p) => ({
        paymentId: p.id,
        courseTitle: p.course.title,
        learner: maskEmail(p.user.email),
        amountCents: p.amountCents,
        netCents: netAfterRefunds(p),
        status: p.status,
        paidAt: p.paidAt.toISOString(),
      })),
      stripe: {
        connected: !!account?.stripeAccountId,
        chargesEnabled: account?.chargesEnabled ?? false,
        payoutsEnabled: account?.payoutsEnabled ?? false,
      },
      commissionBps: profile.commissionBps,
    }
  }

  async forCourse(actor: ProfileActor, courseId: string): Promise<CourseEarningsView> {
    const { db } = this.deps
    const { payoutAccount } = await this.profileWithAccount(actor.profileId)
    const course = await db.query.courses.findFirst({
      where: { id: courseId },
      columns: {
        id: true,
        title: true,
        slug: true,
        status: true,
        priceCents: true,
        profileId: true,
      },
    })
    const rows = payoutAccount
      ? await db.query.payments.findMany({
          where: { courseId, payoutAccountId: payoutAccount.id },
          orderBy: { paidAt: 'desc', createdAt: 'desc' },
          with: { user: { columns: { email: true } }, promoCode: { columns: { code: true } } },
        })
      : []
    // Visible when the profile owns the course, or its account was paid for it.
    if (!course || (course.profileId !== actor.profileId && rows.length === 0))
      throw errors.notFound('Course')
    return {
      course: {
        ...breakdown(rows),
        courseId: course.id,
        title: course.title,
        slug: course.slug,
        status: course.status,
        priceCents: course.priceCents,
      },
      payments: rows.map((p) => ({
        paymentId: p.id,
        learner: maskEmail(p.user.email),
        amountCents: p.amountCents,
        discountCents: p.discountCents,
        stripeFeeCents: p.stripeFeeActualCents ?? p.stripeFeeEstimateCents,
        commissionCents: p.commissionCents,
        netCents: netAfterRefunds(p),
        refundedCents: p.refundedCents,
        status: p.status,
        promoCode: p.promoCode?.code ?? null,
        paidAt: p.paidAt.toISOString(),
      })),
    }
  }

  /** Compares Σ teacher net in our ledger with Stripe's transfers to the payout account. */
  async reconcile(actor: ProfileActor): Promise<ReconciliationView> {
    const { payoutAccount } = await this.profileWithAccount(actor.profileId)
    if (!payoutAccount?.stripeAccountId)
      throw errors.conflict('stripe_not_connected', 'Connect Stripe to reconcile earnings')
    const rows = await this.deps.db.query.payments.findMany({
      where: { payoutAccountId: payoutAccount.id },
    })
    const ledgerNetCents = breakdown(rows).netCents
    const stripeTransferTotalCents = await this.deps.payments.listTransferAmountCents(
      payoutAccount.stripeAccountId,
    )
    return {
      stripeTransferTotalCents,
      ledgerNetCents,
      differenceCents: stripeTransferTotalCents - ledgerNetCents,
      checkedAt: this.deps.now().toISOString(),
    }
  }
}
