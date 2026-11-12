import {
  type ActorRole,
  type Capability,
  can,
  type ProfileStatus,
  type ProfileType,
  type ProfileView,
} from '@elevate/core'
import { Button, EmptyState } from '@elevate/web-ui'
import { FullPageSpinner, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { useQuery } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { api } from './api'
import { teachKeys } from './keys'
import { profilePath } from './urls'

const LAST_PROFILE_KEY = 'elevate.teach.lastProfile'

/** The profile last opened in this browser; the home page goes back to it. Client-side only. */
export function lastProfileId(): string | null {
  try {
    return window.localStorage.getItem(LAST_PROFILE_KEY)
  } catch {
    return null
  }
}

function rememberProfile(profileId: string): void {
  try {
    window.localStorage.setItem(LAST_PROFILE_KEY, profileId)
  } catch {
    // private mode: the home page falls back to the first profile
  }
}

export type CurrentProfile = {
  profileId: string
  /** `staff` is a super admin acting inside a profile they do not belong to. */
  role: ActorRole
  type: ProfileType
  status: ProfileStatus
  displayName: string
  actingAsStaff: boolean
  /** The whole profile (commission, payout account, application), once loaded. */
  profile: ProfileView | undefined
  /** The same rule the API enforces, so screens hide what the API would refuse. */
  can: (capability: Capability) => boolean
  /** A path inside this profile: `path('/courses')` is `/p/<id>/courses`. */
  path: (sub?: string) => string
}

const Ctx = createContext<CurrentProfile | null>(null)

/** One profile as the caller may see it. Members and staff get it; anyone else gets a 404. */
export function useProfileView(profileId: string | undefined) {
  return useQuery({
    queryKey: teachKeys.profile(profileId ?? ''),
    enabled: !!profileId,
    retry: false,
    queryFn: async () =>
      (
        await unwrap(
          await api.teach.profiles[':profileId'].profile.$get({
            param: { profileId: profileId as string },
          }),
        )
      ).profile as ProfileView,
  })
}

/**
 * Wraps every page under `/p/:profileId`. It works out who the user is on that profile:
 *
 * - a profile in the user's own list gives their role on it;
 * - otherwise the API is asked, and a profile it returns with `actingAsStaff` makes the user
 *   staff (this is how a super admin opening a teacher's profile is recognised);
 * - anything else is "profile not found".
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { profileId = '' } = useParams()
  const { user } = usePortalAuth()
  const mine = user?.profiles.find((p) => p.id === profileId)
  const query = useProfileView(profileId)
  const view = query.data
  const role: ActorRole | null = mine ? mine.role : view?.actingAsStaff ? 'staff' : null

  const value = useMemo<CurrentProfile | null>(() => {
    const type = view?.type ?? mine?.type
    const status = view?.status ?? mine?.status
    if (!role || !type || !status) return null
    return {
      profileId,
      role,
      type,
      status,
      displayName: view?.displayName ?? mine?.displayName ?? '',
      actingAsStaff: role === 'staff',
      profile: view,
      can: (capability) => can({ role, profileType: type, profileStatus: status }, capability),
      path: (sub = '') => profilePath(profileId, sub),
    }
  }, [profileId, role, mine, view])

  useEffect(() => {
    if (value) rememberProfile(value.profileId)
  }, [value])

  if (value) return <Ctx.Provider value={value}>{children}</Ctx.Provider>
  if (query.isPending) return <FullPageSpinner />
  return (
    <div className="mx-auto max-w-xl px-4 py-24">
      <EmptyState
        tone="danger"
        title="Profile not found"
        body="This teaching profile does not exist, or your account is not part of it."
        action={
          <Link to="/">
            <Button variant="secondary">Go to your profiles</Button>
          </Link>
        }
      />
    </div>
  )
}

export function useCurrentProfile(): CurrentProfile {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCurrentProfile must be used under /p/:profileId')
  return ctx
}
