import {
  type ClassDetail,
  formatSgd,
  type MoveProblem,
  parseSgdToCents,
  type SeatView,
  UNFINISHED_SEAT_REFUND_STATUSES,
} from '@elevate/core'
import { Button, Dialog, Input, NativeSelect, Textarea, useToast } from '@elevate/web-ui'
import { ApiError, errorMessage } from '@elevate/web-ui/portal'
import { type FormEvent, useEffect, useState } from 'react'
import { formatClassDate, useClassActions, useMoveTargets } from '../lib/classes'
import { useSignInAgain } from '../lib/queries'

/** The API's limits on a reason (`reasonSchema` in core's class-sales contracts). */
const REASON_MIN = 3
const REASON_MAX = 500

/** Why a learner cannot be moved to a class, in words. */
export const MOVE_PROBLEM_LABEL: Record<MoveProblem, string> = {
  attended: 'The learner is counted as attended in this class.',
  open_mark: 'The learner has a manual mark that can still be disputed.',
  refund_in_progress: 'A refund for this seat is under way.',
  bank_dispute_open: 'The learner’s bank is deciding a dispute about the payment.',
  different_course: 'That class is of another course.',
  target_not_published: 'That class is not published, or it was cancelled.',
  target_started: 'That class has started.',
  target_full: 'That class is full.',
  beyond_limit: 'That class ends more than 75 days after the learner paid.',
  already_in_target: 'The learner has been in that class before.',
}

const unfinished = (seat: SeatView) =>
  seat.refunds.some((r) =>
    (UNFINISHED_SEAT_REFUND_STATUSES as readonly string[]).includes(r.status),
  )

const reasonError = (reason: string) =>
  reason.trim().length < REASON_MIN ? `Write at least ${REASON_MIN} characters.` : undefined

/** "1 learner" or "3 learners". */
const learners = (n: number) => `${n} learner${n === 1 ? '' : 's'}`

/**
 * Who a cancellation refunds, from the seats table, as `SeatsService.cancel` decides it: a learner
 * not counted as attended and with no open manual mark is refunded in full; one with an open mark
 * waits until the mark settles or is disputed; one counted as attended gets the share for the
 * blocks not yet started (G12), or nothing when every block has started.
 */
export function cancelCounts(detail: ClassDetail, seats: SeatView[], now = Date.now()) {
  const active = seats.filter((s) => s.status === 'active')
  const blocksLeft = detail.blocks.filter((b) => Date.parse(b.startsAt) > now).length
  return {
    full: active.filter((s) => !s.counted && !s.openMarkUntil).length,
    openMark: active.filter((s) => !s.counted && !!s.openMarkUntil).length,
    attended: active.filter((s) => s.counted).length,
    blocksLeft,
    blocks: detail.blocks.length,
    busy: active.filter(unfinished).length,
  }
}

/** Cancels a class with a reason, after showing who is refunded and how. */
export function CancelClassDialog({
  detail,
  seats,
  open,
  onOpenChange,
}: {
  detail: ClassDetail
  seats: SeatView[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const actions = useClassActions()
  const signInAgain = useSignInAgain()
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setReason('')
      setTried(false)
    }
  }, [open])

  const counts = cancelCounts(detail, seats)
  const error = tried ? reasonError(reason) : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (reasonError(reason)) return
    setBusy(true)
    try {
      await actions.cancelClass(detail.id, { reason: reason.trim() })
      toast({
        tone: 'success',
        title: 'Class cancelled',
        description: 'The refunds are sent within 15 minutes, and each learner is emailed.',
      })
      onOpenChange(false)
    } catch (err) {
      if (signInAgain(err)) return
      toast({
        tone: 'danger',
        title: 'Could not cancel the class',
        description:
          err instanceof ApiError && err.code === 'refund_in_progress'
            ? 'A refund for one of its seats is still under way. Try again once it is done.'
            : errorMessage(err),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancel ${detail.name}?`}
      description="The class is cancelled at once and can no longer be bought. This cannot be undone."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ul className="list-disc space-y-1 pl-5 text-small text-ink">
          <li>{learners(counts.full)} will be refunded in full.</li>
          <li>
            {learners(counts.openMark)} with a manual mark still open will be refunded when the mark
            is settled: in full if they dispute it, otherwise as attended.
          </li>
          <li>
            {counts.blocksLeft > 0
              ? `${learners(counts.attended)} counted as attended will be refunded the part of the price for the ${counts.blocksLeft} of ${counts.blocks} blocks not yet started.`
              : `${learners(counts.attended)} counted as attended will not be refunded, because every block has started.`}
          </li>
        </ul>
        <p className="text-small text-ink-secondary">
          You bear Stripe’s fee on each refund. The class’s money is released 7 days after the
          cancellation, once every refund is done.
        </p>
        {counts.busy > 0 ? (
          <p
            role="alert"
            className="rounded-control border border-warning bg-warning-tint px-3 py-2 text-small text-ink"
          >
            {counts.busy === 1
              ? 'A refund for one seat is still under way. The class can be cancelled once it is done.'
              : `Refunds for ${counts.busy} seats are still under way. The class can be cancelled once they are done.`}
          </p>
        ) : null}
        <Textarea
          label="Reason"
          hint="Kept on the record with the cancellation."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REASON_MAX}
          rows={3}
          error={error}
          required
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep the class
          </Button>
          <Button type="submit" variant="danger" loading={busy} disabled={counts.busy > 0}>
            Cancel class
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Moves one learner's seat, and its payment, to another class of the same course. */
export function MoveSeatDialog({
  classId,
  seat,
  timeZone,
  onClose,
}: {
  classId: string
  /** The seat to move; null closes the dialog. */
  seat: SeatView | null
  timeZone: string
  onClose: () => void
}) {
  const targets = useMoveTargets(classId, seat?.enrollmentId ?? null)
  const actions = useClassActions()
  const { toast } = useToast()
  const [toClassId, setToClassId] = useState('')
  const [busy, setBusy] = useState(false)
  const list = targets.data ?? []
  const allowed = list.filter((t) => t.problems.length === 0)
  const refused = list.filter((t) => t.problems.length > 0)
  useEffect(() => {
    if (seat) setToClassId('')
  }, [seat])
  useEffect(() => {
    // Preselect the first class the learner can go to.
    if (!toClassId && allowed[0]) setToClassId(allowed[0].classId)
  }, [toClassId, allowed])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!seat || !toClassId) return
    setBusy(true)
    try {
      await actions.moveSeat(classId, seat.enrollmentId, toClassId)
      toast({
        tone: 'success',
        title: `${seat.learner.displayName} moved`,
        description:
          'They are emailed. Until the new class starts they can withdraw with a full refund.',
      })
      onClose()
    } catch (err) {
      const problems =
        err instanceof ApiError && err.code === 'move_not_allowed'
          ? ((err.details as { problems?: MoveProblem[] } | undefined)?.problems ?? [])
          : []
      toast({
        tone: 'danger',
        title: 'Could not move the learner',
        description: problems.length
          ? problems.map((p) => MOVE_PROBLEM_LABEL[p]).join(' ')
          : errorMessage(err),
      })
      void targets.refetch()
    } finally {
      setBusy(false)
    }
  }

  const label = (t: (typeof list)[number]) =>
    `${t.className}, from ${formatClassDate(t.firstBlockStartsAt, timeZone)} (${t.seatsLeft} seat${t.seatsLeft === 1 ? '' : 's'} left)`

  return (
    <Dialog
      open={seat !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Move ${seat?.learner.displayName ?? ''}`}
      description="The seat and its payment move to the other class, and this seat is free again. The learner is emailed, and until the new class starts they can withdraw with a full refund; you bear Stripe’s fee on it."
    >
      <form onSubmit={submit} className="space-y-4">
        {targets.isPending ? (
          <p className="text-small text-ink-secondary">Looking for classes…</p>
        ) : targets.isError ? (
          <p className="text-small text-danger">{errorMessage(targets.error)}</p>
        ) : list.length === 0 ? (
          <p className="text-small text-ink-secondary">
            This course has no other published class to move the learner to.
          </p>
        ) : (
          <>
            {allowed.length > 0 ? (
              <NativeSelect
                label="Move to"
                value={toClassId}
                onChange={(e) => setToClassId(e.target.value)}
                required
              >
                {allowed.map((t) => (
                  <option key={t.classId} value={t.classId}>
                    {label(t)}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <p className="text-small text-ink-secondary">
                None of the course’s other classes can take this learner.
              </p>
            )}
            {refused.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-small-strong font-semibold text-ink-secondary">
                  Classes the learner cannot be moved to
                </p>
                <ul className="space-y-2 text-small">
                  {refused.map((t) => (
                    <li key={t.classId}>
                      <span className="font-semibold text-ink">{label(t)}</span>
                      <ul className="list-disc pl-5 text-ink-secondary">
                        {t.problems.map((p) => (
                          <li key={p}>{MOVE_PROBLEM_LABEL[p]}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!toClassId || allowed.length === 0}>
            Move learner
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** A discretionary refund: any amount up to what the learner paid and has not had back. */
export function RefundSeatDialog({
  classId,
  seat,
  onClose,
}: {
  classId: string
  /** The seat to refund; null closes the dialog. */
  seat: SeatView | null
  onClose: () => void
}) {
  const actions = useClassActions()
  const signInAgain = useSignInAgain()
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const [maxCents, setMaxCents] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (seat) {
      setAmount((seat.canRefundUpToCents / 100).toFixed(2))
      setReason('')
      setTried(false)
      setMaxCents(seat.canRefundUpToCents)
    }
  }, [seat])

  const cents = parseSgdToCents(amount)
  const amountError = !tried
    ? undefined
    : cents === null || cents <= 0
      ? 'Enter an amount in dollars, such as 50 or 49.50.'
      : cents > maxCents
        ? `The most you can refund is ${formatSgd(maxCents)}.`
        : undefined
  const noteError = tried ? reasonError(reason) : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!seat || cents === null || cents <= 0 || cents > maxCents || reasonError(reason)) return
    setBusy(true)
    try {
      await actions.refundSeat(classId, seat.enrollmentId, {
        amountCents: cents,
        reason: reason.trim(),
      })
      toast({
        tone: 'success',
        title: `Refund of ${formatSgd(cents)} requested`,
        description:
          'It is sent within 15 minutes, and the learner is emailed. They keep the seat.',
      })
      onClose()
    } catch (err) {
      if (signInAgain(err)) return
      if (err instanceof ApiError && err.code === 'refund_too_large') {
        const max = (err.details as { maxCents?: number } | undefined)?.maxCents
        if (typeof max === 'number') setMaxCents(max)
      }
      toast({ tone: 'danger', title: 'Could not refund', description: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={seat !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Refund ${seat?.learner.displayName ?? ''}`}
      description="The learner keeps the seat. Elevate returns to you the same share of its fee. A refund cannot be undone."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input
          label="Amount (S$)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={`Up to ${formatSgd(maxCents)}: what the learner paid and has not had back.`}
          error={amountError}
          required
        />
        <Textarea
          label="Reason"
          hint="Kept on the record with the refund."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REASON_MAX}
          rows={3}
          error={noteError}
          required
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Refund
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
