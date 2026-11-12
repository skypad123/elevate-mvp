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
  const status = stripe.data
  const canManage = can('stripe.links')

  // Payable: the account is active on our side and Stripe allows charges.
  const enabled = status?.status === 'active' && status.chargesEnabled
  return (
    <Card as="section">
      <CardHeader
        title="Payments"
        description={
          enabled
            ? 'Learners can pay you. Payouts land in your bank on Stripe’s schedule.'
            : 'Connect a Stripe account so learners can pay you. Takes about five minutes.'
        }
        action={
          <Badge tone={enabled ? 'success' : status?.connected ? 'warning' : 'neutral'}>
            {enabled
              ? 'Payments enabled'
              : status?.connected
                ? 'Onboarding incomplete'
                : 'Not connected'}
          </Badge>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        {!canManage ? (
          <span className="text-small text-ink-secondary">
            Only the profile’s owner can connect Stripe or open its dashboard.
          </span>
        ) : enabled ? (
          <Button
            variant="secondary"
            icon={ExternalLink}
            loading={links.busy}
            onClick={links.openDashboard}
          >
            Open Stripe dashboard
          </Button>
        ) : (
          <Button
            variant="accent"
            icon={CreditCard}
            loading={links.busy || stripe.isPending}
            onClick={links.connect}
          >
            {status?.connected ? 'Finish Stripe onboarding' : 'Connect Stripe'}
          </Button>
        )}
        {enabled ? (
          <span className="text-small text-ink-tertiary">
            Commission on your courses: {profile ? formatBps(profile.commissionBps) : '—'}
          </span>
        ) : null}
        {status && !enabled && status.detailsSubmitted ? (
          <span className="text-small text-ink-secondary">Stripe is verifying your details.</span>
        ) : null}
      </div>
    </Card>
  )
}

export function Dashboard() {
  const { user } = usePortalAuth()
  const { displayName, path, can } = useCurrentProfile()
  const courses = useCourses()
  const earnings = useEarnings(can('earnings.read'))
  const list = courses.data ?? []
  const live = list.filter((c) => c.status === 'live').length
  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`Welcome, ${displayName}`} description={user?.email} />
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          label="Live courses"
          value={courses.isPending ? '—' : String(live)}
          hint="Approved and on sale"
        />
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
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <StripeCard />
        <Card as="section">
          <CardHeader
            title="Courses"
            description="Author a course, then submit it for review."
            action={<ShieldCheck className="size-5 text-brand" />}
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
                    className="flex items-center justify-between gap-3 py-3 hover:text-brand"
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
                  <Link to={path('/courses')} className="text-small font-semibold text-brand">
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
