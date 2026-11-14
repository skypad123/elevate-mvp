import type { PersonDetail } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  Dialog,
  EmptyState,
  formatDate,
  PageHeader,
  Skeleton,
  StatCard,
  statusLabel,
  statusTone,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../lib/api'
import { supportKeys, usePerson } from '../lib/queries'

const ROLE_ON_PROFILE = { owner: 'Owner', manager: 'Manager', writer: 'Writer' } as const

export function Person() {
  const { id = '' } = useParams()
  const query = usePerson(id)
  if (query.isPending) return <Skeleton className="h-64 w-full" />
  if (query.isError)
    return (
      <EmptyState
        tone="danger"
        title="Could not load this person"
        body={errorMessage(query.error)}
      />
    )
  return <PersonView person={query.data} />
}

/**
 * Someone with an account. Teaching is not on this page: a person owns or belongs to teaching
 * profiles, and each profile has its own page with its application, courses and payouts.
 */
function PersonView({ person }: { person: PersonDetail }) {
  const { hasRole, user: me } = usePortalAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  // Each row waits on its own; a change of staff access is confirmed first.
  const [busy, setBusy] = useState<StaffRole | null>(null)
  const [confirming, setConfirming] = useState<{ role: StaffRole; grant: boolean } | null>(null)
  const isSuperAdmin = hasRole('super_admin')

  async function toggleRole(role: StaffRole, grant: boolean) {
    const label = grant ? 'Role granted' : 'Role revoked'
    setBusy(role)
    try {
      await unwrap(
        await api.support.people[':id'].roles.$post({
          param: { id: person.id },
          json: { role, grant },
        }),
      )
      await queryClient.invalidateQueries({ queryKey: supportKeys.person(person.id) })
      await queryClient.invalidateQueries({ queryKey: ['support', 'people'] })
      toast({ tone: 'success', title: label })
      setConfirming(null)
    } catch (error) {
      toast({ tone: 'danger', title: `${label} failed`, description: errorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Link
        to="/people"
        className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-4" /> People
      </Link>
      <PageHeader
        eyebrow={person.roles.length > 0 ? 'Staff' : 'Person'}
        title={person.name ?? person.email}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{person.email}</span>
            {person.roles.map((r) => (
              <Badge key={r} tone="info">
                {statusLabel(r)}
              </Badge>
            ))}
          </span>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard label="Active enrolments" value={person.stats.enrollments} />
        <StatCard label="Teaching profiles" value={person.profiles.length} />
        <StatCard label="Joined" value={formatDate(person.createdAt)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card as="section">
            <CardHeader
              title="Teaching profiles"
              description="The profiles this person owns or belongs to. Applications, courses and payouts are on the profile."
            />
            {person.profiles.length === 0 ? (
              <p className="text-small text-ink-tertiary">
                This person is not part of any teaching profile.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {person.profiles.map((profile) => (
                  <li key={profile.id}>
                    <Link
                      to={`/profiles/${profile.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:text-brand-fg"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{profile.displayName}</span>
                        <span className="text-caption text-ink-tertiary">
                          {profile.type === 'corporate' ? 'Corporate' : 'Personal'} ·{' '}
                          {ROLE_ON_PROFILE[profile.role]}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge tone={statusTone[profile.status]}>
                          {statusLabel(profile.status)}
                        </Badge>
                        <ArrowRight className="size-4 text-ink-tertiary" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card as="section">
            <CardHeader title="Account" />
            <DescriptionList
              items={[
                { label: 'Name', value: person.name ?? '—' },
                { label: 'Email', value: person.email },
              ]}
            />
          </Card>
        </div>
        <div className="space-y-6">
          {isSuperAdmin && person.id !== me?.id ? (
            <Card as="section">
              <CardHeader title="Staff access" />
              <div className="flex flex-col gap-2">
                {(['support_agent', 'super_admin'] as const).map((role) => {
                  const has = person.roles.includes(role)
                  return (
                    <div
                      key={role}
                      className="flex items-center justify-between rounded-control border border-border px-3 py-2"
                    >
                      <span>
                        <span className="block text-small font-semibold text-ink">
                          {statusLabel(role)}
                        </span>
                        <span className="block text-caption text-ink-tertiary">
                          {has ? 'Has this role' : 'Does not have this role'}
                        </span>
                      </span>
                      <Button
                        variant={has ? 'danger' : 'secondary'}
                        size="sm"
                        loading={busy === role}
                        onClick={() => setConfirming({ role, grant: !has })}
                      >
                        {has ? 'Revoke' : 'Grant'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
      <Dialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming
            ? `${confirming.grant ? 'Grant' : 'Revoke'} ${statusLabel(confirming.role).toLowerCase()} for ${person.name ?? person.email}?`
            : ''
        }
        description={
          confirming ? ROLE_EFFECT[confirming.role][confirming.grant ? 'grant' : 'revoke'] : ''
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant={confirming?.grant ? 'primary' : 'danger'}
              loading={!!confirming && busy === confirming.role}
              onClick={() => confirming && void toggleRole(confirming.role, confirming.grant)}
            >
              {confirming?.grant ? 'Grant' : 'Revoke'}
            </Button>
          </>
        }
      />
    </>
  )
}

type StaffRole = 'support_agent' | 'super_admin'

/** What each staff role gives, said before it is granted or taken away. The change is audited. */
const ROLE_EFFECT: Record<StaffRole, { grant: string; revoke: string }> = {
  support_agent: {
    grant:
      'They can sign in to Support: review courses and profile applications, look up people and transactions, and record legal-name checks. The change is recorded in the audit log.',
    revoke: 'They lose access to Support at once. The change is recorded in the audit log.',
  },
  super_admin: {
    grant:
      'On top of Support access, they can change commission, issue refunds, grant and revoke staff roles, recover profile owners and act inside any teaching profile. The change is recorded in the audit log.',
    revoke:
      'They keep any Support access they have, but lose the super-admin powers. The change is recorded in the audit log.',
  },
}
