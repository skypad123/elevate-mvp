import { Button, Card, Logo, PageHeader } from '@elevate/web-ui'
import { FullPageSpinner, usePortalAuth } from '@elevate/web-ui/portal'
import { PreferencesButton, useT } from '@elevate/web-ui/preferences'
import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router'
import { lastProfileId, useCurrentProfile, useOptionalProfile } from '../lib/profile'
import { profilePath } from '../lib/urls'
import { ProfileSwitcher, StaffBanner, TeachLayout } from './layout'
import { PendingPage } from './pending'

/**
 * `/` has no page of its own. It opens the profile last used in this browser if the user is still
 * on it, else their first approved profile, else their first profile, else the start page (which
 * offers both applications and explains invitations).
 */
export function HomeRedirect() {
  const { user, status } = usePortalAuth()
  if (status === 'loading') return <FullPageSpinner />
  const profiles = user?.profiles ?? []
  const last = lastProfileId()
  const target =
    profiles.find((p) => p.id === last) ??
    profiles.find((p) => p.status === 'approved') ??
    profiles[0]
  return <Navigate to={target ? profilePath(target.id) : '/start'} replace />
}

/**
 * Every page under `/p/:profileId`. Until a profile is ready, whichever page was asked for shows
 * where the profile stands instead of the portal:
 *
 * - a profile that Support has not approved yet shows its application;
 * - an approved company shows its remaining steps (Stripe onboarding, then Elevate's legal-name
 *   check) until its payout account has been active once.
 *
 * Two kinds of page stay reachable meanwhile, because those steps need them: a company's
 * application form, and the pages Stripe sends the owner back to.
 */
export function ProfileGate() {
  const { status, type, profile, profileId } = useCurrentProfile()
  const { pathname } = useLocation()
  const sub = pathname.slice(profilePath(profileId).length)
  const approved = status === 'approved'
  const company = type === 'corporate'

  // The pages Stripe sends the owner back to only wait and redirect. They sit outside both
  // layouts, so a profile that becomes ready while one of them waits does not start it again.
  if (approved && sub.startsWith('/stripe/')) return <Outlet />

  // A company's set-up needs the profile's details; wait for them rather than flash the portal.
  if (approved && company && !profile) return <FullPageSpinner />
  const settingUp = company && !!profile && !profile.payout?.activated
  if (approved && !settingUp) return <TeachLayout />

  // The owner of a company that is not approved can open its application to correct and resend it.
  const applying = company && !approved && sub === '/apply'
  return <OnboardingLayout>{applying ? <Outlet /> : <PendingPage />}</OnboardingLayout>
}

/** Centered single-column layout used before a profile is approved. */
export function OnboardingLayout({ children }: { children?: ReactNode }) {
  const { user, signOut } = usePortalAuth()
  const { profileId } = useParams()
  // Outside `/p/:profileId` (the application forms, the start page) there is no current profile.
  const current = useOptionalProfile()
  const t = useT()
  const staff = current?.actingAsStaff ? current.displayName : undefined
  return (
    <div className="min-h-full bg-canvas">
      <header className="mx-auto flex w-full max-w-3xl flex-wrap items-end justify-between gap-x-4 gap-y-3 px-4 py-5">
        <Logo size="sm" suffix="Teach" />
        <div className="flex flex-wrap items-center gap-2 text-small text-ink-secondary sm:flex-nowrap">
          <span className="hidden truncate sm:inline">{user?.email}</span>
          {/* Settings is out of reach until a profile is approved; language and theme are not. */}
          <PreferencesButton />
          <Button variant="ghost" size="sm" onClick={signOut}>
            {t('nav.signOut')}
          </Button>
        </div>
        {/* Someone with another profile is not stuck on this one while it is being set up. */}
        <ProfileSwitcher current={profileId} staffLabel={staff} className="w-full sm:w-72" />
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        {staff ? <StaffBanner name={staff} /> : null}
        {children ?? <Outlet />}
      </main>
    </div>
  )
}

/**
 * For someone signed in who is on no teaching profile: both applications side by side, and what
 * to do with an invitation. A person who has just left their last profile is told so here.
 */
export function StartPage() {
  const t = useT()
  const { state } = useLocation()
  const left = (state as { left?: string } | null)?.left
  const choices = [
    { key: 'person', to: '/apply' },
    { key: 'company', to: '/apply/company' },
  ] as const
  return (
    <>
      <PageHeader
        eyebrow={t('start.eyebrow')}
        title={t('start.title')}
        description={left ? t('start.left', { name: left }) : t('start.description')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {choices.map((choice) => (
          <Card key={choice.key} as="section" className="flex flex-col gap-3">
            <h2 className="font-display text-h3 font-semibold text-ink">
              {t(`start.${choice.key}.title`)}
            </h2>
            <p className="flex-1 text-small text-ink-secondary">{t(`start.${choice.key}.body`)}</p>
            <Button asChild variant={choice.key === 'person' ? 'primary' : 'secondary'}>
              <Link to={choice.to}>{t(`start.${choice.key}.action`)}</Link>
            </Button>
          </Card>
        ))}
      </div>
      <Card as="section" className="mt-4">
        <h2 className="font-display text-h3 font-semibold text-ink">{t('start.invited.title')}</h2>
        <p className="mt-1 text-small text-ink-secondary">{t('start.invited.body')}</p>
      </Card>
    </>
  )
}
