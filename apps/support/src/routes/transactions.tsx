import { formatSgd, type TransactionDetail, UNFINISHED_SEAT_REFUND_STATUSES } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  cn,
  DescriptionList,
  Dialog,
  EmptyState,
  formatDate,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
  statusLabel,
  statusTone,
  Table,
  Tabs,
  TabsList,
  TabsTrigger,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, Receipt, RotateCcw, Wallet } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '../lib/api'
import {
  bankDisputeLabel,
  bankDisputeTone,
  seatRefundDetail,
  seatRefundKindLabel,
  seatRefundStatusLabel,
  seatRefundStatusTone,
} from '../lib/class-sales'
import {
  type TransactionsFilter,
  transactionKeys,
  usePayouts,
  useTransaction,
  useTransactions,
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

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {['a', 'b', 'c', 'd'].map((k) => (
        <Skeleton key={k} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function TransactionsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'payouts' ? 'payouts' : 'payments'
  return (
    <>
      <PageHeader
        eyebrow="Transactions"
        title="Payments and payouts"
        description="Every Stripe payment with its fee split and refunds, plus what each teacher has been transferred."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => setParams(v === 'payouts' ? { tab: 'payouts' } : {})}
        className="mb-4 block"
      >
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="payouts">Payout ledger</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'payments' ? <PaymentsTable /> : <PayoutLedger />}
    </>
  )
}

function PaymentsTable() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<TransactionsFilter['status'] | ''>('')
  const deferredQ = useDeferredValue(q)
  const filter: TransactionsFilter = {
    ...(deferredQ.trim() ? { q: deferredQ.trim() } : {}),
    ...(status ? { status } : {}),
  }
  const query = useTransactions(filter)
  const items = query.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search learner email, course or payment intent"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          wrapperClassName="w-96"
        />
        <NativeSelect
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TransactionsFilter['status'] | '')}
          wrapperClassName="w-52"
        >
          <option value="">All statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="partially_refunded">Partially refunded</option>
          <option value="refunded">Refunded</option>
        </NativeSelect>
      </div>
      {query.isPending ? (
        <TableSkeleton />
      ) : query.isError ? (
        <EmptyState
          tone="danger"
          title="Could not load payments"
          body={errorMessage(query.error)}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No payments"
          body={
            deferredQ || status
              ? 'Nothing matches that filter.'
              : 'Payments appear here as soon as a learner checks out.'
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Learner</TH>
                <TH>Course</TH>
                <TH>Profile</TH>
                <TH className="text-right">Charged</TH>
                <TH className="text-right">Platform fee</TH>
                <TH className="text-right">Teacher net</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((t) => (
                <TR
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/transactions/${t.id}`)}
                >
                  <TD className="whitespace-nowrap text-ink-secondary">
                    {formatDate(t.paidAt, dateTime)}
                  </TD>
                  <TD className="font-mono text-caption">{t.learnerEmail}</TD>
                  <TD className="font-semibold">{t.courseTitle}</TD>
                  <TD className="text-ink-secondary">{t.profileName}</TD>
                  <TD className="text-right">
                    <Money cents={t.amountCents} />
                  </TD>
                  <TD className="text-right">
                    <Money cents={t.applicationFeeCents} className="text-ink-secondary" />
                  </TD>
                  <TD className="text-right">
                    <Money cents={t.teacherNetCents} />
                  </TD>
                  <TD>
                    <Badge tone={statusTone[t.status]}>{statusLabel(t.status)}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {query.hasNextPage ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                loading={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}

function PayoutLedger() {
  const query = usePayouts()
  if (query.isPending) return <TableSkeleton />
  if (query.isError)
    return (
      <EmptyState
        tone="danger"
        title="Could not load the payout ledger"
        body={errorMessage(query.error)}
      />
    )
  if (query.data.length === 0)
    return (
      <EmptyState
        icon={Wallet}
        title="No transfers yet"
        body="Each payout account appears here with the total Stripe has transferred to it."
      />
    )
  return (
    <Table>
      <THead>
        <TR>
          <TH>Profile</TH>
          <TH>Stripe account</TH>
          <TH>Payouts</TH>
          <TH className="text-right">Transfers</TH>
          <TH className="text-right">Transferred</TH>
          <TH className="text-right">Refunded</TH>
        </TR>
      </THead>
      <TBody>
        {query.data.map((row) => (
          <TR key={row.payoutAccountId}>
            <TD>
              <Link
                to={`/profiles/${row.profileId}`}
                className="font-semibold text-ink hover:text-brand-fg hover:underline"
              >
                {row.profileName}
              </Link>
              <p className="text-caption text-ink-tertiary">{row.ownerEmail}</p>
            </TD>
            <TD className="font-mono text-caption">
              {row.stripeAccountId ?? <span className="text-ink-tertiary">Not connected</span>}
            </TD>
            <TD>
              <Badge tone={row.payoutsEnabled ? 'success' : 'warning'}>
                {row.payoutsEnabled ? 'Enabled' : 'Pending'}
              </Badge>
            </TD>
            <TD className="text-right font-mono">{row.transferCount}</TD>
            <TD className="text-right">
              <Money cents={row.transferredCents} className="font-semibold" />
            </TD>
            <TD className="text-right">
              <Money
                cents={row.refundedCents}
                className={row.refundedCents ? 'text-danger' : 'text-ink-tertiary'}
              />
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  )
}

/**
 * A class payment's seat: where its money stands and the seat refund rows the release job sends.
 * Ledger rows for the refunds Stripe made are in the Refunds card below.
 */
function ClassSeat({
  t,
  classInfo,
}: {
  t: TransactionDetail
  classInfo: NonNullable<TransactionDetail['class']>
}) {
  return (
    <Card as="section" className="mt-6">
      <CardHeader
        title="Class seat"
        description="Class money is held until the release job releases it, and paid out after that."
      />
      <DescriptionList
        items={[
          {
            label: 'Class',
            value: (
              <Link
                to={`/classes/${classInfo.id}`}
                state={{ from: `/transactions/${t.id}` }}
                className="font-semibold text-ink hover:text-brand-fg hover:underline"
              >
                {classInfo.name}
              </Link>
            ),
          },
          {
            label: 'Seat',
            value: t.seatStatus ? (
              <Badge tone={statusTone[t.seatStatus]}>{statusLabel(t.seatStatus)}</Badge>
            ) : (
              '—'
            ),
          },
          {
            label: 'Released',
            // A seat refunded before release has nothing left to hold, though it is not released.
            value: t.released ? 'Yes' : t.paidOut ? 'No' : 'No, held',
          },
          {
            label: 'Paid out',
            value:
              t.paidOut && t.paidOutCents !== null && t.paidOutCents < 0 ? (
                <span>
                  Taken as a debt: <Money cents={t.paidOutCents} />
                  <span className="block text-caption text-ink-tertiary">
                    A refund left the teacher Stripe’s fee to bear. A debt is not held, so a payout
                    took it before the class was released.
                  </span>
                </span>
              ) : t.paidOut ? (
                'Yes'
              ) : (
                'No'
              ),
          },
          {
            label: 'Bank dispute',
            value: t.bankDisputeStatus
              ? (bankDisputeLabel[t.bankDisputeStatus] ?? statusLabel(t.bankDisputeStatus))
              : 'None',
          },
        ]}
      />
      <h4 className="mb-2 mt-6 text-small-strong font-semibold text-ink">Seat refunds</h4>
      {t.seatRefunds.length === 0 ? (
        <p className="text-small text-ink-secondary">No seat refund for this payment.</p>
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Asked</TH>
                <TH>Kind</TH>
                <TH>Status</TH>
                <TH className="text-right">To the learner</TH>
                <TH>Reason</TH>
                <TH>Finished</TH>
              </TR>
            </THead>
            <TBody>
              {t.seatRefunds.map((r) => {
                const detail = seatRefundDetail(r)
                return (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap text-ink-secondary">
                      {formatDate(r.createdAt, dateTime)}
                    </TD>
                    <TD>{seatRefundKindLabel[r.kind]}</TD>
                    <TD>
                      <Badge tone={seatRefundStatusTone[r.status]}>
                        {seatRefundStatusLabel[r.status]}
                      </Badge>
                      {detail ? (
                        <p className="mt-1 text-caption text-ink-tertiary">{detail}</p>
                      ) : null}
                    </TD>
                    <TD className="text-right">
                      {r.learnerRefundCents !== null ? (
                        <Money cents={r.learnerRefundCents} />
                      ) : (
                        <span className="text-ink-tertiary">Not worked out yet</span>
                      )}
                    </TD>
                    <TD>{r.reason ?? '—'}</TD>
                    <TD className="whitespace-nowrap text-ink-secondary">
                      {formatDate(r.completedAt, dateTime)}
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
          {t.seatRefunds.some((r) => r.status === 'failed') ? (
            <p className="mt-3 text-small text-ink-secondary">
              A failed seat refund is retried or closed on the{' '}
              <Link to="/payouts" className="text-brand-fg hover:underline">
                Payouts page
              </Link>
              .
            </p>
          ) : null}
        </>
      )}
    </Card>
  )
}

export function TransactionDetailPage() {
  const { id = '' } = useParams()
  const query = useTransaction(id)
  if (query.isPending) return <Skeleton className="h-64 w-full" />
  if (query.isError)
    return (
      <EmptyState
        tone="danger"
        title="Could not load this payment"
        body={errorMessage(query.error)}
      />
    )
  return <TransactionView t={query.data} />
}

function TransactionView({ t }: { t: TransactionDetail }) {
  const { hasRole } = usePortalAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const canRefund = hasRole('super_admin') && t.status !== 'refunded'
  // The API refuses a refund here while a seat refund is under way (`refund_in_progress`).
  const unfinished = t.seatRefunds.find((r) =>
    (UNFINISHED_SEAT_REFUND_STATUSES as readonly string[]).includes(r.status),
  )
  const stripeUrl = t.stripe.paymentIntentId
    ? `https://dashboard.stripe.com/test/payments/${t.stripe.paymentIntentId}`
    : null

  async function refund() {
    setBusy(true)
    try {
      await unwrap(
        await api.support.transactions[':id'].refund.$post({
          param: { id: t.id },
          json: { reason: reason.trim() },
        }),
      )
      toast({
        tone: 'success',
        title: 'Refund issued',
        description: 'Stripe is returning the money and the learner’s access has been removed.',
      })
      setOpen(false)
      setReason('')
      await queryClient.invalidateQueries({ queryKey: transactionKeys.all })
      await queryClient.invalidateQueries({ queryKey: transactionKeys.payouts })
    } catch (error) {
      toast({ tone: 'danger', title: 'Refund failed', description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  // Refunds change both nets; the page then shows the figures before and after them.
  const refunded = t.refunds.length > 0
  const ids: Array<[string, string | null]> = [
    ['Payout account', t.payoutAccountId],
    ['Checkout session', t.stripe.checkoutSessionId],
    ['Payment intent', t.stripe.paymentIntentId],
    ['Charge', t.stripe.chargeId],
    ['Transfer', t.stripe.transferId],
    ['Application fee', t.stripe.applicationFeeId],
    ['Balance transaction', t.stripe.balanceTransactionId],
  ]

  return (
    <>
      <Link
        to="/transactions"
        className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Transactions
      </Link>
      <PageHeader
        eyebrow={`Payment · ${formatDate(t.paidAt, dateTime)}`}
        title={t.courseTitle}
        description={`${t.learnerEmail} · sold by ${t.profileName}`}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge tone={statusTone[t.status]}>{statusLabel(t.status)}</Badge>
        <Badge tone={statusTone[t.enrollmentStatus]}>
          {t.seatStatus ? 'Seat' : 'Enrolment'} {statusLabel(t.enrollmentStatus).toLowerCase()}
        </Badge>
        {t.bankDisputeStatus ? (
          <Badge tone={bankDisputeTone[t.bankDisputeStatus] ?? 'warning'}>
            {bankDisputeLabel[t.bankDisputeStatus] ?? statusLabel(t.bankDisputeStatus)}
          </Badge>
        ) : null}
        {stripeUrl ? (
          <Button asChild variant="secondary" size="sm" icon={ExternalLink}>
            <a href={stripeUrl} target="_blank" rel="noreferrer">
              Open in Stripe
            </a>
          </Button>
        ) : null}
        {t.stripe.receiptUrl ? (
          <Button asChild variant="ghost" size="sm" icon={Receipt}>
            <a href={t.stripe.receiptUrl} target="_blank" rel="noreferrer">
              Receipt
            </a>
          </Button>
        ) : null}
        {canRefund ? (
          <div className="ml-auto flex flex-col items-end gap-1">
            <Button
              variant="danger"
              size="sm"
              icon={RotateCcw}
              disabled={!!unfinished}
              aria-describedby={unfinished ? 'refund-blocked' : undefined}
              onClick={() => setOpen(true)}
            >
              Refund in full
            </Button>
            {unfinished ? (
              <p
                id="refund-blocked"
                className="max-w-xs text-right text-caption text-ink-secondary"
              >
                A seat refund for this payment is under way (
                {seatRefundStatusLabel[unfinished.status].toLowerCase()}).
                {unfinished.status === 'failed' ? (
                  <>
                    {' '}
                    Retry or close it on the{' '}
                    <Link to="/payouts" className="text-brand-fg hover:underline">
                      Payouts page
                    </Link>
                    .
                  </>
                ) : (
                  ' The release job sends it.'
                )}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section">
          <CardHeader
            title="Fee breakdown"
            description="Integer cents, exactly as charged and split."
          />
          <DescriptionList
            items={[
              { label: 'List price', value: <Money cents={t.listPriceCents} /> },
              {
                label: 'Discount',
                value: t.discountCents ? (
                  <span className="inline-flex items-center gap-2">
                    <Money cents={-t.discountCents} />
                    {t.promoCode ? <Badge tone="brand">{t.promoCode}</Badge> : null}
                  </span>
                ) : (
                  <span className="text-ink-tertiary">—</span>
                ),
              },
              {
                label: 'Charged',
                value: <Money cents={t.amountCents} className="font-semibold" />,
              },
              {
                label: 'Stripe fee',
                value:
                  t.stripeFeeActualCents !== null ? (
                    <span>
                      <Money cents={t.stripeFeeActualCents} />{' '}
                      <span className="text-ink-tertiary">
                        (estimated {formatSgd(t.stripeFeeEstimateCents)})
                      </span>
                    </span>
                  ) : (
                    <span>
                      <Money cents={t.stripeFeeEstimateCents} />{' '}
                      <span className="text-ink-tertiary">estimate</span>
                    </span>
                  ),
              },
              { label: 'Commission', value: <Money cents={t.commissionCents} /> },
              { label: 'Application fee', value: <Money cents={t.applicationFeeCents} /> },
              {
                label: refunded ? 'Teacher net before refunds' : 'Teacher net',
                value: (
                  <Money
                    cents={t.teacherNetCents}
                    className={refunded ? undefined : 'font-semibold'}
                  />
                ),
              },
              {
                label: refunded ? 'Platform net before refunds' : 'Platform net',
                value:
                  t.platformNetCents !== null ? (
                    <Money cents={t.platformNetCents} />
                  ) : (
                    <span className="text-ink-tertiary">Known once Stripe reports the fee</span>
                  ),
              },
              {
                label: 'Refunded',
                value: (
                  <Money
                    cents={t.refundedCents}
                    className={t.refundedCents ? 'text-danger' : 'text-ink-tertiary'}
                  />
                ),
              },
              ...(refunded
                ? [
                    {
                      label: 'Teacher net after refunds',
                      value: (
                        <Money cents={t.teacherNetAfterRefundsCents} className="font-semibold" />
                      ),
                    },
                    {
                      label: 'Platform net after refunds',
                      value:
                        t.platformNetAfterRefundsCents !== null ? (
                          <Money cents={t.platformNetAfterRefundsCents} />
                        ) : (
                          <span className="text-ink-tertiary">
                            {t.platformNetCents === null
                              ? 'Known once Stripe reports the fee'
                              : 'Not worked out after a lost bank dispute'}
                          </span>
                        ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
        <Card as="section">
          <CardHeader
            title="Stripe objects"
            description="Paste any id into the Stripe dashboard search to cross-check."
          />
          <DescriptionList
            items={ids.map(([label, value]) => ({
              label,
              value: value ? (
                <code className="font-mono text-caption">{value}</code>
              ) : (
                <span className="text-ink-tertiary">—</span>
              ),
            }))}
          />
        </Card>
      </div>

      {t.class ? <ClassSeat t={t} classInfo={t.class} /> : null}

      <Card as="section" className="mt-6">
        <CardHeader
          title="Refunds"
          description="A full refund reverses the transfer and the application fee, and removes course access."
        />
        {t.refunds.length === 0 ? (
          <p className="text-small text-ink-secondary">No refunds on this payment.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH className="text-right">Amount</TH>
                <TH>Reason</TH>
                <TH>Requested by</TH>
                <TH>Stripe refund</TH>
              </TR>
            </THead>
            <TBody>
              {t.refunds.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap text-ink-secondary">
                    {formatDate(r.createdAt, dateTime)}
                  </TD>
                  <TD className="text-right">
                    <Money cents={r.amountCents} />
                  </TD>
                  <TD>{r.reason ?? '—'}</TD>
                  <TD className="text-ink-secondary">{r.requestedBy ?? 'Stripe dashboard'}</TD>
                  <TD className="font-mono text-caption">{r.stripeRefundId}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Dialog
        open={open}
        onOpenChange={(o) => !o && setOpen(false)}
        title="Refund this payment?"
        description={`${formatSgd(t.amountCents)} goes back to ${t.learnerEmail}. The transfer to ${t.profileName} is reversed and the learner loses ${t.class ? `their seat in ${t.class.name}` : 'access to the course'}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={reason.trim().length < 3}
              onClick={refund}
            >
              Refund {formatSgd(t.amountCents)}
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          hint="Shown to the learner in the refund email and kept in the audit log."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Duplicate purchase, learner request…"
        />
      </Dialog>
    </>
  )
}
