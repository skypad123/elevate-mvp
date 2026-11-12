import {
  ENTITY_TYPE_LABEL,
  type NameCheckDecision,
  type NameCheckView,
  type SupportLegalEntity,
  type SupportPayoutAccount,
} from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  Dialog,
  formatDate,
  Input,
  MediaPreview,
  Skeleton,
  type StatusTone,
  Textarea,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, unwrap } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { api } from '../lib/api'
import { profileKeys, useNameCheck } from '../lib/queries'

const CHECK: Record<
  SupportLegalEntity['checkStatus'],
  { label: string; tone: StatusTone; description: string }
> = {
  pending: {
    label: 'Not checked yet',
    tone: 'warning',
    description:
      'Compare these details with the business profile before you approve. Approving records the company as verified.',
  },
  verified: {
    label: 'Verified',
    tone: 'success',
    description: 'Checked against the business profile when the application was approved.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'danger',
    description: 'The application was rejected. Its owner can correct it and send it again.',
  },
}

/** The registered company behind a corporate profile, and the document it is checked against. */
export function CompanyCard({ entity }: { entity: SupportLegalEntity }) {
  const check = CHECK[entity.checkStatus]
  return (
    <Card as="section">
      <CardHeader
        title="Company"
        description={check.description}
        action={<Badge tone={check.tone}>{check.label}</Badge>}
      />
      <DescriptionList
        items={[
          { label: 'Legal name', value: entity.legalName },
          { label: 'UEN', value: <span className="font-mono">{entity.uen}</span> },
          { label: 'Legal form', value: ENTITY_TYPE_LABEL[entity.entityType] },
          ...(entity.checkedAt
            ? [
                {
                  label: 'Checked',
                  value: `${formatDate(entity.checkedAt)}${entity.checkedBy ? ` by ${entity.checkedBy}` : ''}`,
                },
              ]
            : []),
          ...(entity.rejectionReason
            ? [{ label: 'Rejection reason', value: entity.rejectionReason }]
            : []),
          {
            label: 'Business profile',
            value: entity.registryDocument ? (
              <MediaPreview api={api} assetId={entity.registryDocument.id} />
            ) : (
              'None on file. Only the seeded demo companies have none.'
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
  const started = !!account?.stripeAccountId
  const query = useNameCheck(profileId, started)
  const verified = !!account?.nameVerifiedAt
  const mismatched = !verified && query.data?.lastDecision?.match === false
  const state: { label: string; tone: StatusTone } = verified
    ? { label: 'Names match', tone: 'success' }
    : mismatched
      ? { label: 'Names do not match', tone: 'danger' }
      : started
        ? { label: 'Waiting for a check', tone: 'warning' }
        : { label: 'Not started', tone: 'neutral' }

  return (
    <Card as="section">
      <CardHeader
        title="Legal-name check"
        description="A company is paid only when the legal name on its Stripe account is the company approved here."
        action={<Badge tone={state.tone}>{state.label}</Badge>}
      />
      {!started ? (
        <p className="text-small text-ink-tertiary">
          The company has not started Stripe onboarding, so there is no Stripe name to compare yet.
        </p>
      ) : query.isPending ? (
        <Skeleton className="h-28 w-full" />
      ) : query.isError ? (
        <div className="space-y-3">
          <p role="alert" className="text-small text-danger">
            {errorMessage(query.error)}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Try again
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
        title: match ? 'Match recorded' : 'Mismatch recorded',
        description: match
          ? nameCheck.status === 'active'
            ? 'The company can now be paid.'
            : 'The company can be paid as soon as Stripe enables charges.'
          : 'The owner has been emailed your note.',
      })
      setDialog(null)
      setNote('')
    } catch (error) {
      toast({
        tone: 'danger',
        title: 'Could not record the check',
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
          label="On the Stripe account"
          name={stripeName}
          placeholder={
            source === 'dashboard' ? 'Stripe returned no legal name' : 'No legal name yet'
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
              Open in Stripe <ExternalLink className="size-3.5" />
            </a>
          }
        />
        <NameBox
          label="The company approved here"
          name={check.entityLegalName}
          foot={<span className="font-mono">UEN {check.uen}</span>}
        />
      </div>

      {source === 'dashboard' ? (
        <Input
          label="Legal name shown in the Stripe dashboard"
          hint="Stripe’s API returned no legal name for this account. Open the account in Stripe, and type the legal name exactly as it is shown there. It is kept with the audit entry."
          value={dashboardName}
          onChange={(e) => setDashboardName(e.target.value)}
          maxLength={300}
        />
      ) : null}

      {mismatch ? (
        <div className="rounded-card border border-danger bg-danger-tint p-4 text-small text-ink">
          <p className="font-semibold">
            Recorded as a mismatch on {formatDate(mismatch.decidedAt)}
            {mismatch.decidedBy ? ` by ${mismatch.decidedBy}` : ''}
          </p>
          <p className="mt-1">
            Stripe showed “{mismatch.stripeLegalName ?? 'no legal name'}”. The owner was sent this
            note:
          </p>
          <p className="mt-1 whitespace-pre-wrap text-ink-secondary">{mismatch.note}</p>
        </div>
      ) : null}

      <p className="text-small text-ink-secondary">
        {verified
          ? `Recorded as a match on ${formatDate(check.nameVerifiedAt)}${check.nameVerifiedBy ? ` by ${check.nameVerifiedBy}` : ''}.`
          : mismatch
            ? 'Check again when the owner says the Stripe account has been corrected.'
            : 'No check is recorded yet.'}{' '}
        {check.status === 'active'
          ? 'The account is active, so the company’s courses can be bought.'
          : !check.chargesEnabled
            ? 'Stripe has not enabled charges for this account. A match recorded now takes effect when it does.'
            : 'Stripe has enabled charges. The account becomes active when a match is recorded.'}
      </p>

      <div className="flex flex-wrap gap-2">
        {verified ? null : (
          <Button icon={Check} disabled={!stripeName} onClick={() => setDialog('match')}>
            Names match
          </Button>
        )}
        <Button
          variant="secondary"
          icon={X}
          disabled={!stripeName}
          onClick={() => setDialog('mismatch')}
        >
          {verified ? 'Names no longer match' : 'Names do not match'}
        </Button>
      </div>

      <Dialog
        open={dialog === 'match'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Record that the names match?"
        description="Learners can pay this company once Stripe has enabled charges. The check is recorded under your name."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => decide(true)}>
              Record a match
            </Button>
          </>
        }
      >
        <DescriptionList
          items={[
            { label: 'Stripe account', value: stripeName ?? '—' },
            { label: 'Company', value: check.entityLegalName },
          ]}
        />
      </Dialog>
      <Dialog
        open={dialog === 'mismatch'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Record that the names do not match"
        description="The company cannot be paid until a match is recorded. Your note is emailed to the owner, so say what to change in Stripe."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={noteTooShort}
              onClick={() => decide(false)}
            >
              Record a mismatch
            </Button>
          </>
        }
      >
        <Textarea
          label="What does not match (sent to the owner)"
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
