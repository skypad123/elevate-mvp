import type { AuthUser, LocalePreference } from '@elevate/core'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api } from './api'
import { ApiError, unwrap } from './api-error'
import { usePreferences } from './preferences'
import { queryClient } from './query-client'
import { tokenStorage } from './token-storage'

export type SessionStatus = 'loading' | 'signed_out' | 'signed_in'

export type Session = {
  status: SessionStatus
  user: AuthUser | null
  isLoading: boolean
  isSignedIn: boolean
  signIn: (token: string, user: AuthUser) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  /**
   * Stores this device's language and, when signed in, sends it to the account. A failure,
   * offline included, is ignored and not retried.
   */
  chooseLocale: (next: LocalePreference) => Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const { ready, locale, setPreference, setAccountLocale } = usePreferences()
  // The one fill-in: an account with no language gets this device's guess, once per app run.
  const [needsFill, setNeedsFill] = useState(false)
  const filled = useRef(false)
  const localeRef = useRef(locale)
  localeRef.current = locale
  // Bumped on sign-in, sign-out and each language write. A PATCH /me response is applied only if
  // nothing newer happened, so a late one never puts back a signed-out user or an older write.
  const epoch = useRef(0)

  useEffect(() => {
    setAccountLocale(user?.localeChosen ? user.locale : null)
  }, [user, setAccountLocale])

  const refreshUser = useCallback(async () => {
    const token = await tokenStorage.get()
    if (!token) {
      setUser(null)
      setStatus('signed_out')
      return
    }
    try {
      const { user: me } = await unwrap(await api.auth.me.$get())
      setUser(me)
      setStatus('signed_in')
      if (me.locale === null) setNeedsFill(true)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await tokenStorage.clear()
        setUser(null)
        setStatus('signed_out')
      } else {
        // Offline or API down: keep the session, show cached-less UI.
        setStatus('signed_in')
      }
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  // Runs on `ready` and the refresh result only; it reads the language without watching it.
  useEffect(() => {
    if (!ready || !needsFill || filled.current) return
    filled.current = true
    const mine = ++epoch.current
    void (async () => {
      try {
        const { user: updated } = await unwrap(
          await api.me.$patch({ json: { locale: localeRef.current, localeChosen: false } }),
        )
        if (epoch.current === mine) setUser(updated)
      } catch {
        // ignored: nothing is retried
      }
    })()
  }, [ready, needsFill])

  const signIn = useCallback(async (token: string, nextUser: AuthUser) => {
    epoch.current++
    await tokenStorage.set(token)
    setUser(nextUser)
    setStatus('signed_in')
  }, [])

  const signOut = useCallback(async () => {
    epoch.current++
    try {
      await api.auth['sign-out'].$post()
    } catch {
      // best effort; the token is removed locally regardless
    }
    await tokenStorage.clear()
    queryClient.clear()
    setUser(null)
    setStatus('signed_out')
  }, [])

  const chooseLocale = useCallback(
    async (next: LocalePreference) => {
      setPreference('locale', next)
      if (status !== 'signed_in') return
      const mine = ++epoch.current
      try {
        const { user: updated } = await unwrap(
          await api.me.$patch({
            json:
              next === 'system' ? { localeChosen: false } : { locale: next, localeChosen: true },
          }),
        )
        if (epoch.current === mine) setUser(updated)
      } catch {
        // ignored: the device still shows its choice, and nothing is retried
      }
    },
    [status, setPreference],
  )

  const value = useMemo<Session>(
    () => ({
      status,
      user,
      isLoading: status === 'loading',
      isSignedIn: status === 'signed_in',
      signIn,
      signOut,
      refreshUser,
      chooseLocale,
    }),
    [status, user, signIn, signOut, refreshUser, chooseLocale],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
