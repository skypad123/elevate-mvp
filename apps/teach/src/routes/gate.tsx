import { Button, Logo } from '@elevate/web-ui'
import { FullPageSpinner, usePortalAuth } from '@elevate/web-ui/portal'
import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router'
import { lastProfileId, useCurrentProfile } from '../lib/profile'
import { profilePath } from '../lib/urls'
import { TeachLayout } from './layout'
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
 * Every page under `/p/:profileId`. A profile that Support has not approved yet shows its
 * application status instead of the portal, whichever page was asked for.
 */
export function ProfileGate() {
  const { status } = useCurrentProfile()
  if (status !== 'approved')
    return (
      <OnboardingLayout>
        <PendingPage />
      </OnboardingLayout>
    )
  return <TeachLayout />
}

/** Centered single-column layout used before a profile is approved. */
export function OnboardingLayout({ children }: { children?: ReactNode }) {
  const { user, signOut } = usePortalAuth()
  return (
    <div className="min-h-full bg-canvas">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
        <Logo size="sm" suffix="Teach" />
        <div className="flex items-center gap-3 text-small text-ink-secondary">
          <span className="hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">{children ?? <Outlet />}</main>
    </div>
  )
}
