import { Avatar, Button, PortalShell } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { BookOpen, LayoutDashboard, LogOut, Settings, Wallet } from 'lucide-react'
import { Outlet } from 'react-router'

export function TeachLayout() {
  const { user, signOut } = usePortalAuth()
  return (
    <PortalShell
      portal="Teach"
      tone="brand"
      items={[
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/courses', label: 'Courses', icon: BookOpen },
        { to: '/earnings', label: 'Earnings', icon: Wallet },
        { to: '/settings', label: 'Settings', icon: Settings },
      ]}
      footer={
        <div className="flex items-center gap-3 px-2 py-1">
          <Avatar
            name={user?.teacher?.displayName ?? user?.name ?? user?.email}
            url={user?.avatarUrl}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small-strong font-semibold text-ink">
              {user?.teacher?.displayName ?? user?.name ?? 'Teacher'}
            </p>
            <p className="truncate text-caption text-ink-tertiary">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </div>
      }
    >
      <Outlet />
    </PortalShell>
  )
}
