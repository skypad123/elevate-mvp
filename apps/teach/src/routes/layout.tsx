import { Avatar, Button, PortalShell } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { useT } from '@elevate/web-ui/preferences'
import { BookOpen, LayoutDashboard, LogOut, Settings, Wallet } from 'lucide-react'
import { Outlet } from 'react-router'

export function TeachLayout() {
  const { user, signOut } = usePortalAuth()
  const t = useT()
  return (
    <PortalShell
      portal="Teach"
      tone="brand"
      items={[
        { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: '/courses', label: t('nav.courses'), icon: BookOpen },
        { to: '/earnings', label: t('nav.earnings'), icon: Wallet },
        { to: '/settings', label: t('nav.settings'), icon: Settings },
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
              {user?.teacher?.displayName ?? user?.name ?? t('role.teacher')}
            </p>
            <p className="truncate text-caption text-ink-tertiary">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label={t('nav.signOut')} onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </div>
      }
    >
      <Outlet />
    </PortalShell>
  )
}
