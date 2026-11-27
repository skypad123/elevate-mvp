# Zoom Out Report: Scheduled Classes, Part 2 (Selling a Class)

- **Stage:** 5 (Initial Zoom Out)
- **Target:** `docs/designs/scheduled-classes-selling.md`, full file
- **Reviewers:** `egm-zoom-out` and `egm-inventive-catalyst`, each in a fresh
  context
- **Date:** 2026-11-24

The two reports are given as the reviewers wrote them. Line numbers refer to
the target as it stood at commit `7f9cb68`.

## Zoom Out (`egm-zoom-out`)

Target: `docs/designs/scheduled-classes-selling.md`

### Verdict

This is not the smallest thing that meets the problem, and it should not go forward as one release. The Problem section (lines 51-71) gives four reasons selling does not work today. The design answers them and also adds moving a learner, automated dispute handling, an attendance review before release, an opt-out route, a second held total and four Part 1 readiness items. In total: 4 new tables, 23 new columns, 5 new services, 13 new routes, a new scheduled task with its own AWS resources, and 85 plan entries in eleven phases. All of it switches on together. The refund design rests on a Stripe sequence nobody has tested, and the plan builds toward it for three phases before testing. Opting in hands all of a teacher's payouts, self-paced included, to a new job that nobody is paged about. Finding 1 should be closed before approval; findings 2 to 8 are cuts or simplifications.

#### 1. Blocker: The refund design rests on an untested Stripe sequence, and misses its goal in the likeliest case even if the test passes

- **Lines:** 175-183, 584-590, 849-850, 962-969; built ahead of the test at 1132-1143 and 1237-1251.
- **Quote:** "Stripe's documentation confirms each piece and does not say they can be combined. Needs a test in a Stripe sandbox before Phase 4 of the plan."
- **Why:** The test is a few API calls, yet it is scheduled after Phases 1 to 3 have built the `seat_refunds` columns, `seatRefund()`, the provider methods and the fake's arithmetic around the sequence. The document's own fallback "would break the goal" (line 588). Two more open questions (reversal against a short or pending balance; how the 90 days are counted) decide whether holding works in the first days after a sale. Separately, line 850 says a teacher who cancels with no other held money ends with a negative balance "which Elevate carries". That is the low-sign-ups case of line 822, so the goal at lines 126-128 holds only in the ledger there.
- **Change:** Run the sandbox test and answer the two balance questions before approving this document, then rewrite "Refunds" from the results. State in the goal that Elevate carries the fee when the teacher has no other balance, or drop the "zero or more" claim for `teacher_cancelled`.

#### 2. Major: No first slice and no order of what to drop

- **Lines:** 20, 861, 971-975, 1327.
- **Quote:** "no environment has `CLASS_SALES` on before the whole plan is built."
- **Why:** The RFC says the concept does not fit the time (brief, lines 36 and 200). Part 1 is one phase of seven built. Part 2 adds eleven phases with no point at which selling can start short of the end.
- **Change:** Split it.
  - **2a:** opt-in, class checkout with the hold, withdrawal, cancellation with automatic refunds for learners who have not attended, Elevate's cancellation, `seat_lost`, and the release job with one held total.
  - **2b:** moving, discretionary refunds in Teach, dispute automation, the attendance review and forced release, opt-out, the Teach payout history and most of the Support payouts page.
  - During 2a, Support handles attended learners of a cancelled class and any dispute by hand.

#### 3. Major: The second held total is not independent, and its failure stops a teacher's pay

- **Lines:** 107-109, 282-289, 660-667, 678-680, 851; decision at 335 (the author's).
- **Quote:** "The two totals share the payment rows and the fee arithmetic"; "A payment missing from both routes is not caught."
- **Why:** Both totals are the same sum over the same rows with a different filter, written in one service. They can only catch the marking step disagreeing with the date rule. The price of a disagreement is that the teacher is paid nothing, self-paced money included. As written, there is a false mismatch: a dispute opened after release leaves the payment marked (not held by mark) but counted as held by calendar (line 665), so that teacher is frozen until the dispute closes or the payment passes 85 days.
- **Change:** Keep one definition of "held". Drop `held_by_calendar_cents`, the `mismatch` outcome and CUJ 10. For an outside check, use the existing `EarningsService.reconcile` (`apps/api/src/services/earnings.service.ts`, line 172). It compares the ledger with Stripe's transfer total, which is the case line 851 says is not caught.

#### 4. Major: A 15-minute job for a once-a-day payout, with nobody told when it stops

- **Lines:** 345-346, 449, 689-699, 804, 825, 853.
- **Quote:** "An EventBridge Scheduler entry starts it every 15 minutes"; "The repo has no alarms, so nobody is paged."
- **Why:** Payouts are at most daily, so 95 of 96 runs a day write an `already_paid_today` or `nothing_due` row per teacher. The short interval exists only because a cancellation's refunds were given to the job. Opting in makes this job the only way a teacher is paid for anything, and its only health signal is a banner on a Support page.
- **Change:** Run it daily or hourly. Send a cancellation's refunds from the API after the cancel transaction commits; the rows are already resumable and keyed, so the job only sweeps up failures. Write a per-teacher row only when something happened. Replace the staleness banner with one alarm that emails someone.

#### 5. Major: The fixed payout delay was rejected without weighing a shorter sale window

- **Lines:** 100-103, 338, 796.
- **Quote:** "Stripe allows a delay of at most 31 days, which is too short for a class sold weeks ahead."
- **Why:** If a seat can be bought only when the class ends within 24 days, a 31-day delay alone gives "not paid until 7 days after the last block". That removes the job, both payout tables, the release marks, the scheduler, the queue, the payout webhooks and the Support payouts page, and with them the risk in finding 4. The costs are real: a 24-day window instead of 75, self-paced money delayed 31 days for opted-in teachers, and no hold for disputes or review. It also depends on the pending-balance question in finding 1.
- **Change:** Add this as an alternative row with those costs and let the author choose it or reject it on the record for the first release.

#### 6. Major: Moving a learner is the largest cuttable feature, and its stated reason is not served

- **Lines:** 121-123, 264-271, 362, 420, 613-620, 823, 995, 1006.
- **Quote:** "After a cancellation each learner would have to be refunded and persuaded to pay again."
- **Why:** Cancelling writes a refund row for every seat in the same transaction (lines 628-631), so a teacher cannot move learners after cancelling; they must move each one first. The RFC lists moving under "Later". It costs three columns, a refund kind, a second time limit, six refusal reasons, a two-class lock, a special withdrawal window, an email and a dialog, and it makes a payment's class changeable.
- **Change:** Defer to 2b. Until then a learner withdraws and buys again.

#### 7. Major: Dispute automation covers the less common timing and leaves the common one undefined

- **Lines:** 131-132, 300-308, 705-721, 835-836.
- **Quote:** "A learner with a seat disputes the charge with their bank before the class is released."
- **Why:** Release is 7 days after the class; bank disputes usually arrive later. Nothing says what happens then (see finding 3). The feature adds four event types, three columns, a refund kind with its own execution path, and a change to how every failed webhook is retried.
- **Change:** For the first release, record the dispute on the payment and show it to Support. Reverse the transfer by hand in Stripe. At a handful of teachers, "every lost dispute would need a person" is close to no work.

#### 8. Major: The attendance review is defeated by one manual mark

- **Lines:** 47, 133-134, 291-298, 413-414, 654-655, 1416-1417.
- **Quote:** "if it has no check-in and no manual mark for any block and is not cleared, set `review_needed_at`."
- **Why:** The instructor can make a manual mark, so the party the check guards against can pass it. If Support does nothing, the money is released at 85 days anyway. It costs four columns, a release reason, a route, a Support action and the forced-release path.
- **Change:** Cut the review state. If Support wants the signal, list released classes with no check-ins on a page, with no state behind it. If this abuse matters for the beta, have Support approve each opt-in instead.

#### 9. Major: A 1,060-line file-level plan on files that do not exist and questions not answered

- **Lines:** 956-960, 861, 1364, 1412, 1480.
- **Quote:** "This plan extends files that Part 1 creates, and names them as they are in that plan."
- **Why:** A search of the worktree finds no `attendance.service.ts`, `classes.service.ts` or `teach-classes.ts` under `apps/api/src`. Findings 1 to 8 could each remove whole phases. The value lists at 984-996 repeat lines 437-456.
- **Change:** Keep the phase list and the verification table here. Write the file-level plan after Part 1 is merged and the Stripe test is done, for slice 2a only.

#### 10. Nit: Items that are not about selling

- **Lines:** 141-144, 470-471, 723-739, 917, 1034, 1609-1649, 1856-1857.
- **Quote:** "They are needed before a real learner checks in, and are otherwise separate from selling."
- **Why:** The backup change is one Terraform line waiting behind eleven phases. The sign-in limit changes a live protection for every user inside a payments design. Opt-out duplicates the by-hand procedure the README already gets (line 917), and the terms-version check guards against a second version that does not exist.
- **Change:** Move the four readiness items into Part 1's remaining phases or ship them as small changes now. Drop the `class-sales/end` route and the `terms_version` error.

### Review coverage

Read in full: the target, the standard, `AGENTS.md`, the RFC brief, `infra/README.md`, ADR 003 and ADR 007. Not read: ADR 010 and the body of the Part 1 design (headings only). Code searches confirmed that the repo has no scheduler today, that `reconcile` exists, and that Part 1's API files are absent. The false mismatch in finding 3 is from reading the design text; nothing was run.

## Contradictions and transforms (`egm-inventive-catalyst`)

Target: `docs/designs/scheduled-classes-selling.md`

The review is complete: six contradictions found, five Major and one Nit. I flag where a transform reopens an author decision.

**What I read**

- The target in full (lines 1-2016) and the persona file.
- `docs/designs/scheduled-classes-brief.md`, `docs/adr/003-payments-destination-charges.md`, `docs/adr/007-payout-accounts.md` and `AGENTS.md` in full.
- `docs/designs/scheduled-classes-attendance.md` by search only (the rules for a manual mark).

**What I did not check**

- No source code was opened.
- Every statement about Stripe behaviour is unverified and needs the same sandbox pass the design already plans.

### Ideal Final Result

Class money cannot leave until the class has run and been checked, and Elevate does not write a payout engine to make that true.

- Stripe's own ledger keeps class money apart from self-paced money, so "what is held" is a balance Stripe reports.
- Self-paced payouts never depend on new code.
- A refund before release is one call that leaves nobody's settled balance negative.
- The evidence that locks a refund or unlocks a release is written by someone other than the party it pays.
- A seat is charged only once it is certain.

The design reaches the first point with a daily balance-less-held calculation over a shared account. It does not reach the fourth.

---

### 1. One account-wide payout switch carries two kinds of money

- **Severity:** Major
- **Affected scope:** "Opting in", "Held money and the release job", "Rollout and rollback"
- **Contradiction:** class money must stay held, and self-paced money must keep flowing as it does today. Stripe's manual-payout setting applies to the whole account (brief line 402), so holding one stops the other.

**Where the design pays**

- Line 101-103: "Money from the same teacher's self-paced sales is paid out at most one day later than Stripe would have paid it."
- Line 668-673: the job works out every payout as "the smaller of A and A + P − held".
- Line 851: "Class money is paid out early, or self-paced money is kept back."
- Line 853: "Teachers who opted in are not paid, including for self-paced sales."
- Line 915-918: with the job off, a teacher is unpaid until the account "is switched back to automatic payouts by hand".
- The two held totals, the mismatch outcome, `payout_run_accounts` and the once-a-day rule all exist because one balance mixes both kinds of money.

**Transform A (Segmentation): a second payout account per opted-in profile, for class sales only**

- Only the class account goes to manual payouts. The self-paced account is never touched.
- A stopped job then delays class money only, and a wrong held total cannot keep self-paced money back.
- The class account's Stripe balance becomes the outside check on the held total (see finding 5).
- ADR 007 already expects this shape: "A profile has at most one for now" (line 11-12), and a second account is "additive" (line 57-59).
- Cost:
  - The teacher goes through a second Stripe onboarding at opt-in, and Support repeats the company legal-name check.
  - Whether Stripe allows two accounts for one legal entity is untested. ADR 007 only tested one person holding an individual and a company account.
  - Earnings queries must read two accounts.
  - The Stripe fee a teacher owes on a cancelled seat can no longer be absorbed by self-paced money in the same balance, so Elevate's exposure in finding 4 rises.
  - The 90-day limit is unchanged.

**Transform B (Extraction): charge class sales on Elevate and transfer the teacher's share at release**

- This reopens an author decision. It is a Non-Goal at line 161 and rejected at line 795.
- It removes manual payouts, the balance arithmetic, both held totals, the reverse-and-part-refund sequence in Open Questions, and the negative teacher balance on a refund.
- The recorded reason for rejecting it is that "Elevate would become the seller on the card statement and own every refund and dispute".
- Under ADR 003 the charge is already a destination charge with `losses.payments: application` (line 8-12). The design itself says Elevate is liable for disputes (line 848) and bears the dispute fee (line 308).
- So part of that reason describes today's model. The card-statement part depends on a setting I did not check in the code.
- Cost:
  - Elevate holds money owed to teachers, which raises a licensing question.
  - Held money is visible to the teacher only in Teach.
  - "The teacher bears the fee" becomes a debt record netted from later transfers.
  - ADR 003 splits into two payment models.
  - Whether a hold limit applies to the platform's own balance is unverified.

---

### 2. The party that the attendance record pays is the party that writes and judges it

- **Severity:** Major
- **Affected scope:** the definition of "Attended" (line 47), "Cancel", the Mark step of the release job
- **Contradiction:** Part 1 made a manual mark count at once so that a class is never stopped by a phone. Part 2 uses that same record as money evidence, where it must resist the profile.
- This is not listed in Risks.

**Where the design pays**

- Line 47: attended means "a check-in or a manual mark that stands for at least one block".
- Line 630-632: on cancel, "Learners who have attended get no row".
- Line 654-655: a class is held for review only "if it has no check-in and no manual mark for any block".
- Part 1 line 482: a manual mark stands unless a dispute decision of `voided` refers to it.
- Part 1 line 321: the disputed mark is decided by "The profile's owner or a manager."
- Part 1 line 932: "The 7-day dispute window can pass without the learner knowing."
- So a profile can mark every learner by hand in block one, cancel, and owe no automatic refund. One manual mark also clears the no-attendance review.
- The risk at line 848 ("Nothing prevents the first occurrence") assumes the learners at least attended.

**Transform A (Segmentation of the predicate): keep "present" as it is for the roster, and define a second "attended, for money"**

- For money, a seat counts as attended only on a standing check-in from the learner's own account, or a manual mark the learner has not disputed. The profile's ruling on a dispute does not count.
- The release check requires at least one learner check-in.
- The timing already fits: release is 7 days after cancellation and the dispute window is 7 days from the mark, so every mark is settled or disputed before the money moves.
- The cancellation email to attended learners (`email.classCancelledAttended`) can carry "you were marked present by hand; say so by this date if not".
- Cost:
  - A learner who really attended on a hand mark can dispute it and get a full refund, so the bias flips toward the learner.
  - A seat with an open mark at cancellation needs a deferred refund decision, which is a third outcome beside "refund row" and "no row".
  - There are two meanings of "attended" to explain.
  - A class where every phone failed goes to Support review.

**Transform B (Self-Service, reusing a mechanism the design already has): a class cancelled after it started enters the existing `review_needed_at` state**

- Today such a class is only listed for Support.
- The author's decisions stand: the owner still cancels at any time, and no refund is automatic.
- Cost:
  - Support acts on every mid-class cancellation, which the author objected to at line 815.
  - The 85-day forced release still caps the hold.

---

### 3. Money must be held until the class is checked, but Stripe pays it out at 90 days

- **Severity:** Major
- **Affected scope:** "When a class is on sale", "Move", "What is held", Limits
- **Contradiction:** a class is "sold weeks before it runs" (line 64) and its money must wait for the class, a review or a dispute. No money can be held past 85 days from payment.

**Where the design pays**

- Line 484: a seat can be bought only if "its last block ends within 75 days of now".
- Line 616: the 82-day move rule. Plan item 4.8 (line 1483-1485) refuses a schedule edit for the same reason.
- Line 852: "A class under review, or a disputed seat, is paid out before the question is settled."
- Line 949-950: "classes longer than about ten weeks, which this design cannot sell."
- At the 85-day mark, the dispute hold and the no-attendance review both stop working.

**Transform A (separation in time): take the booking early and the money late**

- Outside the 75-day window, checkout saves the card and reserves the seat. The job charges it when the class enters the window.
- This removes the sale horizon. It does not help a class longer than ten weeks.
- Cost:
  - A charge can fail weeks later, and the seat must then be freed and the learner chased.
  - A long unpaid reservation invites seat-blocking.
  - "Paying creates the class enrollment; nothing else does" (line 87) no longer holds.
  - It needs off-session payment terms and a new job stage.

**Transform B (Blessing in Disguise): at day 85, park the contested money instead of paying it**

- For a disputed seat or a class under review, reverse that payment's transfer to Elevate and transfer it again when the question is settled.
- The plan already adds `reverseTransfer` for a lost dispute.
- Cost:
  - Elevate holds money in the exception cases, which bends the Non-Goal at line 161.
  - Those payments follow a second model.
  - Reverse-then-retransfer needs a sandbox test.

Transform B of finding 1 would also remove this limit, if no such limit applies to the platform's balance.

---

### 4. The teacher must bear costs that arise after the money is out of reach

- **Severity:** Major
- **Affected scope:** "Refunds", "Disputes", Open Questions
- **Contradiction:** "whoever ends a seat bears that fee", and a lost dispute is charged to the teacher. But Elevate cannot debit a teacher's balance (brief line 403), and a refunded seat's own money does not contain the fee.

**Where the design pays**

- Line 175-179: the goal rests on a Stripe sequence the documentation "does not say … can be combined".
- Line 584-590: the only fallback "would break the goal 'Elevate does not lose money on a refund it did not cause'".
- Line 850: the teacher's balance "goes negative by Stripe's fee per seat, which Elevate carries until later sales cover it".
- Line 945: recovering the fee is left to Future Improvements.
- Line 713: a dispute lost after release reverses the teacher's share from a balance that may be empty. This case is not in Risks.

**Transform A (Beforehand Cushioning): add Stripe's fee per unreleased seat to the held total**

- The held total becomes the sum of teacher's share plus fee for each unreleased seat. It is one term in a calculation the job already does.
- A cancellation then lands on money still in the balance, and the cushion is released with the class.
- A short rolling reserve on released class money would cover late disputes the same way.
- Cost:
  - Up to the fee times seats sold of a teacher's self-paced money is delayed until release, which breaks the goal at line 101-103 as worded.
  - It does nothing for a teacher with no other income.
  - The opt-in terms must say it.

**Transform B: test a second sequence in the same sandbox session, so the fallback does not surrender the goal**

- Refund the learner from Elevate without reversing, then reverse the teacher's share plus the fee from the transfer.
- Both calls are ones the plan already adds.
- Cost:
  - Between the calls Elevate is short the full amount, where the design's order leaves the teacher short.
  - If the second call fails, Elevate carries more until it is retried.

---

### 5. The check on the held total reads the same rows as the total, and the payout formula fails open

- **Severity:** Major
- **Affected scope:** "One run" steps 2-5; the goal "A wrong held total cannot pay money out"
- **Contradiction:** the check is only worth having if it is independent, but both totals are sums over the same `payments` rows, taken in the same run, straight after the marking step.

**Where the design pays**

- Line 107-108 promises "two independent routes".
- Line 678-680 says "The two totals share the payment rows and the fee arithmetic".
- Line 851: "A payment missing from both routes is not caught."
- Because the payout is the balance less what is held, any class payment the database does not know about is treated as payable.
- That case is reachable. ADR 007 line 22-24 says a paid session with a bad payee writes no payment. The design at line 718-721 notes that failed webhook events were never retried.
- Unrecorded pending money raises "A + P − held", which lets available held class money out.

**Transform (Inversion): pay only money the database can name, and use Stripe's balance as the second total**

- Payout becomes the smallest of three: available balance, balance less held, and the named payable money.
- Named payable money is recorded self-paced payments not yet paid out, plus released class payments not yet paid out.
- The check becomes: balance equals held plus named, within a tolerance. An unrecorded payment then stays in the balance and shows up as an unexplained amount.
- This is not the alternative rejected at line 800. The available balance still bounds the payout, so no payout can fail.
- Cost:
  - Every payment, self-paced included, needs a paid-out mark.
  - Timing noise from pending refunds, payouts in transit and disputes will cause false differences, so it needs a tolerance and a Support view.
  - Unexplained money waits for a person.

With Transform A of finding 1, the class account's balance gives this check with less work.

---

### 6. A seat hold that ends by the clock still lets a late payment land on a sold seat

- **Severity:** Nit
- **Affected scope:** "Buying a seat", "Fulfilment", CUJ 3 and CUJ 13
- **Contradiction:** never oversell with no job to release holds, against a payment that completes on Stripe's timing.

**Where the design pays**

- Line 222-224: an abandoned seat is locked for 35 minutes.
- Line 313-316: a late payment is "refunded in full, Elevate bearing the fee".
- Line 856: after a rollback, "only the expired-hold case can oversell".

**Transform A (Preliminary Action): authorise at checkout and capture at fulfilment, once the seat is confirmed**

- A lost seat cancels the authorisation, with no refund and no `seat_lost` kind.
- Cost:
  - Fulfilment becomes two steps and needs a resumable state between seat and capture.
  - It works for cards only.
  - That a cancelled authorisation carries no Stripe fee is unverified.
  - The case is rare, so this is worth taking only if card-only is acceptable.

**Transform B (Dynamics): end the hold by event as well as by clock**

- End it on Stripe's session-expired notice and when the learner returns by the cancel address. The 35 minutes stays as the backstop.
- Cost: one more webhook type, and one more place that writes `seat_held_until`.
