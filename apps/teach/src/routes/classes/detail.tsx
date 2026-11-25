import {
  type CheckInMix,
  type ClassDetail,
  type DisputeDecision,
  type DisputeView,
  formatSgd,
  type NotOnSaleReason,
  type SeatRefundKind,
  type SeatRefundStatus,
  type SeatRefundView,
  type SeatView,
  UNFINISHED_SEAT_REFUND_STATUSES,
} from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  Dialog,
  EmptyState,
  NativeSelect,
  PageHeader,
  Skeleton,
  StatCard,
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
  useToast,
} from '@elevate/web-ui'
import { ApiError, errorMessage } from '@elevate/web-ui/portal'
import { ArrowLeft, Ban, Lock, Pencil, Send, Trash2, UserRoundCog } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { MANUAL_MARK_REASON_LABEL } from '../../components/attendance-dialogs'
import { CancelClassDialog, MoveSeatDialog, RefundSeatDialog } from '../../components/seat-dialogs'
import {
  formatBlockSpan,
  formatClassInstant,
  formatClassTime,
  useClass,
  useClassActions,
  useDisputes,
  useSeats,
  zoneLabel,
} from '../../lib/classes'
import { useMembers } from '../../lib/members'
import { useCurrentProfile } from '../../lib/profile'
import { CLASS_STATUS, DELIVERY_LABEL } from './list'

/** The check-in mix, in the order the design lists it. `enrolled` is the sum of the rest. */
export const MIX_LABEL: Record<Exclude<keyof CheckInMix, 'enrolled'>, string> = {
  selfCheckIn: 'Self check-in',
  flaggedFromApp: 'Flagged, from the app',
  flaggedOther: 'Flagged, other',
  overturned: 'Overturned',
  markedByHand: 'Marked by hand',
  notArrived: 'Not arrived',
}

const PUBLISH_PROBLEM: Record<string, string> = {
  course_not_published: 'The course is not on sale.',
  no_blocks: 'The class has no blocks.',
  block_ended: 'A block has already ended. Move it or remove it.',
  instructor_not_member: 'The instructor is no longer the owner or a member of this profile.',
  venue_address_missing: 'An in-person class needs a venue address.',
}

/** Why learners cannot buy a seat in a published class, in words. */
const NOT_ON_SALE: Record<NotOnSaleReason, string> = {
  sales_off: 'Class sales are switched off on Elevate for now.',
  not_published: 'The class is not published.',
  cancelled: 'The class was cancelled.',
  started: 'The class has started, so no more seats are sold.',
  too_far_ahead:
    'Its last block ends more than 75 days from now. It goes on sale once it ends within 75 days.',
  profile_not_opted_in:
    'This profile does not sell classes yet. The owner can accept the held-payout terms in Settings.',
  profile_leaving: 'This profile has stopped selling classes.',
  account_not_payable:
    'The profile’s Stripe account cannot take payments. The owner can finish it from Settings.',
  course_not_on_sale: 'The course is not on sale.',
}

type Tone = 'neutral' | 'warning' | 'success' | 'danger'

const SEAT_STATUS: Record<SeatView['status'], { label: string; tone: Tone }> = {
  pending_payment: { label: 'Paying', tone: 'neutral' },
  active: { label: 'Seat', tone: 'success' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

/** A refunded seat whose refund is not done yet, by the refund's state. */
const SEAT_REFUND_PENDING: Record<
  Exclude<SeatRefundStatus, 'done'>,
  { label: string; tone: Tone }
> = {
  waiting: { label: 'Refund waiting', tone: 'warning' },
  pending: { label: 'Refund queued', tone: 'warning' },
  refund_sent: { label: 'Refund sent', tone: 'warning' },
  closed: { label: 'Refund closed', tone: 'neutral' },
  failed: { label: 'Refund failed', tone: 'danger' },
}

const WITHDREW: readonly SeatRefundKind[] = ['learner_withdrew', 'changed_withdrew']

/**
 * A seat's status in words. A seat the learner withdrew from says so, and a refunded seat whose
 * refund is still on its way shows the refund's state instead of "Refunded".
 */
function seatStatus(seat: SeatView): { label: string; tone: Tone } {
  if (seat.status === 'cancelled' && seat.refunds.some((r) => WITHDREW.includes(r.kind)))
    return { label: 'Withdrew', tone: 'neutral' }
  // The refunds are listed oldest first; the last is the one that refunded the seat.
  const latest = seat.refunds.at(-1)
  if (seat.status === 'refunded' && latest && latest.status !== 'done')
    return SEAT_REFUND_PENDING[latest.status]
  return SEAT_STATUS[seat.status]
}

export const REFUND_KIND_LABEL: Record<SeatRefundKind, string> = {
  teacher_cancelled: 'Class cancelled',
  teacher_cancelled_part: 'Class cancelled, part refund',
  changed_withdrew: 'Withdrew after a change',
  learner_withdrew: 'Withdrew',
  discretionary: 'Refund given',
  elevate_cancelled: 'Cancelled by Elevate',
  seat_lost: 'Seat lost while paying',
  dispute_lost: 'Bank dispute lost',
}

const REFUND_STATUS: Record<
  SeatRefundStatus,
  { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }
> = {
  waiting: { label: 'Waiting', tone: 'warning' },
  pending: { label: 'Queued', tone: 'warning' },
  refund_sent: { label: 'Sent to Stripe', tone: 'warning' },
  done: { label: 'Refunded', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
}

const WAITING_FOR: Record<string, string> = {
  manual_mark: 'Waits until the learner’s manual mark is settled or disputed.',
  bank_dispute: 'Waits for the learner’s bank to decide a dispute.',
  stripe_fee: 'Waits for Stripe to report its fee.',
}

const CLOSED_REASON: Record<string, string> = {
  mark_settled: 'The manual mark settled, so the learner counts as attended.',
  bank_returned: 'The learner’s bank returned the money.',
  support: 'Closed by Elevate.',
}

/** One class: its details, its blocks with their check-in mix, publishing and its disputes. */
export function ClassDetailPage() {
  const { id = '' } = useParams()
  const { path } = useCurrentProfile()
  const query = useClass(id)

  const back = (
    <Link
      to={path('/classes')}
      className="mb-4 inline-flex items-center gap-1.5 text-small font-semibold text-brand-fg hover:underline"
    >
      <ArrowLeft className="size-4" />
      Classes
    </Link>
  )
  if (query.isPending)
    return (
      <>
        {back}
        <Skeleton className="h-96 w-full rounded-card" />
      </>
    )
  if (query.isError)
    return (
      <>
        {back}
        <EmptyState
          tone="danger"
          title={
            query.error instanceof ApiError && query.error.status === 404
              ? 'Class not found'
              : 'Could not load the class'
          }
          body={errorMessage(query.error)}
        />
      </>
    )
  return (
    <>
      {back}
      <ClassView detail={query.data} />
    </>
  )
}

function ClassView({ detail }: { detail: ClassDetail }) {
  const { path, can } = useCurrentProfile()
  const navigate = useNavigate()
  const actions = useClassActions()
  const { toast } = useToast()
  const [problems, setProblems] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reassigning, setReassigning] = useState(false)

  const [cancelling, setCancelling] = useState(false)

  const manages = can('class.manage')
  const readsRosters = detail.viewerIsInstructor || can('attendance.read')
  const readsSeats = can('earnings.read')
  const seats = useSeats(detail.id, readsSeats)
  const draft = detail.status === 'draft'
  const cancelled = detail.status === 'cancelled'
  // A released class cannot be cancelled by the profile; a Support admin still can.
  const canCancel =
    manages && detail.status === 'published' && detail.releasedAt === null && seats.isSuccess
  const zone = detail.timeZone

  async function publish() {
    setBusy('publish')
    setProblems([])
    try {
      await actions.publish(detail.id)
      toast({ tone: 'success', title: 'Class published' })
    } catch (error) {
      const list =
        error instanceof ApiError && error.code === 'class_not_publishable'
          ? ((error.details as { problems?: string[] } | undefined)?.problems ?? [])
          : []
      setProblems(list)
      toast({ tone: 'danger', title: 'Could not publish', description: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('delete')
    try {
      await actions.remove(detail.id)
      toast({ tone: 'success', title: 'Draft class deleted' })
      navigate(path('/classes'))
    } catch (error) {
      toast({ tone: 'danger', title: 'Could not delete', description: errorMessage(error) })
    } finally {
      setBusy(null)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={detail.courseTitle}
        title={detail.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={CLASS_STATUS[detail.status].tone}>
              {CLASS_STATUS[detail.status].label}
            </Badge>
            <span>{DELIVERY_LABEL[detail.delivery]}</span>
            {detail.viewerIsInstructor ? <Badge tone="brand">You instruct this class</Badge> : null}
          </span>
        }
        actions={
          manages ? (
            <>
              {cancelled ? null : (
                <Button asChild variant="secondary" icon={Pencil}>
                  <Link to={path(`/classes/${detail.id}/edit`)}>Edit</Link>
                </Button>
              )}
              {canCancel ? (
                <Button variant="danger" icon={Ban} onClick={() => setCancelling(true)}>
                  Cancel class
                </Button>
              ) : null}
              {draft ? (
                <Button icon={Send} loading={busy === 'publish'} onClick={() => void publish()}>
                  Publish
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />

      {cancelled ? (
        <div
          role="status"
          className="mb-6 rounded-card border border-border bg-surface-muted px-4 py-3 text-small text-ink"
        >
          <p className="font-semibold">
            This class was cancelled
            {detail.cancelledAt ? ` on ${formatClassInstant(detail.cancelledAt, zone)}` : ''}.
          </p>
          {detail.cancelReason ? <p className="mt-1">Reason: “{detail.cancelReason}”</p> : null}
          <p className="mt-1 text-ink-secondary">
            {readsSeats
              ? 'Each learner’s refund and its state are listed under Seats.'
              : 'The learners’ refunds are sent by Elevate.'}
          </p>
        </div>
      ) : detail.status === 'published' && detail.notOnSaleReason ? (
        <div
          role="status"
          className="mb-6 rounded-card border border-warning bg-warning-tint px-4 py-3 text-small text-ink"
        >
          <p className="font-semibold">Not on sale</p>
          <p className="mt-1">{NOT_ON_SALE[detail.notOnSaleReason]}</p>
        </div>
      ) : null}

      {problems.length > 0 ? (
        <div
          role="alert"
          className="mb-6 rounded-card border border-danger bg-danger-tint px-4 py-3 text-small text-ink"
        >
          <p className="font-semibold">The class cannot be published yet:</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{PUBLISH_PROBLEM[p] ?? p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <h2 className="font-display text-h3 font-semibold text-ink">Check-in mix</h2>
            <p className="text-small text-ink-secondary">
              Each learner counted once per block, over the blocks whose check-in has opened.
            </p>
            <MixCards mix={detail.mix} />
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-h3 font-semibold text-ink">Blocks</h2>
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Check-in</TH>
                  <TH>Mix</TH>
                  <TH>
                    <span className="sr-only">Roster</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {detail.blocks.map((block, index) => (
                  <TR key={block.id}>
                    <TD>
                      <span className="font-semibold">Block {index + 1}</span>
                      <span className="block text-ink-secondary">
                        {formatBlockSpan(block, zone)}
                      </span>
                      {block.frozen ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-caption text-ink-tertiary">
                          <Lock className="size-3" aria-hidden /> Times fixed
                        </span>
                      ) : null}
                    </TD>
                    <TD className="whitespace-nowrap text-ink-secondary">
                      {formatClassTime(block.checkInOpensAt, zone)}–
                      {formatClassTime(block.checkInClosesAt, zone)} {zoneLabel(zone)}
                    </TD>
                    <TD className="text-ink-secondary">
                      <MixLine
                        mix={block.mix}
                        notOpenYet={Date.parse(block.checkInOpensAt) > Date.now()}
                      />
                    </TD>
                    <TD className="text-right">
                      {readsRosters ? (
                        <Button asChild size="sm" variant="secondary">
                          <Link to={path(`/classes/${detail.id}/blocks/${block.id}`)}>
                            {detail.viewerIsInstructor && !cancelled ? 'Run block' : 'View roster'}
                          </Link>
                        </Button>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </section>

          {readsSeats ? <SeatsSection detail={detail} seats={seats} /> : null}

          {can('attendance.review') ? <DisputesSection detail={detail} /> : null}
        </div>

        <div className="space-y-6">
          <Card as="section">
            <CardHeader title="Details" />
            <DescriptionList
              items={[
                { label: 'Course', value: detail.courseTitle },
                { label: 'Delivery', value: DELIVERY_LABEL[detail.delivery] },
                ...(detail.delivery === 'in_person'
                  ? [
                      {
                        label: 'Venue',
                        value:
                          detail.status === 'published' && detail.venueAddress ? (
                            <>
                              {detail.venueAddress}
                              <span className="block text-caption text-ink-tertiary">
                                Public: the course page shows this address to everyone.
                              </span>
                            </>
                          ) : (
                            detail.venueAddress || 'No address yet'
                          ),
                      },
                      {
                        label: 'Venue position',
                        value: detail.venue
                          ? `Set ${formatClassInstant(detail.venue.setAt, zone)}, accurate to ${Math.round(detail.venue.accuracyM)} m`
                          : 'Not set. The instructor sets it from the roster screen, at the venue.',
                      },
                    ]
                  : []),
                {
                  label: 'Seats',
                  value: `${detail.enrolledCount} enrolled of ${detail.seats}${
                    detail.seatsTaken > detail.enrolledCount
                      ? ` (${detail.seatsTaken} taken, counting learners paying now)`
                      : ''
                  }`,
                },
                ...(detail.status === 'published'
                  ? [{ label: 'On sale', value: detail.notOnSaleReason ? 'No' : 'Yes' }]
                  : []),
                { label: 'Instructor', value: detail.instructor.displayName },
                { label: 'Time zone', value: `${zoneLabel(zone)} (${zone})` },
                ...(detail.publishedAt
                  ? [{ label: 'Published', value: formatClassInstant(detail.publishedAt, zone) }]
                  : []),
              ]}
            />
            {manages && !cancelled ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={UserRoundCog}
                  onClick={() => setReassigning(true)}
                >
                  Change instructor
                </Button>
                {draft ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete draft
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${detail.name}?`}
        description="The draft and its blocks are deleted. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === 'delete'} onClick={() => void remove()}>
              Delete
            </Button>
          </>
        }
      />
      <ReassignDialog detail={detail} open={reassigning} onOpenChange={setReassigning} />
      {canCancel ? (
        <CancelClassDialog
          detail={detail}
          seats={seats.data ?? []}
          open={cancelling}
          onOpenChange={setCancelling}
        />
      ) : null}
    </>
  )
}

function MixCards({ mix }: { mix: CheckInMix }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Enrolled" value={mix.enrolled} />
      {(Object.keys(MIX_LABEL) as (keyof typeof MIX_LABEL)[]).map((key) => (
        <StatCard key={key} label={MIX_LABEL[key]} value={mix[key]} />
      ))}
    </div>
  )
}

/**
 * A block's mix on one line, leaving out the counts that are zero. Before check-in opens every
 * learner is "not arrived" by rule, so the line says that check-in has not opened instead.
 */
export function MixLine({ mix, notOpenYet = false }: { mix: CheckInMix; notOpenYet?: boolean }) {
  if (notOpenYet) {
    return (
      <span className="text-small">
        {mix.enrolled} enrolled
        <span className="block text-caption">Check-in not open yet</span>
      </span>
    )
  }
  const parts = (Object.keys(MIX_LABEL) as (keyof typeof MIX_LABEL)[])
    .filter((key) => mix[key] > 0)
    .map((key) => `${MIX_LABEL[key]} ${mix[key]}`)
  return (
    <span className="text-small">
      {mix.enrolled} enrolled
      {parts.length ? <span className="block text-caption">{parts.join(' · ')}</span> : null}
    </span>
  )
}

/** Moves the class to another instructor: the owner or a current member. */
function ReassignDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: ClassDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { profile, can } = useCurrentProfile()
  const members = useMembers(open && can('members.read'))
  const actions = useClassActions()
  const { toast } = useToast()
  const [userId, setUserId] = useState(detail.instructor.userId)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setUserId(detail.instructor.userId)
  }, [open, detail.instructor.userId])

  const owner = profile?.owner
  const options = [
    ...(owner ? [{ userId: owner.id, label: `${owner.name ?? owner.email} (owner)` }] : []),
    ...(members.data?.members ?? []).map((m) => ({
      userId: m.userId,
      label: `${m.name ?? m.email} (${m.role})`,
    })),
  ]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await actions.setInstructor(detail.id, userId)
      toast({ tone: 'success', title: 'Instructor changed' })
      onOpenChange(false)
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Could not change the instructor',
        description: errorMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change instructor"
      description="Only the instructor runs the blocks and corrects attendance. The change is recorded."
    >
      <form onSubmit={submit} className="space-y-4">
        <NativeSelect label="Instructor" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {options.some((o) => o.userId === detail.instructor.userId) ? null : (
            <option value={detail.instructor.userId}>{detail.instructor.displayName}</option>
          )}
          {options.map((o) => (
            <option key={o.userId} value={o.userId}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={userId === detail.instructor.userId}>
            Change instructor
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Disputed manual marks, open ones first. The owner or a manager upholds or voids each. */
function DisputesSection({ detail }: { detail: ClassDetail }) {
  const disputes = useDisputes(detail.id)
  const actions = useClassActions()
  const { toast } = useToast()
  const [deciding, setDeciding] = useState<{
    dispute: DisputeView
    decision: DisputeDecision
  } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const zone = detail.timeZone
  const blockLabel = (blockId: string) => {
    const index = detail.blocks.findIndex((b) => b.id === blockId)
    const block = detail.blocks[index]
    return block ? `Block ${index + 1}, ${formatBlockSpan(block, zone)}` : 'A removed block'
  }

  async function decide(e: FormEvent) {
    e.preventDefault()
    if (!deciding || !reason.trim()) return
    setBusy(true)
    try {
      await actions.decide(detail.id, deciding.dispute.disputeEventId, {
        decision: deciding.decision,
        reason: reason.trim(),
      })
      toast({
        tone: 'success',
        title: deciding.decision === 'upheld' ? 'Mark upheld' : 'Mark voided',
      })
      setDeciding(null)
    } catch (error) {
      toast({ tone: 'danger', title: 'Could not decide', description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-h3 font-semibold text-ink">Disputes</h2>
      <p className="text-small text-ink-secondary">
        A learner can dispute a manual mark for 7 days. Upholding keeps them present. Voiding means
        the mark no longer stands; the instructor can mark them again.
      </p>
      {disputes.isPending ? (
        <Skeleton className="h-24 w-full rounded-card" />
      ) : disputes.isError ? (
        <EmptyState
          tone="danger"
          title="Could not load disputes"
          body={errorMessage(disputes.error)}
        />
      ) : disputes.data.length === 0 ? (
        <p className="text-small text-ink-tertiary">No disputes.</p>
      ) : (
        <ul className="space-y-3">
          {disputes.data.map((d) => (
            <li key={d.disputeEventId}>
              <Card className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{d.learnerName}</p>
                    <p className="text-small text-ink-secondary">{blockLabel(d.blockId)}</p>
                  </div>
                  {d.decision ? (
                    <Badge tone={d.decision.decision === 'upheld' ? 'success' : 'danger'}>
                      {d.decision.decision === 'upheld' ? 'Upheld' : 'Voided'}
                    </Badge>
                  ) : (
                    <Badge tone="warning">Waiting for a decision</Badge>
                  )}
                </div>
                <p className="text-small text-ink">
                  Marked present by {d.markedByName}, {formatClassInstant(d.markedAt, zone)}:{' '}
                  {MANUAL_MARK_REASON_LABEL[d.markReasonCode]}
                  {d.markReason ? ` (“${d.markReason}”)` : ''}
                </p>
                <p className="text-small text-ink">
                  Disputed {formatClassInstant(d.disputedAt, zone)}: “{d.disputeReason}”
                </p>
                {d.decision ? (
                  <p className="text-small text-ink-secondary">
                    {d.decision.decision === 'upheld' ? 'Upheld' : 'Voided'} by{' '}
                    {d.decision.decidedByName}, {formatClassInstant(d.decision.decidedAt, zone)}: “
                    {d.decision.reason}”
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReason('')
                        setDeciding({ dispute: d, decision: 'upheld' })
                      }}
                    >
                      Uphold
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setReason('')
                        setDeciding({ dispute: d, decision: 'voided' })
                      }}
                    >
                      Void
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={!!deciding}
        onOpenChange={(open) => !open && setDeciding(null)}
        title={
          deciding?.decision === 'upheld'
            ? `Uphold the mark for ${deciding.dispute.learnerName}`
            : `Void the mark for ${deciding?.dispute.learnerName ?? ''}`
        }
        description={
          deciding?.decision === 'upheld'
            ? 'The learner stays present, shown as upheld. The decision is final.'
            : 'The learner is no longer present for this block. The instructor can mark them again. The decision is final.'
        }
      >
        <form onSubmit={decide} className="space-y-4">
          <Textarea
            label="Reason"
            hint="Kept on the record with the decision."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeciding(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={deciding?.decision === 'voided' ? 'danger' : 'primary'}
              loading={busy}
              disabled={!reason.trim()}
            >
              {deciding?.decision === 'upheld' ? 'Uphold' : 'Void'}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  )
}

/** A seat refund's state in words: its status, and what it waits for or why it was closed. */
function RefundState({ refund, zone }: { refund: SeatRefundView; zone: string }) {
  const status = REFUND_STATUS[refund.status]
  const note =
    refund.status === 'waiting' && refund.waitingFor
      ? WAITING_FOR[refund.waitingFor]
      : refund.status === 'closed' && refund.closedReason
        ? CLOSED_REASON[refund.closedReason]
        : refund.status === 'failed'
          ? 'Stripe refused it. Elevate is looking at it.'
          : refund.status === 'done' && refund.completedAt
            ? `On ${formatClassInstant(refund.completedAt, zone)}.`
            : null
  return (
    <span className="block">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">{REFUND_KIND_LABEL[refund.kind]}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
        {refund.learnerRefundCents !== null ? (
          <span className="font-mono tabular-nums">{formatSgd(refund.learnerRefundCents)}</span>
        ) : null}
      </span>
      {note ? <span className="block text-caption text-ink-secondary">{note}</span> : null}
    </span>
  )
}

/**
 * The seats bought in the class, for those who read earnings: each learner's money, attendance
 * as the refund rules count it, and their refunds. The owner and managers move a learner; a
 * discretionary refund needs `class.refund`.
 */
function SeatsSection({
  detail,
  seats,
}: {
  detail: ClassDetail
  seats: ReturnType<typeof useSeats>
}) {
  const { can } = useCurrentProfile()
  const [moving, setMoving] = useState<SeatView | null>(null)
  const [refunding, setRefunding] = useState<SeatView | null>(null)
  const zone = detail.timeZone
  const manages = can('class.manage')
  const refunds = can('class.refund')

  return (
    <section className="space-y-3">
      <h2 className="font-display text-h3 font-semibold text-ink">Seats</h2>
      <p className="text-small text-ink-secondary">
        A learner counts as attended once they check in themselves, or once a manual mark has gone 7
        days without a dispute. Refunds are sent within 15 minutes.
      </p>
      {seats.isPending ? (
        <Skeleton className="h-24 w-full rounded-card" />
      ) : seats.isError ? (
        <EmptyState
          tone="danger"
          title="Could not load the seats"
          body={errorMessage(seats.error)}
        />
      ) : seats.data.length === 0 ? (
        <p className="text-small text-ink-tertiary">No seats sold yet.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Learner</TH>
              <TH>Status</TH>
              <TH className="text-right">Paid</TH>
              <TH className="text-right">Refunded</TH>
              <TH>Attendance</TH>
              <TH>Refund</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {seats.data.map((seat) => {
              const canMove = manages && seat.canMove
              const canRefund = refunds && seat.canRefundUpToCents > 0
              const status = seatStatus(seat)
              // Nothing has gone back while the latest refund is on its way: no S$0.00.
              const latest = seat.refunds.at(-1)
              const refundPending =
                seat.refundedCents === 0 &&
                !!latest &&
                (UNFINISHED_SEAT_REFUND_STATUSES as readonly string[]).includes(latest.status)
              return (
                <TR key={seat.enrollmentId}>
                  <TD>
                    <span className="font-semibold">{seat.learner.displayName}</span>
                    <span className="block text-caption text-ink-secondary">
                      {seat.learner.email}
                    </span>
                    {seat.movedAt ? (
                      <span className="block text-caption text-ink-tertiary">
                        Moved here {formatClassInstant(seat.movedAt, zone)}
                      </span>
                    ) : null}
                  </TD>
                  <TD>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {seat.bankDisputeStatus === 'open' ? (
                      <span className="mt-1 block text-caption text-warning">
                        Bank dispute open
                      </span>
                    ) : seat.bankDisputeStatus === 'lost' ? (
                      <span className="mt-1 block text-caption text-danger">Bank dispute lost</span>
                    ) : null}
                  </TD>
                  <TD className="text-right">
                    <span className="font-mono tabular-nums">{formatSgd(seat.paidCents)}</span>
                    {seat.released ? (
                      <span className="block text-caption text-ink-tertiary">Released</span>
                    ) : null}
                  </TD>
                  <TD className="text-right">
                    {refundPending ? (
                      <span className="text-ink-tertiary">—</span>
                    ) : (
                      <span className="font-mono tabular-nums text-ink-secondary">
                        {formatSgd(seat.refundedCents)}
                      </span>
                    )}
                  </TD>
                  <TD className="text-small">
                    {seat.counted ? (
                      'Counted as attended'
                    ) : seat.openMarkUntil ? (
                      <>
                        Manual mark open until
                        <span className="block text-caption text-ink-secondary">
                          {formatClassInstant(seat.openMarkUntil, zone)}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-tertiary">Not attended</span>
                    )}
                    {seat.classChangedAt && !seat.counted && seat.status === 'active' ? (
                      <span className="block text-caption text-ink-secondary">
                        Can withdraw in full until the class starts
                      </span>
                    ) : null}
                  </TD>
                  <TD className="text-small">
                    {seat.refunds.length > 0 ? (
                      <div className="space-y-1">
                        {seat.refunds.map((refund) => (
                          <RefundState key={refund.id} refund={refund} zone={zone} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-tertiary">—</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      {canMove ? (
                        <Button size="sm" variant="secondary" onClick={() => setMoving(seat)}>
                          Move
                        </Button>
                      ) : null}
                      {canRefund ? (
                        <Button size="sm" variant="secondary" onClick={() => setRefunding(seat)}>
                          Refund
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}
      <MoveSeatDialog
        classId={detail.id}
        seat={moving}
        timeZone={zone}
        onClose={() => setMoving(null)}
      />
      <RefundSeatDialog classId={detail.id} seat={refunding} onClose={() => setRefunding(null)} />
    </section>
  )
}
