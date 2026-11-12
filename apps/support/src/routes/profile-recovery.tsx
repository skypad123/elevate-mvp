import type {
  MediaAssetView,
  PersonSummary,
  RecoverOwner,
  SupportProfileDetail,
} from '@elevate/core'
import { Badge, Button, Dialog, Input, MediaUploader, useToast } from '@elevate/web-ui'
import { unwrap } from '@elevate/web-ui/portal'
import { fillSlots, useErrorMessage, useT } from '@elevate/web-ui/preferences'
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
  const t = useT()
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
        {corporate ? t('recovery.open.company') : t('recovery.open.personal')}
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
  const t = useT()
  const errorMessage = useErrorMessage()
  const [busy, setBusy] = useState(false)

  /** `done` is the title of the toast shown when the recovery has gone through. */
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
      toast({ tone: 'success', title: done, description: t('recovery.toast.emailed') })
      onDone()
    } catch (error) {
      toast({
        tone: 'danger',
        title: t('recovery.toast.failed'),
        description: errorMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }
  return { busy, recover }
}

/** A personal profile belongs to a person, so the person stays and their address changes. */
function PersonalRecovery({
  detail,
  onClose,
}: {
  detail: SupportProfileDetail
  onClose: () => void
}) {
  const t = useT()
  const owner = detail.profile.owner
  const [email, setEmail] = useState('')
  const { busy, recover } = useRecover(detail.profile.id, onClose)
  const next = email.trim().toLowerCase()
  const usable = /^\S+@\S+\.\S+$/.test(next) && next !== owner.email.toLowerCase()

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('recovery.personal.title')}
      description={fillSlots(t('recovery.personal.description'), {
        email: <strong>{owner.email}</strong>,
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!usable}
            onClick={() => recover({ newEmail: next }, t('recovery.toast.emailChanged'))}
          >
            {t('recovery.personal.confirm')}
          </Button>
        </>
      }
    >
      <Input
        label={t('recovery.personal.newEmail')}
        type="email"
        autoComplete="off"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        hint={t('recovery.personal.newEmail.hint')}
        required
      />
      <p className="mt-4 text-small text-ink-secondary">{t('recovery.personal.effects')}</p>
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
  const t = useT()
  const errorMessage = useErrorMessage()
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
      title={t('recovery.company.title')}
      description={fillSlots(t('recovery.company.description'), {
        email: <strong>{previous.email}</strong>,
        company: legalEntity?.legalName ?? profile.displayName,
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
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
                t('recovery.toast.ownerChanged'),
              )
            }}
          >
            {t('recovery.company.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {person ? (
          <div>
            <p className="mb-1.5 text-small font-semibold text-ink">
              {t('recovery.company.newOwner')}
            </p>
            <div className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2">
              <PersonLine person={person} profileId={profile.id} />
              <Button variant="ghost" size="sm" onClick={() => setPerson(null)}>
                {t('recovery.company.newOwner.change')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Input
              label={t('recovery.company.newOwner')}
              hint={t('recovery.company.newOwner.hint')}
              placeholder="name@example.com"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {!searching ? null : people.isPending ? (
              <p className="mt-2 text-small text-ink-tertiary">{t('recovery.company.searching')}</p>
            ) : people.isError ? (
              <p role="alert" className="mt-2 text-small text-danger">
                {errorMessage(people.error)}
              </p>
            ) : candidates.length === 0 ? (
              <p className="mt-2 text-small text-ink-tertiary">
                {t('recovery.company.noMatch', { search })}
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
          label={t('recovery.company.authorisation')}
          hint={t('recovery.company.authorisation.hint')}
        />

        <label className="flex cursor-pointer items-start gap-2 text-small text-ink">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--brand)]"
            checked={removePrevious}
            onChange={(e) => setRemovePrevious(e.target.checked)}
          />
          <span>
            {t('recovery.company.removePrevious', { email: previous.email })}
            <span className="block text-ink-tertiary">
              {t('recovery.company.removePrevious.hint')}
            </span>
          </span>
        </label>

        <p className="text-small text-ink-secondary">{t('recovery.company.effects')}</p>
      </div>
    </Dialog>
  )
}

function PersonLine({ person, profileId }: { person: PersonSummary; profileId: string }) {
  const t = useT()
  const membership = person.profiles.find((p) => p.id === profileId)
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink">{person.name ?? person.email}</span>
        <span className="block truncate text-caption text-ink-tertiary">{person.email}</span>
      </span>
      {membership ? (
        <Badge tone="info">
          {membership.role === 'manager'
            ? t('recovery.company.managerHere')
            : t('recovery.company.writerHere')}
        </Badge>
      ) : null}
    </span>
  )
}
