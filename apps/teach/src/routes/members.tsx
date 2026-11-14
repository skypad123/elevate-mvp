import type { InvitationView, MembershipRole, MemberView, ProfileRole } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  Input,
  NativeSelect,
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
import { fieldErrors } from '@elevate/web-ui/portal'
import { fillSlots, useErrorMessage, useFormatDate, useT } from '@elevate/web-ui/preferences'
import { MailPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { type FormEvent, useState } from 'react'
import { useMemberActions, useMembers } from '../lib/members'
import { useCurrentProfile } from '../lib/profile'

/**
 * Who is on the profile, and the invitations that have not been taken up yet. The owner and
 * managers manage writers; only the owner manages managers, and only a company profile has them.
 * Staff can read the page and change nothing.
 */
export function MembersPage() {
  const { profile, type, can } = useCurrentProfile()
  const canRead = can('members.read')
  const members = useMembers(canRead)
  const actions = useMemberActions()
  const { toast } = useToast()
  const t = useT()
  const errorMessage = useErrorMessage()
  const formatDate = useFormatDate()
  // Every consequential action asks first, in one dialog; the dialog closes only when it worked.
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const canManage = (role: MembershipRole) =>
    can(role === 'manager' ? 'members.manageManagers' : 'members.manageWriters')
  // Roles can change only where there are two of them: on a company profile, by the owner.
  const canChangeRoles = type === 'corporate' && can('members.manageManagers')

  /**
   * Runs one action, shows what went wrong if it fails, and marks the row as busy meanwhile.
   * Resolves to whether it worked, so a dialog can stay open after a failure.
   */
  async function run(key: string, action: () => Promise<unknown>, done: string) {
    setBusy(key)
    try {
      await action()
      toast({ tone: 'success', title: done })
      return true
    } catch (error) {
      toast({ tone: 'danger', title: t('common.actionFailed'), description: errorMessage(error) })
      return false
    } finally {
      setBusy(null)
    }
  }

  /** The dialog's text and action for what is waiting to be confirmed. */
  function describe(action: PendingAction): {
    key: string
    title: string
    description: ReactNode
    confirm: string
    danger: boolean
    perform: () => Promise<unknown>
    done: string
  } {
    switch (action.kind) {
      case 'role': {
        const { member, role } = action
        const name = member.name ?? member.email
        return {
          key: member.userId,
          title: t(`members.changeRole.title.${role}`, { name }),
          description: t(`profileRole.${role}.summary`),
          confirm: t(`members.changeRole.confirm.${role}`),
          danger: false,
          perform: () => actions.changeRole(member.userId, role),
          done: t(`members.toast.role.${role}`, { name }),
        }
      }
      case 'remove': {
        const { member } = action
        return {
          key: member.userId,
          title: t('members.remove.title', { name: member.name ?? member.email }),
          description: t('members.remove.description'),
          confirm: t('common.remove'),
          danger: true,
          perform: () => actions.remove(member.userId),
          done: t('members.toast.removed', { name: member.name ?? member.email }),
        }
      }
      case 'confirm': {
        const { invitation } = action
        const accepted = invitation.acceptedByEmail
        return {
          key: invitation.id,
          title: t('members.confirmInvite.title', { email: accepted ?? invitation.email }),
          description: accepted
            ? t('members.confirmInvite.description', { invited: invitation.email, accepted })
            : t('members.confirmInvite.description.unknown', { invited: invitation.email }),
          confirm: t('members.invitations.confirm'),
          danger: false,
          perform: () => actions.confirm(invitation.id),
          // The address that used the link, or the one the invitation went to.
          done: t(`members.toast.role.${invitation.role}`, { name: accepted ?? invitation.email }),
        }
      }
      case 'revoke': {
        const { invitation } = action
        return {
          key: invitation.id,
          title: t('members.revoke.title', { email: invitation.email }),
          description: t('members.revoke.description'),
          confirm: t('members.invitations.revoke'),
          danger: true,
          perform: () => actions.revoke(invitation.id),
          done: t('members.toast.revoked'),
        }
      }
    }
  }
  const dialog = pending ? describe(pending) : null

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow={t('members.eyebrow')} title={t('members.title')} />
        <EmptyState
          icon={Users}
          title={t('members.noAccess.title')}
          body={t('members.noAccess.body')}
        />
      </>
    )

  return (
    <>
      <PageHeader
        eyebrow={t('members.eyebrow')}
        title={t('members.title')}
        description={t('members.description')}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-display text-h3 font-semibold text-ink">
              {t('members.list.title')}
            </h2>
            {members.isPending ? (
              <Skeleton className="h-40 w-full" />
            ) : members.isError ? (
              <EmptyState
                tone="danger"
                title={t('members.list.loadFailed')}
                body={errorMessage(members.error)}
              />
            ) : (
              <ResponsiveRows
                headers={{
                  main: t('members.list.person'),
                  role: t('common.role'),
                  detail: t('members.list.added'),
                }}
                actionsLabel={t('common.actions')}
                rows={[
                  {
                    key: 'owner',
                    main: (
                      <Person
                        name={profile?.owner.name ?? null}
                        email={profile?.owner.email ?? ''}
                      />
                    ),
                    role: <Badge tone="brand">{t('profileRole.owner')}</Badge>,
                    detail: <span className="text-ink-tertiary">—</span>,
                    actions: null,
                  },
                  ...members.data.members.map((m) => ({
                    key: m.userId,
                    main: <Person name={m.name} email={m.email} />,
                    role: (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <Badge>{t(`profileRole.${m.role}`)}</Badge>
                        {/* Roles change only where there are two: on a company, by the owner. */}
                        {canChangeRoles ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy === m.userId}
                            aria-label={t('members.list.roleOf', { name: m.name ?? m.email })}
                            onClick={() =>
                              setPending({
                                kind: 'role',
                                member: m,
                                role: m.role === 'manager' ? 'writer' : 'manager',
                              })
                            }
                          >
                            {t('members.list.changeRole')}
                          </Button>
                        ) : null}
                      </span>
                    ),
                    detail: (
                      <span className="text-ink-secondary">
                        {formatDate(m.addedAt)}
                        {m.addedBy ? (
                          <span className="block text-caption text-ink-tertiary">
                            {t('members.list.addedBy', { name: m.addedBy })}
                          </span>
                        ) : null}
                      </span>
                    ),
                    actions: canManage(m.role) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === m.userId}
                        onClick={() => setPending({ kind: 'remove', member: m })}
                      >
                        {t('common.remove')}
                      </Button>
                    ) : null,
                  })),
                ]}
              />
            )}
            {members.data && members.data.members.length === 0 ? (
              <p className="text-small text-ink-tertiary">{t('members.list.empty')}</p>
            ) : null}
          </section>

          {members.data && members.data.invitations.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-h3 font-semibold text-ink">
                {t('members.invitations.title')}
              </h2>
              <ResponsiveRows
                headers={{
                  main: t('members.invitations.sentTo'),
                  role: t('common.role'),
                  detail: t('common.status'),
                }}
                actionsLabel={t('common.actions')}
                rows={members.data.invitations.map((invitation) => ({
                  key: invitation.id,
                  ...invitationCells({
                    invitation,
                    busy: busy === invitation.id,
                    canManage: canManage(invitation.role),
                    canConfirm: can('members.manageManagers'),
                    onResend: () =>
                      void run(
                        invitation.id,
                        () => actions.resend(invitation.id),
                        t('members.toast.resent', { email: invitation.email }),
                      ),
                    onRevoke: () => setPending({ kind: 'revoke', invitation }),
                    onConfirm: () => setPending({ kind: 'confirm', invitation }),
                    t,
                    formatDate,
                  }),
                }))}
              />
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          {can('members.manageWriters') ? (
            <InviteCard
              // A manager can invite writers only; a personal profile has no managers at all.
              roles={canChangeRoles ? ['writer', 'manager'] : ['writer']}
              onInvite={actions.invite}
            />
          ) : (
            <Card as="section">
              <CardHeader
                title={t('members.readOnly.title')}
                description={t('members.readOnly.description')}
              />
            </Card>
          )}
          <Card as="section" className="space-y-3">
            <CardHeader title={t('members.roles.title')} />
            <RoleNote profileRole="owner" />
            {type === 'corporate' ? <RoleNote profileRole="manager" /> : null}
            <RoleNote profileRole="writer" />
          </Card>
        </div>
      </div>

      <Dialog
        open={!!dialog}
        onOpenChange={(open) => !open && setPending(null)}
        title={dialog?.title ?? ''}
        description={dialog?.description}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={dialog?.danger ? 'danger' : 'primary'}
              loading={!!dialog && busy === dialog.key}
              onClick={() => {
                if (!dialog) return
                void run(dialog.key, dialog.perform, dialog.done).then((ok) => {
                  if (ok) setPending(null)
                })
              }}
            >
              {dialog?.confirm}
            </Button>
          </>
        }
      />
    </>
  )
}

function Person({ name, email }: { name: string | null; email: string }) {
  return (
    <>
      <span className="block font-semibold text-ink">{name ?? email}</span>
      {name ? <span className="block text-caption text-ink-tertiary">{email}</span> : null}
    </>
  )
}

/** A role and what it can do, with the role's name in bold. */
function RoleNote({ profileRole }: { profileRole: ProfileRole }) {
  const t = useT()
  return (
    <p className="text-small text-ink-secondary">
      {fillSlots(t('profileRole.note'), {
        role: <strong className="font-semibold text-ink">{t(`profileRole.${profileRole}`)}</strong>,
        summary: t(`profileRole.${profileRole}.summary`),
      })}
    </p>
  )
}

type PendingAction =
  | { kind: 'role'; member: MemberView; role: MembershipRole }
  | { kind: 'remove'; member: MemberView }
  | { kind: 'confirm'; invitation: InvitationView }
  | { kind: 'revoke'; invitation: InvitationView }

/** The four columns of both lists: who, their role, a detail (added or status), and actions. */
type Row = { key: string; main: ReactNode; role: ReactNode; detail: ReactNode; actions: ReactNode }
const COLUMNS = ['main', 'role', 'detail'] as const

/**
 * Rows as a table on wide screens and as stacked cards on a phone, where a four-column table
 * would scroll sideways and hide the actions.
 */
function ResponsiveRows({
  headers,
  actionsLabel,
  rows,
}: {
  headers: Record<(typeof COLUMNS)[number], string>
  actionsLabel: string
  rows: Row[]
}) {
  return (
    <>
      <div className="hidden sm:block">
        <Table>
          <THead>
            <TR>
              {COLUMNS.map((column) => (
                <TH key={column}>{headers[column]}</TH>
              ))}
              <TH className="text-right">
                <span className="sr-only">{actionsLabel}</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.key}>
                {COLUMNS.map((column) => (
                  <TD key={column}>{row[column]}</TD>
                ))}
                <TD className="text-right">{row.actions}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface sm:hidden">
        {rows.map((row) => (
          <li key={row.key} className="space-y-2 p-4 text-small">
            {row.main}
            <dl className="space-y-2">
              {(['role', 'detail'] as const).map((column) => (
                <div key={column} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <dt className="w-20 shrink-0 text-caption text-ink-tertiary">
                    {headers[column]}
                  </dt>
                  <dd className="min-w-0 flex-1">{row[column]}</dd>
                </div>
              ))}
            </dl>
            {row.actions ? <div className="flex flex-wrap gap-1">{row.actions}</div> : null}
          </li>
        ))}
      </ul>
    </>
  )
}

function invitationCells({
  invitation,
  busy,
  canManage,
  canConfirm,
  onResend,
  onRevoke,
  onConfirm,
  t,
  formatDate,
}: {
  invitation: InvitationView
  busy: boolean
  canManage: boolean
  canConfirm: boolean
  onResend: () => void
  onRevoke: () => void
  onConfirm: () => void
  t: ReturnType<typeof useT>
  formatDate: ReturnType<typeof useFormatDate>
}): Omit<Row, 'key'> {
  const awaiting = invitation.status === 'awaiting_confirmation'
  return {
    main: (
      <span>
        <span className="block font-semibold text-ink">{invitation.email}</span>
        {invitation.invitedBy ? (
          <span className="block text-caption text-ink-tertiary">
            {t('members.invitations.invitedBy', { name: invitation.invitedBy })}
          </span>
        ) : null}
      </span>
    ),
    role: <Badge>{t(`profileRole.${invitation.role}`)}</Badge>,
    detail: awaiting ? (
      <span className="text-ink-secondary">
        <Badge tone="warning">{t('members.invitations.needsConfirmation')}</Badge>
        <span className="mt-1 block text-caption text-ink-secondary">
          {invitation.acceptedByEmail
            ? t('members.invitations.acceptedElsewhere', { email: invitation.acceptedByEmail })
            : t('members.invitations.acceptedElsewhere.unknown')}
        </span>
      </span>
    ) : (
      <span className="text-ink-secondary">
        <Badge tone="neutral">{t('members.invitations.waiting')}</Badge>
        <span className="mt-1 block text-caption text-ink-tertiary">
          {t('members.invitations.expires', { date: formatDate(invitation.expiresAt) })}
        </span>
      </span>
    ),
    actions: (
      <span className="inline-flex flex-wrap justify-end gap-1">
        {awaiting && canConfirm ? (
          <Button size="sm" loading={busy} onClick={onConfirm}>
            {t('members.invitations.confirm')}
          </Button>
        ) : null}
        {!awaiting && canManage ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onResend}>
            {t('members.invitations.resend')}
          </Button>
        ) : null}
        {canManage ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onRevoke}>
            {t('members.invitations.revoke')}
          </Button>
        ) : null}
      </span>
    ),
  }
}

function InviteCard({
  roles,
  onInvite,
}: {
  roles: MembershipRole[]
  onInvite: (email: string, role: MembershipRole) => Promise<unknown>
}) {
  const { toast } = useToast()
  const t = useT()
  const errorMessage = useErrorMessage()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MembershipRole>('writer')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await onInvite(email.trim(), role)
      toast({
        tone: 'success',
        title: t('members.toast.invited', { email: email.trim() }),
        description: t('members.toast.invited.description'),
      })
      setEmail('')
    } catch (error) {
      setErrors(fieldErrors(error))
      toast({
        tone: 'danger',
        title: t('members.toast.inviteFailed'),
        description: errorMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="section">
      <CardHeader title={t('members.invite.title')} description={t('members.invite.description')} />
      <form onSubmit={submit} className="space-y-4">
        <Input
          label={t('common.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          placeholder="name@example.com"
          required
        />
        {roles.length > 1 ? (
          <NativeSelect
            label={t('common.role')}
            value={role}
            onChange={(e) => setRole(e.target.value as MembershipRole)}
            hint={t(`profileRole.${role}.summary`)}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {t(`profileRole.${r}`)}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <p className="text-small text-ink-secondary">
            {fillSlots(t('members.invite.joinsAs'), {
              role: (
                <strong className="font-semibold text-ink">
                  {t('members.invite.joinsAs.writer')}
                </strong>
              ),
              summary: t('profileRole.writer.summary'),
            })}
          </p>
        )}
        <Button type="submit" icon={MailPlus} loading={busy} className="w-full">
          {t('members.invite.submit')}
        </Button>
      </form>
    </Card>
  )
}
