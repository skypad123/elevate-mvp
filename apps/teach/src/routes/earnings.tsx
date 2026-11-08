import { type EarningsView, formatSgd, type MoneyBreakdown } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  cn,
  DescriptionList,
  EmptyState,
  formatBps,
  formatDate,
  PageHeader,
  Skeleton,
  StatCard,
  statusLabel,
  statusTone,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@elevate/web-ui'
import { errorMessage } from '@elevate/web-ui/portal'
import { ArrowLeft, ExternalLink, Receipt, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  openStripeDashboard,
  useCourseEarnings,
  useEarnings,
  useReconciliation,
} from '../lib/queries'

const dateTime: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

function Money({ cents, className }: { cents: number; className?: string }) {
  return <span className={cn('font-mono tabular-nums', className)}>{formatSgd(cents)}</span>
}

function BreakdownStats({ b, commissionBps }: { b: MoneyBreakdown; commissionBps?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        label="Net earnings"
        value={formatSgd(b.netCents)}
        hint="What Stripe transfers to you"
        className="border-brand"
      />
      <StatCard
        label="Gross"
        value={formatSgd(b.grossCents)}
        hint={`${b.paymentCount} payment${b.paymentCount === 1 ? '' : 's'}${
          b.discountCents ? ` · ${formatSgd(b.discountCents)} in promo discounts` : ''
        }`}
      />
      <StatCard
        label="Stripe fees"
        value={formatSgd(b.stripeFeeCents)}
        hint="Actual fee once Stripe reports it"
      />
      <StatCard
        label="Commission"
        value={formatSgd(b.commissionCents)}
        hint={
          commissionBps !== undefined
            ? `Elevate keeps ${formatBps(commissionBps)} of the net after fees`
            : 'Elevate’s share after fees'
        }
      />
      <StatCard
        label="Refunded"
        value={formatSgd(b.refundedCents)}
        hint="Reversed from your transfers"
      />
    </div>
  )
}

function ReconcilePanel({ stripe }: { stripe: EarningsView['stripe'] }) {
  const reconcile = useReconciliation()
  const data = reconcile.data
  return (
    <Card as="section">
      <CardHeader
        title="Reconcile with Stripe"
        description="Compares the net in this ledger with the transfers Stripe has made to your account."
        action={
          stripe.connected ? (
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={reconcile.isFetching}
              onClick={() => reconcile.refetch()}
            >
              Check now
            </Button>
          ) : null
        }
      />
      {!stripe.connected ? (
        <p className="text-small text-ink-secondary">
          Connect Stripe from the dashboard to reconcile.
        </p>
      ) : reconcile.isError ? (
        <p className="text-small text-danger">{errorMessage(reconcile.error)}</p>
      ) : data ? (
        <div className="space-y-3">
          <DescriptionList
            items={[
              { label: 'Stripe transfers', value: <Money cents={data.stripeTransferTotalCents} /> },
              { label: 'Ledger net', value: <Money cents={data.ledgerNetCents} /> },
              {
                label: 'Difference',
                value:
                  data.differenceCents === 0 ? (
                    <Badge tone="success">Matches Stripe</Badge>
                  ) : (
                    <Badge tone="warning">Off by {formatSgd(data.differenceCents)}</Badge>
                  ),
              },
            ]}
          />
          <p className="text-caption text-ink-tertiary">
            Checked {formatDate(data.checkedAt, dateTime)}.
          </p>
        </div>
      ) : (
        <p className="text-small text-ink-secondary">
          Run a check to compare this page with Stripe. The test-mode dashboard shows the same
          transfers under Connect.
        </p>
      )}
    </Card>
  )
}

function useOpenDashboard() {
  const { toast } = useToast()
  const [opening, setOpening] = useState(false)
  async function open() {
    setOpening(true)
    try {
      await openStripeDashboard()
    } catch (error) {
      toast({ tone: 'danger', title: 'Stripe', description: errorMessage(error) })
    } finally {
      setOpening(false)
    }
  }
  return { open, opening }
}

export function EarningsPage() {
  const earnings = useEarnings()
  const navigate = useNavigate()
  const dashboard = useOpenDashboard()

  if (earnings.isPending)
    return (
      <>
        <PageHeader eyebrow="Earnings" title="Earnings" />
        <Skeleton className="h-64 w-full" />
      </>
    )
  if (earnings.isError)
    return (
      <>
        <PageHeader eyebrow="Earnings" title="Earnings" />
        <EmptyState
          tone="danger"
          title="Could not load earnings"
          body={errorMessage(earnings.error)}
        />
      </>
    )
  const e = earnings.data
  return (
    <>
      <PageHeader
        eyebrow="Earnings"
        title="Earnings"
        description="Gross, Stripe fees, commission and net per course, derived from Stripe events. Payouts land in your bank on Stripe’s schedule."
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {e.stripe.connected ? (
          <Button
            variant="secondary"
            icon={ExternalLink}
            loading={dashboard.opening}
            onClick={dashboard.open}
          >
            Open Stripe dashboard
          </Button>
        ) : (
          <Link to="/">
            <Button variant="accent">Connect Stripe to get paid</Button>
          </Link>
        )}
        <span className="text-small text-ink-tertiary">
          Commission on your courses: {formatBps(e.commissionBps)}
        </span>
      </div>
      <BreakdownStats b={e.totals} commissionBps={e.commissionBps} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="font-display text-h3 font-semibold text-ink">By course</h2>
            <span className="text-small text-ink-tertiary">Open a course for every payment</span>
          </div>
          {e.courses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No courses yet"
              body="Earnings appear per course once one is live and learners enrol."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Course</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Payments</TH>
                  <TH className="text-right">Gross</TH>
                  <TH className="text-right">Fees</TH>
                  <TH className="text-right">Commission</TH>
                  <TH className="text-right">Net</TH>
                </TR>
              </THead>
              <TBody>
                {e.courses.map((c) => (
                  <TR
                    key={c.courseId}
                    className="cursor-pointer"
                    onClick={() => navigate(`/earnings/${c.courseId}`)}
                  >
                    <TD className="font-semibold">{c.title}</TD>
                    <TD>
                      <Badge tone={statusTone[c.status]}>{statusLabel(c.status)}</Badge>
                    </TD>
                    <TD className="text-right font-mono">{c.paymentCount}</TD>
                    <TD className="text-right">
                      <Money cents={c.grossCents} />
                    </TD>
                    <TD className="text-right">
                      <Money cents={c.stripeFeeCents} className="text-ink-secondary" />
                    </TD>
                    <TD className="text-right">
                      <Money cents={c.commissionCents} className="text-ink-secondary" />
                    </TD>
                    <TD className="text-right">
                      <Money cents={c.netCents} className="font-semibold" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </section>
        <ReconcilePanel stripe={e.stripe} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-h3 font-semibold text-ink">Recent payments</h2>
        {e.recent.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nothing to report yet"
            body="Each payment shows the amount charged and your net after Stripe fees and commission."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Course</TH>
                <TH>Learner</TH>
                <TH className="text-right">Charged</TH>
                <TH className="text-right">Your net</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {e.recent.map((p) => (
                <TR key={p.paymentId}>
                  <TD className="text-ink-secondary">{formatDate(p.paidAt, dateTime)}</TD>
                  <TD className="font-semibold">{p.courseTitle}</TD>
                  <TD className="font-mono text-ink-secondary">{p.learner}</TD>
                  <TD className="text-right">
                    <Money cents={p.amountCents} />
                  </TD>
                  <TD className="text-right">
                    <Money cents={p.netCents} className="font-semibold" />
                  </TD>
                  <TD>
                    <Badge tone={statusTone[p.status]}>{statusLabel(p.status)}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </>
  )
}

export function CourseEarningsPage() {
  const { courseId = '' } = useParams()
  const query = useCourseEarnings(courseId)
  if (query.isPending) return <Skeleton className="h-64 w-full" />
  if (query.isError)
    return (
      <EmptyState
        tone="danger"
        title="Could not load this course"
        body={errorMessage(query.error)}
      />
    )
  const { course, payments } = query.data
  return (
    <>
      <Link
        to="/earnings"
        className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Earnings
      </Link>
      <PageHeader
        eyebrow="Course earnings"
        title={course.title}
        description={`Listed at ${formatSgd(course.priceCents)} · ${statusLabel(course.status)}`}
      />
      <BreakdownStats b={course} />
      <section className="mt-8">
        <h2 className="mb-3 font-display text-h3 font-semibold text-ink">Payments</h2>
        {payments.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payments for this course yet"
            body="Share the course page; every Stripe payment will show up here with its split."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Learner</TH>
                <TH className="text-right">Charged</TH>
                <TH>Promo</TH>
                <TH className="text-right">Stripe fee</TH>
                <TH className="text-right">Commission</TH>
                <TH className="text-right">Your net</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {payments.map((p) => (
                <TR key={p.paymentId}>
                  <TD className="text-ink-secondary">{formatDate(p.paidAt, dateTime)}</TD>
                  <TD className="font-mono text-ink-secondary">{p.learner}</TD>
                  <TD className="text-right">
                    <Money cents={p.amountCents} />
                  </TD>
                  <TD>
                    {p.promoCode ? (
                      <Badge tone="brand">
                        {p.promoCode} · −{formatSgd(p.discountCents)}
                      </Badge>
                    ) : (
                      <span className="text-ink-tertiary">—</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Money cents={p.stripeFeeCents} className="text-ink-secondary" />
                  </TD>
                  <TD className="text-right">
                    <Money cents={p.commissionCents} className="text-ink-secondary" />
                  </TD>
                  <TD className="text-right">
                    <Money cents={p.netCents} className="font-semibold" />
                  </TD>
                  <TD>
                    <Badge tone={statusTone[p.status]}>{statusLabel(p.status)}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </>
  )
}
