import { formatSgd } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  formatBps,
  PageHeader,
  StatCard,
  statusLabel,
  statusTone,
} from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { useT } from '@elevate/web-ui/preferences'
import { ArrowRight, BookOpen, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { useCourses } from '../lib/courses'
import { useCurrentProfile } from '../lib/profile'
import { useEarnings, useStripeLinks, useStripeStatus } from '../lib/queries'

/** The profile's payout account. Anyone on the profile sees its state; only the owner manages it. */
export function StripeCard() {
  const { profile, can } = useCurrentProfile()
  const stripe = useStripeStatus()
  const links = useStripeLinks()
  const t = useT()
  const status = stripe.data
  const canManage = can('stripe.links')

  // Payable: the account is active on our side and Stripe allows charges.
  const enabled = status?.status === 'active' && status.chargesEnabled
  // A company whose Stripe side is done but whose legal name Elevate has not matched (again).
  const awaitingNameCheck =
    !enabled && status?.businessType === 'company' && status.chargesEnabled && !status.nameVerified
  return (
    <Card as="section">
      <CardHeader
        title={t('payments.title')}
        description={
          enabled
            ? t('payments.description.enabled')
            : awaitingNameCheck
              ? t('payments.description.nameCheck')
              : t('payments.description.connect')
        }
        action={
          <Badge tone={enabled ? 'success' : status?.connected ? 'warning' : 'neutral'}>
            {enabled
              ? t('payments.badge.enabled')
              : awaitingNameCheck
                ? t('payments.badge.nameCheck')
                : status?.connected
                  ? t('payments.badge.onboarding')
                  : t('payments.badge.notConnected')}
          </Badge>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        {awaitingNameCheck ? (
          <>
            <span className="text-small text-ink-secondary">{t('payments.nameCheck.note')}</span>
            {canManage ? (
              <Button
                variant="secondary"
                icon={ExternalLink}
                loading={links.busy}
                onClick={links.openDashboard}
              >
                {t('stripe.openDashboard')}
              </Button>
            ) : null}
          </>
        ) : !canManage ? (
          <span className="text-small text-ink-secondary">{t('payments.ownerOnly')}</span>
        ) : enabled ? (
          <Button
            variant="secondary"
            icon={ExternalLink}
            loading={links.busy}
            onClick={links.openDashboard}
          >
            {t('stripe.openDashboard')}
          </Button>
        ) : (
          <Button
            variant="accent"
            icon={CreditCard}
            loading={links.busy || stripe.isPending}
            onClick={links.connect}
          >
            {status?.connected ? t('payments.finishOnboarding') : t('stripe.connect')}
          </Button>
        )}
        {enabled ? (
          <span className="text-small text-ink-tertiary">
            {t('payments.commission', {
              rate: profile ? formatBps(profile.commissionBps) : '—',
            })}
          </span>
        ) : null}
        {status && !enabled && !awaitingNameCheck && status.detailsSubmitted ? (
          <span className="text-small text-ink-secondary">{t('payments.verifying')}</span>
        ) : null}
      </div>
    </Card>
  )
}

export function Dashboard() {
  const { user } = usePortalAuth()
  const { displayName, path, can } = useCurrentProfile()
  const courses = useCourses()
  const seesMoney = can('earnings.read')
  const earnings = useEarnings(seesMoney)
  const list = courses.data ?? []
  const live = list.filter((c) => c.status === 'live').length
  const waiting = list.filter((c) => c.pendingChanges).length
  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`Welcome, ${displayName}`} description={user?.email} />
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          label="Live courses"
          value={courses.isPending ? '—' : String(live)}
          hint="Approved and on sale"
        />
        {seesMoney ? (
          <>
            <StatCard
              label="Sales"
              value={earnings.data ? String(earnings.data.totals.paymentCount) : '—'}
              hint="Paid enrolments across your courses"
            />
            <Link to={path('/earnings')} className="block">
              <StatCard
                label="Net earnings"
                value={earnings.data ? formatSgd(earnings.data.totals.netCents) : '—'}
                hint="After Stripe fees and commission · see earnings"
                className="h-full transition-colors hover:border-brand"
              />
            </Link>
          </>
        ) : (
          <StatCard
            label="Changes waiting"
            value={courses.isPending ? '—' : String(waiting)}
            hint="Live courses with edits that need approval"
          />
        )}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <StripeCard />
        <Card as="section">
          <CardHeader
            title="Courses"
            description="Author a course, then submit it for review."
            action={<ShieldCheck className="size-5 text-brand-fg" />}
          />
          {list.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              body="Create a course, add lessons and content, then submit it for review."
              action={
                <Link to={path('/courses')}>
                  <Button variant="secondary">Go to courses</Button>
                </Link>
              }
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-border">
              {list.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    to={path(`/courses/${c.id}`)}
                    className="flex items-center justify-between gap-3 py-3 hover:text-brand-fg"
                  >
                    <span className="min-w-0 truncate font-semibold">{c.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={statusTone[c.status]}>{statusLabel(c.status)}</Badge>
                      <ArrowRight className="size-4 text-ink-tertiary" />
                    </span>
                  </Link>
                </li>
              ))}
              {list.length > 5 ? (
                <li className="pt-3">
                  <Link to={path('/courses')} className="text-small font-semibold text-brand-fg">
                    All {list.length} courses
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
