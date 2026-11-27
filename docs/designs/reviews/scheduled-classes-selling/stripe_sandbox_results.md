# Stripe Test Session: Scheduled Classes, Part 2 (Selling a Class)

- **Why:** the review's Blocker B1 lists Stripe behaviour the design rests on
  and nobody had tested. Blocker B2 questions the reason for rejecting
  platform-held money. This session answers what a test account and Stripe's
  documentation can answer.
- **Date:** 2026-11-24
- **Where:** the author's Stripe sandbox, a Singapore platform with SGD, in test
  mode. No live request was made.
- **API version:** `2026-10-28.endive`, the version pinned by `stripe` 23.1.0 in
  this repo.

## How it was run

A script drove the Stripe CLI. Each test used one S$500 payment with the
repo's default rates: an application fee of S$89.88, made of S$72.38 commission
and an S$17.50 estimate of Stripe's fee, leaving the teacher S$410.12.

The sandbox had no connected accounts, so the session created one.

| Property                      | The test account | What the API creates today |
| ----------------------------- | ---------------- | -------------------------- |
| Country                       | SG               | SG                         |
| `controller.losses.payments`  | `application`    | `application`              |
| `controller.fees.payer`       | `application`    | `application`              |
| `controller.stripe_dashboard` | `none`           | `express`                  |
| Requirements collected by     | The platform     | Stripe's hosted onboarding |

The test account differs in the last two rows because an account onboarded by
Stripe's hosted form cannot be verified through the API. Who bears losses and
fees is the same, and those are the settings the refund and reversal behaviour
depends on. The Express dashboard question was answered from documentation.

## What could not be tested

- **Creating a payout, in full or in part.** Stripe did not enable payouts on
  the test account: Singapore requires a liveness check, which needs a person.
  An earlier documentation check found part payouts are allowed.
- **What happens at the 90-day limit.** It cannot be reached in a test.
- **A Singapore card.** Every charge used Stripe's standard test cards, which
  are US cards. The fee on a domestic card was not observed.

## Results from the test account

| #   | Question                                                                                    | Result                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Which call switches an account to manual payouts?                                           | `POST /v1/accounts/{id}` with `settings[payouts][schedule][interval]=manual` works on this version. `GET /v1/balance_settings` for the account then shows `manual`. Switching back also works.                                                         |
| 2   | How much is transferred on a destination charge?                                            | The whole S$500. The application fee of S$89.88 is then taken back from the teacher's balance, leaving S$410.12.                                                                                                                                       |
| 3   | Who is the seller on the card statement?                                                    | The platform. `on_behalf_of` is empty and the statement descriptor is the platform's.                                                                                                                                                                  |
| 4   | Is Stripe's actual fee the estimate?                                                        | No. The actual fee was S$20.00 on every charge, against the S$17.50 estimate. The test card is foreign, and the difference is 0.5% of the amount.                                                                                                      |
| 5   | Refund in full with the transfer reversed and the fee kept, then refund S$72.38 of the fee? | Both calls succeed. The teacher ends S$17.50 down on the seat, as the design intends.                                                                                                                                                                  |
| 6   | Refund S$482.50 with the transfer reversed, then refund S$72.38 of the fee?                 | Both calls succeed. S$482.50 of the transfer is reversed, in proportion. The teacher ends at zero on the seat, as the design intends.                                                                                                                  |
| 7   | The other order: fee refund first, then the charge?                                         | Also allowed, with the same end result.                                                                                                                                                                                                                |
| 8   | A fee refund larger than what is left of the fee?                                           | Refused: "Refund amount ($89.88) is greater than unrefunded amount on fee ($17.50)".                                                                                                                                                                   |
| 9   | A reversal larger than the teacher's available balance?                                     | It succeeds. The balance goes negative. With nothing else in the account, the teacher's balance was −S$89.88 after the refund and −S$17.50 after the fee refund. Nothing was refused.                                                                  |
| 10  | A reversal against money that is still pending?                                             | It succeeds. The pending balance went negative by S$89.88.                                                                                                                                                                                             |
| 11  | The same idempotency key sent twice?                                                        | The second call returns the first refund, and the first fee refund. Nothing is sent twice.                                                                                                                                                             |
| 12  | Does a list of refunds for a charge carry what a webhook handler needs?                     | Yes: each refund's id, amount and metadata. A refund can be tagged and recognised later.                                                                                                                                                               |
| 13  | Who is debited when a learner disputes a destination charge?                                | The platform: S$500 plus a S$15 fee. The teacher's balance did not change.                                                                                                                                                                             |
| 14  | Can a disputed charge be refunded?                                                          | No, neither while the dispute is open nor after it is lost. Stripe answers `charge_disputed`: "has been charged back; cannot issue a refund".                                                                                                          |
| 15  | After a lost dispute, can the teacher's share be taken back?                                | Yes. `POST /v1/transfers/{id}/reversals` with `refund_application_fee=true` reversed the whole S$500 and returned the whole application fee. The teacher ended at zero on the seat.                                                                    |
| 16  | The other shape: charge on the platform, transfer later?                                    | It works between a Singapore platform and a Singapore account. A charge with no destination succeeded, and `POST /v1/transfers` with `source_transaction` moved S$410.12 to the teacher. Reversing that transfer and refunding the charge also worked. |
| 17  | Is the charge's fee known when the payment succeeds?                                        | Not at once. On this version the charge's balance transaction, transfer and application fee were empty in the answer to the payment call, and filled a few seconds later.                                                                              |
| 18  | Can a payment be limited to cards with `payment_method_types`?                              | No. This version refuses the parameter: "no longer supported. Payment methods are now managed from your Dashboard settings".                                                                                                                           |

## Results from Stripe's documentation

Each answer was read from the page named, on 2026-11-24.

| Question                                                                         | Answer                                                                                                                                                                                                                                                      | Page                                                                  |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Can a teacher pay themselves out from the Express dashboard?                     | Yes, unless the platform turns two features off. "They can also update their payout schedule (manual vs. automatic) and manually pay themselves out, if these features are enabled." The settings are under Settings, Connect, Express Dashboard, Features. | `docs.stripe.com/connect/express-dashboard`                           |
| How long can money wait under manual payouts in Singapore?                       | 90 days ("All other countries"). How the days are counted is not stated. What Stripe does at the limit is not stated on the current page; a legacy page says funds are held "until a maximum of 90 days have passed".                                       | `docs.stripe.com/connect/manual-payouts`                              |
| Is the older call for manual payouts being removed?                              | No. "If you're currently using `settings.payouts` on Accounts v1, you can continue to do so." The guides now show the Balance Settings API.                                                                                                                 | `docs.stripe.com/connect/manual-payouts`                              |
| Who is the business of record on a destination charge with no `on_behalf_of`?    | The platform. "If `on_behalf_of` is omitted, the platform is the business of record for the payment." and "Stripe debits dispute amounts and fees from your platform account."                                                                              | `docs.stripe.com/connect/destination-charges`                         |
| Is keeping the fee and refunding it separately a documented use?                 | Yes. "you can provide a `refund_application_fee` value of false and refund the application fee separately through the API."                                                                                                                                 | `docs.stripe.com/connect/destination-charges`                         |
| Who carries a connected account's negative balance?                              | The platform, when it bears losses. "Stripe holds a reserve on your platform account's `available` balance."                                                                                                                                                | `docs.stripe.com/connect/account-balances`                            |
| Is there a limit on how long the platform may hold money before transferring it? | Not stated for separate charges and transfers. The balances page gives the same 90-day table for holding funds, worded so that it is unclear whether it covers the platform's own balance.                                                                  | `docs.stripe.com/connect/separate-charges-and-transfers`              |
| How long does Stripe remember an idempotency key?                                | At least 24 hours. "We generate a new request if a key is reused after the original is pruned."                                                                                                                                                             | `docs.stripe.com/api/idempotent_requests`                             |
| How late can a learner dispute a payment?                                        | "Card networks typically allow cardholders to initiate disputes within 120 days of the original payment". For a service on a later date, "the dispute window starts on the event date, not the payment date."                                               | `docs.stripe.com/disputes/how-disputes-work`                          |
| What does a dispute cost in Singapore?                                           | S$15 when it is received, and S$15 more if it is contested, returned on a win.                                                                                                                                                                              | `support.stripe.com/questions/june-2025-pricing-updates-for-disputes` |

## What this changes in the review

**The refund sequence works (B1).** Both orders are accepted, the amounts
match the design's refund table, and a replayed key sends nothing twice. The
fallback in the design is not needed.

**A refund is not refused for lack of balance (B6, M5).** The reversal goes
through and the teacher's balance goes negative. So a cancellation's refunds
do not get stuck on an empty account, which the design critic expected. The
cost moves instead: Stripe holds a reserve on Elevate's balance against the
teacher's negative balance. The goal "Elevate does not lose money on a refund
it did not cause" is true only if that teacher later earns enough to cover it.

**A refund is refused for a disputed charge (B6).** This part of the design
critic's scenario is confirmed. A refund row for a seat with a dispute can
never succeed and must be skipped.

**The teacher can undo the hold unless two settings are off (B1).** The Express
dashboard lets an account holder change the payout schedule and pay themselves
out when the platform has those features on. If class money stays in the
teacher's account, both features must be off in the sandbox and in live mode
before any class is sold, and the design must say so.

**The reason for rejecting platform-held money does not hold (B2).** The test
and the documentation agree: Elevate is already the business of record, its
name is on the card statement, and disputes and their fees already come out of
Elevate's balance. The other shape also works in Singapore. Two questions about
it remain open: the licensing question, and whether a holding limit applies to
the platform's own balance.

**Disputes after release are the normal case (B5).** Release is 7 days after
the class. A learner can dispute for about 120 days, counted from the class
date for a service delivered later. The two held totals disagree whenever that
happens.

**Elevate's fee does not always cover Stripe's (M5).** On a foreign card the
actual fee was S$2.50 above the estimate inside the application fee. On such a
seat Elevate is S$2.50 down after a teacher's cancellation or a learner's
withdrawal, where the design says zero. The domestic fee was not observed.

**The actual fee is not known at the moment of payment (M5).** It arrives a
few seconds later. Code that records it at fulfilment can find it empty.

**The suggested way to limit a class to cards does not work (M3).** The
design critic proposed pinning class checkout to immediate payment methods.
`payment_method_types` is refused on this version, so excluding delayed
methods needs another mechanism, which was not tested.

**The lost-dispute path works (M5).** Reversing the transfer with the fee
refunded takes back the teacher's whole share after a lost dispute.

## Still open

- How the 90 days are counted, and what Stripe does at the limit. Stripe's
  support is the only source.
- Whether a holding limit applies to money kept on the platform.
- Whether holding money for teachers brings a licensing duty, for either
  shape. A lawyer's question.
- Manual and part payouts on a real connected account. This needs an account
  that has passed the liveness check.
- The fee on a Singapore card.

## PayNow session, 2026-11-25

The author decided that class checkout allows cards and PayNow (decision R6
in `author_decisions.md`). The first session used cards only, so the calls
were run again on PayNow payments, in the same sandbox and on the same API
version.

**How it was run.** Scripts drove the Stripe CLI, as before. Each PayNow
payment was a S$500 destination charge with the S$89.88 application fee. A
PayNow payment is authorized on Stripe's test payment page, which the scripts
opened. For the two payment page tests, a headless browser opened Stripe's
hosted page, chose PayNow and pressed Pay, so that the QR code existed before
the page was expired.

### Results from the test account

| #   | Question                                                                                | Result                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Does a Checkout Session take `allowed_payment_method_types` on this version?            | Yes. A session created with `card` and `paynow` reports those two. The hosted page offered Card and PayNow, and showed Apple Pay and Link buttons above them.                                                       |
| P2  | Does a PayNow destination charge move money as a card one does?                         | Yes. The whole S$500 is transferred and the S$89.88 application fee is taken back, leaving the teacher S$410.12, pending.                                                                                           |
| P3  | What is Stripe's fee on a PayNow payment?                                               | S$7.09 on S$500: S$6.50 of processing fee, which is 1.3%, and S$0.59 of GST. The estimate is S$17.50. The fee was readable a few seconds after the payment.                                                         |
| P4  | Withdrawal: refund S$492.91 with the transfer reversed, then refund S$82.79 of the fee? | Both calls succeed. S$492.91 of the transfer is reversed. The teacher ends at zero on the seat, and so does the platform, as the design intends.                                                                    |
| P5  | Cancellation by the teacher, other order: S$82.79 of the fee first, then refund S$500?  | Both calls succeed. The teacher ends S$7.09 down on the seat, as the design intends.                                                                                                                                |
| P6  | A lost seat: refund S$500 with the transfer reversed, then the whole S$89.88 fee?       | Both calls succeed. The teacher ends at zero and the platform S$7.09 down, as the design intends.                                                                                                                   |
| P7  | Is a PayNow refund made at once?                                                        | No. The answer to the refund call has the status `pending`. A few seconds later the refund read `succeeded`. A card refund is `succeeded` in the answer. The refund's id has a different form from a card refund's. |
| P8  | The same idempotency key sent twice?                                                    | The second call returns the first refund.                                                                                                                                                                           |
| P9  | Does the teacher's account need the PayNow capability?                                  | No. With the capability turned off on the test account, a PayNow payment and its full refund both went through. The capability was then turned back on.                                                             |
| P10 | A PayNow payment cancelled while its QR code is open, then authorized?                  | Stripe's test page showed the payment as abandoned. Authorizing it took no money, and the payment stayed cancelled.                                                                                                 |
| P11 | A payment page expired through the API while its QR code is open, then authorized?      | Expiring the page cancelled the PayNow payment, with the reason `automatic`. Authorizing the QR code took no money.                                                                                                 |
| P12 | A payment page left to expire by itself while its QR code is open, then authorized?     | The page expired at its time, 31 minutes after it was made. Within a minute Stripe had cancelled the PayNow payment, with the reason `automatic`. Authorizing the QR code then took no money.                       |

All three refunds were made while the teacher's money was still pending.

### Results from Stripe's documentation

Read from `docs.stripe.com/payments/paynow` on 2026-11-25.

| Question                                    | Answer                                                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can a PayNow payment be disputed at a bank? | No. "Customers can't file a chargeback, and funds are never withdrawn from your Stripe balance because of a dispute."                                                                                     |
| How does a PayNow refund complete?          | "Refunds for PayNow payments are asynchronous and take up to 5 minutes to complete." If one fails, "Stripe returns the amount to your Stripe balance. You must refund the customer using another method." |
| How late can a PayNow payment be refunded?  | Within 90 days of the payment.                                                                                                                                                                            |
| How long is a QR code valid?                | 1 hour.                                                                                                                                                                                                   |
| When is PayNow money available?             | "Funds become available in your Stripe balance 1 day after the transaction." In the sandbox the test payments showed about 7 days.                                                                        |

### Not tested

- A PayNow refund that fails. None could be produced in the sandbox, so it is
  not known whether Stripe then puts back the transfer it reversed.
- A QR code in a real bank app after its payment page has expired.
- A payment through the Link button or the Apple Pay button on the page.

### Two more tests, later the same day

| #   | Question                                                            | Result                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P13 | Can one payment page hide the Link button?                          | Yes. A page created with `wallet_options.link.display` set to `never` showed Card, PayNow and Apple Pay, and no Link button. Class checkout does this.                                                                                                                   |
| P14 | Can a card payment be refunded after Elevate wins its bank dispute? | Yes. While the dispute was open the refund was refused with `charge_disputed`. After it was won with Stripe's test evidence, the refund with the transfer reversed and the fee refund both succeeded. The teacher ended S$20.00 down on the seat, as the design intends. |

### What this changed in the design

- A seat refund counts as made when Stripe reports that it succeeded, not
  when the call returns. A failed one goes to Support.
- The open question on PayNow is replaced by three smaller ones: a failed
  refund, a real bank app, and the Link button.
- A PayNow payment has the same window as a card payment, because the
  payment page's expiry cancels it.

## What the session left in the sandbox

- One test connected account, with its payout schedule put back to daily. Its
  balance is −S$35.00: two seats where the teacher bears S$17.50.
- Eight test payments of S$500: six refunded in full, one refunded S$482.50,
  and one disputed and lost.
- No webhook endpoint or setting was changed.
- From the PayNow session: four PayNow payments of S$500, three refunded in
  full and one refunded S$492.91; three PayNow payments that were cancelled
  unpaid; and three expired payment pages. The test account's balance is now
  −S$62.09 after the won-dispute test. Its PayNow capability was turned off for one test and turned back
  on.
