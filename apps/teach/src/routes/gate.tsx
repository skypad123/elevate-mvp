import { Button, Logo } from '@elevate/web-ui'
import { FullPageSpinner, usePortalAuth } from '@elevate/web-ui/portal'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

/**
 * Routes teachers by application state: no application → /apply, pending or rejected → /pending,
 * approved → the portal.
 */
export function TeachGate({ children }: { children: ReactNode }) {
  const { user, status } = usePortalAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  const teacher = user?.teacher ?? null
  const onApply = location.pathname === '/apply'
  const onPending = location.pathname === '/pending'
  if (!teacher) return onApply ? children : <Navigate to="/apply" replace />
  if (teacher.status === 'approved')
    return onApply || onPending ? <Navigate to="/" replace /> : children
  if (onApply || onPending) return <>{children}</>
  return <Navigate to="/pending" replace />
}

/** Centered single-column layout used before a teacher is approved. */
export function OnboardingLayout() {
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
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        <Outlet />
      </main>
    </div>
  )
}
