import {
  type AttendanceState,
  type CheckInMethod,
  type ClassDetail,
  type FlagReason,
  type ManualMarkSubState,
  type RefusalReason,
  ROSTER_STALE_MS,
  type RosterRow,
  type RosterView,
  type SetVenueLocation,
} from '@elevate/core'
import {
  Badge,
  type BadgeProps,
  Button,
  Dialog,
  EmptyState,
  PageHeader,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@elevate/web-ui'
import { ApiError, errorMessage } from '@elevate/web-ui/portal'
import { ArrowLeft, LocateFixed, MonitorUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ManualMarkDialog, OverturnDialog } from '../../components/attendance-dialogs'
import {
  formatBlockSpan,
  formatClassInstant,
  formatClassTime,
  useClass,
  useClassActions,
  useRoster,
} from '../../lib/classes'
import { useCurrentProfile } from '../../lib/profile'

// ── Roster labels (docs/designs/scheduled-classes-attendance.md, "Roster labels") ──────────────

export const STATE_LABEL: Record<AttendanceState, string> = {
  marked_by_hand: 'Present, marked by hand',
  present: 'Present',
  present_flagged: 'Present, flagged',
  mark_voided: 'Mark voided',
  overturned: 'Overturned',
  not_arrived: 'Not arrived',
}

const STATE_TONE: Record<AttendanceState, NonNullable<BadgeProps['tone']>> = {
  marked_by_hand: 'success',
  present: 'success',
  present_flagged: 'warning',
  mark_voided: 'danger',
  overturned: 'danger',
  not_arrived: 'neutral',
}

export function flagLabel(reason: FlagReason, distanceM: number | null): string {
  switch (reason) {
    case 'out_of_range':
      return distanceM === null
        ? 'far from the venue'
        : `far from the venue (${(distanceM / 1000).toFixed(1)} km)`
    case 'inaccurate':
      return 'location too imprecise'
    case 'denied':
      return 'location refused'
    case 'unavailable':
      return 'no location reading'
    case 'unsupported':
      return 'checked in from the app, no location'
  }
}

const REFUSAL_LABEL: Record<RefusalReason, string> = {
  code_wrong: 'wrong code',
  code_expired: 'expired code',
  not_open_yet: 'before check-in opened',
  closed: 'after check-in closed',
  too_many_attempts: 'too many wrong codes',
}

const METHOD_LABEL: Record<CheckInMethod, string> = {
  qr_link: 'QR code',
  typed_code: 'typed code',
}

const SUB_STATE_LABEL: Record<ManualMarkSubState, string> = {
  upheld: 'Dispute upheld',
  disputed: 'Disputed by the learner',
  settled: 'Settled',
  open: 'Open to dispute',
}

const PRESENT: readonly AttendanceState[] = ['marked_by_hand', 'present', 'present_flagged']
const MARKABLE: readonly AttendanceState[] = ['not_arrived', 'overturned', 'mark_voided']

/** A clock that ticks every `ms`, for "updated N s ago". */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(timer)
  }, [ms])
  return now
}

/**
 * The roster screen for one block. The assigned instructor runs the block from here: the code
 * screen, the venue position, and the corrections. The owner, a manager or staff see the same
 * table without any action. It asks the API again every 3 seconds while the tab is visible.
 */
export function RosterPage() {
  const { id = '', blockId = '' } = useParams()
  const { path } = useCurrentProfile()
  const detail = useClass(id)
  const roster = useRoster(id, blockId)

  const back = (
    <Link
      to={path(`/classes/${id}`)}
      className="mb-4 inline-flex items-center gap-1.5 text-small font-semibold text-brand-fg hover:underline"
    >
      <ArrowLeft className="size-4" />
      {detail.data?.name ?? 'Class'}
    </Link>
  )
  const failed = (detail.data ? null : detail.error) ?? (roster.data ? null : roster.error)
  if (failed)
    return (
      <>
        {back}
        <EmptyState tone="danger" title="Could not load the roster" body={errorMessage(failed)} />
      </>
    )
  if (!detail.data || !roster.data)
    return (
      <>
        {back}
        <Skeleton className="h-96 w-full rounded-card" />
      </>
    )
  return (
    <>
      {back}
      <Roster
        detail={detail.data}
        view={roster.data}
        updatedAt={roster.dataUpdatedAt}
        failing={roster.isError}
      />
    </>
  )
}

function Roster({
  detail,
  view,
  updatedAt,
  failing,
}: {
  detail: ClassDetail
  view: RosterView
  updatedAt: number
  failing: boolean
}) {
  const { path } = useCurrentProfile()
  const actions = useClassActions()
  const { toast } = useToast()
  const now = useNow(1000)
  const [overturning, setOverturning] = useState<RosterRow | null>(null)
  const [marking, setMarking] = useState<RosterRow | null>(null)
  const zone = detail.timeZone
  const runs = detail.viewerIsInstructor
  // A cancelled class has no block to run: no code screen, no venue to set.
  const cancelled = detail.status === 'cancelled'
  const blockIndex = detail.blocks.findIndex((b) => b.id === view.block.id)
  const ageMs = now - updatedAt
  const stale = ageMs > ROSTER_STALE_MS
  const present = view.learners.filter((l) => PRESENT.includes(l.state)).length
  // The server's clock, so a device clock that is wrong does not end a lockout early.
  const serverNow = new Date(view.serverTime).getTime()

  function openCodeScreen() {
    window.open(
      path(`/classes/${detail.id}/blocks/${view.block.id}/code`),
      `elevate-code-${view.block.id}`,
    )
  }

  async function correct(label: string, action: () => Promise<unknown>, done: string) {
    try {
      await action()
      toast({ tone: 'success', title: done })
      return true
    } catch (error) {
      toast({ tone: 'danger', title: label, description: errorMessage(error) })
      return false
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`${detail.name} · Block ${blockIndex + 1}`}
        title={formatBlockSpan(view.block, zone)}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Check-in {formatClassTime(view.block.checkInOpensAt, zone)}–
              {formatClassTime(view.block.checkInClosesAt, zone)}
            </span>
            <span className="font-semibold text-ink">
              {present} of {view.learners.length} present
            </span>
            <span
              role="status"
              className={stale || failing ? 'font-semibold text-danger' : 'text-ink-tertiary'}
            >
              {stale ? 'Not updating' : `Updated ${Math.max(0, Math.floor(ageMs / 1000))} s ago`}
            </span>
          </span>
        }
        actions={
          runs && !cancelled ? (
            <>
              {detail.delivery === 'in_person' ? <VenueButton detail={detail} /> : null}
              <Button icon={MonitorUp} onClick={openCodeScreen}>
                Open code screen
              </Button>
            </>
          ) : undefined
        }
      />

      {cancelled ? (
        <p role="status" className="mb-4 text-small text-ink-secondary">
          This class was cancelled, so this block does not run. You can read the roster.
        </p>
      ) : null}
      {runs && !cancelled && detail.delivery === 'in_person' && !view.venueSet ? (
        <div
          role="alert"
          className="mb-6 rounded-card border border-warning bg-warning-tint px-4 py-3 text-small text-ink"
        >
          Set the venue location before opening the code screen. Stand at the venue and choose "Set
          the venue location here"; until then no learner can check in.
        </div>
      ) : null}
      {!runs && !cancelled ? (
        <p className="mb-4 text-small text-ink-secondary">
          Only the class's instructor, {detail.instructor.displayName}, runs this block and corrects
          its attendance. You can read the roster.
        </p>
      ) : null}

      {view.learners.length === 0 ? (
        <EmptyState title="No learners yet" body="Learners enrolled in this class appear here." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Learner</TH>
              <TH>State</TH>
              <TH>Check-in</TH>
              <TH>Last refusal</TH>
              {runs ? (
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              ) : null}
            </TR>
          </THead>
          <TBody>
            {view.learners.map((row) => {
              const locked = row.lockedUntil && new Date(row.lockedUntil).getTime() > serverNow
              return (
                <TR key={row.enrollmentId}>
                  <TD>
                    <span className="font-semibold">{row.learner.displayName}</span>
                    <span className="block text-caption text-ink-tertiary">
                      {row.learner.email}
                    </span>
                  </TD>
                  <TD>
                    <Badge tone={STATE_TONE[row.state]}>{STATE_LABEL[row.state]}</Badge>
                    {row.state === 'present_flagged' && row.flagReason ? (
                      <span className="mt-1 block text-small text-warning">
                        {flagLabel(row.flagReason, row.distanceM)}
                      </span>
                    ) : null}
                    {row.manualMark ? (
                      <span className="mt-1 block text-caption text-ink-secondary">
                        {SUB_STATE_LABEL[row.manualMark.subState]}
                        {row.manualMark.subState === 'open'
                          ? ` until ${formatClassInstant(row.manualMark.disputeUntil, zone)}`
                          : ''}
                      </span>
                    ) : null}
                  </TD>
                  <TD className="text-small text-ink-secondary">
                    <CheckInCell row={row} zone={zone} />
                  </TD>
                  <TD className="text-small text-ink-secondary">
                    {locked ? (
                      <span className="block font-semibold text-danger">too many wrong codes</span>
                    ) : null}
                    {row.lastRefusal ? (
                      <span className="block">
                        {REFUSAL_LABEL[row.lastRefusal.reason]},{' '}
                        {formatClassTime(row.lastRefusal.at, zone)}
                      </span>
                    ) : locked ? null : (
                      <span className="text-ink-tertiary">—</span>
                    )}
                  </TD>
                  {runs ? (
                    <TD className="text-right">
                      {row.state === 'present_flagged' ? (
                        <Button size="sm" variant="secondary" onClick={() => setOverturning(row)}>
                          Overturn
                        </Button>
                      ) : null}
                      {MARKABLE.includes(row.state) ? (
                        <Button size="sm" variant="secondary" onClick={() => setMarking(row)}>
                          Mark present by hand
                        </Button>
                      ) : null}
                    </TD>
                  ) : null}
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      <OverturnDialog
        learnerName={overturning?.learner.displayName ?? null}
        onClose={() => setOverturning(null)}
        onSubmit={(input) => {
          const row = overturning
          if (!row) return Promise.resolve(false)
          return correct(
            'Could not overturn',
            () => actions.overturn(detail.id, view.block.id, row.enrollmentId, input),
            `${row.learner.displayName}'s check-in overturned`,
          )
        }}
      />
      <ManualMarkDialog
        learnerName={marking?.learner.displayName ?? null}
        onClose={() => setMarking(null)}
        onSubmit={(input) => {
          const row = marking
          if (!row) return Promise.resolve(false)
          return correct(
            'Could not mark present',
            () => actions.manualMark(detail.id, view.block.id, row.enrollmentId, input),
            `${row.learner.displayName} marked present`,
          )
        }}
      />
    </>
  )
}

/** When and how the learner checked in, with the distance and the reading's accuracy. */
function CheckInCell({ row, zone }: { row: RosterRow; zone: string }) {
  if (!row.checkedInAt) return <span className="text-ink-tertiary">—</span>
  const measures = [
    row.distanceM !== null ? `${Math.round(row.distanceM)} m from the venue` : null,
    row.accuracyM !== null ? `accurate to ${Math.round(row.accuracyM)} m` : null,
  ].filter(Boolean)
  return (
    <>
      <span className="block">
        {formatClassTime(row.checkedInAt, zone)}
        {row.method ? `, ${METHOD_LABEL[row.method]}` : ''}
      </span>
      {measures.length ? <span className="block text-caption">{measures.join(', ')}</span> : null}
    </>
  )
}

/** Why a position could not be read, in words. */
function geolocationProblem(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED)
    return 'Location was refused. Allow location for this site in the browser, then try again.'
  if (error.code === error.TIMEOUT) return 'No position came in time. Try again.'
  return 'The device could not find its position. Try again.'
}

/**
 * "Set the venue location here": reads this device's position and stores it as the venue's.
 * A reading less precise than the API accepts is shown with its accuracy, to confirm or retry.
 */
function VenueButton({ detail }: { detail: ClassDetail }) {
  const actions = useClassActions()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [poor, setPoor] = useState<SetVenueLocation | null>(null)

  async function send(reading: SetVenueLocation) {
    setBusy(true)
    try {
      await actions.setVenueLocation(detail.id, reading)
      setPoor(null)
      toast({
        tone: 'success',
        title: 'Venue location set',
        description: `Accurate to ${Math.round(reading.accuracyM)} m.`,
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'venue_accuracy_poor') {
        setPoor(reading)
      } else {
        toast({
          tone: 'danger',
          title: 'Could not set the venue location',
          description: errorMessage(error),
        })
      }
    } finally {
      setBusy(false)
    }
  }

  function read() {
    if (!('geolocation' in navigator)) {
      toast({
        tone: 'danger',
        title: 'Could not set the venue location',
        description: 'This browser cannot read its position.',
      })
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (position) =>
        void send({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }),
      (error) => {
        setBusy(false)
        toast({
          tone: 'danger',
          title: 'Could not set the venue location',
          description: geolocationProblem(error),
        })
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  return (
    <>
      <Button variant="secondary" icon={LocateFixed} loading={busy} onClick={read}>
        Set the venue location here
      </Button>
      <Dialog
        open={!!poor}
        onOpenChange={(open) => !open && setPoor(null)}
        title="The reading is not precise"
        description={
          poor
            ? `This device's position is accurate to only ${Math.round(poor.accuracyM)} m. Check-ins are measured against it, so a poor reading may flag learners who are in the room. Moving near a window or turning on Wi-Fi often helps.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setPoor(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setPoor(null)
                read()
              }}
            >
              Try again
            </Button>
            <Button
              loading={busy}
              onClick={() => poor && void send({ ...poor, confirmPoorAccuracy: true })}
            >
              Use it anyway
            </Button>
          </>
        }
      />
    </>
  )
}
