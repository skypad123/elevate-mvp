import {
  CLASS_TIME_ZONE,
  type ClassDelivery,
  type ClassDetail,
  type CreateClass,
  type UpdateClass,
} from '@elevate/core'
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  focusFirstInvalid,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
  useToast,
} from '@elevate/web-ui'
import { ApiError, errorMessage, fieldErrors } from '@elevate/web-ui/portal'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { type FormEvent, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  blockProblemText,
  blocksFromRows,
  ClassScheduleEditor,
  emptyRow,
  rowIsComplete,
  rowsFromBlocks,
  type ScheduleRow,
  scheduleProblems,
} from '../../components/class-schedule-editor'
import { formatClassInstant, useClass, useClassActions } from '../../lib/classes'
import { useCourses } from '../../lib/courses'
import { useMembers } from '../../lib/members'
import { useCurrentProfile } from '../../lib/profile'
import { DELIVERY_LABEL } from './list'

/** `classes/new` and `classes/:id/edit`. Only the owner and managers set up a class. */
export function ClassFormPage() {
  const { id = '' } = useParams()
  const { can, path } = useCurrentProfile()
  const existing = useClass(id)

  if (!can('class.manage'))
    return (
      <>
        <PageHeader eyebrow="Classes" title="Set up a class" />
        <EmptyState
          icon={CalendarDays}
          title="Only the owner or a manager can set up a class"
          body="You can still run the blocks of a class you are assigned to instruct."
          action={
            <Button asChild variant="secondary">
              <Link to={path('/classes')}>Back to classes</Link>
            </Button>
          }
        />
      </>
    )
  if (!id) return <ClassForm initial={null} />
  if (existing.isPending) return <Skeleton className="h-96 w-full rounded-card" />
  if (existing.isError)
    return (
      <EmptyState
        tone="danger"
        title="Could not load the class"
        body={errorMessage(existing.error)}
      />
    )
  // Keyed, so opening another class starts from its own values.
  return <ClassForm key={existing.data.id} initial={existing.data} />
}

type Values = {
  courseId: string
  name: string
  delivery: ClassDelivery
  venueAddress: string
  seats: string
  instructorUserId: string
}

function valuesOf(detail: ClassDetail | null, ownerId: string): Values {
  return {
    courseId: detail?.courseId ?? '',
    name: detail?.name ?? '',
    delivery: detail?.delivery ?? 'in_person',
    venueAddress: detail?.venueAddress ?? '',
    seats: detail ? String(detail.seats) : '20',
    instructorUserId: detail?.instructor.userId ?? ownerId,
  }
}

/** The blocks' times, ignoring their order: what a learner's right to withdraw in full follows. */
function timesKey(blocks: readonly { date: string; startTime: string; endTime: string }[]): string {
  return blocks
    .map((b) => `${b.date} ${b.startTime}-${b.endTime}`)
    .sort()
    .join('|')
}

/** The details of an `ApiError` as a plain record, when it has one. */
function detailsOf(error: unknown): Record<string, unknown> {
  return error instanceof ApiError && error.details && typeof error.details === 'object'
    ? (error.details as Record<string, unknown>)
    : {}
}

function ClassForm({ initial }: { initial: ClassDetail | null }) {
  const { path, profile, can } = useCurrentProfile()
  const navigate = useNavigate()
  const { toast } = useToast()
  const actions = useClassActions()
  const courses = useCourses()
  const members = useMembers(can('members.read'))
  const formRef = useRef<HTMLFormElement>(null)

  const timeZone = initial?.timeZone ?? CLASS_TIME_ZONE
  const published = initial?.status === 'published'
  const ownerId = profile?.owner.id ?? ''
  const [values, setValues] = useState<Values>(() => valuesOf(initial, ownerId))
  const startRows = useMemo(
    () => (initial ? rowsFromBlocks(initial.blocks, timeZone) : [emptyRow()]),
    [initial, timeZone],
  )
  const [rows, setRows] = useState<ScheduleRow[]>(startRows)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map())
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  /** An edit held back until the change to the blocks' times is confirmed. */
  const [confirming, setConfirming] = useState<UpdateClass | null>(null)

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((v) => ({ ...v, [key]: value }))
  const changeRows = (next: ScheduleRow[]) => {
    setRows(next)
    // What the API said was about the rows as they were sent.
    setRowErrors(new Map())
  }

  // Courses on sale, and the class's own course when it is no longer on sale.
  const courseOptions = (courses.data ?? []).filter(
    (c) => c.status === 'live' || c.id === initial?.courseId,
  )
  // The owner and the profile's current members.
  const owner = profile?.owner
  const instructorOptions = [
    ...(owner ? [{ userId: owner.id, label: `${owner.name ?? owner.email} (owner)` }] : []),
    ...(members.data?.members ?? []).map((m) => ({
      userId: m.userId,
      label: `${m.name ?? m.email} (${m.role})`,
    })),
  ]
  if (
    initial &&
    (values.instructorUserId || ownerId) === initial.instructor.userId &&
    !instructorOptions.some((o) => o.userId === initial.instructor.userId)
  ) {
    instructorOptions.push({
      userId: initial.instructor.userId,
      label: `${initial.instructor.displayName} (no longer a member)`,
    })
  }

  const local = scheduleProblems(rows, timeZone)
  const shownRowProblems = new Map<string, string>()
  for (const row of rows) {
    const mine = rowErrors.get(row.key) ?? local.get(row.key)
    // An unfinished row is not pointed out until the form is sent.
    if (mine && (tried || rowErrors.has(row.key) || rowIsComplete(row))) {
      shownRowProblems.set(row.key, mine)
    }
  }
  // Until the profile has loaded there is no owner to default to.
  const instructorUserId = values.instructorUserId || ownerId

  function requestBody(): CreateClass {
    return {
      courseId: values.courseId,
      name: values.name.trim(),
      delivery: values.delivery,
      ...(values.delivery === 'in_person' || values.venueAddress.trim()
        ? { venueAddress: values.venueAddress.trim() }
        : {}),
      seats: Number.parseInt(values.seats, 10),
      instructorUserId,
      blocks: blocksFromRows(rows),
    }
  }

  /** Only what changed, so the audit of an edit to a published class names the right fields. */
  function patchBody(detail: ClassDetail): UpdateClass {
    const body = requestBody()
    const before = valuesOf(detail, ownerId)
    const patch: UpdateClass = {}
    if (body.courseId !== before.courseId) patch.courseId = body.courseId
    if (body.name !== before.name) patch.name = body.name
    if (body.delivery !== before.delivery) patch.delivery = body.delivery
    if ((body.venueAddress ?? '') !== before.venueAddress) {
      patch.venueAddress = body.venueAddress ?? ''
    }
    if (String(body.seats) !== before.seats) patch.seats = body.seats
    if (body.instructorUserId !== before.instructorUserId) {
      patch.instructorUserId = body.instructorUserId
    }
    if (JSON.stringify(body.blocks) !== JSON.stringify(blocksFromRows(startRows))) {
      patch.blocks = body.blocks
    }
    return patch
  }

  /** Puts what the API refused next to the field or the block it is about. */
  function showRefusal(error: unknown) {
    const fields = fieldErrors(error)
    const byRow = new Map<string, string>()
    for (const [key, message] of Object.entries(fields)) {
      const match = /^blocks\.(\d+)/.exec(key)
      const row = match ? rows[Number(match[1])] : undefined
      if (row && !byRow.has(row.key)) byRow.set(row.key, message)
    }
    const details = detailsOf(error)
    const code = error instanceof ApiError ? error.code : ''
    if (code === 'blocks_invalid' && Array.isArray(details.problems)) {
      for (const p of details.problems as { index: number; problem: string }[]) {
        const row = rows[p.index]
        if (row && !byRow.has(row.key)) byRow.set(row.key, blockProblemText(p.problem))
      }
    }
    if ((code === 'block_frozen' || code === 'block_has_attempts') && error instanceof ApiError) {
      const row = rows.find((r) => r.id === details.blockId)
      if (row) byRow.set(row.key, error.message)
    }
    if (code === 'instructor_not_member') fields.instructorUserId = errorMessage(error)
    if (code === 'capacity_below_taken' && typeof details.taken === 'number') {
      fields.seats = `${details.taken} seats are taken, so the class needs at least that many.`
    }
    setErrors(fields)
    setRowErrors(byRow)
    toast({
      tone: 'danger',
      title: initial ? 'Could not save the class' : 'Could not create the class',
      description:
        code === 'class_too_late_for_seat' && typeof details.latestEndsAt === 'string'
          ? `The class must end by ${formatClassInstant(details.latestEndsAt, timeZone)}, 75 days after a learner’s payment.`
          : errorMessage(error),
    })
    focusFirstInvalid(formRef.current)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    setErrors({})
    setRowErrors(new Map())
    if (local.size > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    if (initial) {
      const patch = patchBody(initial)
      // Changing a block's time gives every seat not counted as attended the right to withdraw
      // with a full refund, at the profile's cost, so it is confirmed first.
      if (
        patch.blocks &&
        initial.seatsWithChangeRight > 0 &&
        timesKey(patch.blocks) !== timesKey(blocksFromRows(startRows))
      ) {
        setConfirming(patch)
        return
      }
      await save(initial, patch)
      return
    }
    setBusy(true)
    try {
      const created = await actions.create(requestBody())
      toast({ tone: 'success', title: 'Draft class created' })
      navigate(path(`/classes/${created.id}`))
    } catch (error) {
      showRefusal(error)
    } finally {
      setBusy(false)
    }
  }

  async function save(detail: ClassDetail, patch: UpdateClass) {
    setBusy(true)
    try {
      if (Object.keys(patch).length > 0) await actions.update(detail.id, patch)
      toast({ tone: 'success', title: 'Class saved' })
      navigate(path(`/classes/${detail.id}`))
    } catch (error) {
      showRefusal(error)
    } finally {
      setBusy(false)
    }
  }

  const back = initial ? path(`/classes/${initial.id}`) : path('/classes')

  return (
    <>
      <Link
        to={back}
        className="mb-4 inline-flex items-center gap-1.5 text-small font-semibold text-brand-fg hover:underline"
      >
        <ArrowLeft className="size-4" />
        {initial ? initial.name : 'Classes'}
      </Link>
      <PageHeader
        eyebrow="Classes"
        title={initial ? 'Edit class' : 'New class'}
        description={
          published
            ? 'This class is published. Its course and delivery are fixed; everything else can still change, except the times of a block that has attendance.'
            : 'The class stays a draft until you publish it from its page.'
        }
      />
      <form ref={formRef} onSubmit={submit} className="space-y-6" noValidate>
        <Card as="section" className="space-y-4">
          <h2 className="font-display text-h3 font-semibold text-ink">Details</h2>
          <NativeSelect
            label="Course"
            value={values.courseId}
            onChange={(e) => set('courseId', e.target.value)}
            disabled={published}
            hint={
              published
                ? 'The course of a published class cannot change.'
                : 'Only courses on sale are listed.'
            }
            error={errors.courseId}
            required
          >
            <option value="" disabled>
              {courses.isPending ? 'Loading courses…' : 'Choose a course'}
            </option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.status === 'live' ? '' : ' (not on sale)'}
              </option>
            ))}
          </NativeSelect>
          <Input
            label="Name"
            hint='Shown to the instructor and the learners, for example "March weekend class".'
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            maxLength={120}
            error={errors.name}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <NativeSelect
              label="Delivery"
              value={values.delivery}
              onChange={(e) => set('delivery', e.target.value as ClassDelivery)}
              disabled={published}
              hint={published ? 'The delivery of a published class cannot change.' : undefined}
              error={errors.delivery}
            >
              {(['in_person', 'remote'] as const).map((d) => (
                <option key={d} value={d}>
                  {DELIVERY_LABEL[d]}
                </option>
              ))}
            </NativeSelect>
            <Input
              type="number"
              label="Seats"
              min={1}
              max={500}
              step={1}
              value={values.seats}
              onChange={(e) => set('seats', e.target.value)}
              error={errors.seats}
              required
            />
          </div>
          {values.delivery === 'in_person' ? (
            <Input
              label="Venue address"
              hint="Needed before publishing. The venue's position is set later, on the roster screen, from the instructor's device."
              value={values.venueAddress}
              onChange={(e) => set('venueAddress', e.target.value)}
              maxLength={300}
              error={errors.venueAddress}
            />
          ) : null}
          <NativeSelect
            label="Instructor"
            value={instructorUserId}
            onChange={(e) => set('instructorUserId', e.target.value)}
            hint="Only the instructor runs the blocks and corrects attendance."
            error={errors.instructorUserId}
            required
          >
            {instructorOptions.length === 0 ? (
              <option value="">Loading…</option>
            ) : (
              instructorOptions.map((o) => (
                <option key={o.userId} value={o.userId}>
                  {o.label}
                </option>
              ))
            )}
          </NativeSelect>
        </Card>

        <Card as="section" className="space-y-4">
          <div>
            <h2 className="font-display text-h3 font-semibold text-ink">Schedule</h2>
            <p className="mt-1 text-small text-ink-secondary">
              Each block is one sitting. Check-in opens 30 minutes before a block starts and closes
              30 minutes after it ends.
            </p>
          </div>
          <ClassScheduleEditor
            rows={rows}
            onChange={changeRows}
            timeZone={timeZone}
            problems={shownRowProblems}
            disabled={busy}
          />
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild variant="ghost">
            <Link to={back}>Cancel</Link>
          </Button>
          <Button type="submit" loading={busy}>
            {initial ? 'Save changes' : 'Create draft'}
          </Button>
        </div>
      </form>
      {initial ? (
        <Dialog
          open={confirming !== null}
          onOpenChange={(open) => !open && setConfirming(null)}
          title="Change the class’s times?"
          description={
            initial.seatsWithChangeRight === 1
              ? '1 learner has a seat and has not attended. They are emailed the new times, and can then withdraw with a full refund until the class starts. You bear Stripe’s fee on that refund.'
              : `${initial.seatsWithChangeRight} learners have a seat and have not attended. Each is emailed the new times, and can then withdraw with a full refund until the class starts. You bear Stripe’s fee on each of those refunds.`
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(null)}>
                Keep the times
              </Button>
              <Button
                loading={busy}
                onClick={() => {
                  const patch = confirming
                  setConfirming(null)
                  if (patch) void save(initial, patch)
                }}
              >
                Change the times
              </Button>
            </>
          }
        />
      ) : null}
    </>
  )
}
