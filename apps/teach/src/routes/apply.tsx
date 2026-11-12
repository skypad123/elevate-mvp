import type { MediaAssetView, PersonalApplication, ProfileView } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  Eyebrow,
  Input,
  MediaUploader,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, fieldErrors, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { api } from '../lib/api'
import { teachKeys } from '../lib/keys'
import { useProfileView } from '../lib/profile'
import { profilePath } from '../lib/urls'

/**
 * The application for a personal profile: one person teaching under their own name. A person has
 * one, so this page creates it, or reopens it while it is still under review or was rejected.
 */
export function ApplyPage() {
  const { user } = usePortalAuth()
  const personal = user?.profiles.find((p) => p.type === 'personal' && p.role === 'owner')
  const existing = useProfileView(personal?.id)
  if (personal?.status === 'approved') return <Navigate to={profilePath(personal.id)} replace />
  // Wait for the earlier answers before showing the form, so it opens filled in.
  if (personal && existing.isPending) return null
  return <ApplicationForm key={existing.data?.id ?? 'new'} existing={existing.data ?? null} />
}

function ApplicationForm({ existing }: { existing: ProfileView | null }) {
  const { user, refreshUser } = usePortalAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<PersonalApplication>({
    displayName: existing?.displayName ?? user?.name ?? '',
    headline: existing?.headline ?? '',
    bio: existing?.bio ?? '',
    credentials: existing?.credentials ?? '',
    teachingSampleUrl: existing?.teachingSampleUrl ?? undefined,
    teachingSampleMediaId: existing?.teachingSampleMediaId ?? undefined,
  })
  const [sample, setSample] = useState<MediaAssetView | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const set = (key: keyof PersonalApplication) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const body: PersonalApplication = {
        ...form,
        teachingSampleUrl: form.teachingSampleUrl?.trim()
          ? form.teachingSampleUrl.trim()
          : undefined,
        teachingSampleMediaId: sample?.id ?? form.teachingSampleMediaId,
      }
      const { profile } = await unwrap(await api.teach.apply.$post({ json: body }))
      queryClient.setQueryData(teachKeys.profile(profile.id), profile)
      await refreshUser()
      toast({
        tone: 'success',
        title: 'Application sent',
        description: 'We will email you when it has been reviewed.',
      })
      // The profile's own page shows the application status until it is approved.
      navigate(profilePath(profile.id), { replace: true })
    } catch (error) {
      const fields = fieldErrors(error)
      setErrors(fields)
      if (Object.keys(fields).length === 0)
        toast({ tone: 'danger', title: 'Could not submit', description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const isResubmission = existing?.status === 'rejected'

  return (
    <div className="space-y-8 animate-rise">
      <div className="space-y-3">
        <Eyebrow>{isResubmission ? 'Update your application' : 'Become a teacher'}</Eyebrow>
        <h1 className="font-display text-display font-semibold leading-tight text-ink">
          Teach what you practise.
        </h1>
        <p className="max-w-2xl text-body-lg text-ink-secondary">
          Elevate is a small, curated platform. Tell us who you are, what you teach and show us a
          few minutes of you teaching. A human reviews every application, usually within two working
          days.
        </p>
        {isResubmission && existing?.reviewNote ? (
          <div className="rounded-card border border-warning bg-warning-tint p-4 text-small text-ink">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <Badge tone="warning">Reviewer note</Badge>
            </p>
            {existing.reviewNote}
          </div>
        ) : null}
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card as="section" className="space-y-5">
          <h2 className="font-display text-h2 font-semibold text-ink">About you</h2>
          <Input
            label="Display name"
            hint="Shown on your courses and certificates."
            value={form.displayName}
            onChange={set('displayName')}
            error={errors.displayName}
            required
            maxLength={80}
          />
          <Input
            label="Headline"
            hint="One line, e.g. “Ceramicist and studio teacher, Jalan Bahar”."
            value={form.headline}
            onChange={set('headline')}
            error={errors.headline}
            required
            maxLength={120}
          />
          <Textarea
            label="Bio"
            hint="50–3000 characters. Learners read this on your course pages."
            value={form.bio}
            onChange={set('bio')}
            error={errors.bio}
            required
            rows={6}
          />
        </Card>

        <Card as="section" className="space-y-5">
          <h2 className="font-display text-h2 font-semibold text-ink">
            Credentials and experience
          </h2>
          <Textarea
            label="Credentials"
            hint="Qualifications, years of practice, where you have taught."
            value={form.credentials}
            onChange={set('credentials')}
            error={errors.credentials}
            required
            rows={5}
          />
        </Card>

        <Card as="section" className="space-y-5">
          <div>
            <h2 className="font-display text-h2 font-semibold text-ink">Teaching sample</h2>
            <p className="mt-1 text-small text-ink-secondary">
              Upload a short video of you teaching, or paste a link to one. Either is fine.
            </p>
          </div>
          <MediaUploader
            api={api}
            kind="video"
            value={sample}
            onChange={setSample}
            label="Upload a video"
            hint="MP4 or MOV, up to a few minutes"
          />
          <Input
            label="Or a link"
            placeholder="https://youtube.com/…"
            value={form.teachingSampleUrl ?? ''}
            onChange={set('teachingSampleUrl')}
            error={errors.teachingSampleUrl}
            type="url"
          />
        </Card>

        <div className="flex items-center justify-between gap-4">
          <p className="text-small text-ink-tertiary">
            By applying you agree to the teacher agreement: you own your content; Elevate holds a
            non-exclusive hosting licence while it is listed.
          </p>
          <Button type="submit" variant="accent" size="lg" loading={busy} iconRight={ArrowRight}>
            {isResubmission ? 'Resubmit' : 'Submit application'}
          </Button>
        </div>
      </form>
    </div>
  )
}
