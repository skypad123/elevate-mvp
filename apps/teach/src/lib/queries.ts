import type {
  CourseEarningsView,
  EarningsView,
  ReconciliationView,
  StripeStatusView,
} from '@elevate/core'
import { useToast } from '@elevate/web-ui'
import { ApiError, errorMessage, unwrap } from '@elevate/web-ui/portal'
import { useT } from '@elevate/web-ui/preferences'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api } from './api'
import { teachKeys } from './keys'
import { useCurrentProfile } from './profile'

/** Every call below is for the profile in the URL. */
const scoped = api.teach.profiles[':profileId']

export function useStripeStatus(enabled = true) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: teachKeys.stripe(profileId),
    enabled,
    queryFn: async () =>
      (await unwrap(await scoped.stripe.status.$get({ param: { profileId } })))
        .stripe as StripeStatusView,
    staleTime: 60_000,
  })
}

export function useEarnings(enabled = true) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: teachKeys.earnings(profileId),
    enabled,
    queryFn: async () =>
      (await unwrap(await scoped.earnings.$get({ param: { profileId } }))).earnings as EarningsView,
  })
}

export function useCourseEarnings(id: string) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: teachKeys.courseEarnings(profileId, id),
    enabled: !!id,
    queryFn: async () =>
      (await unwrap(await scoped.earnings.courses[':id'].$get({ param: { profileId, id } })))
        .earnings as CourseEarningsView,
  })
}

/** Manual: call `refetch()` to compare the ledger with Stripe's transfers. */
export function useReconciliation() {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: teachKeys.reconciliation(profileId),
    enabled: false,
    retry: false,
    queryFn: async () =>
      (await unwrap(await scoped.earnings.reconcile.$get({ param: { profileId } })))
        .reconciliation as ReconciliationView,
  })
}

/**
 * The two Stripe links: onboarding and the dashboard. Both are for the profile's owner and need
 * a sign-in from the last 24 hours. When the API asks for a fresh sign-in, the user is sent to
 * sign in and comes back to the page they were on.
 */
export function useStripeLinks() {
  const { profileId } = useCurrentProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const t = useT()
  const [busy, setBusy] = useState(false)

  /** `reauth`: the user is on their way to sign in again and will come back to this page. */
  const run = useCallback(
    async (action: () => Promise<void>): Promise<'done' | 'reauth' | 'failed'> => {
      setBusy(true)
      try {
        await action()
        return 'done'
      } catch (error) {
        if (error instanceof ApiError && error.code === 'reauth_required') {
          toast({
            tone: 'info',
            title: t('payments.reauth.title'),
            description: t('payments.reauth.description'),
          })
          const back = encodeURIComponent(location.pathname + location.search)
          navigate(`/sign-in?redirect=${back}`)
          return 'reauth'
        }
        toast({ tone: 'danger', title: 'Stripe', description: errorMessage(error) })
        return 'failed'
      } finally {
        setBusy(false)
      }
    },
    [navigate, location.pathname, location.search, toast, t],
  )

  const connect = useCallback(
    () =>
      run(async () => {
        const { url } = await unwrap(
          await scoped.stripe['onboarding-link'].$post({ param: { profileId } }),
        )
        window.location.assign(url)
      }),
    [run, profileId],
  )
  const openDashboard = useCallback(
    () =>
      run(async () => {
        const { url } = await unwrap(
          await scoped.stripe['login-link'].$post({ param: { profileId } }),
        )
        window.open(url, '_blank', 'noopener')
      }),
    [run, profileId],
  )
  return { busy, connect, openDashboard }
}
