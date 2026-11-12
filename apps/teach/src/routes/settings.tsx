import type { MediaAssetView } from '@elevate/core'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  Dialog,
  formatBps,
  Input,
  MediaUploader,
  PageHeader,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { fieldErrors, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { PreferencesCard, useErrorMessage, useFormatDate, useT } from '@elevate/web-ui/preferences'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'
import { teachKeys } from '../lib/keys'
import { useMemberActions } from '../lib/members'
import { useCurrentProfile } from '../lib/profile'
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
