import { Avatar, Button, EmptyState, PortalShell } from '@elevate/web-ui'
import { RequireRole, usePortalAuth } from '@elevate/web-ui/portal'
import { ClipboardCheck, LogOut, Receipt, ScrollText, ShieldAlert, Users } from 'lucide-react'
import { Outlet } from 'react-router'

export function SupportLayout() {
  const { user, signOut } = usePortalAuth()
  return (
    <RequireRole
      roles={['support_agent']}
      fallback={
        <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-4">
          <EmptyState
            icon={ShieldAlert}
            tone="danger"
            title="Staff only"
            body={`${user?.email ?? 'This account'} does not have Support access.`}
            action={
              <Button variant="secondary" onClick={signOut}>
                Sign out
              </Button>
            }
          />
        </div>
      }
    >
      <PortalShell
        portal="Support"
        tone="neutral"
        items={[
          { to: '/review', label: 'Review queue', icon: ClipboardCheck },
          { to: '/people', label: 'People', icon: Users },
          { to: '/transactions', label: 'Transactions', icon: Receipt },
          { to: '/audit', label: 'Audit log', icon: ScrollText },
        ]}
        footer={
          <div className="flex items-center gap-3 px-2 py-1">
            <Avatar name={user?.name ?? user?.email} url={user?.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-small-strong font-semibold text-ink">
                {user?.name ?? 'Support'}
              </p>
              <p className="truncate text-caption text-ink-tertiary">
                {user?.roles.includes('super_admin') ? 'Super admin' : 'Support agent'}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        }
      >
        <Outlet />
      </PortalShell>
    </RequireRole>
  )
}
