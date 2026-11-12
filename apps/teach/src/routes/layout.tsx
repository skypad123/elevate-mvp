import { Avatar, Button, NativeSelect, PortalShell } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { BookOpen, LayoutDashboard, LogOut, Settings, Wallet } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router'
import { useCurrentProfile } from '../lib/profile'
import { profilePath } from '../lib/urls'

const STATUS_NOTE = { applied: 'under review', rejected: 'not approved', approved: '' } as const

/** Shown when the user is on more than one profile; choosing one opens its dashboard. */
function ProfileSwitcher() {
  const { user } = usePortalAuth()
  const { profileId, displayName, actingAsStaff } = useCurrentProfile()
  const navigate = useNavigate()
  const profiles = user?.profiles ?? []
  if (profiles.length < 2) return null
  return (
    <NativeSelect
      label="Profile"
      aria-label="Switch profile"
      value={profileId}
      wrapperClassName="mb-3"
      onChange={(e) => navigate(profilePath(e.target.value))}
    >
      {actingAsStaff ? <option value={profileId}>{displayName} (as staff)</option> : null}
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.displayName}
          {p.status === 'approved' ? '' : ` (${STATUS_NOTE[p.status]})`}
        </option>
      ))}
    </NativeSelect>
  )
}

export function TeachLayout() {
  const { user, signOut } = usePortalAuth()
  const { path, displayName, actingAsStaff, profile } = useCurrentProfile()
  return (
    <PortalShell
      portal="Teach"
      tone="brand"
      items={[
        { to: path(), label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: path('/courses'), label: 'Courses', icon: BookOpen },
        { to: path('/earnings'), label: 'Earnings', icon: Wallet },
        { to: path('/settings'), label: 'Settings', icon: Settings },
      ]}
      footer={
        <>
          <ProfileSwitcher />
          <div className="flex items-center gap-3 px-2 py-1">
            <Avatar name={displayName} url={profile?.avatarUrl ?? user?.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-small-strong font-semibold text-ink">{displayName}</p>
              <p className="truncate text-caption text-ink-tertiary">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </>
      }
    >
      {actingAsStaff ? (
        <div
          role="status"
          className="mb-6 rounded-card border border-warning bg-warning-tint px-4 py-3 text-small text-ink"
        >
          <strong className="font-semibold">You are acting as Elevate staff.</strong> This is{' '}
          {displayName}’s profile, not yours. You can fix content and read the profile; prices,
          publishing and payouts stay with the teacher. Every change you make is recorded under your
          name.
        </div>
      ) : null}
      <Outlet />
    </PortalShell>
  )
}
