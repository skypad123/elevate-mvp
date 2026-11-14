import { Avatar, Button, Menu, type MenuEntry, PortalShell } from '@elevate/web-ui'
import { usePortalAuth } from '@elevate/web-ui/portal'
import { fillSlots, useT } from '@elevate/web-ui/preferences'
import {
  BookOpen,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  Wallet,
} from 'lucide-react'
import { Outlet } from 'react-router'
import { useCourses } from '../lib/courses'
import { useCurrentProfile } from '../lib/profile'
import { profilePath } from '../lib/urls'

/**
 * The user's profiles, and the way to start a company profile, as a menu of links: choosing one
 * opens its dashboard. Each entry says the user's role on it, so someone who owns one profile and
 * writes for another can tell which they are in. `current` is the profile on screen;
 * `staffLabel` names it when the user is platform staff on a profile that is not in their list.
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
  const t = useT()
  const profiles = user?.profiles ?? []
  if (profiles.length === 0 && !staffLabel) return null

  const entries: MenuEntry[] = profiles.map((p) => ({
    key: p.id,
    label: p.displayName,
    detail: t(`switcher.detail.${p.status}`, { role: t(`profileRole.${p.role}`) }),
    to: profilePath(p.id),
    current: p.id === current,
  }))
  if (current && staffLabel)
    entries.unshift({
      key: current,
      label: staffLabel,
      detail: t('switcher.detail.staff'),
      to: profilePath(current),
      current: true,
    })
  const shown = entries.find((e) => e.current)

  return (
    <div className={className}>
      <p className="mb-1.5 px-1 text-small-strong font-semibold text-ink-secondary">
        {t('switcher.label')}
      </p>
      <Menu
        label={t('switcher.ariaLabel')}
        entries={entries}
        footer={[{ key: 'new-company', label: t('switcher.createCompany'), to: '/apply/company' }]}
        trigger={
          <button
            type="button"
            aria-label={t('switcher.ariaLabel')}
            className="flex w-full items-center gap-2 rounded-control border border-border-strong bg-surface px-3 py-2 text-left text-small text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {shown?.label ?? t('switcher.placeholder')}
              </span>
              {shown?.detail ? (
                <span className="block truncate text-caption text-ink-tertiary">
                  {shown.detail}
                </span>
              ) : null}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-ink-tertiary" />
          </button>
        }
      />
    </div>
  )
}

export function TeachLayout() {
  const { user, signOut } = usePortalAuth()
  const { path, profileId, displayName, actingAsStaff, profile, can } = useCurrentProfile()
  const t = useT()
  // Owners and managers learn here, on every page, that a writer's edits wait for them.
  const reviews = can('changeSet.review')
  const courses = useCourses()
  const waiting = reviews ? (courses.data ?? []).filter((c) => c.pendingChanges).length : 0
  return (
    <PortalShell
      portal="Teach"
      tone="brand"
      items={[
        { to: path(), label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        {
          to: path('/courses'),
          label: t('nav.courses'),
          icon: BookOpen,
          badge: waiting,
          badgeLabel: t(
            waiting === 1 ? 'teachNav.changesWaiting.one' : 'teachNav.changesWaiting.other',
            { count: waiting },
          ),
        },
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
      {actingAsStaff ? <StaffBanner name={displayName} /> : null}
      <Outlet />
    </PortalShell>
  )
}

/** Above every page of a profile that Elevate staff have opened but do not belong to. */
export function StaffBanner({ name }: { name: string }) {
  const t = useT()
  return (
    <div
      role="status"
      className="mb-6 rounded-card border border-warning bg-warning-tint px-4 py-3 text-small text-ink"
    >
      {fillSlots(t('staffBanner.sentences'), {
        first: <strong className="font-semibold">{t('staffBanner.title')}</strong>,
        second: t('staffBanner.body', { name }),
      })}
    </div>
  )
}
