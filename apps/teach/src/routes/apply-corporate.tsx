import {
  type CorporateApplicationInput,
  ENTITY_TYPES,
  type EntityType,
  isValidUen,
  type MediaAssetView,
  normaliseUen,
  type ProfileView,
  UEN_EXAMPLE,
} from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Input,
  MediaUploader,
  NativeSelect,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { fieldErrors, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { fillSlots, useErrorMessage, useT } from '@elevate/web-ui/preferences'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { api } from '../lib/api'
import { teachKeys } from '../lib/keys'
import { useCurrentProfile } from '../lib/profile'
import { profilePath } from '../lib/urls'

/** `/apply/company`: a registered company applies for a corporate profile. */
export function CorporateApplyPage() {
  return <CompanyApplicationForm existing={null} />
}

/**
 * `/p/:profileId/apply`: the owner of a company profile that is not approved edits its application
 * and sends it again. It goes back to the review queue.
 */
export function CorporateReapplyPage() {
  const { profile, profileId, role, type, status, path } = useCurrentProfile()
  const t = useT()
  if (type !== 'corporate') return <Navigate to="/apply" replace />
  if (status === 'approved') return <Navigate to={path()} replace />
  if (!profile) return null
  if (role !== 'owner')
    return (
      <EmptyState
        title={t('companyApply.ownerOnly.title')}
        body={t('companyApply.ownerOnly.body')}
        action={
          <Link to={path()}>
            <Button variant="secondary">{t('common.back')}</Button>
          </Link>
        }
      />
    )
  return <CompanyApplicationForm key={profileId} existing={profile} />
}

type Fields = {
  uen: string
  legalName: string
  entityType: EntityType
  displayName: string
  headline: string
  bio: string
  credentials: string
  teachingSampleUrl: string
}

function CompanyApplicationForm({ existing }: { existing: ProfileView | null }) {
  const { refreshUser } = usePortalAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const errorMessage = useErrorMessage()
  const entity = existing?.legalEntity ?? null
  const [form, setForm] = useState<Fields>({
    uen: entity?.uen ?? '',
    legalName: entity?.legalName ?? '',
    entityType: entity?.entityType ?? 'private_limited',
    displayName: existing?.displayName ?? '',
    headline: existing?.headline ?? '',
    bio: existing?.bio ?? '',
    credentials: existing?.credentials ?? '',
    teachingSampleUrl: existing?.teachingSampleUrl ?? '',
  })
  /** A newly uploaded registry document; until there is one, a resubmission keeps the old one. */
  const [document, setDocument] = useState<MediaAssetView | null>(null)
  const [sample, setSample] = useState<MediaAssetView | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const set = (key: keyof Fields) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const uen = normaliseUen(form.uen)
  const uenLooksWrong = uen.length > 0 && !isValidUen(uen, form.entityType)
  const documentId =
    document?.status === 'ready' ? document.id : (entity?.registryDocumentMediaId ?? null)
  const isResubmission = existing !== null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!documentId) {
      setErrors({ registryDocumentMediaId: t('companyApply.document.required') })
      return
    }
    setBusy(true)
    setErrors({})
    try {
      const body: CorporateApplicationInput = {
        uen: form.uen,
        legalName: form.legalName,
        entityType: form.entityType,
        registryDocumentMediaId: documentId,
        displayName: form.displayName,
        headline: form.headline,
        bio: form.bio,
        credentials: form.credentials,
        teachingSampleUrl: form.teachingSampleUrl.trim() || undefined,
        teachingSampleMediaId: sample?.id ?? existing?.teachingSampleMediaId ?? undefined,
      }
      const { profile } = existing
        ? await unwrap(
            await api.teach.profiles[':profileId'].apply.corporate.$put({
              param: { profileId: existing.id },
              json: body,
            }),
          )
        : await unwrap(await api.teach.apply.corporate.$post({ json: body }))
      queryClient.setQueryData(teachKeys.profile(profile.id), profile)
      await refreshUser()
      toast({
        tone: 'success',
        title: t('companyApply.sent.title'),
        description: t('companyApply.sent.description'),
      })
      navigate(profilePath(profile.id), { replace: true })
    } catch (error) {
      const fields = fieldErrors(error)
      setErrors(fields)
      if (Object.keys(fields).length === 0)
        toast({
          tone: 'danger',
          title: t('companyApply.submit.failed'),
          description: errorMessage(error),
        })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8 animate-rise">
      <div className="space-y-3">
        <Eyebrow>
          {t(isResubmission ? 'companyApply.eyebrow.reapply' : 'companyApply.eyebrow.apply')}
        </Eyebrow>
        <h1 className="font-display text-display font-semibold leading-tight text-ink">
          {t('companyApply.title')}
        </h1>
        <p className="max-w-2xl text-body-lg text-ink-secondary">{t('companyApply.intro')}</p>
        {!isResubmission ? (
          <p className="text-small text-ink-secondary">
            {fillSlots(t('companyApply.personalInstead'), {
              link: (
                <Link to="/apply" className="font-semibold text-brand-fg hover:underline">
                  {t('companyApply.personalInstead.link')}
                </Link>
              ),
            })}
          </p>
        ) : null}
        {existing?.status === 'rejected' && existing.reviewNote ? (
          <div className="rounded-card border border-warning bg-warning-tint p-4 text-small text-ink">
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <Badge tone="warning">{t('companyApply.reviewerNote')}</Badge>
            </p>
            {existing.reviewNote}
          </div>
        ) : null}
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card as="section" className="space-y-5">
          <h2 className="font-display text-h2 font-semibold text-ink">
            {t('companyApply.company.title')}
          </h2>
          <NativeSelect
            label={t('company.legalForm')}
            value={form.entityType}
            onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value as EntityType }))}
            error={errors.entityType}
          >
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`entityType.${type}`)}
              </option>
            ))}
          </NativeSelect>
          <Input
            label={t('company.uen')}
            hint={t('companyApply.uen.hint', { example: UEN_EXAMPLE[form.entityType] })}
            value={form.uen}
            onChange={set('uen')}
            error={
              errors.uen ??
              (uenLooksWrong
                ? t('companyApply.uen.invalid', { example: UEN_EXAMPLE[form.entityType] })
                : undefined)
            }
            required
            maxLength={40}
            autoCapitalize="characters"
          />
          <Input
            label={t('company.legalName')}
            hint={t('companyApply.legalName.hint')}
            value={form.legalName}
            onChange={set('legalName')}
            error={errors.legalName}
            required
            maxLength={200}
          />
          <div className="space-y-2">
            <MediaUploader
              api={api}
              kind="document"
              value={document}
              onChange={setDocument}
              label={t(
                entity?.registryDocumentMediaId
                  ? 'companyApply.document.replace'
                  : 'companyApply.document.upload',
              )}
              hint={t('companyApply.document.hint')}
            />
            {entity?.registryDocumentMediaId && !document ? (
              <p className="text-small text-ink-tertiary">{t('companyApply.document.kept')}</p>
            ) : null}
            {errors.registryDocumentMediaId ? (
              <p role="alert" className="text-small text-danger">
                {errors.registryDocumentMediaId}
              </p>
            ) : null}
          </div>
        </Card>

        <Card as="section" className="space-y-5">
          <h2 className="font-display text-h2 font-semibold text-ink">
            {t('companyApply.public.title')}
          </h2>
          <Input
            label={t('companyApply.publicName')}
            hint={t('companyApply.publicName.hint')}
            value={form.displayName}
            onChange={set('displayName')}
            error={errors.displayName}
            required
            maxLength={80}
          />
          <Input
            label={t('profileField.headline')}
            hint={t('companyApply.headline.hint')}
            value={form.headline}
            onChange={set('headline')}
            error={errors.headline}
            required
            maxLength={120}
          />
          <Textarea
            label={t('companyApply.about')}
            hint={t('companyApply.about.hint')}
            value={form.bio}
            onChange={set('bio')}
            error={errors.bio}
            required
            rows={6}
          />
        </Card>

        <Card as="section" className="space-y-5">
          <h2 className="font-display text-h2 font-semibold text-ink">
            {t('companyApply.teaching.title')}
          </h2>
          <Textarea
            label={t('companyApply.credentials')}
            hint={t('companyApply.credentials.hint')}
            value={form.credentials}
            onChange={set('credentials')}
            error={errors.credentials}
            required
            rows={5}
          />
          <MediaUploader
            api={api}
            kind="video"
            value={sample}
            onChange={setSample}
            label={t('companyApply.sample.upload')}
            hint={t('companyApply.sample.upload.hint')}
          />
          <Input
            label={t('companyApply.sample.link')}
            placeholder="https://youtube.com/…"
            value={form.teachingSampleUrl}
            onChange={set('teachingSampleUrl')}
            error={errors.teachingSampleUrl}
            type="url"
          />
        </Card>

        <div className="flex items-center justify-between gap-4">
          <p className="text-small text-ink-tertiary">{t('companyApply.agreement')}</p>
          <Button
            type="submit"
            variant="accent"
            size="lg"
            loading={busy}
            disabled={uenLooksWrong}
            iconRight={ArrowRight}
            className="shrink-0"
          >
            {t(isResubmission ? 'companyApply.submit.reapply' : 'companyApply.submit.apply')}
          </Button>
        </div>
      </form>
    </div>
  )
}
