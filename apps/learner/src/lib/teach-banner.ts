import type { AuthUser } from '@elevate/core'
import { useCallback, useEffect, useState } from 'react'
import { useSession } from './session'
import { readDismissedAt, writeDismissedAt } from './teach-banner-storage'

/** How long a closed banner stays hidden on that device: 30 days. */
export const TEACH_BANNER_HIDE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Whether the loaded account owns a teaching profile, whatever its status. Members (managers and
 * writers) are not owners, and nor is a session whose account could not be loaded.
 */
export function isProfileOwner(user: AuthUser | null): boolean {
  return user?.profiles.some((p) => p.role === 'owner') ?? false
}

/**
 * Whether Explore shows the Teach banner, and how to close it. Hidden from owners, for 30 days
 * after it was closed on this device, while searching, and until the first page of courses has
 * loaded (`loaded`). It also waits for the session and the stored time to be read.
 */
export function useTeachBanner({ searching, loaded }: { searching: boolean; loaded: boolean }): {
  visible: boolean
  dismiss: () => void
} {
  const { isLoading, user } = useSession()
  // undefined until the stored time has been read; null when it was never closed
  const [dismissedAt, setDismissedAt] = useState<number | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    void readDismissedAt().then((at) => {
      // A close pressed while the read was pending wins over the stored value
      if (live) setDismissedAt((current) => (current === undefined ? at : current))
    })
    return () => {
      live = false
    }
  }, [])

  const dismiss = useCallback(() => {
    const now = Date.now()
    setDismissedAt(now)
    void writeDismissedAt(now)
  }, [])

  const recentlyClosed =
    dismissedAt === undefined ||
    (dismissedAt !== null && Date.now() - dismissedAt < TEACH_BANNER_HIDE_MS)
  const visible = !isLoading && loaded && !searching && !recentlyClosed && !isProfileOwner(user)
  return { visible, dismiss }
}
