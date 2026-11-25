import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { readInitialPath } from './initial-path'

/**
 * The routes `app/_layout.tsx` and `app/(tabs)/_layout.tsx` guard with `isSignedIn`. Keep this in
 * step with those `Protected` groups.
 */
const SIGNED_IN_ONLY = [
  /^\/learning\/?$/,
  /^\/profile\/?$/,
  /^\/checkout\//,
  /^\/learn\//,
  // The class screen, not the check-in screen (`/class/check-in/<id>`), which opens signed out.
  /^\/class\/[^/]+\/?$/,
]

export function needsSignIn(path: string): boolean {
  const pathname = path.split('?')[0] ?? ''
  return SIGNED_IN_ONLY.some((route) => route.test(pathname))
}

/**
 * A signed-out visitor who opened a link to a protected route (Stripe's return page, a lesson, My
 * Learning) is sent to sign-in, and back to that address afterwards, query and `lang` included.
 * The guards alone would drop them on Explore. Only the address the app opened on counts: moving
 * around inside the app, or signing out, keeps the guards' behaviour.
 */
export function useSignInForOpenedLink({
  ready,
  isSignedIn,
}: {
  ready: boolean
  isSignedIn: boolean
}) {
  const router = useRouter()
  const handled = useRef(false)
  useEffect(() => {
    if (!ready || handled.current) return
    handled.current = true
    if (isSignedIn) return
    let cancelled = false
    void readInitialPath().then((path) => {
      if (cancelled || !path || !needsSignIn(path)) return
      router.replace({ pathname: '/sign-in', params: { redirect: path } })
    })
    return () => {
      cancelled = true
    }
  }, [ready, isSignedIn, router])
}
