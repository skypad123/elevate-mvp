# Author Decisions: Scheduled Classes, Part 2 (Selling a Class)

- **Why:** the consolidated review ends with five decisions that belong to the
  author. This file sets out the options for each and records the answer.
- **Started:** 2026-11-25
- **Sources:** `consolidated_review_report.md` and `stripe_sandbox_results.md`
  in this folder. Finding ids (B1, M6) are the review's.
- **Rule:** the options are not ranked. Where a statement is an inference made
  while writing this file, and not a review finding or a test result, it is
  marked "inference".

## Summary of the answers

1. **Where class money sits:** the teacher's Stripe account, with manual
   payouts (the design as drafted).
2. **Size of the first release:** 4 to 10 profiles and about 10 to 40 classes.
   Moving, dispute handling, the no-attendance review and cancellation by
   Elevate are all built. No way back from opting in during the beta. The
   readiness items and the two live-path changes ship first, as their own
   changes.
3. **Attendance when the teacher cancels:** only the learner's own check-in,
   or a hand mark the learner did not dispute in 7 days, stops a refund.
4. **The second held total:** replaced by a ceiling. A payout never exceeds
   the payable payments the database can name.
5. **Refunds and the job:** the job is the only sender of refunds and runs
   every 15 minutes, with one alarm that emails a person.

Settled after the rewrite: class checkout allows cards and PayNow, and
nothing else (R6). The fee estimate stays one rate for every payment method,
and Elevate keeps or bears the difference from Stripe's real fee (R7).

Changed on 2026-11-25 by the author's best-guess answers, which are in
`best_guess_answers.md`:

- **Decision 2c is reversed** (G16). The owner can leave on 30 days' notice.
- **Decision 3 is changed** (G12). When the profile cancels, a learner
  counted as attended is refunded the share for the blocks not taught. The
  rest of decision 3 stands: only the learner's own check-in, or a manual
  mark not disputed in 7 days, counts as attended.
- **The licensing question is no longer a gate** before selling to real
  learners (G9).

The worked example is the review's: a seat sold for S$500, with an application
fee of S$89.88 made of S$72.38 commission and an S$17.50 estimate of Stripe's
fee, leaving the teacher S$410.12.

## Decision 1: where class money sits between the sale and the release

**Status:** decided by the author on 2026-11-25: **Option A**, the teacher's
Stripe account with manual payouts.

What follows from it:

- The payout engine stays, so B4, B5, M6, M7 and M8 must each be fixed in the
  rewrite. Decision 4 is live.
- "Edit payout schedule" and "Manual payouts" must be off in the sandbox and in
  live mode before any class is sold. The rewrite states this as a rollout
  step.
- Stripe's support must still say how the 90 days are counted. The day limits
  (M6) cannot be final before that.
- A payout test on an account that has passed the liveness check is still
  owed.
- The alternatives table in the design must give the true reason for
  rejecting platform-held money (B2). The recorded reason describes today's
  model.

The question is whose Stripe balance holds a learner's payment from the day
they pay until 7 days after the class ends.

Three facts hold for every option:

- Elevate is already the business of record. Its name is on the card statement
  and a dispute (S$500 plus S$15) is taken from Elevate's balance. The test
  session confirmed this.
- Once a class is released and the teacher is paid, taking money back means
  reversing a transfer. Stripe allows a reversal larger than the teacher's
  balance, the balance goes negative, and Stripe holds a reserve on Elevate's
  balance against it.
- A lawyer has not yet said whether holding money for teachers brings a
  licensing duty. The review asks that question for either shape.

### Option A: the teacher's Stripe account, with manual payouts (the design as drafted)

**How it works.** A class sale is a destination charge, as self-paced sales are
today. The whole S$500 moves to the teacher's account and the fee is taken
back. A profile that opts in to selling classes has its Stripe account switched
to manual payouts. A job run by Elevate pays out "the balance less what is
held" each day.

**What it keeps.**

- One payment model. ADR 003 stands.
- The teacher sees the held money in their own Stripe dashboard.
- Before release, a refund draws on the money where it sits. The sequence was
  tested and works in either order: the teacher ends S$17.50 down on a seat
  they cancelled, and at zero on a seat the learner withdrew from.

**What it costs.**

- The switch covers the whole account, so the teacher's self-paced earnings
  also wait for Elevate's job. If the job stops, that teacher is paid nothing.
- It needs the payout engine: the held total, the second total, the day limits
  (75, 82 and 85 days), the opt-in switch and a way back. Findings B4, B5, M6,
  M7 and M8 all sit here.
- Two Express dashboard features, "Edit payout schedule" and "Manual payouts",
  must be turned off before any class is sold. Otherwise a teacher can pay
  themselves the held money. These are platform settings, so they would apply
  to every teacher, not only those who opt in (inference from the settings
  page; not tested).
- Stripe allows 90 days under manual payouts in Singapore. How the days are
  counted and what Stripe does at the limit are not documented.
- Paying out, in full or in part, could not be tested. The test account cannot
  pass Singapore's liveness check without a person.

**When it fails.**

- Stripe has a class payment the database does not. The balance rises, the
  held total does not, and the job pays the held money out (B4).
- The two totals disagree with no fault present, for example after a dispute
  that arrives after release. That teacher is paid nothing until someone
  clears it, and no way to clear it is designed (B5).
- Turning the account back to automatic pays out everything held (M7).

### Option B: Elevate's balance for class sales, transferred at release

**How it works.** A class sale is a charge on Elevate with no destination. The
S$500 stays in Elevate's Stripe balance. At release, Elevate sends the
teacher's share for each payment with a transfer tied to that payment. The
teacher's account stays on automatic payouts. Self-paced sales do not change.
The test session ran this shape between a Singapore platform and a Singapore
account, and it works.

**What it removes.**

- The payout engine. The job sends named amounts for named payments. There is
  no "balance less held", so B4, B5 and the second total fall away.
- The account switch, the two dashboard settings and the opt-out problem (M7).
  A teacher's self-paced payouts never depend on Elevate's job.
- The two-step refund before release. A refund before release is one call
  against Elevate's balance, with no reversal and no fee refund.

**What it costs.**

- Elevate holds money owed to teachers. This sharpens the licensing question.
- The teacher sees held class money in Teach only. Their Stripe dashboard
  shows nothing until release.
- Two payment models. ADR 003 would describe both, and checkout, refunds and
  earnings each gain a second branch.
- When a teacher cancels before release, none of that class's money is in the
  teacher's account. Stripe keeps its fee on a refunded payment, so the
  S$17.50 the design charges the teacher would have to come out of a later
  transfer to that teacher, or Elevate bears it (inference).
- Whether Stripe limits how long a platform may hold money before transferring
  it is not documented. The page is worded so that it is unclear.

**When it fails.**

- The lawyer says this shape needs a licence Elevate does not hold.
- Stripe's support says a holding limit applies and it is shorter than the
  longest class.
- The release job stops. No class money reaches teachers until it runs again.
  Self-paced money is not affected.

### Option C: Elevate's balance for every sale (one model, changed)

This option is not in the review. It is listed because Option B's "two payment
models" cost has an obvious answer, and that answer has its own price.

**How it works.** Every sale, self-paced and class, is a charge on Elevate. A
self-paced sale is transferred to the teacher as soon as it is fulfilled. A
class sale is transferred at release.

**What it keeps.** One payment model, and everything Option B removes.

**What it costs.**

- It changes the live self-paced payment path: checkout, fulfilment, refunds,
  the duplicate-payment paths and the earnings page. Part 2 was written to
  leave that path alone.
- ADR 003 is replaced, not extended.
- Everything Option B costs, except the second model.

**When it fails.**

- The same conditions as Option B.
- A fault in the changed path affects every sale on the platform, not only
  classes behind the `CLASS_SALES` setting.

### Waiting

The decision can also wait for the lawyer and for Stripe's support. Their
answers can rule out B and C (a licence is needed, or a short holding limit
applies) or weaken A (the 90 days are counted from the payment, which shortens
the longest class that can be sold). The cost of waiting is that decisions 2 to
5 and the rewrite depend on this one. Decision 4 does not exist under B or C.

## Decision 2: the size of the first release

**Status:** decided by the author on 2026-11-25.

- **2a.** 4 to 10 profiles and about 10 to 40 classes in the first three
  months. A cancellation happens most months.
- **2b.** All four parts are built: moving a learner, dispute handling by the
  system, the review of a class with no attendance, and cancellation by
  Elevate.
- **2c.** No way back in the beta. An opted-in profile stays on manual
  payouts.
- **2d.** The four readiness items and the two live-path changes ship as their
  own small changes, before the class-sales build.

What follows from it:

- The cut list removes nothing from the selling build itself, so M9 stands in
  part: the first release carries all seven refund kinds. What leaves this
  build is Phase 6 (readiness), the refund-id change, the webhook retry and
  the `class-sales/end` route.
- The rewrite must fix, not delete: M3, M6 and M16 for moving; the late-dispute
  cases in B5 and B6; M13 for Elevate's cancellation.
- The opt-in terms must say the change cannot be undone during the beta. This
  goes to the lawyer with the other terms.
- The release job cannot be switched off while any profile is opted in. The
  rollback section must be rewritten around that (M7), including what Support
  does if one profile has to be taken off manual payouts in an emergency.
- Each of the two live-path changes needs its own goal, risk and rollback, and
  a check on self-paced sales, before any class code depends on it (M10).

The design cannot sell one seat until all eleven phases are built (M9). The
review lists parts that can be cut, deferred or done by hand, and says the
choice needs a stated size for the beta. The decision is taken in four steps.

### 2a. The size of the beta

Doing a thing by hand is reasonable for a handful of classes and not for
hundreds. The number wanted is how many profiles will sell classes in the first
three months, and about how many classes.

### 2b. Which of four parts are built for the first release

Each part is either built, or left out with the stated stand-in. A part left
out is described in the design as a later change, with the reason.

**Moving a learner to another class.**

- Built: the move route, the `moved_withdrew` refund, the 82-day rule, the move
  email and the Teach dialog. The rewrite must also fix the unique-index fault
  (M3), add a way to list target classes (M16) and make the 82-day limit agree
  with the forced release (M6).
- Left out: a teacher who replaces a class cancels it. Each learner is refunded
  in full and buys the new class themselves. The teacher bears Stripe's fee on
  each refunded seat, S$17.50 on S$500, and a learner is not guaranteed a seat
  in the new class. Changing the date of a block is an edit and is not
  affected.
- Leaving it out fails when teachers replace classes often, or a new class
  fills before the refunded learners return.

**Dispute handling by the system.**

- Built: the three dispute events are recorded, an open dispute keeps its
  payment held, and a lost dispute reverses the teacher's share. The rewrite
  must extend this to disputes that arrive after release, which is the normal
  case, and stop them from causing a mismatch (B5). A refund for a disputed
  seat must be skipped, because Stripe refuses it (B6).
- Left out: Stripe emails Elevate about each dispute. A Support admin answers
  it, and after a loss reverses the teacher's transfer by hand, following a
  written procedure. The call was tested. Nothing holds a payment whose dispute
  is open at release. The payout events (`payout.paid`, `payout.failed`) stay
  either way, because the payout engine needs them.
- Leaving it out fails when a disputed payment is paid out and the teacher
  has no later earnings: the balance goes negative and Elevate's reserve
  carries it. That can also happen when it is built, for any dispute after
  release.

**The review of a class with no attendance.**

- Built: a class with no check-in and no mark is not released until a Support
  admin clears it. As drafted, one manual mark by the instructor avoids the
  review (M4). Decision 3 covers that weakness.
- Left out: every class is released 7 days after it ends, attended or not. A
  learner whose class did not run asks Support or their bank.
- Leaving it out fails when a profile sells a class, does not run it and is
  paid. Elevate is the business of record, so each such seat can return as a
  dispute of S$500 plus S$15 against Elevate.

**Cancellation by Elevate.**

- Built: a Support admin cancels a class and every seat is refunded, attended
  or not. The rewrite must settle the conflict with the attendance lock (M13)
  and say who bears the fees.
- Left out: Support refunds each seat with the per-payment refund it already
  has, and the rewrite says how the class is taken off sale (inference: the
  design has no other route for that).
- Leaving it out fails when a large class must be cancelled by Elevate, or
  when a seat is missed.

### 2c. The way back for a profile that opted in

Under Option A this cannot simply be cut. Turning an account back to automatic
payouts pays out everything held (M7).

- **The route as drafted.** `class-sales/end` is refused while the profile has
  a published class with a seat sold or any held class payment. It is safe
  because the system checks that nothing is held. Cost: one route, its screen
  and tests.
- **By hand, by Support.** A written procedure: a Support admin confirms
  nothing is held, then switches the account in Stripe and updates the
  profile. Cost: the check that makes it safe is done by a person. It fails
  when the person misses a held payment.
- **No way back in the beta.** An opted-in profile stays on manual payouts and
  Elevate's job keeps paying it. Cost: a profile that stops selling classes
  still depends on the job for its self-paced money. It fails when a profile
  demands the old schedule back.

### 2d. The four readiness items and the two changes to the live payment path

The readiness items are backups, the sign-in limit, erasing coordinates and
recording views. The per-email sign-in limit already exists, so that item is
one number (M19). The live-path changes are the refund-id change and the retry
of a webhook event whose handler failed. Neither group is behind `CLASS_SALES`
(M10).

- **Their own small changes, first.** Each ships alone and is checked on
  self-paced sales before any class code depends on it. Cost: more deploys, and
  the two live-path changes need their own goal, risk and rollback written.
- **Inside this build, as drafted.** One release. Cost: a fault in the webhook
  retry reaches every self-paced payment in the same deploy as class sales,
  and cannot be told apart from a class fault.
- **Readiness items deferred to Part 1's build.** They are needed before a
  real learner checks in, which is Part 1's rollout, not selling. The two
  live-path changes still need one of the two homes above.

## Decision 3: attendance as money evidence when the teacher cancels

**Status:** decided by the author on 2026-11-25: **Option B**, only the
learner's own check-in and marks the learner has not disputed.

What follows from it:

- Part 1 already has the state this needs. A hand mark is "settled" when 7
  days have passed with no dispute, and "open" before that. For money, a hand
  mark counts only when settled. A mark the learner disputed does not count,
  whatever the profile ruled.
- Part 1 sends the learner no notice of a hand mark, and accepted that because
  no money depended on it. Money now does. The rewrite must tell the learner
  about a hand mark, with the date their time to dispute ends, or the 7 days
  can pass unseen.
- When a profile cancels, the refund for a learner with an open hand mark
  waits until that mark settles or is disputed. The cancellation is not
  complete until then, so the class cannot be released before then (B6).
- A class is due for release 7 days after its last block, and a hand mark made
  after that block is still open on that day. The rewrite must say which
  waits.
- The word list needs one name for "attended, for money" and must use it in
  every refund and release rule (M15).
- The cases this does not fix stay as accepted limits: a learner who checked
  in once and lost the remaining blocks, and a learner who was present and
  disputes a hand mark to keep a refund. Both go to Support.

As drafted, when a profile cancels a class, each learner who has not attended
is refunded in full. A learner who has attended any block gets nothing unless
the profile chooses to refund them. "Attended" includes a mark the instructor
made by hand. The same record decides whether a class goes to the
no-attendance review.

The weakness (M4): the profile writes the record that keeps its money. An
instructor can mark every learner present by hand and then cancel. A learner's
dispute of a mark is decided by the same profile. Block dates can be edited
after the sale.

### Option A: keep the lock as drafted

**How it works.** Any check-in or mark on any block locks the automatic refund
for that learner.

**What it costs.** The weakness above stays. A learner who attended one block
of eight gets nothing by rule when the profile cancels the other seven.

**When it fails.** An instructor marks the class present and cancels. The
learner's only routes are Support and their bank, and a bank dispute lands on
Elevate.

### Option B: count only the learner's own check-in and marks the learner has not disputed

**How it works.** A check-in the learner made counts. A mark made by the
instructor counts only once the learner's time to dispute it has passed and
they have not disputed it, whatever the profile ruled.

**What it costs.** "Attended" gains a second meaning for money, beside Part
1's meaning for the register. A cancellation's refunds for hand-marked
learners cannot be decided until the dispute time has passed.

**When it fails.**

- A learner who was present and was marked by hand disputes the mark to keep
  a refund. The profile has no reply the system accepts.
- A learner who checked in to one block of eight is still locked out when the
  profile cancels the rest. This option fixes forged marks, not part-taught
  classes.

### Option C: a cancellation after the class has started goes to Support

**How it works.** Cancelling before the first block refunds every seat in
full, as drafted. Cancelling after the first block has started takes the class
off sale and refunds nothing by rule. A Support admin settles each seat, using
the refund tools built for cancellation by Elevate.

**What it costs.** Support work for every such cancellation. At the stated beta
size that is some months, not every month. Learners wait for a person. Support
needs written rules, or the outcomes will differ case by case.

**When it fails.** Support is slow or uneven, or the number of classes grows
past what one person can settle.

### Option D: refund in proportion to the blocks not taught

**How it works.** When a profile cancels, every learner gets back the share of
the price for blocks that had not ended at the time of cancelling. Attendance
plays no part in a cancellation refund.

**What it costs.**

- New arithmetic for a part refund on cancellation: who bears which fee, and
  how it rounds (B8, M5). Blocks of different lengths need a rule: by count or
  by minutes.
- The calendar decides that a block was taught. Nothing checks that it was.

**When it fails.**

- An instructor does not turn up for the first block and then cancels. The
  profile keeps that block's share.
- A profile edits block dates after the sale to change the split, unless edits
  are also restricted.

### What each option means for the no-attendance review

The review is built (decision 2b). Under A, C and D it reads the record as
drafted, so one hand mark still avoids it. Under B it can use the same
stricter meaning. Whether it does is part of this decision's rewrite, not a
separate question.

## Decision 4: the second held total

**Status:** decided by the author on 2026-11-25: **Option C**, a payout never
exceeds the payable payments the database can name.

What follows from it:

- The calendar total, the `mismatch` outcome and CUJ 10 are removed. B5 falls
  away with them: nothing stops a teacher's payout because two numbers differ.
- B4 is answered by the ceiling. A payment Stripe has and the database does
  not is never paid out, because no row names it.
- The goal is reworded from "two independent routes" to "a payout is never
  more than the money the database can name as payable".
- Every payment of an opted-in profile, self-paced included, gains a paid-out
  mark. The rewrite must say how payments made before the profile opted in are
  treated, since automatic payouts had already paid most of them.
- A payout can be smaller than the named sum, when part of the balance is
  still pending. The rewrite must say which payments are then marked paid.
- The ceiling needs the one formula for "the teacher's share after refunds"
  (B8), including a share that is negative after a refund.
- Support needs a report of accounts whose balance stays above zero after a
  paying run, with the amount the database cannot name. Without it, a payment
  with no row is never found and the teacher is never paid it.

As drafted, each run works out the held total twice, once from the release
marks and once from the calendar, and pays a teacher nothing when the two
differ. The author added the second total so that a wrong held total could not
pay money out.

What the review found:

- The two totals disagree with no fault present: after a dispute opened or won
  after release, after a learner is moved out of a released class, and after a
  block of a released class is edited. Nothing clears a mismatch (B5).
- Both totals read the same payment rows with the same arithmetic. They catch
  a failed write and little else (B5).
- Neither total sees a payment that Stripe has and the database does not. That
  money is paid out as if it were not held (B4).

Decision 2 keeps moving and dispute handling, so every mismatch case above
will occur.

### Option A: keep the calendar total and repair it

**How it works.** The second total stays. Each case that mismatches without a
fault gets a rule so the two agree, and a Support admin gets an action that
clears a mismatch with a recorded reason.

**What it costs.** A rule per case, and a new rule each time another case is
found. The clearing action is a person overriding the check.

**When it fails.** It does not address B4 at all: both totals still come from
the database. A fault in the shared arithmetic is in both totals and passes
the check.

### Option B: take the second number from Stripe

**How it works.** The second number does not come from payment rows. Each
paying run asks Stripe what was moved into the teacher's account for class
payments that are not yet released, and holds at least that much. A payment
the database does not know about is still counted, because Stripe knows it.

**What it costs.**

- Stripe calls for every opted-in account on each paying run.
- Each class payment must carry a label in Stripe that the run can read back.
  How a destination charge's transfer can be found by class has not been
  tested.
- A difference between the two numbers still needs a rule: hold the larger,
  or stop and tell a person.

**When it fails.**

- Stripe is slow or refuses the calls. That run pays nobody.
- A class payment is created without its label. It is not counted, which is
  the fault this option is meant to catch.

### Option C: never pay out more than the database can name

**How it works.** Every payment, self-paced and class, gets a paid-out mark.
A payout is the smallest of three numbers: the available balance, the balance
less the held total, and the sum of the teacher's share of the payments the
database names as payable and not yet paid out. Money the database cannot
name stays in the account.

**What it costs.**

- Self-paced payments gain a mark and a place in the payout record, so this
  reaches the self-paced bookkeeping.
- No run is stopped by a mismatch. The check becomes a ceiling.
- Money the database cannot name stays unpaid until a person looks: a payment
  with no row, or a rounding difference.

**When it fails.** The database counts too little. The teacher is paid late,
not too much. It needs a report of balances that stay above zero, or nobody
notices.

### Option D: one total, and a report afterwards

**How it works.** The second total is removed. A run pays on the one held
total. A report compares the payout record with Stripe after the fact and
tells a person about a difference.

**What it costs.** The goal "a wrong held total cannot pay money out" is given
up and must be reworded. This reverses the reason the second total was added.

**When it fails.** The held total is wrong. The money has reached the
teacher's bank before anyone sees the report. Getting it back means a negative
balance on the teacher's account, carried by Elevate's reserve. It does not
address B4.

## Decision 5: where refunds are sent, and how often the job runs

**Status:** decided by the author on 2026-11-25: **5a, Option A**, the job is
the only sender of refunds; **5b**, the job runs every 15 minutes.

What follows from it:

- One plan entry must name the step that sends pending rows, and it is the
  job's (B6). No request calls Stripe for a seat refund.
- A request that withdraws or cancels answers "refund on its way". The learner
  screens and emails must say so, and the refund email is sent when the job
  finishes the row.
- A run that pays nobody writes no row per teacher (M8).
- Stripe remembers an idempotency key for at least 24 hours. A row that is
  retried for longer than that must not rely on the key alone (M2). The
  rewrite gives each row a recorded Stripe refund id as soon as one exists and
  checks Stripe for it before sending again.
- The alarm below is part of the first release, because a stopped job now
  stops every refund as well as every payout.

As drafted, a cancellation or a withdrawal writes refund rows and the release
job sends them. The job runs every 15 minutes. It pays teachers once a day.

What the review found:

- No plan entry names what sends the pending rows (B6).
- Rows are not claimed, so if both a request and the job can send, both can
  send the same row (M2).
- 95 of 96 runs a day write a row for every teacher and pay nothing, and
  nobody is told when the job stops (M8).

Decision 3 adds one fact: a refund for a learner with an open hand mark waits
up to 7 days for the mark to settle, wherever refunds are sent.

### 5a. Where refunds are sent

**Option A: the job only, as drafted.**

- How it works: a request writes the row and returns. The next run sends it.
- Cost: every refund waits for the next run, a single withdrawal included. The
  learner is told "your refund is on its way", not "refunded".
- It fails when the job is stopped: no refund is sent at all.
- Only one program sends, so the claim problem in M2 is between two runs of
  the job, which the account lock already covers.

**Option B: the request sends, and the job retries.**

- How it works: after its transaction commits, the request sends the refunds
  it wrote. The job sends whatever is left.
- Cost: rows must be claimed, because two programs send (M2). A cancellation
  of a full class makes two Stripe calls per seat inside one web request. For
  30 seats that is 60 calls, which is likely to outlast the request
  (inference; not timed).
- It fails when the request dies part-way: the rest waits for the job, and
  the person who cancelled sees an error for a cancellation that happened.

**Option C: the request sends a single seat; the job sends a cancellation.**

- How it works: a withdrawal, a moved learner's withdrawal and a discretionary
  refund are one seat each and are sent by the request. A cancellation's rows
  are sent by the job.
- Cost: two paths to test, and rows must still be claimed.
- It fails in the same way as B for single seats, with at most one seat
  affected.

### 5b. How often the job runs

The job does three things: sends refunds, marks classes released, and pays
teachers. Paying happens once a day whatever the answer.

- **Every 15 minutes, as drafted.** A refund sent by the job waits at most 15
  minutes. Cost: 96 runs a day. The fix for M8 is that a run which pays nobody
  writes no row per teacher.
- **Hourly.** A refund sent by the job waits at most an hour. 24 runs a day.
- **Daily.** One run. A refund sent by the job waits up to a day, and two days
  if one run fails. This is reasonable only if requests send most refunds
  (5a, B or C).

### The alarm (Drafting)

Whatever the answers, one alarm reaches a person when no run has finished in
twice the interval, or when a refund row has been unfinished for more than a
day. It is a CloudWatch alarm that emails an address set per environment. The
Support page keeps its warning. This is a mechanical choice and is recorded
here so the author can overrule it.

## Rules settled during the rewrite

Five rules in the rewrite have more than one defensible answer and move money
or change what a learner is owed. They follow from the decisions above or from
review findings, and each was put to the author. Rules with one defensible
answer are set by the assistant and listed in the design as "Drafting".

### R1. How the ceiling knows what has been paid (follows decision 4)

**Status:** decided by the author on 2026-11-25: **Option A**, a mark on each
payment.

- **Option A: a mark on each payment.** A payout names the payments it pays
  and marks each one. When the available balance is less than the named sum,
  the run pays whole payments, oldest first. A teacher's debt, such as the
  S$17.50 on a cancelled seat, is not a payment, so it needs its own row to be
  marked. Gain: every payout is a list of sales that Support and the teacher
  can read. Cost: debts and refunds after a payout need extra rows, and a
  payout can be smaller than the money available by up to one payment. It
  fails when a refund lands on a payment already marked paid and the extra
  row is missed.
- **Option B: a running total per account.** The ceiling is an opening amount
  recorded at opt-in, plus everything the database has named as payable since,
  less every payout the job has made. Nothing is marked on a payment. Gain:
  debts and part payouts need no special case. Cost: a payout is an amount,
  not a list of sales, and a wrong figure in the past stays in the total until
  a Support admin corrects it with a recorded adjustment. It fails when the
  opening amount is recorded wrongly at opt-in.

Under either option the money a teacher earned before opting in enters as the
Stripe balance read at opt-in (Drafting).

### R2. Which Stripe fee the refund rules use (M5)

**Status:** decided by the author on 2026-11-25: **Option B**, the real fee.

Elevate's fee on a sale contains an estimate of Stripe's fee: 3.4% plus
S$0.50, S$17.50 on S$500. Stripe's real fee differs by card. It was S$20.00 on
a foreign card in the test session. The real fee is known a few seconds after
the payment.

- **Option A: the estimate.** A learner who withdraws from a S$500 seat gets
  S$482.50, whatever card they used, and the amount can be shown before they
  pay. A teacher who cancels bears S$17.50 a seat. Cost: Elevate bears the
  difference on a costlier card, S$2.50 on that S$500, and keeps it on a
  cheaper one. The goal "Elevate's net is zero or more" becomes "zero by the
  estimate". It fails when most learners pay with costlier cards.
- **Option B: the real fee.** The learner or the teacher bears exactly what
  Stripe charged. Elevate's net is exactly zero. Cost: the amount cannot be
  shown before paying, only as a rate, and the same seat returns different
  amounts to different learners. A rule is needed for a refund made before
  the real fee is recorded. It fails when the fee is missing: the refund must
  wait or fall back to the estimate.

### R3. Changing a block's date after seats are sold (M4)

**Status:** decided by the author on 2026-11-25: **Option C**, allowed, and
every seat holder gets the moved learner's right.

Part 1 lets a profile change a block's times until the block has a check-in or
a hand mark. After a sale, an edit can close the learner's time to withdraw or
push the class past the day limit.

- **Option A: allowed, with the day limit re-checked.** As Part 1, except that
  an edit is refused when it would make the class end more than 75 days after
  any seat's payment. The time to withdraw moves with the dates. Cost: a
  profile can move the first block closer and close withdrawal. It fails when
  a learner who could withdraw yesterday cannot today and was not told.
- **Option B: refused once a seat is sold.** The profile cancels the class or
  moves its learners instead. Cost: a one-hour change to one block means a
  cancellation or a move of every learner. It fails when small changes are
  common, which is likely for a beta.
- **Option C: allowed, and every seat holder gets the moved learner's right.**
  Each learner with a seat is emailed the change and can withdraw with a full
  refund until the class starts, the teacher bearing Stripe's fee. The day
  limit is re-checked as in A. Cost: one more email in Part 2, which Part 3's
  change notices would otherwise have carried, and a small edit opens a full
  refund to every learner. It fails when a profile makes a trivial edit and
  several learners take the refund.

### R4. Learners who attended, when Elevate cancels a class (M13)

**Status:** decided by the author on 2026-11-25: **Option A**, every seat in
full.

The draft refunds every seat in full when Elevate cancels, attended or not.
That contradicts the goal that no refund is automatic after attendance, and no
decision row records it.

- **Option A: every seat in full, as drafted.** The teacher's share for the
  class returns entirely and Elevate bears Stripe's fee on each seat. Cost: a
  teacher who taught most of a class before Elevate closed it keeps nothing.
  It fails when Elevate cancels for a reason that is not the teacher's fault.
- **Option B: the same rule as the profile's cancellation.** A learner who
  attended, in the meaning of decision 3, gets no refund by rule. A Support
  admin can refund any seat afterwards. Cost: Elevate cancels a class, for
  example for misconduct, and learners who attended must each be handled by a
  person. It fails when a seat is missed.
- **Option C: the Support admin chooses at the time.** The cancel action asks
  "refund every seat" or "refund those who have not attended", with a reason.
  Cost: a judgement by a person on each cancellation, with no rule to follow.
  It fails when similar cases are decided differently.

### R5. A hand mark that is still open on the release date (follows decision 3)

**Status:** decided by the author on 2026-11-25: **Option A**, the release
waits.

A class is due 7 days after its last block. A hand mark can be made at any
time after a block and is open for 7 days. For money, an open mark does not
count.

- **Option A: the release waits.** A class is not due while any of its hand
  marks is open. Cost: a class marked by hand late is paid up to 7 days later.
  A hand mark made on day 6 moves the release to day 13. It fails only by
  delay, and the delay is caused by the profile's own instructor.
- **Option B: the release does not wait.** On the due date the review counts
  only check-ins and settled marks. Cost: a class taken wholly by hand, for
  example at a venue with no signal, goes to Support's review although its
  marks would settle days later. It fails when many classes are marked by
  hand and Support's list fills.
- **Option C: hand marks count at once for the review, not for refunds.** The
  no-attendance review reads Part 1's record as drafted. The stricter meaning
  applies only to cancellation refunds. Cost: one hand mark still avoids the
  review, which is the weakness M4 named. It fails when a profile sells a
  class, does not run it and marks one learner present.

## Settled after the rewrite

### R6. Which payment methods class checkout allows

**Status:** decided by the author on 2026-11-25: **Option B**, cards and
PayNow.

The rewrite left open how to keep a payment method that confirms days later
out of class checkout. Stripe's documentation answered how: a payment page
can name the methods it allows, or the methods it blocks. Which methods was
put to the author. The documentation also says a PayNow QR code is valid for
1 hour, which is longer than the 35-minute reservation.

- **Option A: cards only.** The payment page allows `card`. Apple Pay and
  Google Pay are card payments and stay. No payment arrives after its
  reservation beyond the 5-minute margin, and the refund calls were tested on
  cards. Cost: a learner cannot pay for a seat by PayNow, which self-paced
  checkout offers. It fails if many learners in Singapore expect PayNow.
- **Option B: cards and PayNow.** The payment page allows `card` and
  `paynow`. Cost: a PayNow payment can arrive up to about an hour after its
  reservation ended. The fulfilment table gives it the seat if one is free and
  the class has not started, and otherwise refunds it in full with Stripe's
  fee on Elevate. Not tested: a refund and a fee refund on a PayNow payment,
  whether a bank dispute can be opened on one, Stripe's fee on one, and
  whether an open QR code still takes a payment after its payment page has
  expired. It fails when classes sell out often, because late PayNow payments
  land on full classes and Elevate pays the fee each time.
- **Option C: the Dashboard's methods, less a blocked list.** The payment
  page names the methods it blocks. A method turned on in the Dashboard later
  appears with no code change. Cost: the rollout check on the Dashboard
  stays. It fails when a method that confirms days later is turned on and
  nobody adds it to the list.

What followed from Option B: the four untested things were tested in the
sandbox on 2026-11-25. The results are under "PayNow session" in
`stripe_sandbox_results.md`.

- The three refund kinds work on a PayNow payment as on a card.
- A PayNow payment cannot be disputed at a bank.
- Stripe's fee was S$7.09 on S$500, against the S$17.50 estimate.
- Expiring the payment page cancels the PayNow payment, so the hour for which
  a QR code is valid does not outlast the page. A late PayNow payment is as
  unlikely as a late card payment.

The test also found that a PayNow refund is pending at first and can fail.
The design now counts a refund as made only when Stripe reports that it
succeeded. The author confirmed that rule on 2026-11-25. The fee estimate
is higher than Stripe's PayNow fee; the author settled that as R7. One thing
remains: the refund terms must state Stripe's fee for each method.

### R7. Stripe's fee lower or higher than the fee estimate

**Status:** decided by the author on 2026-11-25: **Option A**, one estimate.

Elevate's fee on a sale is fixed when the payment page is created, before the
learner chooses a method. It is the commission plus one estimate of Stripe's
fee, 3.4% plus S$0.50. On a S$500 seat the estimate is S$17.50, and Stripe's
real fee was S$7.09 by PayNow and S$20.00 by a foreign card. The fee on a
card issued in Singapore has not been observed.

- **Option A: keep one estimate.** Elevate keeps the difference when Stripe's
  fee is lower and bears it when it is higher: S$10.41 gained on a PayNow
  seat, S$2.50 lost on a foreign card. The profile's share is the same
  however the learner pays. Nothing is built. Cost: Elevate's take varies by
  method, and the terms must tell a teacher so. It fails if most learners pay
  by PayNow and teachers object that Elevate takes more than its stated
  commission.
- **Option B: return the difference to the profile.** When Stripe's fee is
  below the estimate, the job refunds the difference from Elevate's fee to
  the profile. On PayNow the profile's share becomes S$420.53. Cost: one more
  Stripe call and ledger entry on every PayNow sale, and changes to the share
  after refunds, the refund amounts and the earnings page. Elevate still
  bears the excess on a foreign card. It fails when the extra call is late or
  fails, because the profile's share is then wrong until the job catches up.
- **Option C: a lower estimate for class sales.** Class checkout uses its own
  rate, set from the expected mix of methods. Cost: class and self-paced
  sales quote differently. It fails when the mix is guessed wrong: with an
  estimate near the PayNow fee, Elevate loses about S$10 to S$13 on every
  S$500 card seat.

What follows from Option A: held-payout term 14 states it, and question 10
for the lawyer asks whether that is enough.

## What the decisions do to the review's Blockers

- **B1.** Answered by the test session, except the 90-day count and a real
  payout. Both stay open under decision 1.
- **B2.** The choice was put back to the author and Option A was kept. The
  alternatives table still needs the true reason.
- **B3, B9, B10.** Not touched by any decision. Fixed in the rewrite.
- **B4.** Answered by decision 4.
- **B5.** Removed by decision 4.
- **B6.** Narrowed by decision 5: one sender. The rewrite still defines
  `failed`, stops a release while a refund is unfinished, and skips a refund
  for a disputed seat.
- **B7.** Not touched. With the job as the only sender, the webhook still
  sees `charge.refunded` for the job's refunds and must skip them.
- **B8.** Not touched, and decision 4 depends on it.

## Questions for other people

These are written so they can be sent as they are. They name no account.
Each has a best-guess answer in `best_guess_answers.md` that the build uses
until it is confirmed.

### For Stripe's support

Context to give: a Singapore platform on Connect, with Express connected
accounts in Singapore, destination charges with an application fee, and the
platform bearing losses. Some connected accounts will be on a manual payout
schedule, with payouts created by the platform through the API.

1. Singapore accounts on manual payouts may hold funds for 90 days. From which
   moment are the 90 days counted for each payment: when the charge is
   created, when its funds become available, or something else?
2. What does Stripe do when funds reach the limit? Are they paid out
   automatically, is the account restricted, or does something else happen?
   Is the platform warned first?
3. Can "Edit payout schedule" and "Manual payouts" in the Express dashboard be
   turned off for some connected accounts only, or only for all of them?
4. When a connected account's balance is negative and the platform bears
   losses, when and how does Stripe take the amount from the platform?
5. In a sandbox, is there a way to enable payouts on a Singapore test account
   without a person completing the liveness check, so that manual and part
   payouts can be tested?
6. On API version `2026-10-28`, `payment_method_types` is refused on a
   PaymentIntent. What is the supported way to limit one kind of checkout to
   payment methods that confirm at once, while other checkouts keep the
   Dashboard's methods?

#### What Stripe's documentation already answers (checked 2026-11-25)

Stripe's documentation was searched for each question, and the sandbox was
read. Questions 4 and 6 need not be sent. Questions 1, 2, 3 and 5 still do.

| Question                 | What the documentation says                                                                                                                                                                                                                                                                                                                                                                                                | Send it?        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1, 2. The 90 days        | "You must pay out the funds within the time period": 90 days outside Thailand and the United States. Nothing on the moment the count starts, or on what Stripe does at the limit.                                                                                                                                                                                                                                          | Yes             |
| 3. Dashboard features    | The two features are in one list in the platform's Connect settings (Express Dashboard, Features). No setting for a single account is documented.                                                                                                                                                                                                                                                                          | Yes, to confirm |
| 4. A negative balance    | When the platform bears losses, Stripe holds the same amount back from the platform's available balance, and releases it as the account's balance recovers. After 180 days negative, Stripe moves the held amount to the account to bring it to zero. The platform can clear it sooner with a transfer. Collecting from the account's bank is listed for Australia, Canada, Europe, New Zealand and the US, not Singapore. | No              |
| 5. Liveness in a sandbox | Test values exist for a date of birth, an address, an id number and documents. None is documented for the liveness check.                                                                                                                                                                                                                                                                                                  | Yes             |
| 6. Payment methods       | From API version `2026-09-30`, `payment_method_types` is refused and `allowed_payment_method_types` replaces it on a Checkout Session and a PaymentIntent. A method not in the list cannot appear, even if it is on in the Dashboard. `excluded_payment_method_types` and `payment_method_configuration` are the other two ways.                                                                                           | No              |

Sources: `docs.stripe.com/connect/manual-payouts`,
`docs.stripe.com/connect/customize-express-dashboard`,
`docs.stripe.com/connect/account-balances`, `docs.stripe.com/connect/testing`
and `docs.stripe.com/payments/payment-methods/integration-options`.

Checked in the sandbox:

- The test account's balance is −S$35.00, and the platform's balance shows
  S$35.00 held back for connected accounts. That matches the answer to
  question 4.
- The test account has one requirement left before payouts are enabled: the
  liveness check of its individual.
- Stripe's description of the API lists `allowed_payment_method_types` on
  creating a Checkout Session. No request with it has been sent on the pinned
  version, and the SDK's types have not been checked.

What this changed in the design, applied on 2026-11-25:

- The open question on limiting class checkout is closed. Class checkout
  passes `allowed_payment_method_types`, and the rollout check on the
  Dashboard's delayed methods is replaced by a check of a class payment page.
  The author chose the methods in the list (R6).
- The risk "a refund takes back more than the profile's Stripe balance holds"
  now says that Stripe takes the amount from Elevate after 180 days and does
  not collect from a Singapore bank account.

### For the lawyer

Context to give: Elevate sells seats in scheduled classes for teachers.
Elevate is the business of record on the card payment. The money moves to the
teacher's own Stripe account when the learner pays. Elevate sets that account
to pay out only on Elevate's instruction, and instructs a payout 7 days after
the class ends. The longest wait allowed by Stripe in Singapore is 90 days.

The author answered every question below with a best guess, to build on
before asking anyone outside the company. The answers, with their sources,
are in `best_guess_answers.md`; each question is still to be confirmed.

Documents to give: the two drafts in `docs/terms/`, `held-payout-terms.md`
for a teacher and `class-refund-terms.md` for a learner. Questions 6 to 11
were added on 2026-11-25, after the drafts were written; each names the term
it is about.

1. Does controlling when a teacher's own Stripe balance is paid out bring a
   licensing duty for Elevate in Singapore, for example under the Payment
   Services Act? Would the answer differ if Elevate held the money in its own
   Stripe balance and transferred it after the class?
2. The opt-in terms for a teacher. Once a teacher opts in, all of their
   payouts, self-paced sales included, are made by Elevate's daily job, and
   during the beta the change cannot be undone. Is that acceptable as a term,
   and what must the teacher be told before accepting?
3. The refund terms shown to a learner before paying:
   - a learner may withdraw until 7 days before the first block and is
     refunded the price less Stripe's fee (on S$500, about S$17.50 by card
     and about S$7 by PayNow);
   - when the teacher cancels, a learner is refunded in full unless they
     attended, and Stripe's fee falls on the teacher;
   - "attended" means the learner checked in themselves, or the instructor
     marked them present by hand and the learner did not dispute the mark
     within 7 days of being told of it;
   - a learner who attended part of a cancelled class has no refund by rule
     and must ask the teacher or Elevate.

   Are these terms fair and enforceable against a consumer in Singapore? Does
   the last one need to change?
4. As the business of record, what does Elevate owe a learner when a class
   does not run and the teacher has already been paid?
5. Check-in can record a learner's location. Elevate can erase it on request,
   but it stays in database backups for 35 days. What must the privacy notice
   and the erasure procedure say?
6. Cancellation by Elevate (held-payout term 22, refund term 8). Elevate can
   cancel a teacher's class, refund every learner in full and take back the
   teacher's share of those sales. The terms give no grounds. On what grounds
   may Elevate do this, and what must each set of terms say about them?
7. The end of the beta (held-payout term 4). Opting in cannot be undone
   "during the beta", and the terms give no date or event that ends it. Must
   they, and must they say what a teacher can do then?
8. A teacher's debt (held-payout term 28). A refund or a lost bank dispute
   can take back money a teacher was already paid. The terms set that amount
   against the teacher's later payouts. If no later payout covers it, Stripe
   takes it from Elevate after 180 days. Can Elevate then recover it from the
   teacher, and what must the terms say for that to hold?
9. Teachers who have not opted in (held-payout term 3). Two features of the
   Stripe dashboard, changing the payout schedule and paying oneself out, may
   have to be turned off for every teacher, because Stripe may not allow it
   for some accounts only. A teacher who has not accepted the held-payout
   terms would lose both. Does that need notice to those teachers, or their
   agreement?
10. Stripe's fee (refund terms 3 and 13, held-payout term 14). Stripe's fee
    depends on how the learner paid, so two learners who withdraw from one
    class can get different amounts back. Must the terms state the fee for
    each payment method as a rate, before the learner pays? Elevate's fee on
    each sale includes a fixed estimate of Stripe's fee, which is higher than
    Stripe's real fee on a PayNow payment. Must a teacher be told that
    Elevate keeps the difference?
11. The time a refund takes (refund term 12). The terms say a refund goes
    back to the payment method and that the learner is emailed when it is
    sent. Must they give a time?

## The rewrite

The design and its plan were rewritten on 2026-11-25 for the decisions and
rules above. The author approved the design text, with its table "Set while
drafting, for the author to confirm", before the plan was written.

Where each Blocker went in the rewritten document:

- **B3:** the fulfilment table under "Buying a seat", and entry 3.3.
- **B4, B5:** "Held money and the release job": three bounds, and marks.
- **B6:** the statuses of a seat refund row under "Refunds", and entry 4.3.
- **B7:** "Stripe's notice of the job's own refunds" and "Refunds from
  outside", and entry 4.2.
- **B8:** "The profile's share after refunds", and entry 1.9.
- **B9:** entries 3.11 and 4.10.
- **B10:** `ProfilePayoutView` in entry 1.13.

One finding is only partly answered. M9 asked for a smaller first build. The
author kept every part (decision 2b), so the build is the same size less the
six changes that ship first.

## Next

1. Send the two sets of questions. Of the six for Stripe's support, send 1, 2,
   3 and 5.
2. Turn the two Express dashboard features off in the sandbox, and test a
   manual payout on an account that a person has taken through the liveness
   check. PayNow was tested on 2026-11-25; a payment through the Link button
   is still to test before Phase 3 is merged.
3. Ship the readiness items and the two live-path changes as their own
   changes.
4. Re-review the rewritten document. The review allows one re-audit per stage.
   The day limits stay provisional until Stripe answers question 1.
