import type { InvitationView, MembershipRole, MemberView } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  formatDate,
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
import { MailPlus, Users } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { ROLE_LABEL, ROLE_SUMMARY, useMemberActions, useMembers } from '../lib/members'
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
      toast({ tone: 'danger', title: 'That did not work', description: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  if (!canRead)
    return (
      <>
        <PageHeader eyebrow="Members" title="Members" />
        <EmptyState
          icon={Users}
          title="Members are managed by the owner"
          body="Your role on this profile does not include its member list."
        />
      </>
    )

  return (
    <>
      <PageHeader
        eyebrow="Members"
        title="Members"
        description="People who work on this profile’s courses with you. Each signs in with their own account."
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-display text-h3 font-semibold text-ink">On this profile</h2>
            {members.isPending ? (
              <Skeleton className="h-40 w-full" />
            ) : members.isError ? (
              <EmptyState
                tone="danger"
                title="Could not load members"
                body={errorMessage(members.error)}
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Person</TH>
                    <TH>Role</TH>
                    <TH>Added</TH>
                    <TH className="text-right">
                      <span className="sr-only">Actions</span>
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
                      <Badge tone="brand">Owner</Badge>
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
                            aria-label={`Role of ${m.name ?? m.email}`}
                            value={m.role}
                            disabled={busy === m.userId}
                            onChange={(e) => {
                              const role = e.target.value as MembershipRole
                              void run(
                                m.userId,
                                () => actions.changeRole(m.userId, role),
                                `${m.name ?? m.email} is now ${role === 'manager' ? 'a manager' : 'a writer'}`,
                              )
                            }}
                          >
                            <option value="writer">Writer</option>
                            <option value="manager">Manager</option>
                          </NativeSelect>
                        ) : (
                          <Badge>{ROLE_LABEL[m.role]}</Badge>
                        )}
                      </TD>
                      <TD className="text-ink-secondary">
                        {formatDate(m.addedAt)}
                        {m.addedBy ? (
                          <span className="block text-caption text-ink-tertiary">
                            by {m.addedBy}
                          </span>
                        ) : null}
                      </TD>
                      <TD className="text-right">
                        {canManage(m.role) ? (
                          <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                            Remove
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
            {members.data && members.data.members.length === 0 ? (
              <p className="text-small text-ink-tertiary">
                Nobody else yet. Invite a writer to help build your courses.
              </p>
            ) : null}
          </section>

          {members.data && members.data.invitations.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-h3 font-semibold text-ink">Invitations</h2>
              <Table>
                <THead>
                  <TR>
                    <TH>Sent to</TH>
                    <TH>Role</TH>
                    <TH>Status</TH>
                    <TH className="text-right">
                      <span className="sr-only">Actions</span>
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
                          `Sent again to ${invitation.email}`,
                        )
                      }
                      onRevoke={() =>
                        void run(
                          invitation.id,
                          () => actions.revoke(invitation.id),
                          'Invitation revoked',
                        )
                      }
                      onConfirm={() =>
                        void run(
                          invitation.id,
                          () => actions.confirm(invitation.id),
                          `${invitation.acceptedByEmail ?? 'They'} is now ${invitation.role === 'manager' ? 'a manager' : 'a writer'}`,
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
                title="Read only"
                description="You can see who is on this profile. Inviting and removing people is for the owner and managers."
              />
            </Card>
          )}
          <Card as="section" className="space-y-3">
            <CardHeader title="What each role can do" />
            <RoleNote
              label="Owner"
              text="Everything, including payout settings and who the managers are."
            />
            {type === 'corporate' ? (
              <RoleNote label={ROLE_LABEL.manager} text={ROLE_SUMMARY.manager} />
            ) : null}
            <RoleNote label={ROLE_LABEL.writer} text={ROLE_SUMMARY.writer} />
          </Card>
        </div>
      </div>

      <Dialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? removing?.email ?? ''}?`}
        description="They lose access to this profile at once. Courses and files they worked on stay with the profile, and changes of theirs that are waiting for approval stay too."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
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
                  `${member.name ?? member.email} was removed`,
                ).then(() => setRemoving(null))
              }}
            >
              Remove
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

function RoleNote({ label, text }: { label: string; text: string }) {
  return (
    <p className="text-small text-ink-secondary">
      <strong className="font-semibold text-ink">{label}.</strong> {text}
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
  const awaiting = invitation.status === 'awaiting_confirmation'
  return (
    <TR>
      <TD>
        <span className="block font-semibold text-ink">{invitation.email}</span>
        {invitation.invitedBy ? (
          <span className="block text-caption text-ink-tertiary">
            invited by {invitation.invitedBy}
          </span>
        ) : null}
      </TD>
      <TD>
        <Badge>{ROLE_LABEL[invitation.role]}</Badge>
      </TD>
      <TD className="text-ink-secondary">
        {awaiting ? (
          <>
            <Badge tone="warning">Needs confirmation</Badge>
            <span className="mt-1 block text-caption text-ink-secondary">
              Accepted from another address: {invitation.acceptedByEmail ?? 'unknown'}. They are not
              a member until the owner confirms.
            </span>
          </>
        ) : (
          <>
            <Badge tone="neutral">Waiting</Badge>
            <span className="mt-1 block text-caption text-ink-tertiary">
              Link expires {formatDate(invitation.expiresAt)}
            </span>
          </>
        )}
      </TD>
      <TD className="text-right">
        <span className="inline-flex flex-wrap justify-end gap-1">
          {awaiting && canConfirm ? (
            <Button size="sm" loading={busy} onClick={onConfirm}>
              Confirm
            </Button>
          ) : null}
          {!awaiting && canManage ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onResend}>
              Send again
            </Button>
          ) : null}
          {canManage ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRevoke}>
              Revoke
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
        title: `Invitation sent to ${email.trim()}`,
        description: 'The link in the email works for 7 days.',
      })
      setEmail('')
    } catch (error) {
      setErrors(fieldErrors(error))
      toast({ tone: 'danger', title: 'Could not send', description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="section">
      <CardHeader
        title="Invite someone"
        description="They get an email with a link. They sign in with their own address and accept."
      />
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          placeholder="name@example.com"
          required
        />
        {roles.length > 1 ? (
          <NativeSelect
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as MembershipRole)}
            hint={ROLE_SUMMARY[role]}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <p className="text-small text-ink-secondary">
            They join as a <strong className="font-semibold text-ink">writer</strong>.{' '}
            {ROLE_SUMMARY.writer}
          </p>
        )}
        <Button type="submit" icon={MailPlus} loading={busy} className="w-full">
          Send invitation
        </Button>
      </form>
    </Card>
  )
}
