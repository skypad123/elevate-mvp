import { formatSgd, type TransactionDetail } from '@elevate/core'
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
                className="font-semibold text-ink hover:text-brand hover:underline"
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
          Enrolment {statusLabel(t.enrollmentStatus).toLowerCase()}
        </Badge>
        {stripeUrl ? (
          <a href={stripeUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary" size="sm" icon={ExternalLink}>
              Open in Stripe
            </Button>
          </a>
        ) : null}
        {t.stripe.receiptUrl ? (
          <a href={t.stripe.receiptUrl} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm" icon={Receipt}>
              Receipt
            </Button>
          </a>
        ) : null}
        {canRefund ? (
          <Button
            variant="danger"
            size="sm"
            icon={RotateCcw}
            className="ml-auto"
            onClick={() => setOpen(true)}
          >
            Refund in full
          </Button>
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
                label: 'Teacher net',
                value: <Money cents={t.teacherNetCents} className="font-semibold" />,
              },
              {
                label: 'Platform net',
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
        description={`${formatSgd(t.amountCents)} goes back to ${t.learnerEmail}. The transfer to ${t.profileName} is reversed and the learner loses access to the course.`}
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
