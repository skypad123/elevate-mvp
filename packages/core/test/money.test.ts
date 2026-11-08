import { describe, expect, it } from 'vitest'
import { computeDiscount, formatSgd, parseSgdToCents, quote } from '../src/domain/money'

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
