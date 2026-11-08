import type {
  CourseEarningsView,
  EarningsView,
  ReconciliationView,
  TeacherProfileView,
  TeacherStripeView,
} from '@elevate/core'
import { unwrap } from '@elevate/web-ui/portal'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export const teachKeys = {
  profile: ['teach', 'profile'] as const,
  stripe: ['teach', 'stripe'] as const,
  earnings: ['teach', 'earnings'] as const,
  courseEarnings: (id: string) => ['teach', 'earnings', 'course', id] as const,
  reconciliation: ['teach', 'earnings', 'reconcile'] as const,
}

export function useTeacherProfile() {
  return useQuery({
    queryKey: teachKeys.profile,
    queryFn: async () =>
      (await unwrap(await api.teach.profile.$get())).profile as TeacherProfileView | null,
  })
}

export function useStripeStatus(enabled: boolean) {
  return useQuery({
    queryKey: teachKeys.stripe,
    enabled,
    queryFn: async () =>
      (await unwrap(await api.teach.stripe.status.$get())).stripe as TeacherStripeView,
    staleTime: 60_000,
  })
}

export function useEarnings(enabled = true) {
  return useQuery({
    queryKey: teachKeys.earnings,
    enabled,
    queryFn: async () => (await unwrap(await api.teach.earnings.$get())).earnings as EarningsView,
  })
}

export function useCourseEarnings(id: string) {
  return useQuery({
    queryKey: teachKeys.courseEarnings(id),
    enabled: !!id,
    queryFn: async () =>
      (await unwrap(await api.teach.earnings.courses[':id'].$get({ param: { id } })))
        .earnings as CourseEarningsView,
  })
}

/** Manual: call `refetch()` to compare the ledger with Stripe's transfers. */
export function useReconciliation() {
  return useQuery({
    queryKey: teachKeys.reconciliation,
    enabled: false,
    retry: false,
    queryFn: async () =>
      (await unwrap(await api.teach.earnings.reconcile.$get()))
        .reconciliation as ReconciliationView,
  })
}

export async function startStripeOnboarding(): Promise<void> {
  const { url } = await unwrap(await api.teach.stripe['onboarding-link'].$post())
  window.location.assign(url)
}

export async function openStripeDashboard(): Promise<void> {
  const { url } = await unwrap(await api.teach.stripe['login-link'].$post())
  window.open(url, '_blank', 'noopener')
}
