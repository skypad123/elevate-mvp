import type { Audience, AuthUser, Role } from '@elevate/core'
import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Navigate, useLocation } from 'react-router'
import { Spinner } from '../components/Spinner'
import { ApiError, type PortalApi, type TokenStore, unwrap } from './api'

export type PortalSession = {
  status: 'loading' | 'signed_out' | 'signed_in'
  user: AuthUser | null
  signIn: (token: string, user: AuthUser) => void
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  hasRole: (...roles: Role[]) => boolean
  audience: Audience
}

const Ctx = createContext<PortalSession | null>(null)

export function PortalAuthProvider({
  api,
  tokenStore,
  audience,
  children,
}: {
  api: PortalApi
  tokenStore: TokenStore
  audience: Audience
  children: ReactNode
}) {
  const [status, setStatus] = useState<PortalSession['status']>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const queryClient = useQueryClient()

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) {
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
        tokenStore.clear()
        setUser(null)
        setStatus('signed_out')
      } else {
        setStatus('signed_in')
      }
    }
  }, [api, tokenStore])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const signIn = useCallback(
    (token: string, nextUser: AuthUser) => {
      tokenStore.set(token)
      setUser(nextUser)
      setStatus('signed_in')
    },
    [tokenStore],
  )

  const signOut = useCallback(async () => {
    try {
      await api.auth['sign-out'].$post()
    } catch {
      // best effort
    }
    tokenStore.clear()
    queryClient.clear()
    setUser(null)
    setStatus('signed_out')
  }, [api, tokenStore, queryClient])

  const value = useMemo<PortalSession>(
    () => ({
      status,
      user,
      signIn,
      signOut,
      refreshUser,
      audience,
      hasRole: (...roles) =>
        !!user && (user.roles.includes('super_admin') || roles.some((r) => user.roles.includes(r))),
    }),
    [status, user, signIn, signOut, refreshUser, audience],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePortalAuth(): PortalSession {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePortalAuth must be used inside PortalAuthProvider')
  return ctx
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 text-ink-secondary">
      <Spinner className="size-6 text-brand" />
      <p className="text-small">{label}</p>
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = usePortalAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  if (status === 'signed_out')
    return (
      <Navigate
        to={`/sign-in?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  return <>{children}</>
}

export function RequireRole({
  roles,
  children,
  fallback,
}: {
  roles: Role[]
  children: ReactNode
  fallback: ReactNode
}) {
  const { hasRole, status } = usePortalAuth()
  if (status === 'loading') return <FullPageSpinner />
  return hasRole(...roles) ? <>{children}</> : <>{fallback}</>
}
