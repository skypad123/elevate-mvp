import {
  type CancelClass,
  CLASS_SALES_TERMS_VERSION,
  type ClassDetail,
  type ClassSalesStatus,
  type ClassSummary,
  type CodeView,
  type CreateClass,
  type DisputeDecisionInput,
  type DisputeView,
  type ManualMark,
  type MoveTarget,
  type Overturn,
  type RosterView,
  type SeatRefundRequest,
  type SeatView,
  type SetVenueLocation,
  type UpdateClass,
} from '@elevate/core'
import { ApiError, unwrap } from '@elevate/web-ui/portal'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from './api'
import { classKeys, teachKeys } from './keys'
import { useCurrentProfile } from './profile'

export { classKeys }

/** Every call below is for the profile in the URL. */
const scoped = api.teach.profiles[':profileId']

/** How often the roster screen asks again. TanStack Query pauses it while the tab is hidden. */
export const ROSTER_POLL_MS = 3_000
/** How often the code screen asks again. Each answer holds three codes, a minute each. */
export const CODES_POLL_MS = 20_000

/** A refusal from the API is an answer, not a blip: asking again would only delay showing it. */
const retryUnlessRefused = (count: number, error: unknown) =>
  !(error instanceof ApiError) && count < 2

export function useClasses() {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: classKeys.list(profileId),
    queryFn: async () =>
      (await unwrap(await scoped.classes.$get({ param: { profileId } }))).items as ClassSummary[],
  })
}

export function useClass(id: string) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: classKeys.detail(profileId, id),
    enabled: !!id,
    retry: retryUnlessRefused,
    queryFn: async () =>
      (await unwrap(await scoped.classes[':id'].$get({ param: { profileId, id } })))
        .class as ClassDetail,
  })
}

export function useRoster(id: string, blockId: string) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: classKeys.roster(profileId, id, blockId),
    enabled: !!id && !!blockId,
    refetchInterval: ROSTER_POLL_MS,
    retry: retryUnlessRefused,
    queryFn: async () =>
      (
        await unwrap(
          await scoped.classes[':id'].blocks[':blockId'].roster.$get({
            param: { profileId, id, blockId },
          }),
        )
      ).roster as RosterView,
  })
}

/** The codes, with the moment the answer arrived on `performance.now()`'s clock. */
export type ReceivedCodes = CodeView & { receivedAt: number }

export function useCodes(id: string, blockId: string) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: classKeys.codes(profileId, id, blockId),
    enabled: !!id && !!blockId,
    refetchInterval: CODES_POLL_MS,
    // The screen may sit on a projector with nobody touching it.
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: retryUnlessRefused,
    queryFn: async (): Promise<ReceivedCodes> => {
      const { code } = await unwrap(
        await scoped.classes[':id'].blocks[':blockId'].code.$get({
          param: { profileId, id, blockId },
        }),
      )
      return { ...(code as CodeView), receivedAt: performance.now() }
    },
  })
}

export function useDisputes(id: string, enabled = true) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: classKeys.disputes(profileId, id),
    enabled: enabled && !!id,
    queryFn: async () =>
      (await unwrap(await scoped.classes[':id'].disputes.$get({ param: { profileId, id } })))
        .items as DisputeView[],
  })
}

/** The profile's class sales: whether it has opted in, is switching, or has given notice. */
export function useClassSales(enabled = true) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: classKeys.sales(profileId),
    enabled,
    retry: retryUnlessRefused,
    queryFn: async () =>
      (await unwrap(await scoped['class-sales'].$get({ param: { profileId } })))
        .classSales as ClassSalesStatus,
  })
}

/** The seats bought in a class. Needs `earnings.read`, since each row shows money. */
export function useSeats(id: string, enabled = true) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: classKeys.seats(profileId, id),
    enabled: enabled && !!id,
    retry: retryUnlessRefused,
    queryFn: async () =>
      (await unwrap(await scoped.classes[':id'].seats.$get({ param: { profileId, id } })))
        .items as SeatView[],
  })
}

/** The classes a learner can be moved to, each with the problems that stop the move. */
export function useMoveTargets(id: string, enrollmentId: string | null) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: classKeys.moveTargets(profileId, id, enrollmentId ?? ''),
    enabled: !!id && !!enrollmentId,
    retry: retryUnlessRefused,
    // A seat elsewhere may have gone since the dialog was last opened.
    staleTime: 0,
    queryFn: async () =>
      (
        await unwrap(
          await scoped.classes[':id'].learners[':enrollmentId']['move-targets'].$get({
            param: { profileId, id, enrollmentId: enrollmentId ?? '' },
          }),
        )
      ).items as MoveTarget[],
  })
}

/**
 * Every write to a class. Each one answers with what changed (the class, the roster or the
 * dispute); the cache takes the class as it is, and the rest is read again. A failure is thrown
 * for the page to show.
 */
export function useClassActions() {
  const { profileId } = useCurrentProfile()
  const queryClient = useQueryClient()
  return useMemo(() => {
    const storeClass = (detail: ClassDetail) => {
      queryClient.setQueryData(classKeys.detail(profileId, detail.id), detail)
      void queryClient.invalidateQueries({ queryKey: classKeys.list(profileId) })
      return detail
    }
    /** The class, its rosters and its disputes. */
    const reloadClass = (id: string) =>
      queryClient.invalidateQueries({ queryKey: classKeys.detail(profileId, id) })
    const on = (id: string) => ({ profileId, id })
    const learner = (id: string, blockId: string, enrollmentId: string) => ({
      profileId,
      id,
      blockId,
      enrollmentId,
    })
    const storeRoster = async (id: string, blockId: string, roster: RosterView) => {
      queryClient.setQueryData(classKeys.roster(profileId, id, blockId), roster)
      await reloadClass(id)
      return roster
    }
    return {
      create: async (input: CreateClass) =>
        storeClass(
          (await unwrap(await scoped.classes.$post({ param: { profileId }, json: input })))
            .class as ClassDetail,
        ),
      update: async (id: string, patch: UpdateClass) =>
        storeClass(
          (await unwrap(await scoped.classes[':id'].$patch({ param: on(id), json: patch })))
            .class as ClassDetail,
        ),
      publish: async (id: string) =>
        storeClass(
          (await unwrap(await scoped.classes[':id'].publish.$post({ param: on(id) })))
            .class as ClassDetail,
        ),
      setInstructor: async (id: string, userId: string) => {
        const detail = storeClass(
          (
            await unwrap(
              await scoped.classes[':id'].instructor.$put({ param: on(id), json: { userId } }),
            )
          ).class as ClassDetail,
        )
        // Whether the viewer may run a block has changed with it.
        await reloadClass(id)
        return detail
      },
      remove: async (id: string) => {
        await unwrap(await scoped.classes[':id'].$delete({ param: on(id) }))
        queryClient.removeQueries({ queryKey: classKeys.detail(profileId, id) })
        await queryClient.invalidateQueries({ queryKey: classKeys.list(profileId) })
      },
      setVenueLocation: async (id: string, input: SetVenueLocation) => {
        const detail = storeClass(
          (
            await unwrap(
              await scoped.classes[':id']['venue-location'].$put({ param: on(id), json: input }),
            )
          ).class as ClassDetail,
        )
        await reloadClass(id)
        return detail
      },
      overturn: async (id: string, blockId: string, enrollmentId: string, input: Overturn) =>
        storeRoster(
          id,
          blockId,
          (
            await unwrap(
              await scoped.classes[':id'].blocks[':blockId'].learners[
                ':enrollmentId'
              ].overturn.$post({ param: learner(id, blockId, enrollmentId), json: input }),
            )
          ).roster as RosterView,
        ),
      manualMark: async (id: string, blockId: string, enrollmentId: string, input: ManualMark) =>
        storeRoster(
          id,
          blockId,
          (
            await unwrap(
              await scoped.classes[':id'].blocks[':blockId'].learners[':enrollmentId'][
                'manual-mark'
              ].$post({ param: learner(id, blockId, enrollmentId), json: input }),
            )
          ).roster as RosterView,
        ),
      decide: async (id: string, eventId: string, input: DisputeDecisionInput) => {
        const { dispute } = await unwrap(
          await scoped.classes[':id'].disputes[':eventId'].decision.$post({
            param: { profileId, id, eventId },
            json: input,
          }),
        )
        await reloadClass(id)
        return dispute as DisputeView
      },

      // ── Class sales ──
      /** The owner accepts the held-payout terms shown, which are the current version. */
      acceptClassSales: async () => {
        const { classSales } = await unwrap(
          await scoped['class-sales'].accept.$post({
            param: { profileId },
            json: { termsVersion: CLASS_SALES_TERMS_VERSION },
          }),
        )
        queryClient.setQueryData(classKeys.sales(profileId), classSales)
        // Whether each class is on sale, and the earnings page's held money, follow from it.
        void queryClient.invalidateQueries({ queryKey: ['teach', profileId, 'class'] })
        void queryClient.invalidateQueries({ queryKey: teachKeys.earnings(profileId) })
        return classSales as ClassSalesStatus
      },
      /** The owner gives 30 days' notice to stop selling classes. */
      leaveClassSales: async () => {
        const { classSales } = await unwrap(
          await scoped['class-sales'].leave.$post({ param: { profileId } }),
        )
        queryClient.setQueryData(classKeys.sales(profileId), classSales)
        void queryClient.invalidateQueries({ queryKey: ['teach', profileId, 'class'] })
        return classSales as ClassSalesStatus
      },

      // ── Seats ──
      /** Cancels the class. Every seat's refund is written now and sent by the release job. */
      cancelClass: async (id: string, input: CancelClass) => {
        const detail = storeClass(
          (await unwrap(await scoped.classes[':id'].cancel.$post({ param: on(id), json: input })))
            .class as ClassDetail,
        )
        await queryClient.invalidateQueries({ queryKey: classKeys.seats(profileId, id) })
        return detail
      },
      /** Moves a learner's seat, and its payment, to another class of the course. */
      moveSeat: async (id: string, enrollmentId: string, toClassId: string) => {
        const { seat } = await unwrap(
          await scoped.classes[':id'].learners[':enrollmentId'].move.$post({
            param: { profileId, id, enrollmentId },
            json: { toClassId },
          }),
        )
        // Both classes' seat counts and rosters change.
        await Promise.all([reloadClass(id), reloadClass(toClassId)])
        void queryClient.invalidateQueries({ queryKey: classKeys.list(profileId) })
        return seat as SeatView
      },
      /** A discretionary refund. The learner keeps the seat. */
      refundSeat: async (id: string, enrollmentId: string, input: SeatRefundRequest) => {
        const { seat } = await unwrap(
          await scoped.classes[':id'].learners[':enrollmentId'].refund.$post({
            param: { profileId, id, enrollmentId },
            json: input,
          }),
        )
        const view = seat as SeatView
        queryClient.setQueryData<SeatView[]>(classKeys.seats(profileId, id), (list) =>
          list?.map((s) => (s.enrollmentId === view.enrollmentId ? view : s)),
        )
        void queryClient.invalidateQueries({ queryKey: teachKeys.earnings(profileId) })
        return view
      },
    }
  }, [profileId, queryClient])
}

// ── Showing times ───────────────────────────────────────────────────────────
// Every Part 1 class is in Asia/Singapore, so every time is shown in the class's zone with "SGT"
// beside it, whatever zone the browser is in.

/** The label shown beside a time in a class's zone. */
export function zoneLabel(timeZone: string): string {
  return timeZone === 'Asia/Singapore' ? 'SGT' : timeZone
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(key: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const id = `${key}|${timeZone}`
  let f = formatters.get(id)
  if (!f) {
    f = new Intl.DateTimeFormat('en-SG', { timeZone, ...options })
    formatters.set(id, f)
  }
  return f
}

/** "Sat 7 Mar 2026" in the class's zone. */
export function formatClassDate(iso: string, timeZone: string): string {
  return formatter('date', timeZone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

/** "09:30" in the class's zone. */
export function formatClassTime(iso: string, timeZone: string): string {
  return formatter('time', timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

/** "Sat 7 Mar 2026, 09:30–12:30 SGT". */
export function formatBlockSpan(
  block: { startsAt: string; endsAt: string },
  timeZone: string,
): string {
  return `${formatClassDate(block.startsAt, timeZone)}, ${formatClassTime(block.startsAt, timeZone)}–${formatClassTime(block.endsAt, timeZone)} ${zoneLabel(timeZone)}`
}

/** "7 Mar 2026, 09:30 SGT": one instant, such as when something was marked. */
export function formatClassInstant(iso: string, timeZone: string): string {
  return `${formatter('day', timeZone, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))}, ${formatClassTime(iso, timeZone)} ${zoneLabel(timeZone)}`
}

/** The dates a class runs on: "7 Mar 2026 – 21 Mar 2026", or one date. */
export function formatClassDates(
  first: string | null,
  last: string | null,
  timeZone: string,
): string {
  if (!first || !last) return 'No dates yet'
  const from = formatClassDate(first, timeZone)
  const to = formatClassDate(last, timeZone)
  return from === to ? from : `${from} – ${to}`
}
