import { elevateFeeReturned, elevateNetAfterRefunds, profileShareAfterRefunds } from '@elevate/core'
import type { schema as s } from '@elevate/db'

type PaymentRow = typeof s.payments.$inferSelect

/** The columns of a ledger row that the share reads. */
export type LedgerAmounts = { amountCents: number; applicationFeeRefundedCents: number | null }

/**
 * The profile's share of one payment after its refunds, by `profileShareAfterRefunds` in
 * `@elevate/core`: the one figure the earnings page, the held total and a payout use.
 *
 * A lost bank dispute zeroes the share of a class payment only: the release job takes that
 * transfer back. On a self-paced payment the loss is recorded and changes nothing else
 * (docs/designs/scheduled-classes-selling.md, "Bank disputes"), so the profile keeps its share.
 */
export function paymentShare(
  p: Pick<
    PaymentRow,
    'teacherNetCents' | 'amountCents' | 'applicationFeeCents' | 'classId' | 'bankDisputeStatus'
  >,
  refunds: readonly LedgerAmounts[],
): number {
  return profileShareAfterRefunds({
    teacherNetCents: p.teacherNetCents,
    amountCents: p.amountCents,
    applicationFeeCents: p.applicationFeeCents,
    refunds,
    bankDisputeLost: p.classId !== null && p.bankDisputeStatus === 'lost',
  })
}

/**
 * The part of Elevate's fee that one payment's refunds returned to the profile, by
 * `elevateFeeReturned` in `@elevate/core`. Zero for a class payment lost to a bank dispute, whose
 * share is zero too.
 */
export function feeReturned(
  p: Pick<
    PaymentRow,
    'teacherNetCents' | 'amountCents' | 'applicationFeeCents' | 'classId' | 'bankDisputeStatus'
  >,
  refunds: readonly LedgerAmounts[],
): number {
  if (p.classId !== null && p.bankDisputeStatus === 'lost') return 0
  return elevateFeeReturned({
    teacherNetCents: p.teacherNetCents,
    amountCents: p.amountCents,
    refunds,
  })
}

/** Elevate's net on one payment after its refunds, by `elevateNetAfterRefunds` in `@elevate/core`. */
export function elevateShare(
  p: Pick<
    PaymentRow,
    | 'teacherNetCents'
    | 'amountCents'
    | 'applicationFeeCents'
    | 'platformNetCents'
    | 'classId'
    | 'bankDisputeStatus'
  >,
  refunds: readonly LedgerAmounts[],
): number | null {
  return elevateNetAfterRefunds({
    teacherNetCents: p.teacherNetCents,
    amountCents: p.amountCents,
    applicationFeeCents: p.applicationFeeCents,
    platformNetCents: p.platformNetCents,
    refunds,
    bankDisputeLost: p.classId !== null && p.bankDisputeStatus === 'lost',
  })
}
