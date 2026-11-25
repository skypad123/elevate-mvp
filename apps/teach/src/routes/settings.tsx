import { CLASS_SALES_TERMS_VERSION, type MediaAssetView } from '@elevate/core'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  Dialog,
  formatBps,
  Input,
  MediaUploader,
  PageHeader,
  Skeleton,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { ApiError, fieldErrors, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import {
  type MessageKey,
  PreferencesCard,
  useErrorMessage,
  useFormatDate,
  useT,
} from '@elevate/web-ui/preferences'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'
import { useClassActions, useClassSales } from '../lib/classes'
import { teachKeys } from '../lib/keys'
import { useMemberActions } from '../lib/members'
import { useCurrentProfile } from '../lib/profile'
import { useSignInAgain } from '../lib/queries'
import { StripeCard } from './dashboard'

/** For a manager or writer: what their role is, and the way out. The owner cannot leave. */
function MembershipCard() {
  const { role, displayName } = useCurrentProfile()
  const { refreshUser } = usePortalAuth()
  const actions = useMemberActions()
  const navigate = useNavigate()
  const { toast } = useToast()
  const t = useT()
  const errorMessage = useErrorMessage()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  if (role !== 'manager' && role !== 'writer') return null

  async function leave() {
    setBusy(true)
    try {
      await actions.leave()
      // The profile is gone from the user's list once the session is read again.
      await refreshUser()
      toast({ tone: 'success', title: t('membership.leave.done', { name: displayName }) })
      // The home page opens another profile, or the start page, which says they left this one.
      navigate('/', { replace: true, state: { left: displayName } })
    } catch (error) {
      toast({
        tone: 'danger',
        title: t('membership.leave.failed'),
        description: errorMessage(error),
      })
      setBusy(false)
    }
  }

  return (
    <Card as="section" className="space-y-3">
      <CardHeader
        title={t('membership.yourRole', { role: t(`profileRole.${role}`) })}
        description={t(`profileRole.${role}.summary`)}
      />
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        {t('membership.leave')}
      </Button>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('membership.leave.title', { name: displayName })}
        description={t('membership.leave.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('membership.leave.stay')}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void leave()}>
              {t('membership.leave.confirm')}
            </Button>
          </>
        }
      />
    </Card>
  )
}

/** One numbered held-payout term: an optional bold lead, the text, and a list for 15 and 24. */
type Term = {
  n: number
  lead?: MessageKey
  text: MessageKey
  items?: MessageKey[]
  after?: MessageKey
}

/**
 * The held-payout terms, in the order and with the numbers of docs/terms/held-payout-terms.md,
 * which is their source. The catalog follows that file.
 */
const TERMS: { heading: MessageKey; intro?: MessageKey; terms: Term[] }[] = [
  {
    heading: 'classSales.terms.accepting',
    terms: [
      { n: 1, text: 'classSales.term.1' },
      { n: 2, text: 'classSales.term.2' },
      { n: 3, text: 'classSales.term.3' },
    ],
  },
  {
    heading: 'classSales.terms.leaving',
    terms: [
      { n: 4, text: 'classSales.term.4' },
      { n: 5, text: 'classSales.term.5' },
    ],
  },
  {
    heading: 'classSales.terms.paid',
    terms: [
      { n: 6, text: 'classSales.term.6' },
      { n: 7, text: 'classSales.term.7' },
      { n: 8, text: 'classSales.term.8' },
      { n: 9, text: 'classSales.term.9' },
    ],
  },
  {
    heading: 'classSales.terms.held',
    terms: [
      { n: 10, text: 'classSales.term.10' },
      { n: 11, text: 'classSales.term.11' },
      { n: 12, text: 'classSales.term.12' },
      { n: 13, text: 'classSales.term.13' },
      { n: 14, text: 'classSales.term.14' },
    ],
  },
  {
    heading: 'classSales.terms.fee',
    terms: [
      {
        n: 15,
        text: 'classSales.term.15',
        items: ['classSales.term.15.commission', 'classSales.term.15.estimate'],
        after: 'classSales.term.15.note',
      },
    ],
  },
  {
    heading: 'classSales.terms.refunds',
    intro: 'classSales.terms.refunds.intro',
    terms: [
      { n: 16, lead: 'classSales.term.16.lead', text: 'classSales.term.16' },
      { n: 17, lead: 'classSales.term.17.lead', text: 'classSales.term.17' },
      { n: 18, lead: 'classSales.term.18.lead', text: 'classSales.term.18' },
      { n: 19, lead: 'classSales.term.19.lead', text: 'classSales.term.19' },
      { n: 20, text: 'classSales.term.20' },
      { n: 21, text: 'classSales.term.21' },
      { n: 22, lead: 'classSales.term.22.lead', text: 'classSales.term.22' },
      { n: 23, lead: 'classSales.term.23.lead', text: 'classSales.term.23' },
    ],
  },
  {
    heading: 'classSales.terms.elevateCancels',
    terms: [
      {
        n: 24,
        text: 'classSales.term.24',
        items: [
          'classSales.term.24.absent',
          'classSales.term.24.venue',
          'classSales.term.24.rules',
          'classSales.term.24.suspended',
          'classSales.term.24.law',
        ],
      },
      { n: 25, text: 'classSales.term.25' },
      { n: 26, text: 'classSales.term.26' },
    ],
  },
  {
    heading: 'classSales.terms.attended',
    terms: [
      { n: 27, text: 'classSales.term.27' },
      { n: 28, text: 'classSales.term.28' },
    ],
  },
  {
    heading: 'classSales.terms.disputes',
    terms: [
      { n: 29, text: 'classSales.term.29' },
      { n: 30, text: 'classSales.term.30' },
    ],
  },
  {
    heading: 'classSales.terms.owe',
    terms: [
      { n: 31, text: 'classSales.term.31' },
      { n: 32, text: 'classSales.term.32' },
    ],
  },
]

/** The held-payout terms as the owner reads them before accepting. */
function HeldPayoutTerms({ version }: { version: string }) {
  const t = useT()
  return (
    <div className="max-h-[28rem] space-y-4 overflow-y-auto rounded-control border border-border bg-surface-muted px-4 py-3 text-small text-ink">
      <div>
        <h3 className="font-semibold text-ink">{t('classSales.terms.title')}</h3>
        <p className="text-caption text-ink-tertiary">
          {t('classSales.terms.version', { version })}
        </p>
      </div>
      <p>{t('classSales.terms.intro')}</p>
      {TERMS.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h4 className="font-semibold text-ink">{t(section.heading)}</h4>
          {section.intro ? <p>{t(section.intro)}</p> : null}
          <ol start={section.terms[0]?.n} className="list-decimal space-y-2 pl-6">
            {section.terms.map((term) => (
              <li key={term.n} value={term.n}>
                {term.lead ? <strong className="font-semibold">{t(term.lead)} </strong> : null}
                {t(term.text)}
                {term.items ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {term.items.map((item) => (
                      <li key={item}>{t(item)}</li>
                    ))}
                  </ul>
                ) : null}
                {term.after ? <p className="mt-1">{t(term.after)}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

/**
 * Class sales, for the owner of a profile that has classes on: the held-payout terms and the
 * accept action; while Stripe is being switched, "Finishing set-up"; once accepted, the date and
 * the way to give notice; after notice, the leave date. Accepting and leaving need a sign-in
 * from the last 24 hours, handled as the Stripe link buttons handle it.
 */
function ClassSalesCard() {
  const { profile, can } = useCurrentProfile()
  const show = can('stripe.links') && !!profile?.classesEnabled
  const sales = useClassSales(show)
  const actions = useClassActions()
  const signInAgain = useSignInAgain()
  const { toast } = useToast()
  const t = useT()
  const errorMessage = useErrorMessage()
  const formatDate = useFormatDate()
  const [busy, setBusy] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  if (!show) return null

  const status = sales.data
  const mode = status?.payoutMode ?? null
  const leaving = mode === 'manual' && !!status?.leaveRequestedAt
  const state: 'off' | 'switching' | 'on' | 'leaving' =
    mode === 'switching' ? 'switching' : leaving ? 'leaving' : mode === 'manual' ? 'on' : 'off'
  const badgeTone = {
    off: 'neutral',
    switching: 'warning',
    on: 'success',
    leaving: 'warning',
  } as const

  async function accept() {
    setBusy(true)
    try {
      const next = await actions.acceptClassSales()
      toast({
        tone: 'success',
        title:
          next.payoutMode === 'manual'
            ? t('classSales.accept.done')
            : t('classSales.accept.switching'),
      })
    } catch (error) {
      if (!signInAgain(error)) {
        const code = error instanceof ApiError ? error.code : ''
        toast({
          tone: 'danger',
          title: t('classSales.accept.failed'),
          description:
            code === 'terms_version'
              ? t('classSales.accept.termsChanged')
              : code === 'not_payable'
                ? t('classSales.notPayable')
                : errorMessage(error),
        })
        // Someone else may have opted in or out meanwhile.
        void sales.refetch()
      }
    } finally {
      setBusy(false)
    }
  }

  async function leave() {
    setBusy(true)
    try {
      await actions.leaveClassSales()
      toast({ tone: 'success', title: t('classSales.leave.done') })
      setConfirmLeave(false)
    } catch (error) {
      if (!signInAgain(error)) {
        toast({
          tone: 'danger',
          title: t('classSales.leave.failed'),
          description: errorMessage(error),
        })
        void sales.refetch()
      }
    } finally {
      setBusy(false)
    }
  }

  const version = status?.currentTermsVersion ?? CLASS_SALES_TERMS_VERSION
  return (
    <Card as="section" className="space-y-4">
      <CardHeader
        title={t('classSales.title')}
        description={t('classSales.description')}
        action={
          status ? (
            <Badge tone={badgeTone[state]}>{t(`classSales.badge.${state}`)}</Badge>
          ) : undefined
        }
      />
      {sales.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : sales.isError || !status ? (
        <p className="text-small text-danger">{t('classSales.loadFailed')}</p>
      ) : state === 'switching' ? (
        <p className="text-small text-ink-secondary">{t('classSales.switching')}</p>
      ) : state === 'leaving' ? (
        <p className="text-small text-ink-secondary">
          {t('classSales.leaving', {
            requested: formatDate(status.leaveRequestedAt),
            leaveOn: formatDate(status.leaveOn),
          })}
        </p>
      ) : state === 'on' ? (
        <>
          <p className="text-small text-ink-secondary">
            {t('classSales.accepted', {
              version: status.termsVersion ?? version,
              date: formatDate(status.acceptedAt),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowTerms((v) => !v)}>
              {showTerms ? t('classSales.terms.hide') : t('classSales.terms.show')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmLeave(true)}>
              {t('classSales.leave')}
            </Button>
          </div>
          {showTerms ? <HeldPayoutTerms version={status.termsVersion ?? version} /> : null}
        </>
      ) : (
        <>
          {status.acceptedAt ? (
            <p className="text-small text-ink-secondary">{t('classSales.leftBefore')}</p>
          ) : null}
          <HeldPayoutTerms version={version} />
          {status.payable ? (
            <div className="flex justify-end">
              <Button loading={busy} onClick={() => void accept()}>
                {t('classSales.accept')}
              </Button>
            </div>
          ) : (
            <p className="rounded-control bg-surface-muted px-3 py-2 text-small text-ink-secondary">
              {t('classSales.notPayable')}
            </p>
          )}
        </>
      )}
      <Dialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={t('classSales.leave.title')}
        description={t('classSales.leave.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
              {t('classSales.leave.keep')}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void leave()}>
              {t('classSales.leave.confirm')}
            </Button>
          </>
        }
      />
    </Card>
  )
}

export function SettingsPage() {
  const { user, refreshUser } = usePortalAuth()
  const { profile, profileId, can } = useCurrentProfile()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const errorMessage = useErrorMessage()
  const formatDate = useFormatDate()
  const [form, setForm] = useState({ displayName: '', headline: '', bio: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [upload, setUpload] = useState<MediaAssetView | null>(null)
  const canEdit = can('profile.edit')

  // Fill the form once per profile. Saving the picture puts a new profile in the cache, and
  // refilling then would throw away whatever is being typed in the text fields.
  const filledFor = useRef<string | null>(null)
  useEffect(() => {
    if (profile && filledFor.current !== profile.id) {
      filledFor.current = profile.id
      setForm({
        displayName: profile.displayName,
        headline: profile.headline ?? '',
        bio: profile.bio ?? '',
      })
    }
  }, [profile])

  /** Sends a change to the profile and puts the answer in the cache every screen reads from. */
  async function patch(json: {
    displayName?: string
    headline?: string
    bio?: string
    avatarMediaId?: string | null
  }) {
    const { profile: saved } = await unwrap(
      await api.teach.profiles[':profileId'].profile.$patch({ param: { profileId }, json }),
    )
    queryClient.setQueryData(teachKeys.profile(profileId), saved)
    // The name in the user's own profile list comes from the session.
    await refreshUser()
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await patch(form)
      toast({ tone: 'success', title: t('settings.teach.saved') })
    } catch (error) {
      setErrors(fieldErrors(error))
      toast({
        tone: 'danger',
        title: t('settings.teach.saveFailed'),
        description: errorMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }

  async function setAvatar(asset: MediaAssetView | null) {
    setUpload(asset)
    // An upload that is still processing calls back again when it is ready.
    if (asset && asset.status !== 'ready') return
    try {
      await patch({ avatarMediaId: asset?.id ?? null })
      setUpload(null)
      toast({
        tone: 'success',
        title: asset ? t('settings.teach.picture.saved') : t('settings.teach.picture.removed'),
      })
    } catch (error) {
      toast({
        tone: 'danger',
        title: t('settings.teach.picture.saveFailed'),
        description: errorMessage(error),
      })
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.teach.title')}
        description={t('settings.teach.description')}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <form onSubmit={save}>
            <Card as="section" className="space-y-5">
              {canEdit ? null : (
                <p className="rounded-control bg-surface-muted px-3 py-2 text-small text-ink-secondary">
                  {t('settings.teach.readOnly')}
                </p>
              )}
              <Input
                label={t('profileField.displayName')}
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                error={errors.displayName}
                disabled={!canEdit}
                required
              />
              <Input
                label={t('profileField.headline')}
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                error={errors.headline}
                disabled={!canEdit}
                required
              />
              <Textarea
                label={t('profileField.bio')}
                rows={7}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                error={errors.bio}
                disabled={!canEdit}
                required
              />
              {canEdit ? (
                <div className="flex justify-end">
                  <Button type="submit" loading={busy}>
                    {t('settings.teach.save')}
                  </Button>
                </div>
              ) : null}
            </Card>
          </form>
          <Card as="section" className="space-y-4">
            <CardHeader
              title={t('settings.teach.picture')}
              description={t('settings.teach.picture.description')}
            />
            <div className="flex items-center gap-4">
              <Avatar name={profile?.displayName} url={profile?.avatarUrl} size="lg" />
              {profile?.avatarMediaId && canEdit ? (
                <Button variant="ghost" size="sm" onClick={() => setAvatar(null)}>
                  {t('settings.teach.picture.remove')}
                </Button>
              ) : null}
            </div>
            <MediaUploader
              api={api}
              profileId={profileId}
              kind="image"
              value={upload}
              disabled={!canEdit}
              onChange={setAvatar}
              label={
                profile?.avatarMediaId
                  ? t('settings.teach.picture.replace')
                  : t('settings.teach.picture.upload')
              }
            />
          </Card>
          <ClassSalesCard />
        </div>
        <div className="space-y-6">
          <PreferencesCard />
          <StripeCard />
          <MembershipCard />
          <Card as="section">
            <CardHeader title={t('account.title')} />
            <DescriptionList
              items={[
                { label: t('account.signedInAs'), value: user?.email },
                { label: t('account.owner'), value: profile?.owner.email },
                {
                  label: t('account.commission'),
                  value: profile ? formatBps(profile.commissionBps) : '—',
                },
                { label: t('account.approved'), value: formatDate(profile?.reviewedAt) },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  )
}
