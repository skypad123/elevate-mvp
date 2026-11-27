# ADR 013 — Class seats are sold, and class money is held in the profile's own Stripe account until a job releases it

**Status:** accepted · 2026-11-25

The design, its alternatives and the step-by-step plan are in
[`docs/designs/scheduled-classes-selling.md`](../designs/scheduled-classes-selling.md) (Part 2 of
scheduled classes). The author's decisions are in
[`author_decisions.md`](../designs/reviews/scheduled-classes-selling/author_decisions.md) (numbers 1
to 5 and R1 to R7), and the best-guess answers in
[`best_guess_answers.md`](../designs/reviews/scheduled-classes-selling/best_guess_answers.md) (G1 to
G22). This record keeps the decisions later work must not undo. It extends
[ADR 003](003-payments-destination-charges.md) and [ADR 007](007-payout-accounts.md) for profiles
that opt in, and leaves them unchanged for every other profile.

## Context

After Part 1 ([ADR 012](012-class-records-and-attendance.md)) a class had records and attendance,
and no way in. Under ADR 003 a profile is paid the moment a learner pays. That is safe for a course
delivered at once, but a class is sold weeks before it is taught: a cancelled class would pull
refunds from a profile that may already have been paid, and Elevate would carry the shortfall.
ADR 003's refund is always the full price and always costs Elevate Stripe's fee, while the author
decided that whoever ends a seat bears that fee. Checkout knew one enrollment per learner and
course, and nothing limited how many learners could pay for the last seat.

## Decision

- **A seat is an active class enrollment, and an unpaid one is the reservation.** Class checkout
  writes the learner's row as `pending_payment` with `seat_reserved_until` 35 minutes ahead, for a
  payment page that lasts 30. Seats taken are the class's enrollments that are `active`, or
  `pending_payment` with a reservation in the future, counted when read by `seatsTaken` in
  `class-checkout.service.ts`, so a reservation ends by the clock and no job ends it. A learner may
  start 3 reservations of one class in 24 hours. Class checkout is the only code that makes a class
  enrollment, and a move (`seats.service.ts`) the only code that changes its class. A transaction
  that locks a class and an enrollment locks the class first. Enrollment statuses keep their four
  values, so an older app meets nothing new.
- **Class money stays in the profile's own Stripe account, on manual payouts** (decision 1). The
  sale is ADR 003's destination charge to the payee ADR 007 fixes. Elevate's own balance was not
  used because:
  - Elevate would then hold money owed to profiles, which fits the wording of a "domestic money
    transfer service" in the Payment Services Act and sharpens the licensing question (G9). Here
    Stripe holds the money in the profile's account;
  - a profile would see its held money only in Teach, not in its own Stripe balance;
  - class sales would be a second payment model beside ADR 003;
  - Stripe's fee on a cancelled seat would have to come out of a later transfer.
- **A profile opts in, and can leave on 30 days' notice** (G16). Only the owner opts in
  (`stripe.links` and a recent sign-in), with a payable account and the current held-payout terms.
  One transaction records the acceptance and sets `payout_mode` to `switching`; then the Stripe
  account is switched to manual payouts and its balance read; then one transaction sets `manual`
  and `manual_since` and writes the balance as two opening adjustments. The release job finishes an
  opt-in left at `switching` for more than 5 minutes. From a notice to leave, the profile's classes
  are not on sale; seats already sold run as usual. Once `leave_on` has passed and no class payment
  is unreleased, no seat refund is unfinished and no payout is at `sending`, the job switches the
  account back to Stripe's daily automatic payouts and emails the owner. The "Edit payout schedule"
  and "Manual payouts" features of the Express dashboard are off for the whole platform (G2), or
  the holding is not a control.
- **A class is on sale only when `classOnSale` in `packages/core` says so:** `CLASS_SALES` on; the
  class published, not cancelled and not started; its last block ending within 75 days; its profile
  opted in, on `manual`, not leaving, with a payable account; its course live. `CLASS_SALES` off
  stops new sales and nothing else.
- **Only the release job sends a seat refund or a payout** (decision 5). No request handler calls
  Stripe to refund, reverse or pay out for a class seat: withdrawing, moving, cancelling (by the
  profile or by Elevate) and a discretionary refund write rows in one transaction. The job is
  `dist/release.js` in the API image, started every 15 minutes by EventBridge Scheduler; a Postgres
  advisory lock keeps runs from overlapping, and every step works from stored state, so a run that
  stops is followed by one that sends nothing twice. The one exception is Support's existing
  "Refund in full", which refunds from the request as before and is refused while the payment has
  an unfinished seat refund.
- **Every refund of a seat the system starts is one `seat_refunds` row**, written by
  `SeatRefundsService.request` before any money moves, with one unfinished row per enrollment.
  Its amounts come only from `seatRefund()` in `packages/core/src/domain/money.ts`, worked out when
  the job first sends the row from **Stripe's real fee for that payment** (R2), not the estimate. A
  profile's share of a payment after refunds comes only from `profileShareAfterRefunds()` in the
  same file; the held total, the payable items, Teach earnings and the after-payout adjustments all
  use it. These two functions are the only places either is computed.
- **The refund table.** R is returned to the learner and taken back from the profile; X is returned
  from Elevate's fee to the profile. A is the price paid, C + E Elevate's fee, N the profile's share,
  F Stripe's fee, K = C + E − F (never below zero). U is the blocks not taught and B all blocks,
  counted when the class is cancelled.

  | Kind                                    | R                         | X                       | Profile's net | Elevate's net |
  | --------------------------------------- | ------------------------- | ----------------------- | ------------- | ------------- |
  | `teacher_cancelled`, `changed_withdrew` | A                         | K                       | −F            | 0             |
  | `learner_withdrew`                      | A − F                     | K                       | 0             | 0             |
  | `discretionary`, for a chosen R         | R                         | K × R ÷ A, rounded down | N − R + X     | K − X         |
  | `teacher_cancelled_part`                | A × U ÷ B, rounded down   | K × R ÷ A, rounded down | N − R + X     | K − X         |
  | `elevate_cancelled`, `seat_lost`        | A                         | C + E                   | 0             | −F            |
  | `dispute_lost`                          | None: the bank returned A | C + E                   | 0             | −F − S$15     |

  Several refunds on one payment add up, and X for each is worked out on the running total. Elevate's
  money on a seat is never reduced by a refund it did not cause.
- **A refund counts as made only when Stripe reports that it succeeded.** The job refunds R with
  the transfer reversed and Elevate's fee kept, and the row becomes `refund_sent`. A card refund
  succeeds at once; a PayNow refund is pending for up to 5 minutes and can fail. Only on `succeeded`
  does the job refund X of Elevate's fee, record the ledger row through `applyRefund`, mark the row
  `done` and email anyone. A refund Stripe accepted and then failed makes the row `failed`; it
  cannot be retried, because the profile's share was already taken back, and Support refunds the
  learner another way (G6). Each Stripe call carries the row's id as the label `seat_refund_id` and
  an idempotency key with the row's first attempt; past 23 hours the job looks for the label at
  Stripe before repeating a step. The webhook records nothing for a refund that carries the label.
- **"Attended", in a money rule, means counted as attended: `moneyAttendance` in `packages/core`.**
  A learner is counted when, for at least one block, they have a check-in that stands or a manual
  mark left undisputed for 7 days. A disputed mark never counts. A learner is emailed when marked
  present by hand.
- **Withdrawal.** A learner not counted as attended and with no open manual mark can withdraw until
  7 days before the first block, for A − F. After a move or a change to a block's time, they can
  withdraw in full until the class starts (R3).
- **Cancellation by the profile** (owner or manager, `class.manage`, recent sign-in; refused once
  the class is released). Each learner not counted as attended is refunded in full and the profile
  bears F; a row for a learner with an open manual mark waits for it. A learner counted as attended
  is refunded the share of the price for the blocks not taught, with both fees shared in the same
  proportion (G12, `teacher_cancelled_part`); when every block had started, nothing.
- **Cancellation by Elevate** (a Support admin) needs one of five grounds and a note (G17):
  `teacher_absent`, `venue_unavailable`, `rules_breach`, `profile_suspended` or `required_by_law`.
  Every seat is refunded in full, attended or not, and Elevate bears F (R4). The owner is emailed
  the ground and the note. What is taken back from the profile is never more than what is refunded.
- **A discretionary refund** needs `class.refund` (owner and managers) and a recent sign-in, until
  the payment is released. The learner keeps the seat.
- **When money is released.** A class is due 7 days after its last block ends, or after it was
  cancelled, once none of its manual marks is open (R5) and any cancellation is complete. A due
  class with nobody counted as attended waits for a Support admin. A released class's payments are
  released unless a bank dispute is open or a seat refund is unfinished. Any class payment 85 days
  old is released whatever its state, with the reason `day_limit`, because Stripe allows money to
  wait for a manual payout for 90 days, counted here from each payment (G1). A seat is sold, moved or re-timed only into a class that ends within
  75 days of its payment.
- **Three bounds on a payout, and a mark on each payment** (decision 4, R1). A payout is never more
  than the smallest of: the available balance, which Stripe would otherwise refuse; the whole
  balance less the held total, which keeps class money in the account; and the payable items the
  database names. The items are whole payments and adjustments, debts first, then the oldest first,
  stopping at the first that does not fit. Each item paid is marked with the payout's id
  (`payout_id`, and `paid_out_cents` on a payment), so a payout is a list of sales, not an amount.
  Money in the balance that no row names is never chosen; it is recorded as `unnamed_cents` and
  shown to Support. A profile is paid at most once a day, in the first run at or after 10:00
  Singapore time, and not under S$1; self-paced money of an opted-in profile is paid this way too.
  Only `PayoutsService` creates a payout or sets `released_run_id` or `payout_id`.
- **Bank disputes.** An open dispute keeps a class payment held and makes its seat refund wait. A
  lost one closes any unfinished row and writes a `dispute_lost` row: the job takes back what is
  left of the transfer with Elevate's fee returned, so the profile's net on the seat is zero, and a
  payment already paid out becomes a debt against later payouts.
- **Class checkout allows cards and PayNow, and nothing else** (R6, G4). The payment page is
  created with `allowed_payment_method_types` of `card` and `paynow`, so a method turned on in the
  Stripe Dashboard later is not offered, and with `wallet_options.link.display` set to `never`, so
  Link is hidden. Apple Pay is a card payment and stays. Self-paced checkout sends neither.
- **One fee estimate for every payment method** (R7). The price is quoted before the learner
  chooses a method, so the estimate cannot follow it: 3.4% plus S$0.50 by default, as ADR 003.
  Elevate keeps the difference when Stripe's fee is lower, as on PayNow (S$7.09 on S$500), and bears
  it when it is higher, as on a card issued abroad. The refund rules use the fee Stripe charged.
- **The terms in [`docs/terms/`](../terms/README.md) are the source** of the refund terms a learner
  is shown before paying and the held-payout terms an owner accepts. The screens' text in the
  message catalogs follows them, and is corrected when the two differ. Each set has a version,
  `REFUND_TERMS_VERSION` and `CLASS_SALES_TERMS_VERSION`; the API refuses a class checkout that does
  not name the current refund terms, and records which version an owner accepted.

## Consequences

- Selling to real learners waits for Stripe's answer on how the 90 days are counted, a lawyer's
  reading of both sets of terms, the author's sign-off of the Chinese text, and a payout test on a
  real connected account that has passed Singapore's liveness check (G3). The 75- and 85-day limits
  are provisional until Stripe answers.
- The release job cannot be switched off while any profile is opted in: without it no seat refund
  is sent and no opted-in profile is paid, self-paced money included. Alarms email a person
  (`infra/README.md`, "The release job").
- A refund can take a profile's Stripe balance below zero. Stripe then holds the same amount back
  from Elevate's balance until the profile's later sales cover it, and moves it after 180 days.
- A refund Stripe failed after taking the transfer back leaves the profile's balance and its share
  after refunds apart until a Support admin writes a correction; the payout shows the gap as
  unnamed money.
- The API can go back to Part 1's version only after `CLASS_SALES` has been off for 35 minutes, so
  no reservation is open, and the release task must stay on a version that has `release.js`.
- A later grant flow must change the places that assume one card payment for the whole price of a
  seat: `seatRefund()`, the end of a reservation, the held total and the 85-day count.
