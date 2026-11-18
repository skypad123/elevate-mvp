import type { MediaAssetView, PersonalApplication, ProfileView } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  focusFirstInvalid,
  Input,
  MediaUploader,
  Skeleton,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { fieldErrors, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { fillSlots, useErrorMessage, useT } from '@elevate/web-ui/preferences'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
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
  const t = useT()
  const errorMessage = useErrorMessage()
  if (personal?.status === 'approved') return <Navigate to={profilePath(personal.id)} replace />
  // Wait for the earlier answers before showing the form, so it opens filled in. If they cannot be
  // read, say so rather than opening an empty form that would replace them.
  if (personal && existing.isPending) return <Skeleton className="h-96 w-full" />
  if (personal && existing.isError)
    return (
      <EmptyState
        tone="danger"
        title={t('personalApply.loadFailed.title')}
        body={errorMessage(existing.error)}
        action={
          <Button variant="secondary" onClick={() => void existing.refetch()}>
            {t('common.tryAgain')}
          </Button>
        }
      />
    )
  return <ApplicationForm key={existing.data?.id ?? 'new'} existing={existing.data ?? null} />
}

function ApplicationForm({ existing }: { existing: ProfileView | null }) {
  const { user, refreshUser } = usePortalAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const errorMessage = useErrorMessage()
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
  const formRef = useRef<HTMLFormElement>(null)

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
        title: t('personalApply.sent.title'),
        description: t('personalApply.sent.description'),
      })
      // The profile's own page shows the application status until it is approved.
      navigate(profilePath(profile.id), { replace: true })
    } catch (error) {
      const fields = fieldErrors(error)
      setErrors(fields)
      focusFirstInvalid(formRef.current)
      if (Object.keys(fields).length === 0)
        toast({
          tone: 'danger',
          title: t('personalApply.submit.failed'),
          description: errorMessage(error),
        })
    } finally {
      setBusy(false)
    }
  }

  const isResubmission = existing?.status === 'rejected'

  return (
    <div className="space-y-8 animate-rise">
      <div className="space-y-3">
        <Eyebrow>
          {t(isResubmission ? 'personalApply.eyebrow.reapply' : 'personalApply.eyebrow.apply')}
        </Eyebrow>
        <h1 className="font-display text-display font-semibold leading-tight text-ink">
          {t('personalApply.title')}
        </h1>
        <p className="max-w-2xl text-body-lg text-ink-secondary">{t('personalApply.intro')}</p>
        {existing ? null : (
          <p className="text-small text-ink-secondary">
            {fillSlots(t('personalApply.companyInstead'), {
              link: (
                <Link to="/apply/company" className="font-semibold text-brand-fg hover:underline">
                  {t('personalApply.companyInstead.link')}
                </Link>
              ),
            })}
          </p>
        )}
        {isResubmission && existing?.reviewNote ? (
          <div className="rounded-card border border-warning bg-warning-tint p-4 text-small text-ink">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <Badge tone="warning">{t('personalApply.reviewerNote')}</Badge>
            </p>
            {existing.reviewNote}
          </div>
        ) : null}
      </div>

      <form ref={formRef} onSubmit={submit} className="space-y-6">
        <Card as="section" className="space-y-5">
          <h2 className="font-display text-h2 font-semibold text-ink">
            {t('personalApply.about.title')}
          </h2>
          <Input
            label={t('profileField.displayName')}
            hint={t('personalApply.displayName.hint')}
            value={form.displayName}
            onChange={set('displayName')}
            error={errors.displayName}
            required
            maxLength={80}
          />
          <Input
            label={t('profileField.headline')}
            hint={t('personalApply.headline.hint')}
            value={form.headline}
            onChange={set('headline')}
            error={errors.headline}
            required
            maxLength={120}
          />
          <Textarea
            label={t('profileField.bio')}
            hint={t('personalApply.bio.hint')}
            value={form.bio}
            onChange={set('bio')}
            error={errors.bio}
            required
            rows={6}
          />
        </Card>

        <Card as="section" className="space-y-5">
          <h2 className="font-display text-h2 font-semibold text-ink">
            {t('personalApply.experience.title')}
          </h2>
          <Textarea
            label={t('personalApply.credentials')}
            hint={t('personalApply.credentials.hint')}
            value={form.credentials}
            onChange={set('credentials')}
            error={errors.credentials}
            required
            rows={5}
          />
        </Card>

        <Card as="section" className="space-y-5">
          <div>
            <h2 className="font-display text-h2 font-semibold text-ink">
              {t('personalApply.sample.title')}
            </h2>
            <p className="mt-1 text-small text-ink-secondary">{t('personalApply.sample.intro')}</p>
          </div>
          <MediaUploader
            api={api}
            kind="video"
            value={sample}
            onChange={setSample}
            label={t('personalApply.sample.upload')}
            hint={t('personalApply.sample.upload.hint')}
          />
          {existing?.teachingSampleMediaId && !sample ? (
            <p className="text-small text-ink-tertiary">{t('personalApply.sample.kept')}</p>
          ) : null}
          <Input
            label={t('personalApply.sample.link')}
            placeholder={t('personalApply.sample.link.placeholder')}
            value={form.teachingSampleUrl ?? ''}
            onChange={set('teachingSampleUrl')}
            error={errors.teachingSampleUrl}
            type="url"
          />
        </Card>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-ink-tertiary">{t('personalApply.agreement')}</p>
          <Button
            type="submit"
            variant="accent"
            size="lg"
            loading={busy}
            iconRight={ArrowRight}
            className="shrink-0"
          >
            {t(isResubmission ? 'personalApply.submit.reapply' : 'personalApply.submit.apply')}
          </Button>
        </div>
      </form>
    </div>
  )
}
