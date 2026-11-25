import {
  type EarningsView,
  formatSgd,
  type HeldClassView,
  type MoneyBreakdown,
  type ProfilePayoutView,
} from '@elevate/core'
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
} from '@elevate/web-ui'
import { errorMessage } from '@elevate/web-ui/portal'
import { ArrowLeft, ChevronRight, ExternalLink, Receipt, RefreshCw } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { useClassSales } from '../lib/classes'
import { useCurrentProfile } from '../lib/profile'
import { useCourseEarnings, useEarnings, useReconciliation, useStripeLinks } from '../lib/queries'

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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        label="Net earnings"
        value={formatSgd(b.netCents)}
        hint="Gross, less Stripe fees, commission and refunds, plus Elevate’s fee returned"
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
        hint="Taken in Elevate’s fee at checkout. Elevate pays Stripe’s actual fee."
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
      <StatCard
        label="Elevate’s fee returned"
        value={formatSgd(b.feeReturnedCents)}
        hint="The part of Elevate’s fee that refunds gave back to you"
      />
    </div>
  )
}

const HELD_WAITING: Record<NonNullable<HeldClassView['waitingFor']>, string> = {
  open_marks: 'Waits until no manual mark in the class can still be disputed',
  cancellation: 'Waits until every refund of the cancellation is done',
  review: 'Elevate is reviewing it: no learner was counted as attended',
}

const PAYOUT_STATUS: Record<string, { label: string; tone: 'neutral' | 'success' | 'danger' }> = {
  pending: { label: 'On its way', tone: 'neutral' },
  paid: { label: 'In your bank', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
}

/**
 * For a profile that sells classes: Elevate pays it once a day, so the page shows what is held
 * and when each class is due, any debt not yet covered, and the recent payouts with what each
 * one paid.
 */
function HeldMoney({ e }: { e: EarningsView }) {
  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Held"
          value={formatSgd(e.heldCents)}
          hint="Your share of class seats, kept in your Stripe account until each class is released"
        />
        {e.debtCents > 0 ? (
          <StatCard
            label="Owed"
            value={formatSgd(e.debtCents)}
            hint="Refunds or bank disputes after a payout. Taken from your next payouts first."
            className="border-danger"
          />
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 font-display text-h3 font-semibold text-ink">Held for classes</h2>
        {e.heldClasses.length === 0 ? (
          <p className="text-small text-ink-tertiary">No class money is held.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Class</TH>
                <TH className="text-right">Held</TH>
                <TH>Released</TH>
              </TR>
            </THead>
            <TBody>
              {e.heldClasses.map((c) => (
                <TR key={c.classId}>
                  <TD className="font-semibold">{c.className}</TD>
                  <TD className="text-right">
                    <Money cents={c.heldCents} />
                  </TD>
                  <TD className="text-ink-secondary">
                    {c.waitingFor
                      ? HELD_WAITING[c.waitingFor]
                      : c.releaseDueAt
                        ? `From ${formatDate(c.releaseDueAt, dateTime)}`
                        : 'Once the class has ended'}
                    {c.waitingFor && c.releaseDueAt ? (
                      <span className="block text-caption text-ink-tertiary">
                        Not before {formatDate(c.releaseDueAt, dateTime)}
                      </span>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-h3 font-semibold text-ink">Payouts</h2>
        {e.payouts.length === 0 ? (
          <p className="text-small text-ink-tertiary">No payouts yet.</p>
        ) : (
          <ul className="space-y-2">
            {e.payouts.map((p) => (
              <PayoutRow key={p.id} payout={p} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** One payout, opening to the payments and adjustments it paid. */
function PayoutRow({ payout }: { payout: ProfilePayoutView }) {
  const status = payout.payoutStatus
    ? (PAYOUT_STATUS[payout.payoutStatus] ?? { label: payout.payoutStatus, tone: 'neutral' })
    : { label: 'Sending', tone: 'neutral' as const }
  return (
    <li>
      <details className="group rounded-card border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
          <ChevronRight
            className="size-4 shrink-0 text-ink-tertiary transition-transform group-open:rotate-90"
            aria-hidden
          />
          <span className="font-semibold text-ink">
            {formatDate(payout.payDate, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <Badge tone={status.tone}>{status.label}</Badge>
          <Money cents={payout.amountCents} className="ml-auto font-semibold" />
        </summary>
        <div className="border-t border-border px-4 py-3">
          {payout.payoutStatus === 'failed' ? (
            <p className="mb-2 text-small text-danger">
              This payout did not reach your bank. What it would have paid is paid again in a later
              payout.
            </p>
          ) : null}
          {payout.items.length === 0 ? (
            <p className="text-small text-ink-tertiary">Nothing is listed for this payout.</p>
          ) : (
            <ul className="divide-y divide-border text-small">
              {payout.items.map((item, index) => (
                <li
                  // The same sale can appear in two payouts, never twice in one.
                  // biome-ignore lint/suspicious/noArrayIndexKey: items have no id of their own
                  key={index}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className={item.kind === 'payment' ? 'text-ink' : 'text-ink-secondary'}>
                    {item.label}
                  </span>
                  <Money
                    cents={item.amountCents}
                    className={item.amountCents < 0 ? 'text-danger' : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
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

export function EarningsPage() {
  const earnings = useEarnings()
  const navigate = useNavigate()
  const { path, can, profile } = useCurrentProfile()
  const links = useStripeLinks()
  const sales = useClassSales(!!profile?.classesEnabled)
  // On manual payouts Elevate pays the profile; until then Stripe does, on its own schedule.
  const heldPayouts = sales.data?.payoutMode === 'manual'
  // Stripe links are the owner's; everyone else who can read earnings sees the figures only.
  const canManageStripe = can('stripe.links')

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
        description={
          heldPayouts
            ? 'Gross, Stripe fees, commission and net per course, derived from Stripe events. Elevate pays you once a day; class money is held until each class is released.'
            : 'Gross, Stripe fees, commission and net per course, derived from Stripe events. Payouts land in your bank on Stripe’s schedule.'
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {!canManageStripe ? null : e.stripe.connected ? (
          <Button
            variant="secondary"
            icon={ExternalLink}
            loading={links.busy}
            onClick={links.openDashboard}
          >
            Open Stripe dashboard
          </Button>
        ) : (
          <Button asChild variant="accent">
            <Link to={path()}>Connect Stripe to get paid</Link>
          </Button>
        )}
        <span className="text-small text-ink-tertiary">
          Commission on your courses: {formatBps(e.commissionBps)}
        </span>
      </div>
      <BreakdownStats b={e.totals} commissionBps={e.commissionBps} />
      {heldPayouts ? <HeldMoney e={e} /> : null}

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
                  <TH className="text-right">Refunded</TH>
                  <TH className="text-right">Fee returned</TH>
                  <TH className="text-right">Net</TH>
                </TR>
              </THead>
              <TBody>
                {e.courses.map((c) => (
                  <TR
                    key={c.courseId}
                    className="cursor-pointer"
                    onClick={() => navigate(path(`/earnings/${c.courseId}`))}
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
                      <Money cents={c.refundedCents} className="text-ink-secondary" />
                    </TD>
                    <TD className="text-right">
                      <Money cents={c.feeReturnedCents} className="text-ink-secondary" />
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
  const { path } = useCurrentProfile()
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
        to={path('/earnings')}
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
                <TH className="text-right">Refunded</TH>
                <TH className="text-right">Fee returned</TH>
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
                    <Money cents={p.refundedCents} className="text-ink-secondary" />
                  </TD>
                  <TD className="text-right">
                    <Money cents={p.feeReturnedCents} className="text-ink-secondary" />
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
