import { Badge, Button, Card, cn, Eyebrow } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  ExternalLink,
  MailCheck,
  XCircle,
} from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { Link } from 'react-router'
import { teachKeys } from '../lib/keys'
import { useCurrentProfile } from '../lib/profile'
import { useStripeLinks, useStripeStatus } from '../lib/queries'

/**
 * What a profile shows while it is not ready to use: its application until Support has decided,
 * and, for an approved company, the steps left before it can be paid.
 */
export function PendingPage() {
  const { profile, status, type } = useCurrentProfile()
  if (!profile) return null
  return status === 'approved' && type === 'corporate' ? <CompanySetup /> : <ApplicationStatus />
}

function ApplicationStatus() {
  const { refreshUser } = usePortalAuth()
  const { profile, profileId, role, type, path, actingAsStaff } = useCurrentProfile()
  const queryClient = useQueryClient()
  if (!profile) return null
  const rejected = profile.status === 'rejected'
  const company = profile.legalEntity
  // A person edits their own application; a company's is resubmitted by the profile's owner.
  const canEdit = type === 'corporate' ? role === 'owner' : !actingAsStaff
  const editPath = type === 'corporate' ? path('/apply') : '/apply'

  async function checkStatus() {
    await refreshUser()
    await queryClient.invalidateQueries({ queryKey: teachKeys.profile(profileId) })
  }

  return (
    <div className="space-y-6 animate-rise">
      <Card as="section" className="space-y-4">
        <div className="flex items-center gap-3">
          {rejected ? (
            <XCircle className="size-7 text-danger" />
          ) : (
            <Clock className="size-7 text-warning" />
          )}
          <div>
            <Eyebrow>{company ? 'Company application' : 'Application'}</Eyebrow>
            <h1 className="font-display text-h1 font-semibold text-ink">
              {rejected ? 'Not approved yet' : 'Under review'}
            </h1>
          </div>
          <Badge tone={rejected ? 'danger' : 'warning'} className="ml-auto">
            {rejected ? 'Rejected' : 'Applied'}
          </Badge>
        </div>
        {rejected ? (
          <>
            <p className="text-body text-ink-secondary">
              The team could not approve the application as submitted. Their note:
            </p>
            <blockquote className="rounded-card border-l-4 border-warning bg-warning-tint p-4 text-body text-ink">
              {profile.reviewNote}
            </blockquote>
            {canEdit ? (
              <Link to={editPath}>
                <Button variant="accent">Edit and resubmit</Button>
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-body text-ink-secondary">
              Thanks, {profile.displayName}. A member of the Elevate team is reading the application
              {company
                ? `, and comparing ${company.legalName} (UEN ${company.uen}) with the business profile you uploaded`
                : ''}
              . An email goes to <strong className="text-ink">{profile.owner.email}</strong> when it
              has been reviewed, usually within two working days.
            </p>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Link to={editPath}>
                  <Button variant="secondary">Edit application</Button>
                </Link>
              ) : null}
              <Button variant="ghost" icon={MailCheck} onClick={checkStatus}>
                Check status
              </Button>
            </div>
          </>
        )}
      </Card>
      <Card muted className="text-small text-ink-secondary">
        {company
          ? 'After approval there are two more steps before courses can be sold: the company connects its own Stripe account, and Elevate checks that the legal name on that account matches the company.'
          : 'While you wait: think about the first course you want to build. Most pilot teachers start with 3–5 lessons, a short video per lesson, a page of notes and a quick quiz.'}
      </Card>
    </div>
  )
}

/**
 * An approved company, before it can be paid: Stripe onboarding as the company, then Elevate's
 * check that the legal name on the Stripe account is the company's. Both are needed; the page
 * shows which one is waiting, and on whom.
 */
function CompanySetup() {
  const { profile, profileId, can } = useCurrentProfile()
  const queryClient = useQueryClient()
  const stripe = useStripeStatus()
  const links = useStripeLinks()
  const status = stripe.data
  const active = status?.status === 'active'

  // Once the account is active the profile is ready: reading it again opens the portal.
  useEffect(() => {
    if (active) void queryClient.invalidateQueries({ queryKey: teachKeys.profile(profileId) })
  }, [active, queryClient, profileId])

  if (!profile?.legalEntity) return null
  const company = profile.legalEntity
  const canConnect = can('stripe.links')
  const chargesOn = !!status?.chargesEnabled
  const nameChecked = !!status?.nameVerified

  let stripeText: string
  if (chargesOn) stripeText = 'Stripe has verified the company and can take payments for it.'
  else if (!status?.connected)
    stripeText =
      'Stripe handles payments and payouts. Onboarding is done for the company, with its own bank account, and takes about ten minutes.'
  else if (!status.detailsSubmitted)
    stripeText = 'Stripe onboarding was started and is not finished yet.'
  else stripeText = 'Stripe is verifying the company’s details. This can take a day or two.'

  // A legal name often ends in a full stop ("Pte. Ltd."), so it never ends a sentence here.
  let nameText: string
  if (nameChecked)
    nameText = `The legal name on the Stripe account is ${company.legalName}, the company we approved.`
  else if (chargesOn)
    nameText = `We are checking that the legal name on the Stripe account is ${company.legalName}, the company we approved. This usually takes one working day, and an email goes to ${profile.owner.email} when it is done. If the names differ, we will say what to change.`
  else
    nameText = `When Stripe has finished, we check that the legal name on the Stripe account is ${company.legalName}, the company we approved.`

  return (
    <div className="space-y-6 animate-rise">
      <Card as="section" className="space-y-6">
        <div>
          <Eyebrow>Setting up {profile.displayName}</Eyebrow>
          <h1 className="font-display text-h1 font-semibold text-ink">Two steps before you sell</h1>
          <p className="mt-2 text-body text-ink-secondary">
            The application is approved. The company can be paid, and its courses bought, once both
            steps below are done.
          </p>
        </div>
        <ol className="space-y-5">
          <Step done title="Application approved">
            We checked {company.legalName} (UEN {company.uen}) against its business profile.
          </Step>
          <Step done={chargesOn} current={!chargesOn} title="Connect the company’s Stripe account">
            <p>{stripeText}</p>
            {chargesOn ? null : canConnect ? (
              <Button
                variant="accent"
                icon={CreditCard}
                className="mt-3"
                loading={links.busy || stripe.isPending}
                onClick={links.connect}
              >
                {status?.connected ? 'Continue Stripe onboarding' : 'Connect Stripe'}
              </Button>
            ) : (
              <p className="mt-2 text-ink-tertiary">
                Only the profile’s owner, {profile.owner.email}, can connect Stripe.
              </p>
            )}
          </Step>
          <Step
            done={nameChecked}
            current={chargesOn && !nameChecked}
            title="Elevate checks the legal name"
          >
            <p>{nameText}</p>
            {/* If the names differ, the owner corrects the company's details in Stripe. */}
            {chargesOn && !nameChecked && canConnect ? (
              <Button
                variant="secondary"
                size="sm"
                icon={ExternalLink}
                className="mt-3"
                loading={links.busy}
                onClick={links.openDashboard}
              >
                Open Stripe dashboard
              </Button>
            ) : null}
          </Step>
        </ol>
        <Button
          variant="ghost"
          icon={MailCheck}
          loading={stripe.isFetching}
          onClick={() => void stripe.refetch()}
        >
          Check status
        </Button>
      </Card>
    </div>
  )
}

function Step({
  title,
  done,
  current,
  children,
}: {
  title: string
  done?: boolean
  current?: boolean
  children: ReactNode
}) {
  return (
    <li className="flex gap-3">
      {done ? (
        <CheckCircle2 aria-label="Done" className="mt-0.5 size-6 shrink-0 text-success" />
      ) : current ? (
        <Clock aria-label="Waiting" className="mt-0.5 size-6 shrink-0 text-warning" />
      ) : (
        <Circle aria-label="Not started" className="mt-0.5 size-6 shrink-0 text-ink-tertiary" />
      )}
      <div className="min-w-0">
        <h2 className={cn('font-semibold', done || current ? 'text-ink' : 'text-ink-secondary')}>
          {title}
        </h2>
        <div className="mt-1 text-small text-ink-secondary">{children}</div>
      </div>
    </li>
  )
}
