import { describe, expect, it } from 'vitest'
import type { SeatRefundKind } from '../src/domain/class-sales'
import {
  computeDiscount,
  elevateFeeReturned,
  formatSgd,
  parseSgdToCents,
  profileShareAfterRefunds,
  quote,
  type SeatRefundInput,
  seatRefund,
} from '../src/domain/money'

const sg = { stripeFeeBps: 340, stripeFixedCents: 50 }

describe('quote', () => {
  it('matches the worked example: S$100 at 15% commission', () => {
    const q = quote({ listPriceCents: 10000, commissionBps: 1500, ...sg })
    expect(q.stripeFeeEstimateCents).toBe(390)
    expect(q.commissionCents).toBe(1442)
    expect(q.teacherNetCents).toBe(8168)
    expect(q.applicationFeeCents).toBe(1832)
    expect(q.platformNetEstimateCents).toBe(1442)
    expect(q.isFree).toBe(false)
    expect(q.belowMinimum).toBe(false)
  })

  it('keeps the parts summing to the amount for many random inputs', () => {
    let seed = 42
    const rand = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed % (max + 1)
    }
    for (let i = 0; i < 5000; i++) {
      const listPriceCents = rand(200000)
      const promo =
        rand(2) === 0
          ? null
          : rand(1) === 0
            ? ({ type: 'percent', value: rand(100) } as const)
            : ({ type: 'fixed', value: rand(5000) } as const)
      const q = quote({ listPriceCents, promo, commissionBps: 1500 + rand(500), ...sg })
      expect(q.discountCents + q.amountCents).toBe(listPriceCents)
      expect(q.stripeFeeEstimateCents + q.commissionCents + q.teacherNetCents).toBe(q.amountCents)
      expect(q.applicationFeeCents).toBe(q.stripeFeeEstimateCents + q.commissionCents)
      expect(q.applicationFeeCents).toBeGreaterThanOrEqual(0)
      expect(q.applicationFeeCents).toBeLessThanOrEqual(q.amountCents)
      expect(q.teacherNetCents).toBeGreaterThanOrEqual(0)
    }
  })

  it('flags free and below-minimum amounts', () => {
    expect(quote({ listPriceCents: 0, commissionBps: 1500, ...sg }).isFree).toBe(true)
    const freeByPromo = quote({
      listPriceCents: 5000,
      promo: { type: 'percent', value: 100 },
      commissionBps: 1500,
      ...sg,
    })
    expect(freeByPromo.isFree).toBe(true)
    expect(freeByPromo.discountCents).toBe(5000)
    const tiny = quote({ listPriceCents: 60, commissionBps: 1500, ...sg })
    expect(tiny.belowMinimum).toBe(true)
    expect(tiny.isFree).toBe(false)
  })

  it('rejects non-integer or negative cents', () => {
    expect(() => quote({ listPriceCents: 10.5, commissionBps: 1500, ...sg })).toThrow(RangeError)
    expect(() => quote({ listPriceCents: -1, commissionBps: 1500, ...sg })).toThrow(RangeError)
    expect(() => quote({ listPriceCents: 100, commissionBps: 10001, ...sg })).toThrow(RangeError)
  })
})

describe('computeDiscount', () => {
  it('caps fixed discounts at the price and clamps percentages', () => {
    expect(computeDiscount(1000, { type: 'fixed', value: 5000 })).toBe(1000)
    expect(computeDiscount(1000, { type: 'percent', value: 250 })).toBe(1000)
    expect(computeDiscount(999, { type: 'percent', value: 10 })).toBe(100)
  })
})

describe('formatting', () => {
  it('formats SGD with thousands separators', () => {
    expect(formatSgd(8900)).toBe('S$89.00')
    expect(formatSgd(123450)).toBe('S$1,234.50')
    expect(formatSgd(0, { showFree: true })).toBe('Free')
    expect(formatSgd(5)).toBe('S$0.05')
  })
  it('parses typed prices', () => {
    expect(parseSgdToCents('89')).toBe(8900)
    expect(parseSgdToCents('S$ 1,234.5')).toBe(123450)
    expect(parseSgdToCents('12.345')).toBeNull()
    expect(parseSgdToCents('abc')).toBeNull()
  })
})

// ── Seat refunds ────────────────────────────────────────────────────────────

/** The design's example: one seat sold for S$500.00. */
const seat = quote({ listPriceCents: 50000, commissionBps: 1500, ...sg })
const A = seat.amountCents
const FEE = seat.applicationFeeCents
const N = seat.teacherNetCents

function refund(
  kind: SeatRefundKind,
  stripeFeeCents: number,
  extra: Partial<SeatRefundInput> = {},
  payment: { amountCents: number; applicationFeeCents: number } = {
    amountCents: A,
    applicationFeeCents: FEE,
  },
) {
  return seatRefund({
    kind,
    ...payment,
    stripeFeeCents,
    refundedCents: 0,
    feeRefundedCents: 0,
    ...extra,
  })
}

/**
 * What the profile and Elevate are left with on the seat after one refund: the profile got N and
 * Elevate C + E − F at the sale; R is taken back from the profile and X moves from Elevate to it.
 */
function nets(teacherNet: number, fee: number, f: number, r: number, x: number) {
  return { profile: teacherNet - r + x, elevate: fee - f - x }
}

describe('seatRefund', () => {
  it('matches the example amounts', () => {
    expect([A, seat.stripeFeeEstimateCents, seat.commissionCents, FEE, N]).toEqual([
      50000, 1750, 7238, 8988, 41012,
    ])
  })

  // The amounts table under "Refunds", for Stripe's fee as observed and as estimated.
  for (const f of [2000, 1750]) {
    const k = FEE - f
    describe(`with Stripe's fee at ${formatSgd(f)}`, () => {
      it('teacher_cancelled and changed_withdrew: all back, the profile bears F', () => {
        for (const kind of ['teacher_cancelled', 'changed_withdrew'] as const) {
          const r = refund(kind, f)
          expect(r).toEqual({ learnerRefundCents: A, feeRefundToProfileCents: k })
          const n = nets(N, FEE, f, r.learnerRefundCents, r.feeRefundToProfileCents)
          expect(n).toEqual({ profile: -f, elevate: 0 })
        }
      })

      it('learner_withdrew: all but F back, both left at zero', () => {
        const r = refund('learner_withdrew', f)
        expect(r).toEqual({ learnerRefundCents: A - f, feeRefundToProfileCents: k })
        expect(nets(N, FEE, f, r.learnerRefundCents, r.feeRefundToProfileCents)).toEqual({
          profile: 0,
          elevate: 0,
        })
      })

      it('elevate_cancelled and seat_lost: all back, Elevate bears F', () => {
        for (const kind of ['elevate_cancelled', 'seat_lost'] as const) {
          const r = refund(kind, f)
          expect(r).toEqual({ learnerRefundCents: A, feeRefundToProfileCents: FEE })
          const n = nets(N, FEE, f, r.learnerRefundCents, r.feeRefundToProfileCents)
          expect(n).toEqual({ profile: 0, elevate: -f })
        }
      })

      it('discretionary: X in proportion, rounded down', () => {
        const r = refund('discretionary', f, { requestedCents: 30000 })
        const x = Math.floor((k * 30000) / A)
        expect(r).toEqual({ learnerRefundCents: 30000, feeRefundToProfileCents: x })
        expect(nets(N, FEE, f, 30000, x)).toEqual({ profile: N - 30000 + x, elevate: k - x })
      })

      it('teacher_cancelled_part: the share of the blocks not taught', () => {
        const r = refund('teacher_cancelled_part', f, { blocksUntaught: 4, blocksTotal: 5 })
        expect(r).toEqual({
          learnerRefundCents: 40000,
          feeRefundToProfileCents: Math.floor((k * 40000) / A),
        })
      })

      it('dispute_lost: nothing refunded, the whole transfer taken back', () => {
        expect(refund('dispute_lost', f)).toEqual({
          learnerRefundCents: 0,
          feeRefundToProfileCents: 0,
          reversalCents: A,
        })
      })
    })
  }

  it('gives the worked examples: S$41.92 on a S$300 refund, S$55.90 on four blocks of five', () => {
    const discretionary = refund('discretionary', 2000, { requestedCents: 30000 })
    expect(discretionary.feeRefundToProfileCents).toBe(4192)
    expect(nets(N, FEE, 2000, 30000, 4192)).toEqual({ profile: 15204, elevate: 2796 })
    const part = refund('teacher_cancelled_part', 2000, { blocksUntaught: 4, blocksTotal: 5 })
    expect(part).toEqual({ learnerRefundCents: 40000, feeRefundToProfileCents: 5590 })
  })

  it('follows the table on a promo-discounted payment', () => {
    const p = quote({
      listPriceCents: 50000,
      promo: { type: 'percent', value: 20 },
      commissionBps: 1500,
      ...sg,
    })
    const payment = { amountCents: p.amountCents, applicationFeeCents: p.applicationFeeCents }
    const f = 1500
    const k = p.applicationFeeCents - f
    expect(refund('teacher_cancelled', f, {}, payment)).toEqual({
      learnerRefundCents: p.amountCents,
      feeRefundToProfileCents: k,
    })
    const w = refund('learner_withdrew', f, {}, payment)
    expect(nets(p.teacherNetCents, p.applicationFeeCents, f, w.learnerRefundCents, k)).toEqual({
      profile: 0,
      elevate: 0,
    })
  })

  it('takes a discretionary amount of 1 cent and of the full price', () => {
    expect(refund('discretionary', 2000, { requestedCents: 1 })).toEqual({
      learnerRefundCents: 1,
      feeRefundToProfileCents: 0,
    })
    expect(refund('discretionary', 2000, { requestedCents: A })).toEqual({
      learnerRefundCents: A,
      feeRefundToProfileCents: FEE - 2000,
    })
  })

  it('adds three discretionary refunds up to the price, returning exactly K', () => {
    let refundedCents = 0
    let feeRefundedCents = 0
    for (const requestedCents of [12345, 20001, A - 12345 - 20001]) {
      const r = refund('discretionary', 2000, { requestedCents, refundedCents, feeRefundedCents })
      refundedCents += r.learnerRefundCents
      feeRefundedCents += r.feeRefundToProfileCents
    }
    expect(refundedCents).toBe(A)
    expect(feeRefundedCents).toBe(FEE - 2000)
  })

  it('cancels a seat after a discretionary refund of S$100.00, leaving the profile −F', () => {
    const first = refund('discretionary', 2000, { requestedCents: 10000 })
    const then = refund('teacher_cancelled', 2000, {
      refundedCents: first.learnerRefundCents,
      feeRefundedCents: first.feeRefundToProfileCents,
    })
    expect(then.learnerRefundCents).toBe(40000)
    const r = first.learnerRefundCents + then.learnerRefundCents
    const x = first.feeRefundToProfileCents + then.feeRefundToProfileCents
    expect(nets(N, FEE, 2000, r, x)).toEqual({ profile: -2000, elevate: 0 })
  })

  it('returns no fee refund when Stripe took more than Elevate earned', () => {
    const payment = { amountCents: 150, applicationFeeCents: 55 }
    expect(refund('teacher_cancelled', 60, {}, payment)).toEqual({
      learnerRefundCents: 150,
      feeRefundToProfileCents: 0,
    })
    expect(refund('discretionary', 60, { requestedCents: 100 }, payment)).toEqual({
      learnerRefundCents: 100,
      feeRefundToProfileCents: 0,
    })
  })

  it('throws on a discretionary request above what is left', () => {
    expect(() => refund('discretionary', 2000, { requestedCents: A + 1 })).toThrow(RangeError)
    expect(() =>
      refund('discretionary', 2000, { requestedCents: 10001, refundedCents: 40000 }),
    ).toThrow(RangeError)
    expect(() => refund('discretionary', 2000)).toThrow(RangeError)
  })

  it('never returns more than is left on a part refund', () => {
    const r = refund('teacher_cancelled_part', 2000, {
      blocksUntaught: 5,
      blocksTotal: 5,
      refundedCents: 45000,
      feeRefundedCents: 6289,
    })
    expect(r.learnerRefundCents).toBe(5000)
    expect(r.feeRefundToProfileCents).toBe(6988 - 6289)
  })
})

/** The API's `netAfterRefunds` (earnings.service.ts) as it is today, for comparison. */
function netAfterRefunds(p: {
  refundedCents: number
  teacherNetCents: number
  amountCents: number
}) {
  if (p.refundedCents <= 0) return p.teacherNetCents
  if (p.refundedCents >= p.amountCents) return 0
  return p.teacherNetCents - Math.round((p.refundedCents * p.teacherNetCents) / p.amountCents)
}

describe('profileShareAfterRefunds', () => {
  const share = (
    refunds: { amountCents: number; applicationFeeRefundedCents: number | null }[],
    bankDisputeLost = false,
  ) =>
    profileShareAfterRefunds({
      teacherNetCents: N,
      amountCents: A,
      applicationFeeCents: FEE,
      refunds,
      bankDisputeLost,
    })
  const row = (r: { learnerRefundCents: number; feeRefundToProfileCents: number }) => ({
    amountCents: r.learnerRefundCents,
    applicationFeeRefundedCents: r.feeRefundToProfileCents,
  })

  it('is N with no refunds', () => {
    expect(share([])).toBe(N)
  })

  it('gives −S$20.00 for a cancelled seat and 0 for a withdrawal', () => {
    expect(share([row(refund('teacher_cancelled', 2000))])).toBe(-2000)
    expect(share([row(refund('changed_withdrew', 2000))])).toBe(-2000)
    expect(share([row(refund('learner_withdrew', 2000))])).toBe(0)
  })

  it('gives the table for every other kind', () => {
    expect(share([row(refund('elevate_cancelled', 2000))])).toBe(0)
    expect(share([row(refund('seat_lost', 2000))])).toBe(0)
    expect(share([row(refund('discretionary', 2000, { requestedCents: 30000 }))])).toBe(15204)
    expect(
      share([row(refund('teacher_cancelled_part', 2000, { blocksUntaught: 4, blocksTotal: 5 }))]),
    ).toBe(N - 40000 + 5590)
  })

  it('is 0 for a payment lost to a bank dispute', () => {
    expect(share([], true)).toBe(0)
    expect(share([row(refund('discretionary', 2000, { requestedCents: 100 }))], true)).toBe(0)
  })

  it('equals netAfterRefunds for refunds made before seat refunds', () => {
    for (const refundedCents of [0, 1, 333, 12345, 25000, 49999, A]) {
      const rows = refundedCents
        ? [{ amountCents: refundedCents, applicationFeeRefundedCents: null }]
        : []
      expect(share(rows), `${refundedCents}`).toBe(
        netAfterRefunds({ refundedCents, teacherNetCents: N, amountCents: A }),
      )
    }
    // Two old part refunds count as their total, as `refundedCents` does.
    expect(
      share([
        { amountCents: 10000, applicationFeeRefundedCents: null },
        { amountCents: 2345, applicationFeeRefundedCents: null },
      ]),
    ).toBe(netAfterRefunds({ refundedCents: 12345, teacherNetCents: N, amountCents: A }))
  })

  it('is N − the refunds + elevateFeeReturned, for every kind and the old way', () => {
    const cases = [
      [row(refund('teacher_cancelled', 2000))],
      [row(refund('learner_withdrew', 2000))],
      [row(refund('elevate_cancelled', 2000))],
      [row(refund('discretionary', 2000, { requestedCents: 30000 }))],
      [{ amountCents: 12345, applicationFeeRefundedCents: null }],
      [
        { amountCents: 10000, applicationFeeRefundedCents: null },
        { amountCents: 2000, applicationFeeRefundedCents: 300 },
      ],
    ]
    for (const refunds of cases) {
      const refunded = refunds.reduce((sum, r) => sum + r.amountCents, 0)
      const returned = elevateFeeReturned({ teacherNetCents: N, amountCents: A, refunds })
      expect(share(refunds)).toBe(N - refunded + returned)
    }
    expect(elevateFeeReturned({ teacherNetCents: N, amountCents: A, refunds: [] })).toBe(0)
  })
})
