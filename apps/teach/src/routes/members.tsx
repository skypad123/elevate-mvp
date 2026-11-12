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
import { errorMessage, fieldErrors } from '@elevate/web-ui/portal'
import { fillSlots, useFormatDate, useT } from '@elevate/web-ui/preferences'
import { MailPlus, Users } from 'lucide-react'
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
  const formatDate = useFormatDate()
  const [removing, setRemoving] = useState<MemberView | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const canManage = (role: MembershipRole) =>
    can(role === 'manager' ? 'members.manageManagers' : 'members.manageWriters')
  // Roles can change only where there are two of them: on a company profile, by the owner.
  const canChangeRoles = type === 'corporate' && can('members.manageManagers')

  /** Runs one action, shows what went wrong if it fails, and marks the row as busy meanwhile. */
  async function run(key: string, action: () => Promise<unknown>, done: string) {
    setBusy(key)
    try {
      await action()
      toast({ tone: 'success', title: done })
    } catch (error) {
      toast({ tone: 'danger', title: t('common.actionFailed'), description: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

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
              <Table>
                <THead>
                  <TR>
                    <TH>{t('members.list.person')}</TH>
                    <TH>{t('common.role')}</TH>
                    <TH>{t('members.list.added')}</TH>
                    <TH className="text-right">
                      <span className="sr-only">{t('common.actions')}</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  <TR>
                    <TD>
                      <Person
                        name={profile?.owner.name ?? null}
                        email={profile?.owner.email ?? ''}
                      />
                    </TD>
                    <TD>
                      <Badge tone="brand">{t('profileRole.owner')}</Badge>
                    </TD>
                    <TD className="text-ink-tertiary">—</TD>
                    <TD />
                  </TR>
                  {members.data.members.map((m) => (
                    <TR key={m.userId}>
                      <TD>
                        <Person name={m.name} email={m.email} />
                      </TD>
                      <TD>
                        {canChangeRoles ? (
                          <NativeSelect
                            aria-label={t('members.list.roleOf', { name: m.name ?? m.email })}
                            value={m.role}
                            disabled={busy === m.userId}
                            onChange={(e) => {
                              const role = e.target.value as MembershipRole
                              void run(
                                m.userId,
                                () => actions.changeRole(m.userId, role),
                                t(`members.toast.role.${role}`, { name: m.name ?? m.email }),
                              )
                            }}
                          >
                            <option value="writer">{t('profileRole.writer')}</option>
                            <option value="manager">{t('profileRole.manager')}</option>
                          </NativeSelect>
                        ) : (
                          <Badge>{t(`profileRole.${m.role}`)}</Badge>
                        )}
                      </TD>
                      <TD className="text-ink-secondary">
                        {formatDate(m.addedAt)}
                        {m.addedBy ? (
                          <span className="block text-caption text-ink-tertiary">
                            {t('members.list.addedBy', { name: m.addedBy })}
                          </span>
                        ) : null}
                      </TD>
                      <TD className="text-right">
                        {canManage(m.role) ? (
                          <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                            {t('common.remove')}
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
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
              <Table>
                <THead>
                  <TR>
                    <TH>{t('members.invitations.sentTo')}</TH>
                    <TH>{t('common.role')}</TH>
                    <TH>{t('common.status')}</TH>
                    <TH className="text-right">
                      <span className="sr-only">{t('common.actions')}</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {members.data.invitations.map((invitation) => (
                    <InvitationRow
                      key={invitation.id}
                      invitation={invitation}
                      busy={busy === invitation.id}
                      canManage={canManage(invitation.role)}
                      canConfirm={can('members.manageManagers')}
                      onResend={() =>
                        void run(
                          invitation.id,
                          () => actions.resend(invitation.id),
                          t('members.toast.resent', { email: invitation.email }),
                        )
                      }
                      onRevoke={() =>
                        void run(
                          invitation.id,
                          () => actions.revoke(invitation.id),
                          t('members.toast.revoked'),
                        )
                      }
                      onConfirm={() =>
                        void run(
                          invitation.id,
                          () => actions.confirm(invitation.id),
                          // The address that used the link, or the one the invitation went to.
                          t(`members.toast.role.${invitation.role}`, {
                            name: invitation.acceptedByEmail ?? invitation.email,
                          }),
                        )
                      }
                    />
                  ))}
                </TBody>
              </Table>
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
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('members.remove.title', { name: removing?.name ?? removing?.email ?? '' })}
        description={t('members.remove.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={!!removing && busy === removing.userId}
              onClick={() => {
                if (!removing) return
                const member = removing
                void run(
                  member.userId,
                  () => actions.remove(member.userId),
                  t('members.toast.removed', { name: member.name ?? member.email }),
                ).then(() => setRemoving(null))
              }}
            >
              {t('common.remove')}
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

function InvitationRow({
  invitation,
  busy,
  canManage,
  canConfirm,
  onResend,
  onRevoke,
  onConfirm,
}: {
  invitation: InvitationView
  busy: boolean
  canManage: boolean
  canConfirm: boolean
  onResend: () => void
  onRevoke: () => void
  onConfirm: () => void
}) {
  const t = useT()
  const formatDate = useFormatDate()
  const awaiting = invitation.status === 'awaiting_confirmation'
  return (
    <TR>
      <TD>
        <span className="block font-semibold text-ink">{invitation.email}</span>
        {invitation.invitedBy ? (
          <span className="block text-caption text-ink-tertiary">
            {t('members.invitations.invitedBy', { name: invitation.invitedBy })}
          </span>
        ) : null}
      </TD>
      <TD>
        <Badge>{t(`profileRole.${invitation.role}`)}</Badge>
      </TD>
      <TD className="text-ink-secondary">
        {awaiting ? (
          <>
            <Badge tone="warning">{t('members.invitations.needsConfirmation')}</Badge>
            <span className="mt-1 block text-caption text-ink-secondary">
              {invitation.acceptedByEmail
                ? t('members.invitations.acceptedElsewhere', { email: invitation.acceptedByEmail })
                : t('members.invitations.acceptedElsewhere.unknown')}
            </span>
          </>
        ) : (
          <>
            <Badge tone="neutral">{t('members.invitations.waiting')}</Badge>
            <span className="mt-1 block text-caption text-ink-tertiary">
              {t('members.invitations.expires', { date: formatDate(invitation.expiresAt) })}
            </span>
          </>
        )}
      </TD>
      <TD className="text-right">
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
      </TD>
    </TR>
  )
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
