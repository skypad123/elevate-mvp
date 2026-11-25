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

import type { SeatRefundKind } from './class-sales'

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

// ── Seat refunds (docs/designs/scheduled-classes-selling.md, "Refunds") ─────
//
//   A  amountCents          the price paid
//   C+E applicationFeeCents  Elevate's fee: commission plus fee estimate
//   N  teacherNetCents      the profile's share, A − C − E
//   F  stripeFeeCents       Stripe's fee as charged
//   K  max(0, C + E − F)    what Elevate keeps after Stripe's fee
//
// A refund is R, returned to the learner and taken back from the profile, and X, returned from
// Elevate's fee to the profile.

export type SeatRefundInput = {
  kind: SeatRefundKind
  /** A. */
  amountCents: number
  /** C + E. */
  applicationFeeCents: number
  /** F, read from the payment. A caller whose payment has no fee recorded yet waits. */
  stripeFeeCents: number
  /** The total of R over the payment's ledger rows. */
  refundedCents: number
  /** The total of X over the payment's ledger rows. */
  feeRefundedCents: number
  /** For `discretionary`: the amount chosen. */
  requestedCents?: number
  /** For `teacher_cancelled_part`: U and B, counted when the class was cancelled. */
  blocksUntaught?: number
  blocksTotal?: number
}

export type SeatRefundAmounts = {
  /** R. */
  learnerRefundCents: number
  /** X. */
  feeRefundToProfileCents: number
  /** For `dispute_lost` only: what is left of the transfer to take back. */
  reversalCents?: number
}

/**
 * The two amounts of one seat refund. Every amount is whole cents and never below zero; the only
 * divisions round down. Several refunds on one payment add up: X for each is K × (the total of R
 * so far) ÷ A, rounded down, less the X already returned. `discretionary` throws when the amount
 * asked is above what is left; `teacher_cancelled_part` never returns more than is left.
 *
 * For `dispute_lost` the bank returned A, so R and X are 0 and Stripe returns Elevate's fee with
 * the reversal of `reversalCents`.
 */
export function seatRefund(input: SeatRefundInput): SeatRefundAmounts {
  const { kind, amountCents: a, applicationFeeCents: fee, stripeFeeCents: f } = input
  assertCents(a, 'amountCents')
  assertCents(fee, 'applicationFeeCents')
  assertCents(f, 'stripeFeeCents')
  assertCents(input.refundedCents, 'refundedCents')
  assertCents(input.feeRefundedCents, 'feeRefundedCents')
  const k = Math.max(0, fee - f)
  const left = Math.max(0, a - input.refundedCents)
  const keptBack = Math.max(0, k - input.feeRefundedCents)
  /** X for a refund of R worked out in proportion. */
  const proportional = (r: number) =>
    a === 0
      ? 0
      : Math.max(0, Math.floor((k * (input.refundedCents + r)) / a) - input.feeRefundedCents)
  const amounts = (r: number, x: number): SeatRefundAmounts => ({
    learnerRefundCents: Math.max(0, r),
    feeRefundToProfileCents: Math.max(0, x),
  })

  switch (kind) {
    case 'teacher_cancelled':
    case 'changed_withdrew':
      return amounts(left, keptBack)
    case 'learner_withdrew':
      return amounts(left - f, keptBack)
    case 'discretionary': {
      const r = input.requestedCents
      if (r === undefined) throw new RangeError('a discretionary refund needs requestedCents')
      assertCents(r, 'requestedCents')
      if (r > left) throw new RangeError(`requestedCents ${r} is above what is left, ${left}`)
      return amounts(r, proportional(r))
    }
    case 'teacher_cancelled_part': {
      const { blocksUntaught: u, blocksTotal: b } = input
      if (u === undefined || b === undefined || !Number.isInteger(u) || !Number.isInteger(b)) {
        throw new RangeError('a part refund needs whole blocksUntaught and blocksTotal')
      }
      if (b <= 0 || u < 0 || u > b) throw new RangeError(`blocks ${u} of ${b} are not valid`)
      const r = Math.min(Math.floor((a * u) / b), left)
      return amounts(r, proportional(r))
    }
    case 'elevate_cancelled':
    case 'seat_lost':
      return amounts(left, fee - input.feeRefundedCents)
    case 'dispute_lost':
      return { learnerRefundCents: 0, feeRefundToProfileCents: 0, reversalCents: left }
  }
}

export type ShareInput = {
  /** N. */
  teacherNetCents: number
  /** A. */
  amountCents: number
  /** C + E. */
  applicationFeeCents: number
  /**
   * The payment's ledger rows. A null fee refund is a refund made before seat refunds, which
   * returned Elevate's fee in proportion.
   */
  refunds: readonly { amountCents: number; applicationFeeRefundedCents: number | null }[]
  bankDisputeLost: boolean
}

/**
 * The profile's share of one payment after its refunds: N, less the total of R, plus the total of
 * X. Zero for a payment lost to a bank dispute. It can be below zero: a cancelled seat leaves −F.
 *
 * The rows with no fee refund recorded are taken together, with Elevate's fee returned in
 * proportion as `R − round(R × N ÷ A)`, so a payment refunded only the old way gives exactly what
 * the API's `netAfterRefunds` gives.
 */
export function profileShareAfterRefunds(input: ShareInput): number {
  if (input.bankDisputeLost) return 0
  const refunded = input.refunds.reduce((sum, row) => sum + row.amountCents, 0)
  return input.teacherNetCents - refunded + elevateFeeReturned(input)
}

/**
 * The total of X over one payment's ledger rows: the part of Elevate's fee returned to the
 * profile by its refunds, with the rows refunded before seat refunds counted in proportion as
 * `profileShareAfterRefunds` counts them. The earnings page shows it as its own line, so that
 * gross − Stripe's fee − commission − refunded + this = the profile's share.
 */
export function elevateFeeReturned(
  input: Pick<ShareInput, 'teacherNetCents' | 'amountCents' | 'refunds'>,
): number {
  let feeRefunded = 0
  let oldWay = 0
  for (const row of input.refunds) {
    if (row.applicationFeeRefundedCents === null) oldWay += row.amountCents
    else feeRefunded += row.applicationFeeRefundedCents
  }
  if (oldWay > 0 && input.amountCents > 0) {
    feeRefunded += oldWay - Math.round((oldWay * input.teacherNetCents) / input.amountCents)
  }
  return feeRefunded
}

/**
 * Elevate's net on one payment after its refunds: its net before refunds (the application fee less
 * Stripe's actual fee), less the part of its fee the refunds returned to the profile. Null while
 * Stripe's fee is not known, and for a payment lost to a bank dispute, which Stripe settles apart.
 */
export function elevateNetAfterRefunds(
  input: ShareInput & { platformNetCents: number | null },
): number | null {
  if (input.platformNetCents === null || input.bankDisputeLost) return null
  return input.platformNetCents - elevateFeeReturned(input)
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
