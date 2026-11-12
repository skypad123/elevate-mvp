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
  Input,
  MediaPreview,
  PageHeader,
  Skeleton,
  StatCard,
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
import { unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { useErrorMessage, useFormatDate, useT } from '@elevate/web-ui/preferences'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../lib/api'
import { profileKeys, useProfile } from '../lib/queries'
import { teachUrl } from '../lib/urls'
import { CompanyCard, NameCheckCard } from './profile-company'
import { OwnerRecovery } from './profile-recovery'

export function Profile() {
  const t = useT()
  const errorMessage = useErrorMessage()
  const { id = '' } = useParams()
  const query = useProfile(id)
  if (query.isPending) return <Skeleton className="h-64 w-full" />
  if (query.isError)
    return (
      <EmptyState
        tone="danger"
        title={t('profileDetail.loadError')}
        body={errorMessage(query.error)}
      />
    )
  return <ProfileView detail={query.data} />
}

/**
 * One teaching profile: its application, owner, courses, payout accounts and earnings. A corporate
 * profile also shows the company behind it and the legal-name check on its Stripe account.
 */
function ProfileView({ detail }: { detail: SupportProfileDetail }) {
  const { profile, courses, payoutAccounts, legalEntity, earnings } = detail
  const t = useT()
  const errorMessage = useErrorMessage()
  const formatDate = useFormatDate()
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

  /** Runs one action on the profile; `done` is the title of the toast when it succeeds. */
  async function act(done: string, fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      // The lists show status and commission too, and a person lists their profiles' status.
      await queryClient.invalidateQueries({ queryKey: profileKeys.all })
      await queryClient.invalidateQueries({ queryKey: ['support', 'people'] })
      await queryClient.invalidateQueries({ queryKey: ['support', 'person'] })
      toast({ tone: 'success', title: done })
      setDialog(null)
      setNote('')
    } catch (error) {
      toast({ tone: 'danger', title: t('common.actionFailed'), description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const param = { id: profile.id }
  const approve = () =>
    act(t('profileDetail.approve.done'), async () =>
      unwrap(
        await api.support.profiles[':id'].approve.$post({
          param,
          json: note.trim() ? { note: note.trim() } : {},
        }),
      ),
    )
  const reject = () =>
    act(t('profileDetail.reject.done'), async () =>
      unwrap(
        await api.support.profiles[':id'].reject.$post({ param, json: { reason: note.trim() } }),
      ),
    )
  const saveCommission = () =>
    act(t('profileDetail.commission.updated'), async () => {
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
        <ArrowLeft className="size-4" /> {t('profileDetail.back')}
      </Link>
      <PageHeader
        eyebrow={t(`profileDetail.eyebrow.${profile.type}`)}
        title={profile.displayName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t('profileDetail.ownedBy', { email: profile.owner.email })}</span>
            <Badge tone={statusTone[profile.status]}>{t(`status.profile.${profile.status}`)}</Badge>
          </span>
        }
        actions={
          <>
            {isSuperAdmin ? (
              // A super admin opening the profile in Teach acts as staff there: Teach says so in
              // a banner, and every change is recorded under their own name.
              <a href={teachUrl(`/p/${profile.id}`)} target="_blank" rel="noreferrer">
                <Button variant="secondary" icon={ExternalLink}>
                  {t('profileDetail.openInTeach')}
                </Button>
              </a>
            ) : null}
            {profile.status !== 'approved' ? (
              <>
                <Button variant="secondary" icon={X} onClick={() => setDialog('reject')}>
                  {t('profileDetail.reject')}
                </Button>
                <Button icon={Check} onClick={() => setDialog('approve')}>
                  {t('profileDetail.approve')}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-4">
        <StatCard
          label={t('profileDetail.stat.courses')}
          value={courses.length}
          hint={t('profileDetail.stat.courses.live', { count: liveCourses })}
        />
        <StatCard
          label={t('profileDetail.stat.sales')}
          value={earnings.paymentCount}
          hint={t('profileDetail.stat.sales.hint')}
        />
        <StatCard
          label={t('profileDetail.stat.netEarnings')}
          value={formatSgd(earnings.netCents)}
          hint={t('profileDetail.stat.netEarnings.hint')}
        />
        <StatCard label={t('profileDetail.stat.applied')} value={formatDate(profile.appliedAt)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {legalEntity ? (
            <>
              <CompanyCard entity={legalEntity} />
              {profile.status === 'approved' ? (
                <NameCheckCard profileId={profile.id} account={payoutAccounts[0]} />
              ) : null}
            </>
          ) : null}
          <Card as="section">
            <CardHeader
              title={t('profileDetail.application.title')}
              description={
                profile.reviewedAt
                  ? t('profileDetail.application.appliedReviewed', {
                      applied: formatDate(profile.appliedAt),
                      reviewed: formatDate(profile.reviewedAt),
                    })
                  : t('profileDetail.application.applied', {
                      applied: formatDate(profile.appliedAt),
                    })
              }
            />
            <DescriptionList
              items={[
                { label: t('profileField.headline'), value: profile.headline },
                {
                  label: t('profileField.bio'),
                  value: <p className="whitespace-pre-wrap">{profile.bio}</p>,
                },
                {
                  label: t('profileDetail.application.credentials'),
                  value: <p className="whitespace-pre-wrap">{profile.credentials}</p>,
                },
                ...(profile.reviewNote
                  ? [
                      {
                        label: t('profileDetail.application.reviewNote'),
                        value: profile.reviewNote,
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
          <Card as="section">
            <CardHeader title={t('profileDetail.sample.title')} />
            {profile.teachingSampleMediaId ? (
              <MediaPreview api={api} assetId={profile.teachingSampleMediaId} />
            ) : null}
            {profile.teachingSampleUrl ? (
              <a
                href={profile.teachingSampleUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-small font-semibold text-brand-fg hover:underline"
              >
                {profile.teachingSampleUrl} <ExternalLink className="size-3.5" />
              </a>
            ) : null}
            {!profile.teachingSampleMediaId && !profile.teachingSampleUrl ? (
              <p className="text-small text-ink-tertiary">{t('profileDetail.sample.none')}</p>
            ) : null}
          </Card>
          <Card as="section">
            <CardHeader
              title={t('profileDetail.courses.title')}
              description={t('profileDetail.courses.description')}
            />
            {courses.length === 0 ? (
              <p className="text-small text-ink-tertiary">{t('profileDetail.courses.empty')}</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{t('profileDetail.courses.column.course')}</TH>
                    <TH>{t('common.status')}</TH>
                    <TH className="text-right">{t('profileDetail.courses.column.price')}</TH>
                    <TH className="text-right">{t('profileDetail.courses.column.enrolled')}</TH>
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
                        <Badge tone={statusTone[c.status]}>{t(`status.course.${c.status}`)}</Badge>
                      </TD>
                      <TD className="text-right font-mono">
                        {/* formatSgd's own "Free" is English, so a zero price is worded here. */}
                        {c.priceCents === 0 ? t('common.free') : formatSgd(c.priceCents)}
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
            <CardHeader
              title={t('profileDetail.owner.title')}
              description={t('profileDetail.owner.description')}
            />
            <DescriptionList
              items={[
                { label: t('common.name'), value: profile.owner.name ?? '—' },
                { label: t('common.email'), value: profile.owner.email },
              ]}
            />
            <Link
              to={`/people/${profile.owner.id}`}
              className="mt-3 block text-small font-semibold text-brand-fg hover:underline"
            >
              {t('profileDetail.owner.open')}
            </Link>
            {isSuperAdmin ? (
              <OwnerRecovery detail={detail} />
            ) : (
              <p className="mt-3 text-caption text-ink-tertiary">
                {t('profileDetail.owner.recoveryNote')}
              </p>
            )}
          </Card>
          <Card as="section">
            <CardHeader
              title={t('profileDetail.payout.title')}
              description={t('profileDetail.payout.description')}
            />
            {payoutAccounts.length === 0 ? (
              <p className="text-small text-ink-tertiary">
                {legalEntity
                  ? t('profileDetail.payout.none.corporate')
                  : t('profileDetail.payout.none.personal')}
              </p>
            ) : (
              payoutAccounts.map((account) => (
                <DescriptionList
                  key={account.id}
                  items={[
                    {
                      label: t('common.status'),
                      value: (
                        <Badge tone={account.status === 'active' ? 'success' : 'warning'}>
                          {t(`status.payout.${account.status}`)}
                        </Badge>
                      ),
                    },
                    {
                      label: t('profileDetail.payout.kind'),
                      value: t(`profileDetail.payout.kind.${account.businessType}`),
                    },
                    {
                      label: t('stripe.account'),
                      value: account.stripeAccountId ? (
                        <span className="font-mono text-caption">{account.stripeAccountId}</span>
                      ) : (
                        '—'
                      ),
                    },
                    {
                      label: t('profileDetail.payout.charges'),
                      value: account.chargesEnabled
                        ? t('profileDetail.payout.enabled')
                        : t('profileDetail.payout.notEnabled'),
                    },
                    {
                      label: t('profileDetail.payout.payouts'),
                      value: account.payoutsEnabled
                        ? t('profileDetail.payout.enabled')
                        : t('profileDetail.payout.notEnabled'),
                    },
                    // A company account also needs the legal-name check before it is active.
                    ...(account.businessType === 'company'
                      ? [
                          {
                            label: t('company.legalName'),
                            value: account.nameVerifiedAt
                              ? t('profileDetail.payout.legalName.matched', {
                                  date: formatDate(account.nameVerifiedAt),
                                })
                              : t('profileDetail.payout.legalName.notChecked'),
                          },
                        ]
                      : []),
                    {
                      label:
                        account.status === 'active'
                          ? t('profileDetail.payout.activeSince')
                          : t('profileDetail.payout.firstActive'),
                      value: formatDate(account.activatedAt),
                    },
                  ]}
                />
              ))
            )}
          </Card>
          <Card as="section">
            <CardHeader
              title={t('profileDetail.commission.title')}
              description={t('profileDetail.commission.description')}
            />
            <DescriptionList
              items={[
                {
                  label: t('profileDetail.commission.current'),
                  value: formatBps(profile.commissionBps),
                },
              ]}
            />
            {isSuperAdmin ? (
              <div className="mt-4 flex items-end gap-2">
                <Input
                  label={t('profileDetail.commission.newRate')}
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  wrapperClassName="w-32"
                />
                <Button variant="secondary" loading={busy} onClick={saveCommission}>
                  {t('common.save')}
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-caption text-ink-tertiary">
                {t('profileDetail.commission.superAdminOnly')}
              </p>
            )}
          </Card>
        </div>
      </div>

      <Dialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t('profileDetail.approve.title')}
        description={
          legalEntity
            ? t('profileDetail.approve.description.corporate', {
                legalName: legalEntity.legalName,
                uen: legalEntity.uen,
              })
            : t('profileDetail.approve.description.personal')
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button loading={busy} onClick={approve}>
              {t('profileDetail.approve')}
            </Button>
          </>
        }
      >
        <Textarea
          label={t('profileDetail.approve.note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </Dialog>
      <Dialog
        open={dialog === 'reject'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t('profileDetail.reject.title')}
        description={t('profileDetail.reject.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={note.trim().length < 10}
              onClick={reject}
            >
              {t('profileDetail.reject')}
            </Button>
          </>
        }
      >
        <Textarea
          label={t('profileDetail.reject.reason')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          required
        />
      </Dialog>
    </>
  )
}
