import { Badge, Button, Card, cn, Eyebrow } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { fillSlots, useT } from '@elevate/web-ui/preferences'
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
  const t = useT()
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
            <Eyebrow>
              {t(company ? 'application.eyebrow.company' : 'application.eyebrow.personal')}
            </Eyebrow>
            <h1 className="font-display text-h1 font-semibold text-ink">
              {t(rejected ? 'application.title.rejected' : 'application.title.applied')}
            </h1>
          </div>
          <Badge tone={rejected ? 'danger' : 'warning'} className="ml-auto">
            {t(`status.profile.${profile.status}`)}
          </Badge>
        </div>
        {rejected ? (
          <>
            <p className="text-body text-ink-secondary">{t('application.rejected.body')}</p>
            <blockquote className="rounded-card border-l-4 border-warning bg-warning-tint p-4 text-body text-ink">
              {profile.reviewNote}
            </blockquote>
            {canEdit ? (
              <Link to={editPath}>
                <Button variant="accent">{t('application.editAndResubmit')}</Button>
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-body text-ink-secondary">
              {fillSlots(t('application.sentences'), {
                first: company
                  ? t('application.reading.company', {
                      name: profile.displayName,
                      legalName: company.legalName,
                      uen: company.uen,
                    })
                  : t('application.reading.personal', { name: profile.displayName }),
                second: fillSlots(t('application.emailNotice'), {
                  email: <strong className="text-ink">{profile.owner.email}</strong>,
                }),
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Link to={editPath}>
                  <Button variant="secondary">{t('application.edit')}</Button>
                </Link>
              ) : null}
              <Button variant="ghost" icon={MailCheck} onClick={checkStatus}>
                {t('application.checkStatus')}
              </Button>
            </div>
          </>
        )}
      </Card>
      <Card muted className="text-small text-ink-secondary">
        {t(company ? 'application.next.company' : 'application.next.personal')}
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
  const t = useT()
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
  if (chargesOn) stripeText = t('companySetup.stripe.verified')
  else if (!status?.connected) stripeText = t('companySetup.stripe.notConnected')
  else if (!status.detailsSubmitted) stripeText = t('companySetup.stripe.unfinished')
  else stripeText = t('companySetup.stripe.verifying')

  let nameText: string
  if (nameChecked) nameText = t('companySetup.name.matched', { legalName: company.legalName })
  else if (chargesOn)
    nameText = t('companySetup.name.checking', {
      legalName: company.legalName,
      email: profile.owner.email,
    })
  else nameText = t('companySetup.name.later', { legalName: company.legalName })

  return (
    <div className="space-y-6 animate-rise">
      <Card as="section" className="space-y-6">
        <div>
          <Eyebrow>{t('companySetup.eyebrow', { name: profile.displayName })}</Eyebrow>
          <h1 className="font-display text-h1 font-semibold text-ink">{t('companySetup.title')}</h1>
          <p className="mt-2 text-body text-ink-secondary">{t('companySetup.intro')}</p>
        </div>
        <ol className="space-y-5">
          <Step done title={t('companySetup.approved.title')}>
            {t('companySetup.approved.body', { legalName: company.legalName, uen: company.uen })}
          </Step>
          <Step done={chargesOn} current={!chargesOn} title={t('companySetup.stripe.title')}>
            <p>{stripeText}</p>
            {chargesOn ? null : canConnect ? (
              <Button
                variant="accent"
                icon={CreditCard}
                className="mt-3"
                loading={links.busy || stripe.isPending}
                onClick={links.connect}
              >
                {t(status?.connected ? 'companySetup.stripe.continue' : 'stripe.connect')}
              </Button>
            ) : (
              <p className="mt-2 text-ink-tertiary">
                {t('companySetup.stripe.ownerOnly', { email: profile.owner.email })}
              </p>
            )}
          </Step>
          <Step
            done={nameChecked}
            current={chargesOn && !nameChecked}
            title={t('companySetup.name.title')}
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
                {t('stripe.openDashboard')}
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
          {t('application.checkStatus')}
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
  const t = useT()
  return (
    <li className="flex gap-3">
      {done ? (
        <CheckCircle2
          aria-label={t('companySetup.step.done')}
          className="mt-0.5 size-6 shrink-0 text-success"
        />
      ) : current ? (
        <Clock
          aria-label={t('companySetup.step.waiting')}
          className="mt-0.5 size-6 shrink-0 text-warning"
        />
      ) : (
        <Circle
          aria-label={t('companySetup.step.notStarted')}
          className="mt-0.5 size-6 shrink-0 text-ink-tertiary"
        />
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
