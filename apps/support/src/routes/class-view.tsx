import {
  type AttendanceEventType,
  type AttendanceState,
  type FlagReason,
  type ManualMarkSubState,
  REFUSAL_REASONS,
  type RefusalReason,
  type SupportClass,
  type SupportClassBlock,
} from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  EmptyState,
  formatDate,
  NativeSelect,
  PageHeader,
  Skeleton,
  type StatusTone,
  statusLabel,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@elevate/web-ui'
import { errorMessage } from '@elevate/web-ui/portal'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { useSupportBlock, useSupportClass } from '../lib/queries'
import { dateRange, deliveryLabel } from './classes'

type Learner = SupportClassBlock['learners'][number]
type LearnerEvent = Learner['events'][number]

// ── English labels for the values the API sends ─────────────────────────────

const stateLabel: Record<AttendanceState, string> = {
  marked_by_hand: 'Present, marked by hand',
  present: 'Present',
  present_flagged: 'Present, flagged',
  mark_voided: 'Mark voided',
  overturned: 'Overturned',
  not_arrived: 'Not arrived',
}

const stateTone: Record<AttendanceState, StatusTone> = {
  marked_by_hand: 'success',
  present: 'success',
  present_flagged: 'warning',
  mark_voided: 'danger',
  overturned: 'danger',
  not_arrived: 'neutral',
}

const subStateLabel: Record<ManualMarkSubState, string> = {
  upheld: 'upheld',
  disputed: 'disputed',
  settled: 'settled',
  open: 'open to dispute',
}

const refusalLabel: Record<RefusalReason, string> = {
  code_wrong: 'Wrong code',
  code_expired: 'Expired code',
  not_open_yet: 'Not open yet',
  closed: 'Closed',
  too_many_attempts: 'Too many wrong codes',
}

const eventLabel: Record<AttendanceEventType, string> = {
  attempt_refused: 'Refused attempt',
  check_in: 'Check-in',
  overturn: 'Overturn',
  manual_mark: 'Manual mark',
  dispute: 'Dispute',
  dispute_decision: 'Dispute decision',
}

/** Overturn, manual-mark and refusal reason codes; an unknown code falls back to its own words. */
const reasonCodeLabel: Record<string, string> = {
  not_in_room: 'Not in the room',
  wrong_person: 'Wrong person',
  phone_not_working: 'Phone not working',
  no_phone: 'No phone',
  no_network: 'No network',
  app_problem: 'App problem',
  other: 'Other',
  ...refusalLabel,
}

const CORRECTION_TYPES: ReadonlySet<AttendanceEventType> = new Set([
  'overturn',
  'manual_mark',
  'dispute',
  'dispute_decision',
])

function metres(m: number | null): string {
  if (m === null) return '—'
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

function flagLabel(reason: FlagReason, distanceM: number | null): string {
  switch (reason) {
    case 'out_of_range':
      return `far from the venue (${metres(distanceM)})`
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

/** The chosen block: `?block=`, else the one open for check-in now, else the next, else the last. */
function defaultBlockId(blocks: SupportClass['blocks'], now: number): string {
  const open = blocks.find(
    (b) => Date.parse(b.checkInOpensAt) <= now && now <= Date.parse(b.checkInClosesAt),
  )
  const next = blocks.find((b) => Date.parse(b.checkInOpensAt) > now)
  return (open ?? next ?? blocks.at(-1))?.id ?? ''
}

export function ClassView() {
  const { id = '' } = useParams()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/classes'
  const query = useSupportClass(id)
  return (
    <>
      <Link
        to={from}
        className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Classes
      </Link>
      {query.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : query.isError ? (
        <EmptyState
          tone="danger"
          title="Could not load this class"
          body={errorMessage(query.error)}
        />
      ) : (
        <ClassBody c={query.data} refetchClass={() => query.refetch()} />
      )}
    </>
  )
}

function ClassBody({ c, refetchClass }: { c: SupportClass; refetchClass: () => unknown }) {
  const [params, setParams] = useSearchParams()
  const asked = params.get('block')
  const blockId =
    asked && c.blocks.some((b) => b.id === asked) ? asked : defaultBlockId(c.blocks, Date.now())
  const block = useSupportBlock(c.id, blockId)
  const time = (iso: string | null) =>
    formatDate(iso, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: c.timeZone,
      timeZoneName: 'short',
    })

  return (
    <>
      <PageHeader
        eyebrow={`Class · ${c.profile.displayName}`}
        title={c.name}
        description={c.courseTitle}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={block.isFetching}
            onClick={() => {
              refetchClass()
              if (blockId) block.refetch()
            }}
          >
            Refresh
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section">
          <CardHeader title="Class" />
          <DescriptionList
            items={[
              { label: 'Profile', value: c.profile.displayName },
              { label: 'Course', value: c.courseTitle },
              { label: 'Status', value: statusLabel(c.status) },
              { label: 'Delivery', value: deliveryLabel[c.delivery] },
              { label: 'Dates', value: dateRange(c) },
              { label: 'Time zone', value: c.timeZone },
              { label: 'Instructor', value: c.instructor.displayName },
              { label: 'Enrolled', value: `${c.enrolledCount} of ${c.seats} seats` },
              { label: 'Venue address', value: c.venueAddress ?? '—' },
              { label: 'Published', value: time(c.publishedAt) },
            ]}
          />
        </Card>
        <Card as="section">
          <CardHeader
            title="Venue position"
            description={
              c.delivery === 'remote'
                ? 'A remote class asks for no location.'
                : 'Set from the instructor’s device. Check-ins measure against the venue as it was at that moment.'
            }
          />
          {c.delivery === 'remote' ? null : c.venue ? (
            <DescriptionList
              items={[
                {
                  label: 'Position',
                  value: (
                    <span className="font-mono">
                      {c.venue.lat.toFixed(5)}, {c.venue.lng.toFixed(5)}
                    </span>
                  ),
                },
                { label: 'Accuracy', value: metres(c.venue.accuracyM) },
                { label: 'Radius', value: metres(c.venue.radiusM) },
                { label: 'Set', value: time(c.venue.setAt) },
              ]}
            />
          ) : (
            <p className="text-small text-warning">
              Not set. The code screen shows no code until the instructor sets it.
            </p>
          )}
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-h2 font-semibold text-ink">Block</h2>
          {c.blocks.length > 0 ? (
            <NativeSelect
              aria-label="Block"
              value={blockId}
              onChange={(e) => setParams({ block: e.target.value }, { replace: true })}
              wrapperClassName="w-full sm:w-96"
            >
              {c.blocks.map((b, i) => (
                <option key={b.id} value={b.id}>
                  {`Block ${i + 1} · ${time(b.startsAt)}`}
                </option>
              ))}
            </NativeSelect>
          ) : null}
        </div>
        {c.blocks.length === 0 ? (
          <EmptyState title="No blocks" body="This class has no blocks yet." />
        ) : block.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : block.isError ? (
          <EmptyState
            tone="danger"
            title="Could not load this block"
            body={errorMessage(block.error)}
          />
        ) : (
          <BlockBody b={block.data} time={time} />
        )}
      </section>
    </>
  )
}

function BlockBody({ b, time }: { b: SupportClassBlock; time: (iso: string | null) => string }) {
  const corrections = b.learners
    .flatMap((l) =>
      l.events.filter((e) => CORRECTION_TYPES.has(e.type)).map((e) => ({ learner: l, event: e })),
    )
    .sort((x, y) => Date.parse(x.event.at) - Date.parse(y.event.at))

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section">
          <CardHeader title="Times" description={`In ${b.class.timeZone}.`} />
          <DescriptionList
            items={[
              { label: 'Starts', value: time(b.block.startsAt) },
              { label: 'Ends', value: time(b.block.endsAt) },
              { label: 'Check-in opens', value: time(b.block.checkInOpensAt) },
              { label: 'Check-in closes', value: time(b.block.checkInClosesAt) },
              {
                label: 'Times',
                value: b.block.frozen
                  ? 'Frozen: a check-in or manual mark exists'
                  : 'Can still change',
              },
            ]}
          />
        </Card>
        <Card as="section">
          <CardHeader
            title="Refused attempts, last 15 minutes"
            description="Counted when this page was read. Refresh to count again."
          />
          <DescriptionList
            items={REFUSAL_REASONS.map((reason) => ({
              label: refusalLabel[reason],
              value: (
                <span
                  className={
                    b.attemptsByReason[reason]
                      ? 'font-mono font-semibold'
                      : 'font-mono text-ink-tertiary'
                  }
                >
                  {b.attemptsByReason[reason]}
                </span>
              ),
            }))}
          />
        </Card>
      </div>

      <Card as="section" className="mt-6">
        <CardHeader
          title="Learners"
          description="Distance and accuracy are the check-in’s. Coordinates are the check-in’s, or the latest refused attempt’s when there is no check-in."
        />
        {b.learners.length === 0 ? (
          <p className="text-small text-ink-secondary">No learners are enrolled in this class.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Learner</TH>
                <TH>State</TH>
                <TH>Last attempt</TH>
                <TH>Reason</TH>
                <TH className="text-right">Distance</TH>
                <TH className="text-right">Accuracy</TH>
                <TH>Coordinates</TH>
              </TR>
            </THead>
            <TBody>
              {b.learners.map((l) => (
                <LearnerRow key={l.enrollmentId} l={l} time={time} />
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card as="section" className="mt-6">
        <CardHeader
          title="Overturns and manual marks"
          description="With the disputes of a mark and their decisions, oldest first."
        />
        {corrections.length === 0 ? (
          <p className="text-small text-ink-secondary">None for this block.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Learner</TH>
                <TH>What</TH>
                <TH>By</TH>
                <TH>Reason</TH>
              </TR>
            </THead>
            <TBody>
              {corrections.map(({ learner, event }) => (
                // Events carry no id; a learner has one event of a type at any one instant.
                <TR key={`${learner.enrollmentId}-${event.type}-${event.at}`}>
                  <TD className="whitespace-nowrap text-ink-secondary">{time(event.at)}</TD>
                  <TD>{learner.learner.displayName}</TD>
                  <TD>{eventLabel[event.type]}</TD>
                  <TD className="text-ink-secondary">{event.actorName || '—'}</TD>
                  <TD>
                    <EventReason e={event} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  )
}

function EventReason({ e }: { e: LearnerEvent }) {
  const code = e.decision
    ? e.decision === 'upheld'
      ? 'Upheld'
      : 'Voided'
    : e.reasonCode
      ? (reasonCodeLabel[e.reasonCode] ?? statusLabel(e.reasonCode))
      : null
  if (!code && !e.reason) return <span className="text-ink-tertiary">—</span>
  return (
    <span>
      {code}
      {code && e.reason ? ': ' : null}
      {e.reason ? <span className="text-ink-secondary">{e.reason}</span> : null}
    </span>
  )
}

function LearnerRow({ l, time }: { l: Learner; time: (iso: string | null) => string }) {
  // Events arrive oldest first; the last attempt is the latest check-in or refused attempt.
  const attempt = l.events
    .filter((e) => e.type === 'check_in' || e.type === 'attempt_refused')
    .at(-1)
  const locked = l.lockedUntil !== null && Date.parse(l.lockedUntil) > Date.now()
  return (
    <TR>
      <TD>
        <p className="font-semibold text-ink">{l.learner.displayName}</p>
        <p className="font-mono text-caption text-ink-tertiary">{l.learner.email}</p>
      </TD>
      <TD>
        <Badge tone={stateTone[l.state]}>{stateLabel[l.state]}</Badge>
        {l.manualMark ? (
          <p className="mt-1 text-caption text-ink-tertiary">
            Mark {subStateLabel[l.manualMark.subState]}
          </p>
        ) : null}
      </TD>
      <TD className="whitespace-nowrap">
        {attempt ? (
          <>
            <p className="text-ink">
              {attempt.type === 'check_in' ? 'Checked in' : 'Refused'}
              {attempt.type === 'check_in' && l.method
                ? ` · ${l.method === 'qr_link' ? 'QR link' : 'typed code'}`
                : null}
            </p>
            <p className="text-caption text-ink-tertiary">{time(attempt.at)}</p>
          </>
        ) : (
          <span className="text-ink-tertiary">None</span>
        )}
      </TD>
      <TD>
        {l.flagReason ? <p>{flagLabel(l.flagReason, l.distanceM)}</p> : null}
        {attempt?.type === 'attempt_refused' && attempt.reasonCode ? (
          <p>{reasonCodeLabel[attempt.reasonCode] ?? statusLabel(attempt.reasonCode)}</p>
        ) : null}
        {locked ? (
          <p className="text-caption text-danger">
            too many wrong codes until {time(l.lockedUntil)}
          </p>
        ) : null}
        {!l.flagReason && attempt?.type !== 'attempt_refused' && !locked ? (
          <span className="text-ink-tertiary">—</span>
        ) : null}
      </TD>
      <TD className="text-right font-mono">{metres(l.distanceM)}</TD>
      <TD className="text-right font-mono">{metres(l.accuracyM)}</TD>
      <TD className="whitespace-nowrap font-mono text-caption">
        {l.coordinates === 'erased' ? (
          <span className="text-ink-tertiary">Erased</span>
        ) : l.coordinates ? (
          `${l.coordinates.lat.toFixed(5)}, ${l.coordinates.lng.toFixed(5)}`
        ) : (
          <span className="text-ink-tertiary">No reading</span>
        )}
      </TD>
    </TR>
  )
}
