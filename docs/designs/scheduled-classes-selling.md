# Scheduled Classes, Part 2: Selling a Class

- **Author:** skypad123
- **Status:** Proposed
- **Date:** 2026-11-24

---

## Overview

Elevate sells self-paced online courses. The scheduled-classes RFC
([scheduled-classes-brief.md](./scheduled-classes-brief.md)) adds
classes: one run of a course at fixed dates, taught in real time by one
instructor to a limited group of learners, at a venue or remotely.

The author split the RFC into three designs, one per release:

| Part              | Covers                                                                                                                                                          | Status                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1                 | Class and attendance records, a class as its own enrollment, class setup, check-in, the roster and code screens.                                                | Designed in [scheduled-classes-attendance.md](./scheduled-classes-attendance.md). Phase 1 of its seven build phases is built. |
| 2 (this document) | Selling a class: the class choice on the course page, class checkout with seat holds, payouts held until after the class, cancellation, withdrawal and refunds. | This draft.                                                                                                                   |
| 3                 | The class page, materials the teacher shares, class progress and certificate, and change notices.                                                               | Not drafted.                                                                                                                  |

Part 1 leaves classes as seeded test data: no route creates a class
enrollment. Part 2 adds the only way into a class, which is to buy a seat, and
with it the first real learners, real attendance records and real money held
on a teacher's behalf.

**How this document is written.** The author directs the design and makes the
product decisions. An AI assistant drafts the text and makes the mechanical
choices, which the Technical Plan marks "Drafting".

### Words used in this document

Part 1's word list applies. Part 2 adds:

| Word            | Meaning                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Seat            | One learner's place in one class. In the data it is a class enrollment.                                                         |
| Seat hold       | A seat kept for a learner who has started paying and not yet finished.                                                          |
| Opted in        | A teaching profile whose owner has accepted the held-payout terms, so it can sell classes.                                      |
| Held            | Money from a class sale that sits in the teacher's Stripe balance and is not yet paid out to their bank.                        |
| Release         | The point at which a class's money stops being held.                                                                            |
| Run             | One execution of the release job.                                                                                               |
| Cancel          | The teaching profile, or Elevate, ends a class for everyone.                                                                    |
| Withdraw        | One learner gives up their own seat.                                                                                            |
| Attended        | A learner has a check-in or a manual mark that stands for at least one block of the class, as Part 1 defines "stands".          |
| Stripe's fee    | What Stripe charges Elevate to process a card payment, 3.4% plus S$0.50 by default. Stripe keeps it when a payment is refunded. |
| Teacher's share | The part of a payment that goes to the teacher: the amount paid, less Stripe's fee, less Elevate's commission.                  |

## The Problem

After Part 1, a teaching profile can set up a class and run its attendance, and
nobody can be in it. The author decided that a class is a separate product from
the self-paced course and that the only way into one is to buy a seat. Selling
a seat does not work with the payment system as it stands, for four reasons.

- **Checkout knows one enrollment per learner per course.** It finds "the
  learner's enrollment for this course" and refuses anyone who has one.
- **Nothing limits how many people can buy.** A payment page stays open for 30
  minutes. Two learners can both be paying for the last seat, and the only
  remedy today is to refund one of them, at Elevate's cost.
- **The teacher is paid the moment a learner pays.** That is safe for a course
  delivered at once. A class is sold weeks before it runs. If it is cancelled,
  the refunds pull money back from a teacher who may already have withdrawn it,
  and Elevate carries the shortfall. On a S$500 seat the teacher's share is
  S$410.12; a cancelled class of 20 is about S$8,200.
- **A refund can only be for the full amount, and it always costs Elevate
  Stripe's fee.** The author decided that whoever ends a seat bears that fee.
  The refund code cannot send a part amount, cannot keep the fee back from a
  teacher, and has no notion of a seat to free.

The proposed solution has four parts: a class choice on the course page that
leads to a class checkout with a seat held while the learner pays; class money
held in the teacher's own Stripe balance until 7 days after the class, with a
scheduled job that pays out what is due; cancellation, withdrawal and
discretionary refunds that follow the author's rules and free the seat; and the
checks that stop the new money flow being abused.

## Goals

Each goal names how it is checked. The Verification Plan will map each one to a
test or a staging step.

- **A learner can buy a seat in a published class** of an opted-in profile, from
  the existing course page, at the course price, and only through checkout.
  Paying creates the class enrollment; nothing else does.
- **A class never has more learners than seats.** A seat is held from the
  moment checkout starts until the payment completes or the payment page
  expires. Two learners racing for the last seat end with one seat sold and one
  learner told the class is full before they pay.
- **A learner can own the self-paced course and a seat in a class of the same
  course.** They are two purchases with separate progress and separate
  certificates, and buying one never refuses or refunds the other.
- **Existing self-paced checkout does not change.** A request with no class
  behaves as it does today, including from an app installed before this
  release.
- **A profile sells classes only after its owner opts in.** Until then its
  Stripe payouts work exactly as today.
- **An opted-in teacher is not paid for a class until 7 days after its last
  block.** Class money stays in the teacher's Stripe balance. Money from the
  same teacher's self-paced sales is paid out at most one day later than Stripe
  would have paid it.
- **Held money is released by a scheduled job, with no person pressing a
  button.** Each run records the balance, the held total and the classes that
  became due, and marks each payment of a due class as released in that run.
- **A wrong held total cannot pay money out.** Each run works out the held total
  by two independent routes. If they differ for a teacher, that teacher is paid
  nothing in that run and the difference is shown to Support.
- **The profile's owner or a manager can cancel a class at any time.** Every
  learner who has not attended is refunded in full, and the teacher bears
  Stripe's fee for each refunded seat. The cancellation can be resumed if it
  stops part-way, and each seat's refund is recorded.
- **Once a learner has attended a block, no refund is automatic.** This holds
  when the learner asks to leave and when the class is cancelled. From then on
  a refund is granted only by the profile's owner or a manager, at their
  discretion, until the class's money is released.
- **A learner who has not attended can withdraw until 7 days before the first
  block** and is refunded the amount paid less Stripe's fee. The seat is free
  for someone else at once.
- **The owner or a manager can move a learner who has not attended** to another
  of the profile's classes for the same course. The learner is told by email
  and can withdraw with a full refund until the new class starts.
- **When Elevate cancels a class, every learner is refunded in full** and
  Elevate bears Stripe's fee.
- **Elevate does not lose money on a refund it did not cause.** For a teacher's
  cancellation, a learner's withdrawal and a discretionary refund, Elevate's
  net on the seat is zero or more.
- **Every refund path frees the seat**, including a refund Support makes and a
  refund made in the Stripe dashboard.
- **A bank dispute on a seat keeps that seat's money held.** If the learner
  wins, the teacher's share for that seat is taken back and the seat is closed.
- **A class with no recorded attendance is not released** until Support has
  looked at it.
- **The refund terms are shown to the learner before they pay**, in English and
  Chinese.
- **A learner who buys a seat is told what they bought**: the confirmation page
  and the receipt show the class's dates, times and place.
- **The first deploy that sells classes is safe to roll back to Part 1's
  version**, and no version older than Part 1's is deployed afterwards.
- **Before a real learner checks in:** database backups are kept for 35 days; a
  room of learners can sign in on one network; one learner's coordinates can be
  erased through a recorded step; and each Support view of coordinates is
  recorded.

## Non-Goals

- **The class page, class materials, class progress and the class
  certificate.** Part 3. After Part 2 a class learner can check in and see
  their attendance, and can open no lessons through the class.
- **The switch that opens a cancelled class's materials.** Part 3, with the
  materials themselves.
- **Change notices and reminders.** Part 3. Part 2 sends only the emails a
  purchase, a refund, a cancellation or a move needs.
- **Joining details for a remote class.** The instructor sees learners' emails
  on the roster and writes to them.
- **Grant money in the payment flow.** No SSG claim and no subsidy at checkout.
- **A price per class**, and **a separate catalog listing for a class**.
- **Placing a learner in a class without a sale.**
- **A learner moving their own seat.**
- **Holding class money in Elevate's own balance.**
- **Charging a learner Stripe's fee when the profile or Elevate cancels** a
  class the learner has not attended.
- **A minimum-attendance rule**, or releasing money by attendance share.
- **A ceiling on price times seats per profile.**
- **A cap on how often a profile may cancel.**
- **Changing the commission, the fee calculation or how self-paced sales are
  charged.**

## Open Questions

- **The wording of the held-payout terms** a profile's owner accepts, and of
  the refund terms a learner sees before paying. Both need a lawyer. The
  Chinese text needs the author's sign-off.
- **Whether Stripe allows the refund sequence this design depends on**: a
  refund with the transfer reversed and Elevate's fee kept, followed by a part
  refund of that fee to the teacher. Stripe's documentation confirms each piece
  and does not say they can be combined. Needs a test in a Stripe sandbox
  before Phase 4 of the plan. If it fails, the fallback is under "Refunds".
- **What Stripe does when a reversal is larger than the teacher's available
  balance**, and whether a reversal can draw on money that is still pending.
- **Whether Stripe's 90-day limit on held money is counted from each payment.**
  The design assumes it is, which is the strictest reading.
- **Whether a schedule can target a task definition without naming a
  revision**, so that it always runs the latest. If not, the deploy workflow
  must update the schedule; see "The release job".
- **Whether Singapore consumer rules or SSG's rules require anything of a
  refund when a provider cancels**, and whether locking a refund after one
  attended block is enforceable when the provider cancels the rest. The RFC's
  check found no rule either way. Needs a lawyer before real learners buy.
- **How SSG pays a subsidy**, to whom and when. The author pictures a learner
  paying the net fee. Nothing here has been verified with SSG.

## Critical User Journeys (CUJs)

### CUJ 1: A profile opts in

- **Given**: An approved profile with a working Stripe account and automatic
  payouts.
- **When**: The owner opens Settings in Teach, reads the held-payout terms and
  accepts them.
- **Then**: The acceptance is recorded with its time, the owner and the terms
  version. The profile's Stripe account is switched to manual payouts. From the
  next run, the release job pays this teacher.

### CUJ 2: A learner buys a seat

- **Given**: A published class of an opted-in profile, with seats left, whose
  first block is three weeks away.
- **When**: The learner opens the course page on the web, sees the class under
  "Take it as a class" with its dates, place and seats left, chooses it, reads
  the refund terms on the checkout page, and pays.
- **Then**: A seat is held from the moment they press pay. On payment the class
  enrollment becomes active, the payment is recorded against the class, and
  the confirmation page and receipt show the class's dates and place. The
  teacher's share sits in the teacher's Stripe balance and is counted as held.

### CUJ 3: Two learners want the last seat

- **Given**: A class with one seat left.
- **When**: Learner A presses pay. Ten seconds later learner B presses pay.
- **Then**: B is told the class is full and is not sent to pay. If A abandons
  the payment page, the seat is free again when A's hold ends, 35 minutes after
  it began.

### CUJ 4: A learner who owns the self-paced course buys a seat

- **Given**: A learner with an active self-paced enrollment in the course.
- **When**: They choose a class on the course page and pay.
- **Then**: They have two enrollments. The course page shows both. Checkout did
  not answer "already enrolled", and the second payment was not refunded as a
  duplicate.

### CUJ 5: A learner withdraws in time

- **Given**: A learner with a seat, who has not attended, ten days before the
  first block. They paid S$500.
- **When**: They open the class in the app and choose "Withdraw", having been
  shown that S$482.50 will be returned.
- **Then**: S$482.50 is refunded to their card, their seat is free at once, the
  teacher's net for the seat is zero and Elevate's is zero. A learner who tries
  the same five days before the first block is told withdrawal has closed and
  that the teaching profile decides.

### CUJ 6: The profile cancels a class that has not started

- **Given**: A class with 12 seats sold at S$500, a week before it starts.
- **When**: The owner chooses "Cancel class" and gives a reason.
- **Then**: The class is cancelled at once and cannot be bought. Within one run
  of the job, each learner is refunded S$500 and emailed. For each seat the
  teacher's balance ends S$17.50 lower than before the sale. Elevate's net is
  zero.

### CUJ 7: The profile cancels after the first block

- **Given**: A five-block class. Ten learners attended block one; two did not.
- **When**: The owner cancels the class before block two.
- **Then**: The two who did not attend are refunded in full. The ten who
  attended are not refunded and are emailed that the class was cancelled and
  that any refund is the teaching profile's decision. The owner then grants
  S$300 to each of the ten from the class's seat list. The class's money is
  released 7 days after the cancellation.

### CUJ 8: The profile moves a learner

- **Given**: A learner with a seat in the March class who has not attended, and
  an April class of the same course with a free seat.
- **When**: The owner moves the learner to April.
- **Then**: The learner's seat and payment now belong to the April class, the
  March seat is free, and the learner is emailed. Until April's first block
  they can withdraw with a full refund, the teacher bearing the fee.

### CUJ 9: A run releases a class

- **Given**: A class whose last block ended 7 days and one hour ago, with
  recorded attendance and no open dispute.
- **When**: The release job runs.
- **Then**: The class and each of its payments are marked released in that run.
  The run records the teacher's balance and the held total, which no longer
  includes this class. The day's payout to the teacher's bank includes it.

### CUJ 10: The two held totals disagree

- **Given**: A fault has left a class payment unmarked although its class was
  released.
- **When**: The release job runs.
- **Then**: For that teacher the run records both totals and the outcome
  "mismatch", and creates no payout. Other teachers are paid as usual. The
  Support payouts page shows the mismatch until a run records matching totals.

### CUJ 11: A class nobody checked in to

- **Given**: A class whose release is due, with no check-in and no manual mark
  for any block.
- **When**: The release job runs.
- **Then**: The class is not released. It appears on the Support payouts page
  as "needs review". A Support admin who releases it gives a reason. If nobody
  does, it is released 85 days after its earliest payment, and flagged.

### CUJ 12: A learner wins a bank dispute

- **Given**: A learner with a seat disputes the charge with their bank before
  the class is released.
- **When**: Stripe reports the dispute opened, and later closed in the
  learner's favour.
- **Then**: From the opening, that seat's money stays held even if the class is
  released. On the loss, the teacher's share for the seat is taken back, the
  seat is closed, and Elevate bears Stripe's fee and the dispute fee.

### CUJ 13: The seat was lost while paying

- **Given**: A learner's hold has expired and the seat has been sold to someone
  else, and then the learner's payment completes.
- **When**: Stripe reports the payment.
- **Then**: The payment is recorded and refunded in full, Elevate bearing the
  fee, and the learner is emailed that the class filled.

## Technical Plan (Architecture)

### Decisions made while drafting

| Question                                     | Decision                                                                                                                           | Decided by                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| When class money is released                 | One release per class, 7 days after its last block ends. Self-paced payouts are not held.                                          | Author                                                                     |
| Refunds after attendance                     | Once a learner has attended a block, no refund is automatic, including when the class is cancelled.                                | Author                                                                     |
| Withdrawal                                   | A learner who has not attended can withdraw until some days before the first block, refunded less Stripe's fee.                    | Author                                                                     |
| Who grants a discretionary refund            | The profile's owner and its managers.                                                                                              | Author                                                                     |
| Who cancels a class                          | The profile's owner or a manager, at any time.                                                                                     | Author                                                                     |
| Moving class                                 | The owner or a manager can move a learner who has not attended. A learner cannot move themselves.                                  | Author                                                                     |
| Who sells                                    | Each profile opts in; the owner accepts the held-payout terms in Teach.                                                            | Author                                                                     |
| Abuse controls                               | The core controls and the release checks. No ceiling on price times seats.                                                         | Author                                                                     |
| Remote joining details                       | Nothing built; the instructor writes to learners.                                                                                  | Author                                                                     |
| Grant flow                                   | The learner pays the net fee; not built here.                                                                                      | Author                                                                     |
| What runs the release job                    | A scheduled one-off task from the API image.                                                                                       | Author                                                                     |
| How a run works out a payout                 | The Stripe balance less what is held, with payments marked released per run, a record per run, and a second held total as a check. | Author                                                                     |
| A lost bank dispute                          | The sale is undone: the teacher's share is taken back.                                                                             | Author                                                                     |
| The number of days before the first block    | 7.                                                                                                                                 | Drafting                                                                   |
| How far ahead a seat can be bought           | Only when the class's last block ends within 75 days.                                                                              | Drafting: Stripe's 90 days, less the 7-day release, less 8 days of margin. |
| Discretionary refunds after release          | Not through Teach. They go to Support, whose refund action is unchanged.                                                           | Drafting: after release the balance may be empty.                          |
| A moved learner                              | Gets an email, and can withdraw with a full refund until the new class starts.                                                     | Drafting: the change was the profile's.                                    |
| Two seats at once                            | A learner may hold seats in two classes of one course.                                                                             | Drafting                                                                   |
| Who can opt in and out                       | Only the owner. A profile can opt out only with no held class money and no published class with seats sold.                        | Drafting                                                                   |
| Promo codes                                  | They work on a class, except that one which makes the price zero is refused.                                                       | Drafting: the author ruled out free seats.                                 |
| Enrol count                                  | Class seats do not count toward a course's enrol count.                                                                            | Drafting                                                                   |
| How often payouts are made                   | At most one payout per teacher per day.                                                                                            | Drafting: each payout is a bank transfer.                                  |
| When refunds are sent                        | A single seat's refund in the request; a cancellation's refunds by the next run.                                                   | Drafting: a cancellation is many Stripe calls.                             |
| A payment that lands after its seat was lost | Refunded in full, Elevate bearing the fee.                                                                                         | Drafting: the existing rule for a duplicate payment.                       |
| The longest any money is held                | 85 days from the payment; then released and flagged.                                                                               | Drafting: Stripe's limit.                                                  |
| Backup retention                             | 35 days in production.                                                                                                             | Drafting: the longest RDS keeps automated backups.                         |
| Sign-in limit                                | 5 requests per email and 300 per network address, per 15 minutes.                                                                  | Drafting                                                                   |

### Where this design departs from the RFC

The RFC was written before these questions were put to the author. Each row is
a later decision by the author; the RFC's text was not changed.

| The RFC says                                                                                            | This design does                                                                                                                                                      | Why                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| "When the teacher cancels a class, the learner is refunded in full and the teacher bears the fee."      | That holds for a learner who has not attended. A learner who has attended a block gets no automatic refund, including when the profile cancels the rest of the class. | Author: once a learner has attended, any refund is at the discretion of the profile's owner and managers.                                          |
| Out of scope: "any automatic refund or payout decision based on attendance."                            | Attendance decides two things: whether a learner's refund is automatic, and whether a finished class is released by the job or waits for Support.                     | Author: the refund lock above, and the release checks chosen from the RFC's own list of abuse controls. There is still no minimum-attendance rule. |
| "After a cancelled class, the teacher can switch on access to that class's materials for its learners." | Cancelling is built here; the switch is not. Class materials do not exist until Part 3.                                                                               | The author's split by release. Until Part 3, a learner in a cancelled class can open nothing through it.                                           |
| Moving class is listed under "Later".                                                                   | A profile's owner or manager can move a learner who has not attended.                                                                                                 | Author.                                                                                                                                            |

### Components

```text
Learner app                         Teach portal                      Support portal
  Course page: "Take it as a class"   Settings: opt in                  Payouts: runs, mismatches,
  Class checkout                      Class page: seats, cancel,          reviews, cancelled classes
  Class screen: withdraw              move, refund                      Transactions: seat refunds
        │                             Earnings: held, payouts                    │
        ▼                                   ▼                                    ▼
┌───────────────────────────────────── API (Hono) ──────────────────────────────────────┐
│ ClassCheckoutService   SeatsService        SeatRefundsService      PayoutsService     │
│ (hold, session,        (withdraw, move,    (one row per refund,    (one run: mark     │
│  fulfilment)           cancel a class)      executed and resumed)   due, check, pay)  │
│          └──────────────── money.ts: seatRefund() ────────────────┘                   │
└────────┬──────────────────────────┬───────────────────────────────┬───────────────────┘
         │ Stripe Checkout,         │ webhooks: payment, refund,    │ Postgres
         │ refunds, fee refunds,    │ dispute, payout               │
         │ payouts, balance         │                               │
         ▼                          ▼                               ▼
      Stripe  ◄──────────────────────────────── release task (same image, every 15 minutes,
                                                 started by EventBridge Scheduler)
```

### Data model

Everything is additive. One enum gains a value.

**`enrollments`** gains `seat_held_until` (timestamp, nullable). A class
enrollment with status `pending_payment` and `seat_held_until` in the future is
a seat hold. Statuses keep their four existing values, so an older app meets
nothing new:

| Status of a class enrollment | Meaning                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending_payment`            | Checkout started. A hold while `seat_held_until` is in the future.                                                                              |
| `active`                     | A seat.                                                                                                                                         |
| `refunded`                   | The seat was refunded in full: class cancelled, Elevate cancelled, a moved learner withdrew, a lost dispute, or the seat was lost while paying. |
| `cancelled`                  | The learner withdrew.                                                                                                                           |

**Seats taken** in a class is the number of its enrollments that are `active`,
or `pending_payment` with `seat_held_until` in the future. It is counted when
read, so a hold ends by the clock and no job releases it.

**`classes`** gains:

| Column                                                  | Notes                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `cancelled_at`, `cancelled_by`, `cancel_reason`         | Set when the class is cancelled. `class_status` gains the value `cancelled`.   |
| `released_run_id`, `released_at`, `release_reason`      | Set by the run that releases the class. The reason is `due` or `stripe_limit`. |
| `review_needed_at`                                      | Set by a run that finds the class due with no attendance.                      |
| `review_cleared_at`, `review_cleared_by`, `review_note` | Set when a Support admin releases a class under review.                        |

**`payments`** gains:

| Column                                        | Notes                                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `class_id`                                    | Set at fulfilment for a class sale; null for self-paced. Follows the seat when a learner is moved. |
| `released_run_id`                             | The run in which this payment stopped being held.                                                  |
| `dispute_id`, `dispute_status`, `disputed_at` | `dispute_status` is `open`, `won` or `lost`.                                                       |

A payment already stores the list price, the discount and the amount paid, so a
seat's price is recorded apart from what the card paid.

**`profiles`** gains `class_sales_accepted_at`, `class_sales_accepted_by` and
`class_sales_terms_version`. **`payout_accounts`** gains `payout_mode`
(`automatic` or `manual`, default `automatic`).

**`seat_refunds`** (new): one row for every refund of a seat, written before any
money moves.

| Column                                                          | Notes                                                                                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`, `enrollment_id`, `payment_id`, `class_id`                 | Restrict on delete.                                                                                                           |
| `kind`                                                          | `teacher_cancelled`, `learner_withdrew`, `moved_withdrew`, `discretionary`, `elevate_cancelled`, `seat_lost`, `dispute_lost`. |
| `learner_refund_cents`, `fee_refund_to_teacher_cents`           | Worked out by `seatRefund()` when the row is written.                                                                         |
| `status`                                                        | `pending`, `refund_sent`, `done`, `failed`.                                                                                   |
| `stripe_refund_id`, `stripe_fee_refund_id`                      | Filled in as each step completes.                                                                                             |
| `cancellation_id`                                               | The cancellation this refund belongs to, if any.                                                                              |
| `requested_by`, `reason`, `error`, `created_at`, `completed_at` |                                                                                                                               |

**`class_cancellations`** (new): `class_id` (unique), `cancelled_by`, `by_elevate`,
`reason`, `after_start`, `created_at`, `completed_at`.

**`payout_runs`** (new): `id`, `started_at`, `finished_at`, `error`.

**`payout_run_accounts`** (new): one row per teacher per run.

| Column                                              | Notes                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `run_id`, `payout_account_id`                       |                                                                                     |
| `available_cents`, `pending_cents`                  | The Stripe balance the run read.                                                    |
| `held_by_mark_cents`, `held_by_calendar_cents`      | The two held totals.                                                                |
| `outcome`                                           | `paid`, `nothing_due`, `already_paid_today`, `below_minimum`, `mismatch`, `failed`. |
| `payout_cents`, `stripe_payout_id`, `payout_status` | `payout_status` is updated from Stripe's payout events.                             |
| `classes_released`                                  | The ids of the classes this run released for this teacher.                          |
| `error`                                             |                                                                                     |

### Opting in

`POST /teach/profiles/:profileId/class-sales/accept` takes the terms version.
It is guarded by `stripe.links`, the capability only an owner holds, and by the
recent-sign-in check the Stripe link routes use. In order: it requires the
payout account to be payable; switches the Stripe account to manual payouts;
then records the acceptance on the profile and `payout_mode = 'manual'`, and
writes an audit entry. If the Stripe call fails nothing is recorded.

`POST .../class-sales/end` reverses it, and is refused while the profile has a
published class with a seat sold or any held class payment.

A profile can publish a class without opting in, as in Part 1. A class is on
sale only when its profile has opted in.

### When a class is on sale

One pure function in `packages/core`, `classOnSale(class, blocks, profile,
course, now)`. All of these must hold:

- the server setting `CLASS_SALES` is on;
- the class is published and not cancelled;
- its first block has not started;
- its last block ends within 75 days of now;
- its profile has opted in and its payout account is payable;
- its course is on sale.

### Buying a seat

The course page response, `GET /catalog/courses/:slug`, gains two fields. Older
apps ignore both.

- `classes`: the classes of this course that are on sale, each with its name,
  delivery, venue address, block times, time zone, and seats left.
- `viewer.classSeats`: the signed-in learner's seats in classes of this course,
  each with the class, the enrollment and its status.

The learner app lists the classes under "Take it as a class", each with its
own button. A full class is shown as full. On the web the button opens the
class checkout page. In the installed app it opens the web course page with the
class named in the address, and the web page opens with that class chosen.

`POST /checkout/quote` accepts an optional `classId`. The quote is the course's
quote; a promo code that makes it zero is refused for a class.

`POST /checkout/classes/:classId` starts a class checkout. Self-paced checkout,
`POST /checkout/courses/:id`, is not changed. In order, the service:

1. Loads the class and applies `classOnSale`.
2. Refuses a learner who is the profile's owner or a member.
3. Quotes, and refuses a zero price.
4. In one transaction that locks the class row: finds the learner's enrollment
   for this class; refuses if it is active; counts seats taken, leaving out the
   learner's own row; refuses with "class full" if none is left; ends the
   learner's other holds for classes of the same course; and writes the
   learner's row as `pending_payment` with `seat_held_until` 35 minutes ahead.
5. Creates the Stripe payment page, valid for 30 minutes, with the class id in
   its stored details, and expires the payment pages of the holds ended in
   step 4.

An enrollment row belongs to one class. The existing rule for "is this the same
payment attempt" already compares enrollments, so a learner who goes back and
picks another class gets a new payment page, not the first one.

**Fulfilment.** `fulfilCheckout` reads the class id from the payment page's
stored details. With none, it behaves as today. With one, inside its
transaction it locks the class row and then the enrollment row, always in that
order, and:

- if the enrollment's hold is still current, or a seat is still free,
  activates the enrollment, records the payment with its `class_id`, and
  counts the promo code;
- otherwise records the payment, leaves the enrollment as it is, and writes a
  `seat_lost` refund.

It does not touch `courses.enrol_count` for a class sale. The receipt for a
class sale shows the class's name, dates, times, time zone and place, and
links to the class screen.

`GET /checkout/sessions/:id/sync` adds `classId` to its answer for a class
sale, so the confirmation page shows the class and links to the class screen.

### Refunds

Every refund of a seat is one `seat_refunds` row, and one function in
`packages/core/src/domain/money.ts`, `seatRefund()`, works out its two
amounts. The fee calculation stays in that one file.

Take a payment of amount A, with Stripe's actual fee F, commission C and
teacher's share N, so that A = N + C + F. Elevate's application fee is C + F.
A refund is two amounts: R, returned to the learner's card, and X, returned
from Elevate's fee to the teacher.

| Kind                                  | R to the learner | X to the teacher   | Teacher's net on the seat | Elevate's net   |
| ------------------------------------- | ---------------- | ------------------ | ------------------------- | --------------- |
| `teacher_cancelled`, `moved_withdrew` | A                | C                  | −F                        | 0               |
| `learner_withdrew`                    | A − F            | C                  | 0                         | 0               |
| `discretionary`, for a chosen R       | R                | C × R ÷ A, rounded | N − R + X                 | C × (1 − R ÷ A) |
| `elevate_cancelled`, `seat_lost`      | A                | C + F              | 0                         | −F              |

On the S$500 example, F is S$17.50, C is S$72.38 and N is S$410.12. A
cancelled seat returns S$500 to the learner and leaves the teacher S$17.50
down. A withdrawal returns S$482.50 and leaves the teacher at zero.

**How a refund is sent.** `SeatRefundsService.execute(id)` works from the row's
status, so it can be run again after any failure:

1. `pending`: create a Stripe refund of R with the transfer reversed and
   Elevate's fee kept, using the idempotency key `seat-refund:<id>`. Store the
   refund id; status `refund_sent`.
2. `refund_sent`: if X is more than zero, refund X of the application fee to
   the teacher, with the key `seat-fee-refund:<id>`. Store its id.
3. In one transaction: record the refund against the payment, set the
   enrollment's status by the table above, and mark the row `done`. Then email
   the learner in their language and the profile's owner in English.

For `elevate_cancelled` and `seat_lost` the two Stripe calls are one: a full
refund with the fee refunded, which is what the code does today.

A single seat's refund is executed in the request that asked for it. If that
fails, the row stays and the next run of the job executes it. A cancellation's
refunds are executed by the job.

**If Stripe refuses the sequence.** The sandbox test in Open Questions decides
this before Phase 4. The fallback keeps the learner's side unchanged: refund R
with Elevate's fee refunded in proportion, as today, and record what the
teacher owes in a new column on the refund row. Elevate then bears the fee
until a later design recovers it. That would break the goal "Elevate does not
lose money on a refund it did not cause" and needs the author's decision
before it is used.

**Refunds from outside.** Support's existing "refund in full" action and a
refund made in the Stripe dashboard keep working. The ledger function they
share, `applyRefund`, changes in two ways for a class payment: a full refund
sets the class enrollment to `refunded`, which frees the seat, and it does not
touch `courses.enrol_count`.

**A fault fixed on the way.** Today a refund is recorded once by the action
that made it and can be recorded again by Stripe's notice of the same refund,
under a different id. For a full refund a cap hides this. For a part refund it
would double the refunded total and could remove a learner's access. Part 2
makes part refunds routine, so both paths are changed to use Stripe's own
refund id, and the refunded total becomes the sum of the refund rows.

### Withdrawing, moving and cancelling

**Withdraw.** `POST /me/classes/:enrollmentId/withdraw`. Allowed when the
learner's seat is active, they have not attended, and either the first block is
more than 7 days away, giving `learner_withdrew`, or they were moved and the
class has not started, giving `moved_withdrew`. The learner's class list shows
what would be returned and until when.

**Move.** `POST classes/:id/learners/:enrollmentId/move` with the target class.
Allowed for a learner who has not attended, to a class of the same course and
profile that is published, not cancelled, not started, has a seat free, and
whose last block ends within 82 days of the learner's payment. In one
transaction that locks both class rows in id order, the enrollment and its
payment are pointed at the new class, and the move is recorded on the
enrollment (`moved_at`, `moved_by`, `moved_from_class_id`). The learner is
emailed.

**Discretionary refund.** `POST classes/:id/learners/:enrollmentId/refund` with
an amount and a reason. Guarded by a new capability, `class.refund`, held by
the owner and managers. Allowed until the class is released, for any amount up
to what the learner paid and has not had back.

**Cancel.** `POST classes/:id/cancel` with a reason, guarded by `class.manage`.
In one transaction it marks the class cancelled, writes the
`class_cancellations` row, ends every seat hold, and writes one
`teacher_cancelled` refund row for each active seat whose learner has not
attended. Learners who have attended get no row; they are emailed that the
class was cancelled and that a refund is the profile's decision. The job
executes the rows. Elevate's own cancellation is `POST
/support/classes/:id/cancel`, for a Support admin; it writes
`elevate_cancelled` rows for every active seat, attended or not.

A cancelled class is released 7 days after it was cancelled.

### Held money and the release job

**What is held.** For a teacher, the held total is the teacher's share, after
any refunds, of each class payment that has not been released. A class payment
is released when its class is, with two exceptions: a payment with an open
dispute stays held, and no payment is held past 85 days.

**One run.** The release program, `dist/release.js`, does this:

1. Starts a `payout_runs` row.
2. Executes every `seat_refunds` row that is `pending` or `refund_sent`.
3. For each opted-in payout account, claiming it with a row lock that a second
   run skips:
   1. **Mark.** For each class of the profile that is due, meaning 7 days have
      passed since its last block ended or since it was cancelled:
      - if it has no check-in and no manual mark for any block and is not
        cleared, set `review_needed_at` and leave it held;
      - otherwise set its `released_run_id`, and the `released_run_id` of each
        of its payments that has no open dispute.

      Also mark any payment older than 85 days, with the reason `stripe_limit`.
   2. **Total by mark.** Add up the teacher's share, after refunds, of class
      payments with no `released_run_id`.
   3. **Total by calendar.** Without reading `released_run_id`, add up the
      teacher's share, after refunds, of class payments that are 85 days old
      or less and whose class is not due, or is under review, or which have an
      open dispute.
   4. **Check.** If the two totals differ, record the outcome `mismatch` and go
      to the next account. No payout is created.
   5. **Pay.** If a payout was already created for this account today in
      Singapore time, record `already_paid_today`. Otherwise read the Stripe
      balance, available A and pending P, and work out the payout as the
      smaller of A and A + P − held, and never below zero. If it is under
      S$1, record `below_minimum`. Otherwise create a Stripe payout on the
      teacher's account with the idempotency key `payout:<row id>`.
   6. Record the balance, both totals, the classes released, the outcome and
      the payout.
4. Finishes the `payout_runs` row.

The two totals share the payment rows and the fee arithmetic and differ in how
they decide "still held": one trusts the marks, the other trusts the dates and
states. They agree only when the marking matches the calendar.

Every step is safe to repeat. A run that dies leaves marks and rows the next
run completes, and the idempotency keys stop a refund or a payout being sent
twice.

**Scheduling.** Terraform adds a third task definition, `release`, from the
API image, with the command `node dist/release.js` built in, because a
schedule cannot change the command of the task it starts. It connects as the
API's restricted database user. An EventBridge Scheduler entry starts it every
15 minutes, with a dead-letter queue for starts that fail. The deploy workflow
registers a new revision of all three task definitions on each deploy. The
schedule names the task definition without a revision so that it runs the
latest; if EventBridge Scheduler does not allow that, the workflow updates the
schedule after registering.

A schedule's retry covers a task that fails to start, not one that starts and
fails. So the proof that the job is alive is its own record: the Support
payouts page shows the last finished run and warns when none has finished in
an hour.

**What a teacher sees.** The Teach earnings response gains the held total, the
classes it is held for with their release dates, and the recent payouts with
their status.

### Disputes

Four Stripe event types are handled that are ignored today.

| Event                          | Effect                                                                                                                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `charge.dispute.created`       | Record the dispute on the payment with status `open`. A class payment with an open dispute stays held.                                                                                                                                                                  |
| `charge.dispute.closed`, won   | Status `won`. The next run marks the payment released if its class is.                                                                                                                                                                                                  |
| `charge.dispute.closed`, lost  | Status `lost`. Write a `dispute_lost` row: the transfer for the payment is reversed in full and Elevate's fee is refunded to the teacher, so the teacher's net for the seat is zero; the enrollment becomes `refunded`. Elevate bears Stripe's fee and the dispute fee. |
| `payout.paid`, `payout.failed` | Update `payout_status` on the run row. A failed payout is shown to Support.                                                                                                                                                                                             |

A dispute on a self-paced payment is recorded and changes nothing else.

Today a webhook event whose handler fails is stored with its error and never
handled again, because Stripe's redelivery is treated as a duplicate. With
disputes and payouts depending on these events, a redelivered event whose
stored row has an error and no success is handled again.

### Readiness for real learners

These four come from Part 1's review. They are needed before a real learner
checks in, and are otherwise separate from selling.

- **Backups.** Production keeps automated database backups for 35 days.
- **Sign-in limit.** Requests for a sign-in email are limited to 5 per email
  address and 300 per network address in 15 minutes, in place of 30 per network
  address. One venue network can sign in a class; one address cannot be
  flooded.
- **Erasing coordinates.** `POST /support/learners/:userId/erase-coordinates`,
  for a Support admin, deletes that learner's rows from
  `attendance_event_locations` and writes an audit entry with the count and a
  reason. Part 1 put coordinates in that table so this would not touch an
  attendance row.
- **Recording views.** Each time Support's block view returns coordinates, an
  audit entry records who viewed which class and block.

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
- A seat hold ends when one payment completes.
- The held total adds up payments; a subsidy not yet received is not in it.
- The 85-day limit counts from the card payment.

What Part 2 does to leave room: a payment keeps its list price apart from the
amount paid; a seat refund is its own row tied to a payment, so a seat can have
refunds against more than one payment; and a class's release is a recorded
step with a review state, so "waiting for a subsidy" can become another reason
a class is not released.

## Alternatives Considered

Each row gives what the option offered, the trade-off that decided against it,
and where the decision is recorded. "RFC" is the
[Alternatives Weighed](./scheduled-classes-brief.md#alternatives-weighed)
section of the RFC. "Drafting" is a choice the author made at a question while
this design was drafted.

### What is sold, and how

| Alternative                                                     | What it offered                                                                | Why it was rejected                                                                                                                                           | Recorded                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| The learner buys the course and is placed in a class afterwards | Checkout would not change.                                                     | The author wants paying and choosing a class to be one step.                                                                                                  | RFC, rejected by author            |
| A price set per class                                           | A teacher could charge more for a live class.                                  | The author wants a class to take the course's price.                                                                                                          | RFC, rejected by author            |
| A class as its own entry in the catalog                         | Classes could be browsed and searched.                                         | The author wants a class sold from the course it belongs to.                                                                                                  | RFC, rejected by author            |
| Placing a learner in a class without a sale                     | A teacher could seat a guest, and a playtest could run before checkout exists. | It gives a seat away, and the author wants checkout to be the only way in.                                                                                    | RFC, rejected by author            |
| One enrollment per course with a separate seat table            | The one-enrollment rule would stay.                                            | Progress, quiz attempts, certificates and payments all point at the enrollment; a second owner would mean changing the payment path and copying three tables. | RFC, rejected on technical grounds |
| Counting seats only when a payment completes                    | No hold to manage.                                                             | Two learners can both pay for the last seat, and the only remedy is a refund that costs Elevate Stripe's fee.                                                 | RFC, rejected on technical grounds |
| A job that releases expired holds                               | A hold would be an explicit record with an end.                                | The API had no scheduler when this was decided, and a hold that is counted by its expiry time needs none.                                                     | RFC, rejected on technical grounds |
| A learner may hold only one seat per course                     | Simpler to explain.                                                            | A learner may reasonably book two runs, and Part 1's rule is one seat per learner per class.                                                                  | Drafting                           |
| Every approved profile can sell classes at once                 | No step for a teacher to take.                                                 | Every teacher's payouts would move onto new code on one day, and any teacher could create held-payment liability before the flow has been tried.              | Drafting, rejected by author       |
| Support turns classes on profile by profile                     | Elevate would choose who is in the beta.                                       | Enabling would be manual work for Support, and a profile that asks would wait.                                                                                | Drafting, rejected by author       |

### Holding and releasing money

| Alternative                                         | What it offered                                                                                | Why it was rejected                                                                                                                                   | Recorded                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Pay the teacher at the moment of a class sale       | No change to payments.                                                                         | A cancelled class would pull refunds from a teacher who may have withdrawn the money, and Elevate carries the shortfall.                              | RFC, rejected by author      |
| Hold class money in Elevate's own Stripe balance    | Elevate would control the money directly.                                                      | Elevate would become the seller on the card statement and own every refund and dispute, a different payment model from self-paced sales.              | RFC, rejected by author      |
| A fixed payout delay on the teacher's account       | No job to build.                                                                               | Stripe allows a delay of at most 31 days, which is too short for a class sold weeks ahead.                                                            | RFC, not workable            |
| A person presses a button to release each class     | No scheduler.                                                                                  | The author wants no manual step in paying teachers.                                                                                                   | RFC, rejected by author      |
| Release block by block                              | The teacher of a long class is paid as they teach, and a part-run class has an obvious refund. | Every seat's money would be split across blocks, and each release and refund would work on parts of a payment.                                        | Drafting, rejected by author |
| Release when the class ends                         | Fastest for the teacher.                                                                       | Money could leave before a disputed manual mark is settled or a complaint about the last day arrives.                                                 | Drafting, rejected by author |
| Add up the sales that are due                       | Every payout would be a named list of sales.                                                   | It must track when each payment's funds become available at Stripe, and any amount its arithmetic misses stays in the balance or makes a payout fail. | Drafting, rejected by author |
| The balance less what is held, with no second total | Less to compute.                                                                               | A wrong held total would pay class money out early and nothing would show it.                                                                         | Drafting, rejected by author |
| A loop inside the API                               | No new AWS resources.                                                                          | A money job would share a small web process, stop whenever the API is down, and leave nothing outside the logs to show it ran.                        | Drafting, rejected by author |
| A scheduled Lambda function                         | Starts in seconds and costs almost nothing per run.                                            | The repo has no Lambda, so it would need a second build and deploy path and a private-network connection to the database.                             | Drafting, rejected by author |
| A payout on every run                               | Self-paced money would reach the bank sooner.                                                  | Each payout is a bank transfer, and a run every 15 minutes would make dozens of small ones a day.                                                     | Drafting                     |

### Refunds, withdrawal and cancellation

| Alternative                                                      | What it offered                                                                    | Why it was rejected                                                                                                       | Recorded                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Refund in proportion, with Elevate absorbing Stripe's fee        | It is what Stripe does by default.                                                 | Elevate would lose money above about 80% refunded, and S$17.50 a seat at a full refund.                                   | RFC, rejected by author            |
| Refund every cancelled seat less Stripe's fee, whoever cancelled | Elevate would never lose money.                                                    | A learner who did nothing wrong would bear the cost, and no source found permits the deduction when the provider cancels. | RFC, rejected by author            |
| Offer self-paced access when a class is cancelled                | Fewer refunds.                                                                     | It mixes the two products.                                                                                                | RFC, rejected by author            |
| A full refund whenever the teacher cancels                       | One rule, and the learner is always made whole.                                    | A teacher who taught most of a class would be paid nothing for it.                                                        | Drafting, rejected by author       |
| Refund the blocks not yet run when a class is cancelled part-way | The teacher is paid for what was taught and the learner refunded for what was not. | The author wants no automatic refund once a learner has attended; the profile decides.                                    | Drafting, rejected by author       |
| Support sets the refund for a class cancelled part-way           | Judgement in the odd cases.                                                        | Every mid-class cancellation would be manual work for Support, and Elevate would decide how much the teacher keeps.       | Drafting, rejected by author       |
| The attendance lock applies only when the learner asks to leave  | A teacher could not run one block, cancel the rest and keep every payment.         | The author wants the lock to hold in both cases.                                                                          | Drafting, rejected by author       |
| Withdraw until the first block starts                            | One clock, simple to state.                                                        | A seat given up the night before cannot be resold.                                                                        | Drafting, rejected by author       |
| Withdraw at any time before attending                            | The same sentence as the attendance lock.                                          | A learner who never turns up could claim almost the whole price back afterwards.                                          | Drafting, rejected by author       |
| The instructor can grant a discretionary refund                  | The person who knows the case decides it.                                          | A writer, who cannot see earnings today, could give away the profile's revenue.                                           | Drafting, rejected by author       |
| The instructor proposes a refund and the owner approves          | Knowledge and control both kept.                                                   | Two steps for each refund, and a proposal could outlive the 7 days before release.                                        | Drafting, rejected by author       |
| Only Support can cancel a class that has started                 | A person at Elevate would see every mid-class cancellation.                        | A teacher who falls ill could not close their own class without Support.                                                  | Drafting, rejected by author       |
| Only Support can cancel any class                                | Elevate would see every cancellation.                                              | A teacher who did not get enough sign-ups would have to raise a request.                                                  | Drafting, rejected by author       |
| No moving; withdraw and buy again                                | Nothing to build.                                                                  | After a cancellation each learner would have to be refunded and persuaded to pay again.                                   | Drafting, rejected by author       |
| The learner moves their own seat                                 | No work for the teacher.                                                           | Learners could shuffle between dates late enough to leave a class half empty.                                             | Drafting, rejected by author       |
| Send a cancellation's refunds in the request                     | The teacher would see them finish.                                                 | A class of 30 is 60 Stripe calls in one request; a timeout would leave it half refunded.                                  | Drafting                           |
| A new enrollment status for a cancelled class                    | The state would be explicit.                                                       | An installed older app would show an unknown status as raw text.                                                          | RFC, rejected on technical grounds |

### Abuse, disputes and readiness

| Alternative                                       | What it offered                                                        | Why it was rejected                                                                                                 | Recorded                               |
| ------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| The core controls only                            | The least to build.                                                    | A class sold and never run would be released like any other, and a bank dispute would not stop a release.           | Drafting, rejected by author           |
| A ceiling on price times seats per profile        | The exposure from one class would be known in advance.                 | A teacher planning a large class would hit a limit during the weeks the author most wants them trying it.           | Drafting, rejected by author           |
| A late or repeat cancellation needs Support       | A check on cancelling for gain.                                        | It conflicts with the author's decision that the owner or a manager cancels at any time.                            | RFC proposal, superseded               |
| Elevate absorbs a lost dispute                    | Nothing to build beyond the hold.                                      | A teacher would lose nothing when their class draws disputes, and each would cost Elevate the seat price and a fee. | Drafting, rejected by author           |
| Support decides each lost dispute                 | A stolen card and a class that never ran could be treated differently. | Every lost dispute would need a person, and similar cases could be decided differently.                             | Drafting, rejected by author           |
| A joining-details field on a remote class         | Learners would see the link in the app and the receipt.                | The author chose to build nothing here; the instructor writes to learners.                                          | Drafting, rejected by author           |
| Sell only in-person classes until Part 3          | No half-built path for remote.                                         | Remote was half of the original request and would wait for a third release.                                         | Drafting, rejected by author           |
| Leave the sign-in limit at 30 per network address | No change to a protection on the live product.                         | A class signing in on one venue network would exhaust it.                                                           | Part 1 review, deferred to this design |
| Treat a grant-funded learner as paying in full    | Nothing in this design would need to leave room.                       | The author pictures the learner paying the net fee.                                                                 | Drafting, rejected by author           |

---

## Risks & Mitigations

| Risk                                                                                                                                 | Impact                                                                                                           | Mitigation                                                                                                                                                                                                                                                      | Status                |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| A teacher runs one block, cancels the rest and keeps the payments of every learner who attended.                                     | Learners lose money for blocks never taught; their route is a bank dispute, which Elevate is liable for.         | Every cancellation is recorded and listed for Support when it happens after a class started. A dispute holds that seat's money, and a lost one takes the teacher's share back. Support's own refund action is unchanged. Nothing prevents the first occurrence. | Accepted by author    |
| Stripe refuses a refund with the transfer reversed and Elevate's fee kept, followed by a part refund of that fee.                    | The "whoever cancels bears the fee" rule cannot be built as designed.                                            | A sandbox test before Phase 4. The fallback refunds as today and records what the teacher owes; it needs the author's decision.                                                                                                                                 | Open                  |
| A refund reverses more than the teacher's balance holds, for example the first cancelled seat of a teacher with no other held money. | The teacher's balance goes negative by Stripe's fee per seat, which Elevate carries until later sales cover it.  | Class money is held, so the share itself is there; only the fee is short. The run records every balance.                                                                                                                                                        | Accepted              |
| The held total is wrong.                                                                                                             | Class money is paid out early, or self-paced money is kept back.                                                 | Two totals worked out by different routes; a mismatch pays nothing and shows for Support. A payment missing from both routes is not caught.                                                                                                                     | Mitigated in part     |
| No money can be held past 85 days.                                                                                                   | A class under review, or a disputed seat, is paid out before the question is settled.                            | The forced release is flagged for Support. A seat can be bought only for a class ending within 75 days.                                                                                                                                                         | Accepted              |
| The release job stops running.                                                                                                       | Teachers who opted in are not paid, including for self-paced sales, and refunds for cancelled classes wait.      | Each run is recorded; the Support payouts page warns when none has finished in an hour. The repo has no alarms, so nobody is paged.                                                                                                                             | Accepted for the beta |
| A run fails part-way.                                                                                                                | Some teachers are paid and some are not; some refunds are sent and some are not.                                 | Every step is repeatable and keyed, and the next run, 15 minutes later, completes it.                                                                                                                                                                           | Mitigated             |
| A learner's hold expires while they are paying and the seat goes to someone else.                                                    | The learner pays and has no seat.                                                                                | The payment is refunded in full and the learner is emailed. Elevate bears Stripe's fee. The hold outlasts the payment page by 5 minutes, so this needs a payment that completes late.                                                                           | Accepted              |
| An older version of the API handles a class payment after a rollback.                                                                | Part 1's version would activate the enrollment without the seat check, and count it in the course's enrol count. | The hold was taken under the seat check at checkout start, so only the expired-hold case can oversell. `CLASS_SALES` is turned off before any rollback.                                                                                                         | Accepted              |
| The opt-in terms, the refund terms and the attendance lock have had no legal review.                                                 | A term may be unenforceable, or a refund refused under the lock may be owed in law.                              | Listed in Open Questions; the release to real learners waits for a lawyer's read.                                                                                                                                                                               | Open                  |
| Remote learners get joining details only if the instructor writes to them.                                                           | A learner who buys late may have no link.                                                                        | The roster shows learners' emails to the instructor. Part 3 adds the class page.                                                                                                                                                                                | Accepted by author    |
| A class learner can open no materials until Part 3.                                                                                  | A seat is worth only the live teaching until then.                                                               | The course page says what a class seat includes.                                                                                                                                                                                                                | Accepted              |
| The sign-in limit is loosened from 30 to 300 per network address.                                                                    | More sign-in emails can be requested from one address.                                                           | A new limit of 5 per email address stops any one inbox being flooded.                                                                                                                                                                                           | Accepted              |
| Part 2 is built on a schema that exists only on a branch.                                                                            | If building the rest of Part 1 changes it, this plan changes.                                                    | Part 1 in full is a stated prerequisite; this plan names the Part 1 files it extends.                                                                                                                                                                           | Open                  |

### Limits

- One release task at a time does all teachers in turn. At tens of opted-in
  teachers a run takes seconds; the design does not consider thousands.
- A payout is made at most once a day per teacher.
- A seat can be sold only for a class that ends within 75 days.

## Non-Functional Requirements

### Security and privacy

- **Money actions and who may take them.** Opting in: the owner, after a recent
  sign-in. Cancelling and moving: `class.manage`. A discretionary refund:
  `class.refund`. Releasing a class under review, Elevate's own cancellation
  and erasing coordinates: a Support admin. Each writes an audit entry.
- **A learner acts only on their own seat.** Withdrawal looks the seat up by
  the signed-in learner and answers 404 otherwise.
- **Reading across profiles.** Every seat, refund and payout lookup for Teach
  goes through the class or the profile of the actor.
- **Stripe calls that move money carry an idempotency key** derived from the
  row that asked for them, so a retry cannot send a refund or a payout twice.
- **No card data** is stored or logged. Refund and payout log lines carry ids
  and amounts.

### Performance

- Starting a class checkout locks one class row for the length of a count and
  an insert. Seats taken is one indexed count on `enrollments (class_id,
  status)`.
- A run makes, per opted-in teacher, two sums over that teacher's class
  payments and at most one balance read and one payout call a day.
- A cancellation of a class of 30 is 60 Stripe calls, made by the job, not in a
  request.
- New indexes: `enrollments (class_id, status)`, `payments (class_id)`,
  `payments (payout_account_id, released_run_id)`, `seat_refunds (status)`,
  `seat_refunds (enrollment_id)`, `payout_run_accounts (payout_account_id,
  run_id)`.

### Rollout and rollback

- **Prerequisite.** Part 1 is built in full and deployed, with its restricted
  database user in place.
- **One migration, additive**: new columns, new tables, new indexes and one new
  enum value, `class_status = 'cancelled'`. Part 1's version reads `classes`
  and would show that value as text on its English Teach pages.
- **Order.** Apply Terraform, which adds the release task definition, the
  schedule in a disabled state, its role and queue, and the backup setting.
  Copy the GitHub variables. Deploy with `CLASS_SALES` off. Enable the
  schedule. Opt one profile in on staging and rehearse. Only then turn
  `CLASSES` and `CLASS_SALES` on in production.
- **Rollback of selling** is `CLASS_SALES=false`: no new seat is sold, and
  everything already sold keeps working.
- **Rollback of the job** is disabling the schedule. An opted-in teacher is
  then not paid until it is enabled again or the profile's Stripe account is
  switched back to automatic payouts by hand; `infra/README.md` gets that
  procedure.
- **Rollback of the code** to Part 1's version is safe only with `CLASS_SALES`
  off first. No version older than Part 1's may be deployed.

## Additional Resources

- [Scheduled classes RFC](./scheduled-classes-brief.md), sections
  "Second review" and "Checks made after the second review": the money
  findings and the Stripe and consumer-rule checks this design starts from.
- [Part 1 design](./scheduled-classes-attendance.md): the class and
  attendance records, the roles and the restricted database user.
- [ADR 003: payments](../adr/003-payments-destination-charges.md) and
  [ADR 007: payout accounts](../adr/007-payout-accounts.md): the payment
  model this design extends.
- [ADR 010: locale resolution](../adr/010-locale-resolution-and-email-language.md):
  the language of learner emails and how errors are worded from codes.
- [Infrastructure notes](../../infra/README.md): one-off tasks and the deploy.
- Stripe documentation read while drafting: manual payouts, managing the
  payout schedule, application fee refunds, refunds, and connected account
  balances. AWS documentation read while drafting: EventBridge Scheduler
  targets, retry policy and dead-letter queues.

## Future Improvements

- **Alarms** on a run that has not finished, a failed payout and a dead-letter
  message. The repo has none today.
- **Grant money**: a second amount per seat, and a release that waits for it.
- **Recovering a fee a teacher owes** when their balance cannot cover it.
- **A cap or a review** on cancelling a class after it has started, if the
  beta shows the pattern the author accepted.
- **Disputes of a refund decision** by a learner.
- **Release by block** for classes longer than about ten weeks, which this
  design cannot sell.
- **A joining-details field** for remote classes, if Part 3's class page is
  late.

---

## Detailed Implementation Plan

**Prerequisite.** Part 1 is built in full: all seven phases of
[its plan](./scheduled-classes-attendance.md). This plan extends
files that Part 1 creates, and names them as they are in that plan.

**Before Phase 4, a sandbox test.** In a Stripe test account, with a connected
account created as `createConnectedAccount` creates it and switched to manual
payouts: make a destination charge with an application fee; refund it with
`reverse_transfer: true` and without `refund_application_fee`; then refund
part of the application fee. Record whether each call succeeds, the teacher's
balance after each, and what happens when the reversal is larger than the
available balance. If the sequence is refused, stop and take the fallback in
"Refunds" to the author.

The work is in eleven phases, in build order. Phases 1 to 7 end with `npx turbo
run typecheck test` passing; Phases 8 and 9 with `npx turbo run typecheck
build`; Phase 10 with Terraform and the workflow validated; Phase 11 with lint.
A local walkthrough follows Phase 9. The rollout to staging follows Phase 11
and needs the author's go-ahead.

Each entry is one file unless it says otherwise. Entries name the function to
change; line numbers move.

### Shared definitions used by the entries

**Values.**

| Field                                | Values                                                                                                                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `seat_refunds.kind`                  | `teacher_cancelled`, `moved_withdrew`, `learner_withdrew`, `discretionary`, `elevate_cancelled`, `seat_lost`, `dispute_lost`                                                                                                               |
| `seat_refunds.status`                | `pending`, `refund_sent`, `done`, `failed`                                                                                                                                                                                                 |
| `payout_run_accounts.outcome`        | `paid`, `nothing_due`, `already_paid_today`, `below_minimum`, `mismatch`, `failed`                                                                                                                                                         |
| `payout_run_accounts.payout_status`  | `pending`, `paid`, `failed`                                                                                                                                                                                                                |
| `payout_accounts.payout_mode`        | `automatic`, `manual`                                                                                                                                                                                                                      |
| `payments.dispute_status`            | `open`, `won`, `lost`                                                                                                                                                                                                                      |
| `classes.release_reason`             | `due`, `stripe_limit`                                                                                                                                                                                                                      |
| `class_status` (one value added)     | `draft`, `published`, `cancelled`                                                                                                                                                                                                          |
| Enrollment status a refund kind sets | `learner_withdrew` sets `cancelled`; a `discretionary` refund changes nothing; every other kind sets `refunded`                                                                                                                            |
| Move problems                        | `attended`, `different_course`, `target_not_on_offer`, `target_started`, `target_full`, `beyond_limit`                                                                                                                                     |
| Audit actions                        | `class_sales.accepted`, `class_sales.ended`, `class.cancelled`, `class.learner_moved`, `seat.withdrawn`, `seat.refund_requested`, `seat.refund_done`, `class.review_cleared`, `payout.created`, `coordinates.erased`, `coordinates.viewed` |

**Constants**, in a new `packages/core/src/domain/class-sales.ts`:

| Name                          | Value                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| `SEAT_HOLD_MS`                | 35 minutes                                                            |
| `WITHDRAWAL_CLOSES_BEFORE_MS` | 7 days before the first block starts                                  |
| `RELEASE_AFTER_MS`            | 7 days after the last block ends, or after cancellation               |
| `SALE_HORIZON_MS`             | 75 days: a seat can be bought only if the last block ends within this |
| `MOVE_HORIZON_MS`             | 82 days from the payment: a move's target class must end within this  |
| `MAX_HELD_MS`                 | 85 days from the payment                                              |
| `MIN_PAYOUT_CENTS`            | 100                                                                   |
| `PAYOUT_TIME_ZONE`            | `Asia/Singapore`, for "already paid today"                            |
| `RUN_STALE_MS`                | 1 hour: Support is warned when no run has finished in this            |
| `CLASS_SALES_TERMS_VERSION`   | `2026-12`                                                             |

**Learner-facing errors.** Each is added to `USER_ERROR_CODES` with an English
and a Chinese message, and thrown with `new HttpError(status, code, message,
details)`.

| Condition                                                                           | Status | Code                     | Details        | English message                                                        |
| ----------------------------------------------------------------------------------- | ------ | ------------------------ | -------------- | ---------------------------------------------------------------------- |
| `classOnSale` is false                                                              | 409    | `class_not_on_sale`      | none           | "This class is not open for booking."                                  |
| No seat left                                                                        | 409    | `class_full`             | none           | "This class is full."                                                  |
| The learner already has an active seat in this class                                | 409    | `already_in_class`       | `enrollmentId` | "You already have a seat in this class."                               |
| The learner is the profile's owner or a member                                      | 403    | `own_class`              | none           | "You cannot book a seat in a class you teach or manage."               |
| A promo code makes the price zero                                                   | 422    | `class_requires_payment` | none           | "This code cannot be used on a class."                                 |
| Withdrawal less than 7 days before the first block, for a learner who was not moved | 409    | `withdrawal_closed`      | `closesAt`     | "Withdrawal has closed for this class. Contact the teacher."           |
| Withdrawal by a learner who has attended                                            | 409    | `withdrawal_attended`    | none           | "You have attended this class, so a refund is the teacher's decision." |
| Withdrawal of a seat that is not the learner's or not active                        | 404    | `not_found`              | none           | existing                                                               |

**Teach and Support errors.** English only; thrown with `errors.conflict`,
`errors.unprocessable` or `errors.forbidden`.

| Condition                                                                  | Status | Code                  | Details    |
| -------------------------------------------------------------------------- | ------ | --------------------- | ---------- |
| Opt-in when the payout account is not payable                              | 409    | `not_payable`         | none       |
| Opt-in with a terms version that is not the current one                    | 422    | `terms_version`       | `current`  |
| Opt-out with a seat sold in a published class, or held class money         | 409    | `class_sales_in_use`  | none       |
| Cancelling a class that is not published                                   | 409    | `class_not_published` | none       |
| A move that fails a rule                                                   | 422    | `move_not_allowed`    | `problems` |
| A discretionary refund for more than the learner paid and has not had back | 422    | `refund_too_large`    | `maxCents` |
| A discretionary refund, or a move, after the class is released             | 409    | `class_released`      | none       |
| A discretionary refund on a seat that is not active                        | 409    | `seat_not_active`     | none       |
| Clearing a review on a class that is not under review                      | 409    | `review_not_needed`   | none       |

**Emails.** Learner emails are built with `simpleEmail` from keys in the
`email` message area, in the learner's account language. Emails to a profile's
owner are English.

| Key prefix                       | Sent when                                                   | To            |
| -------------------------------- | ----------------------------------------------------------- | ------------- |
| `email.classReceipt.*`           | A class payment is fulfilled                                | Learner       |
| `email.seatLost.*`               | A `seat_lost` refund is done                                | Learner       |
| `email.classCancelled.*`         | A `teacher_cancelled` or `elevate_cancelled` refund is done | Learner       |
| `email.classCancelledAttended.*` | A class is cancelled and the learner has attended           | Learner       |
| `email.seatWithdrawn.*`          | A `learner_withdrew` or `moved_withdrew` refund is done     | Learner       |
| `email.seatRefunded.*`           | A `discretionary` refund is done                            | Learner       |
| `email.seatMoved.*`              | A learner is moved                                          | Learner       |
| English literals                 | Any seat refund is done; a payout fails                     | Profile owner |

### Phase 1: Database and shared logic

**Ends with:** `npx turbo run typecheck test` passing, with the existing suites
unchanged.

#### 1.1 `packages/db/src/schema/enums.ts` (Modify)

- **Change:** Add `cancelled` to `classStatusEnum`. Add `seatRefundKindEnum`,
  `seatRefundStatusEnum`, `payoutOutcomeEnum`, `payoutStatusEnum` and
  `payoutModeEnum`, with the values above.
- **Why:** The new columns and tables use them.

#### 1.2 `packages/db/src/schema/commerce.ts` (Modify)

- **Change:** `enrollments`: add `seatHeldUntil` (timestamp, nullable),
  `movedAt`, `movedBy` (users, set null) and `movedFromClassId` (classes,
  restrict, written with `(): AnyPgColumn`); add an index on (`classId`,
  `status`). `payments`: add `classId` (classes, restrict, nullable, written
  with `(): AnyPgColumn`), `releasedRunId` (payout runs, restrict), `disputeId`
  (text), `disputeStatus` (text) and `disputedAt`; add indexes on `classId` and
  on (`payoutAccountId`, `releasedRunId`).
- **Why:** The seat hold, the record of a move, and what the held totals read.

#### 1.3 `packages/db/src/schema/classes.ts` (Modify)

- **Change:** `classes`: add `cancelledAt`, `cancelledBy` (users, set null),
  `cancelReason`, `releasedRunId` (payout runs, restrict), `releasedAt`,
  `releaseReason` (text), `reviewNeededAt`, `reviewClearedAt`,
  `reviewClearedBy` (users, set null) and `reviewNote`.
- **Why:** A class's cancellation and its release are states of the class.

#### 1.4 `packages/db/src/schema/profiles.ts` (Modify)

- **Change:** `profiles`: add `classSalesAcceptedAt`, `classSalesAcceptedBy`
  (users, set null) and `classSalesTermsVersion`. `payoutAccounts`: add
  `payoutMode`, default `automatic`.
- **Why:** The record of opting in, and which accounts the job pays.

#### 1.5 `packages/db/src/schema/payouts.ts` (Create)

- **Change:** Declare `seatRefunds`, `classCancellations`, `payoutRuns` and
  `payoutRunAccounts` with the columns in the Technical Plan. Foreign keys
  restrict on delete. Indexes: `seat_refunds (status)`, `seat_refunds
  (enrollment_id)`, `payout_run_accounts (payout_account_id, run_id)` unique,
  `class_cancellations (class_id)` unique. `payoutRunAccounts.classesReleased`
  is `jsonb` typed as a list of ids.
- **Why:** One file for the records the money flow adds.

#### 1.6 `packages/db/src/schema/index.ts` and `packages/db/src/schema/relations.ts` (Modify)

- **Change:** `index.ts`: export `./payouts`. `relations.ts`: add the four
  tables to `tables`, and relations from a seat refund to its enrollment,
  payment, class and cancellation; from a cancellation to its class and
  refunds; from a run to its account rows; from an account row to its payout
  account; from a payment to its class and run; from a class to its
  cancellation.
- **Why:** `db.query.*` reads relations from the one `defineRelations` call.

#### 1.7 `packages/db/drizzle/<timestamp>_class_sales/` (Create, generated)

- **Change:** Run `npm run db:generate -- --name class_sales`. Read the SQL and
  confirm it only adds: columns, tables, indexes, enum types and the one enum
  value. If it drops or alters anything else, change the schema and generate
  again.
- **Why:** Migrations are generated, never written by hand.

#### 1.8 `packages/db/src/roles.ts` (Modify)

- **Change:** No statement changes. Add a comment that the four new tables are
  ordinary tables for the API's user, and that only `attendance_events` and
  `attendance_event_locations` are restricted.
- **Why:** Part 1's default privileges already cover new tables; saying so
  stops a later reader adding a grant.

#### 1.9 `packages/core/src/domain/money.ts` (Modify)

- **Change:** Add `seatRefund(input)` and its types. Input: `kind`,
  `amountCents`, `applicationFeeCents`, `stripeFeeCents` (the actual fee, or
  the estimate when the actual is unknown), `alreadyRefundedCents`, and
  `requestedCents` for `discretionary`. Output: `learnerRefundCents`,
  `feeRefundToTeacherCents`, `refundApplicationFeeInFull` (true for
  `elevate_cancelled` and `seat_lost`), `teacherChangeCents` and
  `platformChangeCents`, by the table under "Refunds", with commission taken as
  `applicationFeeCents − stripeFeeCents`. A payment already part refunded
  scales each amount to what remains. Throws on a `requestedCents` above what
  remains.
- **Why:** AGENTS.md requires the only fee computation to live in this file.

#### 1.10 `packages/core/src/domain/class-sales.ts` (Create)

- **Change:** The constants above. Pure functions: `classOnSale({ class,
  blocks, profile, course, salesEnabled, now })`, returning `true` or the
  reason; `seatsLeft(seats, taken)`; `withdrawal({ seat, firstBlockStartsAt,
  attended, now })`, returning the refund kind allowed or the error code;
  `canMove({ ... })`, returning `true` or the list of problems;
  `releaseDueAt(class, blocks)`; `isDue(class, blocks, now)`;
  `payoutCents({ availableCents, pendingCents, heldCents })`, the smaller of
  available and available plus pending less held, never below zero;
  `sameLocalDay(a, b, timeZone)`.
- **Why:** The API, the job and the portals must agree on these rules.

#### 1.11 `packages/core/src/domain/permissions.ts` (Modify)

- **Change:** Add `class.refund` to `CAPABILITIES`. Owner and manager receive
  it through `ALL` and `MANAGER`. It is not added to `WRITER`, `STAFF` or
  `UNAPPROVED`.
- **Why:** The author decided only the owner and managers grant a refund.

#### 1.12 `packages/core/src/contracts/class-sales.ts` (Create)

- **Change:** Request schemas: `acceptClassSalesSchema` (`termsVersion`),
  `classCheckoutRequestSchema` (`promoCode?`, `locale?`, as
  `checkoutRequestSchema`), `cancelClassSchema` (`reason`, 3 to 500
  characters), `moveSeatSchema` (`toClassId`), `seatRefundRequestSchema`
  (`amountCents`, a positive integer; `reason`, 3 to 500),
  `clearReviewSchema` (`note`, 3 to 500), `eraseCoordinatesSchema` (`reason`, 3
  to 500). Response types:
  - `ClassForSale`: `id`, `name`, `delivery`, `venueAddress`, `timeZone`,
    `blocks: { startsAt, endsAt }[]`, `seatsLeft`, `instructorName`.
  - `ViewerClassSeat`: `classId`, `enrollmentId`, `status`.
  - `SeatView` (Teach): `enrollmentId`, `learner: { displayName, email }`,
    `status`, `paidCents`, `refundedCents`, `attended`, `movedAt`, `refunds:
    SeatRefundView[]`, `canRefundUpToCents`.
  - `SeatRefundView`: `id`, `kind`, `learnerRefundCents`, `status`, `reason`,
    `createdAt`, `completedAt`.
  - `LearnerSeat`: `canWithdraw`, `withdrawRefundCents`, `withdrawClosesAt`,
    `wasMoved`.
  - `HeldClassView`: `classId`, `className`, `heldCents`, `releaseDueAt`,
    `underReview`.
  - `PayoutView`: `runId`, `at`, `payoutCents`, `payoutStatus`.
  - `PayoutRunView` (Support): `id`, `startedAt`, `finishedAt`, `error`,
    `accounts: { profileName, availableCents, pendingCents, heldByMarkCents,
    heldByCalendarCents, outcome, payoutCents, payoutStatus }[]`.
  - `SupportPayoutsOverview`: `lastFinishedAt`, `stale`, `mismatches`,
    `failedPayouts`, `classesUnderReview`, `forcedReleases`,
    `cancelledAfterStart`, `recentRuns: PayoutRunView[]`.
- **Why:** Routes validate with these and three clients type against them.

#### 1.13 `packages/core/src/domain/index.ts` and `packages/core/src/contracts/index.ts` (Modify)

- **Change:** Export `./class-sales` from each.
- **Why:** `@elevate/core` re-exports both folders.

#### 1.14 `packages/core/src/contracts/errors.ts` (Modify)

- **Change:** Add the seven learner codes in the table above, under the
  "Classes" header Part 1 added.
- **Why:** The learner app words errors from codes.

#### 1.15 `packages/i18n/src/messages/areas/apiError.en.ts` and `apiError.zh.ts` (Modify)

- **Change:** One message per new code; the English text is in the table.
- **Why:** `catalog.test.ts` fails when a learner-visible code has no message.
  The Chinese text needs the author's sign-off.

#### 1.16 `packages/core/test/` (Modify two, create one)

- **Change:**
  - `money.test.ts` (Modify): `seatRefund` for each kind on the S$500 example
    and on a promo-discounted payment; that `teacherChangeCents +
    platformChangeCents + learnerRefundCents` accounts for every cent; a
    `discretionary` amount of 1 cent and of the full amount; a payment already
    part refunded; an estimate used when the actual fee is missing; a request
    above what remains throwing.
  - `permissions.test.ts` (Modify): `class.refund` per role.
  - `class-sales.test.ts` (Create): each reason `classOnSale` can return, with
    the 75-day edge; `withdrawal` at exactly 7 days, for a moved learner, and
    for an attended one; each move problem and the 82-day edge; `isDue` at
    exactly 7 days after the last block and after a cancellation;
    `payoutCents` when held exceeds the balance, when pending covers the held
    amount, and when nothing is held; `sameLocalDay` across midnight in
    Singapore.
- **Why:** These functions decide who is refunded what and when a teacher is
  paid.

### Phase 2: The payments provider

**Ends with:** `npx turbo run typecheck test` passing.

#### 2.1 `apps/api/src/providers/payments/types.ts` (Modify)

- **Change:** `CheckoutSessionInput` gains `productName` (optional; defaults to
  the course title). `createRefund` gains `amountCents?` and
  `refundApplicationFee?` (default true, as today). Add to `PaymentsProvider`:
  `refundApplicationFee({ applicationFeeId, amountCents, idempotencyKey })`,
  returning its id; `reverseTransfer({ transferId, amountCents,
  refundApplicationFee, idempotencyKey })`, returning its id;
  `setPayoutMode(accountId, 'manual' | 'automatic')`;
  `retrieveBalance(accountId)`, returning `{ availableCents, pendingCents }`
  for SGD; `createPayout({ accountId, amountCents, idempotencyKey })`,
  returning `{ payoutId }`; `listRefundIds(chargeId)`, returning each refund's
  id and amount. `UnconfiguredPaymentsProvider` throws from each.
- **Why:** Part refunds, the fee kept back, held payouts and the dispute rule
  each need a call the provider does not have.

#### 2.2 `apps/api/src/providers/payments/stripe.ts` (Modify)

- **Change:** `createCheckoutSession` uses `productName`. `createRefund` sends
  `amount` when given and sets `refund_application_fee` from the input.
  Implement the new methods with `applicationFees.createRefund`,
  `transfers.createReversal`, the balance settings or `accounts.update`
  `settings.payouts.schedule.interval` (whichever the installed SDK version
  supports for these accounts), `balance.retrieve` and `payouts.create` with
  the `stripeAccount` option, and `refunds.list` by charge. Every call that
  moves money passes its idempotency key.
- **Why:** The real provider.

#### 2.3 `apps/api/src/providers/payments/fake.ts` (Modify)

- **Change:** Sessions track `refundedCents` and `feeRefundedCents` exactly,
  so a part refund refunds a part. Accounts keep `payoutMode`, an available
  and a pending balance that charges, reversals, fee refunds and payouts
  change, and a list of payouts. Add test drivers: `settle(accountId)` to move
  pending to available; `disputeEvent(paymentIntentId, 'created' | 'won' |
  'lost')`; `payoutEvent(payoutId, 'paid' | 'failed')`; and a switch that
  makes the next call of a named method fail once. `refundedEvent` carries
  real refund ids.
- **Why:** The fake could only refund in full, so no test could cover a part
  refund, a balance or a payout.

#### 2.4 `apps/api/test/stripe-provider.test.ts` and a new `apps/api/test/fake-payments.test.ts`

- **Change:** `stripe-provider.test.ts` (Modify): the parameters each new and
  changed method sends, with the Stripe client stubbed as the existing tests
  stub it. `fake-payments.test.ts` (Create): the fake's balances after a
  charge, a part refund with and without the fee, a fee refund, a reversal and
  a payout match the table under "Refunds" on the S$500 example.
- **Why:** Every later test trusts the fake's arithmetic.

### Phase 3: Selling a seat

**Ends with:** `npx turbo run typecheck test` passing.

#### 3.1 `apps/api/src/env.ts` and `.env.example` (Modify)

- **Change:** `env.ts`: add `CLASS_SALES: bool.default(false)` beside
  `CLASSES`. `.env.example`: add `CLASS_SALES=true`.
- **Why:** The setting that stops new class sales.

#### 3.2 `apps/api/src/services/class-sales.service.ts` (Create)

- **Change:** `accept(actor, input)` and `end(actor)`, as "Opting in"
  describes, calling `setPayoutMode` before recording anything.
  `status(profileId)` for the Teach settings card: opted in or not, the terms
  version, and whether opting out is allowed.
- **Why:** Opting in changes a Stripe account and a profile together; one
  place keeps the order.

#### 3.3 `apps/api/src/services/class-checkout.service.ts` (Create)

- **Change:** `quote(user, classId, promoCode?)` and `start(user, classId, {
  promoCode, locale })`, the five steps under "Buying a seat". It reuses
  `PaymentsService.quoteFor` and `resolvePromo`, and builds the same payment
  page details as self-paced checkout plus `classId`, with `productName` the
  course title and the class name, and the cancel address the course page with
  the class named. `seatsTaken(tx, classId, exceptEnrollmentId?)` is the one
  count of seats, exported for the services that move and release seats.
- **Why:** Class checkout shares the quote and the payment page with
  self-paced checkout and differs in the seat steps; a separate service keeps
  `startCheckout` unchanged.

#### 3.4 `apps/api/src/services/seat-refunds.service.ts` (Create)

- **Change:** `request(tx, { enrollmentId, paymentId, classId, kind,
  requestedCents?, reason, requestedBy, cancellationId? })` writes a
  `pending` row with the amounts from `seatRefund()`. Nothing sends a refund
  yet; Phase 4 adds the executor.
- **Why:** Fulfilment in this phase must be able to record that a paid seat
  was lost. The row waits until Phase 4's executor exists, which is safe
  because no environment has `CLASS_SALES` on before the whole plan is built.

#### 3.5 `apps/api/src/services/payments.service.ts` (Modify)

- **Change:** In `fulfilCheckout`: read `classId` from the payment page's
  details. With none, nothing changes. With one: lock the class row before the
  enrollment row; apply the seat rule under "Fulfilment"; store `classId` on
  the payment; skip the `enrolCount` increment; on a lost seat write a
  `seat_lost` refund row through `SeatRefundsService.request` in place of
  activating;
  and send the class receipt in place of the course receipt. `syncSession`
  adds `classId` to a paid answer.
- **Why:** Fulfilment is where a payment becomes a seat, and it is shared by
  the webhook and the confirmation page.

#### 3.6 `apps/api/src/services/catalog.service.ts` and `packages/core/src/contracts/catalog.ts` (Modify)

- **Change:** `CoursePublicView` gains `classes: ClassForSale[]` and
  `viewer.classSeats: ViewerClassSeat[]`; `viewer` is present when the learner
  has a self-paced enrollment or a seat. `detail` fills `classes` from the
  course's classes that pass `classOnSale`, each with `seatsLeft`, and
  `classSeats` from the learner's class enrollments that are active.
- **Why:** The course page is where a class is chosen.

#### 3.7 `packages/core/src/contracts/checkout.ts` (Modify)

- **Change:** `quoteRequestSchema` gains optional `classId`.
  `CheckoutSyncResponse`'s paid variant gains optional `classId`.
- **Why:** Both are additions an older app ignores.

#### 3.8 `apps/api/src/routes/checkout.ts` (Modify)

- **Change:** `POST /quote` passes `classId` to `ClassCheckoutService.quote`
  when present. Add `POST /classes/:classId`, with `requireUser()` and
  `validate('json', classCheckoutRequestSchema)`.
- **Why:** The new endpoint; the self-paced one is untouched.

#### 3.9 `apps/api/src/routes/teach-classes.ts` (Modify)

- **Change:** Add `GET class-sales` (`profile.read`), `POST class-sales/accept`
  and `POST class-sales/end` (both `stripe.links` with the recent-sign-in
  check).
- **Why:** Opting in is done from Teach.

#### 3.10 `packages/i18n/src/messages/areas/email.en.ts` and `email.zh.ts` (Modify)

- **Change:** Add the `email.classReceipt.*` keys: title, what was bought with
  the class name, the dates and place as a list, the refund terms in one
  sentence, and the button to the class screen.
- **Why:** Learner emails take their text from this area.

#### 3.11 `apps/api/test/helpers/test-app.ts` and `apps/api/test/role-routes.test.ts` (Modify)

- **Change:** `test-app.ts`: default `CLASS_SALES` to `'true'`; add
  `optIn(profileId)`, and `buySeat(email, classId)`, which starts a class
  checkout and completes it through the fake provider. `role-routes.test.ts`:
  add rows for the three `class-sales` routes, with `stripe.links` using the
  existing `owner` marker.
- **Why:** Later tests buy seats; every Teach route needs a row.

#### 3.12 Tests in `apps/api/test/` (Create two, modify one)

- **Change:**
  - `class-sales.test.ts`: opting in switches the fake account to manual and
    records the acceptance; a Stripe failure records nothing; a manager is
    refused; opting out is refused with a seat sold.
  - `class-checkout.test.ts`: each `classOnSale` reason; `own_class`; a zero
    price refused; the last seat with two learners; a hold expiring by the
    clock; a learner's second hold for the same course ending the first; a
    learner with a self-paced enrollment buying a seat and keeping both; a
    learner who withdrew buying the same class again; the receipt's content
    and language; the `classId` in the sync answer; no change to
    `courses.enrol_count`; a payment after the seat was lost writing a
    `seat_lost` row.
  - `checkout.test.ts` (Modify): one test that the self-paced flow's requests,
    stored details and answers are byte-for-byte what they were, with
    `CLASS_SALES` on.
- **Why:** The seat rule and the unchanged self-paced path are the two things
  this phase must not get wrong.

### Phase 4: Refunds, withdrawing, moving and cancelling

**Ends with:** `npx turbo run typecheck test` passing. Starts only after the
sandbox test.

#### 4.1 `apps/api/src/services/attendance.service.ts` (Modify)

- **Change:** Add two read methods: `attendedEnrollmentIds(tx, classId)`, the
  enrollments with a check-in or manual mark that stands for any block, worked
  out with `attendanceState` from core; and `hasAnyAttendance(classId)`, true
  when the class has any `check_in` or `manual_mark` event.
- **Why:** The refund lock and the release check both ask about attendance,
  and Part 1 keeps attendance reads beside its one writer.

#### 4.2 `apps/api/src/services/seat-refunds.service.ts` (Modify)

- **Change:** Add the executor. `execute(id)` is the three steps under "How
  a refund is sent", reading the row's status first. `executePending()` runs
  `execute` for every `pending` or `refund_sent` row, oldest first, catching
  and recording each failure. On `done` it calls `applyRefund` with Stripe's
  refund id, sets the enrollment status by the values table, writes the audit
  entries, and sends the emails in the emails table.
- **Why:** One writer and one executor for every seat refund keep the money
  rules in one place and make each refund resumable.

#### 4.3 `apps/api/src/services/seats.service.ts` (Create)

- **Change:** `list(actor, classId)` returns `SeatView[]`. `withdraw(user,
  enrollmentId)`, `move(actor, classId, enrollmentId, toClassId)`,
  `refund(actor, classId, enrollmentId, input)`, `cancelClass(actor, classId,
  input)` and `cancelClassByElevate(user, classId, input)`, as "Withdrawing,
  moving and cancelling" describes. Each loads the class through
  `ClassesService.load` (Elevate's cancellation loads it by id), locks the
  class row, uses `attendedEnrollmentIds`, and writes refund rows through
  `SeatRefundsService.request` inside the same transaction. `withdraw` and
  `refund` call `execute` after the transaction commits. `learnerSeat(user,
  enrollment)` returns `LearnerSeat`.
- **Why:** Each action is a seat rule plus a refund request; keeping them
  together keeps the lock order the same everywhere: class, then enrollment.

#### 4.4 `apps/api/src/services/transactions.service.ts` (Modify)

- **Change:** `applyRefund`: for a payment with a `classId`, a full refund sets
  the enrollment to the status the caller passes (default `refunded`) and
  never changes `enrolCount`; `refundedCents` is set to the sum of the
  payment's refund rows, computed inside the locked transaction.
  `applyChargeRefunded`: call `listRefundIds` for the charge and call
  `applyRefund` once per refund id not yet recorded, in place of working out a
  difference and a made-up id. `refund` (Support's action) passes an
  idempotency key `support-refund:<paymentId>`.
- **Why:** A refund made by Support or in the Stripe dashboard must free the
  seat, and a part refund must not be counted twice.

#### 4.5 `apps/api/src/routes/classes.ts` (Modify)

- **Change:** Add `POST /:enrollmentId/withdraw`, with `requireUser()` and
  `requireClasses`. `GET /` adds `seat: LearnerSeat` to each item.
- **Why:** The learner's side of withdrawing.

#### 4.6 `apps/api/src/routes/teach-classes.ts` (Modify)

- **Change:** Add `GET classes/:id/seats` (`earnings.read`), `POST
  classes/:id/cancel` (`class.manage`), `POST
  classes/:id/learners/:enrollmentId/move` (`class.manage`) and `POST
  classes/:id/learners/:enrollmentId/refund` (`class.refund`).
- **Why:** Seats show money, so they sit behind the capability that already
  guards earnings.

#### 4.7 `apps/api/src/routes/support.ts` (Modify)

- **Change:** Add `POST /classes/:id/cancel`, with `requireRole('super_admin')`.
- **Why:** Elevate's own cancellation.

#### 4.8 `apps/api/src/services/classes.service.ts` (Modify)

- **Change:** `publish`, `update`, `remove` and `setInstructor` refuse a
  cancelled class with `class_not_published`. `update` refuses to move a block
  of a class with a seat sold so that its last block ends more than 82 days
  after the class's earliest payment.
- **Why:** A cancelled class is closed, and a schedule change must not carry
  held money past Stripe's limit.

#### 4.9 `packages/i18n/src/messages/areas/email.en.ts` and `email.zh.ts` (Modify)

- **Change:** Add the keys for the six other learner emails in the emails
  table.
- **Why:** Learner emails take their text from this area.

#### 4.10 `apps/api/test/role-routes.test.ts` (Modify)

- **Change:** Add rows for the four Teach routes of 4.6, with fixture ids for a
  second class to move to and a seat to refund. `class.refund` and
  `class.manage` are refused for a writer and for staff; `earnings.read` is
  refused for a writer.
- **Why:** Every Teach route needs a row.

#### 4.11 Tests in `apps/api/test/` (Create two)

- **Change:**
  - `seat-refunds.test.ts`: for each kind, the two Stripe calls, the fake's
    balances afterwards, the payment and enrollment state, and the emails;
    `execute` resumed from `pending` and from `refund_sent` sends each call
    once; a failure is recorded and retried; a refund made by Support's action
    and by a dashboard `charge.refunded` event frees the seat and is counted
    once.
  - `seats.test.ts`: withdrawal at each edge and after attending; a moved
    learner's withdrawal; each move problem; a move changing the payment's
    class and freeing the old seat; a discretionary refund by an owner, a
    manager, and refused for a writer, too large, and after release;
    cancelling before the start, after a block with attended and
    non-attended learners, and twice; Elevate's cancellation refunding
    attended learners too; a cancellation ending holds.
- **Why:** These are the author's refund rules, one test per rule.

### Phase 5: The release job, disputes and payout records

**Ends with:** `npx turbo run typecheck test` passing.

#### 5.1 `apps/api/src/services/payouts.service.ts` (Create)

- **Change:** `run()` is the four steps under "One run". Private steps:
  `markDue(tx, account, now)`, `heldByMark(tx, account)`,
  `heldByCalendar(tx, account, now)`, which must not read `released_run_id`,
  and `pay(account, held)`. An account is claimed with `select ... for update
  skip locked` on its `payout_accounts` row. `overview()` returns
  `SupportPayoutsOverview`. `forProfile(actor)` returns the held classes and
  recent payouts for Teach. `clearReview(user, classId, input)` sets the
  review-cleared fields and writes an audit entry.
- **Why:** The author's payout design: balance less held, payments marked per
  run, a record per run, and a second total as a check.

#### 5.2 `apps/api/src/release.ts` (Create), `apps/api/tsup.config.ts` and `apps/api/Dockerfile` (Modify)

- **Change:** `release.ts` builds `deps` as `server.ts` does, calls
  `PayoutsService.run()`, logs the run's counts, and exits 0 when the run
  finished, 1 when it threw. `tsup.config.ts`: add it to `entry` and to the
  comment. `Dockerfile`: add it to the comment listing entry files.
- **Why:** The program the scheduled task runs.

#### 5.3 `apps/api/src/services/stripe-events.ts` (Modify)

- **Change:** Add handlers for `charge.dispute.created`,
  `charge.dispute.closed`, `payout.paid` and `payout.failed`, as the table
  under "Disputes" describes. A dispute is matched to a payment by its payment
  intent. A lost dispute on a class payment writes a `dispute_lost` row
  through `SeatRefundsService`, whose executor calls `reverseTransfer` in
  place of a refund.
- **Why:** The author's dispute rule, and the status of each payout.

#### 5.4 `apps/api/src/services/seat-refunds.service.ts` (Modify)

- **Change:** `execute` handles `dispute_lost`: reverse the payment's transfer
  in full with Elevate's fee refunded, with the key `seat-reversal:<id>`, then
  the ledger step, with the enrollment set to `refunded`.
- **Why:** The bank has already returned the learner's money; only the
  teacher's share is taken back.

#### 5.5 `apps/api/src/services/webhooks.service.ts` and `apps/api/src/routes/webhooks.ts` (Modify)

- **Change:** `record` returns one of `new`, `retry` or `duplicate`: `retry`
  when the stored row has an error and no successful processing. The route
  dispatches `new` and `retry`, and answers 200 as a duplicate only for
  `duplicate`.
- **Why:** Today an event whose handler failed is never handled again. Dispute
  and payout events must not be lost that way.

#### 5.6 `apps/api/src/services/earnings.service.ts` and `packages/core/src/contracts/teach.ts` (Modify)

- **Change:** `EarningsView` gains `heldCents`, `heldClasses:
  HeldClassView[]` and `payouts: PayoutView[]`, filled from
  `PayoutsService.forProfile` for an opted-in profile and empty otherwise.
- **Why:** A teacher must be able to see what is held and why.

#### 5.7 `apps/api/src/routes/support.ts` (Modify)

- **Change:** Add `GET /payout-runs`, answering `SupportPayoutsOverview`, and
  `POST /classes/:id/clear-review`, with `requireRole('super_admin')`.
- **Why:** Support is where a mismatch, a failed payout and a class under
  review are seen and acted on.

#### 5.8 Tests in `apps/api/test/` (Create two, modify two)

- **Change:**
  - `payouts.test.ts`: a class released 7 days after its last block and after
    a cancellation, and not one second earlier; its payments marked with the
    run; a class with no attendance put under review, released when cleared,
    and force-released at 85 days with the reason `stripe_limit`; a payment
    with an open dispute staying held after its class is released; the payout
    on the S$500 example with self-paced and class money in one balance; held
    exceeding the balance paying nothing; `below_minimum`;
    `already_paid_today` across a Singapore midnight; a deliberately unmarked
    payment giving `mismatch`, no payout for that teacher and a payout for
    another; two runs started together paying once; a run that throws after
    marking completed by the next; the row recorded for each outcome.
  - `disputes.test.ts`: opened, won and lost on a class payment and on a
    self-paced one; the fake's balances after a loss; the seat closed.
  - `webhooks-stripe.test.ts` (Modify): a failed event handled again on
    redelivery; a handled one answered as a duplicate.
  - `certificates-earnings.test.ts` (Modify): the three new earnings fields.
- **Why:** The release rules and the mismatch check are what stand between a
  teacher and the wrong amount of money.

### Phase 6: Readiness for real learners

**Ends with:** `npx turbo run typecheck test` passing.

#### 6.1 `apps/api/src/routes/auth.ts` (Modify)

- **Change:** Replace the one limiter on `POST /magic-link` with two: `rateLimit({
  name: 'magic-link-email', limit: 5, windowMs: 15 * 60_000, key: <the
  lower-cased email from the body> })` and `rateLimit({ name:
  'magic-link-address', limit: 300, windowMs: 15 * 60_000 })`. The email
  limiter runs after validation.
- **Why:** A class on one venue network must be able to sign in, and one
  inbox must not be flooded.

#### 6.2 `apps/api/src/services/attendance.service.ts` (Modify)

- **Change:** Add `eraseCoordinates(user, learnerUserId, input)`: delete the
  learner's rows from `attendance_event_locations` and write a
  `coordinates.erased` audit entry with the count and the reason. In
  `supportBlock`, write a `coordinates.viewed` audit entry naming the class and
  block when the answer contains any coordinates.
- **Why:** Part 1 listed both as conditions for real learners, and this
  service is the only writer of those tables.

#### 6.3 `apps/api/src/routes/support.ts` (Modify)

- **Change:** Add `POST /learners/:userId/erase-coordinates`, with
  `requireRole('super_admin')`.
- **Why:** The recorded step for an erasure request.

#### 6.4 `apps/api/test/class-guards.test.ts`, `support-classes.test.ts` and a new `sign-in-limit.test.ts`

- **Change:** `class-guards.test.ts` (Modify): `attendance.service.ts` may
  delete from `attendanceEventLocations`; no other file may; and no file other
  than `class-checkout.service.ts` and `seats.service.ts` may set `classId` on
  an enrollment. `support-classes.test.ts` (Modify): an erasure removes the
  rows, leaves the events, writes the audit entry, and the block view then
  shows `'erased'`; each view with coordinates writes an audit entry.
  `sign-in-limit.test.ts` (Create): 40 different emails from one address
  succeed; the sixth request for one email is refused.
- **Why:** Each readiness item has a test.

### Phase 7: Learner app

**Ends with:** `npx turbo run typecheck test` passing, including
`npm -w @elevate/learner test`.

#### 7.1 `packages/i18n/src/messages/areas/learnerCourse.en.ts`, `learnerCheckout.en.ts`, `learnerClass.en.ts` and their `.zh.ts` files (Modify)

- **Change:** `learnerCourse`: "Take it as a class", the one-line description
  of what a class seat includes and does not, a class row (dates, place,
  seats left, full), "Book this class", "You have a seat", and the native
  "choose your class on the web" text. `learnerCheckout`: the class summary,
  the refund terms, the class confirmation ("Your seat is booked", with the
  dates and place) in place of "Start learning". `learnerClass`: "Withdraw",
  the amount and deadline, the confirmation, "Withdrawal has closed", "You were
  moved to this class", and the cancelled-class states.
- **Why:** The learner app has no English literals. The Chinese text needs the
  author's sign-off.

#### 7.2 `apps/learner/src/lib/catalog.ts` and `apps/learner/src/lib/classes.ts` (Modify)

- **Change:** `catalog.ts`: `fetchQuote` takes an optional `classId`; add
  `startClassCheckout(classId, { locale, promoCode? })`. `classes.ts`: add
  `withdraw(enrollmentId)`.
- **Why:** The app's API calls live in `lib`.

#### 7.3 `apps/learner/src/app/course/[slug].tsx` (Modify)

- **Change:** Below the existing enrol card, when `classes` is not empty, a
  "Take it as a class" section listing each class with its button; a full
  class is shown as full; a class the learner has a seat in shows "You have a
  seat" and links to the class screen. On the web a button goes to
  `/checkout/class/<id>`. In the installed app it opens the web course page
  with `?class=<id>`. On the web, a `class` parameter scrolls to and marks
  that class. The existing enrol button and its logic are unchanged.
- **Why:** The course page is where a class is chosen, and the installed app
  hands paid checkout to the web.

#### 7.4 `apps/learner/src/app/checkout/class/[classId].tsx` (Create) and `apps/learner/src/app/_layout.tsx`, `apps/learner/src/lib/sign-in-redirect.ts` (Modify)

- **Change:** The class checkout page: the class summary, the price, the promo
  field, the refund terms, and "Pay". It calls `fetchQuote` with the class and
  `startClassCheckout`, and shows each error in the learner error table. Add
  the screen to the signed-in group; `/^\/checkout\//` in `SIGNED_IN_ONLY`
  already covers its address.
- **Why:** A separate page keeps the self-paced checkout page unchanged.

#### 7.5 `apps/learner/src/app/checkout/success.tsx` (Modify)

- **Change:** When the sync answer has a `classId`, show the class
  confirmation and link to `/class/<enrollmentId>`.
- **Why:** "Start learning" is wrong for a class three weeks away.

#### 7.6 `apps/learner/src/app/class/[enrollmentId].tsx` (Modify)

- **Change:** Show the seat's state: the amount and deadline for withdrawal
  with a "Withdraw" action and a confirmation step; "Withdrawal has closed";
  "You were moved to this class"; and, for a cancelled class, that it was
  cancelled and whether a refund was made.
- **Why:** Where a learner manages their seat.

#### 7.7 Learner tests (Create two)

- **Change:** `apps/learner/src/__tests__/class-checkout.test.tsx` (Create):
  the summary and terms are shown; each error shows its message; a full class
  has no button. `apps/learner/src/__tests__/class-seat.test.tsx` (Create):
  withdrawal
  shown with its amount and deadline, hidden after the deadline, and the moved
  and cancelled states.
- **Why:** The screens that carry the learner-side rules.

### Phase 8: Teach portal

**Ends with:** `npx turbo run typecheck build` passing.

#### 8.1 `packages/i18n/src/messages/areas/teachSettings.en.ts` and `teachSettings.zh.ts` (Modify)

- **Change:** Add the class-sales card: its title, the held-payout terms as
  whole sentences, "Accept and start selling classes", the accepted state with
  its date, "Stop selling classes", and why stopping is unavailable.
- **Why:** The Teach Settings page is translated. The terms need a lawyer and
  the Chinese needs the author's sign-off.

#### 8.2 `apps/teach/src/lib/keys.ts` and `apps/teach/src/lib/classes.ts` (Modify)

- **Change:** `keys.ts`: add `classKeys.seats(profileId, id)` and
  `classKeys.sales(profileId)`. `classes.ts`: add `useClassSales`,
  `useSeats`, and to `useClassActions`: `acceptClassSales`, `endClassSales`,
  `cancelClass`, `moveSeat`, `refundSeat`.
- **Why:** Hooks and keys for the new routes, in the files Part 1 created.

#### 8.3 `apps/teach/src/routes/settings.tsx` (Modify)

- **Change:** Add the class-sales card, shown to the owner when
  `classesEnabled`. It shows the terms and the accept action, which needs a
  recent sign-in as the Stripe links do; or the accepted state and the stop
  action.
- **Why:** Where a profile opts in.

#### 8.4 `apps/teach/src/routes/classes/detail.tsx` (Modify)

- **Change:** For `earnings.read`: a seats table (learner, status, paid,
  refunded, attended) with, for `class.manage`, "Move" and, for
  `class.refund`, "Refund" on rows where the action is allowed. For
  `class.manage`: "Cancel class", with a dialog that states how many learners
  will be refunded in full and how many have attended and will not. A
  cancelled class shows its reason and each refund's state. A class not on
  sale shows why, including "your profile has not opted in".
- **Why:** The page from which a profile sells, moves, refunds and cancels.

#### 8.5 `apps/teach/src/components/seat-dialogs.tsx` (Create)

- **Change:** Three dialogs built from `Dialog`, `Field`, `Input`,
  `NativeSelect` and `Textarea`: cancel (reason), move (the profile's other
  classes of the course that have a seat, with the problem shown for those
  that do not qualify), and refund (amount up to the maximum, reason).
- **Why:** Each action needs input before it is sent.

#### 8.6 `apps/teach/src/routes/earnings.tsx` (Modify)

- **Change:** For an opted-in profile, replace the line "Payouts land in your
  bank on Stripe's schedule" with: the held total, a table of held classes
  with their release dates and any "under review" note, and the recent payouts
  with their status.
- **Why:** A teacher must be able to see what is held and when it is due.

### Phase 9: Support portal

**Ends with:** `npx turbo run typecheck build` passing, and then the local
walkthrough below.

#### 9.1 `apps/support/src/lib/queries.ts` (Modify)

- **Change:** Add `usePayoutsOverview`, and actions `clearReview`,
  `cancelClassByElevate` and `eraseCoordinates`.
- **Why:** Support's hooks live in this file.

#### 9.2 `apps/support/src/routes/payouts.tsx` (Create), `apps/support/src/router.tsx` and `apps/support/src/routes/layout.tsx` (Modify)

- **Change:** A page at `payouts`: the last finished run and a warning when it
  is more than an hour old; mismatches, with both totals; failed payouts;
  classes under review, each with "Release" for a Support admin; forced
  releases; classes cancelled after they started; and the recent runs. Add the
  route and a nav item `t('nav.payouts')`.
- **Why:** The one place Support sees the job's health and the release checks.

#### 9.3 `packages/i18n/src/messages/areas/chrome.en.ts` and `chrome.zh.ts` (Modify)

- **Change:** Add `nav.payouts`.
- **Why:** The portals' navigation is translated.

#### 9.4 `apps/support/src/routes/class-view.tsx`, `transactions.tsx` and `person.tsx` (Modify)

- **Change:** `class-view.tsx`: "Cancel class (Elevate)" for a Support admin,
  with a reason. `transactions.tsx`: on a class payment, show the class, the
  seat's state and its seat refunds. `person.tsx`: "Erase location data" for a
  Support admin, with a reason and the count erased.
- **Why:** The three Support actions this design adds.

### Phase 10: Infrastructure and deploy

**Ends with:** Terraform validated and the workflow linted, through Docker.
Nothing is applied to AWS in this phase.

#### 10.1 `infra/terraform/modules/environment/api.tf` (Modify)

- **Change:** Add `CLASS_SALES = tostring(var.class_sales)` to
  `api_environment`. Add `aws_ecs_task_definition.release`, family
  `${local.prefix}-release`, with the API task's sizing, roles, runtime
  platform, image, environment, secrets and log configuration, the same
  container name, no port mappings, and the command `["node",
  "dist/release.js"]`.
- **Why:** The job needs the API's settings and its restricted database user,
  and a schedule cannot change a task's command.

#### 10.2 `infra/terraform/modules/environment/scheduler.tf` (Create)

- **Change:** An SQS standard queue `${local.prefix}-release-dlq`. An IAM role
  that `scheduler.amazonaws.com` can assume, allowed `ecs:RunTask` on the
  release task family in this cluster, `iam:PassRole` on the API's execution
  and task roles, and `sqs:SendMessage` on the queue. An
  `aws_scheduler_schedule` with `rate(15 minutes)`, the flexible window off,
  the ECS target (the cluster, the release task definition without a revision,
  Fargate, the API's subnets and security group, a public address as the
  migration task has), up to 2 retries, the dead-letter queue, and its state
  from `var.release_schedule_enabled`.
- **Why:** What starts the job. The state variable lets the schedule be
  created off and turned on after the first deploy.

#### 10.3 `infra/terraform/modules/environment/iam.tf` (Modify)

- **Change:** In the deploy role, allow `ecs:RunTask` on the release task
  family, beside the API and migration families.
- **Why:** So the job can be started by hand from the deploy role during a
  rehearsal.

#### 10.4 `infra/terraform/modules/environment/variables.tf` and `outputs.tf` (Modify)

- **Change:** `variables.tf`: add `class_sales` (boolean, default false) and
  `release_schedule_enabled` (boolean, default false). `outputs.tf`: add
  `ECS_RELEASE_TASK_FAMILY` to `github_environment_variables`.
- **Why:** The two switches, and the family name the workflow reads.

#### 10.5 `infra/terraform/envs/staging/main.tf` and `infra/terraform/envs/production/main.tf` (Modify)

- **Change:** In each, declare and pass `class_sales` and
  `release_schedule_enabled`. In production, change
  `db_backup_retention_days` from 7 to 35.
- **Why:** Each environment sets the switches; real attendance and payment
  records need longer backups.

#### 10.6 `infra/terraform/envs/staging/terraform.tfvars.example` and `infra/terraform/envs/production/terraform.tfvars.example` (Modify)

- **Change:** Add commented `class_sales` and `release_schedule_enabled` with
  one line each on when to turn them on.
- **Why:** The examples document each setting.

#### 10.7 `.github/workflows/deploy.yml` (Modify)

- **Change:** Add `ECS_RELEASE_TASK_FAMILY` from `vars`. In "Register the task
  definition", register a new revision of the release family as well. If the
  sandbox of step 10.8 shows the schedule needs a revision, add a step that
  updates the schedule to the new revision; otherwise nothing more.
- **Why:** All three task definitions must run the same image.

#### 10.8 A check before 10.7 is finished

- **Change:** On staging, with the author's go-ahead, create the schedule
  pointing at the task definition without a revision and confirm a run uses
  the latest revision. Record the result in `infra/README.md`.
- **Why:** AWS's documentation does not say whether a schedule's ECS target
  accepts a task definition without a revision.

### Phase 11: Documents

**Ends with:** `npm run lint` passing.

#### 11.1 `docs/adr/013-class-sales-and-held-payouts.md` (Create)

- **Change:** Record: a seat is a class enrollment and an unpaid one is the
  hold; opting in per profile switches that Stripe account to manual payouts;
  the held total, the two routes and the mismatch rule; the refund table and
  that `seatRefund()` is the only place it is computed; the 85-day limit; that
  it extends ADR 003 and ADR 007 for opted-in profiles and leaves them
  unchanged for others.
- **Why:** These decisions change the payment model for some profiles.

#### 11.2 `docs/adr/003-payments-destination-charges.md` and `docs/adr/007-payout-accounts.md` (Modify)

- **Change:** One line in each pointing to ADR 013 for class sales and manual
  payouts.
- **Why:** A reader of the older records must find the newer one.

#### 11.3 `docs/spec.md` (Modify)

- **Change:** Under the dated decision Part 1 adds, note that classes are sold
  as of this design, and add class payments, held payouts and seat refunds to
  the data model summary.
- **Why:** The spec is the product's summary.

#### 11.4 `AGENTS.md` (Modify)

- **Change:** Add to "Rules": a refund of a class seat goes through
  `SeatRefundsService`, and its amounts come only from `seatRefund()` in
  `money.ts`; `seatsTaken` in `class-checkout.service.ts` is the only count of
  seats; a transaction that locks a class and an enrollment locks the class
  first; only `PayoutsService` creates a payout or sets `released_run_id`;
  only `class-checkout.service.ts` and `seats.service.ts` set an enrollment's
  `class_id`.
- **Why:** The repo's rules are enforced by being written here.

#### 11.5 `infra/README.md` (Modify)

- **Change:** Describe the release task and its schedule; how to read a run
  from the Support payouts page and from the logs; how to start a run by hand;
  how to turn the schedule off and on; what to do with a message in the
  dead-letter queue; how to switch one teacher's Stripe account back to
  automatic payouts by hand; and the rollout order.
- **Why:** Operators run and repair the job from these notes.

### Verification Plan

- **Compilation/Build**: `npx turbo run typecheck build`.
- **Unit Tests**: `npx turbo run test`.
- **Static Analysis & Linting**: `npm run lint` and `npm run check:dupes` at
  the root; `npx expo-doctor` inside `apps/learner`.
- **Terraform**: from `infra/terraform`, `docker run --rm -v "$PWD":/w -w
  /w/envs/staging hashicorp/terraform:latest init -backend=false`, then the
  same with `validate`; repeat for `envs/production`.
- **Workflow**: from the repo root, `docker run --rm -v "$PWD":/repo -w /repo
  rhysd/actionlint:latest`.

**Goals and what proves them**

| Goal                                               | Proved by                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A learner can buy a seat                           | `class-checkout.test.ts`; walkthrough step 2                                                                    |
| A class never has more learners than seats         | `class-checkout.test.ts` (last seat, expired hold, lost seat)                                                   |
| Self-paced and a seat together                     | `class-checkout.test.ts`; `class-entitlement.test.ts` from Part 1                                               |
| Self-paced checkout does not change                | `checkout.test.ts`, existing and the added test                                                                 |
| A profile sells only after opting in               | `class-sales.test.ts`, `class-checkout.test.ts`                                                                 |
| Not paid until 7 days after the class              | `payouts.test.ts`                                                                                               |
| Released by a job, recorded per run                | `payouts.test.ts`; walkthrough step 8                                                                           |
| A wrong held total cannot pay out                  | `payouts.test.ts` (mismatch)                                                                                    |
| Cancelling, and the attendance lock                | `seats.test.ts`, `seat-refunds.test.ts`                                                                         |
| Withdrawal                                         | `seats.test.ts`, core `class-sales.test.ts`                                                                     |
| Moving                                             | `seats.test.ts`                                                                                                 |
| Elevate's cancellation                             | `seats.test.ts`                                                                                                 |
| Elevate loses nothing on a refund it did not cause | core `money.test.ts`, `seat-refunds.test.ts`, `fake-payments.test.ts`; and the sandbox test against real Stripe |
| Every refund path frees the seat                   | `seat-refunds.test.ts`                                                                                          |
| Disputes                                           | `disputes.test.ts`                                                                                              |
| A class with no attendance is not released         | `payouts.test.ts`                                                                                               |
| Refund terms shown before paying                   | learner `class-checkout.test.tsx`; walkthrough step 2                                                           |
| The learner is told what they bought               | `class-checkout.test.ts` (receipt); walkthrough step 2                                                          |
| Safe to roll back                                  | By hand: rollout step 13                                                                                        |
| Readiness                                          | `sign-in-limit.test.ts`, `support-classes.test.ts`; rollout step 10 for backups                                 |

**Local walkthrough**, after Phase 9, with the fake payments provider,
`CLASSES` and `CLASS_SALES` on and `npm run db:seed`. Sign-in codes come from
the API log.

1. As the demo owner, open Settings and accept the class-sales terms. Expect
   the accepted state. Create and publish a class of 2 seats, three weeks
   ahead; expect it to show as on sale.
2. As a learner on the web, open the course page; expect the class under "Take
   it as a class" with "2 seats left". Choose it; expect the refund terms on
   the checkout page. Pay; expect "Your seat is booked" with the dates, and a
   receipt in the API log's mail output naming the class.
3. As a second learner, start checkout and stop at the payment page. As a
   third, try to book; expect "This class is full".
4. As the first learner, open the class in the app; expect the withdrawal
   amount and deadline. Withdraw; expect the seat count on the course page to
   rise.
5. As the demo owner, open the class page; expect the seats table. Cancel the
   class; expect the dialog's counts, then the class shown as cancelled.
6. Run `node dist/release.js` by hand; expect the cancelled seat's refund sent.
7. As Support, open Payouts; expect the run listed, and no mismatch.
8. As the demo owner, open Earnings; expect the held total and the payout
   list.
9. As a Support admin, erase the first learner's location data from their
   person page; expect a count and an audit entry.

**Rollout and rehearsal on staging**, after Phase 11, with the author's
go-ahead and a Stripe test-mode account.

10. Apply Terraform with both new switches off. Confirm production's plan
    shows backup retention changing to 35 days and nothing else unexpected.
    Copy the GitHub variables. Deploy.
11. Do entry 10.8. Turn `release_schedule_enabled` on and apply. Expect a run
    recorded every 15 minutes on the Support payouts page.
12. Turn `CLASS_SALES` on for staging. With a real Stripe test account, repeat
    walkthrough steps 1 to 8, paying with Stripe's test cards. Compare the
    teacher's Stripe balance after each refund kind with the refund table.
    Advance a class past its release by seeding it with past dates; expect a
    payout in Stripe's dashboard.
13. Rehearse the ways back: turn `CLASS_SALES` off and expect no class on sale
    while an existing seat can still check in and withdraw; turn the schedule
    off and on; deploy Part 1's version and expect the app to work with no
    class on sale; deploy this version again.
14. Production: only after a lawyer has read the opt-in terms and the refund
    terms, the author has signed off the Chinese text, and step 12 matched the
    refund table. Apply, copy the variables, deploy, turn on the schedule, then
    `CLASSES`, then `CLASS_SALES`.

---

_Drafted with EGM_
