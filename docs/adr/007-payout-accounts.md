# ADR 007 — Payout accounts: every sale records the Stripe account it paid

**Status:** accepted · 2026-11-12

Builds on [ADR 003](003-payments-destination-charges.md) (destination charges) and
[ADR 006](006-teacher-profiles.md) (teaching profiles). Design:
[`docs/designs/teacher-profiles.md`](../designs/teacher-profiles.md), sections 4 to 6.

## Decision

- **Each Stripe connected account is a `payout_accounts` row.** A profile has at most one for
  now. Its `business_type` (`individual` or `company`) comes from the profile type when the
  account is created. The row is inserted first, the Stripe account is created with the row's ID
  and the profile's ID in its metadata, then Stripe's ID is stored, all in one transaction.
- **`payments.payout_account_id` is required and never updated.** `payments.profile_id` records
  the profile at the time of sale, for audit. Adding the column later would have meant rewriting
  payment rows, so it is there from the start.
- **The payee is fixed when checkout starts.** The Checkout session's destination is the payout
  account's Stripe ID, and its metadata carries `elevatePayoutAccountId` and `elevateProfileId`.
  Fulfilment reads the payee from that metadata, not from the course as it is at payment time.
  The idempotency key includes the payout account.
- **A paid session with no payee is an error, not a guess.** If the metadata is missing or names
  an account that does not exist, no payment is written: the webhook fails and the error is
  stored with the event, and the success-page poll reports the session as still pending.
- **Earnings follow the account.** Earnings, per-course earnings, reconciliation and the Support
  ledger select payments by `payout_account_id`, not by profile or by who owns the course.
- **One rule activates an account.** `applyAccountState` stores Stripe's flags and decides the
  status; the `account.updated` webhook and the status check both call it. An individual account
  becomes `active` the first time Stripe enables charges. A company account stays `onboarding`
  until Support has recorded that its legal name matches (built with corporate profiles).
- **A course can be bought only when its profile's account is `active` and Stripe allows
  charges.** Stripe can withdraw charges later, and selling stops when it does.
- **Stripe links are the owner's, and need a recent sign-in.** Onboarding and dashboard links
  need the `stripe.links` capability and a session less than 24 hours old; an older session is
  asked to sign in again. Each request is audited and emails the owner.

## Consequences

- An `account.updated` event for an account with no row is stored as a webhook error instead of
  being ignored.
- Reconciliation shows a difference when Stripe transferred money for a session that could not
  be attributed, which is how such a session is noticed.
- A refund made in the Stripe dashboard emails the learner and the profile's owner, as a Support
  refund does, once per refund.
- A later change that lets a personal profile become a company can give a profile a second
  account for a while. That needs a `retired` status and "at most one active account" in place of
  the unique `profile_id`; both are additive.
