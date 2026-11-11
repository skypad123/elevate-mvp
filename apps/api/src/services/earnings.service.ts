import type {
  CourseEarningsView,
  EarningsView,
  MoneyBreakdown,
  ReconciliationView,
} from '@elevate/core'
import type { schema as s } from '@elevate/db'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'

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

/** Earnings are derived from stored Stripe events (payments + refunds), never settled separately. */
export class EarningsService {
  constructor(private readonly deps: Deps) {}

  async forTeacher(user: SessionUser): Promise<EarningsView> {
    const { db } = this.deps
    const profile = await db.query.teacherProfiles.findFirst({ where: { userId: user.id } })
    const rows = await db.query.payments.findMany({
      where: { teacherId: user.id },
      orderBy: { paidAt: 'desc', createdAt: 'desc' },
      with: {
        course: { columns: { id: true, title: true, slug: true, status: true } },
        user: { columns: { email: true } },
      },
    })
    const byCourse = new Map<string, typeof rows>()
    for (const row of rows) byCourse.set(row.courseId, [...(byCourse.get(row.courseId) ?? []), row])
    const ownCourses = await db.query.courses.findMany({
      where: { teacherId: user.id },
      columns: { id: true, title: true, slug: true, status: true },
    })
    const courses = ownCourses
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
        connected: !!profile?.stripeAccountId,
        chargesEnabled: profile?.stripeChargesEnabled ?? false,
        payoutsEnabled: profile?.stripePayoutsEnabled ?? false,
      },
      commissionBps: profile?.commissionBps ?? this.deps.env.DEFAULT_COMMISSION_BPS,
    }
  }

  async forCourse(user: SessionUser, courseId: string): Promise<CourseEarningsView> {
    const { db } = this.deps
    const course = await db.query.courses.findFirst({
      where: { id: courseId },
      columns: {
        id: true,
        title: true,
        slug: true,
        status: true,
        priceCents: true,
        teacherId: true,
      },
    })
    if (!course || course.teacherId !== user.id) throw errors.notFound('Course')
    const rows = await db.query.payments.findMany({
      where: { courseId, teacherId: user.id },
      orderBy: { paidAt: 'desc', createdAt: 'desc' },
      with: { user: { columns: { email: true } }, promoCode: { columns: { code: true } } },
    })
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

  /** Compares Σ teacher net in our ledger with Stripe's transfers to the connected account. */
  async reconcile(user: SessionUser): Promise<ReconciliationView> {
    const profile = await this.deps.db.query.teacherProfiles.findFirst({
      where: { userId: user.id },
    })
    if (!profile?.stripeAccountId)
      throw errors.conflict('stripe_not_connected', 'Connect Stripe to reconcile earnings')
    const rows = await this.deps.db.query.payments.findMany({ where: { teacherId: user.id } })
    const ledgerNetCents = breakdown(rows).netCents
    const stripeTransferTotalCents = await this.deps.payments.listTransferAmountCents(
      profile.stripeAccountId,
    )
    return {
      stripeTransferTotalCents,
      ledgerNetCents,
      differenceCents: stripeTransferTotalCents - ledgerNetCents,
      checkedAt: this.deps.now().toISOString(),
    }
  }
}
