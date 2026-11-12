import type {
  MediaAssetView,
  PersonSummary,
  RecoverOwner,
  SupportProfileDetail,
} from '@elevate/core'
import { Badge, Button, Dialog, Input, MediaUploader, useToast } from '@elevate/web-ui'
import { errorMessage, unwrap } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { api } from '../lib/api'
import { profileKeys, usePeople } from '../lib/queries'

/**
 * Owner recovery, for an owner who can no longer sign in. A person keeps their profile and gets a
 * new sign-in address; a company names another person as its owner. It is the only way a
 * profile's owner changes, and only a super admin can do it: the API refuses anyone else.
 */
export function OwnerRecovery({ detail }: { detail: SupportProfileDetail }) {
  const [open, setOpen] = useState(false)
  const corporate = detail.profile.type === 'corporate'
  const close = () => setOpen(false)
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={KeyRound}
        className="mt-4"
        onClick={() => setOpen(true)}
      >
        {corporate ? 'Name a new owner' : 'Change the owner’s email'}
      </Button>
      {/* Mounted only while open, so each recovery starts from an empty form. */}
      {open ? (
        corporate ? (
          <CompanyRecovery detail={detail} onClose={close} />
        ) : (
          <PersonalRecovery detail={detail} onClose={close} />
        )
      ) : null}
    </>
  )
}

function useRecover(profileId: string, onDone: () => void) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function recover(json: RecoverOwner, done: string) {
    setBusy(true)
    try {
      const detail = (await unwrap(
        await api.support.profiles[':id']['recover-owner'].$post({
          param: { id: profileId },
          json,
        }),
      )) as SupportProfileDetail
      queryClient.setQueryData(profileKeys.detail(profileId), detail)
      // The lists show the owner, and each person lists the profiles they are on.
      await queryClient.invalidateQueries({ queryKey: profileKeys.all })
      await queryClient.invalidateQueries({ queryKey: ['support', 'people'] })
      await queryClient.invalidateQueries({ queryKey: ['support', 'person'] })
      toast({ tone: 'success', title: done, description: 'Both addresses have been emailed.' })
      onDone()
    } catch (error) {
      toast({ tone: 'danger', title: 'Recovery failed', description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }
  return { busy, recover }
}

const RECORDED = 'The change is recorded in the audit log under your name.'

/** A personal profile belongs to a person, so the person stays and their address changes. */
function PersonalRecovery({
  detail,
  onClose,
}: {
  detail: SupportProfileDetail
  onClose: () => void
}) {
  const owner = detail.profile.owner
  const [email, setEmail] = useState('')
  const { busy, recover } = useRecover(detail.profile.id, onClose)
  const next = email.trim().toLowerCase()
  const usable = /^\S+@\S+\.\S+$/.test(next) && next !== owner.email.toLowerCase()

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Change the owner’s email address"
      description={
        <>
          For an owner who can no longer sign in as <strong>{owner.email}</strong>. Be sure who is
          asking: whoever reads the new address gets the profile, its courses and its earnings.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!usable}
            onClick={() => recover({ newEmail: next }, 'Owner’s email changed')}
          >
            Change address
          </Button>
        </>
      }
    >
      <Input
        label="New email address"
        type="email"
        autoComplete="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        hint="It must not belong to another Elevate account."
        required
      />
      <p className="mt-4 text-small text-ink-secondary">
        The owner is signed out everywhere and signs in with the new address from now on. Both
        addresses are emailed. {RECORDED}
      </p>
    </Dialog>
  )
}

/** A corporate profile belongs to a company, so the company names another person, in writing. */
function CompanyRecovery({
  detail,
  onClose,
}: {
  detail: SupportProfileDetail
  onClose: () => void
}) {
  const { profile, legalEntity } = detail
  const previous = profile.owner
  const [q, setQ] = useState('')
  const search = useDeferredValue(q.trim())
  const [person, setPerson] = useState<PersonSummary | null>(null)
  const [authorisation, setAuthorisation] = useState<MediaAssetView | null>(null)
  const [removePrevious, setRemovePrevious] = useState(false)
  const { busy, recover } = useRecover(profile.id, onClose)
  const searching = search.length >= 2
  const people = usePeople({ q: search }, { enabled: searching && !person })
  const candidates = (people.data?.items ?? []).filter((p) => p.id !== previous.id).slice(0, 6)
  const ready = person !== null && authorisation?.status === 'ready'

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      className="max-h-[calc(100vh-32px)] overflow-y-auto"
      title="Name a new owner"
      description={
        <>
          For a company whose owner, <strong>{previous.email}</strong>, has left or cannot sign in.
          An officer of {legalEntity?.legalName ?? profile.displayName} must authorise the change in
          writing.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!ready}
            onClick={() => {
              if (!person || !authorisation) return
              void recover(
                {
                  newOwnerUserId: person.id,
                  authorisationMediaId: authorisation.id,
                  removePreviousOwner: removePrevious,
                },
                'Owner changed',
              )
            }}
          >
            Change owner
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {person ? (
          <div>
            <p className="mb-1.5 text-small font-semibold text-ink">New owner</p>
            <div className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2">
              <PersonLine person={person} profileId={profile.id} />
              <Button variant="ghost" size="sm" onClick={() => setPerson(null)}>
                Change
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Input
              label="New owner"
              hint="Search by email or name. The new owner needs an Elevate account: ask them to sign in to Teach once."
              placeholder="name@example.com"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {!searching ? null : people.isPending ? (
              <p className="mt-2 text-small text-ink-tertiary">Searching…</p>
            ) : people.isError ? (
              <p role="alert" className="mt-2 text-small text-danger">
                {errorMessage(people.error)}
              </p>
            ) : candidates.length === 0 ? (
              <p className="mt-2 text-small text-ink-tertiary">
                No other account matches “{search}”.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border rounded-control border border-border">
                {candidates.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-muted"
                      onClick={() => setPerson(candidate)}
                    >
                      <PersonLine person={candidate} profileId={profile.id} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <MediaUploader
          api={api}
          kind="document"
          value={authorisation}
          onChange={setAuthorisation}
          label="Officer’s authorisation (PDF)"
          hint="A signed letter from a director or partner of the company that names the new owner. It is kept with the audit entry."
        />

        <label className="flex cursor-pointer items-start gap-2 text-small text-ink">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--brand)]"
            checked={removePrevious}
            onChange={(e) => setRemovePrevious(e.target.checked)}
          />
          <span>
            Remove {previous.email} from the profile
            <span className="block text-ink-tertiary">
              Left unticked, they stay on the profile as a manager. Either way they are signed out.
            </span>
          </span>
        </label>

        <p className="text-small text-ink-secondary">Both people are emailed. {RECORDED}</p>
      </div>
    </Dialog>
  )
}

function PersonLine({ person, profileId }: { person: PersonSummary; profileId: string }) {
  const membership = person.profiles.find((p) => p.id === profileId)
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink">{person.name ?? person.email}</span>
        <span className="block truncate text-caption text-ink-tertiary">{person.email}</span>
      </span>
      {membership ? (
        <Badge tone="info">{membership.role === 'manager' ? 'Manager here' : 'Writer here'}</Badge>
      ) : null}
    </span>
  )
}
