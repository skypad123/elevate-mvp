import type {
  AnalyticsSummary,
  AuditEntry,
  NameCheckView,
  Page,
  PayoutLedgerRow,
  PersonDetail,
  PersonSummary,
  SupportProfileDetail,
  SupportProfileSummary,
  TransactionDetail,
  TransactionSummary,
} from '@elevate/core'
import { unwrap } from '@elevate/web-ui/portal'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from './api'

export type PeopleFilter = {
  q?: string
  role?: 'learner' | 'staff'
}

export const supportKeys = {
  people: (filter: PeopleFilter) => ['support', 'people', filter] as const,
  person: (id: string) => ['support', 'person', id] as const,
}

export function usePeople(filter: PeopleFilter, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: supportKeys.people(filter),
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const query: Record<string, string> = { limit: '50' }
      if (filter.q) query.q = filter.q
      if (filter.role) query.role = filter.role
      return (await unwrap(await api.support.people.$get({ query }))) as Page<PersonSummary>
    },
  })
}

export function usePerson(id: string) {
  return useQuery({
    queryKey: supportKeys.person(id),
    queryFn: async () =>
      (await unwrap(await api.support.people[':id'].$get({ param: { id } })))
        .person as PersonDetail,
  })
}

// ── teaching profiles ───────────────────────────────────────────────────────
export type ProfilesFilter = {
  q?: string
  status?: 'applied' | 'approved' | 'rejected'
  type?: 'personal' | 'corporate'
}

export const profileKeys = {
  all: ['support', 'profiles'] as const,
  list: (filter: ProfilesFilter) => ['support', 'profiles', 'list', filter] as const,
  detail: (id: string) => ['support', 'profiles', 'detail', id] as const,
  nameCheck: (id: string) => ['support', 'profiles', 'name-check', id] as const,
}

export function useProfiles(filter: ProfilesFilter) {
  return useQuery({
    queryKey: profileKeys.list(filter),
    queryFn: async () => {
      const query: Record<string, string> = { limit: '50' }
      if (filter.q) query.q = filter.q
      if (filter.status) query.status = filter.status
      if (filter.type) query.type = filter.type
      return (await unwrap(
        await api.support.profiles.$get({ query }),
      )) as Page<SupportProfileSummary>
    },
  })
}

/** A profile with its courses, payout accounts and earnings totals. */
export function useProfile(id: string) {
  return useQuery({
    queryKey: profileKeys.detail(id),
    enabled: !!id,
    queryFn: async () =>
      (await unwrap(
        await api.support.profiles[':id'].$get({ param: { id } }),
      )) as SupportProfileDetail,
  })
}

/**
 * The legal name Stripe holds for a company's payout account, beside the company's own. It reads
 * Stripe, so it runs only once the company has started Stripe onboarding.
 */
export function useNameCheck(profileId: string, enabled: boolean) {
  return useQuery({
    queryKey: profileKeys.nameCheck(profileId),
    enabled: enabled && !!profileId,
    queryFn: async () =>
      (
        await unwrap(
          await api.support.profiles[':id']['payout-account']['name-check'].$get({
            param: { id: profileId },
          }),
        )
      ).nameCheck as NameCheckView,
  })
}

export const reviewKeys = {
  queue: ['support', 'review-queue'] as const,
  course: (id: string) => ['support', 'course', id] as const,
}

export function useReviewQueue() {
  return useQuery({
    queryKey: reviewKeys.queue,
    queryFn: async () =>
      (await unwrap(await api.support['review-queue'].$get()))
        .items as import('@elevate/core').CourseSummary[],
  })
}

export function useReviewCourse(id: string) {
  return useQuery({
    queryKey: reviewKeys.course(id),
    queryFn: async () =>
      (await unwrap(await api.support.courses[':id'].$get({ param: { id } })))
        .course as import('@elevate/core').CourseView,
  })
}

// ── transactions, payouts, audit ────────────────────────────────────────────
export type TransactionsFilter = { q?: string; status?: TransactionSummary['status'] }

export const transactionKeys = {
  all: ['support', 'transactions'] as const,
  list: (filter: TransactionsFilter) => ['support', 'transactions', 'list', filter] as const,
  detail: (id: string) => ['support', 'transactions', 'detail', id] as const,
  payouts: ['support', 'payouts'] as const,
  audit: ['support', 'audit'] as const,
}

export function useTransactions(filter: TransactionsFilter) {
  return useInfiniteQuery({
    queryKey: transactionKeys.list(filter),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string> = { limit: '25' }
      if (filter.q) query.q = filter.q
      if (filter.status) query.status = filter.status
      if (pageParam) query.cursor = pageParam
      return (await unwrap(
        await api.support.transactions.$get({ query }),
      )) as Page<TransactionSummary>
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    enabled: !!id,
    queryFn: async () =>
      (await unwrap(await api.support.transactions[':id'].$get({ param: { id } })))
        .transaction as TransactionDetail,
  })
}

export function usePayouts() {
  return useQuery({
    queryKey: transactionKeys.payouts,
    queryFn: async () =>
      (await unwrap(await api.support.payouts.$get())).items as PayoutLedgerRow[],
  })
}

export function useAuditLog() {
  return useInfiniteQuery({
    queryKey: transactionKeys.audit,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (await unwrap(
        await api.support['audit-log'].$get({ query: pageParam ? { cursor: pageParam } : {} }),
      )) as Page<AuditEntry>,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['support', 'analytics'] as const,
    queryFn: async () =>
      (await unwrap(await api.support.analytics.$get())).analytics as AnalyticsSummary,
  })
}
