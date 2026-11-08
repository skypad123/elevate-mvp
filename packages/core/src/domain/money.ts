/**
 * Fee math for a destination charge. Integer cents only.
 *
 *   amount          = listPrice − discount
 *   stripeFeeEst    = round(amount · stripeFeeBps / 10000) + stripeFixedCents
 *   commission      = round((amount − stripeFeeEst) · commissionBps / 10000)
 *   teacherNet      = amount − stripeFeeEst − commission        (what Stripe transfers to the teacher)
 *   applicationFee  = amount − teacherNet                        (Stripe's application_fee_amount)
 *
 * The platform pays Stripe's real fee out of the application fee, so its net is
 * applicationFee − actual Stripe fee (≈ commission when the estimate is right).
 */

export type PromoDiscount = { type: 'percent'; value: number } | { type: 'fixed'; value: number }

export type QuoteInput = {
  listPriceCents: number
  promo?: PromoDiscount | null
  /** Teacher's commission in basis points, e.g. 1500 = 15%. */
  commissionBps: number
  /** Stripe percentage fee in basis points, e.g. 340 = 3.4%. */
  stripeFeeBps: number
  /** Stripe fixed fee per charge in cents, e.g. 50 = S$0.50. */
  stripeFixedCents: number
  /** Smallest chargeable amount. Below it (but above zero) the quote must be rejected. Default S$1. */
  minimumChargeCents?: number
}

export type Quote = {
  listPriceCents: number
  discountCents: number
  amountCents: number
  stripeFeeEstimateCents: number
  commissionCents: number
  teacherNetCents: number
  applicationFeeCents: number
  platformNetEstimateCents: number
  /** Nothing to charge; enrol without Stripe. */
  isFree: boolean
  /** Positive but under the minimum: not chargeable. */
  belowMinimum: boolean
}

export const DEFAULT_MINIMUM_CHARGE_CENTS = 100

function assertCents(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer number of cents, got ${value}`)
  }
}

function assertBps(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    throw new RangeError(`${label} must be an integer between 0 and 10000, got ${value}`)
  }
}

export function computeDiscount(listPriceCents: number, promo?: PromoDiscount | null): number {
  if (!promo) return 0
  if (promo.type === 'percent') {
    const pct = Math.min(100, Math.max(0, promo.value))
    return Math.round((listPriceCents * pct) / 100)
  }
  return Math.min(Math.max(0, Math.trunc(promo.value)), listPriceCents)
}

export function quote(input: QuoteInput): Quote {
  assertCents(input.listPriceCents, 'listPriceCents')
  assertCents(input.stripeFixedCents, 'stripeFixedCents')
  assertBps(input.commissionBps, 'commissionBps')
  assertBps(input.stripeFeeBps, 'stripeFeeBps')

  const minimum = input.minimumChargeCents ?? DEFAULT_MINIMUM_CHARGE_CENTS
  const discountCents = computeDiscount(input.listPriceCents, input.promo)
  const amountCents = input.listPriceCents - discountCents

  if (amountCents === 0) {
    return {
      listPriceCents: input.listPriceCents,
      discountCents,
      amountCents: 0,
      stripeFeeEstimateCents: 0,
      commissionCents: 0,
      teacherNetCents: 0,
      applicationFeeCents: 0,
      platformNetEstimateCents: 0,
      isFree: true,
      belowMinimum: false,
    }
  }

  const stripeFeeEstimateCents = Math.min(
    amountCents,
    Math.round((amountCents * input.stripeFeeBps) / 10000) + input.stripeFixedCents,
  )
  const netAfterFee = amountCents - stripeFeeEstimateCents
  const commissionCents = Math.round((netAfterFee * input.commissionBps) / 10000)
  const teacherNetCents = netAfterFee - commissionCents
  const applicationFeeCents = amountCents - teacherNetCents

  return {
    listPriceCents: input.listPriceCents,
    discountCents,
    amountCents,
    stripeFeeEstimateCents,
    commissionCents,
    teacherNetCents,
    applicationFeeCents,
    platformNetEstimateCents: applicationFeeCents - stripeFeeEstimateCents,
    isFree: false,
    belowMinimum: amountCents < minimum,
  }
}

/** Formats integer cents as "S$1,234.50". Hand-rolled so Hermes and browsers agree. */
export function formatSgd(cents: number, options: { showFree?: boolean } = {}): string {
  if (cents === 0 && options.showFree) return 'Free'
  const negative = cents < 0
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const frac = (abs % 100).toString().padStart(2, '0')
  return `${negative ? '−' : ''}S$${whole}.${frac}`
}

/** Parses a price typed by a teacher ("89", "89.9", "S$ 1,234.50") into cents. Returns null when invalid. */
export function parseSgdToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d.]/g, '')
  if (!cleaned || !/^\d*(\.\d{0,2})?$/.test(cleaned)) return null
  const [whole = '0', frac = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0').slice(0, 2))
}
