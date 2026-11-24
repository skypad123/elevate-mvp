# Comprehension Report: Scheduled Classes, Part 2 (Selling a Class)

- **Stage:** 6 (Comprehension Test)
- **Target:** `docs/designs/scheduled-classes-selling.md`, lines 1-955 (design)
  and 956-2016 (implementation plan)
- **Reviewer:** `egm-comprehension`, reading the target alone
- **Date:** 2026-11-24

The reviewer read all 2,016 lines and no other file. There are no Blockers:
every section could be paraphrased. There are 11 Majors and 1 Nit.

## What this proposes

**FeatureRange (lines 1-955).** Elevate will let a learner buy a seat in a
scheduled class from the course page, at the course price, as a purchase
separate from the self-paced course.

- **Seat holds.** Starting checkout holds the seat for 35 minutes (the payment
  page lasts 30), so a class cannot oversell. A payment that lands after the
  seat went to someone else is refunded in full at Elevate's cost.
- **Held money.** A teaching profile must opt in. Opting in switches its Stripe
  account to manual payouts. A job every 15 minutes then pays the teacher their
  Stripe balance less the "held" class money, at most once a day.
- **Release.** A class's money is released 7 days after its last block or its
  cancellation. It is not released while the class has no recorded attendance,
  or for a seat with an open bank dispute, and nothing is held past 85 days.
- **The check.** Each run works out the held total two ways and pays that
  teacher nothing if they differ.
- **Refund rules.** Whoever ends a seat bears Stripe's fee:
  - teacher cancels: full refund, teacher bears the fee;
  - learner withdraws 7 or more days before the start: refund less the fee;
  - Elevate cancels: full refund, Elevate bears the fee;
  - once a learner has attended a block, only the owner or a manager can grant
    a refund, and only until release.
- **Also included.** Moving a learner between classes, handling bank disputes,
  and four "readiness" items: 35-day backups, a new sign-in limit, erasing
  location coordinates, and auditing views of them.

**DetailedRange (lines 956-2016).** An eleven-phase build plan, one entry per
file:

- Phases 1-2: schema, shared rule functions and the payments provider.
- Phases 3-5: class checkout, the refund executor, withdraw/move/cancel, the
  release job and dispute handling.
- Phase 6: the readiness items.
- Phases 7-9: the learner app, Teach portal and Support portal screens.
- Phases 10-11: Terraform, the deploy workflow and documents.

It requires a Stripe sandbox test before Phase 4. It ends with a goal-to-test
table, a 9-step local walkthrough and a 5-step staging and production rollout.

## How the existing system works, per this document

**FeatureRange.** Elevate sells self-paced courses through Stripe Checkout.

- Checkout allows one enrollment per learner per course.
- The teacher's share reaches their Stripe account when the learner pays, and
  Stripe pays it out automatically.
- Elevate takes an application fee equal to its commission plus Stripe's fee.
- A refund is always for the full amount and costs Elevate Stripe's fee. A
  duplicate payment is refunded the same way.
- A failed webhook event is never retried, and a refund can be recorded twice
  under two ids.
- Part 1 (designed, one of seven phases built) adds classes made of "blocks",
  attendance by check-in or manual mark, location coordinates in their own
  table, a restricted database user and a `CLASSES` switch. No route puts a
  learner into a class.
- There are three clients (learner app, Teach, Support) on one API. There is
  no scheduler, no alarms and no Lambda. The sign-in limit is 30 per network
  address per 15 minutes, and backups are kept 7 days.

**DetailedRange.** The code is a monorepo.

- `packages/db` holds the Drizzle schema, with generated migrations.
- `packages/core` holds shared rules, and `money.ts` is the only place fees
  are computed.
- `packages/i18n` holds messages in English and Chinese.
- `apps/api` has a payments provider with a real Stripe implementation and a
  fake one for tests.
- There are learner, Teach and Support apps.
- The API runs as ECS tasks (API and migration), deployed by a GitHub workflow
  with Terraform.

**Guesses in this paraphrase.** The reviewer guessed that a "block" is one
timed session of a class, that "teacher" means the teaching profile's payout
account, and that the commission is 15% of the amount after Stripe's fee. The
document states none of these.

## Findings

### 1. Major: Part 1's vocabulary is required and not restated

Lines 35, 47, 143, 198, 466, 485, 510, 819, 1161-1163.

"Part 1's word list applies." The document cannot be read without that other
file.

- "Block" is used from line 47 onward and never defined.
- "Attended", which decides every refund, is defined as a mark that "stands
  ... as Part 1 defines 'stands'".
- "Check-in" and "manual mark" are not defined.
- The roles "owner", "manager", "member", "writer", "staff" and "instructor"
  are not defined, and neither is their relation to "teacher" and "teaching
  profile". Line 819 implies an instructor is a "writer"; the reviewer had to
  guess.
- "Approved" profile and "payable" payout account are not defined.
- "Coordinates" first appears at line 143 with nothing saying they are
  location data captured at check-in.
- "the roster and code screens" (line 20) is not explained.

### 2. Major: whether a discretionary refund frees the seat

Lines 129, 400, 574, 994, 1040, 1449-1451.

- The goal says "Every refund path frees the seat".
- Line 994 says "a `discretionary` refund changes nothing".
- Line 1449 says `applyRefund` on "a full refund sets the enrollment to ...
  (default `refunded`)", and the executor calls `applyRefund`.

The reviewer could not work out what happens to the seat when the owner grants
a discretionary refund of the full amount, nor what status an attended
learner's seat has after the teacher cancels: it appears to stay `active` in a
cancelled class indefinitely. Separately, line 574 says "set the enrollment's
status by the table above", but that table has no status column. The mapping
is only at line 994, in the other range.

### 3. Major: the 90, 85, 82 and 75-day numbers do not connect

Lines 182, 298, 338, 348, 412, 616, 644, 659, 1006-1007, 1484.

- Line 338 derives 75 from "Stripe's 90 days".
- Line 348 gives 85 with the reason "Stripe's limit", though the limit is
  stated as 90. The 5-day gap is not explained.
- The origin of 82 is never stated (75 + 7, or 85 − 3?).
- A move or reschedule may leave a class ending 82 days after payment. Its
  release is then due on day 89, but the payment is force-released on day 85,
  before the 7-day wait ends. It is not clear whether that is intended.
- CUJ 11 says the class "is released 85 days after its earliest payment",
  while line 659 says "mark any payment older than 85 days". That is per class
  in one place and per payment in the other.
- The reason `stripe_limit` is a column on `classes` only, so it is not clear
  where it is recorded for a single payment.

### 4. Major: the no-attendance review against cancellation

Lines 245-252, 637, 652-657, 1590-1593.

Line 637 says "A cancelled class is released 7 days after it was cancelled."
The run says any due class with "no check-in and no manual mark for any block"
is put under review and left held. A class cancelled before it starts (CUJ 6)
has no attendance by definition, so the two rules give opposite results. The
document also does not say whether a finished class with no seats sold goes to
"needs review".

### 5. Major: the two held totals and the mismatch outcome

Lines 289, 456, 641-667, 712.

- "85 days old or less and whose class is not due, or is under review, or
  which have an open dispute": the grouping of "and" and "or" is ambiguous. It
  is not clear whether the 85-day cap applies to the disputed and under-review
  cases.
- Line 712 says a won dispute means "The next run marks the payment released
  if its class is". The Mark step only describes marking payments at the
  moment it releases a class, and no step revisits a class that is already
  released.
- "The teacher's share, after any refunds" is negative (−F) for a
  teacher-cancelled seat. It is not stated whether a negative amount lowers
  the held total.
- CUJ 10 says the mismatch shows "until a run records matching totals".
  Nothing says who or what makes them match, and meanwhile the teacher
  receives nothing, including self-paced money.
- The outcomes `nothing_due` and `failed` are listed but appear in no step.

### 6. Major: inputs to the refund arithmetic are not stated

Lines 48-49, 66-67, 549-563, 810, 1134-1143.

- The commission rate appears nowhere. S$72.38 and S$410.12 on S$500 can only
  be reproduced by guessing 15% of the amount after Stripe's fee.
- "about 80% refunded" (line 810) depends on the same unstated rate.
- "the estimate when the actual is unknown" does not say when Stripe's actual
  fee is unknown, or which figure is then shown to the learner as in CUJ 5.
- "A payment already part refunded scales each amount to what remains" gives
  no rule or example, for instance a teacher cancellation after a S$300
  discretionary refund.
- `dispute_lost` has no row in the refund table that `seatRefund()` is told to
  follow.

### 7. Major: the local walkthrough cannot produce what it expects

Lines 1978-1990, 1952.

- Learner 1 withdraws in step 4, learner 2 only holds a seat, and learner 3
  was refused. When the owner cancels in step 5 there is no active seat.
- Step 6 says "expect the cancelled seat's refund sent", but no refund row
  would exist.
- Step 5's dialog counts would be zero.
- Step 9 erases location data for a learner who never checked in.
- The goals table cites "walkthrough step 8" for "recorded per run", but the
  run is shown in step 7.

### 8. Major: Phase 10's order is circular

Lines 974-975, 1811-1812, 1869-1881, 1998.

- Phase 10 says "Nothing is applied to AWS in this phase".
- Entry 10.8 is titled "A check before 10.7 is finished" and creates a
  schedule on staging.
- Rollout step 11, after Phase 11 and after the first deploy, says "Do entry
  10.8".

So the deploy workflow in 10.7 is used to deploy before the check that decides
its content. Line 1871 also calls 10.8 a "sandbox", which it is not. "Copy the
GitHub variables" (lines 910, 1997, 2011) does not say which variables, or
from where to where.

### 9. Major: "the core controls" is never defined

Lines 78, 331, 360, 832.

"The core controls and the release checks" and "the RFC's own list of abuse
controls" point to a list in another file. The reviewer had to guess which
mechanisms in this design are "core controls" and which are "release checks".

### 10. Major: moving a learner

Lines 607-610, 613-620, 628-631, 823, 1039.

- Withdrawal is allowed when "either the first block is more than 7 days away
  ... or they were moved and the class has not started". For a moved learner
  more than 7 days out, both are true. The text does not say which kind
  applies, and the difference is who pays S$17.50.
- Line 823 justifies moving by "After a cancellation each learner would have
  to be refunded". Cancelling writes every refund row in the same transaction,
  so no learner is left to move afterwards. Whether moves must come before
  cancelling is not stated.
- The error `class_released` applies to a move, but the move rules never
  mention release.
- It is not stated whether a learner can be moved twice.

### 11. Major: what "ending" a hold means

Lines 88-90, 223, 512-519, 629, 1397.

- "ends the learner's other holds" and "ends every seat hold" do not say what
  is written: a status, or a past `seat_held_until`.
- Step 4 "finds the learner's enrollment for this class; refuses if it is
  active" does not say what happens when that row is `cancelled` or
  `refunded`. A test expects "a learner who withdrew buying the same class
  again"; the reviewer guessed the old row is overwritten.
- The goal says the seat is held "until the payment completes or the payment
  page expires", which is 30 minutes. CUJ 3 says 35. The reason for 5 minutes
  is not given.

### 12. Nit: "Drafting" has two meanings

Lines 29-31, 772-773.

Line 30 says the assistant "makes the mechanical choices, which the Technical
Plan marks 'Drafting'". Line 772 says "'Drafting' is a choice the author
made". Rows read both "Drafting" and "Drafting, rejected by author". It is not
clear who decided rows such as the 7-day withdrawal window on line 337.

### Left out under the cap of 12

- "SSG" is never expanded (line 157).
- "A" means the payment amount at line 549 and the available balance at
  line 670.
- "a third task definition" (line 686) appears before the other two are named
  at line 1842.
- Walkthrough and rollout steps share one numbering, 1-14, which collides with
  "Phase 10" and "entry 10.8".
