import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  formatBps,
  PageHeader,
  StatCard,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, usePortalAuth } from '@elevate/web-ui/portal'
import { BookOpen, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  openStripeDashboard,
  startStripeOnboarding,
  useStripeStatus,
  useTeacherProfile,
} from '../lib/queries'

export function StripeCard() {
  const { data: profile } = useTeacherProfile()
  const stripe = useStripeStatus(!!profile)
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const status = stripe.data

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      toast({ tone: 'danger', title: 'Stripe', description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const enabled = !!status?.chargesEnabled
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
        {enabled ? (
          <>
            <Button
              variant="secondary"
              icon={ExternalLink}
              loading={busy}
              onClick={() => run(openStripeDashboard)}
            >
              Open Stripe dashboard
            </Button>
            <span className="text-small text-ink-tertiary">
              Commission on your courses: {profile ? formatBps(profile.commissionBps) : '—'}
            </span>
          </>
        ) : (
          <Button
            variant="accent"
            icon={CreditCard}
            loading={busy || stripe.isPending}
            onClick={() => run(startStripeOnboarding)}
          >
            {status?.connected ? 'Finish Stripe onboarding' : 'Connect Stripe'}
          </Button>
        )}
        {status && !enabled && status.detailsSubmitted ? (
          <span className="text-small text-ink-secondary">Stripe is verifying your details.</span>
        ) : null}
      </div>
    </Card>
  )
}

export function Dashboard() {
  const { user } = usePortalAuth()
  const { data: profile } = useTeacherProfile()
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={profile ? `Welcome, ${profile.displayName}` : 'Welcome'}
        description={user?.email}
      />
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard label="Live courses" value="0" hint="Approved and on sale" />
        <StatCard label="Learners" value="0" hint="Active enrolments" />
        <StatCard label="Net earnings" value="S$0.00" hint="After Stripe fees and commission" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <StripeCard />
        <Card as="section">
          <CardHeader
            title="Courses"
            description="Author a course, then submit it for review."
            action={<ShieldCheck className="size-5 text-brand" />}
          />
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            body="Create a course, add lessons and content, then submit it for review."
            action={
              <Link to="/courses">
                <Button variant="secondary">Go to courses</Button>
              </Link>
            }
            className="py-8"
          />
        </Card>
      </div>
    </>
  )
}
