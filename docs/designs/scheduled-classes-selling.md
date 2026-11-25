# Scheduled Classes, Part 2: Selling a Class

- **Author:** skypad123
- **Status:** Proposed, revised after review
- **Date:** 2026-11-25 (first draft 2026-11-24)

---

## Overview

Elevate sells self-paced online courses. The scheduled-classes RFC
([scheduled-classes-brief.md](./scheduled-classes-brief.md)) adds
classes: a course taught at fixed dates, in real time, by one instructor to a
limited group of learners, at a venue or remotely.

The author split the RFC into three designs:

| Part              | Covers                                                                                                                                                           | Status                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1                 | Class and attendance records, a class as its own enrollment, class setup, check-in, the roster and code screens.                                                 | Designed in [scheduled-classes-attendance.md](./scheduled-classes-attendance.md). Phase 1 of its seven build phases is built. |
| 2 (this document) | Selling a class: the class choice on the course page, class checkout with reserved seats, payouts held until after the class, cancellation, withdrawal, refunds. | This document.                                                                                                                |
| 3                 | The class page, materials the instructor shares, class progress and certificate, and change notices.                                                             | Not drafted.                                                                                                                  |

Part 1 leaves classes as seeded test data: no route creates a class
enrollment. Part 2 adds the only way into a class, which is to buy a seat, and
with it the first real learners, real attendance records and real money held
for a teaching profile.

**This is the second version.** The first was reviewed on 2026-11-24 and found
not ready to build. The reports, a Stripe test session and the author's
decisions on what the review raised are in
[reviews/scheduled-classes-selling/](./reviews/scheduled-classes-selling/).
Where this document says "decision 3" or "R2", it means an entry in
[author_decisions.md](./reviews/scheduled-classes-selling/author_decisions.md)
in that folder.

**Who decided what.** Two labels are used, with one meaning each:

- **Author.** The author chose among options at a question: in the RFC, in the
  drafting session, or after the review.
- **Drafting.** The AI assistant that drafts this text chose. These are
  choices with one defensible answer, or constants. Each is listed so the
  author can overrule it.

### Words used in this document

Part 1's words are repeated here where a money rule depends on them.

| Word                | Meaning                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile             | A teaching profile. It owns the class, sells its seats, and is the party paid. Each profile has one Stripe account. This document does not say "teacher" for the party paid.                         |
| Owner, manager      | People in a profile, as in the teacher-profiles design. The owner holds the Stripe account. Managers exist on company profiles.                                                                      |
| Instructor          | The one person who teaches a class and takes its attendance (Part 1).                                                                                                                                |
| Block               | One continuous teaching period of a class, with a start and an end (Part 1). A class has one or more.                                                                                                |
| Capacity            | The number of learners a class can take. Part 1 stores it as `classes.seats`.                                                                                                                        |
| Seat                | One learner's place in one class. In the data it is an active class enrollment.                                                                                                                      |
| Reservation         | A seat kept for 35 minutes for a learner who has started paying.                                                                                                                                     |
| Check-in            | A learner recording their own arrival at a block, with the block's code (Part 1). It stands unless the instructor overturns it.                                                                      |
| Manual mark         | The instructor marking a learner present by hand (Part 1). The learner can dispute it for 7 days. It is **open** during those days if not disputed, and **settled** after them if not disputed.      |
| Counted as attended | For money. A learner is counted as attended in a class when, for at least one block, they have a check-in that stands or a manual mark that is settled. A mark the learner disputed never counts.    |
| Opted in            | A profile whose owner has accepted the held-payout terms, so it can sell classes.                                                                                                                    |
| Held                | Money from a class sale that sits in the profile's Stripe balance and has not been paid to its bank. Used only of money.                                                                             |
| Released            | A class, or one payment, whose money is no longer held. Used only of money.                                                                                                                          |
| The release job     | The scheduled program that sends refunds, marks classes released and pays profiles. One execution of it is a **run**. "Run" is used for nothing else.                                                |
| Cancel              | The profile, or Elevate, ends a class for everyone. Used only of a class.                                                                                                                            |
| Withdraw            | One learner gives up their own seat.                                                                                                                                                                 |
| Price               | What the learner pays for a seat: the course's price less any promo discount.                                                                                                                        |
| Stripe's fee        | What Stripe really charged Elevate to process one card payment. It is known a few seconds after the payment. Stripe keeps it when a payment is refunded.                                             |
| Fee estimate        | Elevate's estimate of Stripe's fee, worked out before the payment: 3.4% plus S$0.50 by default.                                                                                                      |
| Commission          | Elevate's charge on a sale: 15% by default of the price less the fee estimate.                                                                                                                       |
| Elevate's fee       | The commission plus the fee estimate. It is what Stripe moves from the profile to Elevate on each sale.                                                                                              |
| Profile's share     | The price less Elevate's fee.                                                                                                                                                                        |
| Bank dispute        | A cardholder asking their bank to reverse a payment. It costs Elevate the price plus S$15 until it is decided. "Dispute" alone, of a manual mark, is Part 1's meaning and is always written in full. |

The example used throughout is one seat sold for S$500.00:

| Amount                    | Value    |
| ------------------------- | -------- |
| Price                     | S$500.00 |
| Fee estimate              | S$17.50  |
| Commission                | S$72.38  |
| Elevate's fee             | S$89.88  |
| Profile's share           | S$410.12 |
| Stripe's fee, as observed | S$20.00  |

The S$20.00 was observed in the test session on a card issued abroad. The fee
on a Singapore card has not been observed.

## The Problem

After Part 1, a profile can set up a class and take its attendance, and nobody
can be in it. The author decided that a class is a separate product from the
self-paced course and that the only way into one is to buy a seat. Selling a
seat does not work with the payment system as it stands, for four reasons.

- **Checkout knows one enrollment per learner per course.** It finds "the
  learner's enrollment for this course" and refuses anyone who has one.
- **Nothing limits how many people can buy.** A payment page stays open for 30
  minutes. Two learners can both be paying for the last seat, and the only
  remedy today is to refund one of them, at Elevate's cost.
- **The profile is paid the moment a learner pays.** That is safe for a course
  delivered at once. A class is sold weeks before it is taught. If it is
  cancelled, the refunds pull money back from a profile that may already have
  been paid it, and Elevate carries the shortfall. On a S$500 seat the
  profile's share is S$410.12; a cancelled class of 20 is about S$8,200.
- **A refund can only be for the full price, and it always costs Elevate
  Stripe's fee.** The author decided that whoever ends a seat bears that fee.
  The refund code cannot send a part amount, cannot keep the fee back from a
  profile, and has no notion of a seat to free.

The proposed solution has four parts:

1. A class choice on the course page that leads to a class checkout, with a
   seat reserved while the learner pays.
2. Class money held in the profile's own Stripe balance until 7 days after
   the class, with a scheduled job that pays out what is due.
3. Cancellation, withdrawal, moving and discretionary refunds that follow the
   author's rules and free the seat.
4. Checks on the new money flow: a ceiling on every payout, a review of a
   class with no attendance, and handling of bank disputes.

## Goals

Each goal names how it is checked. Where a goal has an exception, the
exception is in the goal. The Verification Plan maps each one to a test or a
staging step.

**Buying**

- **A learner can buy a seat in a published class** of an opted-in profile,
  from the existing course page, at the course's price, and only through
  checkout. Paying creates the seat; nothing else does.
- **A class never has more seats than its capacity.** A seat is reserved from
  the moment checkout starts, for 35 minutes. Two learners racing for the last
  seat end with one seat sold and one learner told the class is full before
  they pay. A learner whose payment arrives after their reservation ended,
  when the class has filled or been cancelled, gets no seat and is refunded in
  full.
- **A learner can own the self-paced course and a seat in a class of the same
  course.** They are two purchases, and buying one never refuses or refunds
  the other.
- **Existing self-paced checkout does not change.** A request with no class
  behaves as it does today, including from an app installed before this
  version.
- **The refund terms are shown to the learner before they pay**, in English
  and Chinese. The class checkout page shows them above the pay button, and
  the API refuses a checkout that does not name the version of the terms the
  page showed.
- **A learner who buys a seat is told what they bought.** The confirmation
  page and the receipt show the class's dates, times and place.

**Holding and paying**

- **A profile sells classes only after its owner opts in.** Until then its
  Stripe payouts work exactly as today. The owner can leave on 30 days'
  notice; money already held is paid on its usual dates, and then Stripe's
  own payout schedule returns (G16).
- **An opted-in profile is not paid for a class until 7 days after its last
  block ends**, and not while any manual mark in the class is open (R5).
  Class money stays in the profile's Stripe balance until then.
- **Money from the same profile's self-paced sales is paid by the release
  job once a day.** It reaches the bank about a day later than Stripe's own
  schedule would have sent it.
- **No person presses a button to pay a profile.** The release job marks
  classes released and creates payouts. A person acts only on a class under
  review, a refund that failed, or money the database cannot name.
- **A payout is never more than the money the database can name as payable**
  (decision 4). Each payout lists the payments it pays. Money in a profile's
  Stripe balance that no row accounts for stays there and is reported to
  Support.
- **No money is held for more than 85 days from its payment.** A payment that
  reaches that age is released whatever its state, and flagged. Stripe allows
  90 days.

**Ending a seat**

- **The profile's owner or a manager can cancel a class at any time**, after
  a recent sign-in. Every learner who is not counted as attended is refunded
  in full, and the profile bears Stripe's fee for each refunded seat.
- **A learner counted as attended, when the profile cancels, is refunded the
  share of the price for the blocks not taught** (G12, which changes decision
  3). Stripe's fee and Elevate's fee are shared in the same proportion.
- **Once a learner is counted as attended, the learner's own withdrawal
  refunds nothing by rule** (decision 3). Beyond the rule above, a refund is
  granted only by the profile's owner or a manager, at their discretion,
  until the seat's money is released.
- **A learner who is not counted as attended can withdraw until 7 days before
  the first block** and is refunded the price less Stripe's fee. The seat is
  free for someone else at once.
- **The owner or a manager can move a learner who is not counted as attended**
  to another of the profile's classes for the same course.
- **When the profile moves a learner, or changes a block's time after seats
  are sold, each affected learner is emailed** and, if not counted as
  attended, can withdraw with a full refund until the class starts (R3).
- **When Elevate cancels a class, every learner is refunded in full**,
  attended or not, and Elevate bears Stripe's fee (R4).
- **Refunds are sent by the release job only** (decision 5), within one run,
  which is at most 15 minutes. A refund that is waiting for a manual mark to
  settle or a bank dispute to close is sent when that ends.
- **Elevate's own money on a seat is not reduced by a refund it did not
  cause.** For the profile's cancellation and a learner's withdrawal,
  Elevate's net on the seat is zero. For a discretionary refund it is zero or
  more. One exception stands: when a refund takes a profile's Stripe balance
  below zero, Stripe holds the shortfall against Elevate's balance until that
  profile's later sales cover it.
- **A refund that ends a seat frees it**: a withdrawal, a full refund by the
  job, Support's "refund in full" and a full refund made in the Stripe
  dashboard. A part refund leaves the seat in place.
- **A learner is told when they are marked present by hand**, with the date
  their 7 days to dispute it end, because that mark can now cost them a
  refund.

**Checks**

- **A bank dispute opened before a seat's money is released keeps that money
  held**, up to the 85-day limit. If the learner wins at any time, the
  profile's share for the seat is taken back. If it was already paid out, it
  becomes a debt against the profile's later payouts.
- **A class in which no learner is counted as attended is not released**
  until a Support admin has looked at it, or the 85-day limit is reached.
- **One alarm emails a person** when no run has finished in 30 minutes, when
  a refund that is ready to send has not been sent for a day or has failed,
  and when a payout fails.
- **Selling can be switched off with one setting** without a deploy. The
  release job cannot be switched off while any profile is opted in; the
  rollback section says what can be rolled back and what cannot.

## Non-Goals

- **The class page, class materials, class progress and the class
  certificate.** Part 3. After Part 2 a class learner can check in and see
  their attendance, and can open no lessons through the class.
- **The switch that opens a cancelled class's materials.** Part 3, with the
  materials themselves.
- **Change notices and reminders in general.** Part 3. Part 2 sends only the
  emails a purchase, a refund, a cancellation, a move, a changed block time or
  a manual mark needs. A changed venue sends nothing until Part 3.
- **Joining details for a remote class.** The instructor sees learners' emails
  on the roster and writes to them.
- **Grant money in the payment flow.** No SSG claim and no subsidy at checkout.
- **A price per class**, and **a separate catalog listing for a class**.
- **Placing a learner in a class without a sale.**
- **A learner moving their own seat.**
- **Holding class money in Elevate's own Stripe balance** (decision 1).
- **Charging a learner Stripe's fee when the profile or Elevate cancels** a
  class in which the learner is not counted as attended.
- **A minimum-attendance rule**, or releasing money by attendance share.
- **A ceiling on price times capacity per profile.**
- **A cap on how often a profile may cancel.**
- **Changing the commission, the fee estimate or how self-paced sales are
  charged.**
- **The six changes listed under "Changes that ship before this build".** They
  are prerequisites with their own pull requests, not part of this build
  (decision 2d).

## Open Questions

Each names who can answer it and what waits for the answer.

- **How Stripe counts the 90 days it allows under manual payouts, and what it
  does at the limit.** Only Stripe's support can say. This design assumes the
  count starts at each payment, which is the strictest reading (best guess
  G1, accepted). The day limits below are provisional until Stripe answers.
  Selling to real learners waits for this.
- **Whether holding a profile's money, by controlling when its own Stripe
  balance is paid out, brings a licensing duty in Singapore.** The RFC raised
  this and it has not been answered. A lawyer. The best guess (G9) is that
  this design, with the money in the profile's own account, is the
  lower-risk shape, and the author decided not to wait for the answer before
  selling to real learners.
- **The wording of the held-payout terms** a profile's owner accepts,
  including the 30 days' notice to leave, and of the refund
  terms a learner sees before paying. A lawyer. The Chinese text needs the
  author's sign-off. The wording is kept in `docs/terms/`; both sets of
  terms have a first draft there.
- **Whether Singapore consumer rules or SSG's rules require a refund when a
  provider cancels**, and whether refusing one to a learner counted as
  attended is enforceable when the profile cancels the rest. The RFC's check
  found no rule either way. A lawyer.
- **Manual payouts on a real connected account.** The test session could not
  create one: Singapore requires a liveness check done by a person. Creating a
  payout for part of a balance, and a failed payout, must be tested on such an
  account before Phase 5 of the plan is merged.
- **Whether "Edit payout schedule" and "Manual payouts" can be turned off in
  the Express dashboard for some accounts only.** Stripe's documentation
  shows one list for the whole platform and no setting for a single account.
  The best guess (G2, accepted) is that every profile loses both, opted in or
  not, and every teacher is emailed 30 days before (G15). Stripe's support,
  to confirm.
- **A refund that fails after Stripe accepted it.** Stripe's documentation
  says the refunded money then returns to Elevate's balance and the learner
  must be refunded another way. It says nothing about the transfer taken back
  from the profile. The best guess (G6, accepted) is that it stays taken back,
  so Support pays the learner from the returned money. No failed refund could
  be produced in the sandbox.
- **A PayNow QR code in a real bank app, after its payment page has
  expired.** In the sandbox the payment is cancelled with the page and the
  code takes no money. A bank app could not be tested.
- **How SSG pays a subsidy**, to whom and when. The author pictures a learner
  paying the net fee. Nothing here has been verified with SSG.

Answered since the first version, by the test session of 2026-11-24: the
refund sequence this design depends on works in either order; a reversal
larger than the profile's balance succeeds and leaves the balance negative;
the older call that switches an account to manual payouts works on the pinned
version.

Answered from Stripe's documentation on 2026-11-25:

- **A refund after Elevate wins a bank dispute works** (tested on
  2026-11-25). A refund that waited for the dispute is sent as usual.
- **The Link button can be turned off for one payment page**, with
  `wallet_options.link.display` set to `never` (tested on 2026-11-25). Class
  checkout does this. Apple Pay stays: it is a card payment.
- **A checkout can be limited to named payment methods.** The pinned version
  refuses `payment_method_types` and takes `allowed_payment_method_types` in
  its place. A method not in the list is not offered.
- **What Stripe does about a negative balance.** While a profile's balance is
  below zero, Stripe holds the same amount back from Elevate's available
  balance, and releases it as the profile's balance recovers. After 180 days
  below zero, Stripe moves the held amount to the profile's account. Stripe
  does not collect from a bank account in Singapore. The sandbox showed the
  amount held back.

Answered by the PayNow test of 2026-11-25, which is in
[stripe_sandbox_results.md](./reviews/scheduled-classes-selling/stripe_sandbox_results.md):

- **The list works.** A payment page created with
  `allowed_payment_method_types` offered Card and PayNow.
- **Refunds work as on a card.** Withdrawal, cancellation by the profile and
  a lost seat each left the profile and Elevate with the amounts in the table
  under "Refunds", on money that was still pending.
- **A PayNow refund is not made at once.** Stripe answers `pending` and
  reports `succeeded` later; in the sandbox that took seconds, and the
  documentation says up to 5 minutes. A card refund is `succeeded` in the
  answer. The documentation adds that a PayNow refund can fail, and can be
  made only within 90 days of the payment.
- **Stripe's fee by PayNow was S$7.09 on S$500**: 1.3% and GST. The fee
  estimate is S$17.50.
- **A PayNow payment cannot be disputed at a bank**, by Stripe's
  documentation.
- **Expiring a payment page cancels its PayNow payment.** The QR code then
  takes no money.
- **The profile's Stripe account needs nothing new.** A PayNow payment went
  through with only the two capabilities the API asks for today.

## Critical User Journeys (CUJs)

Amounts use the S$500 example, with Stripe's fee at the observed S$20.00.

### CUJ 1: A profile opts in

- **Given**: An approved profile with a working Stripe account and automatic
  payouts.
- **When**: The owner opens Settings in Teach, reads the held-payout terms,
  which say how to leave and what leaving takes, and accepts them.
- **Then**: The acceptance is recorded with its time, the owner and the terms
  version. The profile's Stripe account is switched to manual payouts, and the
  balance it held at that moment is recorded as its opening amount. From the
  next day's paying run, the release job pays this profile.

### CUJ 2: A learner buys a seat

- **Given**: A published class of an opted-in profile, with seats left, whose
  first block is three weeks away.
- **When**: The learner opens the course page on the web, sees the class under
  "Take it as a class" with its dates, place and seats left, chooses it, reads
  the refund terms on the checkout page, and pays.
- **Then**: A seat is reserved from the moment they press pay. On payment the
  class enrollment becomes active, the payment is recorded against the class,
  and the confirmation page and receipt show the class's dates and place. The
  profile's share, S$410.12, sits in the profile's Stripe balance and is
  counted as held.

### CUJ 3: Two learners want the last seat

- **Given**: A class with one seat left.
- **When**: Learner A presses pay. Ten seconds later learner B presses pay.
- **Then**: B is told the class is full and is not sent to pay. If A abandons
  the payment page, the seat is free again when A's reservation ends, 35
  minutes after it began.

### CUJ 4: A learner who owns the self-paced course buys a seat

- **Given**: A learner with an active self-paced enrollment in the course.
- **When**: They choose a class on the course page and pay.
- **Then**: They have two enrollments. The course page shows both. Checkout did
  not answer "already enrolled", and the second payment was not refunded as a
  duplicate.

### CUJ 5: A learner withdraws in time

- **Given**: A learner with a seat, not counted as attended, ten days before
  the first block.
- **When**: They open the class in the app and choose "Withdraw", having been
  shown that S$480.00 will be returned.
- **Then**: Their seat is free at once and they are told the refund is on its
  way. Within 15 minutes the job refunds S$480.00 to their card and emails
  them. The profile's net for the seat is zero and Elevate's is zero. A
  learner who tries the same five days before the first block is told
  withdrawal has closed and that the profile decides.

### CUJ 6: The profile cancels a class that has not started

- **Given**: A class with 12 seats sold at S$500, a week before it starts.
- **When**: The owner chooses "Cancel class", signs in again if their sign-in
  is not recent, and gives a reason.
- **Then**: The class is cancelled at once and cannot be bought. Open payment
  pages for it are expired. Within one run of the job, each learner is
  refunded S$500 and emailed. For each seat the profile's balance ends S$20.00
  lower than before the sale. Elevate's net is zero.

### CUJ 7: The profile cancels after the first block

- **Given**: A five-block class with 12 seats sold. At block one, eight
  learners checked in themselves, two were marked by hand yesterday, and two
  did not come.
- **When**: The owner cancels the class before block two.
- **Then**: The two who did not come are refunded in full within one run. The
  eight who checked in are refunded four fifths of the price, S$400 each on
  S$500, for the four blocks not taught. The two marked by hand wait: one
  disputes the mark and is refunded in full at the next run; the other does
  not, and six days later the mark settles and they are refunded four fifths.
  The class's money is released 7 days after the cancellation, once every
  refund row for it is finished.

### CUJ 8: The profile moves a learner

- **Given**: A learner with a seat in the March class, not counted as
  attended, and an April class of the same course with a free seat.
- **When**: The owner moves the learner to April.
- **Then**: The learner's seat and payment now belong to the April class, the
  March seat is free, and the learner is emailed. Until April's first block
  they can withdraw with a full refund, the profile bearing Stripe's fee.

### CUJ 9: The profile changes a block's time

- **Given**: A class with six seats sold, two weeks before its first block.
- **When**: A manager moves block two from Tuesday to Thursday.
- **Then**: Each of the six learners is emailed the old and new times. Until
  the class starts, any of them can withdraw with a full refund, the profile
  bearing Stripe's fee. An edit that would make the class end more than 75
  days after any of the six payments is refused.

### CUJ 10: A run releases a class and a profile is paid

- **Given**: A class whose last block ended 7 days and one hour ago, with a
  learner counted as attended, no open manual mark, no unfinished refund and
  no open bank dispute.
- **When**: The release job runs.
- **Then**: The class and each of its payments are marked released in that
  run. On the day's paying run, the payout to the profile's bank lists those
  payments, oldest first, and each is marked paid by that payout.

### CUJ 11: Money the database cannot name

- **Given**: A fault has left a class payment at Stripe with no payment row,
  so S$410.12 sits in the profile's balance that no row accounts for.
- **When**: The paying run works out the profile's payout.
- **Then**: The payout lists only payments the database names, so the
  S$410.12 is not paid. The run records it as unnamed. The Support payouts
  page shows the profile with S$410.12 unnamed. When the missing payment row
  is restored, the money is held or paid like any other.

### CUJ 12: A class nobody is counted as attending

- **Given**: A class whose release is due, in which no learner is counted as
  attended.
- **When**: The release job runs.
- **Then**: The class is not released. It appears on the Support payouts page
  as "needs review". A Support admin who releases it gives a reason. If nobody
  does, each of its payments is released when it is 85 days old, and flagged.

### CUJ 13: A learner wins a bank dispute before release

- **Given**: A learner with a seat disputes the charge with their bank before
  the class is released.
- **When**: Stripe reports the dispute opened, and later closed in the
  learner's favour.
- **Then**: From the opening, that seat's money stays held even when the class
  is released. On the loss, the profile's share for the seat is taken back,
  the seat is closed, and Elevate bears Stripe's fee and the S$15 dispute fee.

### CUJ 14: A learner wins a bank dispute after the profile was paid

- **Given**: A class released and paid out a month ago.
- **When**: A learner disputes their payment and the bank decides for them.
- **Then**: The profile's share for the seat is taken back from the profile's
  Stripe balance, which may go below zero. A debt row for S$410.12 is written.
  The profile's next payouts are reduced until it is covered, and each payout
  lists the debt beside the sales.

### CUJ 15: The seat was lost while paying

- **Given**: Either a learner's reservation has ended and the class has since
  filled, or the class was cancelled while the learner was on the payment
  page. Then the learner's payment completes.
- **When**: Stripe reports the payment.
- **Then**: The payment is recorded, the learner gets no seat, and a full
  refund is written with Elevate bearing Stripe's fee. The confirmation page
  says the seat was lost and the money is being returned. The learner is
  emailed and gets no receipt.

### CUJ 16: Elevate cancels a class

- **Given**: A class part-way through, with learners who attended and learners
  who did not.
- **When**: A Support admin cancels it with a reason.
- **Then**: Every learner is refunded in full within one run, attended or not.
  The profile's net on each seat is zero. Elevate bears Stripe's fee on each.

### CUJ 17: A learner is marked present by hand

- **Given**: A learner with a seat whose phone did not work at the door.
- **When**: The instructor marks them present by hand.
- **Then**: The learner is emailed, in their language, which block they were
  marked present for and the date until which they can dispute it. For the
  next 7 days the mark does not count against a refund.

### CUJ 18: A refund that cannot be sent

- **Given**: A cancelled class with a refund row for a learner who has since
  opened a bank dispute on the same payment.
- **When**: The job reaches the row.
- **Then**: The row waits; Stripe would refuse the refund. If the bank decides
  for the learner, the row is closed, because the bank returned the money. If
  it decides for Elevate, the row is sent. A row that Stripe refuses for a
  reason a retry cannot fix is marked failed, appears on the Support payouts
  page, and raises the alarm. The class's payment is not released while its
  row is unfinished.

### CUJ 19: A profile leaves

- **Given**: An opted-in profile with one class sold that ends in three
  weeks.
- **When**: The owner gives notice in Teach Settings, after a recent sign-in.
- **Then**: From that moment none of the profile's classes is on sale. The
  sold class runs and its money is released 7 days after it ends, as usual.
  On the first day that is at least 30 days after the notice and has nothing
  held and no refund unfinished, the release job pays what is payable and
  switches the Stripe account back to automatic payouts. The owner is
  emailed. The profile can opt in again later.

## Technical Plan (Architecture)

### Decisions

**Made by the author before the review**, in the RFC or at a question in the
drafting session:

| Question                          | Decision                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| When class money is released      | One release per class, 7 days after its last block ends. Self-paced payouts are not held.                                         |
| Withdrawal                        | A learner who has not attended can withdraw until some days before the first block, less Stripe's fee.                            |
| Who grants a discretionary refund | The profile's owner and its managers.                                                                                             |
| Who cancels a class               | The profile's owner or a manager, at any time.                                                                                    |
| Moving class                      | The owner or a manager can move a learner who has not attended. A learner cannot move themselves.                                 |
| Who sells                         | Each profile opts in; the owner accepts the held-payout terms in Teach.                                                           |
| Checks on the money flow          | Opting in, held payouts, the review of a class with no attendance, and bank dispute handling. No ceiling on price times capacity. |
| Remote joining details            | Nothing built; the instructor writes to learners.                                                                                 |
| Grant flow                        | The learner pays the net fee; not built here.                                                                                     |
| What runs the release job         | A scheduled one-off task from the API image.                                                                                      |
| A lost bank dispute               | The sale is undone: the profile's share is taken back.                                                                            |

**Made by the author after the review**, on 2026-11-25. The options for each
are in `author_decisions.md`:

| Entry | Question                                           | Decision                                                                                                                                                                         |
| ----- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Where class money sits before release              | The profile's own Stripe account, on manual payouts.                                                                                                                             |
| 2a    | The size of the beta                               | 4 to 10 profiles and about 10 to 40 classes in three months.                                                                                                                     |
| 2b    | Which parts are built                              | Moving, bank dispute handling, the no-attendance review and cancellation by Elevate are all built.                                                                               |
| 2c    | The way back from opting in                        | Changed by G16: the owner can leave on 30 days' notice.                                                                                                                          |
| 2d    | The readiness items and two live-path changes      | Shipped first, as their own changes.                                                                                                                                             |
| 3     | What stops a refund when the profile cancels       | Only the learner's own check-in, or a manual mark the learner did not dispute in 7 days. Changed by G12: a learner counted as attended gets the share for the blocks not taught. |
| 4     | What stops a wrong held total paying money out     | A ceiling: a payout never exceeds the payable payments the database can name.                                                                                                    |
| 5     | Who sends refunds, and how often the job runs      | The job only, every 15 minutes.                                                                                                                                                  |
| R1    | How the ceiling knows what was paid                | A mark on each payment. A payout lists the payments it pays.                                                                                                                     |
| R2    | Which Stripe fee the refund rules use              | The real fee Stripe charged for that payment.                                                                                                                                    |
| R3    | A block's time changed after seats are sold        | Allowed. Each seat holder is emailed, and one not counted as attended can withdraw in full until the class starts.                                                               |
| R4    | Learners who attended, when Elevate cancels        | Every seat is refunded in full.                                                                                                                                                  |
| R5    | A manual mark still open on the release date       | The release waits until no mark in the class is open.                                                                                                                            |
| R6    | Which payment methods class checkout allows        | Cards and PayNow, and nothing else. Set with `allowed_payment_method_types`.                                                                                                     |
| R7    | Stripe's fee lower or higher than the fee estimate | One estimate for every payment method. Elevate keeps the difference when Stripe's fee is lower, as on PayNow, and bears it when it is higher.                                    |

**Best-guess answers, 2026-11-25.** The author chose to build before asking
anyone outside the company. Each open question was given a researched best
guess, numbered G1 to G22 and recorded with its sources in
`reviews/scheduled-classes-selling/best_guess_answers.md`. The author took
fifteen as they were, and decided four: sell without waiting for the
licensing answer (G9); a pro-rata refund of the blocks not taught when the
profile cancels (G12, changing decision 3); leaving on 30 days' notice (G16,
reversing decision 2c); and a closed list of grounds for Elevate to cancel
(G17). This document cites them by number.

**Set while drafting, for the author to confirm.** Each has one defensible
answer or is a constant. Approving this document confirms them.

| Question                                          | Choice                                                                                                              | Reason                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Days before the first block that withdrawal ends  | 7.                                                                                                                  | The same length as the release wait; a seat given up a week ahead can be resold.                    |
| How long a reservation lasts                      | 35 minutes, for a payment page that lasts 30.                                                                       | Five minutes for Stripe's notice of a payment made in the last second.                              |
| How often a learner can reserve the same class    | 3 times in 24 hours.                                                                                                | Without a limit one learner can keep a seat reserved for ever without paying.                       |
| How far ahead a seat can be sold                  | The class's last block must end within 75 days of the payment. The same limit applies to a move and to a time edit. | The 85-day limit, less the 7-day wait, less 3 days for late runs.                                   |
| The longest any payment is held                   | 85 days from the payment. Then it is released and flagged.                                                          | Five days inside Stripe's 90. Provisional until Stripe says how the 90 are counted.                 |
| A payment that arrives when its seat is gone      | Refunded in full, Elevate bearing Stripe's fee.                                                                     | The existing rule for a duplicate payment. The learner did nothing wrong.                           |
| A payment that arrives after the class started    | It gets the seat if its reservation is still current.                                                               | The learner started paying before the class did.                                                    |
| Discretionary refunds after a payment is released | Not through Teach. They go to Support, whose refund action is unchanged.                                            | After release the profile's balance may be empty.                                                   |
| What a discretionary refund does to the seat      | Nothing. The learner keeps the seat.                                                                                | It is money back, not removal. Removing a learner is a withdrawal or a cancellation.                |
| Two seats at once                                 | A learner may hold seats in two classes of one course.                                                              | Part 1's rule is one seat per learner per class.                                                    |
| Promo codes                                       | They work on a class, except that one which makes the price zero is refused.                                        | The author ruled out free seats.                                                                    |
| Enrol count                                       | Class seats do not count toward a course's enrol count.                                                             | The count describes the self-paced course.                                                          |
| How often a profile is paid                       | At most one payout a day, in the first run at or after 10:00 Singapore time, and none under S$1.                    | Each payout is a bank transfer.                                                                     |
| Which payments a short payout pays                | Whole payments, oldest first, stopping at the first that does not fit.                                              | R1 marks whole payments.                                                                            |
| Money earned before opting in                     | The Stripe balance read at opt-in is recorded as two opening amounts, available and pending.                        | Automatic payouts had not yet paid it, and no payment row can be marked for it.                     |
| A refund asked for before Stripe's fee is known   | It waits for the next run.                                                                                          | The fee arrives within seconds; the job runs every 15 minutes.                                      |
| Stripe's fee larger than Elevate's fee            | The fee refund to the profile is zero, and Elevate bears the rest.                                                  | It can happen only on a payment of a few dollars.                                                   |
| Moving a learner into a class they were once in   | Refused.                                                                                                            | Part 1 allows one enrollment row per learner per class, and the earlier row has payments.           |
| Lowering a class's capacity                       | Refused below the number of seats taken.                                                                            | Otherwise the class has more seats than its capacity.                                               |
| A lost bank dispute in the refund ledger          | No refund row. The payment carries the dispute and its outcome.                                                     | Stripe made no refund, and the ledger is keyed by Stripe's refund id.                               |
| When a refund is marked failed                    | When Stripe refuses it for a reason a retry cannot fix, or after 96 attempts.                                       | 96 runs is one day.                                                                                 |
| What the course page shows of a venue             | The address, to everyone.                                                                                           | A learner must know where a class is before buying. Teach says so when the class is published.      |
| Which version of the job a schedule starts        | The one the last deploy registered. The deploy workflow updates the schedule.                                       | A schedule that names no version could start a placeholder.                                         |
| Cancelling a class that is released               | Refused for the profile. A Support admin still can.                                                                 | The profile has been paid; refunds would come from an empty balance.                                |
| Who can opt in                                    | Only the owner, after a recent sign-in.                                                                             | The owner holds the Stripe account.                                                                 |
| When a refund counts as made                      | When Stripe reports that it succeeded. Until then the row stays `refund_sent`, and nothing is recorded or emailed.  | A PayNow refund is pending for up to 5 minutes and can fail. Confirmed by the author on 2026-11-25. |

### Where this design departs from the RFC

The RFC was written before these questions were put to the author. Each row is
a later decision by the author; the RFC's text was not changed.

| The RFC says                                                                                            | This design does                                                                                                                                            | Why                                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| "When the teacher cancels a class, the learner is refunded in full and the teacher bears the fee."      | That holds for a learner who is not counted as attended. A learner who is gets no refund by rule, including when the profile cancels the rest of the class. | Author: after attendance, a refund is at the discretion of the owner and managers. Decision 3 narrowed what counts.         |
| Out of scope: "any automatic refund or payout decision based on attendance."                            | Attendance decides two things: whether a learner's refund is automatic, and whether a finished class is released by the job or waits for Support.           | Author: the refund rule above, and the review chosen from the RFC's own list of abuse controls. No minimum-attendance rule. |
| "After a cancelled class, the teacher can switch on access to that class's materials for its learners." | Cancelling is built here; the switch is not. Class materials do not exist until Part 3.                                                                     | The author's split into three parts. Until Part 3, a learner in a cancelled class can open nothing through it.              |
| Moving class is listed under "Later".                                                                   | A profile's owner or manager can move a learner who is not counted as attended.                                                                             | Author, kept in decision 2b.                                                                                                |
| A refund deducts "Stripe's fee", with S$17.50 as the example.                                           | The amount deducted is Stripe's real fee for that payment, which was S$20.00 on a card issued abroad.                                                       | Author, R2.                                                                                                                 |

### Components

```text
Learner app                         Teach portal                      Support portal
  Course page: "Take it as a class"   Settings: opt in                  Payouts: runs, reviews,
  Class checkout, with refund terms   Class page: seats, cancel,          refunds that wait or failed,
  Class screen: withdraw              move, refund                        unnamed money, debts
        │                             Earnings: held, payouts                    │
        ▼                                   ▼                                    ▼
┌───────────────────────────────────── API (Hono) ──────────────────────────────────────┐
│ ClassCheckoutService   SeatsService          SeatRefundsService     PayoutsService    │
│ (reserve, payment      (withdraw, move,      (one row per refund;   (mark released,   │
│  page, fulfilment)      cancel a class)       requests only write)   choose, pay)     │
│          └──── money.ts: seatRefund(), profileShareAfterRefunds() ────┘               │
└────────┬──────────────────────────┬───────────────────────────────┬───────────────────┘
         │ Stripe Checkout          │ webhooks: payment, refund,    │ Postgres
         │                          │ bank dispute, payout          │
         ▼                          ▼                               ▼
      Stripe  ◄── refunds, fee refunds, reversals, ── the release job (same image, every 15
                  balance, payouts                     minutes, started by EventBridge Scheduler)
                                                           │
                                                           ▼
                                              CloudWatch alarm ──► email to a person
```

Requests never call Stripe to move money back. They write rows, and the
release job is the only program that sends a refund or a payout.

### Data model

Everything is additive. One enum gains a value.

**`enrollments`** gains:

| Column                                         | Notes                                                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `seat_reserved_until`                          | Timestamp, nullable. A class enrollment that is `pending_payment` with this in the future is a reservation.     |
| `reservation_count`, `reservation_count_since` | How many reservations the learner has started for this class since the given time. Enforces 3 in 24 hours.      |
| `refund_terms_version`                         | The version of the refund terms the learner was shown.                                                          |
| `moved_at`, `moved_by`, `moved_from_class_id`  | Set by a move.                                                                                                  |
| `class_changed_at`                             | Set by a move, and by a block-time edit while the learner holds a seat. It gives the right to withdraw in full. |

Statuses keep their four existing values, so an older app meets nothing new:

| Status of a class enrollment | Meaning                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `pending_payment`            | Checkout started. A reservation while `seat_reserved_until` is in the future.       |
| `active`                     | A seat.                                                                             |
| `refunded`                   | The seat ended with the whole price returned, or was lost to a bank dispute.        |
| `cancelled`                  | The learner withdrew and was refunded less Stripe's fee. The existing value's name. |

**Seats taken** in a class is the number of its enrollments that are `active`,
or `pending_payment` with `seat_reserved_until` in the future. It is counted
when read, so a reservation ends by the clock and no job ends it.

**What each refund does to the enrollment**, and when:

| Refund                                                                    | Enrollment becomes | When                                                       |
| ------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------- |
| `learner_withdrew`                                                        | `cancelled`        | In the request, so the seat is free at once.               |
| `changed_withdrew`                                                        | `refunded`         | In the request.                                            |
| `teacher_cancelled`, `elevate_cancelled`                                  | `refunded`         | When the refund row becomes `pending`.                     |
| `dispute_lost`                                                            | `refunded`         | When Stripe reports the loss.                              |
| `seat_lost`                                                               | Unchanged          | The row stays `pending_payment` with an ended reservation. |
| `discretionary`, any amount                                               | Unchanged          | The learner keeps the seat.                                |
| Support's "refund in full", or a full refund made in the Stripe dashboard | `refunded`         | When the refund is recorded.                               |
| A part refund made in the Stripe dashboard                                | Unchanged          |                                                            |

**`classes`** gains:

| Column                                                  | Notes                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `cancelled_at`, `cancelled_by`, `cancel_reason`         | Set when the class is cancelled. `class_status` gains the value `cancelled`. |
| `released_run_id`, `released_at`, `release_reason`      | Set by the run that releases the class. The reason is `due` or `support`.    |
| `review_needed_at`                                      | Set by a run that finds the class due with no learner counted as attended.   |
| `review_cleared_at`, `review_cleared_by`, `review_note` | Set when a Support admin releases a class under review.                      |

**`payments`** gains:

| Column                                                       | Notes                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `class_id`                                                   | Set at fulfilment for a class sale; null for self-paced. Follows the seat when a learner is moved. |
| `released_run_id`, `released_at`, `release_reason`           | The run in which this payment stopped being held. The reason is `due`, `support` or `day_limit`.   |
| `bank_dispute_id`, `bank_dispute_status`, `bank_disputed_at` | The status is `open`, `won` or `lost`.                                                             |
| `payout_id`, `paid_out_cents`                                | The mark of R1: the payout that paid this payment, and the amount it counted for.                  |

A payment already stores the list price, the discount, the price paid, the fee
estimate, Stripe's fee, the commission and the profile's share. Stripe's fee
is empty for a few seconds after a payment; the job fills it.

**`refunds`**, the existing ledger of refunds, gains
`application_fee_refunded_cents`, the part of Elevate's fee returned to the
profile with that refund, and `seat_refund_id`. The first lets one function
work out a profile's share after any refund.

**`profiles`** gains `class_sales_accepted_at`, `class_sales_accepted_by` and
`class_sales_terms_version`. **`payout_accounts`** gains `payout_mode`
(`automatic`, `switching` or `manual`, default `automatic`), `manual_since`,
the time the opening amounts were read, and `leave_requested_at` and
`leave_on`, set when the owner gives notice (G16).

**`seat_refunds`** (new): one row for every refund of a seat that the system
starts, written before any money moves.

| Column                                                                  | Notes                                                                                                                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `enrollment_id`, `payment_id`, `class_id`                         | Restrict on delete.                                                                                                                                       |
| `kind`                                                                  | `teacher_cancelled`, `teacher_cancelled_part`, `learner_withdrew`, `changed_withdrew`, `discretionary`, `elevate_cancelled`, `seat_lost`, `dispute_lost`. |
| `requested_cents`                                                       | For `discretionary`: the amount the owner or manager chose.                                                                                               |
| `learner_refund_cents`, `fee_refund_to_profile_cents`                   | Worked out by `seatRefund()` when the job first sends the row, from Stripe's fee.                                                                         |
| `status`                                                                | `waiting`, `pending`, `refund_sent`, `done`, `closed`, `failed`. Defined under "Refunds".                                                                 |
| `waiting_for`                                                           | `manual_mark`, `bank_dispute` or `stripe_fee`, while `waiting`.                                                                                           |
| `stripe_refund_id`, `stripe_fee_refund_id`, `stripe_reversal_id`        | Filled in as each step completes.                                                                                                                         |
| `attempts`, `first_attempt_at`, `error`                                 |                                                                                                                                                           |
| `cancellation_id`                                                       | The cancellation this refund belongs to, if any.                                                                                                          |
| `requested_by`, `reason`, `created_at`, `completed_at`, `closed_reason` |                                                                                                                                                           |

A unique index allows one unfinished row per enrollment, where unfinished means
`waiting`, `pending`, `refund_sent` or `failed`.

**`class_cancellations`** (new): `class_id` (unique), `cancelled_by`,
`by_elevate`, `elevate_reason` (one of the grounds under "Cancellation by
Elevate", for Elevate's only), `reason`, `after_start`, `blocks_total` and
`blocks_untaught` (counted when the class is cancelled: a block is untaught
when it had not started), `created_at`, `completed_at`. A
cancellation is complete when each of its refund rows is `done` or `closed`.

**`payout_runs`** (new): `id`, `started_at`, `finished_at`, `error`, and counts
of refunds sent, classes released and payouts created.

**`payouts`** (new): one row for each attempt to pay a profile, at most one a
day.

| Column                                             | Notes                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `id`, `run_id`, `payout_account_id`, `pay_date`    | `pay_date` is the day in Singapore. Unique with the account.                           |
| `available_cents`, `pending_cents`                 | The Stripe balance the run read.                                                       |
| `held_cents`, `limit_cents`                        | The held total, and the balance less held.                                             |
| `named_cents`, `unnamed_cents`                     | The sum of everything payable the database names, and what the limit leaves beyond it. |
| `amount_cents`                                     | The sum of the items this payout pays.                                                 |
| `outcome`                                          | `paid`, `below_minimum`, `nothing_payable` or `failed`.                                |
| `send_status`, `stripe_payout_id`, `payout_status` | `send_status` is `sending` or `sent`. `payout_status` follows Stripe's payout events.  |
| `error`                                            |                                                                                        |

**`payout_adjustments`** (new): an amount owed to or by a profile that is not a
payment. Each is marked by the payout that settles it, like a payment.

| Column                                    | Notes                                                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`, `payout_account_id`, `amount_cents` | Signed. A debt is negative.                                                                               |
| `kind`                                    | `opening_available`, `opening_pending`, `refund_after_payout`, `bank_dispute_after_payout`, `correction`. |
| `payment_id`, `refund_id`                 | What the adjustment is about, where it has one.                                                           |
| `reason`, `created_by`, `created_at`      | A `correction` is made by a Support admin and needs a reason.                                             |
| `payout_id`                               | The mark.                                                                                                 |

### Changes that ship before this build

Decision 2d takes six changes out of this build. Each is its own pull request
and its own deploy, checked on self-paced sales or on Part 1's screens before
any class code depends on it. The plan lists their files under "Before
Phase 1".

| Change                                                | Goal                                                                                                          | Risk                                                   | Check                                                                                                                                | Rollback                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Refunds are recorded under Stripe's refund id         | One ledger row per Stripe refund. Today the action and Stripe's notice can record one refund under two ids.   | A self-paced refund is recorded twice or not at all.   | A Support refund and a dashboard refund in the sandbox each leave one row and one email.                                             | Revert the commit. There is no schema change. |
| A webhook event whose handler failed is handled again | A redelivered Stripe event with a stored error and no success is retried. Today it is skipped as a duplicate. | A handler that half-finished runs twice.               | Each Stripe handler is run twice in a test and leaves the same rows. The Mux route keeps treating every stored event as a duplicate. | Revert the commit.                            |
| Database backups kept for 35 days in production       | A learner's attendance and payments can be restored.                                                          | None to the product.                                   | The RDS setting after `terraform apply`.                                                                                             | Lower the setting.                            |
| Sign-in limit of 300 per network address              | A class can sign in on one venue network. The limit of 5 per email address already exists.                    | More sign-in emails can be requested from one address. | The existing sign-in limit tests, with the new number.                                                                               | Restore the number.                           |
| A recorded step that erases one learner's coordinates | A privacy request can be met.                                                                                 | The wrong learner's rows are deleted.                  | A test; the procedure states that backups keep the rows for up to 35 days.                                                           | None: an erasure is final.                    |
| Each Support view of coordinates is recorded          | Who looked at a learner's location is known.                                                                  | None to the product.                                   | A test.                                                                                                                              | Revert the commit.                            |

The last four are needed before a real learner checks in. The first two are
needed before Phase 4 of this plan.

### Opting in

`POST /teach/profiles/:profileId/class-sales/accept` takes the terms version.
It is guarded by `stripe.links`, the capability only an owner holds, and by the
recent-sign-in check the Stripe link routes use. It requires the payout
account to be payable. Then, in this order:

1. In one transaction, record the acceptance on the profile and set
   `payout_mode` to `switching`.
2. Switch the Stripe account to manual payouts.
3. Read the account's Stripe balance.
4. In one transaction, set `payout_mode` to `manual` and `manual_since` to the
   time of step 3, write the two opening amounts, and write an audit entry.

If the request dies after step 1, the next run of the job finishes steps 2 to
4 for any account that has been `switching` for more than five minutes. While
an account is `switching`, its classes are not on sale and the job does not
pay it.

**Leaving** (G16). `POST /teach/profiles/:profileId/class-sales/leave`, with
the same guard and recent-sign-in check, sets `leave_requested_at` to now and
`leave_on` to 30 days later, and writes an audit entry. From that moment the
profile's classes are not on sale. Seats already sold are untouched: their
classes run, their refunds are sent and their money is released on the usual
dates. Each run, after paying, the job finishes a leave when `leave_on` has
passed, no class payment of the profile is unreleased, no seat refund is
unfinished and no payout is at `sending`: it switches the Stripe account to
automatic payouts, sets `payout_mode` to `automatic`, clears the leave
columns and `manual_since`, writes an audit entry and emails the owner.
Anything still in the balance, including amounts under S$1, is then paid by
Stripe's own schedule. The profile can opt in again. Stopping sales at the
notice, not at the leave date, keeps new held money from pushing the leave
later (Drafting).

**A precondition on the Stripe side.** Stripe's Express dashboard lets an
account holder change their payout schedule and pay themselves out. Both
features, "Edit payout schedule" and "Manual payouts", must be turned off in
the platform's Connect settings, in the sandbox and in live mode, before any
profile opts in. Otherwise the holding is not a control.

A profile can publish a class without opting in, as in Part 1. A class is on
sale only when its profile has opted in.

### When a class is on sale

One pure function in `packages/core`, `classOnSale(class, blocks, profile,
course, now)`. All of these must hold:

- the server setting `CLASS_SALES` is on;
- the class is published and not cancelled;
- its first block has not started;
- its last block ends within 75 days of now;
- its profile has opted in, its payout mode is `manual`, it has not given
  notice to leave, and its payout account is payable;
- its course is on sale.

### Buying a seat

The course page response, `GET /catalog/courses/:slug`, gains two fields. Older
apps ignore both. The existing `viewer` fields keep describing the self-paced
enrollment only.

- `classes`: the classes of this course that are on sale, each with its name,
  delivery, venue address, block times, time zone, and seats left.
- `viewerClassSeats`, beside `viewer` and not inside it: the signed-in
  learner's seats in classes of this course, each with the class, the
  enrollment and its status.

The learner app lists the classes under "Take it as a class", each with its
own button. A full class is shown as full. On the web the button opens the
class checkout page. In the installed app it opens the web course page with the
class named in the address, and the web page opens with that class chosen.

`GET /checkout/classes/:classId` gives the class checkout page what it shows:
the class, the quote, seats left and the current version of the refund terms.
It takes an optional promo code. A promo code that makes the price zero is
refused for a class, and so is a price under the minimum charge.

`POST /checkout/classes/:classId` starts a class checkout. It takes the promo
code and the terms version the page showed. Self-paced checkout,
`POST /checkout/courses/:id`, is not changed. In order, the service:

1. Loads the class and applies `classOnSale`.
2. Refuses a learner who is the profile's owner or a member, and a terms
   version that is not the current one.
3. Quotes, and refuses a zero price or one under the minimum.
4. In one transaction that locks the class row:
   - finds the learner's enrollment row for this class, and refuses if it is
     active;
   - if the row is a current reservation, returns its payment page and stops:
     a reservation is never extended;
   - refuses a fourth reservation in 24 hours;
   - counts seats taken and refuses with "class full" if none is left;
   - ends the learner's other reservations for classes of the same course;
   - writes the learner's row as `pending_payment`, reserved for 35 minutes,
     with the terms version.
5. Creates the Stripe payment page, valid for 30 minutes, with the class id
   and the terms version in its stored details, and expires the payment pages
   of the reservations ended in step 4.

Class checkout offers cards and PayNow, and nothing else (decision R6). The
payment page is created with `allowed_payment_method_types`, so a method
turned on in the Stripe Dashboard later is not offered for a class. The page
also sets `wallet_options.link.display` to `never`, so the Link button is not
shown (G4). Apple Pay is a card payment and stays.
Self-paced checkout does not send the list and keeps the Dashboard's methods.

A card confirms while the payment page is open. A PayNow QR code is valid for
1 hour by Stripe's documentation, which is longer than a reservation. In the
sandbox, though, Stripe cancelled the PayNow payment when its payment page
expired, and the QR code then took no money. So a PayNow payment has the same
window as a card: the 30 minutes of the page. If a payment still arrives
after its reservation has ended, the fulfilment table covers it: the payment
gets the seat if one is free and the class has not started, and is refunded
in full if not.

**Fulfilment.** `fulfilCheckout` reads the class id from the payment page's
stored details. With none, it behaves as today. With one, inside its
transaction it locks the class row and then the enrollment row, always in that
order, and decides by the state it finds:

| State when the payment arrives                                                                                                                                                | Rows written                          | Enrollment | Answer to the confirmation page |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------- | ------------------------------- |
| The class is not cancelled and the reservation is current.                                                                                                                    | The payment, with its `class_id`.     | `active`   | Paid.                           |
| The class is not cancelled, the reservation has ended, a seat is free, and either the first block has not started or Stripe's time for the payment is inside the reservation. | The payment.                          | `active`   | Paid.                           |
| Anything else: the class is cancelled, or the reservation has ended and the class is full or has started.                                                                     | The payment and a `seat_lost` refund. | Unchanged  | Seat lost.                      |

The first two rows also count the promo code. No row touches
`courses.enrol_count`. A class payment never enters the existing
duplicate-payment refund paths: a class payment that gets no seat always gets
a `seat_lost` row.

The receipt for a class sale shows the class's name, dates, times, time zone
and place, and links to the class screen. A payment that gets no seat sends
the seat-lost email and no receipt.

`GET /checkout/sessions/:id/sync` adds `classId` and a third outcome, "seat
lost", to its answer. The confirmation page shows the class and a link to the
class screen, or says that the seat was lost and the payment is being returned
in full.

### Refunds

Every refund of a seat that the system starts is one `seat_refunds` row. One
function in `packages/core/src/domain/money.ts`, `seatRefund()`, works out its
amounts. The fee calculation stays in that one file.

**The amounts.** For one payment:

| Symbol | Meaning                                                                 | Example  |
| ------ | ----------------------------------------------------------------------- | -------- |
| A      | The price paid.                                                         | S$500.00 |
| E      | The fee estimate.                                                       | S$17.50  |
| C      | The commission.                                                         | S$72.38  |
| N      | The profile's share: A − C − E.                                         | S$410.12 |
| F      | Stripe's fee, as charged.                                               | S$20.00  |
| K      | What Elevate keeps after Stripe's fee: C + E − F, and never below zero. | S$69.88  |

A refund is two amounts: R, returned to the learner's card with the same
amount taken back from the profile, and X, returned from Elevate's fee to the
profile.

| Kind                                    | R to the learner          | X to the profile                          | Profile's net on the seat | Elevate's net on the seat |
| --------------------------------------- | ------------------------- | ----------------------------------------- | ------------------------- | ------------------------- |
| `teacher_cancelled`, `changed_withdrew` | A                         | K                                         | −F                        | 0                         |
| `learner_withdrew`                      | A − F                     | K                                         | 0                         | 0                         |
| `discretionary`, for a chosen R         | R                         | K × R ÷ A, rounded down                   | N − R + X                 | K − X                     |
| `teacher_cancelled_part`                | A × U ÷ B, rounded down   | K × R ÷ A, rounded down                   | N − R + X                 | K − X                     |
| `elevate_cancelled`, `seat_lost`        | A                         | C + E                                     | 0                         | −F                        |
| `dispute_lost`                          | None: the bank returned A | C + E, with the whole transfer taken back | 0                         | −F − S$15                 |

U is the number of blocks not taught and B the number of blocks, both
counted when the class is cancelled. A `teacher_cancelled_part` refund is
worked out like a discretionary one, with R set by the blocks; Stripe's fee
falls on the profile and Elevate in proportion. On the example, a five-block
class cancelled after one block returns S$400.00 to a learner who attended,
and S$55.90 of Elevate's fee to the profile.

On the example: a cancelled seat returns S$500.00 to the learner and leaves
the profile S$20.00 down. A withdrawal returns S$480.00 and leaves the profile
at zero. A discretionary refund of S$300.00 returns S$41.92 of Elevate's fee,
so the profile keeps S$152.04 and Elevate S$27.96.

Rules the table does not show:

- Every amount is whole cents. The only division is the discretionary one, and
  it rounds down.
- Several discretionary refunds on one payment add up. The total of R may not
  exceed what the learner paid and has not had back. X for each new refund is
  K × (the total of R so far) ÷ A, rounded down, less the X already returned.
- When Stripe's fee is larger than Elevate's fee, K is zero and Elevate bears
  the difference.
- F is read from the payment. A refund whose payment has no fee recorded yet
  waits.
- A payment that already had a part refund follows the same table, with A
  read as what is left to return and X as what is left of the fee to return.
  One case is not exact: a lost bank dispute after a part refund. Stripe
  returns Elevate's fee in proportion with the reversal, so the profile's net
  on that seat can differ from zero by less than Stripe's fee.

**The profile's share after refunds.** One function,
`profileShareAfterRefunds()`, in `money.ts`:

> N, less the total of R over the payment's refunds, plus the total of X over
> them. Zero for a payment lost to a bank dispute.

It replaces the existing `netAfterRefunds`, which assumes Elevate's fee is
always returned in proportion. For a refund made as today the two give the
same answer, and a test shows it. The held total, the payout ceiling and the
Teach earnings page all use the one function. The result can be below zero: a
cancelled seat leaves −F.

**The statuses of a row.**

| Status        | Meaning                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `waiting`     | Not ready to send. It waits for an open manual mark to settle or be disputed, for an open bank dispute to close, or for Stripe's fee to be recorded.                |
| `pending`     | Ready. Nothing has been sent.                                                                                                                                       |
| `refund_sent` | The refund to the learner has been sent to Stripe. Stripe may not have made it yet, and the fee refund to the profile is not made.                                  |
| `done`        | Both are made and recorded.                                                                                                                                         |
| `closed`      | Ended with nothing more to send, with a reason: the mark settled, so the learner is counted as attended; the bank returned the money; or a Support admin closed it. |
| `failed`      | Stripe refused a step for a reason a retry cannot fix, or 96 attempts have been made. The job does not try it again. A Support admin retries or closes it.          |

A row that is `waiting`, `pending`, `refund_sent` or `failed` is unfinished.
An enrollment can have one unfinished row. A payment with an unfinished row is
not released and is not paid out.

**How the job sends a row.** It claims the row with a lock that a second run
skips, and works from the row's status, so a run that stops can be followed by
another:

1. `waiting`: check what it waits for.
   - A manual mark that has settled: the learner is counted as attended. A
     `teacher_cancelled` row with blocks not taught becomes
     `teacher_cancelled_part` and `pending`, and continues. With none not
     taught, close the row.
   - A manual mark that was disputed, a bank dispute that Elevate won, or a
     fee now recorded: make the row `pending` and continue.
   - A bank dispute that was lost: close the row.
2. `pending`: work out and store R and X. Create a Stripe refund of R with the
   transfer reversed and Elevate's fee kept. The request carries the row's id
   as a label and the idempotency key `seat-refund:<id>`. Store the refund id;
   status `refund_sent`.
3. `refund_sent`: read the refund's status at Stripe.
   - Pending: leave the row for the next run. A card refund has succeeded
     when it is created; a PayNow refund is pending for up to 5 minutes.
   - Failed or cancelled: make the row `failed`. Stripe has not paid the
     learner, and Support refunds them another way.
   - Succeeded: if X is more than zero, refund X of Elevate's fee to the
     profile, with the row's id as a label and the key
     `seat-fee-refund:<id>`. Store its id.
4. In one transaction: record the refund through `applyRefund`, described
   below, and mark the row `done`. Then email the learner in their language
   and the profile's owner in English.

Every kind but one uses the same two calls; for `elevate_cancelled` and
`seat_lost`, X is the whole of Elevate's fee. For `dispute_lost`, steps 2 and
3 are one reversal of what is left of the transfer, with Elevate's fee
refunded, and no ledger row is written.

Stripe remembers an idempotency key for at least 24 hours. Before the job
repeats a step more than 23 hours after the row's first attempt, it lists the
payment's refunds at Stripe, or the refunds of its fee, and looks for the
row's label. If the refund is
there, it stores the id and moves on without sending.

Nothing is recorded and nobody is emailed until Stripe reports that the
refund succeeded, so a learner is never told of a refund that then fails.

Both orders of steps 2 and 3 were tested, on a card and on PayNow, and Stripe
accepts a reversal larger than the profile's balance. Stripe refuses a refund on a payment with an open
or lost bank dispute, which is why such a row waits or is closed.

**Stripe's notice of the job's own refunds.** Stripe sends `charge.refunded`
for every refund, including the job's. The webhook reads the label: a refund
that carries a seat-refund id is left to the job, and the webhook records
nothing and sends no email for it.

**Refunds from outside.** Support's existing "refund in full" action and a
refund made in the Stripe dashboard keep working, and carry no label. The
ledger function they share, `applyRefund`, changes for a class payment:

- It takes the enrollment's outcome as an explicit value: `refunded`,
  `cancelled` or `unchanged`. A full refund from outside passes `refunded`,
  which frees the seat. A part refund passes `unchanged`.
- It can join a transaction the caller already has open, so the job's step 4
  is one transaction.
- It does not touch `courses.enrol_count`.
- It stores X on the ledger row.
- For an opted-in profile, it writes a `refund_after_payout` adjustment of
  X − R when the payment was already marked paid or is inside the opening
  amounts. A refund on a payment not yet marked needs none: the payment's
  share after refunds already counts it.

Support's action is refused for a payment that has an unfinished seat refund.

### Withdrawing, moving, changing a block and cancelling

No route in this section calls Stripe. Each writes rows in one transaction,
and the job sends the money.

**Withdraw.** `POST /me/classes/:enrollmentId/withdraw`. Allowed when the seat
is active, the class is not cancelled, the learner is not counted as attended
and has no open manual mark, and one of these holds:

- the first block is more than 7 days away, giving `learner_withdrew`;
- `class_changed_at` is set and the class has not started, giving
  `changed_withdrew`.

When both hold, the learner gets `changed_withdrew`, the full refund. The
request sets the enrollment's status, which frees the seat, and writes the
row. The learner's class list shows what would be returned and until when; it
shows a rate, not an amount, until Stripe's fee is recorded. After a
withdrawal it shows "refund on its way" until the row is done.

**Move.** `POST classes/:id/learners/:enrollmentId/move` with the target
class, guarded by `class.manage`. `GET classes/:id/move-targets` lists the
classes a learner can be moved to. A move is allowed when:

- the learner is not counted as attended in the present class and has no open
  manual mark there;
- the seat has no unfinished refund and its payment has no open bank dispute;
- the target is a class of the same course and profile that is published, not
  cancelled, not started, and has a seat free;
- the target's last block ends within 75 days of the learner's payment;
- the learner has no enrollment row of any status in the target.

In one transaction that locks both class rows in id order, the enrollment and
its payment are pointed at the target, and the enrollment's move columns and
`class_changed_at` are set. The learner is emailed.

**Changing a block's time.** Part 1's `PATCH classes/:id` replaces blocks that
have no check-in or manual mark. When the class has a seat, an edit that
changes a block's start or end, adds a block or removes one:

- is refused if the class would then end more than 75 days after any seat's
  payment;
- sets `class_changed_at` on each seat whose learner is not counted as
  attended, if the class has not started;
- emails every learner with a seat the old and the new times, and tells those
  with the right how to withdraw.

The same route refuses a capacity below the number of seats taken.

**Discretionary refund.** `POST classes/:id/learners/:enrollmentId/refund`
with an amount and a reason. It is guarded by a new capability,
`class.refund`, held by the owner and managers, and by the recent-sign-in
check. Allowed until the payment is released, for any amount up to what the
learner paid and has not had back, when the seat has no unfinished refund and
no open bank dispute.

**Cancel.** `POST classes/:id/cancel` with a reason, guarded by `class.manage`
and by the recent-sign-in check. In one transaction it marks the class
cancelled, writes the `class_cancellations` row, ends every reservation, and
for each active seat:

- learner not counted as attended, no open manual mark: a `teacher_cancelled`
  row, `pending`;
- learner not counted as attended, with an open manual mark: a
  `teacher_cancelled` row, `waiting`;
- learner counted as attended: a `teacher_cancelled_part` row, `pending`, when
  any block was not taught (G12). When every block had started, no row; they
  are emailed that the class was cancelled.

After the transaction it expires the payment pages of the reservations it
ended. If that fails, fulfilment still refuses the seat.

The profile cannot cancel a class that is released. A Support admin still
can.

A withdrawal is refused once a class is cancelled, because the cancellation
already gives the learner the larger refund.

**Cancellation by Elevate.** `POST /support/classes/:id/cancel`, for a Support
admin, with one of these grounds and a note (G17):

- `teacher_absent`: the teacher did not turn up, or cannot teach the class;
- `venue_unavailable`: the venue is unsafe or cannot be used;
- `rules_breach`: the profile broke Elevate's rules or acted dishonestly;
- `profile_suspended`: the profile is suspended;
- `required_by_law`.

The same steps follow, except that every active seat gets an
`elevate_cancelled` row, whether or not the learner attended (R4). A seat
with an open bank dispute gets a `waiting` row. The profile's owner is
emailed the ground and the note. Support tells the owner before cancelling
when there is time to; the runbook says so, and the route does not check it.
What is taken back from the profile is never more than what is refunded.

### Telling a learner about a manual mark

Part 1 sends no notice of a manual mark. Under decision 3 a settled mark can
cost a learner a refund, so the learner must hear of it while they can still
dispute it. After a manual mark is stored, the learner is emailed in their
language: the class, the block, that they were marked present by hand, the
date their 7 days end, and a link to the class screen where they dispute it.

### Held money and the release job

**What is held.** For a profile, the held total is the sum, over its class
payments that are not marked released, of the profile's share after refunds
where that is above zero.

**When a class is due.** All of these hold:

- 7 days have passed since its last block ended, or since it was cancelled;
- none of its manual marks is open (R5);
- if it was cancelled, its cancellation is complete.

**What can be paid.** A payable item is one of:

- an adjustment that no payout has marked;
- a payment that no payout has marked, made after the profile's opening
  amounts were read, with no unfinished refund, that is a self-paced payment
  or a class payment marked released. Its amount is the profile's share after
  refunds;
- a class payment not yet released whose share after refunds is below zero.
  A debt counts at once.

**One run.** The release program, `dist/release.js`, takes a database lock so
that two runs cannot overlap, and then:

1. Starts a `payout_runs` row.
2. Finishes any opt-in left at `switching`.
3. Fills in Stripe's fee on payments that lack it.
4. Works through the unfinished refund rows that are not `failed`, as under
   "Refunds".
5. For each opted-in profile, marks what is released:
   - for each class that is due and not yet released: if no learner is counted
     as attended and no Support admin has cleared it, set `review_needed_at`
     and leave it; otherwise mark the class released with the reason `due`;
   - for each payment of a released class that has no open bank dispute and
     no unfinished refund: mark it released, with the class's reason;
   - mark any class payment that is 85 days old with the reason `day_limit`.
6. In the first run at or after 10:00 Singapore time, for each opted-in
   profile with no `payouts` row for that day:
   1. Read the Stripe balance: available and pending.
   2. Work out the held total, and the limit: the smaller of available, and
      available plus pending less held; never below zero.
   3. Choose the items. Take every payable item below zero. Then add the
      others, oldest first, each whole, while the total stays within the
      limit. Stop at the first that does not fit.
   4. Record `named_cents`, the total of all payable items, and
      `unnamed_cents`, what the limit leaves beyond it.
   5. If the chosen total is under S$1, record `below_minimum` or
      `nothing_payable` and mark nothing.
   6. Otherwise, in one transaction, write the `payouts` row with
      `send_status` `sending` and its amount, and mark each chosen item with
      the row's id. Commit. Create the Stripe payout for that amount with the
      row's id as a label and the key `payout:<id>`. Then set `send_status` to
      `sent`. If Stripe refuses the payout, clear the marks and record
      `failed`.
7. Finishes the `payout_runs` row and writes one log line with the run's
   counts.

A run that finds a `payouts` row left at `sending` sends the same request with
the same key. If the row is more than 23 hours old it first looks for a payout
with the row's label at Stripe.

Steps 2 to 5 write nothing for a profile with nothing to do, so 95 of the 96
runs in a day leave no row per profile.

**Why three bounds.** The available balance stops a payout Stripe would
refuse. The balance less held keeps class money in the account. The named
items are the ceiling of decision 4: money in the balance that no row accounts
for is never chosen, because only rows are chosen.

**Scheduling.** Terraform adds a task definition, `release`, beside the API's
and Part 1's `migrate`. It runs the API image with the command
`node dist/release.js` built in, because a schedule cannot change the command
of the task it starts. It connects as the API's restricted database user. An
EventBridge Scheduler entry starts it every 15 minutes, with a dead-letter
queue for starts that fail. Each deploy registers a new version of the task
definition and then points the schedule at that version.

**The alarm.** A schedule's retry covers a task that fails to start, not one
that starts and fails. Three CloudWatch alarms send to one email address, set
per environment:

- no "run finished" log line in 30 minutes;
- a run's log line reports a refund row that is ready and has not been sent
  for a day, a failed refund row, or a failed payout;
- a message in the dead-letter queue.

**What a profile sees.** The Teach earnings response gains the held total, the
classes it is held for with each one's release date or the reason it waits,
the recent payouts with the payments and adjustments each one paid, and any
debt not yet covered.

**What Support sees and can do.** A new payouts page shows the last finished
run, classes under review, refund rows that wait or failed, cancellations not
yet complete, payments released by the day limit, failed payouts, and
profiles with unnamed money. A Support admin can:

- release a class under review, with a note;
- retry or close a failed refund row, with a reason;
- write a `correction` adjustment, with a reason.

Each writes an audit entry.

### Bank disputes

Four Stripe event types are handled that are ignored today. Before the first
deploy that handles them, the webhook endpoint is subscribed to them in the
sandbox and in live mode; that is a rollout step.

A PayNow payment cannot be disputed at a bank, by Stripe's documentation, so
the two bank dispute events arrive for card payments only.

| Event                          | Effect                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `charge.dispute.created`       | Record the bank dispute on the payment as `open`. A class payment not yet released stays held. An unfinished refund row for the seat becomes `waiting`.                                                                                                                                                                                                                                                          |
| `charge.dispute.closed`, won   | Status `won`. The next run marks the payment released if its class is, and resumes a waiting refund row.                                                                                                                                                                                                                                                                                                         |
| `charge.dispute.closed`, lost  | Status `lost`. Close any unfinished refund row for the seat and write a `dispute_lost` row. The job takes the whole transfer back and returns Elevate's fee to the profile, so the profile's net for the seat is zero. The enrollment becomes `refunded`. If the payment was already paid out, a `bank_dispute_after_payout` adjustment is written for the amount paid. Elevate bears Stripe's fee and the S$15. |
| `payout.paid`, `payout.failed` | Update `payout_status`. A failed payout clears the mark from each item it paid, so the next day's payout chooses them again, and raises the alarm.                                                                                                                                                                                                                                                               |

The lost case works the same before and after release. A bank dispute can
arrive up to about 120 days after the class, so most will arrive after the
profile has been paid. Then the transfer is taken back from a balance that may
be empty, the balance goes negative, and the adjustment lowers the profile's
later payouts.

A bank dispute on a self-paced payment is recorded and changes nothing else.

### Settings and switches

- `CLASSES`, from Part 1, is turned on in production.
- `CLASS_SALES`, new, default off. Off: no class is on sale and class checkout
  answers "not on sale". Seats already sold, withdrawals, refunds, the job and
  check-in keep working.
- Opting in is per profile, as above.

### Room for grant money

Part 2 builds none of the grant flow. The author pictures a funded learner
paying the price less the subsidy, with the subsidy arriving later. These are
the places in this design that assume one card payment for the whole price of a
seat, listed so a later design knows what it must change:

- `seatRefund()` takes one payment's amounts.
- A reservation ends when one payment completes.
- The held total and the payable items add up payments; a subsidy not yet
  received is in neither.
- The 85-day limit counts from the card payment.

What Part 2 does to leave room: a payment keeps its list price apart from the
price paid; a seat refund is its own row tied to a payment, so a seat can have
refunds against more than one payment; and a class's release is a recorded
step that can wait, so "waiting for a subsidy" can become another reason a
class is not due.

## Alternatives Considered

Each row gives what the option offered, the trade-off that decided against it,
and where the decision is recorded:

- **RFC**: the
  [Alternatives Weighed](./scheduled-classes-brief.md#alternatives-weighed)
  section of the RFC.
- **Session**: a question the author answered while the first version was
  drafted.
- **Decision** or **R** with a number: an entry in `author_decisions.md`,
  which gives each option in full.
- **Drafting**: the assistant's choice.

### What is sold, and how

| Alternative                                                     | What it offered                                                                                           | Why it was rejected                                                                                                                                                                      | Recorded        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| The learner buys the course and is placed in a class afterwards | Checkout would not change.                                                                                | A learner could pay and find no class with a seat. The author wants paying and choosing a class to be one step.                                                                          | RFC, author     |
| A price set per class                                           | A profile could charge more for a live class.                                                             | A price on each class, a quote per class and promo rules per class. The author wants a class to take the course's price.                                                                 | RFC, author     |
| A class as its own entry in the catalog                         | Classes could be browsed and searched.                                                                    | A second listing, search entry and page per class. The author wants a class sold from the course it belongs to.                                                                          | RFC, author     |
| Placing a learner in a class without a sale                     | A profile could seat a guest, and a trial could be held before checkout exists.                           | It gives a seat away and adds a second way into a class, which every seat count and refund rule would have to allow for.                                                                 | RFC, author     |
| One enrollment per course with a separate seat table            | The one-enrollment rule would stay.                                                                       | Progress, quiz attempts, certificates and payments all point at the enrollment; a second owner would mean changing the payment path and copying three tables.                            | RFC, technical  |
| Counting seats only when a payment completes                    | No reservation to manage.                                                                                 | Two learners can both pay for the last seat, and the only remedy is a refund that costs Elevate Stripe's fee.                                                                            | RFC, technical  |
| A job that ends expired reservations                            | A reservation would be an explicit record with an end.                                                    | A reservation counted by its end time needs no job, and a late job would leave a free seat looking taken.                                                                                | RFC, technical  |
| A learner may hold only one seat per course                     | Simpler to explain.                                                                                       | A learner may reasonably book two classes, and Part 1's rule is one seat per learner per class.                                                                                          | Drafting        |
| Every approved profile can sell classes at once                 | No step for a profile to take.                                                                            | Every profile's payouts would move onto new code on one day, and any profile could create held-payment liability before the flow has been tried.                                         | Session, author |
| Support turns classes on profile by profile                     | Elevate would choose who is in the beta.                                                                  | Enabling would be manual work for Support, and a profile that asks would wait.                                                                                                           | Session, author |
| A reservation that is extended by each new checkout             | A learner who goes back and forth keeps their place.                                                      | One learner could keep a seat reserved for ever without paying.                                                                                                                          | Drafting        |
| Cards only at class checkout                                    | No payment could arrive after its reservation, and card refunds are already tested.                       | A learner could not pay for a seat by PayNow, which self-paced checkout offers.                                                                                                          | R6              |
| The Dashboard's methods at class checkout, less a blocked list  | A method turned on later would appear with no code change.                                                | A method that confirms days later would be offered, once turned on, until someone added it to the list.                                                                                  | R6              |
| Returning the unused part of the fee estimate to the profile    | On a PayNow sale the profile would get S$10.41 more on S$500, and Elevate would keep its commission only. | One more Stripe call and ledger entry on every PayNow sale, in a build the review found too large. Elevate would still bear the difference on a foreign card, with no gain to offset it. | R7              |
| A lower fee estimate for class sales                            | One number would change, with no new Stripe call.                                                         | Class and self-paced sales would quote differently, and Elevate would lose on every card sale if the mix of methods were guessed wrong.                                                  | R7              |

### Holding and releasing money

| Alternative                                                                  | What it offered                                                                                   | Why it was rejected                                                                                                                                                                                                                                                                                                                                                                                                | Recorded          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Pay the profile at the moment of a class sale                                | No change to payments.                                                                            | A cancelled class would pull refunds from a profile that may have been paid already, and Elevate carries the shortfall.                                                                                                                                                                                                                                                                                            | RFC, author       |
| Hold class money in Elevate's own Stripe balance, and transfer it at release | No payout engine, no switch on the profile's account, and a refund before release is one call.    | Elevate would hold money owed to profiles, which sharpens the licensing question. A profile would see held money only in Teach. Class sales would be a second payment model beside ADR 003. Stripe's fee on a cancelled seat would have to come out of a later transfer. The first version's reason, that Elevate would become the seller on the card statement, was wrong: the test session showed it already is. | Decision 1        |
| Elevate's balance for every sale, self-paced included                        | One payment model, and everything the row above offers.                                           | It changes the live self-paced payment path, which Part 2 otherwise leaves alone, and replaces ADR 003.                                                                                                                                                                                                                                                                                                            | Decision 1        |
| A fixed payout delay on the profile's account                                | No job to build.                                                                                  | Stripe allows a delay of at most 31 days, too short for a class sold weeks ahead. Limiting sales to 24 days ahead would fit, and would also delay every self-paced payout by 31 days.                                                                                                                                                                                                                              | RFC, not workable |
| A person presses a button to release each class                              | No scheduler.                                                                                     | At 10 to 40 classes it is weekly work that a missed week turns into late pay. The author wants no manual step in paying profiles.                                                                                                                                                                                                                                                                                  | RFC, author       |
| Release block by block                                                       | The profile of a long class is paid as it teaches, and a part-taught class has an obvious refund. | Every seat's money would be split across blocks, and each release and refund would work on parts of a payment.                                                                                                                                                                                                                                                                                                     | Session, author   |
| Release when the class ends                                                  | Fastest for the profile.                                                                          | Money could leave before a manual mark is settled or a complaint about the last day arrives.                                                                                                                                                                                                                                                                                                                       | Session, author   |
| No way back from opting in during the beta                                   | One fewer route, screen and set of tests in the first build.                                      | An undefined beta would be read against Elevate, and a profile that wants to stop could not.                                                                                                                                                                                                                                                                                                                       | G16               |
| A way back done by Support by hand                                           | No route to build.                                                                                | Switching an account back pays out everything held; the check that nothing is held would be made by a person.                                                                                                                                                                                                                                                                                                      | Decision 2c       |
| A second held total worked out from the calendar                             | A fault in the release marks would stop a payout.                                                 | Both totals read the same rows. They disagreed with no fault present after a late bank dispute, a move or a time edit, and nothing cleared a disagreement. Neither saw a payment missing from the database.                                                                                                                                                                                                        | Decision 4        |
| A second number read from Stripe                                             | A payment missing from the database would still be held.                                          | Stripe calls for every profile on each paying run, a lookup by class that was not tested, and a run that pays nobody when Stripe refuses.                                                                                                                                                                                                                                                                          | Decision 4        |
| One held total, and a report afterwards                                      | The least to build.                                                                               | A wrong total pays money out before anyone sees the report.                                                                                                                                                                                                                                                                                                                                                        | Decision 4        |
| A running total per profile in place of marks                                | Debts and short payouts need no special case.                                                     | A payout would be an amount, not a list of sales, and a wrong past figure would stay in the total.                                                                                                                                                                                                                                                                                                                 | R1                |
| The release does not wait for open manual marks                              | A class is always paid on the same day.                                                           | A class marked wholly by hand would go to Support's review although its marks would settle days later.                                                                                                                                                                                                                                                                                                             | R5                |
| Manual marks count at once for the review                                    | No waiting and no extra reviews.                                                                  | One manual mark would avoid the review of a class that was never taught.                                                                                                                                                                                                                                                                                                                                           | R5                |
| A loop inside the API                                                        | No new AWS resources.                                                                             | A money job would share a small web process, stop whenever the API is down, and leave nothing outside the logs to show it finished.                                                                                                                                                                                                                                                                                | Session, author   |
| A scheduled Lambda function                                                  | Starts in seconds and costs almost nothing per run.                                               | The repo has no Lambda, so it would need a second build and deploy path and a private-network connection to the database.                                                                                                                                                                                                                                                                                          | Session, author   |
| The job runs hourly or daily                                                 | Fewer runs.                                                                                       | The job is the only sender of refunds, so a learner who withdraws would wait up to an hour or a day.                                                                                                                                                                                                                                                                                                               | Decision 5        |
| A payout on every run                                                        | Self-paced money would reach the bank sooner.                                                     | Each payout is a bank transfer, and a run every 15 minutes would make dozens of small ones a day.                                                                                                                                                                                                                                                                                                                  | Drafting          |

### Refunds, withdrawal and cancellation

| Alternative                                                         | What it offered                                                                    | Why it was rejected                                                                                                            | Recorded        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| Refund in proportion, with Elevate absorbing Stripe's fee           | It is what Stripe does by default.                                                 | Elevate would lose money above about 80% refunded, and Stripe's whole fee at a full refund.                                    | RFC, author     |
| Refund every cancelled seat less Stripe's fee, whoever cancelled    | Elevate would never lose money.                                                    | A learner who did nothing wrong would bear the cost, and no source found permits the deduction when the provider cancels.      | RFC, author     |
| Offer self-paced access when a class is cancelled                   | Fewer refunds.                                                                     | It mixes the two products: a learner who paid for live teaching would be given something else.                                 | RFC, author     |
| Use the fee estimate in the refund rules                            | The same amount for every card, shown before paying.                               | Elevate would bear the difference on a costlier card: S$2.50 on the S$500 example.                                             | R2              |
| A full refund whenever the profile cancels                          | One rule, and the learner is always made whole.                                    | A profile that taught most of a class would be paid nothing for it.                                                            | Session, author |
| Any check-in or manual mark stops the refund                        | One meaning of "attended".                                                         | The profile writes the record that keeps its money: an instructor could mark the class present by hand and cancel.             | Decision 3      |
| Refund the blocks not yet taught when a class is cancelled part-way | The profile is paid for what was taught and the learner refunded for what was not. | The calendar, not attendance, would decide that a block was taught, and a part refund on cancellation needs its own fee rules. | Decision 3      |
| Support settles a class cancelled part-way                          | Judgement in the odd cases.                                                        | Every such cancellation would be manual work for Support, and Elevate would decide how much the profile keeps.                 | Decision 3      |
| The attendance rule applies only when the learner asks to leave     | A profile could not teach one block, cancel the rest and keep every payment.       | A profile that taught most of a class would refund all of it. The author wants the rule to hold in both cases.                 | Session, author |
| When Elevate cancels, learners who attended get no refund by rule   | The same rule for every cancellation.                                              | Elevate ends a class for its own reasons, and each learner who attended would have to be handled by a person.                  | R4              |
| Withdraw until the first block starts                               | One clock, simple to state.                                                        | A seat given up the night before cannot be resold.                                                                             | Session, author |
| Withdraw at any time before attending                               | The same sentence as the attendance rule.                                          | A learner who never comes could claim almost the whole price back afterwards.                                                  | Session, author |
| The instructor can grant a discretionary refund                     | The person who knows the case decides it.                                          | An instructor who is a writer cannot see earnings today, and could give away the profile's revenue.                            | Session, author |
| The instructor proposes a refund and the owner approves             | Knowledge and control both kept.                                                   | Two steps for each refund, and a proposal could outlive the 7 days before release.                                             | Session, author |
| Only Support can cancel a class that has started                    | A person at Elevate would see every mid-class cancellation.                        | An instructor who falls ill could not close their own class without Support.                                                   | Session, author |
| Only Support can cancel any class                                   | Elevate would see every cancellation.                                              | A profile that did not get enough sign-ups would have to raise a request.                                                      | Session, author |
| No moving; cancel and buy again                                     | Nothing to build.                                                                  | The profile bears Stripe's fee on every seat and each learner must pay again, with no promise of a seat.                       | Decision 2b     |
| The learner moves their own seat                                    | No work for the profile.                                                           | Learners could change dates late enough to leave a class half empty.                                                           | Session, author |
| A block's time cannot change once a seat is sold                    | No learner's dates change under them.                                              | A one-hour change to one block would mean cancelling the class or moving every learner.                                        | R3              |
| A block's time can change with no notice and no right               | Nothing to build beyond a limit check.                                             | A profile could move the first block closer and close a learner's time to withdraw without telling them.                       | R3              |
| The request sends its refunds, and the job retries                  | A learner is refunded at once.                                                     | Two programs would send, so each row needs a claim, and a full class's refunds can outlast one web request.                    | Decision 5      |
| A new enrollment status for a cancelled class                       | The state would be explicit.                                                       | An installed older app would show an unknown status as raw text.                                                               | RFC, technical  |

### Abuse, bank disputes and readiness

| Alternative                                                               | What it offered                                                      | Why it was rejected                                                                                                | Recorded        |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------- |
| Opting in and held payouts only                                           | The least to build.                                                  | A class sold and never taught would be released like any other, and a bank dispute would not stop a release.       | Session, author |
| Leave out the no-attendance review                                        | One less state and one less Support screen.                          | A profile that sells a class and does not teach it is paid, and each seat can return as a bank dispute on Elevate. | Decision 2b     |
| A ceiling on price times capacity per profile                             | The exposure from one class would be known in advance.               | A profile planning a large class would hit a limit during the weeks the author most wants it trying the feature.   | Session, author |
| A late or repeat cancellation needs Support                               | A check on cancelling for gain.                                      | It conflicts with the author's decision that the owner or a manager cancels at any time.                           | RFC, superseded |
| Elevate absorbs a lost bank dispute                                       | Nothing to build beyond the hold.                                    | A profile would lose nothing when its class draws disputes, and each would cost Elevate the price and a fee.       | Session, author |
| Support decides each lost bank dispute                                    | A stolen card and a class never taught could be treated differently. | Every lost dispute would need a person, and similar cases could be decided differently.                            | Session, author |
| Support handles every bank dispute by hand                                | No new webhook handling.                                             | At the beta's size it is regular work, and nothing would hold a payment whose dispute is open at release.          | Decision 2b     |
| Support refunds each seat when Elevate cancels                            | No cancellation route for Support.                                   | A large class would be refunded one seat at a time, and a seat could be missed.                                    | Decision 2b     |
| A joining-details field on a remote class                                 | Learners would see the link in the app and the receipt.              | A field, its screens and its emails. The author chose to build nothing here; the instructor writes to learners.    | Session, author |
| Sell only in-person classes until Part 3                                  | No half-built path for remote.                                       | Remote was half of the original request and would wait for a third design.                                         | Session, author |
| Build the readiness items and the two live-path changes inside this build | One deploy.                                                          | A fault in the webhook retry would reach every self-paced payment in the same deploy as class sales.               | Decision 2d     |
| Treat a grant-funded learner as paying in full                            | Nothing in this design would need to leave room.                     | The author pictures the learner paying the net fee.                                                                | Session, author |

---

## Risks & Mitigations

| Risk                                                                                                                   | Impact                                                                                                                                                                                                                                      | Mitigation                                                                                                                                                                                                                                                         | Status             |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| A profile teaches one block, cancels the rest and keeps the payments of every learner who checked in.                  | Learners lose money for blocks never taught; their route is a bank dispute, which lands on Elevate.                                                                                                                                         | Decision 3 narrows the rule to the learner's own record and does not fix this case. A cancellation after a class has started is listed for Support. A lost bank dispute takes the profile's share back.                                                            | Accepted by author |
| A learner who was present disputes a manual mark to keep a refund.                                                     | The profile refunds a learner it taught.                                                                                                                                                                                                    | None by rule: a disputed mark never counts. The instructor can ask the learner to check in themselves. Such cases go to Support.                                                                                                                                   | Accepted by author |
| A profile that did not teach a class marks one learner present by hand, and the learner does not dispute it in 7 days. | The mark settles, the class avoids the no-attendance review, and the profile is paid.                                                                                                                                                       | The learner is emailed about the mark and how to dispute it. Nothing else prevents it; a learner's complaint goes to Support, and a bank dispute takes the share back.                                                                                             | Accepted           |
| A small edit to a block's time gives every learner the right to a full refund.                                         | A profile loses seats, and Stripe's fee on each, over a change of an hour.                                                                                                                                                                  | Teach warns before the edit is saved, naming the number of learners who gain the right.                                                                                                                                                                            | Accepted by author |
| A refund takes back more than the profile's Stripe balance holds.                                                      | The balance goes negative. Stripe holds the same amount back from Elevate's available balance at once, and takes it after 180 days if the profile's later sales have not covered it. Stripe does not collect from a Singapore bank account. | Class money is held until release, so before release only Stripe's fee is short. After release, a late bank dispute or a cancellation by Elevate can leave the whole share short. Each is an adjustment that Support can see.                                      | Accepted           |
| An account holder pays themselves the held money from the Express dashboard.                                           | The holding is not a control.                                                                                                                                                                                                               | Both dashboard features are turned off before any profile opts in, and the rollout checks it in each mode.                                                                                                                                                         | Mitigated          |
| Paying out on a real connected account has not been tested.                                                            | The paying step may fail in a way the test double does not show.                                                                                                                                                                            | A test on an account that has passed the liveness check, before Phase 5 is merged.                                                                                                                                                                                 | Open               |
| The database counts too little as payable.                                                                             | A profile is paid late. It is not paid too much.                                                                                                                                                                                            | The unnamed amount is recorded on every paying run and listed for Support.                                                                                                                                                                                         | Accepted           |
| The opening amounts are read wrongly at opt-in.                                                                        | A profile's first payouts are too small or too large by that error.                                                                                                                                                                         | The read and the switch are one recorded step with its time. A Support admin can write a correction.                                                                                                                                                               | Accepted           |
| No money can be held past 85 days, and how Stripe counts its 90 is not known.                                          | A class under review, or a seat with an open bank dispute, is paid out before the question is settled.                                                                                                                                      | The release is flagged for Support. A seat is sold, moved or re-timed only into a class ending within 75 days of its payment. The limits are provisional until Stripe answers.                                                                                     | Open               |
| The release job stops.                                                                                                 | No refund is sent and no opted-in profile is paid, self-paced money included.                                                                                                                                                               | The alarm emails a person after 30 minutes. The job cannot be switched off while any profile is opted in; the rollback section says what to do.                                                                                                                    | Mitigated in part  |
| A run fails part-way.                                                                                                  | Some refunds are sent and some are not; a payout is created and not recorded.                                                                                                                                                               | Every step works from stored state and can be repeated. Stripe ids are stored as each step completes, and a step older than 23 hours is looked up at Stripe before it is repeated.                                                                                 | Mitigated          |
| A learner's reservation ends while they are paying and the seat goes to someone else.                                  | The learner pays and has no seat.                                                                                                                                                                                                           | The payment is refunded in full and the learner is emailed. Elevate bears Stripe's fee. The reservation outlasts the payment page by 5 minutes.                                                                                                                    | Accepted           |
| A PayNow payment arrives after its reservation has ended.                                                              | The learner has paid and the class has filled or started. The payment is refunded at Elevate's cost.                                                                                                                                        | In the sandbox, expiring the payment page cancelled the PayNow payment, so its window is the 30 minutes of the page, as for a card. A real bank app was not tested. The fulfilment table covers a payment that still arrives.                                      | Accepted by author |
| A PayNow refund fails after Stripe accepted it.                                                                        | The learner is not paid, though the profile's share was taken back.                                                                                                                                                                         | Nothing is recorded or emailed until Stripe reports the refund succeeded. A failed one is shown to Support, who refunds the learner another way. No failed refund could be produced in the sandbox.                                                                | Mitigated in part  |
| The fee estimate is one rate for every payment method.                                                                 | Stripe's fee by PayNow is lower than the estimate: S$7.09 against S$17.50 on S$500. Elevate keeps the difference on a PayNow seat that is not refunded.                                                                                     | The price is quoted before the learner chooses a method, so the estimate cannot follow the method. Elevate also bears the difference when Stripe's fee is higher, as on a foreign card. The held-payout terms say so. The refund rules use the fee Stripe charged. | Accepted by author |
| Stripe's fee is not the same for two learners in one class.                                                            | Two learners who withdraw get different amounts back. On S$500, Stripe's fee was S$7.09 by PayNow and S$20.00 by a foreign card.                                                                                                            | The terms state the fee as a rate. The class screen shows each learner their own amount.                                                                                                                                                                           | Accepted by author |
| An opted-in profile cannot go back to Stripe's own payout schedule.                                                    | A profile that stops selling classes still depends on the job for all its payouts.                                                                                                                                                          | The terms say so before the owner accepts. A route is listed under Future Improvements.                                                                                                                                                                            | Accepted by author |
| An older version of the API handles a class payment after a rollback.                                                  | Part 1's version would activate the enrollment without the seat check.                                                                                                                                                                      | `CLASS_SALES` is turned off 35 minutes before any rollback, so no reservation is open.                                                                                                                                                                             | Accepted           |
| The opt-in terms, the refund terms, the attendance rule and the licensing question have had no legal review.           | A term may be unenforceable, a refund refused under the rule may be owed in law, or the holding may need a licence.                                                                                                                         | Listed in Open Questions; selling to real learners waits for a lawyer's answer.                                                                                                                                                                                    | Open               |
| Remote learners get joining details only if the instructor writes to them.                                             | A learner who buys late may have no link.                                                                                                                                                                                                   | The roster shows learners' emails to the instructor. Part 3 adds the class page.                                                                                                                                                                                   | Accepted by author |
| A class learner can open no materials until Part 3.                                                                    | A seat is worth only the live teaching until then.                                                                                                                                                                                          | The course page says what a class seat includes.                                                                                                                                                                                                                   | Accepted           |
| The venue address of a class on sale is shown to everyone.                                                             | An instructor teaching from home publishes a home address.                                                                                                                                                                                  | Teach says so when the class is published.                                                                                                                                                                                                                         | Accepted           |
| Part 2 is built on a schema that exists only on a branch.                                                              | If building the rest of Part 1 changes it, this plan changes.                                                                                                                                                                               | Part 1 in full is a stated prerequisite; the plan names the Part 1 files it extends.                                                                                                                                                                               | Open               |

### Limits

- One run at a time does all profiles in turn. At tens of opted-in profiles a
  run takes seconds; the design does not consider thousands.
- A profile is paid at most once a day, in whole payments. A payment that does
  not fit today's limit waits for tomorrow, and so does every payment after
  it.
- A seat can be sold only for a class that ends within 75 days.
- A PayNow payment can be refunded only within 90 days of the payment. After
  that Stripe refuses, and Support refunds the learner another way.
- The system does not know that a block was taught. It knows who is counted as
  attended.

## Non-Functional Requirements

### Security and privacy

- **Money actions and who may take them.** Opting in: the owner. Cancelling a
  class: `class.manage`. A discretionary refund: `class.refund`. Each of these
  three needs a recent sign-in. Moving a learner and changing a block's time:
  `class.manage`. Releasing a class under review, retrying or closing a
  refund, writing a correction and Elevate's own cancellation: a Support
  admin. Each writes an audit entry.
- **A learner acts only on their own seat.** Withdrawal looks the seat up by
  the signed-in learner and answers 404 otherwise.
- **Reading across profiles.** Every seat, refund and payout lookup for Teach
  goes through the class or the profile of the actor.
- **Only the release job moves money back.** No web request can send a refund
  or a payout for a seat, so a request that is repeated or forged can at most
  write one row, and a seat can have one unfinished row.
- **Stripe calls that move money carry an idempotency key and a label** taken
  from the row that asked for them. The label is how a call older than a day
  is found again.
- **What the course page makes public.** The name, dates, times and venue
  address of each class on sale. No learner's name or seat is public.
- **No card data** is stored or logged. Refund and payout log lines carry ids
  and amounts.

### Performance

- Starting a class checkout locks one class row for the length of a count and
  an insert. Seats taken is one indexed count on `enrollments (class_id,
  status)`.
- A run reads the unfinished refund rows and the classes that have become due.
  Once a day it makes, per opted-in profile, one balance read, one sum of held
  payments, one list of payable items and at most one payout call.
- A cancellation of a class of 30 is 60 Stripe calls, made by the job.
- New indexes: `enrollments (class_id, status)`, `payments (class_id)`,
  `payments (payout_account_id, payout_id)`, `seat_refunds (status)`, one
  unique index on `seat_refunds (enrollment_id)` for unfinished rows,
  `payout_adjustments (payout_account_id, payout_id)`, and the unique index on
  `payouts (payout_account_id, pay_date)`.

### Rollout and rollback

**Before anything is built or switched on:**

1. Part 1 is built in full and deployed, with its restricted database user.
2. The six changes under "Changes that ship before this build" are deployed.
3. Stripe's support has answered how the 90 days are counted, and the day
   limits are confirmed or changed.
4. A lawyer has read the opt-in terms and the refund terms. The licensing
   question is not a gate: the author decided to sell on the best guess (G9).
5. The author has signed off the Chinese text.

**In the Stripe sandbox, then again in live mode:**

6. Turn off "Edit payout schedule" and "Manual payouts" for the Express
   dashboard. In live mode, email every teacher 30 days before (G15).
7. Open a class payment page and check that its payment methods are Card
   and PayNow and no other. Apple Pay and Link buttons may show above them.
8. Subscribe the webhook endpoint to the four new event types.
9. In the sandbox only: take one test account through the liveness check and
   test a payout for part of its balance, and a failed payout.

**Deploying:**

10. One migration, additive: new columns, new tables, new indexes and one new
    enum value, `class_status = 'cancelled'`. Part 1's version reads `classes`
    and would show that value as text on its English Teach pages.
11. Apply Terraform, which adds the release task definition, the schedule in a
    disabled state, its role and queue, the alarms and the email topic. Copy
    the GitHub variables.
12. Deploy with `CLASS_SALES` off. The deploy registers the release task and
    points the schedule at it. Enable the schedule. With no profile opted in,
    a run does nothing and finishes.
13. On staging, opt one profile in and rehearse every journey in this
    document.
14. In production, turn `CLASSES` and `CLASS_SALES` on and invite the beta
    profiles.

**What can be rolled back, and what cannot:**

- **Selling** is switched off with `CLASS_SALES=false`: no new seat is sold,
  and everything already sold keeps working.
- **The release job cannot be switched off** while any profile is opted in.
  Disabling the schedule stops every refund, and every payout to an opted-in
  profile. The alarm fires after 30 minutes.
- **A fault in the job's code** is answered by pointing the schedule back at
  the previous version of the release task, which the deploy keeps, or by
  fixing forward. The API service can be on a different version from the job.
- **The API's code** can be rolled back to Part 1's version only after
  `CLASS_SALES` has been off for 35 minutes, so that no reservation is open.
  The job stays on a version that has the release program. No version older
  than Part 1's may be deployed.
- **An opted-in profile leaves manual payouts only by giving notice** (G16),
  and the job finishes the leave once nothing of the profile is held; so the
  job must keep running while any profile is opted in or leaving. If the job
  cannot run for more than a day, an engineer starts the
  release task by hand, the way the migrate task is started. Paying a profile
  from the Stripe dashboard is the last resort, and a Support admin then
  records it as a correction. `infra/README.md` gets both procedures.

## Additional Resources

- [Scheduled classes RFC](./scheduled-classes-brief.md), sections
  "Second review" and "Checks made after the second review": the money
  findings and the Stripe and consumer-rule checks this design starts from.
- [Part 1 design](./scheduled-classes-attendance.md): the class and
  attendance records, the roles and the restricted database user.
- [The review of the first version](./reviews/scheduled-classes-selling/consolidated_review_report.md),
  [the Stripe test session](./reviews/scheduled-classes-selling/stripe_sandbox_results.md)
  and [the author's decisions](./reviews/scheduled-classes-selling/author_decisions.md).
- [ADR 003: payments](../adr/003-payments-destination-charges.md) and
  [ADR 007: payout accounts](../adr/007-payout-accounts.md): the payment
  model this design extends.
- [ADR 010: locale resolution](../adr/010-locale-resolution-and-email-language.md):
  the language of learner emails and how errors are worded from codes.
- [Infrastructure notes](../../infra/README.md): one-off tasks and the deploy.
- Stripe documentation read on 2026-11-24, with the page for each answer, is
  listed in the test session's results.

## Future Improvements

- **Grant money**: a second amount per seat, and a release that waits for it.
- **A notice of a changed venue**, with Part 3's change notices.
- **A cap or a review** on cancelling a class after it has started, if the
  beta shows the pattern the author accepted.
- **Disputes of a refund decision** by a learner.
- **Release by block** for classes longer than about ten weeks, which this
  design cannot sell.
- **A joining-details field** for remote classes, if Part 3's class page is
  late.
- **A page that tells someone at once**, in place of an email, when the job
  stops.

---

## Detailed Implementation Plan

**Prerequisite.** Part 1 is built in full: all seven phases of
[its plan](./scheduled-classes-attendance.md). This plan extends files that
Part 1 creates, and names them as they are in that plan. Only Part 1's Phase 1
exists in the repository today, so those names could not be checked against
code.

**What is already known about Stripe.** The calls this plan depends on were
run in a test account on 2026-11-24. The results are in
[stripe_sandbox_results.md](./reviews/scheduled-classes-selling/stripe_sandbox_results.md).
PayNow was tested there on 2026-11-25: the payment page, the three refund
kinds, Stripe's fee and an expired payment page. A refund after a won bank
dispute, and a payment page with the Link button turned off, were tested the
same day. One more test is needed before Phase 5 is merged: a payout for
part of a balance, and a failed payout, on a connected account that a person
has taken through Singapore's liveness check. The implementer adds the
results to that file. If a part payout is refused, stop and ask the author.

**The work.** Six small changes come first, each its own pull request. Then
ten phases, in build order.

| Phases  | End with                                              |
| ------- | ----------------------------------------------------- |
| 1 to 6  | `npx turbo run typecheck test` passing                |
| 7 and 8 | `npx turbo run typecheck build` passing               |
| 9       | Terraform and the workflow validated; nothing applied |
| 10      | `npm run lint` passing                                |

A local walkthrough follows Phase 8. The rollout to staging follows Phase 10
and needs the author's go-ahead.

Each entry is one file unless its heading says otherwise. Entries name the
function to change; line numbers move.

### Shared definitions used by the entries

**Terms.**

- **Payment page**: Stripe's hosted checkout session. **Its metadata**: the
  session's `metadata`, which the API also copies to the payment.
- **End a reservation**: set `seat_reserved_until` to now. The status stays
  `pending_payment`.
- **Seat refund row**: a row in `seat_refunds`. **Ledger row**: a row in the
  existing `refunds` table, one per Stripe refund id.
- **Label**: a key in the `metadata` of a Stripe refund, fee refund, reversal
  or payout. Seat refunds use `seat_refund_id`; payouts use `payout_id`.
- **Unfinished**: a seat refund row whose status is `waiting`, `pending`,
  `refund_sent` or `failed`.
- **Support admin**: a user with the `super_admin` role.

**Values.**

| Field                                   | Values                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `seat_refunds.kind`                     | `teacher_cancelled`, `teacher_cancelled_part`, `changed_withdrew`, `learner_withdrew`, `discretionary`, `elevate_cancelled`, `seat_lost`, `dispute_lost`                                                                                                                                         |
| `seat_refunds.status`                   | `waiting`, `pending`, `refund_sent`, `done`, `closed`, `failed`                                                                                                                                                                                                                                  |
| `seat_refunds.waiting_for`              | `manual_mark`, `bank_dispute`, `stripe_fee`                                                                                                                                                                                                                                                      |
| `seat_refunds.closed_reason`            | `mark_settled`, `bank_returned`, `support`                                                                                                                                                                                                                                                       |
| `class_cancellations.elevate_reason`    | `teacher_absent`, `venue_unavailable`, `rules_breach`, `profile_suspended`, `required_by_law`                                                                                                                                                                                                    |
| `payouts.outcome`                       | `paid`, `below_minimum`, `nothing_payable`, `failed`                                                                                                                                                                                                                                             |
| `payouts.send_status`                   | `sending`, `sent`; null unless the outcome is `paid`                                                                                                                                                                                                                                             |
| `payouts.payout_status`                 | `pending`, `paid`, `failed`                                                                                                                                                                                                                                                                      |
| `payout_accounts.payout_mode`           | `automatic`, `switching`, `manual`                                                                                                                                                                                                                                                               |
| `payout_adjustments.kind`               | `opening_available`, `opening_pending`, `refund_after_payout`, `bank_dispute_after_payout`, `correction`                                                                                                                                                                                         |
| `payments.bank_dispute_status`          | `open`, `won`, `lost`                                                                                                                                                                                                                                                                            |
| `classes.release_reason`                | `due`, `support`                                                                                                                                                                                                                                                                                 |
| `payments.release_reason`               | `due`, `support`, `day_limit`                                                                                                                                                                                                                                                                    |
| `class_status` (one value added)        | `draft`, `published`, `cancelled`                                                                                                                                                                                                                                                                |
| Not-on-sale reasons                     | `sales_off`, `not_published`, `cancelled`, `started`, `too_far_ahead`, `profile_not_opted_in`, `profile_leaving`, `account_not_payable`, `course_not_on_sale`                                                                                                                                    |
| Move problems                           | `attended`, `open_mark`, `refund_in_progress`, `bank_dispute_open`, `different_course`, `target_not_published`, `target_started`, `target_full`, `beyond_limit`, `already_in_target`                                                                                                             |
| The enrollment outcome of `applyRefund` | `refunded`, `cancelled`, `unchanged`                                                                                                                                                                                                                                                             |
| `FulfilmentOutcome` (one value added)   | `seat_lost`                                                                                                                                                                                                                                                                                      |
| Audit actions                           | `class_sales.accepted`, `class.cancelled`, `class.cancelled_by_elevate`, `class.learner_moved`, `class.times_changed`, `seat.withdrawn`, `seat.refund_requested`, `seat.refund_done`, `seat.refund_retried`, `seat.refund_closed`, `class.review_cleared`, `payout.created`, `payout.correction` |

**Constants**, in a new `packages/core/src/domain/class-sales.ts`:

| Name                          | Value                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `SEAT_RESERVATION_MS`         | 35 minutes                                                                            |
| `MAX_RESERVATIONS`            | 3, in `RESERVATION_WINDOW_MS` of 24 hours                                             |
| `WITHDRAWAL_CLOSES_BEFORE_MS` | 7 days before the first block starts                                                  |
| `RELEASE_AFTER_MS`            | 7 days after the last block ends, or after cancellation                               |
| `SEAT_HORIZON_MS`             | 75 days. A sale counts from now; a move and a time edit count from the seat's payment |
| `MAX_HELD_MS`                 | 85 days from the payment                                                              |
| `MIN_PAYOUT_CENTS`            | 100                                                                                   |
| `PAYOUT_TIME_ZONE`            | `Asia/Singapore`                                                                      |
| `PAY_FROM_HOUR`               | 10: paying happens in the first run at or after 10:00 in that zone                    |
| `SWITCHING_STALE_MS`          | 5 minutes: the job finishes an opt-in left at `switching` for longer                  |
| `REFUND_MAX_ATTEMPTS`         | 96                                                                                    |
| `IDEMPOTENCY_TRUST_MS`        | 23 hours: past this age a step is looked up at Stripe before it is repeated           |
| `CLASS_SALES_TERMS_VERSION`   | `2026-12`                                                                             |
| `CLASS_PAYMENT_METHODS`       | `card` and `paynow`: the methods a class payment page allows                          |
| `REFUND_TERMS_VERSION`        | `2026-12`                                                                             |

`DISPUTE_WINDOW_MS`, 7 days, is Part 1's and stays in `attendance.ts`.

**Learner-facing errors.** Each is added to `USER_ERROR_CODES` with an English
and a Chinese message, and thrown with `new HttpError(status, code, message,
details)`.

| Condition                                                                       | Status | Code                     | Details        | English message                                                           |
| ------------------------------------------------------------------------------- | ------ | ------------------------ | -------------- | ------------------------------------------------------------------------- |
| `classOnSale` returns a reason                                                  | 409    | `class_not_on_sale`      | `reason`       | "This class is not open for booking."                                     |
| No seat left                                                                    | 409    | `class_full`             | none           | "This class is full."                                                     |
| The learner already has an active seat in this class                            | 409    | `already_in_class`       | `enrollmentId` | "You already have a seat in this class."                                  |
| The learner is the profile's owner or a member                                  | 403    | `own_class`              | none           | "You cannot book a seat in a class you teach or manage."                  |
| A promo code makes the price zero                                               | 422    | `class_requires_payment` | none           | "This code cannot be used on a class."                                    |
| The price is above zero and under the minimum charge                            | 422    | `below_minimum`          | existing       | existing                                                                  |
| The terms version sent is not the current one                                   | 409    | `terms_changed`          | `current`      | "The refund terms have changed. Reload this page to read them."           |
| A fourth reservation of one class in 24 hours                                   | 429    | `too_many_reservations`  | `retryAt`      | "You have started paying for this class too many times. Try again later." |
| Withdrawal less than 7 days before the first block, with no changed-class right | 409    | `withdrawal_closed`      | `closesAt`     | "Withdrawal has closed for this class. Contact the teacher."              |
| Withdrawal by a learner who is counted as attended or has an open manual mark   | 409    | `withdrawal_attended`    | none           | "You have attended this class, so a refund is the teacher's decision."    |
| Withdrawal from a cancelled class                                               | 409    | `class_cancelled`        | none           | "This class was cancelled. Your refund is handled with the cancellation." |
| Withdrawal while the seat has an unfinished seat refund row                     | 409    | `refund_in_progress`     | none           | "A refund for this seat is already on its way."                           |
| Withdrawal of a seat that is not the learner's or not active                    | 404    | `not_found`              | none           | existing                                                                  |

**Teach and Support errors.** English only; thrown with `errors.conflict`,
`errors.unprocessable` or `errors.forbidden`. A row with details uses
`new HttpError`.

| Condition                                                                                  | Status | Code                      | Details        |
| ------------------------------------------------------------------------------------------ | ------ | ------------------------- | -------------- |
| Opt-in when the payout account is not payable                                              | 409    | `not_payable`             | none           |
| Opt-in with a terms version that is not the current one                                    | 422    | `terms_version`           | `current`      |
| Opt-in by a profile that has already opted in                                              | 409    | `already_opted_in`        | none           |
| Notice to leave from a profile that has not opted in, or has already given notice          | 409    | `not_opted_in`            | none           |
| Cancelling a class that is a draft                                                         | 409    | `class_not_published`     | none           |
| Publishing, editing, deleting, re-assigning, cancelling or moving out of a cancelled class | 409    | `class_cancelled`         | none           |
| The profile cancelling, moving out of, or refunding a seat in, a released class or payment | 409    | `class_released`          | none           |
| A move that fails a rule                                                                   | 422    | `move_not_allowed`        | `problems`     |
| A discretionary refund for more than the learner paid and has not had back                 | 422    | `refund_too_large`        | `maxCents`     |
| A discretionary refund or a move on a seat that is not active                              | 409    | `seat_not_active`         | none           |
| A discretionary refund, a move or Support's refund on a seat with an unfinished row        | 409    | `refund_in_progress`      | none           |
| A discretionary refund on a seat whose payment has an open bank dispute                    | 409    | `bank_dispute_open`       | none           |
| A withdrawal, a move or a refund on a seat that has no payment                             | 409    | `seat_has_no_payment`     | none           |
| A time edit that would end the class more than `SEAT_HORIZON_MS` after a seat's payment    | 422    | `class_too_late_for_seat` | `latestEndsAt` |
| A capacity below the number of seats taken                                                 | 422    | `capacity_below_taken`    | `taken`        |
| Clearing a review on a class that is not under review                                      | 409    | `review_not_needed`       | none           |
| Retrying or closing a seat refund row that is not `failed`                                 | 409    | `refund_not_failed`       | none           |

"Unfinished rows count as had back": `refund_too_large` and
`canRefundUpToCents` subtract the amounts of ledger rows and the requested
amount of any unfinished seat refund row.

**Emails.** Learner emails are built with `simpleEmail` from keys in the
`email` message area, in the learner's account language. Emails to a profile's
owner are English literals.

| Key prefix                       | Sent when                                                                                                                       | To            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `email.classReceipt.*`           | A class payment gets a seat                                                                                                     | Learner       |
| `email.seatLost.*`               | A `seat_lost` row is done                                                                                                       | Learner       |
| `email.classCancelled.*`         | A `teacher_cancelled`, `teacher_cancelled_part` or `elevate_cancelled` row is done, with the amount                             | Learner       |
| `email.classCancelledAttended.*` | A class is cancelled after every block started and the learner is counted as attended; or their row is closed as `mark_settled` | Learner       |
| `email.classCancelledMarkOpen.*` | A class is cancelled and the learner has an open manual mark                                                                    | Learner       |
| `email.seatWithdrawn.*`          | A `learner_withdrew` or `changed_withdrew` row is done                                                                          | Learner       |
| `email.seatRefunded.*`           | A `discretionary` row is done                                                                                                   | Learner       |
| `email.seatMoved.*`              | A learner is moved                                                                                                              | Learner       |
| `email.classTimesChanged.*`      | A block's time is changed in a class where the learner has a seat                                                               | Learner       |
| `email.manualMark.*`             | The learner is marked present by hand                                                                                           | Learner       |
| English literals                 | Any seat refund row is done; a payout fails at Stripe or at the bank; Elevate cancels a class; a leave is finished              | Profile owner |

### Before Phase 1: six changes that ship on their own

Each is one pull request, deployed and checked before the next phase that
needs it. P.1 and P.2 are needed before Phase 4. P.3 to P.6 are needed before
a real learner checks in. P.5 and P.6 change files that Part 1 creates.

**Built on 2026-11-25**, in the working tree, after Part 1 was committed.
Lint, typecheck, every build and every test pass (API: 42 files, 405
tests). Each of P.1 and P.2 was checked to work with the other reverted.
Not run: the sandbox checks against real Stripe for P.1 and P.2, because no
API key is available here; equivalent tests run against the fake provider.

**As built.** Where the build found an entry wrong or silent:

- **P.1:** `listRefunds` also returns each refund's status, and a refund
  that is `failed` or `canceled` is not recorded, as Stripe's refunded total
  leaves it out. When Stripe's notice records a refund before Support's
  action does, it takes the reason from the refund's `elevateReason`
  metadata and the requester from `actorId`, so the row and the email are
  the same whichever records it first. `refundedCents` is the sum of the
  payment's ledger rows and is no longer capped at the amount, so a double
  count would show; rows recorded twice before this change are not
  repaired. A handler run that records nothing new writes no audit row.
- **P.2:** `record` answers `new`, `retry` or `duplicate`; Stripe events are
  handled on `new` and `retry`, Mux events only on `new`. `receivedAt` is
  written from `deps.now()`, the clock `markProcessed` uses. A retry does
  not claim the event, so two redeliveries at once could both run the
  handler; every handler is tested to leave the same rows when run twice.
- **P.3:** Done as written; the comment above the setting says why.
- **P.4:** Done as written, with a comment on the limiter.
- **P.5:** The restricted role may delete from `attendance_event_locations`,
  so the API runs the erase itself: `POST
  /support/learners/:userId/erase-coordinates`, for `super_admin`, with a
  reason. It deletes the learner's location rows in every class, and the
  delete and its audit entry share one transaction. An unknown learner
  answers 404; an erase that finds nothing is still recorded, with 0. The
  route is not behind `CLASSES`, so a request can be met either way.
  `class-guards.test.ts` allows this one delete and no other; `AGENTS.md`
  names it.
- **P.6:** `supportBlock` takes the viewing user and writes a
  `coordinates.viewed` entry only when the answer holds coordinates. The
  entry also records the learners whose coordinates were shown.

#### P.1 One ledger row per Stripe refund (Modify five, in `apps/api`)

- **Change:**
  - `src/providers/payments/types.ts`, `stripe.ts` and `fake.ts`: add
    `listRefunds(chargeId)`, returning each refund's id, amount and metadata.
    The fake's `refundedEvent` carries real refund ids.
  - `src/services/transactions.service.ts`: `applyChargeRefunded` calls
    `listRefunds` and calls `applyRefund` once for each refund id that has no
    ledger row, in place of working out a difference and a made-up id.
    `applyRefund` sets `refundedCents` to the sum of the payment's ledger
    rows, inside its locked transaction. `refund`, Support's action, passes
    the idempotency key `support-refund:<paymentId>`.
  - `test/transactions.test.ts` or the file that holds the refund tests today:
    a Support refund followed by Stripe's notice of it leaves one ledger row
    and sends one email; a dashboard refund leaves one row.
- **Why:** Today the action and Stripe's notice can record one refund under
  two ids. A cap hides it for a full refund. Phase 4 makes part refunds
  routine, where it would double the refunded total.
- **Check on self-paced sales:** in the sandbox, one Support refund and one
  dashboard refund, each leaving one row and one email.
- **Rollback:** revert the commit. There is no schema change.

#### P.2 A failed webhook event is handled again (Modify three, in `apps/api`)

- **Change:**
  - `src/services/webhooks.service.ts`: `record` returns `'new'`, `'retry'` or
    `'duplicate'`. It returns `'retry'` when the stored row has an error, or
    has no `processed_at` and was received more than 5 minutes ago.
  - `src/routes/webhooks.ts`: the Stripe route dispatches on `'new'` and
    `'retry'`. The Mux route dispatches only when the result is exactly
    `'new'`, so its behaviour does not change.
  - `test/webhooks-stripe.test.ts`: a failed event is handled again on
    redelivery; a handled one is answered as a duplicate; each of the four
    existing Stripe handlers, run twice on one event, leaves the same rows.
- **Why:** Today an event whose handler failed is never handled again, because
  Stripe's redelivery is treated as a duplicate. Phase 5 depends on bank
  dispute and payout events arriving.
- **Check on self-paced sales:** in the sandbox, a payment whose first webhook
  is made to fail is fulfilled when Stripe redelivers.
- **Rollback:** revert the commit.

#### P.3 `infra/terraform/envs/production/main.tf` (Modify)

- **Change:** `db_backup_retention_days` from 7 to 35.
- **Why:** Attendance and payment records of real learners need a longer
  window to restore from. 35 days is the longest RDS keeps automated backups.
- **Check:** `plan` shows that one change.

#### P.4 `apps/api/src/routes/auth.ts` and a new `apps/api/test/sign-in-limit.test.ts`

- **Change:** The limiter on `POST /magic-link` goes from 30 to 300 requests
  per network address in 15 minutes. Nothing else changes: `AuthService`
  already refuses a sixth request per email address in 15 minutes, counted in
  the database, and `auth.test.ts` covers it. The new test: 40 different
  emails from one address succeed.
- **Why:** A class signing in on one venue network would exhaust a limit of 30.

#### P.5 A recorded step that erases one learner's coordinates (Modify five, create one)

- **Change:**
  - `packages/core/src/contracts/classes.ts`: `eraseCoordinatesSchema`
    (`reason`, 3 to 500 characters) and the response `{ erased: number }`.
  - `apps/api/src/services/attendance.service.ts`: `eraseCoordinates(user,
    learnerUserId, input)` deletes the learner's rows from
    `attendance_event_locations` and writes a `coordinates.erased` audit entry
    with the count and the reason.
  - `apps/api/src/routes/support.ts`: `POST
    /learners/:userId/erase-coordinates`, with `requireRole('super_admin')`.
  - `apps/support/src/lib/queries.ts` and `apps/support/src/routes/person.tsx`:
    "Erase location data" for a Support admin, with a reason, showing the
    count erased.
  - `apps/api/test/class-guards.test.ts` and `support-classes.test.ts`:
    `attendance.service.ts` may delete from `attendanceEventLocations` and no
    other file may; an erasure removes the rows, leaves the events, writes the
    audit entry, and the block view then shows `'erased'`.
  - `docs/runbooks/erase-coordinates.md` (Create): the steps, and that
    database backups keep the rows for up to 35 days after an erasure.
- **Why:** A privacy request must be met through a step that leaves a record
  and does not touch an attendance row.

#### P.6 `apps/api/src/services/attendance.service.ts` and `apps/api/test/support-classes.test.ts` (Modify)

- **Change:** In `supportBlock`, write a `coordinates.viewed` audit entry
  naming the class and block when the answer contains any coordinates. The
  test: each such view writes one entry; a view with no coordinates writes
  none.
- **Why:** Who looked at a learner's location must be known.

### Phase 1: Database and shared logic

**Built on 2026-11-25**, in the working tree. Across the repository, lint,
typecheck, every build and 799 tests pass, with the API's tests running
against the new migration as `elevate_api`. On a throwaway Postgres the
migration applied, the grants were re-applied, `elevate_api` could read
`self_paced_enrollments` and the new tables, and an update to
`attendance_events` was still refused.

**As built.** Where the build found an entry wrong or silent:

- **Made optional for Phase 1; the phase that fills it makes it required:**
  `ClassDetail.notOnSaleReason`, `cancelReason`, `cancelledAt`,
  `seatsTaken`, `seatsWithChangeRight`; `LearnerClass.seat`;
  `CoursePublicView.classes`, `viewerClassSeats`; `EarningsView.heldCents`,
  `heldClasses`, `payouts`, `debtCents`. The API builds these types today, so
  a required field would fail its build until a later phase fills it.
- **1.1, 1.5:** `elevateCancelReasonEnum` is added as a Postgres enum, which
  1.1 did not list. The value lists live in core, and each database enum is
  checked against its list with `satisfies`.
- **1.7:** The migration is generated and not edited. It is additive except
  that Drizzle drops and recreates the `self_paced_enrollments` view, because
  `enrollments` gains columns; no data is involved, and the migration task
  re-applies the grants. `ALTER TYPE class_status ADD VALUE 'cancelled'` is
  in the same migration and nothing there uses the value.
- **1.9:** For refund rows with no recorded fee refund,
  `profileShareAfterRefunds` returns the fee as `R − round(R × N ÷ A)`,
  taken over the rows together, which matches today's `netAfterRefunds` to
  the cent; the plan's form differs by a cent on half-cent ties. For
  `dispute_lost`, `seatRefund` returns R and X as 0 with `reversalCents` as
  what is left. It throws on a discretionary refund with no amount, and on a
  part refund with bad block counts.
- **1.10:** `moneyAttendance` takes events by block. A mark that was
  disputed and then upheld does not count, as the word list says.
- **1.11:** `classOnSale` answers `not_published` for a draft or a class with
  no blocks, and `cancelled` for a cancelled class; a payout account that is
  `switching` or missing counts as `profile_not_opted_in`; "course on sale"
  means its status is `live`. `withdrawal` can also answer
  `seat_has_no_payment`, and a helper, `withdrawalClosesAt`, is added.
  `canMove` treats a cancelled target as `target_not_published`. The release
  waits for an open mark until one millisecond after its deadline.
- **1.14:** `ClassStatus` gains `cancelled`, so the Teach class list's status
  map gains a "Cancelled" entry, the one change outside `packages/`.
  `netAfterRefunds` is in `apps/api/src/services/earnings.service.ts`, not in
  core, so the test compares against a copy of it.
- **1.16:** `class_cancelled` and `refund_in_progress` serve as both learner
  and Teach codes.
- **1.17:** The Chinese text of the new messages needs the author's
  sign-off.
- **For later phases:** `payments.classId` is a new column beside
  `enrollments.classId`, and `class-guards.test.ts` must change on purpose
  when checkout writes it. Text status columns such as `waitingFor`,
  `releaseReason` and `bankDisputeStatus` must be narrowed to core's unions.
  `CheckoutSyncResponse` gains `seat_lost`, which the learner's success page
  reads as still pending until Phase 6.

**Ends with:** `npx turbo run typecheck test` passing, with the existing suites
unchanged.

#### 1.1 `packages/db/src/schema/enums.ts` (Modify)

- **Change:** Add `cancelled` to `classStatusEnum`. Add `seatRefundKindEnum`,
  `seatRefundStatusEnum`, `payoutOutcomeEnum`, `payoutModeEnum` and
  `payoutAdjustmentKindEnum`, with the values above. The other fields in the
  values table are `text`.
- **Why:** The new columns and tables use them.

#### 1.2 `packages/db/src/schema/commerce.ts` (Modify)

- **Change:** All new columns are nullable unless a default is given.
  - `enrollments`: `seatReservedUntil` (timestamp), `reservationCount`
    (integer, not null, default 0), `reservationCountSince` (timestamp),
    `refundTermsVersion` (text), `movedAt`, `movedBy` (users, set null),
    `movedFromClassId` (classes, restrict, written with `(): AnyPgColumn`),
    `classChangedAt`. Add an index on (`classId`, `status`).
  - `payments`: `classId` (classes, restrict, written with `(): AnyPgColumn`),
    `releasedRunId` (payout runs, restrict, written with `(): AnyPgColumn`),
    `releasedAt`, `releaseReason` (text), `bankDisputeId` (text),
    `bankDisputeStatus` (text), `bankDisputedAt`, `payoutId` (payouts,
    restrict, written with `(): AnyPgColumn`), `paidOutCents` (integer). Add
    indexes on `classId` and on (`payoutAccountId`, `payoutId`).
  - `refunds`: `applicationFeeRefundedCents` (integer) and `seatRefundId`
    (seat refunds, restrict, written with `(): AnyPgColumn`). A null
    `applicationFeeRefundedCents` means the refund was made before this
    change, with Elevate's fee returned in proportion.
- **Why:** The reservation, the record of a move and of a changed class, the
  release and payout marks, the bank dispute, and the fee refund that the
  share function reads.

#### 1.3 `packages/db/src/schema/classes.ts` (Modify)

- **Change:** `classes`: add, all nullable, `cancelledAt`, `cancelledBy`
  (users, set null), `cancelReason`, `releasedRunId` (payout runs, restrict,
  written with `(): AnyPgColumn`), `releasedAt`, `releaseReason` (text),
  `reviewNeededAt`, `reviewClearedAt`, `reviewClearedBy` (users, set null) and
  `reviewNote`.
- **Why:** A class's cancellation and its release are states of the class.

#### 1.4 `packages/db/src/schema/profiles.ts` (Modify)

- **Change:** `profiles`: add, all nullable, `classSalesAcceptedAt`,
  `classSalesAcceptedBy` (users, set null) and `classSalesTermsVersion`.
  `payoutAccounts`: add `payoutMode` (not null, default `automatic`),
  `manualSince`, `leaveRequestedAt` and `leaveOn` (timestamps, nullable).
- **Why:** The record of opting in, which accounts the job pays, and the
  moment that separates the opening amounts from later payments.

#### 1.5 `packages/db/src/schema/payouts.ts` (Create)

- **Change:** Declare five tables. Every `id` is `id()`. "Restrict" and "set
  null" are the delete rules.

  `seatRefunds`:

  | Column                                          | Type                   | Null | Notes                                                         |
  | ----------------------------------------------- | ---------------------- | ---- | ------------------------------------------------------------- |
  | `enrollmentId`, `paymentId`, `classId`          | uuid                   | No   | Restrict.                                                     |
  | `kind`                                          | `seatRefundKindEnum`   | No   |                                                               |
  | `status`                                        | `seatRefundStatusEnum` | No   | Default `pending`.                                            |
  | `waitingFor`, `closedReason`                    | text                   | Yes  |                                                               |
  | `requestedCents`                                | integer                | Yes  | Set for `discretionary` only.                                 |
  | `learnerRefundCents`, `feeRefundToProfileCents` | integer                | Yes  | Null until the job first sends the row.                       |
  | `stripeRefundId`                                | text                   | Yes  | Unique.                                                       |
  | `stripeFeeRefundId`, `stripeReversalId`         | text                   | Yes  | The reversal id is set for `dispute_lost` only.               |
  | `attempts`                                      | integer                | No   | Default 0.                                                    |
  | `firstAttemptAt`, `completedAt`                 | timestamp              | Yes  | `completedAt` is set when the row becomes `done` or `closed`. |
  | `error`, `reason`                               | text                   | Yes  | `reason` is null for `seat_lost` and `dispute_lost`.          |
  | `cancellationId`                                | uuid                   | Yes  | Class cancellations, restrict.                                |
  | `requestedBy`                                   | uuid                   | Yes  | Users, set null. Null for rows the system writes.             |
  | `createdAt`                                     | `createdAt()`          | No   |                                                               |

  Indexes: `status`; `paymentId`; `cancellationId`; a unique index on
  `enrollmentId` where the status is one of the four unfinished values; a
  unique index on `paymentId` where the kind is `dispute_lost`.

  `classCancellations`: `classId` (uuid, not null, restrict, unique),
  `cancelledBy` (users, set null), `byElevate` (boolean, not null), `reason`
  (text, not null), `elevateReason` (`elevateCancelReasonEnum`, nullable),
  `afterStart` (boolean, not null), `blocksTotal` and `blocksUntaught`
  (integers, not null), `createdAt`, `completedAt` (nullable). `completedAt` is set by `cancelClass` when it
  writes no rows, and otherwise by the sender when the last row of the
  cancellation becomes `done` or `closed`.

  `payoutRuns`: `startedAt` (not null, default now), `finishedAt` (nullable),
  `error` (nullable), and four integer counts, not null, default 0:
  `refundsSent`, `classesReleased`, `payoutsCreated`, `needingAttention`.

  `payouts`:

  | Column                                                                                    | Type                | Null | Notes                             |
  | ----------------------------------------------------------------------------------------- | ------------------- | ---- | --------------------------------- |
  | `runId`                                                                                   | uuid                | No   | Payout runs, restrict.            |
  | `payoutAccountId`                                                                         | uuid                | No   | Restrict.                         |
  | `payDate`                                                                                 | date                | No   | The day in `PAYOUT_TIME_ZONE`.    |
  | `availableCents`, `pendingCents`, `heldCents`, `limitCents`, `namedCents`, `unnamedCents` | integer             | No   | What the run read and worked out. |
  | `amountCents`                                                                             | integer             | No   | Default 0.                        |
  | `outcome`                                                                                 | `payoutOutcomeEnum` | No   |                                   |
  | `sendStatus`, `payoutStatus`, `error`                                                     | text                | Yes  |                                   |
  | `stripePayoutId`                                                                          | text                | Yes  | Unique.                           |
  | `createdAt`                                                                               | `createdAt()`       | No   |                                   |

  A unique index on (`payoutAccountId`, `payDate`).

  `payoutAdjustments`: `payoutAccountId` (not null, restrict), `kind`
  (`payoutAdjustmentKindEnum`, not null), `amountCents` (integer, not null,
  signed), `paymentId` (payments, restrict, nullable), `refundId` (refunds,
  restrict, nullable), `reason` (text, nullable), `createdBy` (users, set
  null, nullable), `createdAt`, `payoutId` (payouts, restrict, nullable).
  Indexes: (`payoutAccountId`, `payoutId`); a unique index on `refundId` where
  it is not null; a unique index on `paymentId` where the kind is
  `bank_dispute_after_payout`.

- **Why:** One file for the records the money flow adds. The unique indexes
  are what stop a second refund row for one seat, a second `dispute_lost` row
  when Stripe redelivers an event, and a second adjustment for one refund.

#### 1.6 `packages/db/src/schema/index.ts` and `packages/db/src/schema/relations.ts` (Modify)

- **Change:** `index.ts`: export `./payouts`. `relations.ts`: add the five
  tables to `tables`, and relations from a seat refund to its enrollment,
  payment, class and cancellation; from a cancellation to its class and seat
  refunds; from a payout to its run, its payout account, its payments and its
  adjustments; from a payment to its class, its release run, its payout and
  its seat refunds; from a class to its cancellation; from a ledger row to its
  seat refund.
- **Why:** `db.query.*` reads relations from the one `defineRelations` call.

#### 1.7 `packages/db/drizzle/<timestamp>_class_sales/` (Create, generated)

- **Change:** Run `npm run db:generate -- --name class_sales`. Read the SQL and
  confirm it only adds: columns, tables, indexes, enum types and the one enum
  value. If it drops or alters anything else, change the schema and generate
  again.
- **Why:** Migrations are generated, never written by hand.

#### 1.8 `packages/db/src/roles.ts` (Modify)

- **Change:** No statement changes. Add a comment that the five new tables are
  ordinary tables for the API's user, and that only `attendance_events` and
  `attendance_event_locations` are restricted.
- **Why:** Part 1's default privileges already cover new tables; saying so
  stops a later reader adding a grant.

#### 1.9 `packages/core/src/domain/money.ts` (Modify)

- **Change:** Add two functions and their types.

  `seatRefund(input)`. Input: `kind`; `amountCents` (A); `applicationFeeCents`
  (C + E); `stripeFeeCents` (F, required: a caller with no fee waits);
  `refundedCents`, the total of R in the payment's ledger rows;
  `feeRefundedCents`, the total of X in them; `requestedCents` for
  `discretionary`; and `blocksUntaught` and `blocksTotal` for
  `teacher_cancelled_part`. Let K be `applicationFeeCents − stripeFeeCents`, or 0 if
  that is negative, and let "left" be `amountCents − refundedCents`.

  | Kind                                    | `learnerRefundCents` (R)                                            | `feeRefundToProfileCents` (X)                             |
  | --------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
  | `teacher_cancelled`, `changed_withdrew` | left                                                                | K − `feeRefundedCents`                                    |
  | `learner_withdrew`                      | left − F                                                            | K − `feeRefundedCents`                                    |
  | `discretionary`                         | `requestedCents`                                                    | floor(K × (`refundedCents` + R) ÷ A) − `feeRefundedCents` |
  | `teacher_cancelled_part`                | the smaller of floor(A × `blocksUntaught` ÷ `blocksTotal`) and left | as `discretionary`                                        |
  | `elevate_cancelled`, `seat_lost`        | left                                                                | `applicationFeeCents` − `feeRefundedCents`                |
  | `dispute_lost`                          | 0                                                                   | Not worked out: Stripe returns the fee with the reversal. |

  Neither output goes below zero. `discretionary` throws when
  `requestedCents` is above "left". For `dispute_lost` the function also
  returns `reversalCents`, equal to "left".

  `profileShareAfterRefunds(input)`. Input: `teacherNetCents` (N),
  `amountCents`, `applicationFeeCents`, the payment's ledger rows as
  `{ amountCents, applicationFeeRefundedCents }[]`, and `bankDisputeLost`.
  It returns 0 when `bankDisputeLost`. Otherwise N, less the total of the
  rows' amounts, plus the total of their fee refunds. For a row whose fee
  refund is null it uses `round(applicationFeeCents × amount ÷ amountCents)`,
  which is what today's full refund returns. The result can be below zero.

- **Why:** AGENTS.md requires the only fee computation to live in this file.
  Every payout, the held total and the earnings page depend on the second
  function, and the existing `netAfterRefunds` gives the wrong amount for a
  withdrawal and for a cancelled seat.

#### 1.10 `packages/core/src/domain/attendance.ts` (Modify)

- **Change:** Add `moneyAttendance(eventsByBlock, now)`, built on
  `attendanceState` and the manual mark sub-state. It returns `{ counted,
  openMarkUntil }`: `counted` is true when any block has a check-in that
  stands or a manual mark whose sub-state is `settled`; `openMarkUntil` is the
  latest dispute deadline among manual marks whose sub-state is `open`, or
  null.
- **Why:** Decision 3's meaning of "counted as attended" is a rule on Part 1's
  events, so it sits beside Part 1's state function and uses its sub-states.

#### 1.11 `packages/core/src/domain/class-sales.ts` (Create)

- **Change:** The constants above, and these pure functions:
  - `classOnSale({ class, blocks, profile, payoutAccount, course,
    salesEnabled, now })` returns `true` or one not-on-sale reason, tested in
    the order of the values table.
  - `seatsLeft(capacity, taken)`.
  - `reservationAllowed({ count, since, now })` returns `true`, or the time a
    new reservation becomes allowed.
  - `fulfilmentDecision({ classCancelled, reservedUntil, seatFree,
    firstBlockStartsAt, paidAt, now })` returns `'seat'` or `'seat_lost'`, by
    the table under "Fulfilment".
  - `withdrawal({ enrollmentStatus, classCancelled, hasUnfinishedRefund,
    hasPayment, attendance, firstBlockStartsAt, classChangedAt, now })`
    returns the refund kind allowed, or an error code from the learner table.
    `changed_withdrew` wins when both kinds are allowed.
  - `canMove({ ... })` returns `true` or the list of move problems.
  - `isDue({ lastBlockEndsAt, cancelledAt, openMarkUntil,
    cancellationComplete, now })`, and `releaseDueAt` with the same input,
    which returns the date or null while something it waits for has no date.
  - `payoutLimitCents({ availableCents, pendingCents, heldCents })` returns
    `min(availableCents, availableCents + pendingCents − heldCents)`, or 0 if
    that is negative.
  - `choosePayoutItems(items, limitCents)`. Each item has an `amountCents` and
    a `paidAt`. It takes every item below zero; then the others in `paidAt`
    order, each whole, while the total stays within the limit, stopping at the
    first that does not fit. It returns the chosen items, their total,
    `namedCents` (the total of all items) and `unnamedCents` (`limitCents −
    namedCents`, or 0 if that is negative).
  - `payDate(now)` and `isPayTime(now)`, in `PAYOUT_TIME_ZONE`.
- **Why:** The API, the job and the portals must agree on these rules, and
  each is testable without a database.

#### 1.12 `packages/core/src/domain/permissions.ts` (Modify)

- **Change:** Add `class.refund` to `CAPABILITIES`. Owner and manager receive
  it through `ALL` and `MANAGER`. It is not added to `WRITER`, `STAFF` or
  `UNAPPROVED`.
- **Why:** A refund spends the profile's money, so only the roles that already
  manage its money may grant one.

#### 1.13 `packages/core/src/contracts/class-sales.ts` (Create)

- **Change:** Request schemas:
  - `acceptClassSalesSchema`: `termsVersion`.
  - `classCheckoutRequestSchema`: `promoCode?`, `locale?`, as
    `checkoutRequestSchema`, plus `termsVersion`.
  - `cancelClassSchema`: `reason`, 3 to 500 characters.
  - `elevateCancelClassSchema`: `ground`, one of the five grounds under
    "Cancellation by Elevate"; `note`, 3 to 500 characters.
  - `moveSeatSchema`: `toClassId`.
  - `seatRefundRequestSchema`: `amountCents`, a positive integer; `reason`, 3
    to 500.
  - `clearReviewSchema`: `note`, 3 to 500.
  - `refundRowActionSchema`: `action`, `retry` or `close`; `reason`, 3 to 500.
  - `correctionSchema`: `amountCents`, a non-zero integer; `reason`, 3 to 500.

  Response types. A field is nullable only where marked `| null`.
  - `ClassForSale`: `id`, `name`, `delivery`, `venueAddress: string | null`,
    `timeZone`, `blocks: { startsAt, endsAt }[]`, `seatsLeft`,
    `instructorName`.
  - `ViewerClassSeat`: `classId`, `enrollmentId`, `status`.
  - `ClassCheckoutView`: `class: ClassForSale`, `courseSlug`, `courseTitle`,
    `quote` (the fields of `QuoteResponse`), `refundTermsVersion`,
    `stripeFeeBps`, `stripeFixedCents`.
  - `SeatRefundView`: `id`, `kind`, `status`, `waitingFor: string | null`,
    `closedReason: string | null`, `learnerRefundCents: number | null`,
    `reason: string | null`, `createdAt`, `completedAt: string | null`.
  - `SeatView` (Teach): `enrollmentId`, `learner: { displayName, email }`,
    `status`, `paidAt: string | null`, `paidCents`, `refundedCents`,
    `counted`, `openMarkUntil: string | null`, `movedAt: string | null`,
    `classChangedAt: string | null`, `bankDisputeStatus: string | null`,
    `released`, `refunds: SeatRefundView[]`, `canRefundUpToCents`, `canMove`.
  - `MoveTarget`: `classId`, `className`, `firstBlockStartsAt`, `seatsLeft`,
    `problems` (the move problems; empty when the move is allowed).
  - `LearnerSeat`: `withdrawKind: 'learner_withdrew' | 'changed_withdrew' |
    null`, `withdrawRefundCents: number | null` (null until Stripe's fee is
    recorded), `withdrawClosesAt: string | null`, `movedAt: string | null`,
    `classChangedAt: string | null`, `classCancelled`, `refund:
    SeatRefundView | null` (the latest), `openMarks: { blockId, disputeUntil
    }[]`.
  - `HeldClassView`: `classId`, `className`, `heldCents`, `releaseDueAt:
    string | null`, `waitingFor: 'open_marks' | 'cancellation' | 'review' |
    null`.
  - `ProfilePayoutView`: `id`, `payDate`, `amountCents`, `payoutStatus:
    string | null`, `items: { kind, label, amountCents }[]`, where `kind` is
    `payment` or an adjustment kind.
  - `SupportPayoutsOverview`: `lastFinishedAt: string | null`, `stale`;
    `classesUnderReview: { classId, className, profileName, dueAt, heldCents
    }[]`; `refundsNeedingAttention: { id, kind, status, waitingFor, className,
    profileName, error, createdAt }[]`; `openCancellations: { classId,
    className, profileName, afterStart, createdAt, rowsLeft }[]`;
    `dayLimitReleases: { paymentId, className, profileName, releasedAt }[]`;
    `failedPayouts: { payoutId, profileName, payoutAccountId, amountCents,
    error }[]`; `unnamed: { profileName, payoutAccountId, payDate,
    unnamedCents }[]`; `recentRuns: { id, startedAt, finishedAt, error,
    refundsSent, classesReleased, payoutsCreated }[]`.
- **Why:** Routes validate with these and three clients type against them.
  The payout type is named `ProfilePayoutView` because
  `contracts/teach.ts` already exports a `PayoutView`, the payout account
  view.

#### 1.14 `packages/core/src/contracts/classes.ts`, `catalog.ts`, `checkout.ts` and `teach.ts` (Modify)

- **Change:**
  - `classes.ts`: `classStatusSchema` gains `cancelled`. `ClassDetail` gains
    `notOnSaleReason: string | null`, `cancelReason: string | null`,
    `cancelledAt: string | null`, `seatsTaken` and `seatsWithChangeRight` (the
    number of seats a time edit would give the right to). `LearnerClass` gains
    `seat: LearnerSeat`.
  - `catalog.ts`: `CoursePublicView` gains `classes: ClassForSale[]` and a
    top-level `viewerClassSeats: ViewerClassSeat[]`. `viewer` is not changed:
    it stays the self-paced enrollment or null.
  - `checkout.ts`: `CheckoutSyncResponse`'s paid variant gains optional
    `classId`, and the type gains a variant `{ status: 'seat_lost'; classId;
    courseSlug }`. `quoteRequestSchema` is not changed.
  - `teach.ts`: `EarningsView` gains `heldCents`, `heldClasses:
    HeldClassView[]`, `payouts: ProfilePayoutView[]` and `debtCents`.
- **Why:** `viewer` has required fields that an installed older app reads as
  the self-paced enrollment, so class seats go beside it, not in it. An older
  app that meets the `seat_lost` sync variant treats it as not paid, which is
  correct.

#### 1.15 `packages/core/src/domain/index.ts` and `packages/core/src/contracts/index.ts` (Modify)

- **Change:** Export `./class-sales` from each.
- **Why:** `@elevate/core` re-exports both folders.

#### 1.16 `packages/core/src/contracts/errors.ts` (Modify)

- **Change:** Add the eleven new learner codes in the table above, under the
  "Classes" header Part 1 added. `below_minimum` and `not_found` are already
  there.
- **Why:** The learner app words errors from codes.

#### 1.17 `packages/i18n/src/messages/areas/apiError.en.ts` and `apiError.zh.ts` (Modify)

- **Change:** One message per new code; the English text is in the table.
- **Why:** `catalog.test.ts` fails when a learner-visible code has no message.
- **Before production:** the author signs off the Chinese text. It does not
  block this phase.

#### 1.18 Tests in `packages/core/test/` (Modify three, create one)

- **Change:**
  - `money.test.ts` (Modify): `seatRefund` for each kind on the S$500 example
    with Stripe's fee at S$20.00 and at S$17.50, and on a promo-discounted
    payment; that the learner's refund, the profile's change and Elevate's
    change account for every cent; a `discretionary` amount of 1 cent and of
    the full price; three discretionary refunds that add up to the price
    returning exactly K in total; a cancellation after a discretionary refund
    of S$100.00; Stripe's fee larger than Elevate's fee giving X of zero; a
    request above what is left throwing. `profileShareAfterRefunds` for each
    kind, giving −S$20.00 for a cancelled seat and 0 for a withdrawal; for a
    lost bank dispute; and for a ledger row with a null fee refund, where it
    must equal today's `netAfterRefunds`.
  - `attendance.test.ts` (Modify): `moneyAttendance` for a check-in that
    stands, an overturned one, and a manual mark in each of its four
    sub-states, at exactly 7 days and one millisecond after.
  - `permissions.test.ts` (Modify): `class.refund` per role.
  - `class-sales.test.ts` (Create): each reason `classOnSale` can return, with
    the 75-day edge; `reservationAllowed` at the third and fourth; each row of
    the fulfilment table, and the cancelled-class case; `withdrawal` at
    exactly 7 days, with a changed class, with both, when counted, and from a
    cancelled class; each move problem and the 75-day edge; `isDue` at exactly
    7 days after the last block and after a cancellation, with an open mark,
    and with an incomplete cancellation; `payoutLimitCents` when held exceeds
    the balance, when pending covers the held amount, and when nothing is
    held; `choosePayoutItems` with a debt, with a payment that does not fit
    followed by one that would, and with a limit above everything named;
    `payDate` and `isPayTime` across midnight and 10:00 in Singapore.
- **Why:** These functions decide who is refunded what and when a profile is
  paid.

### Phase 2: The payments provider

**Built on 2026-11-25**, in the working tree, with Phase 1.

**As built.** Where the build found an entry wrong or silent:

- **SDK check:** `allowed_payment_method_types`, with `card` and `paynow`, and
  `wallet_options.link.display` set to `never` both exist on
  `Checkout.SessionCreateParams` in `stripe` 23.1.0.
- **Reused from P.1:** `listRefunds` and its type, and the fake's stored
  refund metadata; `expireCheckoutSession` already existed.
- **2.1, 2.2, `reverseTransfer`:** A reversal carries no fee amount, so the
  call expands the transfer's charge and its application fee and returns
  `applicationFeeRefundedCents`, the fee returned on the payment in all, or
  null. Phase 5's `dispute_lost` step must subtract the fee already
  returned. Whether Stripe fills that expansion was not tested in the
  sandbox.
- **2.1:** `findPayout` matches the payouts row id against
  `metadata.payout_id`. A refund's status is `pending`, `succeeded`, `failed`
  or `canceled`, with Stripe's `requires_action` read as `pending`.
  `retrieveChargeFee` answers null until the balance transaction is filled.
  `setAutomaticPayouts` sets a daily interval.
- **2.3, the fake:** Stripe's fee is filled at once by default, because
  existing tests need it at fulfilment; `stripeFeeLate` makes a new session's
  first read empty, as the sandbox saw. A payment's money is pending until
  `settle(accountId)`, and a payout above the available balance is refused
  with `balance_insufficient`. The fake throws Stripe's own error classes,
  so later phases sort fake and real errors the same way. A session can be
  paid by PayNow only if it allows it; a failed PayNow refund is not counted
  as refunded and its reversal stands, as G6 assumes.

**Ends with:** `npx turbo run typecheck test` passing.

#### 2.1 `apps/api/src/providers/payments/types.ts` (Modify)

- **Change:** `CheckoutSessionInput` gains `productName` (optional; defaults to
  the course title) and `allowedPaymentMethods` (optional; with none, Stripe
  offers the Dashboard's methods, as today) and `hideLink` (optional boolean). `createRefund` gains `amountCents?`,
  `refundApplicationFee?` (default true, as today) and `metadata?`, and
  returns the refund's status with its id. Add to `PaymentsProvider`:
  - `retrieveRefund(refundId)`, returning its status: `pending`, `succeeded`,
    `failed` or `canceled`;
  - `refundApplicationFee({ applicationFeeId, amountCents, metadata,
    idempotencyKey })`, returning its id;
  - `listApplicationFeeRefunds(applicationFeeId)`, returning each one's id,
    amount and metadata;
  - `reverseTransfer({ transferId, amountCents, refundApplicationFee,
    metadata, idempotencyKey })`, returning its id and the fee amount Stripe
    returned with it;
  - `setManualPayouts(accountId)` and `setAutomaticPayouts(accountId)`;
  - `retrieveBalance(accountId)`, returning `{ availableCents, pendingCents }`
    for SGD;
  - `createPayout({ accountId, amountCents, metadata, idempotencyKey })`,
    returning `{ payoutId }`;
  - `findPayout(accountId, label)`, returning the payout that carries the
    label, or null;
  - `retrieveChargeFee(chargeId)`, returning Stripe's fee and the ids of the
    balance transaction, transfer and application fee, or null while Stripe
    has not filled them;
  - `expireCheckoutSession(sessionId)`, if the provider does not already have
    it.

  `UnconfiguredPaymentsProvider` throws from each.
- **Why:** Part refunds, the fee kept back, held payouts, the bank dispute
  rule and the late fee each need a call the provider does not have.
  `setAutomaticPayouts` finishes a leave (G16); the test session put its
  account back to daily payouts with the same call.

#### 2.2 `apps/api/src/providers/payments/stripe.ts` (Modify)

- **Change:** `createCheckoutSession` uses `productName`, and sends
  `allowed_payment_method_types` when `allowedPaymentMethods` is given.
  Stripe's description of the API lists that parameter on creating a Checkout
  Session; the pinned SDK's types were not checked. If they lack it, stop and
  ask the author. `createRefund` sends
  `amount` when given, sets `refund_application_fee` from the input and sends
  `metadata`. Implement the new methods:
  - `refunds.retrieve` for `retrieveRefund`;
  - `applicationFees.createRefund` and `applicationFees.listRefunds`;
  - `transfers.createReversal`;
  - `setManualPayouts`: `accounts.update(accountId, { settings: { payouts: {
    schedule: { interval: 'manual' } } } })`. This is the call the test
    session ran on the pinned version;
  - `balance.retrieve` and `payouts.create`, each with the `stripeAccount`
    option; `payouts.list` with the same option for `findPayout`, read until
    the label is found or the list ends;
  - `charges.retrieve` with the balance transaction expanded.

  Every call that moves money passes its idempotency key.
- **Why:** The fake covers tests only; staging and production call Stripe
  through this file.

#### 2.3 `apps/api/src/providers/payments/fake.ts` (Modify)

- **Change:** Sessions track `refundedCents` and `feeRefundedCents` exactly,
  so a part refund refunds a part, and keep each refund's metadata and the
  session's `allowedPaymentMethods`. Accounts
  keep a payout mode, an available and a pending balance that charges,
  refunds with a reversal, fee refunds, reversals and payouts change, and a
  list of payouts with their metadata. A balance can go below zero, as at
  Stripe. `listTransferAmountCents` subtracts what was reversed, in place of
  zeroing a transfer on any refund. A refund on a session with an open or
  lost bank dispute throws an error with the code `charge_disputed`. A session
  can be paid by PayNow: a refund on it is `pending` until the test driver
  `settleRefund(refundId, 'succeeded' | 'failed')` is called, and a refund on
  a card session is `succeeded` at once. Add test drivers: `settle(accountId)` to move pending to available;
  `setStripeFee(sessionId, cents)`, with the fee empty until it is set or the
  session is next read; `disputeEvent(paymentIntentId, 'created' | 'won' |
  'lost')`; `payoutEvent(payoutId, 'paid' | 'failed')`; and a switch that
  makes the next call of a named method fail once, with a retryable or a
  final error.
- **Why:** The fake could only refund in full and held no balance, so no test
  could cover a part refund, a payout or the rule that a disputed payment
  cannot be refunded. The earnings reconciliation reads
  `listTransferAmountCents` and would disagree after a part refund.

#### 2.4 Tests in `apps/api/test/` (Modify one, create one)

- **Change:** `stripe-provider.test.ts` (Modify): the parameters each new and
  changed method sends, with the Stripe client stubbed as the existing tests
  stub it; `allowed_payment_method_types` is sent when the input names
  methods and left out when it does not. `fake-payments.test.ts` (Create): the fake's balances after a
  charge, a part refund with the fee kept, a fee refund, a reversal and a
  payout match the amounts table under "Refunds" on the S$500 example; a
  refund on a disputed session is refused; a refund on a PayNow session is
  pending until it is settled.
- **Why:** Every later test trusts the fake's arithmetic.

### Phase 3: Selling a seat

**Built on 2026-11-25**, in the working tree. Across the repository, lint,
typecheck, every build and 829 tests pass (API: 45 files, 468 tests).

**As built.** Where the build found an entry wrong or silent:

- **Made required:** `ClassDetail.notOnSaleReason`, `cancelReason`,
  `cancelledAt`, `seatsTaken`, `seatsWithChangeRight`;
  `CoursePublicView.classes`, `viewerClassSeats`. `LearnerClass.seat` and the
  four `EarningsView` fields stay optional for Phases 4 and 5.
- **Added:** a `ClassSalesStatus` contract for the Teach settings card; the
  routes answer `{ classSales }`. The audit actions
  `class_sales.leave_requested` and `class_sales.left` join core's list.
- **Built early, from 4.5:** the time-edit rule (the 75-day refusal,
  `classChangedAt`, the audit entry and the emails), since the brief asked
  for it; it reads attendance through a local `moneyByEnrollment`. The
  capacity check and the seat count run in a transaction that locks the
  class row. Phase 4 does not rebuild these.
- **3.2:** When Stripe fails after the opt-in is recorded, the route answers
  200 with `switching` and the job finishes it. A second opt-in is refused
  whenever the mode is not `automatic`. `finishStale` measures from
  `classSalesAcceptedAt`. `finishLeaving` keeps the acceptance columns as a
  record.
- **3.3:** Fulfilment needs Stripe's time for the payment, so the provider's
  payment details gain `paidAt`, the charge's creation time; without it,
  fulfilment uses now. A seat is also refused when the enrollment's class
  differs from the payment page's. A second lost payment for a seat that
  already has an unfinished refund row records nothing and throws, so the
  webhook stores the error and the retry of P.2 records it later; the
  confirmation page answers `pending` meanwhile. A lost seat sends no
  receipt and no `checkout_completed` event.
- **3.4:** A staff learner is not refused `own_class`. The product name is
  "Course: Class". The cancel address is
  `/course/<slug>?class=<id>&checkout=cancelled`. A restart also expires the
  row's own earlier page; if the page cannot be made, the reservation ends;
  if a current reservation's page has gone, a new one is made without
  extending the reservation. Restarting reuses a `refunded` or `cancelled`
  enrollment row.
- **3.5:** `request` writes the `seat.refund_requested` audit entry itself.
- **3.6:** The course page lists classes on sale by first block, full ones
  included with no seats left. `viewerClassSeats` lists active seats only.
- **3.11:** `class-guards.test.ts` lets only `class-checkout.service.ts` set
  `classId` on an enrollment; Phase 4 widens that to `seats.service.ts` for
  a move. No rule was added for `payments.classId`; the plan asks for none.
- The Chinese text of the new email keys needs the author's sign-off.
- **For Phase 5:** `finishLeaving` waits while any class payment of the
  account is unreleased, lost seats included, so the job must release
  those. The job must call `finishStale` and `finishLeaving`.

**Ends with:** `npx turbo run typecheck test` passing.

No deployed environment has `CLASS_SALES` on before Phase 5 is merged. Local
and test environments have it on from this phase, with the fake provider.

#### 3.1 `apps/api/src/env.ts` and `.env.example` (Modify)

- **Change:** `env.ts`: add `CLASS_SALES: bool.default(false)` beside
  `CLASSES`. `.env.example`: add `CLASS_SALES=true`.
- **Why:** The setting that stops new class sales without a deploy.

#### 3.2 `apps/api/src/services/class-sales.service.ts` (Create)

- **Change:**
  - `accept(actor, input)`: the checks and step 1 under "Opting in", then
    `finishSwitching`. Refuses `already_opted_in`, `not_payable` and
    `terms_version`.
  - `finishSwitching(payoutAccountId)`: steps 2 to 4. It calls
    `setManualPayouts`, which is safe to repeat, then `retrieveBalance`, then
    in one transaction sets `payoutMode` to `manual` and `manualSince`, writes
    the `opening_available` and `opening_pending` adjustments, and writes the
    `class_sales.accepted` audit entry. It does nothing for an account that is
    already `manual`.
  - `finishStale(now)`: calls `finishSwitching` for each account that has been
    `switching` for more than `SWITCHING_STALE_MS`. The job calls it.
  - `status(profileId)`: for the Teach settings card: the payout mode, the
    accepted date, the terms version, and the leave date if notice was given.
  - `leave(actor, profileId)`: sets `leaveRequestedAt` and `leaveOn`, as
    under "Leaving", and writes the `class_sales.leave_requested` audit
    entry. Refuses `not_opted_in`.
  - `finishLeaving(now)`: for each account whose `leaveOn` has passed and
    which meets the conditions under "Leaving", calls `setAutomaticPayouts`,
    then in one transaction sets `payoutMode` to `automatic`, clears the
    leave columns and `manualSince`, writes the `class_sales.left` audit
    entry, and emails the owner. The job calls it after paying.
- **Why:** Opting in changes a Stripe account and a profile together. Recording
  the intent first means a request that dies leaves a state the job can
  finish, not an account that nothing pays.

#### 3.3 `apps/api/src/services/payments.service.ts` (Modify)

- **Change:**
  - Export three pieces that are private or inline today, with no change to
    what self-paced checkout does: `checkoutMetadata(...)`, the builder of the
    payment-page metadata; `sameAttempt`; and `assertChargeable(quote)`, the
    below-minimum refusal that sits in `startCheckout`.
  - `FulfilmentOutcome` gains `seat_lost`.
  - `fulfilCheckout` reads `classId` from the payment-page metadata. Its
    branches, in order:
    1. The payment is already recorded: as today.
    2. There is no `classId`: as today, in every respect.
    3. There is a `classId`. Lock the class row, then the enrollment row. Call
       `fulfilmentDecision`, passing "no seat" when the enrollment is already
       active on another payment.
       - `'seat'`: activate the enrollment, clear `seatReservedUntil`, point
         the enrollment at this session as today, record the payment with its
         `classId`, count the promo code, and send the class receipt. Outcome
         `applied`.
       - `'seat_lost'`: record the payment with its `classId`, leave the
         enrollment as it is, and write a `seat_lost` row through
         `SeatRefundsService.request`. Send no receipt. Outcome `seat_lost`.

       Neither branch changes `courses.enrol_count`.
  - `refundDuplicate` and `retryDuplicateRefund` return at once for a payment
    with a `classId`.
  - `syncSession` answers `seat_lost` for that outcome, and adds `classId` to
    a paid answer for a class sale.
- **Why:** Fulfilment is where a payment becomes a seat, and it is shared by
  the webhook and the confirmation page. Listing the branches is what stops a
  payment that arrives after a cancellation from becoming a seat, and a lost
  seat from being reported as paid. The duplicate paths refund through the old
  code, so a class payment must never reach them.

#### 3.4 `apps/api/src/services/class-checkout.service.ts` (Create)

- **Change:**
  - `view(user, classId, promoCode?)` returns `ClassCheckoutView`. It applies
    `classOnSale` and `assertChargeable`, and refuses a zero price with
    `class_requires_payment`.
  - `start(user, classId, input)`: the five steps under "Buying a seat". It
    uses `loadActor` for `own_class`, `quoteFor` and `resolvePromo` for the
    quote, `reservationAllowed` for the limit, and `checkoutMetadata` plus
    `classId` and `refundTermsVersion` for the payment page. The payment page
    is created with `CLASS_PAYMENT_METHODS`. The product name is the course
    title and the class name. The cancel address is the course
    page with the class named.
  - `seatsTaken(tx, classId, exceptEnrollmentId?)` is the one count of seats,
    exported for the services that move learners and edit classes.
- **Why:** Class checkout shares the quote and the payment page with
  self-paced checkout and differs in the seat steps. A separate service leaves
  `startCheckout` as it is.

#### 3.5 `apps/api/src/services/seat-refunds.service.ts` (Create)

- **Change:** `request(tx, { enrollmentId, paymentId, classId, kind,
  requestedCents?, reason?, requestedBy?, cancellationId?, waitingFor? })`
  writes one seat refund row: `waiting` when `waitingFor` is given, otherwise
  `pending`. It writes no amounts. The unique index refuses a second
  unfinished row for the enrollment, and `request` turns that into
  `refund_in_progress`. `hadBackCents(tx, paymentId)` returns the total of the
  payment's ledger rows plus the requested amounts of its unfinished rows.
  Nothing sends a row yet; Phase 4 adds the sender.
- **Why:** Fulfilment in this phase must be able to record that a paid seat
  was lost. One writer for every seat refund keeps "one unfinished row per
  seat" in one place.

#### 3.6 `apps/api/src/services/catalog.service.ts` (Modify)

- **Change:** `detail` fills `classes` from the course's classes that pass
  `classOnSale`, each with `seatsLeft`, and `viewerClassSeats` from the
  signed-in learner's active class enrollments. It does not touch `viewer`.
- **Why:** The course page is where a class is chosen.

#### 3.7 `apps/api/src/routes/checkout.ts` (Modify)

- **Change:** Add `GET /classes/:classId`, with `requireUser()` and an
  optional `promoCode` query, answering `ClassCheckoutView`. Add `POST
  /classes/:classId`, with `requireUser()` and `validate('json',
  classCheckoutRequestSchema)`. `POST /quote` and `POST /courses/:id` are not
  changed.
- **Why:** The class checkout page is entered with only a class id, sometimes
  straight after a sign-in redirect, so one request must give it the class,
  the quote and the terms version.

#### 3.8 `apps/api/src/routes/teach-classes.ts` (Modify)

- **Change:** Add `GET class-sales` (`profile.read`), and `POST
  class-sales/accept` and `POST class-sales/leave` (`stripe.links`, each with
  `requireRecentSignIn`).
- **Why:** Opting in is done from Teach, by the role that holds the Stripe
  account.

#### 3.9 `apps/api/src/services/classes.service.ts` (Modify)

- **Change:** `detail` fills `notOnSaleReason`, `seatsTaken` and
  `seatsWithChangeRight`. `update` refuses a capacity below `seatsTaken` with
  `capacity_below_taken`.
- **Why:** Teach must say why a class is not on sale, and a class must not end
  up with more seats than its capacity.

#### 3.10 `packages/i18n/src/messages/areas/email.en.ts` and `email.zh.ts` (Modify)

- **Change:** Add the `email.classReceipt.*` keys (title, what was bought with
  the class name, the dates and place as a list, the refund terms in one
  sentence, the button to the class screen) and the `email.seatLost.*` keys.
- **Why:** Learner emails take their text from this area.
- **Before production:** the author signs off the Chinese text.

#### 3.11 `apps/api/test/helpers/test-app.ts`, `role-routes.test.ts` and `class-guards.test.ts` (Modify)

- **Change:** `test-app.ts`: default `CLASS_SALES` to `'true'`; add
  `optIn(profileId)`, and `buySeat(email, classId)`, which starts a class
  checkout and completes it through the fake provider. `role-routes.test.ts`:
  add a row for `GET class-sales` with `profile.read` and one for `POST
  class-sales/accept` and one for `POST class-sales/leave`, each with
  `capability: 'stripe.links'`.
  `class-guards.test.ts`: `class-checkout.service.ts` may set `classId` on an
  enrollment; no other file may.
- **Why:** Later tests buy seats, and every Teach route needs a row. Part 1's
  guard forbids any file from setting `classId`, so it must be relaxed in the
  phase that first does so, or this phase cannot pass its own end check.

#### 3.12 Tests in `apps/api/test/` (Create two, modify one)

- **Change:**
  - `class-sales.test.ts`: opting in switches the fake account to manual,
    records the acceptance and writes both opening amounts; a manager is
    refused; a second opt-in is refused; a Stripe failure after step 1 leaves
    `switching`, the class not on sale, and `finishStale` completes it.
    Leaving: notice takes the profile's classes off sale at once; a manager
    is refused; `finishLeaving` waits while a class payment is held, a refund
    is unfinished or the date has not come, then switches the fake account
    to automatic; the profile can opt in again.
  - `class-checkout.test.ts`: each `classOnSale` reason; `own_class`; a zero
    price and a price under the minimum refused; a stale terms version
    refused; the last seat with two learners; a reservation ending by the
    clock; a second start during a current reservation returning the same
    payment page and the same end time; the fourth reservation in 24 hours
    refused; a learner's reservation in a second class of the course ending
    the first; a learner with a self-paced enrollment buying a seat and
    keeping both; the payment page created with cards and PayNow only; the
    receipt's content and language; `classId` in the sync
    answer; no change to `courses.enrol_count`; each row of the fulfilment
    table; a payment arriving after the class was cancelled; a second payment
    for a seat already active; and for each lost seat, a `seat_lost` row, the
    sync answer `seat_lost`, no receipt, and no call to the duplicate paths.
  - `checkout.test.ts` (Modify): one test that the self-paced flow's requests,
    payment-page metadata and answers are what they were, and that its
    payment page names no payment methods, with `CLASS_SALES` on.
- **Why:** The seat rule and the unchanged self-paced path are the two things
  this phase must not get wrong.

### Phase 4: Seat refunds, withdrawing, moving, changing a block and cancelling

**Built on 2026-11-25**, in the working tree. The API has 47 test files and
503 tests. Each refund kind is checked against the amounts table on S$500
with Stripe's fee at S$20.00: a part refund after one block of five returns
S$400.00 to the learner and S$55.90 of Elevate's fee to the profile.

**As built.** Where the build found an entry wrong or silent:

- **4.2:** The `refund_after_payout` adjustment is the profile's share after
  the refund less the share before it, from `profileShareAfterRefunds`. It
  equals X − R for a seat refund and keeps the fee arithmetic in `money.ts`.
- **4.3, attempts:** An attempt is counted only when Stripe is to be called,
  so a row that waits a week for a manual mark does not reach 96.
- **4.3, keys:** The idempotency keys are `seat-refund:<id>:<first attempt>`
  and `seat-fee-refund:<id>:<first attempt>`, the time in milliseconds. They
  are the same for every retry of one row, so nothing is sent twice. A
  Support retry starts a new first attempt and so a new key, because Stripe
  replays a refused request under an old key for a day.
- **4.3, retry:** When only the fee refund failed, Support's retry returns
  the row to `refund_sent`. A row whose refund Stripe accepted and then
  failed (`refund_failed`) cannot be retried (`refund_failed_at_stripe`):
  the profile's share was already taken back, so a second refund would take
  it twice. Support refunds the learner another way and closes the row
  (G6). Such a refund has no ledger row, so the profile's Stripe balance and
  its share after refunds differ by R until Support writes a correction;
  the payout shows it as unnamed money.
- **4.3, Stripe's fee:** The sender reads the fee from Stripe when its
  payment has none, so a row never waits for ever; Phase 5's
  `fillStripeFees` also does this, before the sender runs. A payment with an
  open or lost bank dispute makes its row wait before sending, not only
  after `charge_disputed`. `dispute_lost` rows wait for Phase 5.
- **4.4:** Cancelling is refused, with `refund_in_progress` and the
  enrollment ids, while any seat has a refund under way, to keep one
  unfinished row per seat. A discretionary refund "too large counting an
  unfinished row" cannot occur, since the unfinished row already refuses
  it. Withdraw answers `{ class }`, a move and a refund `{ seat }`, a cancel
  `{ class }`. A cancelled class refuses publishing, editing, deleting and a
  new instructor.
- **4.8:** Support's one write route under `/support/classes` is
  `POST /classes/:id/cancel`; the test that found none now allows exactly
  that one.
- **4.10:** `GET /me/classes` also lists a refunded or withdrawn seat for 30
  days, so the learner sees "refunded".
- **Changes under `packages/`:** `LearnerClass.seat` is required.
  `seat_has_no_payment` joins `USER_ERROR_CODES`. New email keys; their
  Chinese text needs the author's sign-off.
- **For Phase 5:** call `fillStripeFees` before the sender; remove the
  sender's skip of `dispute_lost` rows, and keep those rows out of the
  bank-dispute wait, which would close them as `bank_returned`; set both
  `classes.releasedAt` and `payments.releasedAt`, because the profile's
  cancel, move and refund check them.

**Ends with:** `npx turbo run typecheck test` passing. Needs P.1 and P.2
deployed.

#### 4.1 `apps/api/src/services/attendance.service.ts` (Modify)

- **Change:** Add two read methods, both built on `moneyAttendance` from core:
  `moneyAttendanceByEnrollment(tx, classId)`, a map from each enrollment to
  `{ counted, openMarkUntil }`; and `classOpenMarkUntil(tx, classId)`, the
  latest open-mark deadline in the class, or null. In `manualMark`, after the
  transaction commits, send the learner `email.manualMark.*` with the class,
  the block, the dispute deadline and a link to the class screen.
- **Why:** The refund rule and the release check both ask about attendance,
  and Part 1 keeps attendance reads beside its one writer. The email exists
  because a manual mark the learner does not know about can now cost them a
  refund.

#### 4.2 `apps/api/src/services/transactions.service.ts` (Modify)

- **Change:**
  - `applyRefund` takes two new optional arguments. `tx` lets it join a
    transaction the caller has open; without it, it opens its own, as today.
    `enrollment` is `'refunded'`, `'cancelled'` or `'unchanged'`, and is
    applied whether the refund is full or part. When it is not passed: a
    payment with no `classId` behaves as today; a class payment gets
    `'refunded'` for a full refund and `'unchanged'` for a part one.
  - The existing guard stays for class payments: only the payment that the
    enrollment's session points at changes the enrollment. A learner who
    withdrew and bought the same class again has two payments on one row.
  - It stores `applicationFeeRefundedCents` and `seatRefundId` when the caller
    gives them. A refund from outside stores null for the fee: its fee refund
    is not read from Stripe.
  - For a class payment it never changes `enrolCount`.
  - For a payment of an account whose `payoutMode` is `manual`: when the
    payment has a `payoutId`, or was paid before `manualSince`, it writes a
    `refund_after_payout` adjustment of the fee refund less the amount.
  - `applyChargeRefunded` skips a refund whose metadata has `seat_refund_id`,
    or whose id is stored on a seat refund row. It records nothing and sends
    no email for it.
  - `refund`, Support's action, refuses `refund_in_progress` when the payment
    has an unfinished seat refund row.
- **Why:** A refund made by Support or in the Stripe dashboard must free the
  seat. Stripe sends its notice for the job's own refunds too, usually before
  the job has recorded them, so without the skip a seat refund is recorded
  twice and the learner gets two emails.

#### 4.3 `apps/api/src/services/seat-refunds.service.ts` (Modify)

- **Change:** Add the sender.
  - `sendUnfinished(now)` takes the rows that are `waiting`, `pending` or
    `refund_sent`, oldest first, and calls `send` for each, catching each
    failure. It never takes a `failed` row. **It is called by
    `ReleaseService.run()`, which Phase 5 creates.** Until then only tests
    call it.
  - `send(id, now)` claims the row in a short transaction with `select ... for
    update skip locked`, adds one to `attempts`, sets `firstAttemptAt` if
    empty, and commits. It then works from the row's status, as "How the job
    sends a row" describes, saving the status and the Stripe id after each
    step. Stripe is called outside any transaction.
  - A row that leaves `waiting` for `pending`, when its kind is
    `teacher_cancelled` or `elevate_cancelled`, sets its enrollment to
    `refunded` in the same transaction. A `teacher_cancelled_part` row leaves
    the enrollment as it is.
  - The last step is one transaction: `applyRefund` with the caller's `tx`,
    the Stripe refund id, X, the row's id and the enrollment outcome
    `'unchanged'`, because the enrollment was set earlier; the row `done` with
    `completedAt`; the `seat.refund_done` audit entry; and, when the row is
    the last unfinished one of a cancellation, that cancellation's
    `completedAt`. The emails in the emails table follow the commit.
  - In `refund_sent`, before the fee refund, it calls `retrieveRefund`.
    `pending` leaves the row as it is for the next run. `failed` or
    `canceled` sets the row `failed` with the error `refund_failed`.
    `succeeded` continues.
  - When `applyRefund` reports that the refund was already recorded, `send`
    treats it as success and finishes.
  - When a step throws: a network error, a rate limit or a Stripe server error
    records `error` and leaves the status. Stripe's `charge_disputed` sets the
    row to `waiting` for `bank_dispute`. Any other refusal by Stripe, or
    `attempts` at `REFUND_MAX_ATTEMPTS`, sets `failed`.
  - Before repeating a step when `firstAttemptAt` is older than
    `IDEMPOTENCY_TRUST_MS`, it calls `listRefunds` or
    `listApplicationFeeRefunds` and looks for the label.
  - A row closed as `mark_settled` sends `email.classCancelledAttended.*`.
  - `retry(user, id, reason)` sets a `failed` row to `pending` with `attempts`
    at 0. `close(user, id, reason)` sets it to `closed` with the reason
    `support`. Each refuses a row that is not `failed` and writes an audit
    entry.
- **Why:** One writer and one sender for every seat refund keep the money
  rules in one place. Saving state after each step is what lets a run that
  stops be followed by another without sending anything twice.

#### 4.4 `apps/api/src/services/seats.service.ts` (Create)

- **Change:** Each method loads the class through `ClassesService.load`
  (Elevate's cancellation loads it by id), locks the class row before any
  enrollment row, and writes seat refund rows through
  `SeatRefundsService.request` inside its own transaction. None calls Stripe
  to move money.
  - `list(actor, classId)` returns `SeatView[]`.
  - `moveTargets(actor, classId, enrollmentId)` returns `MoveTarget[]`: the
    profile's other published classes of the course, each with the problems
    `canMove` gives.
  - `withdraw(user, enrollmentId)`: `withdrawal` decides the kind. In one
    transaction it sets the enrollment to `cancelled` for `learner_withdrew`
    or `refunded` for `changed_withdrew`, writes the row, and writes the
    `seat.withdrawn` audit entry. The row is `waiting` for `stripe_fee` when
    the payment has no fee yet.
  - `move(actor, classId, enrollmentId, toClassId)`: `canMove` decides. It
    locks both class rows in id order, points the enrollment and its payment
    at the target, and sets `movedAt`, `movedBy`, `movedFromClassId` and
    `classChangedAt`. It emails `email.seatMoved.*` after the commit.
  - `refund(actor, classId, enrollmentId, input)`: the checks under
    "Discretionary refund", with `hadBackCents` for `refund_too_large`.
  - `cancelClass(actor, classId, input)` and `cancelClassByElevate(user,
    classId, input)`: the steps under "Cancel" and "Cancellation by Elevate".
    After the commit each calls `expireCheckoutSession` for the reservations
    it ended, catching failures, and sends the emails that need no refund:
    `classCancelledAttended` and `classCancelledMarkOpen`. `cancelClass`
    counts `blocksTotal` and `blocksUntaught` and writes a
    `teacher_cancelled_part` row for each learner counted as attended when
    any block was not taught. `cancelClassByElevate` takes one of the grounds
    and a note, and emails the profile's owner.
  - `learnerSeat(user, enrollment)` returns `LearnerSeat`.
  - A seat with no payment, which only Part 1's seed creates, gets no row:
    `withdraw`, `move` and `refund` answer `seat_has_no_payment`, and a
    cancellation skips it.
- **Why:** Each action is a seat rule plus a refund request. Keeping them
  together keeps the lock order the same everywhere: class, then enrollment.

#### 4.5 `apps/api/src/services/classes.service.ts` (Modify)

- **Change:**
  - `publish`, `update`, `remove` and `setInstructor` refuse a cancelled class
    with `class_cancelled`.
  - `update`, when the class has an active seat and the edit changes a block's
    start or end, adds a block or removes one:
    - refuses `class_too_late_for_seat` if the new last block would end more
      than `SEAT_HORIZON_MS` after the payment of any active seat;
    - in the same transaction, if the class has not started, sets
      `classChangedAt` on each active enrollment that `moneyAttendance` does
      not count as attended;
    - writes a `class.times_changed` audit entry with the old and new times;
    - after the commit, sends `email.classTimesChanged.*` to every learner
      with an active seat.
- **Why:** A cancelled class is closed. A time change after a sale must not
  carry held money past the day limit, and R3 gives each learner notice and,
  if they have not attended, a way out.

#### 4.6 `apps/api/src/routes/classes.ts` (Modify)

- **Change:** Add `POST /:enrollmentId/withdraw`, with `requireUser()` and
  `requireClasses`. `GET /` adds `seat: LearnerSeat` to each item, and lists a
  learner's class enrollments that are `active`, plus those that are
  `refunded` or `cancelled` with a seat refund row created in the last 30
  days.
- **Why:** A learner who has just withdrawn, or whose class was cancelled,
  must be able to see where their refund is.

#### 4.7 `apps/api/src/routes/teach-classes.ts` (Modify)

- **Change:** Add:
  - `GET classes/:id/seats`, `earnings.read`;
  - `GET classes/:id/learners/:enrollmentId/move-targets`, `class.manage`;
  - `POST classes/:id/learners/:enrollmentId/move`, `class.manage`;
  - `POST classes/:id/cancel`, `class.manage`, with `requireRecentSignIn`;
  - `POST classes/:id/learners/:enrollmentId/refund`, `class.refund`, with
    `requireRecentSignIn`.
- **Why:** Seats show money, so they sit behind the capability that already
  guards earnings. Cancelling and refunding send money out and cannot be
  undone, so they ask for a recent sign-in as the Stripe links do.

#### 4.8 `apps/api/src/routes/support.ts` (Modify)

- **Change:** Add `POST /classes/:id/cancel`, which takes one of the grounds
  under "Cancellation by Elevate" and a note, and `POST /seat-refunds/:id`,
  which takes `refundRowActionSchema`. Both use
  `requireRole('super_admin')`.
- **Why:** Elevate must be able to end a class the profile cannot or will not
  cancel, and a failed refund needs a person to retry or close it.

#### 4.9 `packages/i18n/src/messages/areas/email.en.ts` and `email.zh.ts` (Modify)

- **Change:** Add the keys for the eight other learner emails in the emails
  table.
- **Why:** Learner emails take their text from this area.
- **Before production:** the author signs off the Chinese text.

#### 4.10 `apps/api/test/role-routes.test.ts` and `class-guards.test.ts` (Modify)

- **Change:** `role-routes.test.ts`: rows for the five Teach routes of 4.7,
  with fixture ids for a second class to move to and a seat to refund.
  `class.refund` and `class.manage` are refused for a writer and for staff;
  `earnings.read` is refused for a writer. `class-guards.test.ts`:
  `seats.service.ts` may also set `classId` on an enrollment.
- **Why:** Every Teach route needs a row, and a move re-points an enrollment.

#### 4.11 Tests in `apps/api/test/` (Create two, modify two)

- **Change:**
  - `seat-refunds.test.ts` (Create), for each kind except `dispute_lost`,
    which Phase 5 covers: the Stripe calls, the fake's balances afterwards,
    the ledger row with its fee refund, the enrollment status, and the emails,
    with Stripe's fee at S$20.00. Also: `send` resumed from `pending` and from
    `refund_sent` sends each call once; Stripe's `charge.refunded` delivered
    between the two calls records nothing and sends no email; a retryable
    failure is tried again and a final one becomes `failed` and is not; the
    96th attempt becomes `failed`; a PayNow refund that is pending sends no
    fee refund, writes no ledger row and sends no email until it is settled,
    and one that fails makes the row `failed`; a step older than 23 hours is
    found at
    Stripe by its label and not sent again; a second unfinished row for one
    seat is refused; a row waiting for Stripe's fee is sent once the fee is
    set; `retry` and `close`; a refund made by Support's action and by a
    dashboard notice frees the seat and is counted once; Support's action is
    refused while a row is unfinished.
  - `seats.test.ts` (Create): withdrawal at each edge, when counted, with a
    changed class, and from a cancelled class; the seat free in the same
    request; each move problem; a move changing the payment's class and
    freeing the old seat; a discretionary refund by an owner and a manager,
    and refused for a writer, when too large counting an unfinished row, after
    release, and without a recent sign-in; cancelling before the start, and
    after a block with learners who checked in, who have an open manual mark,
    who have a settled one and who did not come; the open-mark learner
    refunded after disputing and closed after the mark settles; cancelling
    twice; a withdrawal refused after cancelling; Elevate's cancellation
    refunding learners who attended; a cancellation ending reservations and
    expiring their payment pages.
  - `classes.test.ts` (Modify): a time edit with a seat sold sets
    `classChangedAt` only for learners not counted as attended, emails each
    seat holder, and is refused past the limit; an edit after the class
    started sets nothing; a capacity below seats taken is refused.
  - `attendance.test.ts` (Modify): a manual mark emails the learner in their
    language with the dispute deadline.
- **Why:** These are the refund rules, one test per rule, and the two races
  the review found: Stripe's notice arriving first, and two refunds for one
  seat.

### Phase 5: The release job, bank disputes and payouts

**Built on 2026-11-25**, in the working tree. The API has 50 test files and
547 tests, and its build emits `dist/release.js`. Not run: the payout test
on a real connected account, which waits for the liveness check (G3).

**As built.** Where the build found an entry wrong or silent:

- **5.1:** `markReleased` and `payDue` take the run's id, which
  `releasedRunId` and `payouts.runId` need. A cancelled class never goes
  under review, since every learner not counted as attended was refunded in
  full; only classes with payments are considered, or every unsold class
  would be flagged. A chosen total of 0 or less records `nothing_payable`,
  1 to 99 cents `below_minimum`. A refused or failed payout writes a
  `payout.failed` audit entry, which the run counts for 24 hours, because
  `payouts` has no failure time. A payout event is matched by Stripe's id,
  or by its label if it arrives before the id is stored. In
  `ProfilePayoutView`, `debtCents` is a positive amount owed; the last 10
  payouts are listed.
- **5.2:** The run's lock is held on one pooled connection for the whole
  run. A step that fails is counted in `needingAttention`, so the alarm on
  that count also fires for a step that fails on every run; this was added
  after the build.
- **5.3:** The program exits 0 when the lock is held elsewhere or a step
  failed, since the run's row and log line record it, and 1 when it fails
  before its log line. It loads the API's whole environment, so the release
  task needs the API's secrets too. Besides `release_run_finished` it logs
  `release_run_locked` and `release_run_failed`.
- **5.5:** A lost bank dispute zeroes the share of a class payment only. A
  dispute closed with any status but `lost` counts as won.
- **5.6:** The 23-hour lookup of a reversal needed a provider call 5.6 does
  not name, `listTransferReversals`. The key is
  `seat-reversal:<id>:<first attempt>`. The fee returned is Stripe's total
  for the payment less what was returned before. The debt adjustment is
  written only when the payment was paid out. Only the owner is emailed.
- **5.8:** `GET /support/payouts` is already the payout ledger, so the
  overview is `GET /support/payouts/overview`, answering `{ overview }`.
- **5.9:** The dev route exists only when dev endpoints are on and the
  environment is not production, and is left out of the typed client.
- **Changes under `packages/`:** the four `EarningsView` fields are required;
  the audit action `payout.failed` is added.

**Ends with:** `npx turbo run typecheck test` passing. Before it is merged, the
payout test on a real connected account is done and recorded.

#### 5.1 `apps/api/src/services/payouts.service.ts` (Create)

- **Change:**
  - `heldCents(tx, payoutAccountId)` and `payableItems(tx, payoutAccountId)`,
    by the definitions under "Held money and the release job", using
    `profileShareAfterRefunds`.
  - `markReleased(now)`: step 5 of a run. For each `manual` account, claimed
    with `select ... for update skip locked` on its `payout_accounts` row, in
    one transaction: put due classes with no counted attendance under review;
    mark the other due classes released; mark the payments of every released
    class that have no open bank dispute and no unfinished row, whenever the
    class was released; and mark class payments older than `MAX_HELD_MS` with
    `day_limit`. The reason and the run go on the payment. A class is given a
    reason only by `due` or `support`.
  - `payDue(now)`: step 6. When `isPayTime(now)`, for each `manual` account
    with no `payouts` row for `payDate(now)`:
    1. In one transaction, claim the account as above, read the balance, work
       out the held total, the limit and the items, and insert the `payouts`
       row. For a total of S$1 or more the row has the outcome `paid` and
       `sendStatus` `sending`, and each chosen payment and adjustment gets its
       `payoutId`; a payment also gets `paidOutCents`. Otherwise the row has
       `below_minimum` or `nothing_payable` and nothing is marked. Commit.
    2. For a `sending` row, call `createPayout` with the label and the key
       `payout:<id>`.
    3. In one transaction, set `sendStatus` to `sent` and store the payout id,
       with a `payout.created` audit entry.

    If Stripe refuses step 2 with an error that a retry cannot fix, one
    transaction clears the marks, sets the outcome to `failed` and stores the
    error, and the profile's owner is emailed.
  - `resumeSending(now)`: for each row left at `sending`. Younger than
    `IDEMPOTENCY_TRUST_MS`: repeat steps 2 and 3 with the same key. Older:
    call `findPayout` first, and go to step 3 if it is there.
  - `onPayoutEvent(stripePayoutId, status)`: sets `payoutStatus`. On `failed`
    it clears the marks of that payout's items and emails the profile's owner.
  - `clearReview(user, classId, input)`: sets the review-cleared fields and
    writes an audit entry. The next run releases the class with the reason
    `support`.
  - `addCorrection(user, payoutAccountId, input)`: writes a `correction`
    adjustment and a `payout.correction` audit entry.
  - `overview()` returns `SupportPayoutsOverview`. `forProfile(actor)` returns
    the held classes, the recent payouts with their items, and the debt, for
    Teach.
- **Why:** The three bounds on a payout, and R1's marks. Writing the row and
  the marks before calling Stripe is what lets a run that dies between the
  call and the record be followed by one that finds the same payout.

#### 5.2 `apps/api/src/services/release.service.ts` (Create)

- **Change:** `run(now)` is the seven steps under "One run":
  1. Take a session-level advisory lock with `pg_try_advisory_lock`. If
     another run holds it, log that and return.
  2. Insert the `payout_runs` row.
  3. `ClassSalesService.finishStale(now)`.
  4. `PaymentsService.fillStripeFees()`.
  5. `SeatRefundsService.sendUnfinished(now)`.
  6. `PayoutsService.markReleased(now)`, then `resumeSending(now)`, then
     `payDue(now)`, then `ClassSalesService.finishLeaving(now)`.
  7. Count what needs attention: `failed` seat refund rows; rows `pending` or
     `refund_sent`, or `waiting` for `stripe_fee`, for more than 24 hours;
     payouts whose outcome or `payoutStatus` became `failed` in the last 24
     hours; and payouts at `sending` for more than 24 hours. Update the run
     row, and write one JSON log line: `{ "event": "release_run_finished",
     "runId", "refundsSent", "classesReleased", "payoutsCreated",
     "needingAttention" }`.

  A step that throws is caught, recorded in the run's `error`, and the later
  steps still run.
- **Why:** One place gives the order of a run. A row that waits for a manual
  mark or a bank dispute can wait for weeks by design, so it is not counted as
  needing attention.

#### 5.3 `apps/api/src/release.ts` (Create), `apps/api/tsup.config.ts` and `apps/api/Dockerfile` (Modify)

- **Change:** `release.ts` builds `deps` as `server.ts` does, calls
  `ReleaseService.run(new Date())`, and exits 0 when the run returned, 1 when
  it threw before the log line. `tsup.config.ts`: add it to `entry` and to the
  comment. `Dockerfile`: add it to the comment listing entry files.
- **Why:** The scheduled task needs a program of its own, because a schedule
  cannot change the command of the task it starts.

#### 5.4 `apps/api/src/services/payments.service.ts` (Modify)

- **Change:** Add `fillStripeFees()`: for each payment with a charge id and no
  `stripeFeeActualCents`, call `retrieveChargeFee` and, when it answers, store
  the fee, `platformNetCents`, and any of the balance transaction, transfer
  and application fee ids that are empty.
- **Why:** On the pinned Stripe version these fields are empty for a few
  seconds after a payment, and R2's refund amounts cannot be worked out
  without the fee.

#### 5.5 `apps/api/src/services/stripe-events.ts` (Modify)

- **Change:** Add handlers for `charge.dispute.created`,
  `charge.dispute.closed`, `payout.paid` and `payout.failed`, as the table
  under "Bank disputes" describes. A bank dispute is matched to a payment by
  its payment intent. Each handler is safe to run twice.
  - Created: set the three bank dispute columns; set the payment's `pending`
    seat refund row, if any, to `waiting` for `bank_dispute`.
  - Won: set the status. The job resumes the waiting row.
  - Lost, in one transaction: set the status; close the payment's unfinished
    seat refund rows as `bank_returned`; and for a class payment, set the
    enrollment to `refunded` and write a `dispute_lost` row. The unique index
    makes a second delivery write nothing.
  - Payout events call `PayoutsService.onPayoutEvent`. They arrive on the
    Connect endpoint.
- **Why:** A lost bank dispute undoes the sale, and a payout's fate is known
  only from Stripe's events.

#### 5.6 `apps/api/src/services/seat-refunds.service.ts` (Modify)

- **Change:** `send` handles `dispute_lost`. It calls `reverseTransfer` for
  `reversalCents` with Elevate's fee refunded, the label, and the key
  `seat-reversal:<id>`. Then, in one transaction: store the reversal id and
  the fee amount Stripe returned; if the payment has a `payoutId`, write a
  `bank_dispute_after_payout` adjustment of minus its `paidOutCents`; mark the
  row `done`. It writes no ledger row and does not change
  `payments.refundedCents`.
- **Why:** The bank has already returned the learner's money. Only the
  profile's share is taken back, and Stripe made no refund to record.

#### 5.7 `apps/api/src/services/earnings.service.ts` (Modify)

- **Change:** Remove `netAfterRefunds`. `breakdown`, `forProfile`, `forCourse`
  and `reconcile` use `profileShareAfterRefunds` from core, reading each
  payment's ledger rows and bank dispute status. Fill the four new
  `EarningsView` fields from `PayoutsService.forProfile` for an opted-in
  profile; they are zero and empty otherwise.
- **Why:** The earnings page and the payout must give one figure for the same
  payment. The old function is wrong for a withdrawal and a cancelled seat.

#### 5.8 `apps/api/src/routes/support.ts` (Modify)

- **Change:** Add `GET /payouts`, answering `SupportPayoutsOverview`, for any
  Support user. Add `POST /classes/:id/clear-review` and `POST
  /payout-accounts/:id/corrections`, each with `requireRole('super_admin')`.
- **Why:** Support is where a class under review, a failed refund, a failed
  payout and unnamed money are seen. Acting on them is limited to admins.

#### 5.9 `apps/api/src/routes/dev.ts` (Create) and `apps/api/src/app.ts` (Modify)

- **Change:** A router mounted only when `DEV_ENDPOINTS_ENABLED` is true:
  `POST /dev/release-run`, with an optional `now`, calls
  `ReleaseService.run`. When the payments provider is the fake, it first
  settles every fake account's pending balance.
- **Why:** The fake provider keeps its state in the API process, so a release
  program started as a second process would see an empty fake. The local
  walkthrough needs a run inside the API, and a way to move the clock past a
  release date.

#### 5.10 Tests in `apps/api/test/` (Create three, modify one)

- **Change:**
  - `payouts.test.ts` (Create): a class released 7 days after its last block
    and after a cancellation, and not one second earlier; not released while a
    manual mark is open, and released when it settles; not released while its
    cancellation has an unfinished row; a class with nobody counted as
    attended put under review, released with `support` after `clearReview`,
    and its payments released at 85 days with `day_limit`; a payment with an
    open bank dispute staying held after its class is released, and released
    by a later run once the dispute is won; a payout on the S$500 example with
    self-paced and class money in one balance, listing its payments oldest
    first; held money not paid; a payment that does not fit and the one after
    it both waiting; a cancelled seat's debt reducing the payout; the opening
    amounts paid; money in the fake's balance that no row names left unpaid
    and recorded as unnamed; `below_minimum` and `nothing_payable`; no second
    payout the same Singapore day and none before 10:00; two runs started
    together paying once; a run that dies after the Stripe call resumed with
    one payout; a row older than 23 hours found by its label; a create refused
    by Stripe clearing the marks; a `payout.failed` event clearing them and
    the next day's payout paying the same items; a refund after payout writing
    an adjustment; a correction.
  - `release.test.ts` (Create): the order of a run; a step that throws does
    not stop the later steps; a second run while one holds the lock returns;
    the counts in the log line; what counts as needing attention; a run with
    no opted-in profile writes a run row and nothing else.
  - `bank-disputes.test.ts` (Create): opened, won and lost on a class payment
    before release and after payout, and on a self-paced one; the fake's
    balances after a loss; the seat closed; a pending refund row waiting, then
    resumed on a win and closed on a loss; the lost event delivered twice
    writing one row; the adjustment after payout.
  - `certificates-earnings.test.ts` (Modify): the four new earnings fields;
    the earnings of a profile with a cancelled seat, a withdrawn seat and a
    part refund match `profileShareAfterRefunds`; reconciliation agrees after
    a part refund.
- **Why:** The release rules and the three bounds stand between a profile and
  the wrong amount of money.

### Phase 6: Learner app

**Built on 2026-11-25**, in the working tree; the learner app has 120 tests.

**As built.** Where the build found an entry wrong or silent:

- The checkout page shows refund terms 1 to 13 of
  `docs/terms/class-refund-terms.md` with their version, term 13's list
  rewritten as whole sentences. Stripe's rates are fixed text, since the API
  carries the card estimate only. A line gives the class's own withdrawal
  date. The receipt's terms sentence follows terms 2 to 4.
- The app works out why withdrawal is not offered, and whether a seat was
  withdrawn or refunded after a cancellation, from the session states and
  the seat's refund rows, because `LearnerSeat` carries neither a reason nor
  the enrollment's status. The success page reads the class's dates and
  place from `GET /me/classes`.
- `GET /checkout/classes/:classId` reads `promoCode` without a validator, so
  the typed client has no query for it and the app casts its arguments.
- The Chinese text of the new keys needs the author's sign-off.

**Ends with:** `npx turbo run typecheck test` passing, including
`npm -w @elevate/learner test`.

"On the web" means the learner app in a browser. "The installed app" means the
iOS or Android build.

#### 6.1 `packages/i18n/src/messages/areas/learnerCourse.en.ts`, `learnerCheckout.en.ts`, `learnerClass.en.ts` and their `.zh.ts` files (Modify)

- **Change:**
  - `learnerCourse`: "Take it as a class", the one-line description of what a
    class seat includes and does not, a class row (dates, place, seats left,
    full), "Book this class", "You have a seat", and the installed app's
    "choose your class on the web" text.
  - `learnerCheckout`: the class summary; the refund terms as whole sentences,
    with the fee stated as a rate; the class confirmation ("Your seat is
    booked", with the dates and place) in place of "Start learning"; and the
    seat-lost confirmation.
  - `learnerClass`: "Withdraw", the amount or the rate and the deadline, the
    confirmation step, "Refund on its way", "Refunded", "Withdrawal has
    closed", "You were moved to this class", "This class's times changed", the
    open manual mark with its dispute deadline, and the cancelled-class states
    for a learner who is refunded, who waits on a manual mark, and who is
    counted as attended.
- **Why:** The learner app has no English literals.
- **Before production:** a lawyer reads the refund terms and the author signs
  off the Chinese text. Neither blocks this phase. The source text is
  `docs/terms/class-refund-terms.md`; the catalog follows it.

#### 6.2 `apps/learner/src/lib/catalog.ts` and `apps/learner/src/lib/classes.ts` (Modify)

- **Change:** `catalog.ts`: add `fetchClassCheckout(classId, promoCode?)` and
  `startClassCheckout(classId, { locale, promoCode?, termsVersion })`.
  `fetchQuote` is not changed. `classes.ts`: add `withdraw(enrollmentId)`.
- **Why:** The app's API calls live in `lib`.

#### 6.3 `apps/learner/src/app/course/[slug].tsx` (Modify)

- **Change:** Below the existing enrol card, when `classes` is not empty, a
  "Take it as a class" section listing each class with its button. A full
  class is shown as full. A class in `viewerClassSeats` shows "You have a
  seat" and links to the class screen. On the web a button goes to
  `/checkout/class/<id>`. In the installed app it opens the web course page
  with `?class=<id>`. On the web, a `class` parameter scrolls to and marks
  that class. The existing enrol button and its use of `viewer` are unchanged.
- **Why:** The course page is where a class is chosen, and the installed app
  hands paid checkout to the web.

#### 6.4 `apps/learner/src/app/checkout/class/[classId].tsx` (Create) and `apps/learner/src/app/_layout.tsx` (Modify)

- **Change:** The class checkout page: the class summary, the price, the promo
  field, the refund terms above the pay button, and "Pay". It calls
  `fetchClassCheckout`, and `startClassCheckout` with the terms version it was
  given. It shows each error in the "Learner-facing errors" table; on
  `terms_changed` it loads the page's data again. Add the screen to the
  signed-in group in `_layout.tsx`. `sign-in-redirect.ts` needs no change:
  `/^\/checkout\//` in `SIGNED_IN_ONLY` already covers the address.
- **Why:** A separate page leaves the self-paced checkout page as it is, and
  is where the learner reads the refund terms before paying.

#### 6.5 `apps/learner/src/app/checkout/success.tsx` (Modify)

- **Change:** When the sync answer is paid with a `classId`, show the class
  confirmation and link to `/class/<enrollmentId>`. When it is `seat_lost`,
  say that the seat was lost and the payment is being returned in full, with a
  link back to the course page.
- **Why:** "Start learning" is wrong for a class three weeks away, and "Your
  seat is booked" is wrong for a seat that was lost.

#### 6.6 `apps/learner/src/app/class/[enrollmentId].tsx` (Modify)

- **Change:** Show the seat's state from `LearnerSeat`: the amount, or the
  rate while the amount is null, and the deadline for withdrawal, with a
  "Withdraw" action and a confirmation step; "Withdrawal has closed"; "You
  were moved to this class" or "This class's times changed", each with the
  full-refund right while it lasts; each open manual mark with its dispute
  deadline and Part 1's dispute action; the latest refund's state; and, for a
  cancelled class, which of the three cancelled states applies.
- **Why:** This is the one screen where a learner sees what they are owed and
  until when.

#### 6.7 Learner tests (Create two)

- **Change:** `apps/learner/src/__tests__/class-checkout.test.tsx`: the
  summary and the terms are shown before the pay button; each error shows its
  message; a full class has no button; the seat-lost confirmation.
  `apps/learner/src/__tests__/class-seat.test.tsx`: withdrawal shown with its
  amount and deadline, with a rate when the amount is null, and hidden after
  the deadline; the moved, times-changed, refund-on-its-way and three
  cancelled states; an open manual mark with its deadline.
- **Why:** These screens carry the learner-side rules.

### Phase 7: Teach portal

**Built on 2026-11-25**, in the working tree.

**As built.** Where the build found an entry wrong or silent:

- The card shows all 32 held-payout terms, since every term binds the
  profile, taken from `docs/terms/held-payout-terms.md`; the opening drops
  the note that the design says "block", and term 23 is split into two
  sentences. The terms say "session" where the Teach class pages say
  "Block"; one word should be chosen. The Chinese needs the author's
  sign-off.
- The edit page is `form.tsx`, as Part 1 built it. The sign-in prompt for a
  recent sign-in is shared through a new `useSignInAgain()`.
- Cancelling is disabled, with a warning, while a seat has a refund under
  way. The cancel dialog counts the part refunds for learners counted as
  attended (G12).
- **Added after the build:** `ClassDetail.releasedAt`, so "Cancel class"
  is hidden once the class's money is released; and a sentence on the
  Payments card for an opted-in profile, that Elevate pays out once a day
  and holds class money until 7 days after each class.
- The earnings page treats a profile as opted in when its payout mode is
  `manual`; `EarningsView` has no such flag. A failed payout does not say
  why.

**Ends with:** `npx turbo run typecheck build` passing.

#### 7.1 `packages/i18n/src/messages/areas/teachSettings.en.ts` and `teachSettings.zh.ts` (Modify)

- **Change:** Add the class-sales card: its title; the held-payout terms as
  whole sentences, including that all payouts are then made by Elevate once a
  day and how leaving works; "Accept and start selling classes"; the accepted
  state with its date; the `switching` state, "Finishing set-up"; "Stop
  selling classes", its confirmation, and the notice state with the leave
  date.
- **Why:** The Teach Settings page is translated.
- **Before production:** a lawyer reads the terms and the author signs off the
  Chinese text. Neither blocks this phase. The source text is
  `docs/terms/held-payout-terms.md`; the catalog follows it.

#### 7.2 `apps/teach/src/lib/keys.ts` and `apps/teach/src/lib/classes.ts` (Modify)

- **Change:** `keys.ts`: add `classKeys.seats(profileId, id)`,
  `classKeys.moveTargets(profileId, id, enrollmentId)` and
  `classKeys.sales(profileId)`. `classes.ts`: add `useClassSales`, `useSeats`,
  `useMoveTargets`, and to `useClassActions`: `acceptClassSales`,
  `leaveClassSales`, `cancelClass`, `moveSeat`, `refundSeat`.
- **Why:** Hooks and keys for the new routes, in the files Part 1 created.

#### 7.3 `apps/teach/src/routes/settings.tsx` (Modify)

- **Change:** Add the class-sales card, shown to the owner when
  `classesEnabled`. It shows the terms and the accept action, or the accepted
  state. A `reauth_required` answer is handled as the Stripe link buttons
  handle it. In the accepted state the owner can give notice to leave; the
  card then shows the leave date.
- **Why:** The owner opts in and leaves here, after reading the terms.

#### 7.4 `apps/teach/src/routes/classes/detail.tsx` and `apps/teach/src/routes/classes/edit.tsx` (Modify)

- **Change:**
  - `detail.tsx`, for `earnings.read`: a seats table (learner, status, paid,
    refunded, "counted as attended" or "manual mark open until", refund
    state) with, for `class.manage`, "Move" and, for `class.refund`, "Refund"
    on rows where `canMove` or `canRefundUpToCents` allows it. For
    `class.manage`: "Cancel class", hidden once the class is released. A
    cancelled class shows its reason and each refund's state. A class not on
    sale shows `notOnSaleReason` in words. A published in-person class shows
    that its venue address is public on the course page.
  - `edit.tsx`: before saving a change to a block's time on a class where
    `seatsWithChangeRight` is above zero, a confirmation that names that
    number of learners and says each can then withdraw with a full refund.
- **Why:** The page from which a profile sells, moves, refunds and cancels. A
  small time edit can cost the profile several seats, so it is told before it
  saves.

#### 7.5 `apps/teach/src/components/seat-dialogs.tsx` (Create)

- **Change:** Three dialogs built from `Dialog`, `Field`, `Input`,
  `NativeSelect` and `Textarea`:
  - cancel: a reason, and three counts worked out from the seats table: how
    many learners will be refunded in full, how many have an open manual
    mark, and how many are counted as attended and will not be refunded;
  - move: the targets from `useMoveTargets`, with the problems shown for
    those that do not qualify;
  - refund: an amount up to the maximum, and a reason.

  The cancel and refund dialogs handle `reauth_required`.
- **Why:** Each action needs input, and the owner must see who is refunded
  before confirming.

#### 7.6 `apps/teach/src/routes/earnings.tsx` (Modify)

- **Change:** For an opted-in profile, replace the line "Payouts land in your
  bank on Stripe's schedule" with: the held total; a table of held classes
  with each one's release date or what it waits for; any debt not yet covered;
  and the recent payouts, each opening to the payments and adjustments it
  paid.
- **Why:** A profile must be able to see what is held, when it is due, and
  which sales a payout covered.

### Phase 8: Support portal

**Built on 2026-11-25**, in the working tree.

**As built.** Where the build found an entry wrong or silent:

- The Payouts item shows only when classes are on, next to Classes. Retry
  and Close appear only on `failed` rows and only for a super admin; Retry is
  hidden for a refund Stripe failed, which says the learner is refunded
  another way (G6). "Add correction" is offered on the unnamed-money rows. A
  released class can still be cancelled by Elevate.
- `TransactionDetail` gains `class`, `seatStatus`, `bankDisputeStatus`,
  `released`, `paidOut` and `seatRefunds`; `seat-refunds.test.ts` covers
  them, added after the build. "Refund in full" is disabled while a seat
  refund is unfinished.
- `nav.payouts` is 提现 in Chinese, as Support's profile area already says;
  it needs the author's sign-off.

**Ends with:** `npx turbo run typecheck build` passing, and then the local
walkthrough below.

#### 8.1 `apps/support/src/lib/queries.ts` (Modify)

- **Change:** Add `usePayoutsOverview`, and the actions `clearReview`,
  `cancelClassByElevate`, `refundRowAction` and `addCorrection`.
- **Why:** Support's hooks live in this file.

#### 8.2 `apps/support/src/routes/payouts.tsx` (Create), `apps/support/src/router.tsx` and `apps/support/src/routes/layout.tsx` (Modify)

- **Change:** A page at `payouts`, with one section for each list in
  `SupportPayoutsOverview`: the last finished run, with a warning when
  `stale`; classes under review, each with "Clear review" for a Support admin
  and the note that the class is released on the next run; refunds needing
  attention, each with "Retry" and "Close" for a Support admin; cancellations
  not yet complete; payments released by the day limit; failed payouts;
  profiles with unnamed money, each with "Add correction" for a Support admin;
  and the recent runs. Add the route and a nav item `t('nav.payouts')`.
- **Why:** The one place Support sees the job's state and the cases that need
  a person.

#### 8.3 `packages/i18n/src/messages/areas/chrome.en.ts` and `chrome.zh.ts` (Modify)

- **Change:** Add `nav.payouts`.
- **Why:** The portals' navigation is translated.

#### 8.4 `apps/support/src/routes/class-view.tsx` and `transactions.tsx`, `apps/api/src/services/transactions.service.ts` and `packages/core/src/contracts/support.ts` (Modify)

- **Change:** `class-view.tsx`: "Cancel class (Elevate)" for a Support admin,
  with a reason and the statement that every seat is refunded in full.
  Support's transaction detail, in the service and its contract type, gains
  for a class payment: `class: { id, name } | null`, `seatStatus`,
  `bankDisputeStatus`, `released`, `paidOut` and `seatRefunds:
  SeatRefundView[]`. `transactions.tsx` shows them, and disables "Refund in
  full" with the reason when a seat refund row is unfinished.
- **Why:** Support must see a seat's refund state before acting on its
  payment. If the contract file for Support's transaction detail has another
  name, the entry applies to the file that declares that type.

### Phase 9: Infrastructure and deploy

**Built on 2026-11-25**, in the working tree. `terraform fmt`, `validate` in
both environments and actionlint pass through Docker. Nothing was planned
or applied in AWS.

**As built.** Where the build found an entry wrong or silent:

- **9.8:** The deploy points the schedule at the new release task version
  after "Roll the service", not straight after registering it, so a
  scheduled run never starts new code before the migrations have run, and a
  failed migration or roll leaves the job on the old version. The step
  copies back what `get-schedule` returns except the task, leaving out empty
  values the CLI refuses. The register step stops when
  `ECS_RELEASE_TASK_FAMILY` or `RELEASE_SCHEDULE_NAME` is missing.
- **9.2:** A start is retried for up to 900 seconds and then goes to the
  dead-letter queue, which keeps messages 14 days. The scheduler's role
  trusts this account only.
- **9.3:** A fourth alarm fires on `release_run_failed`, sooner than the
  30-minute alarm. The topic is not encrypted, because CloudWatch alarms
  cannot publish to a topic under the AWS-managed SNS key; the emails hold
  only alarm and metric names. Nothing is sent when an alarm clears. The
  release task logs to the API's log group.
- **9.4:** The release task joins the existing `EcsRunMigration` statement.
- **9.5, 9.7:** `alarm_email` is required, so each environment's untracked
  `terraform.tfvars` needs the line before its next apply.
- **Before the first deploy that carries this:** add `alarm_email` to the
  environment's `terraform.tfvars`; plan and apply from a clean checkout;
  copy `github_environment_variables` into the GitHub environment again;
  confirm the subscription email; deploy, which points the still-disabled
  schedule at the release task; then set `release_schedule_enabled = true`
  and apply, and expect a `release_run_finished` line within 15 minutes. Do
  not enable the schedule before that deploy, when it still points at the
  placeholder image.

**Ends with:** Terraform validated and the workflow linted, through Docker.
Nothing is applied to AWS in this phase.

#### 9.1 `infra/terraform/modules/environment/api.tf` (Modify)

- **Change:** Add `CLASS_SALES = tostring(var.class_sales)` to
  `api_environment`. Add `aws_ecs_task_definition.release`, family
  `${local.prefix}-release`, with the API task's sizing, roles, runtime
  platform, image, environment, secrets and log configuration, the same
  container name, no port mappings, and the command `["node",
  "dist/release.js"]`.
- **Why:** The job needs the API's settings and its restricted database user,
  and a schedule cannot change a task's command. Like the API's task
  definition, the one Terraform declares carries the placeholder image; the
  deploy registers the real one.

#### 9.2 `infra/terraform/modules/environment/scheduler.tf` (Create)

- **Change:**
  - An SQS standard queue `${local.prefix}-release-dlq`.
  - An IAM role that `scheduler.amazonaws.com` can assume, allowed
    `ecs:RunTask` on the release task family in this cluster, `iam:PassRole`
    on the API's execution and task roles, and `sqs:SendMessage` on the queue.
  - An `aws_scheduler_schedule` named `${local.prefix}-release`, with
    `rate(15 minutes)`, the flexible window off, the ECS target (the cluster,
    the release task definition, Fargate, the API's subnets and security
    group, and a public address as Part 1's migrate task has), up to 2
    retries, the dead-letter queue, and its state from
    `var.release_schedule_enabled`. It has `lifecycle { ignore_changes }` on
    the target's task definition ARN.
- **Why:** The schedule starts the job. Terraform creates it once, pointing at
  the placeholder and switched off. After that only the deploy changes which
  version it starts, so a later `terraform apply` cannot point it back at a
  placeholder image.

#### 9.3 `infra/terraform/modules/environment/alarms.tf` (Create)

- **Change:**
  - An SNS topic `${local.prefix}-release-alarms` with an email subscription
    to `var.alarm_email`.
  - Two metric filters on the API's log group: one counts lines whose `event`
    is `release_run_finished`; one takes the value of `needingAttention` from
    those lines.
  - Three alarms that send to the topic: the count of finished runs is below 1
    over 30 minutes, with missing data treated as breaching, created only when
    `var.release_schedule_enabled` is true; the largest `needingAttention`
    over 15 minutes is above 0; and the dead-letter queue has a visible
    message.
- **Why:** A schedule's retry covers a task that fails to start, not one that
  starts and fails, and a stopped job stops every refund. These are the
  repo's first alarms.

#### 9.4 `infra/terraform/modules/environment/iam.tf` (Modify)

- **Change:** In the deploy role: allow `ecs:RunTask` on the release task
  family, in the statement that allows it on the API's and migrate families;
  and add a statement allowing `scheduler:GetSchedule` and
  `scheduler:UpdateSchedule` on the release schedule, and `iam:PassRole` on
  the scheduler's role.
- **Why:** The deploy points the schedule at each new version, and an engineer
  must be able to start a run by hand from the deploy role.

#### 9.5 `infra/terraform/modules/environment/variables.tf` and `outputs.tf` (Modify)

- **Change:** `variables.tf`: add `class_sales` (boolean, default false),
  `release_schedule_enabled` (boolean, default false) and `alarm_email`
  (string). `outputs.tf`: add `ECS_RELEASE_TASK_FAMILY` and
  `RELEASE_SCHEDULE_NAME` to `github_environment_variables`.
- **Why:** The two switches, the address the alarms write to, and the names
  the workflow reads.

#### 9.6 `infra/terraform/envs/staging/main.tf` and `infra/terraform/envs/production/main.tf` (Modify)

- **Change:** In each, declare and pass `class_sales`,
  `release_schedule_enabled` and `alarm_email`.
- **Why:** Each environment sets its own switches and its own address.

#### 9.7 `infra/terraform/envs/staging/terraform.tfvars.example` and `infra/terraform/envs/production/terraform.tfvars.example` (Modify)

- **Change:** Add commented `class_sales`, `release_schedule_enabled` and
  `alarm_email`, with one line each on when to set them.
- **Why:** The examples document each setting.

#### 9.8 `.github/workflows/deploy.yml` (Modify)

- **Change:** Add `ECS_RELEASE_TASK_FAMILY` and `RELEASE_SCHEDULE_NAME` from
  `vars`. In "Register the task definition", register a new version of the
  release family with the built image. Add a step after it, "Point the
  release schedule at the new version": read the schedule with `aws scheduler
  get-schedule`, replace the task definition ARN in its target, and write it
  back with `aws scheduler update-schedule`, keeping its state, expression,
  retry policy and dead-letter queue as read.
- **Why:** The API service, the migrate task and the release task must run the
  same image, and the schedule must start the version just built.

### Phase 10: Documents

**Ends with:** `npm run lint` passing.

#### 10.1 `docs/adr/013-class-sales-and-held-payouts.md` (Create)

- **Change:** Record: a seat is a class enrollment and an unpaid one is the
  reservation; opting in per profile switches that Stripe account to manual
  payouts, and leaving on 30 days' notice switches it back once nothing is
  held; class money stays in the
  profile's account, and why Elevate's own balance was not used; the three
  bounds on a payout and the mark on each payment; the refund table, Stripe's
  real fee, and that `seatRefund()` and `profileShareAfterRefunds()` are the
  only places these are computed; that only the release job sends a refund or
  a payout; "counted as attended"; the 85-day limit; that it extends ADR 003
  and ADR 007 for opted-in profiles and leaves them unchanged for others. If
  013 is taken when this is written, use the next free number.
- **Why:** These decisions change the payment model for some profiles.

#### 10.2 `docs/adr/003-payments-destination-charges.md` and `docs/adr/007-payout-accounts.md` (Modify)

- **Change:** One line in each pointing to the new ADR for class sales and
  manual payouts.
- **Why:** A reader of the older records must find the newer one.

#### 10.3 `docs/spec.md` (Modify)

- **Change:** Under the dated decision Part 1 adds, note that classes are sold
  as of this design, and add class payments, held payouts, seat refunds and
  payout adjustments to the data model summary.
- **Why:** The spec is the product's summary.

#### 10.4 `AGENTS.md` (Modify)

- **Change:** Add to "Rules":
  - a refund of a class seat is a `seat_refunds` row written by
    `SeatRefundsService.request`, and its amounts come only from
    `seatRefund()` in `money.ts`;
  - no request handler calls Stripe to refund, reverse or pay out for a class
    seat: only the release job does, through `SeatRefundsService.send` and
    `PayoutsService`;
  - a profile's share of a payment after refunds comes only from
    `profileShareAfterRefunds()`;
  - `seatsTaken` in `class-checkout.service.ts` is the only count of seats;
  - a transaction that locks a class and an enrollment locks the class first;
  - only `PayoutsService` creates a payout or sets `released_run_id` or
    `payout_id`;
  - only `class-checkout.service.ts` and `seats.service.ts` set an
    enrollment's `class_id`;
  - "attended", in a money rule, means `moneyAttendance` in core.
- **Why:** The repo's rules are enforced by being written here.

#### 10.5 `docs/designs/teacher-profiles.md` (Modify)

- **Change:** In the route table (item 1.15), add the seven new Teach routes
  with their capabilities, and `class.refund` to the capability list.
- **Why:** AGENTS.md names that table as the source for every Teach route's
  capability.

#### 10.6 `docs/runbooks/stripe.md` and `docs/runbooks/deploy.md` (Modify)

- **Change:** `stripe.md`: add the four new event types to the `stripe listen`
  command. `deploy.md`: add `charge.dispute.created` and
  `charge.dispute.closed` to the platform endpoint's events, and `payout.paid`
  and `payout.failed` to the Connect endpoint's; add the two Express dashboard
  features to turn off, and the check that a class payment page's methods
  are Card and PayNow and no other.
- **Why:** A handler for an event the endpoint is not subscribed to is never
  called. Payout events belong to the connected account, so they arrive on the
  Connect endpoint.

#### 10.7 `infra/README.md` (Modify)

- **Change:** Describe the release task, its schedule and its alarms; how to
  read a run from the Support payouts page and from the logs; how to start a
  run by hand; how to point the schedule back at the previous version; what
  to do with a message in the dead-letter queue and with each alarm; that the
  schedule must not be disabled while any profile is opted in; the last
  resort of paying a profile from the Stripe dashboard and recording a
  correction; and the rollout order.
- **Why:** Operators run and repair the job from these notes.

### Verification Plan

**Local walkthrough, run on 2026-11-25.** Steps 1 to 11 passed in a browser
against a throwaway database with the fake payments provider, on a S$189
class: withdrawal refunded S$182.07, the cancellation S$189.00 with the
profile down Stripe's fee, and the payout S$147.83, the self-paced share less
that debt. Every amount matched. It found no wrong amount, and these display
faults, fixed before the commit:

- The Teach earnings cards did not add up, because the part of Elevate's fee
  returned after a refund was not shown. They now show "Elevate's fee
  returned", and "Stripe fees" is the fee estimate inside Elevate's fee,
  since the profile's share is fixed from it (R7). A test checks that the
  parts add up to the net on a withdrawal, a part refund and a
  cancellation. `money.ts` gains `elevateFeeReturned()` and
  `elevateNetAfterRefunds()`.
- A payout listed items of S$0.00 and labelled a debt as a payment; a
  withdrawn seat showed "Cancelled"; a seat showed "Refunded" before its
  refund was sent; a cancelled class still offered "Run block".
- Support's payment page read "Released: No, held" beside "Paid out: Yes"
  for a debt taken from a payout, and showed nets before refunds only.
- The receipt's withdrawal deadline had no time, and Support's run times no
  time zone.
- A cancelled class still served check-in codes and took check-ins. It now
  answers `class_cancelled` to both; a learner can still dispute a mark.

Not fixed: Support cannot see which profile a payout went to, which the
design does not ask for.

- **Compilation/Build**: `npx turbo run typecheck build`.
- **Unit Tests**: `npx turbo run test`.
- **Static Analysis & Linting**: `npm run lint` and `npm run check:dupes` at
  the root; `npx expo-doctor` inside `apps/learner`.
- **Terraform**: from `infra/terraform`, `docker run --rm -v "$PWD":/w -w
  /w/envs/staging hashicorp/terraform:latest init -backend=false`, then the
  same with `validate`; repeat for `envs/production`.
- **Workflow**: from the repo root, `docker run --rm -v "$PWD":/repo -w /repo
  rhysd/actionlint:latest`.

**Goals and what proves them.** Test files are in `apps/api/test/` unless
marked "core" (`packages/core/test/`) or "learner".

| Goal                                                        | Proved by                                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A learner can buy a seat                                    | `class-checkout.test.ts`; walkthrough step 2                                                          |
| A class never has more seats than its capacity              | `class-checkout.test.ts` (last seat, ended reservation, lost seat); `classes.test.ts` (capacity)      |
| Self-paced and a seat together                              | `class-checkout.test.ts`; `class-entitlement.test.ts` from Part 1                                     |
| Self-paced checkout does not change                         | `checkout.test.ts`, existing and the added test                                                       |
| Refund terms shown before paying                            | learner `class-checkout.test.tsx`; `class-checkout.test.ts` (stale version); walkthrough step 2       |
| The learner is told what they bought                        | `class-checkout.test.ts` (receipt); walkthrough step 2                                                |
| A profile sells only after opting in                        | API `class-sales.test.ts`, `class-checkout.test.ts`                                                   |
| Not paid until 7 days after the class, nor with a mark open | `payouts.test.ts`; core `class-sales.test.ts`                                                         |
| Self-paced money paid once a day                            | `payouts.test.ts`                                                                                     |
| No person presses a button to pay                           | `release.test.ts`, `payouts.test.ts`; walkthrough steps 10 and 11                                     |
| A payout never exceeds what the database names              | `payouts.test.ts` (unnamed money); core `class-sales.test.ts` (`choosePayoutItems`)                   |
| No money held past 85 days                                  | `payouts.test.ts`                                                                                     |
| Cancelling, and the attendance rule                         | `seats.test.ts`, `seat-refunds.test.ts`; core `attendance.test.ts`                                    |
| Withdrawal                                                  | `seats.test.ts`; core `class-sales.test.ts`; walkthrough steps 4 and 5                                |
| Moving                                                      | `seats.test.ts`                                                                                       |
| A changed block time gives notice and a right               | `classes.test.ts`; walkthrough step 6                                                                 |
| Elevate's cancellation                                      | `seats.test.ts`                                                                                       |
| Refunds are sent by the job only                            | `seat-refunds.test.ts`, `release.test.ts`; walkthrough steps 5 and 8                                  |
| Elevate's money is not reduced by a refund it did not cause | core `money.test.ts`; `seat-refunds.test.ts`, `fake-payments.test.ts`; rollout step 13 against Stripe |
| A refund that ends a seat frees it                          | `seats.test.ts`, `seat-refunds.test.ts`                                                               |
| A learner is told of a manual mark                          | `attendance.test.ts`                                                                                  |
| Bank disputes, before release and after payout              | `bank-disputes.test.ts`                                                                               |
| A class with no counted attendance is not released          | `payouts.test.ts`                                                                                     |
| One alarm emails a person                                   | Terraform `validate`; rollout step 14                                                                 |
| Selling can be switched off; the job cannot                 | Rollout step 15                                                                                       |

**Local walkthrough**, after Phase 8, with the fake payments provider,
`CLASSES`, `CLASS_SALES` and `DEV_ENDPOINTS_ENABLED` on, and `npm run db:seed`.
Sign-in codes and emails come from the API log. "Run the job" means `curl -X
POST localhost:4400/api/dev/release-run`.

1. As the demo owner, open Settings in Teach and accept the class-sales
   terms. Expect the accepted state and a "Stop selling classes" action (G16).
   Create and publish a class with a capacity of 2 and two blocks, three weeks
   ahead. Expect it to show as on sale.
2. As learner A on the web, open the course page. Expect the class under "Take
   it as a class" with "2 seats left". Choose it. Expect the refund terms above
   the pay button. Pay. Expect "Your seat is booked" with the dates, and a
   receipt in the mail output naming the class.
3. As learner B, start checkout and stop at the payment page. As learner C,
   try to book. Expect "This class is full". Then finish B's payment.
4. As learner A on the web, open the class. Expect the withdrawal amount, which
   is the price less the fake's Stripe fee, and the deadline. Withdraw. Expect
   "Refund on its way", and the course page to show "1 seat left".
5. Run the job. Expect A's class screen to show "Refunded" with the same
   amount, and a withdrawal email in the mail output.
6. As the demo owner, open the class. Expect the seats table with B active and
   A withdrawn. Move block two by one hour. Expect the confirmation to say 1
   learner can then withdraw with a full refund. Save. Expect a
   times-changed email to B in the mail output.
7. Cancel the class. Expect the dialog to say 1 learner will be refunded in
   full, 0 have an open manual mark and 0 are counted as attended. Confirm.
   Expect the class shown as cancelled and gone from the course page.
8. Run the job. Expect B's refund shown as done on the class page, and a
   cancellation email to B.
9. As Support, open Payouts. Expect the last run listed, no refund needing
   attention and no open cancellation.
10. As learner C, buy the same profile's self-paced course. Run the job with
    `now` set to 10:00 Singapore time the next day. As Support, expect one
    payout for the demo profile.
11. As the demo owner, open Earnings. Expect a held total of S$0.00 and one
    payout that lists two items: C's sale, and a debt equal to the fake's
    Stripe fee on B's cancelled seat.

**Rollout and rehearsal on staging**, after Phase 10, with the author's
go-ahead and a Stripe test-mode account. The numbers continue from the
walkthrough. Terraform names are used for the switches; a change to one needs
an apply and then a deploy to reach the running task.

12. In the Stripe sandbox: turn off the two Express dashboard features and add
    the four event types to
    the two endpoints, as `docs/runbooks/deploy.md` says. In `envs/staging`,
    apply with `class_sales` and `release_schedule_enabled` both false and
    `alarm_email` set. Confirm the subscription email. Copy the
    `github_environment_variables` output into the staging GitHub
    environment's variables. Deploy. Set `release_schedule_enabled = true` and
    apply. Expect a run on the Support payouts page every 15 minutes. Deploy
    once more, and confirm in the ECS console that the next run's task uses
    the version just registered.
13. Set `class_sales = true`, apply and deploy. Opt in one profile whose
    Stripe account has passed the liveness check. Open a class payment page
    and expect Card and PayNow and no other method. With Stripe's test cards,
    repeat walkthrough steps 1 to 9, waiting for scheduled runs. Buy one more
    seat with PayNow and withdraw it. After each
    refund kind, compare the profile's Stripe balance with the amounts table
    under "Refunds", using the fee Stripe charged. To release a class, buy a
    seat first and then set its block dates in the staging database to more
    than 7 days ago, with a check-in row for the learner. Expect the class
    released at the next run and a payout in Stripe's dashboard after 10:00.
    Open a test bank dispute on one payment with Stripe's dispute test card
    and expect the lost case to take the share back.
14. Rehearse the alarm: stop one run's task by hand and expect no alarm;
    disable the schedule outside Terraform, in the console or with the CLI,
    and expect the email within 45 minutes; enable it again. Setting
    `release_schedule_enabled = false` would also delete the 30-minute alarm
    being rehearsed (Phase 9's notes; `infra/README.md`).
15. Rehearse the ways back: set `class_sales = false`, apply and deploy, and
    expect no class on sale while an existing seat can still check in and
    withdraw and its refund is sent; point the schedule at the previous
    version of the release task and back; 35 minutes after `class_sales` went
    off, deploy Part 1's version of the API and expect the app to work with no
    class on sale while runs continue; deploy this version again.
16. Production, only after: Stripe's support has answered how the 90 days are
    counted; a lawyer has read both sets of terms; the author has signed off the Chinese text; and step 13 matched
    the amounts table. Then repeat step 12 in live mode with production's
    names, run `plan` in `envs/production` and confirm it shows only the
    release task definition, the queue, the scheduler role, the schedule, the
    topic, the filters and the alarms. Apply, copy the variables, deploy, turn
    on the schedule, then `classes`, then `class_sales`, and invite the beta
    profiles.

---

_Drafted with EGM_
