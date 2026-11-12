import { formatSgd, type SupportProfileDetail } from '@elevate/core'
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
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../lib/api'
import { profileKeys, useProfile } from '../lib/queries'
import { teachUrl } from '../lib/urls'

export function Profile() {
  const { id = '' } = useParams()
  const query = useProfile(id)
  if (query.isPending) return <Skeleton className="h-64 w-full" />
  if (query.isError)
    return (
      <EmptyState
        tone="danger"
        title="Could not load this profile"
        body={errorMessage(query.error)}
      />
    )
  return <ProfileView detail={query.data} />
}

/** One teaching profile: its application, owner, courses, payout accounts and earnings. */
function ProfileView({ detail }: { detail: SupportProfileDetail }) {
  const { profile, courses, payoutAccounts, earnings } = detail
  const { hasRole } = usePortalAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [commission, setCommission] = useState((profile.commissionBps / 100).toString())
  const isSuperAdmin = hasRole('super_admin')
  const liveCourses = courses.filter((c) => c.status === 'live').length

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      // The lists show status and commission too, and a person lists their profiles' status.
      await queryClient.invalidateQueries({ queryKey: profileKeys.all })
      await queryClient.invalidateQueries({ queryKey: ['support', 'people'] })
      await queryClient.invalidateQueries({ queryKey: ['support', 'person'] })
      toast({ tone: 'success', title: label })
      setDialog(null)
      setNote('')
    } catch (error) {
      toast({ tone: 'danger', title: `${label} failed`, description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const param = { id: profile.id }
  const approve = () =>
    act('Profile approved', async () =>
      unwrap(
        await api.support.profiles[':id'].approve.$post({
          param,
          json: note.trim() ? { note: note.trim() } : {},
        }),
      ),
    )
  const reject = () =>
    act('Application rejected', async () =>
      unwrap(
        await api.support.profiles[':id'].reject.$post({ param, json: { reason: note.trim() } }),
      ),
    )
  const saveCommission = () =>
    act('Commission updated', async () => {
      const bps = Math.round(Number.parseFloat(commission) * 100)
      return unwrap(
        await api.support.profiles[':id'].commission.$patch({
          param,
          json: { commissionBps: bps },
        }),
      )
    })

  return (
    <>
      <Link
        to="/profiles"
        className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Profiles
      </Link>
      <PageHeader
        eyebrow={profile.type === 'corporate' ? 'Corporate profile' : 'Personal profile'}
        title={profile.displayName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>Owned by {profile.owner.email}</span>
            <Badge tone={statusTone[profile.status]}>{statusLabel(profile.status)}</Badge>
          </span>
        }
        actions={
          <>
            {isSuperAdmin ? (
              // A super admin opening the profile in Teach acts as staff there: Teach says so in
              // a banner, and every change is recorded under their own name.
              <a href={teachUrl(`/p/${profile.id}`)} target="_blank" rel="noreferrer">
                <Button variant="secondary" icon={ExternalLink}>
                  Open in Teach
                </Button>
              </a>
            ) : null}
            {profile.status !== 'approved' ? (
              <>
                <Button variant="secondary" icon={X} onClick={() => setDialog('reject')}>
                  Reject
                </Button>
                <Button icon={Check} onClick={() => setDialog('approve')}>
                  Approve
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard label="Courses" value={courses.length} hint={`${liveCourses} live`} />
        <StatCard label="Sales" value={earnings.paymentCount} hint="Paid enrolments" />
        <StatCard
          label="Net earnings"
          value={formatSgd(earnings.netCents)}
          hint="After Stripe fees, commission and refunds"
        />
        <StatCard label="Applied" value={formatDate(profile.appliedAt)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card as="section">
            <CardHeader
              title="Application"
              description={`Applied ${formatDate(profile.appliedAt)}${profile.reviewedAt ? ` · reviewed ${formatDate(profile.reviewedAt)}` : ''}`}
            />
            <DescriptionList
              items={[
                { label: 'Headline', value: profile.headline },
                { label: 'Bio', value: <p className="whitespace-pre-wrap">{profile.bio}</p> },
                {
                  label: 'Credentials',
                  value: <p className="whitespace-pre-wrap">{profile.credentials}</p>,
                },
                ...(profile.reviewNote
                  ? [{ label: 'Review note', value: profile.reviewNote }]
                  : []),
              ]}
            />
          </Card>
          <Card as="section">
            <CardHeader title="Teaching sample" />
            {profile.teachingSampleMediaId ? (
              <MediaPreview api={api} assetId={profile.teachingSampleMediaId} />
            ) : null}
            {profile.teachingSampleUrl ? (
              <a
                href={profile.teachingSampleUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-small font-semibold text-brand hover:underline"
              >
                {profile.teachingSampleUrl} <ExternalLink className="size-3.5" />
              </a>
            ) : null}
            {!profile.teachingSampleMediaId && !profile.teachingSampleUrl ? (
              <p className="text-small text-ink-tertiary">No sample provided.</p>
            ) : null}
          </Card>
          <Card as="section">
            <CardHeader title="Courses" description="Open a course to read it as a reviewer." />
            {courses.length === 0 ? (
              <p className="text-small text-ink-tertiary">This profile has no courses yet.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Course</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Price</TH>
                    <TH className="text-right">Enrolled</TH>
                  </TR>
                </THead>
                <TBody>
                  {courses.map((c) => (
                    <TR
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/review/${c.id}`)}
                    >
                      <TD className="font-semibold text-ink">{c.title}</TD>
                      <TD>
                        <Badge tone={statusTone[c.status]}>{statusLabel(c.status)}</Badge>
                      </TD>
                      <TD className="text-right font-mono">
                        {formatSgd(c.priceCents, { showFree: true })}
                      </TD>
                      <TD className="text-right font-mono">{c.enrolCount}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card as="section">
            <CardHeader title="Owner" description="The one person who holds this profile." />
            <DescriptionList
              items={[
                { label: 'Name', value: profile.owner.name ?? '—' },
                { label: 'Email', value: profile.owner.email },
              ]}
            />
            <Link
              to={`/people/${profile.owner.id}`}
              className="mt-3 inline-block text-small font-semibold text-brand hover:underline"
            >
              Open this person
            </Link>
          </Card>
          <Card as="section">
            <CardHeader
              title="Payout accounts"
              description="The Stripe accounts this profile is paid through."
            />
            {payoutAccounts.length === 0 ? (
              <p className="text-small text-ink-tertiary">
                None yet. The owner has not started Stripe onboarding, so the profile’s courses
                cannot be bought.
              </p>
            ) : (
              payoutAccounts.map((account) => (
                <DescriptionList
                  key={account.id}
                  items={[
                    {
                      label: 'Status',
                      value: (
                        <Badge tone={account.status === 'active' ? 'success' : 'warning'}>
                          {account.status === 'active' ? 'Active' : 'Onboarding'}
                        </Badge>
                      ),
                    },
                    {
                      label: 'Kind',
                      value: account.businessType === 'company' ? 'Company' : 'Individual',
                    },
                    {
                      label: 'Stripe account',
                      value: account.stripeAccountId ? (
                        <span className="font-mono text-caption">{account.stripeAccountId}</span>
                      ) : (
                        '—'
                      ),
                    },
                    { label: 'Charges', value: account.chargesEnabled ? 'Enabled' : 'Not enabled' },
                    { label: 'Payouts', value: account.payoutsEnabled ? 'Enabled' : 'Not enabled' },
                    { label: 'Active since', value: formatDate(account.activatedAt) },
                  ]}
                />
              ))
            )}
          </Card>
          <Card as="section">
            <CardHeader
              title="Commission"
              description="Platform share of each sale after Stripe fees."
            />
            <DescriptionList
              items={[{ label: 'Current', value: formatBps(profile.commissionBps) }]}
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
        </div>
      </div>

      <Dialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Approve this profile?"
        description="Its owner can connect Stripe and build courses straight away. They get an email."
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
        description="The reason is emailed to the owner. They can update the application and resubmit."
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
          label="Reason (sent to the owner)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          required
        />
      </Dialog>
    </>
  )
}
