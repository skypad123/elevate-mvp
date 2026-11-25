import type { LearnerClass, LearnerSeat, SeatRefundView } from '@elevate/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Text } from 'react-native'
import ClassScreen from '@/app/class/[enrollmentId]'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import { tokenStorage } from '@/lib/token-storage'
import { jsonResponse } from '@/test-utils/api'
import { TestProviders } from '@/test-utils/providers'

const getMe = api.auth.me.$get as unknown as jest.Mock
const getClasses = api.me.classes.$get as unknown as jest.Mock
const postWithdraw = api.me.classes[':enrollmentId'].withdraw.$post as unknown as jest.Mock

const ENROLLMENT_ID = '7a1f2c3e-0000-4000-8000-0000000000e1'

const user = {
  id: 'u1',
  email: 'learner@example.com',
  name: 'Ada Learner',
  avatarUrl: null,
  roles: [],
  profiles: [],
  locale: 'en',
  localeChosen: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

type Block = LearnerClass['blocks'][number]

const block = (overrides: Partial<Block> = {}): Block => ({
  id: 'b1',
  startsAt: '2026-12-19T01:00:00.000Z',
  endsAt: '2026-12-19T04:00:00.000Z',
  checkInOpen: false,
  state: 'not_arrived',
  flagReason: null,
  manualMark: null,
  overturn: null,
  ...overrides,
})

const noSeat: LearnerSeat = {
  withdrawKind: null,
  withdrawRefundCents: null,
  withdrawClosesAt: null,
  movedAt: null,
  classChangedAt: null,
  classCancelled: false,
  refund: null,
  openMarks: [],
}

const refund = (overrides: Partial<SeatRefundView>): SeatRefundView => ({
  id: 'r1',
  kind: 'learner_withdrew',
  status: 'pending',
  waitingFor: null,
  closedReason: null,
  learnerRefundCents: null,
  reason: null,
  createdAt: '2026-11-25T02:00:00.000Z',
  completedAt: null,
  ...overrides,
})

const classWith = (seat: Partial<LearnerSeat>, blocks: Block[] = [block()]): LearnerClass => ({
  enrollmentId: ENROLLMENT_ID,
  class: {
    id: 'c1',
    name: 'Saturday mornings',
    courseTitle: 'Wheel throwing',
    delivery: 'in_person',
    venueAddress: '1 Fixture Road',
    timeZone: 'Asia/Singapore',
  },
  blocks,
  seat: { ...noSeat, ...seat },
})

/** The open withdrawal of a seat whose first session is on 19 Dec: it closes on 12 Dec. */
const canWithdraw: Partial<LearnerSeat> = {
  withdrawKind: 'learner_withdrew',
  withdrawRefundCents: 48_000,
  withdrawClosesAt: '2026-12-12T01:00:00.000Z',
}

async function renderClass(item: LearnerClass) {
  await tokenStorage.set('token')
  getMe.mockResolvedValue(jsonResponse({ user }))
  getClasses.mockResolvedValue(jsonResponse({ items: [item] }))
  await renderRouter(
    {
      'class/[enrollmentId]': ClassScreen,
      learning: () => <Text>My Learning</Text>,
      index: () => null,
    },
    { initialUrl: `/class/${ENROLLMENT_ID}`, wrapper: TestProviders },
  )
  await screen.findByTestId('class-seat')
}

beforeEach(async () => {
  jest.clearAllMocks()
  queryClient.clear()
  await AsyncStorage.clear()
  await tokenStorage.clear()
})

describe('the seat on the class screen', () => {
  it('offers withdrawal with the amount and the deadline, and confirms before withdrawing', async () => {
    await renderClass(classWith(canWithdraw))
    expect(
      screen.getByText(
        /^You can withdraw until .*12 Dec.*9:00.*\. We would refund S\$480\.00: the price you paid less/,
      ),
    ).toBeTruthy()
    await fireEvent.press(screen.getByTestId('class-seat-withdraw'))
    expect(screen.getByText('Withdraw from this class?')).toBeTruthy()
    expect(postWithdraw).not.toHaveBeenCalled()

    postWithdraw.mockResolvedValue(
      jsonResponse({
        class: classWith({ refund: refund({ status: 'waiting', waitingFor: 'stripe_fee' }) }),
      }),
    )
    await fireEvent.press(screen.getByTestId('class-seat-confirm-withdraw'))
    await waitFor(() => expect(postWithdraw).toHaveBeenCalledTimes(1))
    expect(postWithdraw.mock.calls[0]?.[0]).toEqual({ param: { enrollmentId: ENROLLMENT_ID } })
    expect(await screen.findByText('Refund on its way')).toBeTruthy()
    expect(
      screen.getByText('You withdrew from this class, and you no longer have a seat.'),
    ).toBeTruthy()
    expect(screen.queryByTestId('class-seat-withdraw')).toBeNull()
  })

  it('states the rate while Stripe’s fee is not known', async () => {
    await renderClass(classWith({ ...canWithdraw, withdrawRefundCents: null }))
    expect(
      screen.getByText(/3\.4% of the price plus S\$0\.50 for a card issued in Singapore/),
    ).toBeTruthy()
    expect(screen.getByText(/1\.3% for PayNow/)).toBeTruthy()
    expect(screen.getByTestId('class-seat-withdraw')).toBeTruthy()
  })

  it('words a refused withdrawal from its code', async () => {
    await renderClass(classWith(canWithdraw))
    postWithdraw.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'withdrawal_closed',
            message: 'English from the API',
            details: { closesAt: '2026-12-12T01:00:00.000Z' },
          },
        },
        409,
      ),
    )
    await fireEvent.press(screen.getByTestId('class-seat-withdraw'))
    await fireEvent.press(screen.getByTestId('class-seat-confirm-withdraw'))
    expect(
      await screen.findByText('Withdrawal has closed for this class. Contact the teacher.'),
    ).toBeTruthy()
    expect(screen.queryByText('English from the API')).toBeNull()
  })

  it('hides withdrawal after the deadline', async () => {
    await renderClass(classWith({}))
    expect(screen.getByText('Withdrawal has closed')).toBeTruthy()
    expect(screen.queryByTestId('class-seat-withdraw')).toBeNull()
  })

  it('says a refund is the teacher’s decision once the learner has attended', async () => {
    await renderClass(classWith({}, [block({ state: 'present' })]))
    expect(
      screen.getByText("You have attended this class, so a refund is the teacher's decision."),
    ).toBeTruthy()
    expect(screen.queryByTestId('class-seat-withdraw')).toBeNull()
  })

  it('says the learner was moved, with the full refund until the class starts', async () => {
    await renderClass(
      classWith({
        withdrawKind: 'changed_withdrew',
        withdrawRefundCents: 50_000,
        withdrawClosesAt: '2026-12-19T01:00:00.000Z',
        movedAt: '2026-11-20T00:00:00.000Z',
        classChangedAt: '2026-11-20T00:00:00.000Z',
      }),
    )
    expect(screen.getByTestId('class-seat-moved')).toBeTruthy()
    expect(screen.queryByTestId('class-seat-changed')).toBeNull()
    expect(
      screen.getByText(
        /^Because the class changed, you can withdraw until it starts on .*19 Dec.*, and we would refund the full S\$500\.00\.$/,
      ),
    ).toBeTruthy()
  })

  it('says the times changed, with the full refund while the amount is unknown', async () => {
    await renderClass(
      classWith({
        withdrawKind: 'changed_withdrew',
        withdrawRefundCents: null,
        withdrawClosesAt: '2026-12-19T01:00:00.000Z',
        classChangedAt: '2026-11-20T00:00:00.000Z',
      }),
    )
    expect(
      screen.getByText(
        "This class's times changed after you paid. We emailed you the old and the new times.",
      ),
    ).toBeTruthy()
    expect(screen.getByText(/we would refund the price you paid in full\.$/)).toBeTruthy()
  })

  it('shows an open manual mark with its deadline, and its dispute action', async () => {
    await renderClass(
      classWith({ openMarks: [{ blockId: 'b1', disputeUntil: '2026-12-26T01:00:00.000Z' }] }, [
        block({
          state: 'marked_by_hand',
          manualMark: {
            eventId: 'm1',
            reasonCode: 'no_phone',
            reason: null,
            markedAt: '2026-12-19T02:00:00.000Z',
            subState: 'open',
            disputeUntil: '2026-12-26T01:00:00.000Z',
          },
        }),
      ]),
    )
    expect(
      screen.getByText(
        /^You were marked present by hand\. Until .*26 Dec 2026 you cannot withdraw/,
      ),
    ).toBeTruthy()
    expect(screen.getByTestId('class-dispute-m1')).toBeTruthy()
  })

  it('shows a withdrawn seat’s refund once it is made', async () => {
    await renderClass(
      classWith({
        refund: refund({
          status: 'done',
          learnerRefundCents: 48_000,
          completedAt: '2026-11-25T03:00:00.000Z',
        }),
      }),
    )
    expect(screen.getByText('Refunded')).toBeTruthy()
    expect(
      screen.getByText(
        /^We returned S\$480\.00 to the payment method you paid with on 25 Nov 2026\./,
      ),
    ).toBeTruthy()
  })
})

describe('a cancelled class', () => {
  it('says the learner is refunded in full, with the refund on its way', async () => {
    await renderClass(
      classWith({
        classCancelled: true,
        refund: refund({
          kind: 'teacher_cancelled',
          status: 'refund_sent',
          learnerRefundCents: 50_000,
        }),
      }),
    )
    expect(screen.getByTestId('class-seat-cancelled-refunded')).toBeTruthy()
    expect(screen.getByText('This class was cancelled')).toBeTruthy()
    expect(screen.getByText('We refund the price you paid in full.')).toBeTruthy()
    expect(screen.getByText('Refund on its way')).toBeTruthy()
    expect(screen.getByText(/We are returning S\$500\.00/)).toBeTruthy()
  })

  it('says a learner who attended part of it gets the share for the sessions not taught', async () => {
    await renderClass(
      classWith(
        {
          classCancelled: true,
          refund: refund({
            kind: 'teacher_cancelled_part',
            status: 'done',
            learnerRefundCents: 40_000,
            completedAt: '2026-11-25T03:00:00.000Z',
          }),
        },
        [block({ state: 'present' })],
      ),
    )
    expect(screen.getByText(/^You attended part of the class, so we refund the part/)).toBeTruthy()
    expect(screen.getByText(/We returned S\$400\.00/)).toBeTruthy()
  })

  it('says a learner with an open manual mark waits on it, until when', async () => {
    await renderClass(
      classWith({
        classCancelled: true,
        openMarks: [{ blockId: 'b1', disputeUntil: '2026-12-26T01:00:00.000Z' }],
        refund: refund({ kind: 'teacher_cancelled', status: 'waiting', waitingFor: 'manual_mark' }),
      }),
    )
    expect(screen.getByTestId('class-seat-cancelled-markOpen')).toBeTruthy()
    expect(
      screen.getByText(
        /^You were marked present by hand, and you can dispute the mark until .*26 Dec 2026\./,
      ),
    ).toBeTruthy()
  })

  it('says a learner counted as attended in every session gets no refund', async () => {
    await renderClass(classWith({ classCancelled: true }, [block({ state: 'present' })]))
    expect(screen.getByTestId('class-seat-cancelled-attended')).toBeTruthy()
    expect(
      screen.getByText(/^Every session had started and you are counted as having attended/),
    ).toBeTruthy()
    expect(screen.queryByTestId('class-seat-withdraw')).toBeNull()
  })

  it('takes no more check-ins', async () => {
    await renderClass(
      classWith(
        {
          classCancelled: true,
          refund: refund({ kind: 'teacher_cancelled', status: 'pending' }),
        },
        [block({ checkInOpen: true })],
      ),
    )
    expect(screen.queryByTestId('class-check-in-b1')).toBeNull()
  })
})
