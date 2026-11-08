import type { TeacherProfileView, TeacherStripeView } from '@elevate/core'
import { unwrap } from '@elevate/web-ui/portal'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export const teachKeys = {
  profile: ['teach', 'profile'] as const,
  stripe: ['teach', 'stripe'] as const,
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

export async function startStripeOnboarding(): Promise<void> {
  const { url } = await unwrap(await api.teach.stripe['onboarding-link'].$post())
  window.location.assign(url)
}

export async function openStripeDashboard(): Promise<void> {
  const { url } = await unwrap(await api.teach.stripe['login-link'].$post())
  window.open(url, '_blank', 'noopener')
}
