import { Avatar, Button, EmptyState, PortalShell } from '@elevate/web-ui'
import { RequireRole, usePortalAuth } from '@elevate/web-ui/portal'
import { useT } from '@elevate/web-ui/preferences'
import {
  ClipboardCheck,
  GraduationCap,
  LogOut,
  Receipt,
  ScrollText,
  Settings,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Outlet } from 'react-router'

export function SupportLayout() {
  const { user, signOut } = usePortalAuth()
  const t = useT()
  return (
    <RequireRole
      roles={['support_agent']}
      fallback={
        <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-4">
          <EmptyState
            icon={ShieldAlert}
            tone="danger"
            title={t('staffOnly.title')}
            body={
              user?.email ? t('staffOnly.body', { email: user.email }) : t('staffOnly.body.noEmail')
            }
            action={
              <Button variant="secondary" onClick={signOut}>
                {t('nav.signOut')}
              </Button>
            }
          />
        </div>
      }
    >
      <PortalShell
        portal="Support"
        tone="brand"
        items={[
          { to: '/review', label: t('nav.reviewQueue'), icon: ClipboardCheck },
          { to: '/profiles', label: t('nav.profiles'), icon: GraduationCap },
          { to: '/people', label: t('nav.people'), icon: Users },
          { to: '/transactions', label: t('nav.transactions'), icon: Receipt },
          { to: '/insights', label: t('nav.insights'), icon: TrendingUp },
          { to: '/audit', label: t('nav.auditLog'), icon: ScrollText },
          { to: '/settings', label: t('nav.settings'), icon: Settings },
        ]}
        footer={
          <div className="flex items-center gap-3 px-2 py-1">
            <Avatar name={user?.name ?? user?.email} url={user?.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-small-strong font-semibold text-ink">
                {user?.name ?? 'Support'}
              </p>
              <p className="truncate text-caption text-ink-tertiary">
                {user?.roles.includes('super_admin')
                  ? t('role.superAdmin')
                  : t('role.supportAgent')}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label={t('nav.signOut')} onClick={signOut}>
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
