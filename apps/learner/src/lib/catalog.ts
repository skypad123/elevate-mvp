import type {
  CatalogSort,
  CategoryCount,
  CheckoutStartResponse,
  CheckoutSyncResponse,
  ClassCheckoutView,
  CourseCard,
  CoursePublicView,
  EnrollmentSummary,
  Locale,
  Page,
  QuoteResponse,
} from '@elevate/core'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from './api'
import { unwrap } from './api-error'

export const catalogKeys = {
  categories: ['catalog', 'categories'] as const,
  list: (params: { q?: string; category?: string; sort: CatalogSort }) =>
    ['catalog', 'courses', params] as const,
  detail: (slug: string) => ['catalog', 'course', slug] as const,
  enrollments: ['me', 'enrollments'] as const,
  quote: (courseId: string, promo: string) => ['checkout', 'quote', courseId, promo] as const,
}

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: async () =>
      (await unwrap(await api.catalog.categories.$get())).items as CategoryCount[],
    staleTime: 5 * 60_000,
  })
}

export function useCourseList(params: { q?: string; category?: string; sort: CatalogSort }) {
  return useInfiniteQuery({
    queryKey: catalogKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string> = { sort: params.sort, limit: '12' }
      if (params.q) query.q = params.q
      if (params.category) query.category = params.category
      if (pageParam) query.cursor = pageParam
      return (await unwrap(await api.catalog.courses.$get({ query }))) as Page<CourseCard>
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function useCourseDetail(slug: string, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.detail(slug),
    enabled: enabled && !!slug,
    queryFn: async () =>
      (await unwrap(await api.catalog.courses[':slug'].$get({ param: { slug } })))
        .course as CoursePublicView,
  })
}

export function useEnrollments(enabled: boolean) {
  return useQuery({
    queryKey: catalogKeys.enrollments,
    enabled,
    queryFn: async () =>
      (await unwrap(await api.me.enrollments.$get())).items as EnrollmentSummary[],
  })
}

export async function fetchQuote(courseId: string, promoCode?: string): Promise<QuoteResponse> {
  return (await unwrap(
    await api.checkout.quote.$post({ json: { courseId, ...(promoCode ? { promoCode } : {}) } }),
  )) as QuoteResponse
}

/** `locale` is the language on screen; Stripe's page and the return URLs follow it. */
export async function startCheckout(
  courseId: string,
  { locale, promoCode }: { locale: Locale; promoCode?: string },
): Promise<CheckoutStartResponse> {
  return (await unwrap(
    await api.checkout.courses[':id'].$post({
      param: { id: courseId },
      json: { locale, ...(promoCode ? { promoCode } : {}) },
    }),
  )) as CheckoutStartResponse
}

export async function syncCheckout(sessionId: string): Promise<CheckoutSyncResponse> {
  return (await unwrap(
    await api.checkout.sessions[':id'].sync.$get({ param: { id: sessionId } }),
  )) as CheckoutSyncResponse
}

/**
 * What the class checkout page shows: the class, the quote and the refund terms version. A promo
 * code that makes the seat free, or the price under the minimum charge, is refused.
 */
export async function fetchClassCheckout(
  classId: string,
  promoCode?: string,
): Promise<ClassCheckoutView> {
  // The route reads `promoCode` without a validator, so the typed client does not list it; the
  // client still sends a `query` it is given.
  const args = { param: { classId }, ...(promoCode ? { query: { promoCode } } : {}) }
  return (await unwrap(
    await api.checkout.classes[':classId'].$get(args as { param: { classId: string } }),
  )) as ClassCheckoutView
}

/**
 * Starts paying for a seat. `termsVersion` is the refund terms version the page showed; the API
 * refuses one that is no longer current with `terms_changed`.
 */
export async function startClassCheckout(
  classId: string,
  { locale, promoCode, termsVersion }: { locale: Locale; promoCode?: string; termsVersion: string },
): Promise<CheckoutStartResponse> {
  return (await unwrap(
    await api.checkout.classes[':classId'].$post({
      param: { classId },
      json: { locale, termsVersion, ...(promoCode ? { promoCode } : {}) },
    }),
  )) as CheckoutStartResponse
}
