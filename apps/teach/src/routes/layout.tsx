import { Avatar, Button, NativeSelect, PortalShell } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { BookOpen, LayoutDashboard, LogOut, Settings, Users, Wallet } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router'
import { useCurrentProfile } from '../lib/profile'
import { profilePath } from '../lib/urls'

const STATUS_NOTE = { applied: 'under review', rejected: 'not approved', approved: '' } as const
const NEW_COMPANY = 'new-company'

/**
 * The user's profiles, and the way to start a company profile. Choosing a profile opens its
 * dashboard. `current` is the profile on screen; `staffLabel` names it when the user is platform
 * staff acting on a profile that is not in their own list.
 */
export function ProfileSwitcher({
  current,
  staffLabel,
  className,
}: {
  current?: string
  staffLabel?: string
  className?: string
}) {
  const { user } = usePortalAuth()
  const navigate = useNavigate()
  const profiles = user?.profiles ?? []
  if (profiles.length === 0 && !staffLabel) return null
  return (
    <NativeSelect
      label="Profile"
      aria-label="Switch profile"
      value={current ?? ''}
      wrapperClassName={className}
      onChange={(e) =>
        navigate(e.target.value === NEW_COMPANY ? '/apply/company' : profilePath(e.target.value))
      }
    >
      {current ? null : (
        <option value="" disabled>
          Your profiles…
        </option>
      )}
      {current && staffLabel ? <option value={current}>{staffLabel} (as staff)</option> : null}
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.displayName}
          {p.status === 'approved' ? '' : ` (${STATUS_NOTE[p.status]})`}
        </option>
      ))}
      <option value={NEW_COMPANY}>+ Create a company profile…</option>
    </NativeSelect>
  )
}

export function TeachLayout() {
  const { user, signOut } = usePortalAuth()
  const { path, profileId, displayName, actingAsStaff, profile, can } = useCurrentProfile()
  return (
    <PortalShell
      portal="Teach"
      tone="brand"
      items={[
        { to: path(), label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: path('/courses'), label: 'Courses', icon: BookOpen },
        // A writer has no earnings or members page: the API would refuse both.
        ...(can('earnings.read')
          ? [{ to: path('/earnings'), label: 'Earnings', icon: Wallet }]
          : []),
        ...(can('members.read') ? [{ to: path('/members'), label: 'Members', icon: Users }] : []),
        { to: path('/settings'), label: 'Settings', icon: Settings },
      ]}
      footer={
        <>
          <ProfileSwitcher
            current={profileId}
            staffLabel={actingAsStaff ? displayName : undefined}
            className="mb-3"
          />
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
