import { formatSgd } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  formatBps,
  PageHeader,
  Skeleton,
  StatCard,
  statusTone,
} from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { useErrorMessage, useT } from '@elevate/web-ui/preferences'
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
  const t = useT()
  const errorMessage = useErrorMessage()
  const courses = useCourses()
  const seesMoney = can('earnings.read')
  const reviews = can('changeSet.review')
  const creates = can('course.create')
  const earnings = useEarnings(seesMoney)
  const list = courses.data ?? []
  const live = list.filter((c) => c.status === 'live').length
  const waiting = list.filter((c) => c.pendingChanges)
  return (
    <>
      <PageHeader
        eyebrow={t('nav.dashboard')}
        title={t('dashboard.welcome', { name: displayName })}
        description={user?.email}
      />
      {/* The people who approve a writer's edits learn about them here, not by opening each course. */}
      {reviews && waiting.length > 0 ? (
        <Card as="section" className="mb-6 border-warning">
          <CardHeader
            title={t('dashboard.review.title')}
            description={t('dashboard.review.description')}
          />
          <ul className="divide-y divide-border">
            {waiting.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate font-semibold text-ink">{c.title}</span>
                <Button asChild variant="secondary" size="sm" iconRight={ArrowRight}>
                  <Link to={path(`/courses/${c.id}/changes`)}>{t('dashboard.review.action')}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          label={t('dashboard.stat.live')}
          value={courses.isPending ? '—' : String(live)}
          hint={t('dashboard.stat.live.hint')}
        />
        {seesMoney ? (
          <>
            <StatCard
              label={t('dashboard.stat.sales')}
              value={earnings.data ? String(earnings.data.totals.paymentCount) : '—'}
              hint={t('dashboard.stat.sales.hint')}
            />
            <Link to={path('/earnings')} className="block">
              <StatCard
                label={t('dashboard.stat.net')}
                value={earnings.data ? formatSgd(earnings.data.totals.netCents) : '—'}
                hint={t('dashboard.stat.net.hint')}
                className="h-full transition-colors hover:border-brand"
              />
            </Link>
          </>
        ) : (
          <StatCard
            label={t('dashboard.stat.waiting')}
            value={courses.isPending ? '—' : String(waiting.length)}
            hint={t('dashboard.stat.waiting.hint')}
          />
        )}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <StripeCard />
        <Card as="section">
          <CardHeader
            title={t('nav.courses')}
            description={
              creates
                ? t('dashboard.courses.description')
                : t('dashboard.courses.description.writer')
            }
            action={<ShieldCheck className="size-5 text-brand-fg" />}
          />
          {courses.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : courses.isError ? (
            <EmptyState
              tone="danger"
              title={t('dashboard.courses.loadFailed')}
              body={errorMessage(courses.error)}
              className="py-8"
            />
          ) : list.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t('dashboard.courses.empty.title')}
              body={
                creates
                  ? t('dashboard.courses.empty.body')
                  : t('dashboard.courses.empty.body.writer')
              }
              action={
                creates ? (
                  <Button asChild variant="secondary">
                    <Link to={path('/courses')}>{t('dashboard.courses.open')}</Link>
                  </Button>
                ) : undefined
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
                      {c.pendingChanges ? (
                        <Badge tone="warning">{t('dashboard.courses.changesWaiting')}</Badge>
                      ) : null}
                      <Badge tone={statusTone[c.status]}>{t(`status.course.${c.status}`)}</Badge>
                      <ArrowRight className="size-4 text-ink-tertiary" />
                    </span>
                  </Link>
                </li>
              ))}
              {list.length > 5 ? (
                <li className="pt-3">
                  <Link to={path('/courses')} className="text-small font-semibold text-brand-fg">
                    {t('dashboard.courses.all', { count: list.length })}
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
