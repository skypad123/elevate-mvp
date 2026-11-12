import type {
  NameCheckDecision,
  NameCheckView,
  SupportLegalEntity,
  SupportPayoutAccount,
} from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  Dialog,
  Input,
  MediaPreview,
  Skeleton,
  type StatusTone,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, unwrap } from '@elevate/web-ui/portal'
import { useFormatDate, useT } from '@elevate/web-ui/preferences'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { api } from '../lib/api'
import { profileKeys, useNameCheck } from '../lib/queries'

/** The badge colour of each check status. Its words are `companyCard.check.<status>.*`. */
const CHECK_TONE: Record<SupportLegalEntity['checkStatus'], StatusTone> = {
  pending: 'warning',
  verified: 'success',
  rejected: 'danger',
}

/** The registered company behind a corporate profile, and the document it is checked against. */
export function CompanyCard({ entity }: { entity: SupportLegalEntity }) {
  const t = useT()
  const formatDate = useFormatDate()
  return (
    <Card as="section">
      <CardHeader
        title={t('companyCard.title')}
        description={t(`companyCard.check.${entity.checkStatus}.description`)}
        action={
          <Badge tone={CHECK_TONE[entity.checkStatus]}>
            {t(`companyCard.check.${entity.checkStatus}.label`)}
          </Badge>
        }
      />
      <DescriptionList
        items={[
          { label: t('company.legalName'), value: entity.legalName },
          { label: t('company.uen'), value: <span className="font-mono">{entity.uen}</span> },
          { label: t('company.legalForm'), value: t(`entityType.${entity.entityType}`) },
          ...(entity.checkedAt
            ? [
                {
                  label: t('companyCard.checked'),
                  value: entity.checkedBy
                    ? t('companyCard.checked.by', {
                        date: formatDate(entity.checkedAt),
                        name: entity.checkedBy,
                      })
                    : formatDate(entity.checkedAt),
                },
              ]
            : []),
          ...(entity.rejectionReason
            ? [{ label: t('companyCard.rejectionReason'), value: entity.rejectionReason }]
            : []),
          {
            label: t('companyCard.registryDocument'),
            value: entity.registryDocument ? (
              <MediaPreview api={api} assetId={entity.registryDocument.id} />
            ) : (
              t('companyCard.registryDocument.none')
            ),
          },
        ]}
      />
    </Card>
  )
}

/**
 * The legal-name check on a company's Stripe account: the name Stripe holds, beside the company
 * that was approved. The company is paid only after someone on the team records that they match.
 */
export function NameCheckCard({
  profileId,
  account,
}: {
  profileId: string
  account: SupportPayoutAccount | undefined
}) {
  const t = useT()
  const started = !!account?.stripeAccountId
  const query = useNameCheck(profileId, started)
  const verified = !!account?.nameVerifiedAt
  const mismatched = !verified && query.data?.lastDecision?.match === false
  const state: { label: string; tone: StatusTone } = verified
    ? { label: t('nameCheck.state.match'), tone: 'success' }
    : mismatched
      ? { label: t('nameCheck.state.mismatch'), tone: 'danger' }
      : started
        ? { label: t('nameCheck.state.waiting'), tone: 'warning' }
        : { label: t('nameCheck.state.notStarted'), tone: 'neutral' }

  return (
    <Card as="section">
      <CardHeader
        title={t('nameCheck.title')}
        description={t('nameCheck.description')}
        action={<Badge tone={state.tone}>{state.label}</Badge>}
      />
      {!started ? (
        <p className="text-small text-ink-tertiary">{t('nameCheck.notStarted')}</p>
      ) : query.isPending ? (
        <Skeleton className="h-28 w-full" />
      ) : query.isError ? (
        <div className="space-y-3">
          <p role="alert" className="text-small text-danger">
            {errorMessage(query.error)}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {t('common.tryAgain')}
          </Button>
        </div>
      ) : (
        <NameComparison profileId={profileId} check={query.data} />
      )}
    </Card>
  )
}

function NameComparison({ profileId, check }: { profileId: string; check: NameCheckView }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const formatDate = useFormatDate()
  const [dialog, setDialog] = useState<'match' | 'mismatch' | null>(null)
  const [dashboardName, setDashboardName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  // Stripe's API usually returns the name. When it does not, the name is read in the dashboard.
  const source: NameCheckDecision['source'] = check.stripeLegalName === null ? 'dashboard' : 'api'
  const stripeName = source === 'api' ? check.stripeLegalName : dashboardName.trim() || null
  const verified = check.nameVerifiedAt !== null
  // A mismatch lives only in the audit log, so it is shown here until a match replaces it.
  const mismatch = !verified && check.lastDecision?.match === false ? check.lastDecision : null
  const noteTooShort = note.trim().length < 10
  // The paragraph under the names: what is recorded, then what that means for the account.
  const recorded = verified
    ? check.nameVerifiedBy
      ? t('nameCheck.record.matchBy', {
          date: formatDate(check.nameVerifiedAt),
          name: check.nameVerifiedBy,
        })
      : t('nameCheck.record.match', { date: formatDate(check.nameVerifiedAt) })
    : mismatch
      ? t('nameCheck.record.checkAgain')
      : t('nameCheck.record.none')
  const effect =
    check.status === 'active'
      ? t('nameCheck.account.active')
      : !check.chargesEnabled
        ? t('nameCheck.account.chargesOff')
        : t('nameCheck.account.chargesOn')

  async function decide(match: boolean) {
    setBusy(true)
    try {
      const { nameCheck } = await unwrap(
        await api.support.profiles[':id']['payout-account']['name-check'].$post({
          param: { id: profileId },
          json: {
            match,
            source,
            ...(source === 'dashboard' ? { stripeLegalName: dashboardName.trim() } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          },
        }),
      )
      queryClient.setQueryData(profileKeys.nameCheck(profileId), nameCheck)
      // The payout account's status on this page, and "Can be paid" in the lists, follow it.
      await queryClient.invalidateQueries({ queryKey: profileKeys.all })
      toast({
        tone: 'success',
        title: match ? t('nameCheck.toast.match') : t('nameCheck.toast.mismatch'),
        description: match
          ? nameCheck.status === 'active'
            ? t('nameCheck.toast.match.active')
            : t('nameCheck.toast.match.waiting')
          : t('nameCheck.toast.mismatch.emailed'),
      })
      setDialog(null)
      setNote('')
    } catch (error) {
      toast({
        tone: 'danger',
        title: t('nameCheck.toast.failed'),
        description: errorMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <NameBox
          label={t('nameCheck.stripeName')}
          name={stripeName}
          placeholder={
            source === 'dashboard'
              ? t('nameCheck.stripeName.notReturned')
              : t('nameCheck.stripeName.none')
          }
          foot={
            <a
              href={check.dashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-brand-fg hover:underline"
            >
              <span className="font-mono font-normal text-ink-tertiary">
                {check.stripeAccountId}
              </span>
              {t('nameCheck.openInStripe')}
              <ExternalLink className="size-3.5" />
            </a>
          }
        />
        <NameBox
          label={t('nameCheck.companyName')}
          name={check.entityLegalName}
          foot={<span className="font-mono">{t('company.uenValue', { uen: check.uen })}</span>}
        />
      </div>

      {source === 'dashboard' ? (
        <Input
          label={t('nameCheck.dashboardName')}
          hint={t('nameCheck.dashboardName.hint')}
          value={dashboardName}
          onChange={(e) => setDashboardName(e.target.value)}
          maxLength={300}
        />
      ) : null}

      {mismatch ? (
        <div className="rounded-card border border-danger bg-danger-tint p-4 text-small text-ink">
          <p className="font-semibold">
            {mismatch.decidedBy
              ? t('nameCheck.mismatch.recordedBy', {
                  date: formatDate(mismatch.decidedAt),
                  name: mismatch.decidedBy,
                })
              : t('nameCheck.mismatch.recorded', { date: formatDate(mismatch.decidedAt) })}
          </p>
          <p className="mt-1">
            {mismatch.stripeLegalName === null
              ? t('nameCheck.mismatch.stripeShowedNothing')
              : t('nameCheck.mismatch.stripeShowed', { name: mismatch.stripeLegalName })}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-ink-secondary">{mismatch.note}</p>
        </div>
      ) : null}

      <p className="text-small text-ink-secondary">
        {t('nameCheck.sentences', { first: recorded, second: effect })}
      </p>

      <div className="flex flex-wrap gap-2">
        {verified ? null : (
          <Button icon={Check} disabled={!stripeName} onClick={() => setDialog('match')}>
            {t('nameCheck.action.match')}
          </Button>
        )}
        <Button
          variant="secondary"
          icon={X}
          disabled={!stripeName}
          onClick={() => setDialog('mismatch')}
        >
          {verified ? t('nameCheck.action.noLongerMatch') : t('nameCheck.action.mismatch')}
        </Button>
      </div>

      <Dialog
        open={dialog === 'match'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('nameCheck.matchDialog.title')}
        description={t('nameCheck.matchDialog.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button loading={busy} onClick={() => decide(true)}>
              {t('nameCheck.matchDialog.confirm')}
            </Button>
          </>
        }
      >
        <DescriptionList
          items={[
            { label: t('stripe.account'), value: stripeName ?? '—' },
            { label: t('nameCheck.matchDialog.company'), value: check.entityLegalName },
          ]}
        />
      </Dialog>
      <Dialog
        open={dialog === 'mismatch'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('nameCheck.mismatchDialog.title')}
        description={t('nameCheck.mismatchDialog.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={noteTooShort}
              onClick={() => decide(false)}
            >
              {t('nameCheck.mismatchDialog.confirm')}
            </Button>
          </>
        }
      >
        <Textarea
          label={t('nameCheck.mismatchDialog.note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          required
        />
      </Dialog>
    </div>
  )
}

function NameBox({
  label,
  name,
  placeholder,
  foot,
}: {
  label: string
  name: string | null
  placeholder?: string
  foot: ReactNode
}) {
  return (
    <div className="rounded-card border border-border bg-surface-muted p-4">
      <p className="text-caption text-ink-tertiary">{label}</p>
      {name ? (
        <p className="mt-1 break-words text-body-lg font-semibold text-ink">{name}</p>
      ) : (
        <p className="mt-1 text-body-lg text-ink-tertiary">{placeholder}</p>
      )}
      <p className="mt-2 text-caption text-ink-secondary">{foot}</p>
    </div>
  )
}
