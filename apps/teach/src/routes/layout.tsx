import { Avatar, Button, NativeSelect, PortalShell } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { fillSlots, useT } from '@elevate/web-ui/preferences'
import { BookOpen, LayoutDashboard, LogOut, Settings, Users, Wallet } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router'
import { useCurrentProfile } from '../lib/profile'
import { profilePath } from '../lib/urls'

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
  const t = useT()
  const profiles = user?.profiles ?? []
  if (profiles.length === 0 && !staffLabel) return null
  return (
    <NativeSelect
      label={t('switcher.label')}
      aria-label={t('switcher.ariaLabel')}
      value={current ?? ''}
      wrapperClassName={className}
      onChange={(e) =>
        navigate(e.target.value === NEW_COMPANY ? '/apply/company' : profilePath(e.target.value))
      }
    >
      {current ? null : (
        <option value="" disabled>
          {t('switcher.placeholder')}
        </option>
      )}
      {current && staffLabel ? (
        <option value={current}>{t('switcher.option.staff', { name: staffLabel })}</option>
      ) : null}
      {/* An approved profile shows its name alone; the others say where they stand. */}
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.status === 'approved'
            ? p.displayName
            : t(`switcher.option.${p.status}`, { name: p.displayName })}
        </option>
      ))}
      <option value={NEW_COMPANY}>{t('switcher.createCompany')}</option>
    </NativeSelect>
  )
}

export function TeachLayout() {
  const { user, signOut } = usePortalAuth()
  const { path, profileId, displayName, actingAsStaff, profile, can } = useCurrentProfile()
  const t = useT()
  return (
    <PortalShell
      portal="Teach"
      tone="brand"
      items={[
        { to: path(), label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: path('/courses'), label: t('nav.courses'), icon: BookOpen },
        // A writer has no earnings or members page: the API would refuse both.
        ...(can('earnings.read')
          ? [{ to: path('/earnings'), label: t('nav.earnings'), icon: Wallet }]
          : []),
        ...(can('members.read')
          ? [{ to: path('/members'), label: t('nav.members'), icon: Users }]
          : []),
        { to: path('/settings'), label: t('nav.settings'), icon: Settings },
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
            <Button variant="ghost" size="icon" aria-label={t('nav.signOut')} onClick={signOut}>
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
          {fillSlots(t('staffBanner.sentences'), {
            first: <strong className="font-semibold">{t('staffBanner.title')}</strong>,
            second: t('staffBanner.body', { name: displayName }),
          })}
        </div>
      ) : null}
      <Outlet />
    </PortalShell>
  )
}
