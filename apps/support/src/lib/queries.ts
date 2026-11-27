import type {
  AnalyticsSummary,
  AuditEntry,
  Correction,
  ElevateCancelClass,
  EraseCoordinatesResult,
  NameCheckView,
  Page,
  PayoutLedgerRow,
  PersonDetail,
  PersonSummary,
  RefundRowAction,
  SeatRefundView,
  SupportClass,
  SupportClassBlock,
  SupportClassSummary,
  SupportFeatures,
  SupportPayoutsOverview,
  SupportProfileDetail,
  SupportProfileSummary,
  TransactionDetail,
  TransactionSummary,
} from '@elevate/core'
import { unwrap } from '@elevate/web-ui/portal'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
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

/**
 * Deletes every location reading of one learner's check-ins and attempts, for a super admin, with
 * the reason kept in the audit log (docs/runbooks/erase-coordinates.md). Final.
 */
export async function eraseCoordinates(userId: string, reason: string) {
  return (await unwrap(
    await api.support.learners[':userId']['erase-coordinates'].$post({
      param: { userId },
      json: { reason },
    }),
  )) as EraseCoordinatesResult
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
    // Keep the rows on screen while the next search loads, instead of flashing a skeleton.
    placeholderData: keepPreviousData,
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

// ── held class money and payouts (docs/designs/scheduled-classes-selling.md) ──
export const payoutKeys = {
  /** Under `transactionKeys.payouts`, so a refund that refreshes the ledger refreshes this too. */
  overview: ['support', 'payouts', 'overview'] as const,
}

/**
 * The release job's state and the cases that need a person: the last finished run, classes under
 * review, refunds that wait or failed, unfinished cancellations, day-limit releases, failed
 * payouts, unnamed money and the recent runs.
 */
export function usePayoutsOverview() {
  return useQuery({
    queryKey: payoutKeys.overview,
    queryFn: async () =>
      (await unwrap(await api.support.payouts.overview.$get())).overview as SupportPayoutsOverview,
  })
}

/** Releases a class under review, with a note; the next run releases its money. Super admin. */
export async function clearReview(classId: string, note: string) {
  return (
    await unwrap(
      await api.support.classes[':id']['clear-review'].$post({
        param: { id: classId },
        json: { note },
      }),
    )
  ).review
}

/**
 * Elevate cancels a class on one of the grounds of G17, with a note. Every active seat gets a
 * full refund row, sent by the next run, and the profile's owner is emailed. Super admin.
 */
export async function cancelClassByElevate(classId: string, input: ElevateCancelClass) {
  return (
    await unwrap(
      await api.support.classes[':id'].cancel.$post({ param: { id: classId }, json: input }),
    )
  ).class as SupportClass
}

/** Retries or closes a failed seat refund row, with a reason. Super admin. */
export async function refundRowAction(seatRefundId: string, input: RefundRowAction) {
  return (
    await unwrap(
      await api.support['seat-refunds'][':id'].$post({ param: { id: seatRefundId }, json: input }),
    )
  ).seatRefund as SeatRefundView
}

/** Writes a signed `correction` adjustment, with a reason; the next payout pays or takes it. */
export async function addCorrection(payoutAccountId: string, input: Correction) {
  return (
    await unwrap(
      await api.support['payout-accounts'][':id'].corrections.$post({
        param: { id: payoutAccountId },
        json: input,
      }),
    )
  ).adjustment
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

// ── scheduled classes: read only ────────────────────────────────────────────
export const classKeys = {
  features: ['support', 'features'] as const,
  search: (q: string) => ['support', 'classes', 'search', q] as const,
  detail: (id: string) => ['support', 'classes', 'detail', id] as const,
  block: (id: string, blockId: string) => ['support', 'classes', 'block', id, blockId] as const,
}

/** Which optional areas the API has switched on; the navigation hides the ones that are off. */
export function useSupportFeatures(enabled = true) {
  return useQuery({
    queryKey: classKeys.features,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => (await unwrap(await api.support.features.$get())) as SupportFeatures,
  })
}

/** Classes whose name, profile name or a learner's email contains `q`. Runs only with text. */
export function useClassSearch(q: string) {
  return useQuery({
    queryKey: classKeys.search(q),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await unwrap(await api.support.classes.$get({ query: { q, limit: '50' } })))
        .items as SupportClassSummary[],
  })
}

export function useSupportClass(id: string) {
  return useQuery({
    queryKey: classKeys.detail(id),
    enabled: !!id,
    queryFn: async () =>
      (await unwrap(await api.support.classes[':id'].$get({ param: { id } })))
        .class as SupportClass,
  })
}

/** One block with each learner's row, coordinates and events. `blockId` empty means none chosen. */
export function useSupportBlock(id: string, blockId: string) {
  return useQuery({
    queryKey: classKeys.block(id, blockId),
    enabled: !!id && !!blockId,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await unwrap(
          await api.support.classes[':id'].blocks[':blockId'].$get({ param: { id, blockId } }),
        )
      ).block as SupportClassBlock,
  })
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['support', 'analytics'] as const,
    queryFn: async () =>
      (await unwrap(await api.support.analytics.$get())).analytics as AnalyticsSummary,
  })
}
