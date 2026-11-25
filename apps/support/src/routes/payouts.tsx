import {
  formatSgd,
  PAYOUT_TIME_ZONE,
  parseSgdToCents,
  type SupportPayoutsOverview,
} from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  cn,
  Dialog,
  EmptyState,
  formatDate,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import {
  REFUND_FAILED_AT_STRIPE,
  seatRefundDetail,
  seatRefundKindLabel,
  seatRefundStatusLabel,
  seatRefundStatusTone,
} from '../lib/class-sales'
import {
  addCorrection,
  classKeys,
  clearReview,
  payoutKeys,
  refundRowAction,
  transactionKeys,
  usePayoutsOverview,
} from '../lib/queries'

type Overview = SupportPayoutsOverview
type UnderReview = Overview['classesUnderReview'][number]
type RefundRow = Overview['refundsNeedingAttention'][number]
type Unnamed = Overview['unnamed'][number]

/** Payouts run on Singapore days, so every time on this page is Singapore's, and says so. */
const dateTime: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: PAYOUT_TIME_ZONE,
  timeZoneName: 'short',
}
const day: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

function Money({ cents, className }: { cents: number; className?: string }) {
  return <span className={cn('font-mono tabular-nums', className)}>{formatSgd(cents)}</span>
}

/** A reason or note is 3 to 500 characters, as the API's schemas require. */
const MIN_REASON = 3
const MAX_REASON = 500

/**
 * Support's payouts page: the release job's state and every case that needs a person. Any
 * Support user can read it; the actions are for a super admin, and each asks for its reason.
 */
export function PayoutsPage() {
  const query = usePayoutsOverview()
  return (
    <>
      <PageHeader
        eyebrow="Payouts"
        title="Held class money and payouts"
        description="What the release job did, and what it left for a person: classes nobody attended, refunds that wait or failed, cancellations not yet complete, and money no row names."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={query.isFetching}
            onClick={() => query.refetch()}
          >
            Refresh
          </Button>
        }
      />
      {query.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : query.isError ? (
        <EmptyState tone="danger" title="Could not load payouts" body={errorMessage(query.error)} />
      ) : (
        <OverviewBody o={query.data} />
      )}
    </>
  )
}

function OverviewBody({ o }: { o: Overview }) {
  const { hasRole } = usePortalAuth()
  const admin = hasRole('super_admin')
  return (
    <div className="space-y-6">
      <LastRun o={o} />
      <ClassesUnderReview rows={o.classesUnderReview} admin={admin} />
      <RefundsNeedingAttention rows={o.refundsNeedingAttention} admin={admin} />
      <Section
        title="Cancellations not yet complete"
        description="A cancelled class is released 7 days after its cancellation is complete, when every refund row it wrote is done or closed."
        empty="Every cancellation is complete."
        count={o.openCancellations.length}
      >
        <Table>
          <THead>
            <TR>
              <TH>Class</TH>
              <TH>Profile</TH>
              <TH>Cancelled</TH>
              <TH>When</TH>
              <TH className="text-right">Rows left</TH>
            </TR>
          </THead>
          <TBody>
            {o.openCancellations.map((c) => (
              <TR key={c.classId}>
                <TD>
                  <ClassLink id={c.classId} name={c.className} />
                </TD>
                <TD className="text-ink-secondary">{c.profileName}</TD>
                <TD className="whitespace-nowrap text-ink-secondary">
                  {formatDate(c.createdAt, dateTime)}
                </TD>
                <TD>{c.afterStart ? 'After the first block started' : 'Before it started'}</TD>
                <TD className="text-right font-mono">{c.rowsLeft}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>
      <Section
        title="Released by the day limit"
        description="Class payments held 85 days and released without their class: the class was still under review or waiting. Check each one."
        empty="No payment has reached the day limit."
        count={o.dayLimitReleases.length}
      >
        <Table>
          <THead>
            <TR>
              <TH>Payment</TH>
              <TH>Class</TH>
              <TH>Profile</TH>
              <TH>Released</TH>
            </TR>
          </THead>
          <TBody>
            {o.dayLimitReleases.map((p) => (
              <TR key={p.paymentId}>
                <TD>
                  <Link
                    to={`/transactions/${p.paymentId}`}
                    className="font-mono text-caption text-ink hover:text-brand-fg hover:underline"
                  >
                    {p.paymentId.slice(0, 8)}
                  </Link>
                </TD>
                <TD className="font-semibold">{p.className || '—'}</TD>
                <TD className="text-ink-secondary">{p.profileName || '—'}</TD>
                <TD className="whitespace-nowrap text-ink-secondary">
                  {formatDate(p.releasedAt || null, dateTime)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>
      <Section
        title="Failed payouts"
        description="Stripe refused the payout, or the bank returned it. Its payments and adjustments were unmarked, so the next day’s payout tries them again. The profile’s owner was emailed."
        empty="No payout has failed."
        count={o.failedPayouts.length}
      >
        <Table>
          <THead>
            <TR>
              <TH>Profile</TH>
              <TH className="text-right">Amount</TH>
              <TH>Error</TH>
            </TR>
          </THead>
          <TBody>
            {o.failedPayouts.map((p) => (
              <TR key={p.payoutId}>
                <TD className="font-semibold">{p.profileName}</TD>
                <TD className="text-right">
                  <Money cents={p.amountCents} />
                </TD>
                <TD className="text-small text-ink-secondary">{p.error ?? '—'}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>
      <UnnamedMoney rows={o.unnamed} admin={admin} />
      <RecentRuns runs={o.recentRuns} />
    </div>
  )
}

/** A card with a count in its title, and a line instead of the table when there is nothing. */
function Section({
  title,
  description,
  empty,
  count,
  children,
}: {
  title: string
  description: string
  empty: string
  count: number
  children: ReactNode
}) {
  return (
    <Card as="section">
      <CardHeader title={count > 0 ? `${title} (${count})` : title} description={description} />
      {count === 0 ? <p className="text-small text-ink-secondary">{empty}</p> : children}
    </Card>
  )
}

function ClassLink({ id, name }: { id: string; name: string }) {
  return (
    <Link
      to={`/classes/${id}`}
      state={{ from: '/payouts' }}
      className="font-semibold text-ink hover:text-brand-fg hover:underline"
    >
      {name}
    </Link>
  )
}

function LastRun({ o }: { o: Overview }) {
  return (
    <Card as="section">
      <CardHeader
        title="Last finished run"
        description="The release job runs every 15 minutes. It pays profiles in the first run at or after 10:00 Singapore time."
      />
      <p className="text-body text-ink">
        {o.lastFinishedAt ? formatDate(o.lastFinishedAt, dateTime) : 'No run has finished yet.'}
      </p>
      {o.stale ? (
        <p
          role="status"
          className="mt-3 rounded-card border border-warning bg-warning-tint px-4 py-3 text-small text-ink"
        >
          No run has finished in the last 30 minutes. Refunds are not being sent and nothing is
          released or paid until one does. Check the release task’s logs and its alarm.
        </p>
      ) : null}
    </Card>
  )
}

// ── classes under review ────────────────────────────────────────────────────

function ClassesUnderReview({ rows, admin }: { rows: UnderReview[]; admin: boolean }) {
  const [clearing, setClearing] = useState<UnderReview | null>(null)
  return (
    <Section
      title="Classes under review"
      description="Due for release, but nobody is counted as attending. A super admin who has checked the class clears the review; the next run releases it. Otherwise each payment is released at 85 days and flagged."
      empty="No class is under review."
      count={rows.length}
    >
      <Table>
        <THead>
          <TR>
            <TH>Class</TH>
            <TH>Profile</TH>
            <TH>Due</TH>
            <TH className="text-right">Held</TH>
            {admin ? <TH className="text-right">Action</TH> : null}
          </TR>
        </THead>
        <TBody>
          {rows.map((c) => (
            <TR key={c.classId}>
              <TD>
                <ClassLink id={c.classId} name={c.className} />
              </TD>
              <TD className="text-ink-secondary">{c.profileName}</TD>
              <TD className="whitespace-nowrap text-ink-secondary">
                {formatDate(c.dueAt, dateTime)}
              </TD>
              <TD className="text-right">
                <Money cents={c.heldCents} />
              </TD>
              {admin ? (
                <TD className="text-right">
                  <Button variant="secondary" size="sm" onClick={() => setClearing(c)}>
                    Clear review
                  </Button>
                </TD>
              ) : null}
            </TR>
          ))}
        </TBody>
      </Table>
      {clearing ? <ClearReviewDialog c={clearing} onClose={() => setClearing(null)} /> : null}
    </Section>
  )
}

function ClearReviewDialog({ c, onClose }: { c: UnderReview; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await clearReview(c.classId, note.trim())
      toast({
        tone: 'success',
        title: 'Review cleared',
        description: `${c.className} is released on the next run.`,
      })
      await queryClient.invalidateQueries({ queryKey: payoutKeys.overview })
      await queryClient.invalidateQueries({ queryKey: classKeys.detail(c.classId) })
      onClose()
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Could not clear the review',
        description: errorMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Release ${c.className}?`}
      description={`Nobody is counted as attending this class of ${c.profileName}. The class is released on the next run, with the reason “support”, and each of its payments with no open bank dispute and no unfinished refund is released with it. ${formatSgd(c.heldCents)} is held.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={note.trim().length < MIN_REASON} onClick={submit}>
            Clear review
          </Button>
        </>
      }
    >
      <Textarea
        label="Note"
        hint="What you checked. Kept on the class and in the audit log."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={MAX_REASON}
        placeholder="The teacher sent the sign-in sheet; the learners’ phones could not check in…"
      />
    </Dialog>
  )
}

// ── refunds that wait or failed ─────────────────────────────────────────────

function RefundsNeedingAttention({ rows, admin }: { rows: RefundRow[]; admin: boolean }) {
  const [acting, setActing] = useState<{ row: RefundRow; action: 'retry' | 'close' } | null>(null)
  return (
    <Section
      title="Refunds needing attention"
      description="Failed rows, which the job does not try again; rows that wait; and rows ready or sent for more than a day. Only a failed row can be retried or closed. A payment with an unfinished row is not released or paid."
      empty="No refund needs attention."
      count={rows.length}
    >
      <Table>
        <THead>
          <TR>
            <TH>Refund</TH>
            <TH>Status</TH>
            <TH>Class</TH>
            <TH>Since</TH>
            <TH>Error</TH>
            {admin ? <TH className="text-right">Action</TH> : null}
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => {
            const detail = seatRefundDetail({ ...r, closedReason: null })
            const failedAtStripe = r.error === REFUND_FAILED_AT_STRIPE
            return (
              <TR key={r.id}>
                <TD>{seatRefundKindLabel[r.kind]}</TD>
                <TD>
                  <Badge tone={seatRefundStatusTone[r.status]}>
                    {seatRefundStatusLabel[r.status]}
                  </Badge>
                  {detail ? <p className="mt-1 text-caption text-ink-tertiary">{detail}</p> : null}
                </TD>
                <TD>
                  <p className="font-semibold text-ink">{r.className}</p>
                  <p className="text-caption text-ink-tertiary">{r.profileName}</p>
                </TD>
                <TD className="whitespace-nowrap text-ink-secondary">
                  {formatDate(r.createdAt, dateTime)}
                </TD>
                <TD className="max-w-xs text-small">
                  {failedAtStripe ? (
                    <span className="text-danger">
                      Stripe accepted the refund, then failed it. The profile’s share was already
                      taken back, so it cannot be retried: refund the learner another way, then
                      close the row. Its amount then shows as unnamed money until a correction is
                      written.
                    </span>
                  ) : r.error ? (
                    <span className="text-ink-secondary">{r.error}</span>
                  ) : (
                    <span className="text-ink-tertiary">—</span>
                  )}
                </TD>
                {admin ? (
                  <TD className="text-right">
                    {r.status === 'failed' ? (
                      <div className="flex justify-end gap-2">
                        {failedAtStripe ? null : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setActing({ row: r, action: 'retry' })}
                          >
                            Retry
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActing({ row: r, action: 'close' })}
                        >
                          Close
                        </Button>
                      </div>
                    ) : (
                      <span className="text-caption text-ink-tertiary">The job handles it</span>
                    )}
                  </TD>
                ) : null}
              </TR>
            )
          })}
        </TBody>
      </Table>
      {acting ? (
        <RefundRowDialog row={acting.row} action={acting.action} onClose={() => setActing(null)} />
      ) : null}
    </Section>
  )
}

function RefundRowDialog({
  row,
  action,
  onClose,
}: {
  row: RefundRow
  action: 'retry' | 'close'
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const retry = action === 'retry'

  async function submit() {
    setBusy(true)
    try {
      await refundRowAction(row.id, { action, reason: reason.trim() })
      toast({
        tone: 'success',
        title: retry ? 'Refund queued again' : 'Refund row closed',
        description: retry
          ? 'The next run sends it.'
          : 'Nothing more is sent for it. The payment can now be released.',
      })
      await queryClient.invalidateQueries({ queryKey: payoutKeys.overview })
      await queryClient.invalidateQueries({ queryKey: transactionKeys.all })
      onClose()
    } catch (error) {
      toast({
        tone: 'danger',
        title: retry ? 'Could not retry the refund' : 'Could not close the row',
        description: errorMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={retry ? 'Retry this refund?' : 'Close this refund row?'}
      description={
        retry
          ? `${seatRefundKindLabel[row.kind]}, ${row.className}. The next run sends it again, under a new idempotency key. Retry only when what Stripe refused has been put right.`
          : `${seatRefundKindLabel[row.kind]}, ${row.className}. The job sends nothing more for this row, and the learner gets no refund email. Close it once the learner has been refunded another way, or when no refund is owed.`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={retry ? 'primary' : 'danger'}
            loading={busy}
            disabled={reason.trim().length < MIN_REASON}
            onClick={submit}
          >
            {retry ? 'Retry' : 'Close row'}
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        hint="Kept in the audit log."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={MAX_REASON}
        placeholder={
          retry
            ? 'The learner’s card was reissued; Stripe support confirmed…'
            : 'Refunded by bank transfer on…'
        }
      />
    </Dialog>
  )
}

// ── unnamed money and corrections ───────────────────────────────────────────

function UnnamedMoney({ rows, admin }: { rows: Unnamed[]; admin: boolean }) {
  const [correcting, setCorrecting] = useState<Unnamed | null>(null)
  return (
    <Section
      title="Money no row names"
      description="On its latest paying day, the profile’s Stripe balance held more than its payable rows. That money is never paid out. Find the missing row; when it cannot be restored, a super admin writes a correction, which the next payout pays or takes."
      empty="No profile has unnamed money."
      count={rows.length}
    >
      <Table>
        <THead>
          <TR>
            <TH>Profile</TH>
            <TH>Pay date</TH>
            <TH className="text-right">Unnamed</TH>
            {admin ? <TH className="text-right">Action</TH> : null}
          </TR>
        </THead>
        <TBody>
          {rows.map((u) => (
            <TR key={u.payoutAccountId}>
              <TD className="font-semibold">{u.profileName}</TD>
              <TD className="whitespace-nowrap text-ink-secondary">{formatDate(u.payDate, day)}</TD>
              <TD className="text-right">
                <Money cents={u.unnamedCents} className="font-semibold" />
              </TD>
              {admin ? (
                <TD className="text-right">
                  <Button variant="secondary" size="sm" onClick={() => setCorrecting(u)}>
                    Add correction
                  </Button>
                </TD>
              ) : null}
            </TR>
          ))}
        </TBody>
      </Table>
      {correcting ? <CorrectionDialog u={correcting} onClose={() => setCorrecting(null)} /> : null}
    </Section>
  )
}

function CorrectionDialog({ u, onClose }: { u: Unnamed; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [direction, setDirection] = useState<'pay' | 'take'>('pay')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const cents = parseSgdToCents(amount)
  const valid = cents !== null && cents > 0 && reason.trim().length >= MIN_REASON
  const signed = cents === null ? 0 : direction === 'pay' ? cents : -cents

  async function submit() {
    if (!valid) return
    setBusy(true)
    try {
      await addCorrection(u.payoutAccountId, { amountCents: signed, reason: reason.trim() })
      toast({
        tone: 'success',
        title: 'Correction written',
        description: `${formatSgd(signed)} for ${u.profileName}, on the next payout.`,
      })
      await queryClient.invalidateQueries({ queryKey: payoutKeys.overview })
      onClose()
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Could not write the correction',
        description: errorMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Correction for ${u.profileName}`}
      description={`${formatSgd(u.unnamedCents)} was unnamed on ${formatDate(u.payDate, day)}. A correction is an adjustment the profile’s next payout pays, or takes back, like any other row. It cannot be undone; a mistake needs a second correction.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!valid} onClick={submit}>
            {cents ? `Write ${formatSgd(signed)}` : 'Write correction'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <NativeSelect
          label="Direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value as 'pay' | 'take')}
        >
          <option value="pay">Pay the profile</option>
          <option value="take">Take from the profile</option>
        </NativeSelect>
        <Input
          label="Amount (S$)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={(u.unnamedCents / 100).toFixed(2)}
          error={
            amount && (cents === null || cents <= 0) ? 'Enter an amount above zero' : undefined
          }
        />
        <Textarea
          label="Reason"
          hint="Kept on the adjustment and in the audit log."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={MAX_REASON}
          placeholder="A class payment with no row: Stripe charge ch_… of …"
        />
      </div>
    </Dialog>
  )
}

// ── recent runs ─────────────────────────────────────────────────────────────

function RecentRuns({ runs }: { runs: Overview['recentRuns'] }) {
  return (
    <Section
      title="Recent runs"
      description="The latest 20, newest first. A step that failed is recorded on its run, and the later steps still ran."
      empty="The release job has not run yet."
      count={runs.length}
    >
      <Table>
        <THead>
          <TR>
            <TH>Started</TH>
            <TH>Finished</TH>
            <TH className="text-right">Refunds sent</TH>
            <TH className="text-right">Classes released</TH>
            <TH className="text-right">Payouts</TH>
            <TH>Error</TH>
          </TR>
        </THead>
        <TBody>
          {runs.map((r) => (
            <TR key={r.id}>
              <TD className="whitespace-nowrap text-ink-secondary">
                {formatDate(r.startedAt, dateTime)}
              </TD>
              <TD className="whitespace-nowrap">
                {r.finishedAt ? (
                  formatDate(r.finishedAt, dateTime)
                ) : (
                  <Badge tone="warning">Not finished</Badge>
                )}
              </TD>
              <TD className="text-right font-mono">{r.refundsSent}</TD>
              <TD className="text-right font-mono">{r.classesReleased}</TD>
              <TD className="text-right font-mono">{r.payoutsCreated}</TD>
              <TD className="max-w-xs text-small">
                {r.error ? (
                  <span className="text-danger">{r.error}</span>
                ) : (
                  <span className="text-ink-tertiary">—</span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Section>
  )
}
