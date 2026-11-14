import type { schema as s } from '@elevate/db'

type PayoutAccountRow = typeof s.payoutAccounts.$inferSelect

/**
 * A profile can be paid when it has an active payout account that Stripe allows to take charges.
 * `status` is our own decision (see `ConnectService.applyAccountState`); `chargesEnabled` is
 * Stripe's, and Stripe can withdraw it later.
 */
export function isPayable(
  account:
    | Pick<PayoutAccountRow, 'status' | 'chargesEnabled' | 'stripeAccountId'>
    | null
    | undefined,
): account is PayoutAccountRow & { stripeAccountId: string } {
  return (
    !!account && account.status === 'active' && account.chargesEnabled && !!account.stripeAccountId
  )
}
