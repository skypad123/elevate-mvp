import type { MediaAssetView } from '@elevate/core'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  formatBps,
  formatDate,
  Input,
  MediaUploader,
  PageHeader,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, fieldErrors, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { teachKeys } from '../lib/keys'
import { useCurrentProfile } from '../lib/profile'
import { StripeCard } from './dashboard'

export function SettingsPage() {
  const { user, refreshUser } = usePortalAuth()
  const { profile, profileId, can } = useCurrentProfile()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState({ displayName: '', headline: '', bio: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [upload, setUpload] = useState<MediaAssetView | null>(null)
  const canEdit = can('profile.edit')

  useEffect(() => {
    if (profile)
      setForm({
        displayName: profile.displayName,
        headline: profile.headline ?? '',
        bio: profile.bio ?? '',
      })
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
      toast({ tone: 'success', title: 'Profile saved' })
    } catch (error) {
      setErrors(fieldErrors(error))
      toast({ tone: 'danger', title: 'Could not save', description: errorMessage(error) })
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
      toast({ tone: 'success', title: asset ? 'Picture saved' : 'Picture removed' })
    } catch (error) {
      toast({ tone: 'danger', title: 'Could not save picture', description: errorMessage(error) })
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Your teaching profile"
        description="What learners see on your course pages."
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <form onSubmit={save}>
            <Card as="section" className="space-y-5">
              <Input
                label="Display name"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                error={errors.displayName}
                disabled={!canEdit}
                required
              />
              <Input
                label="Headline"
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                error={errors.headline}
                disabled={!canEdit}
                required
              />
              <Textarea
                label="Bio"
                rows={7}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                error={errors.bio}
                disabled={!canEdit}
                required
              />
              <div className="flex justify-end">
                <Button type="submit" loading={busy} disabled={!canEdit}>
                  Save changes
                </Button>
              </div>
            </Card>
          </form>
          <Card as="section" className="space-y-4">
            <CardHeader
              title="Profile picture"
              description="Shown beside your name on course pages. A square JPG, PNG or WebP works best."
            />
            <div className="flex items-center gap-4">
              <Avatar name={profile?.displayName} url={profile?.avatarUrl} size="lg" />
              {profile?.avatarMediaId && canEdit ? (
                <Button variant="ghost" size="sm" onClick={() => setAvatar(null)}>
                  Remove picture
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
              label={profile?.avatarMediaId ? 'Replace picture' : 'Upload a picture'}
            />
          </Card>
        </div>
        <div className="space-y-6">
          <StripeCard />
          <Card as="section">
            <CardHeader title="Account" />
            <DescriptionList
              items={[
                { label: 'Signed in as', value: user?.email },
                { label: 'Owner', value: profile?.owner.email },
                { label: 'Commission', value: profile ? formatBps(profile.commissionBps) : '—' },
                { label: 'Approved', value: formatDate(profile?.reviewedAt) },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  )
}
