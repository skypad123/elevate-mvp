import type { AuthUser } from '@elevate/core'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { api } from './api'
import { ApiError, unwrap } from './api-error'
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
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

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

  const signIn = useCallback(async (token: string, nextUser: AuthUser) => {
    await tokenStorage.set(token)
    setUser(nextUser)
    setStatus('signed_in')
  }, [])

  const signOut = useCallback(async () => {
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

  const value = useMemo<Session>(
    () => ({
      status,
      user,
      isLoading: status === 'loading',
      isSignedIn: status === 'signed_in',
      signIn,
      signOut,
      refreshUser,
    }),
    [status, user, signIn, signOut, refreshUser],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
