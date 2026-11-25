import { describe, expect, it } from 'vitest'
import {
  type ClassOnSaleInput,
  canMove,
  choosePayoutItems,
  classOnSale,
  fulfilmentDecision,
  isDue,
  isPayTime,
  MAX_RESERVATIONS,
  type MoveInput,
  type MoveProblem,
  NOT_ON_SALE_REASONS,
  payDate,
  payoutLimitCents,
  RELEASE_AFTER_MS,
  RESERVATION_WINDOW_MS,
  releaseDueAt,
  reservationAllowed,
  SEAT_HORIZON_MS,
  SEAT_RESERVATION_MS,
  seatsLeft,
  WITHDRAWAL_CLOSES_BEFORE_MS,
  withdrawal,
  withdrawalClosesAt,
} from '../src'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const T0 = Date.UTC(2026, 2, 7, 1, 0) // 09:00 in Singapore
const at = (offsetMs: number) => new Date(T0 + offsetMs)

const NOT_ATTENDED = { counted: false, openMarkUntil: null }

describe('constants', () => {
  it('match the design', () => {
    expect(SEAT_RESERVATION_MS).toBe(35 * MIN)
    expect(MAX_RESERVATIONS).toBe(3)
    expect(RESERVATION_WINDOW_MS).toBe(DAY)
    expect(WITHDRAWAL_CLOSES_BEFORE_MS).toBe(7 * DAY)
    expect(RELEASE_AFTER_MS).toBe(7 * DAY)
    expect(SEAT_HORIZON_MS).toBe(75 * DAY)
  })
})

describe('classOnSale', () => {
  const firstStart = at(10 * DAY)
  const onSale = (overrides: Partial<ClassOnSaleInput> = {}): ClassOnSaleInput => ({
    class: { status: 'published', cancelledAt: null },
    blocks: [
      { startsAt: firstStart, endsAt: at(10 * DAY + 2 * HOUR) },
      { startsAt: at(17 * DAY), endsAt: at(17 * DAY + 2 * HOUR) },
    ],
    profile: { classSalesAcceptedAt: at(-DAY) },
    payoutAccount: { payoutMode: 'manual', leaveRequestedAt: null, payable: true },
    course: { status: 'live' },
    salesEnabled: true,
    now: at(0),
    ...overrides,
  })

  it('is on sale when everything holds', () => {
    expect(classOnSale(onSale())).toBe(true)
  })

  it('returns each reason', () => {
    const cases: [ClassOnSaleInput, (typeof NOT_ON_SALE_REASONS)[number]][] = [
      [onSale({ salesEnabled: false }), 'sales_off'],
      [onSale({ class: { status: 'draft' } }), 'not_published'],
      [onSale({ blocks: [] }), 'not_published'],
      [onSale({ class: { status: 'cancelled', cancelledAt: at(-HOUR) } }), 'cancelled'],
      [onSale({ class: { status: 'published', cancelledAt: at(-HOUR) } }), 'cancelled'],
      [onSale({ now: firstStart }), 'started'],
      [onSale({ now: at(17 * DAY + 2 * HOUR - SEAT_HORIZON_MS - 1) }), 'too_far_ahead'],
      [onSale({ profile: { classSalesAcceptedAt: null } }), 'profile_not_opted_in'],
      [
        onSale({
          payoutAccount: { payoutMode: 'switching', leaveRequestedAt: null, payable: true },
        }),
        'profile_not_opted_in',
      ],
      [onSale({ payoutAccount: null }), 'profile_not_opted_in'],
      [
        onSale({ payoutAccount: { payoutMode: 'manual', leaveRequestedAt: at(0), payable: true } }),
        'profile_leaving',
      ],
      [
        onSale({ payoutAccount: { payoutMode: 'manual', leaveRequestedAt: null, payable: false } }),
        'account_not_payable',
      ],
      [onSale({ course: { status: 'pending_review' } }), 'course_not_on_sale'],
    ]
    for (const [input, reason] of cases) expect(classOnSale(input), reason).toBe(reason)
    expect(new Set(cases.map(([, reason]) => reason))).toEqual(new Set(NOT_ON_SALE_REASONS))
  })

  it('tests the reasons in order', () => {
    expect(classOnSale(onSale({ salesEnabled: false, class: { status: 'draft' } }))).toBe(
      'sales_off',
    )
    expect(
      classOnSale(onSale({ profile: { classSalesAcceptedAt: null }, course: { status: 'draft' } })),
    ).toBe('profile_not_opted_in')
  })

  it('sells a class whose last block ends exactly 75 days ahead, and not a millisecond more', () => {
    const lastEnd = 17 * DAY + 2 * HOUR
    expect(classOnSale(onSale({ now: at(lastEnd - SEAT_HORIZON_MS) }))).toBe(true)
    expect(classOnSale(onSale({ now: at(lastEnd - SEAT_HORIZON_MS - 1) }))).toBe('too_far_ahead')
  })
})

describe('seats and reservations', () => {
  it('never has fewer than zero seats left', () => {
    expect(seatsLeft(10, 3)).toBe(7)
    expect(seatsLeft(10, 10)).toBe(0)
    expect(seatsLeft(5, 7)).toBe(0)
  })

  it('allows the third reservation in 24 hours and refuses the fourth until the window ends', () => {
    const since = at(0)
    expect(reservationAllowed({ count: 0, since: null, now: at(0) })).toBe(true)
    expect(reservationAllowed({ count: 2, since, now: at(HOUR) })).toBe(true)
    expect(reservationAllowed({ count: 3, since, now: at(HOUR) })).toEqual(at(DAY))
    expect(reservationAllowed({ count: 3, since, now: at(DAY - 1) })).toEqual(at(DAY))
    expect(reservationAllowed({ count: 3, since, now: at(DAY) })).toBe(true)
  })
})

describe('fulfilmentDecision', () => {
  const base = {
    classCancelled: false,
    reservedUntil: at(35 * MIN) as Date | null,
    seatFree: false,
    firstBlockStartsAt: at(DAY),
    paidAt: at(10 * MIN),
    now: at(11 * MIN),
  }

  it('gives the seat while the reservation is current, full or not', () => {
    expect(fulfilmentDecision(base)).toBe('seat')
  })

  it('gives a free seat after the reservation ended, before the class starts', () => {
    expect(
      fulfilmentDecision({ ...base, seatFree: true, paidAt: at(40 * MIN), now: at(41 * MIN) }),
    ).toBe('seat')
  })

  it('gives a free seat after the class started when Stripe took the payment in time', () => {
    expect(
      fulfilmentDecision({
        ...base,
        seatFree: true,
        firstBlockStartsAt: at(20 * MIN),
        paidAt: at(34 * MIN),
        now: at(36 * MIN),
      }),
    ).toBe('seat')
  })

  it('loses the seat otherwise', () => {
    // Ended and full.
    expect(fulfilmentDecision({ ...base, now: at(36 * MIN) })).toBe('seat_lost')
    // Ended, free, started, and paid after the reservation.
    expect(
      fulfilmentDecision({
        ...base,
        seatFree: true,
        firstBlockStartsAt: at(20 * MIN),
        paidAt: at(35 * MIN),
        now: at(36 * MIN),
      }),
    ).toBe('seat_lost')
    // No reservation at all, after the start.
    expect(
      fulfilmentDecision({
        ...base,
        reservedUntil: null,
        seatFree: true,
        firstBlockStartsAt: at(0),
      }),
    ).toBe('seat_lost')
  })

  it('loses the seat in a cancelled class, even with a current reservation', () => {
    expect(fulfilmentDecision({ ...base, classCancelled: true, seatFree: true })).toBe('seat_lost')
  })
})

describe('withdrawal', () => {
  const start = at(30 * DAY)
  const base = {
    enrollmentStatus: 'active',
    classCancelled: false,
    hasUnfinishedRefund: false,
    hasPayment: true,
    attendance: NOT_ATTENDED,
    firstBlockStartsAt: start,
    classChangedAt: null as Date | null,
    now: at(0),
  }

  it('closes exactly 7 days before the first block', () => {
    expect(withdrawalClosesAt(start)).toEqual(at(23 * DAY))
    expect(withdrawal({ ...base, now: at(23 * DAY - 1) })).toBe('learner_withdrew')
    expect(withdrawal({ ...base, now: at(23 * DAY) })).toBe('withdrawal_closed')
  })

  it('gives the full refund for a changed class until it starts', () => {
    const changed = { ...base, classChangedAt: at(DAY) }
    expect(withdrawal({ ...changed, now: at(29 * DAY) })).toBe('changed_withdrew')
    expect(withdrawal({ ...changed, now: at(30 * DAY - 1) })).toBe('changed_withdrew')
    expect(withdrawal({ ...changed, now: start })).toBe('withdrawal_closed')
  })

  it('prefers changed_withdrew when both are allowed', () => {
    expect(withdrawal({ ...base, classChangedAt: at(DAY) })).toBe('changed_withdrew')
  })

  it('refuses a learner counted as attended or with an open manual mark', () => {
    expect(withdrawal({ ...base, attendance: { counted: true, openMarkUntil: null } })).toBe(
      'withdrawal_attended',
    )
    expect(withdrawal({ ...base, attendance: { counted: false, openMarkUntil: at(DAY) } })).toBe(
      'withdrawal_attended',
    )
  })

  it('refuses a cancelled class, a refund on its way, a seat with no payment, a seat not active', () => {
    expect(withdrawal({ ...base, classCancelled: true })).toBe('class_cancelled')
    expect(withdrawal({ ...base, hasUnfinishedRefund: true })).toBe('refund_in_progress')
    expect(withdrawal({ ...base, hasPayment: false })).toBe('seat_has_no_payment')
    expect(withdrawal({ ...base, enrollmentStatus: 'cancelled' })).toBe('not_found')
  })
})

describe('canMove', () => {
  const paidAt = at(0)
  const base: MoveInput = {
    attendance: NOT_ATTENDED,
    hasUnfinishedRefund: false,
    bankDisputeOpen: false,
    sameCourse: true,
    target: {
      status: 'published',
      cancelledAt: null,
      blocks: [{ startsAt: at(10 * DAY), endsAt: at(10 * DAY + 2 * HOUR) }],
      seatsLeft: 3,
    },
    paidAt,
    hasEnrollmentInTarget: false,
    now: at(DAY),
  }
  const target = (overrides: Partial<MoveInput['target']>) => ({
    ...base,
    target: { ...base.target, ...overrides },
  })

  it('allows a move when nothing stands in the way', () => {
    expect(canMove(base)).toBe(true)
  })

  it('reports each problem', () => {
    const cases: [MoveInput, MoveProblem][] = [
      [{ ...base, attendance: { counted: true, openMarkUntil: null } }, 'attended'],
      [{ ...base, attendance: { counted: false, openMarkUntil: at(2 * DAY) } }, 'open_mark'],
      [{ ...base, hasUnfinishedRefund: true }, 'refund_in_progress'],
      [{ ...base, bankDisputeOpen: true }, 'bank_dispute_open'],
      [{ ...base, sameCourse: false }, 'different_course'],
      [target({ status: 'draft' }), 'target_not_published'],
      [target({ status: 'cancelled', cancelledAt: at(0) }), 'target_not_published'],
      [{ ...base, now: at(10 * DAY) }, 'target_started'],
      [target({ seatsLeft: 0 }), 'target_full'],
      [
        target({ blocks: [{ startsAt: at(70 * DAY), endsAt: at(SEAT_HORIZON_MS + 1) }] }),
        'beyond_limit',
      ],
      [{ ...base, hasEnrollmentInTarget: true }, 'already_in_target'],
    ]
    for (const [input, problem] of cases) expect(canMove(input), problem).toEqual([problem])
  })

  it('counts the 75 days from the payment', () => {
    const edge = [{ startsAt: at(70 * DAY), endsAt: at(SEAT_HORIZON_MS) }]
    expect(canMove(target({ blocks: edge }))).toBe(true)
  })

  it('lists every problem at once', () => {
    expect(canMove({ ...target({ seatsLeft: 0 }), sameCourse: false })).toEqual([
      'different_course',
      'target_full',
    ])
  })
})

describe('isDue and releaseDueAt', () => {
  const lastEnd = at(0)
  const base = {
    lastBlockEndsAt: lastEnd as Date | null,
    cancelledAt: null as Date | null,
    openMarkUntil: null as Date | null,
    cancellationComplete: false,
    now: at(7 * DAY),
  }

  it('is due exactly 7 days after the last block ends', () => {
    expect(releaseDueAt(base)).toEqual(at(7 * DAY))
    expect(isDue({ ...base, now: at(7 * DAY - 1) })).toBe(false)
    expect(isDue(base)).toBe(true)
  })

  it('counts from the cancellation once it is complete', () => {
    const cancelled = { ...base, cancelledAt: at(-20 * DAY), cancellationComplete: true }
    expect(releaseDueAt(cancelled)).toEqual(at(-13 * DAY))
    expect(isDue({ ...cancelled, now: at(-13 * DAY - 1) })).toBe(false)
    expect(isDue({ ...cancelled, now: at(-13 * DAY) })).toBe(true)
  })

  it('waits for an incomplete cancellation, with no date', () => {
    const waiting = { ...base, cancelledAt: at(-20 * DAY), now: at(30 * DAY) }
    expect(releaseDueAt(waiting)).toBeNull()
    expect(isDue(waiting)).toBe(false)
  })

  it('waits for an open manual mark to settle', () => {
    const open = { ...base, openMarkUntil: at(8 * DAY), now: at(7 * DAY) }
    expect(isDue(open)).toBe(false)
    expect(releaseDueAt(open)).toEqual(at(8 * DAY + 1))
  })

  it('has no date for a class with no blocks', () => {
    expect(releaseDueAt({ ...base, lastBlockEndsAt: null })).toBeNull()
  })
})

describe('payoutLimitCents', () => {
  it('is zero when more is held than the balance', () => {
    expect(payoutLimitCents({ availableCents: 1000, pendingCents: 500, heldCents: 2000 })).toBe(0)
  })

  it('is the available balance when pending covers what is held', () => {
    expect(payoutLimitCents({ availableCents: 1000, pendingCents: 5000, heldCents: 3000 })).toBe(
      1000,
    )
  })

  it('is the balance less held otherwise, and all of it when nothing is held', () => {
    expect(payoutLimitCents({ availableCents: 5000, pendingCents: 1000, heldCents: 3000 })).toBe(
      3000,
    )
    expect(payoutLimitCents({ availableCents: 5000, pendingCents: 0, heldCents: 0 })).toBe(5000)
  })
})

describe('choosePayoutItems', () => {
  const item = (id: string, amountCents: number, day: number) => ({
    id,
    amountCents,
    paidAt: at(day * DAY),
  })

  it('takes every debt first, which makes room for more', () => {
    const items = [item('a', 3000, 2), item('debt', -2000, 5), item('b', 4000, 3)]
    const choice = choosePayoutItems(items, 5000)
    expect(choice.chosen.map((i) => i.id)).toEqual(['debt', 'a', 'b'])
    expect(choice.totalCents).toBe(5000)
    expect(choice.namedCents).toBe(5000)
    expect(choice.unnamedCents).toBe(0)
  })

  it('stops at the first item that does not fit, oldest first', () => {
    const items = [item('late-small', 100, 3), item('big', 9000, 2), item('first', 1000, 1)]
    const choice = choosePayoutItems(items, 5000)
    expect(choice.chosen.map((i) => i.id)).toEqual(['first'])
    expect(choice.totalCents).toBe(1000)
    expect(choice.namedCents).toBe(10100)
    expect(choice.unnamedCents).toBe(0)
  })

  it('takes everything under a limit above all that is named, and reports the rest as unnamed', () => {
    const items = [item('a', 3000, 1), item('b', 2000, 2)]
    const choice = choosePayoutItems(items, 8000)
    expect(choice.chosen.map((i) => i.id)).toEqual(['a', 'b'])
    expect(choice.totalCents).toBe(5000)
    expect(choice.unnamedCents).toBe(3000)
  })
})

describe('payDate and isPayTime', () => {
  // Singapore is UTC+8 all year.
  const sg = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`)

  it('takes the day in Singapore across midnight', () => {
    expect(payDate(sg('2026-03-07', '23:59'))).toBe('2026-03-07')
    expect(payDate(sg('2026-03-08', '00:00'))).toBe('2026-03-08')
    // 16:30 UTC is already the next day in Singapore.
    expect(payDate(new Date(Date.UTC(2026, 2, 7, 16, 30)))).toBe('2026-03-08')
  })

  it('pays from 10:00 in Singapore', () => {
    expect(isPayTime(sg('2026-03-07', '09:59'))).toBe(false)
    expect(isPayTime(sg('2026-03-07', '10:00'))).toBe(true)
    expect(isPayTime(sg('2026-03-07', '23:59'))).toBe(true)
    expect(isPayTime(sg('2026-03-08', '00:00'))).toBe(false)
  })
})
