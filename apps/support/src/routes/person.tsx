import type { PersonDetail } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  Dialog,
  EmptyState,
  formatBps,
  formatDate,
  Input,
  MediaPreview,
  PageHeader,
  Skeleton,
  StatCard,
  statusLabel,
  statusTone,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../lib/api'
import { supportKeys, usePerson } from '../lib/queries'

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

function PersonView({ person }: { person: PersonDetail }) {
  const { hasRole, user: me } = usePortalAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [commission, setCommission] = useState(
    person.teacherProfile ? (person.teacherProfile.commissionBps / 100).toString() : '15',
  )
  const teacher = person.teacherProfile
  const isSuperAdmin = hasRole('super_admin')

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: supportKeys.person(person.id) })
    await queryClient.invalidateQueries({ queryKey: ['support', 'people'] })
  }

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      await refresh()
      toast({ tone: 'success', title: label })
      setDialog(null)
      setNote('')
    } catch (error) {
      toast({ tone: 'danger', title: `${label} failed`, description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const approve = () =>
    act('Teacher approved', async () =>
      unwrap(
        await api.support.teachers[':id'].approve.$post({
          param: { id: person.id },
          json: note.trim() ? { note: note.trim() } : {},
        }),
      ),
    )
  const reject = () =>
    act('Application rejected', async () =>
      unwrap(
        await api.support.teachers[':id'].reject.$post({
          param: { id: person.id },
          json: { reason: note.trim() },
        }),
      ),
    )
  const saveCommission = () =>
    act('Commission updated', async () => {
      const bps = Math.round(Number.parseFloat(commission) * 100)
      return unwrap(
        await api.support.teachers[':id'].commission.$patch({
          param: { id: person.id },
          json: { commissionBps: bps },
        }),
      )
    })
  const toggleRole = (role: 'support_agent' | 'super_admin', grant: boolean) =>
    act(grant ? 'Role granted' : 'Role revoked', async () =>
      unwrap(
        await api.support.people[':id'].roles.$post({
          param: { id: person.id },
          json: { role, grant },
        }),
      ),
    )

  return (
    <>
      <Link
        to="/people"
        className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-4" /> People
      </Link>
      <PageHeader
        eyebrow={teacher ? 'Teacher' : 'Learner'}
        title={teacher?.displayName ?? person.name ?? person.email}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{person.email}</span>
            {person.roles.map((r) => (
              <Badge key={r} tone={r === 'teacher' ? 'accent' : 'info'}>
                {statusLabel(r)}
              </Badge>
            ))}
            {teacher ? (
              <Badge tone={statusTone[teacher.status]}>{statusLabel(teacher.status)}</Badge>
            ) : null}
          </span>
        }
        actions={
          teacher && teacher.status !== 'approved' ? (
            <>
              <Button variant="secondary" icon={X} onClick={() => setDialog('reject')}>
                Reject
              </Button>
              <Button icon={Check} onClick={() => setDialog('approve')}>
                Approve
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard label="Active enrolments" value={person.stats.enrollments} />
        <StatCard
          label="Courses"
          value={person.stats.courses}
          hint={`${person.stats.liveCourses} live`}
        />
        <StatCard label="Joined" value={formatDate(person.createdAt)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {teacher ? (
            <>
              <Card as="section">
                <CardHeader
                  title="Application"
                  description={`Applied ${formatDate(teacher.appliedAt)}${teacher.reviewedAt ? ` · reviewed ${formatDate(teacher.reviewedAt)}` : ''}`}
                />
                <DescriptionList
                  items={[
                    { label: 'Headline', value: teacher.headline },
                    { label: 'Bio', value: <p className="whitespace-pre-wrap">{teacher.bio}</p> },
                    {
                      label: 'Credentials',
                      value: <p className="whitespace-pre-wrap">{teacher.credentials}</p>,
                    },
                    ...(teacher.reviewNote
                      ? [{ label: 'Review note', value: teacher.reviewNote }]
                      : []),
                  ]}
                />
              </Card>
              <Card as="section">
                <CardHeader title="Teaching sample" />
                {teacher.teachingSampleMediaId ? (
                  <MediaPreview api={api} assetId={teacher.teachingSampleMediaId} />
                ) : null}
                {teacher.teachingSampleUrl ? (
                  <a
                    href={teacher.teachingSampleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-small font-semibold text-brand hover:underline"
                  >
                    {teacher.teachingSampleUrl} <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
                {!teacher.teachingSampleMediaId && !teacher.teachingSampleUrl ? (
                  <p className="text-small text-ink-tertiary">No sample provided.</p>
                ) : null}
              </Card>
            </>
          ) : (
            <Card as="section">
              <CardHeader title="Profile" />
              <DescriptionList
                items={[
                  { label: 'Name', value: person.name ?? '—' },
                  { label: 'Email', value: person.email },
                ]}
              />
            </Card>
          )}
        </div>
        <div className="space-y-6">
          {teacher ? (
            <Card as="section">
              <CardHeader
                title="Commission"
                description="Platform share of each sale after Stripe fees."
              />
              <DescriptionList
                items={[
                  { label: 'Current', value: formatBps(teacher.commissionBps) },
                  {
                    label: 'Stripe',
                    value: teacher.stripe.chargesEnabled
                      ? 'Payments enabled'
                      : teacher.stripe.connected
                        ? 'Onboarding incomplete'
                        : 'Not connected',
                  },
                ]}
              />
              {isSuperAdmin ? (
                <div className="mt-4 flex items-end gap-2">
                  <Input
                    label="New rate (%)"
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    wrapperClassName="w-32"
                  />
                  <Button variant="secondary" loading={busy} onClick={saveCommission}>
                    Save
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-caption text-ink-tertiary">
                  Only super admins can change commission.
                </p>
              )}
            </Card>
          ) : null}
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
                      <span className="text-small font-semibold text-ink">{statusLabel(role)}</span>
                      <Button
                        variant={has ? 'ghost' : 'secondary'}
                        size="sm"
                        loading={busy}
                        onClick={() => toggleRole(role, !has)}
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
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Approve this teacher?"
        description="They gain the teacher role immediately and can connect Stripe and build courses."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={approve}>
              Approve
            </Button>
          </>
        }
      >
        <Textarea
          label="Internal note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </Dialog>
      <Dialog
        open={dialog === 'reject'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reject this application"
        description="The reason is emailed to the applicant. They can update and resubmit."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={note.trim().length < 10}
              onClick={reject}
            >
              Reject
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason (sent to the applicant)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          required
        />
      </Dialog>
    </>
  )
}
