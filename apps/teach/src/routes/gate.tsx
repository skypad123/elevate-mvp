import { Button, Logo } from '@elevate/web-ui'
import { FullPageSpinner, usePortalAuth } from '@elevate/web-ui/portal'
import { PreferencesButton } from '@elevate/web-ui/preferences'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router'
import { lastProfileId, useCurrentProfile } from '../lib/profile'
import { profilePath } from '../lib/urls'
import { ProfileSwitcher, TeachLayout } from './layout'
import { PendingPage } from './pending'

/**
 * `/` has no page of its own. It opens the profile last used in this browser if the user is still
 * on it, else their first approved profile, else their first profile, else the application form.
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
  return <Navigate to={target ? profilePath(target.id) : '/apply'} replace />
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
  return (
    <div className="min-h-full bg-canvas">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-5">
        <Logo size="sm" suffix="Teach" />
        <div className="flex items-end gap-3 text-small text-ink-secondary">
          {/* Someone with another profile is not stuck on this one while it is being set up. */}
          <ProfileSwitcher current={profileId} className="w-56" />
          <span className="hidden pb-2 sm:inline">{user?.email}</span>
          {/* Settings is out of reach until a profile is approved; language and theme are not. */}
          <PreferencesButton />
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">{children ?? <Outlet />}</main>
    </div>
  )
}
