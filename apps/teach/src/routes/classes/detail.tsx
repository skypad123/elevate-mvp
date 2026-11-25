import type { CheckInMix, ClassDetail, DisputeDecision, DisputeView } from '@elevate/core'
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
import { ArrowLeft, Lock, Pencil, Send, Trash2, UserRoundCog } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { MANUAL_MARK_REASON_LABEL } from '../../components/attendance-dialogs'
import {
  formatBlockSpan,
  formatClassInstant,
  formatClassTime,
  useClass,
  useClassActions,
  useDisputes,
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

  const manages = can('class.manage')
  const readsRosters = detail.viewerIsInstructor || can('attendance.read')
  const draft = detail.status === 'draft'
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
              <Button asChild variant="secondary" icon={Pencil}>
                <Link to={path(`/classes/${detail.id}/edit`)}>Edit</Link>
              </Button>
              {draft ? (
                <Button icon={Send} loading={busy === 'publish'} onClick={() => void publish()}>
                  Publish
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />

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
                            {detail.viewerIsInstructor ? 'Run block' : 'View roster'}
                          </Link>
                        </Button>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </section>

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
                      { label: 'Venue', value: detail.venueAddress || 'No address yet' },
                      {
                        label: 'Venue position',
                        value: detail.venue
                          ? `Set ${formatClassInstant(detail.venue.setAt, zone)}, accurate to ${Math.round(detail.venue.accuracyM)} m`
                          : 'Not set. The instructor sets it from the roster screen, at the venue.',
                      },
                    ]
                  : []),
                { label: 'Seats', value: `${detail.enrolledCount} enrolled of ${detail.seats}` },
                { label: 'Instructor', value: detail.instructor.displayName },
                { label: 'Time zone', value: `${zoneLabel(zone)} (${zone})` },
                ...(detail.publishedAt
                  ? [{ label: 'Published', value: formatClassInstant(detail.publishedAt, zone) }]
                  : []),
              ]}
            />
            {manages ? (
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
