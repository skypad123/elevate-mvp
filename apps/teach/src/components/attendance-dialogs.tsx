import {
  ID_DOCUMENT_TYPES,
  type IdDocumentType,
  MANUAL_MARK_REASON_CODES,
  type ManualMark,
  type ManualMarkReasonCode,
  OVERTURN_REASON_CODES,
  type Overturn,
  type OverturnReasonCode,
} from '@elevate/core'
import { Button, Dialog, NativeSelect, Textarea } from '@elevate/web-ui'
import { type FormEvent, useEffect, useState } from 'react'

export const OVERTURN_REASON_LABEL: Record<OverturnReasonCode, string> = {
  not_in_room: 'Not in the room',
  wrong_person: 'Someone else checked in for them',
  other: 'Other',
}

export const MANUAL_MARK_REASON_LABEL: Record<ManualMarkReasonCode, string> = {
  phone_not_working: 'Phone not working',
  no_phone: 'No phone with them',
  no_network: 'No network',
  app_problem: 'A problem with the app',
  other: 'Other',
}

export const ID_DOCUMENT_LABEL: Record<IdDocumentType, string> = {
  nric: 'NRIC',
  fin: 'FIN card',
  passport: 'Passport',
  driving_licence: 'Driving licence',
  student_or_staff_pass: 'Student or staff pass',
  other: 'Other document',
}

const NOTE_MAX = 500

type DialogProps<T> = {
  /** The learner the dialog is about; null closes it. */
  learnerName: string | null
  onClose: () => void
  /** Resolves to whether it worked; the dialog stays open after a failure. */
  onSubmit: (input: T) => Promise<boolean>
}

/** A typed note, required when the reason is "other", as the API requires. */
function noteError(reasonCode: string, note: string): string | undefined {
  if (reasonCode === 'other' && !note.trim()) return 'Say what the reason is.'
  return undefined
}

/**
 * Overturns a flagged check-in. The check-in itself is kept; a new record says it does not
 * stand. The learner cannot check in again for this block, and can still be marked by hand.
 */
export function OverturnDialog({ learnerName, onClose, onSubmit }: DialogProps<Overturn>) {
  const open = learnerName !== null
  const [reasonCode, setReasonCode] = useState<OverturnReasonCode>('not_in_room')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setReasonCode('not_in_room')
      setNote('')
      setTried(false)
    }
  }, [open])
  const error = tried ? noteError(reasonCode, note) : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (noteError(reasonCode, note)) return
    setBusy(true)
    const trimmed = note.trim()
    const ok = await onSubmit({ reasonCode, ...(trimmed ? { reason: trimmed } : {}) })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={`Overturn ${learnerName ?? ''}'s check-in`}
      description="The check-in stays on the record, marked as overturned. They cannot check in again for this block; you can still mark them present by hand."
    >
      <form onSubmit={submit} className="space-y-4">
        <NativeSelect
          label="Reason"
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value as OverturnReasonCode)}
          required
        >
          {OVERTURN_REASON_CODES.map((code) => (
            <option key={code} value={code}>
              {OVERTURN_REASON_LABEL[code]}
            </option>
          ))}
        </NativeSelect>
        <Textarea
          label="Note"
          hint={reasonCode === 'other' ? 'Required for "Other".' : 'Optional.'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          required={reasonCode === 'other'}
          error={error}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            Overturn
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Marks a learner present by hand after checking an identity document. Only the type of
 * document is recorded, never its number. The learner can dispute the mark for 7 days.
 */
export function ManualMarkDialog({ learnerName, onClose, onSubmit }: DialogProps<ManualMark>) {
  const open = learnerName !== null
  const [reasonCode, setReasonCode] = useState<ManualMarkReasonCode>('phone_not_working')
  const [idDocumentType, setIdDocumentType] = useState<IdDocumentType | ''>('')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setReasonCode('phone_not_working')
      setIdDocumentType('')
      setNote('')
      setTried(false)
    }
  }, [open])
  const error = tried ? noteError(reasonCode, note) : undefined
  const documentError = tried && !idDocumentType ? 'Choose the document you checked.' : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (noteError(reasonCode, note) || !idDocumentType) return
    setBusy(true)
    const trimmed = note.trim()
    const ok = await onSubmit({
      reasonCode,
      idDocumentType,
      ...(trimmed ? { reason: trimmed } : {}),
    })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={`Mark ${learnerName ?? ''} present by hand`}
      description="Check an identity document first. Only the type of document is recorded, never its number. The learner can dispute this mark for 7 days."
    >
      <form onSubmit={submit} className="space-y-4">
        <NativeSelect
          label="Reason"
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value as ManualMarkReasonCode)}
          required
        >
          {MANUAL_MARK_REASON_CODES.map((code) => (
            <option key={code} value={code}>
              {MANUAL_MARK_REASON_LABEL[code]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          label="Document checked"
          value={idDocumentType}
          onChange={(e) => setIdDocumentType(e.target.value as IdDocumentType | '')}
          required
          error={documentError}
        >
          <option value="" disabled>
            Choose a document
          </option>
          {ID_DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {ID_DOCUMENT_LABEL[type]}
            </option>
          ))}
        </NativeSelect>
        <Textarea
          label="Note"
          hint={reasonCode === 'other' ? 'Required for "Other".' : 'Optional.'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          required={reasonCode === 'other'}
          error={error}
        />
        <p className="text-small text-ink-tertiary">
          The learner sees the reason, your note and the time of the mark.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Mark present
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
