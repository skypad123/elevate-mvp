import {
  type CorporateApplicationInput,
  ENTITY_TYPE_LABEL,
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
import { errorMessage, fieldErrors, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
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
  if (type !== 'corporate') return <Navigate to="/apply" replace />
  if (status === 'approved') return <Navigate to={path()} replace />
  if (!profile) return null
  if (role !== 'owner')
    return (
      <EmptyState
        title="Only the owner can resubmit"
        body="The application of this company profile can be changed by its owner."
        action={
          <Link to={path()}>
            <Button variant="secondary">Back</Button>
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
      setErrors({ registryDocumentMediaId: 'Upload the company’s business profile as a PDF' })
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
        title: 'Application sent',
        description: 'We will email you when it has been reviewed.',
      })
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

  return (
    <div className="space-y-8 animate-rise">
      <div className="space-y-3">
        <Eyebrow>{isResubmission ? 'Update your application' : 'Teach as a company'}</Eyebrow>
        <h1 className="font-display text-display font-semibold leading-tight text-ink">
          A profile for your company.
        </h1>
        <p className="max-w-2xl text-body-lg text-ink-secondary">
          For a private limited company or a limited liability partnership registered in Singapore.
          Courses are sold under the company’s name and paid to the company’s own Stripe account. We
          check the company against its business profile, then review the teaching, usually within
          two working days.
        </p>
        {!isResubmission ? (
          <p className="text-small text-ink-secondary">
            Teaching under your own name, or as a sole proprietor?{' '}
            <Link to="/apply" className="font-semibold text-brand hover:underline">
              Apply as a person instead
            </Link>
            .
          </p>
        ) : null}
        {existing?.status === 'rejected' && existing.reviewNote ? (
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
          <h2 className="font-display text-h2 font-semibold text-ink">The company</h2>
          <NativeSelect
            label="Legal form"
            value={form.entityType}
            onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value as EntityType }))}
            error={errors.entityType}
          >
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {ENTITY_TYPE_LABEL[type]}
              </option>
            ))}
          </NativeSelect>
          <Input
            label="UEN"
            hint={`The Unique Entity Number, as on the business profile. It looks like ${UEN_EXAMPLE[form.entityType]}.`}
            value={form.uen}
            onChange={set('uen')}
            error={
              errors.uen ??
              (uenLooksWrong
                ? `That is not the UEN of this kind of company. It looks like ${UEN_EXAMPLE[form.entityType]}.`
                : undefined)
            }
            required
            maxLength={40}
            autoCapitalize="characters"
          />
          <Input
            label="Legal name"
            hint="The registered name, exactly as on the business profile."
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
              label={
                entity?.registryDocumentMediaId
                  ? 'Replace the business profile (PDF)'
                  : 'Business profile (PDF)'
              }
              hint="The company’s business profile from ACRA’s Bizfile. Only the Elevate team reads it."
            />
            {entity?.registryDocumentMediaId && !document ? (
              <p className="text-small text-ink-tertiary">
                The document sent with the earlier application is kept unless you upload another.
              </p>
            ) : null}
            {errors.registryDocumentMediaId ? (
              <p role="alert" className="text-small text-danger">
                {errors.registryDocumentMediaId}
              </p>
            ) : null}
          </div>
        </Card>

        <Card as="section" className="space-y-5">
          <h2 className="font-display text-h2 font-semibold text-ink">How learners see it</h2>
          <Input
            label="Public name"
            hint="Shown on courses and certificates. It can be the trading name."
            value={form.displayName}
            onChange={set('displayName')}
            error={errors.displayName}
            required
            maxLength={80}
          />
          <Input
            label="Headline"
            hint="One line, e.g. “Studio ceramics classes by working potters”."
            value={form.headline}
            onChange={set('headline')}
            error={errors.headline}
            required
            maxLength={120}
          />
          <Textarea
            label="About"
            hint="50–3000 characters. Learners read this on the course pages."
            value={form.bio}
            onChange={set('bio')}
            error={errors.bio}
            required
            rows={6}
          />
        </Card>

        <Card as="section" className="space-y-5">
          <h2 className="font-display text-h2 font-semibold text-ink">Teaching</h2>
          <Textarea
            label="Credentials and experience"
            hint="Who teaches, their qualifications, how long the company has been teaching."
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
            label="A teaching sample: upload a video"
            hint="A few minutes of one of your teachers teaching. MP4 or MOV."
          />
          <Input
            label="Or a link to one"
            placeholder="https://youtube.com/…"
            value={form.teachingSampleUrl}
            onChange={set('teachingSampleUrl')}
            error={errors.teachingSampleUrl}
            type="url"
          />
        </Card>

        <div className="flex items-center justify-between gap-4">
          <p className="text-small text-ink-tertiary">
            By applying you confirm that you may act for this company, and agree to the teacher
            agreement: the company owns its content; Elevate holds a non-exclusive hosting licence
            while it is listed.
          </p>
          <Button
            type="submit"
            variant="accent"
            size="lg"
            loading={busy}
            disabled={uenLooksWrong}
            iconRight={ArrowRight}
          >
            {isResubmission ? 'Resubmit' : 'Submit application'}
          </Button>
        </div>
      </form>
    </div>
  )
}
