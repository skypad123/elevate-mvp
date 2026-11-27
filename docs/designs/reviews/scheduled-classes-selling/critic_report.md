# Critic Report: Scheduled Classes, Part 2 (Selling a Class)

- **Stage:** 7 (Critic Review)
- **Target:** `docs/designs/scheduled-classes-selling.md`, lines 1-955 (the
  design)
- **Reviewers:** `egm-design`, `egm-structural` and `egm-style`, each in a
  fresh context
- **Date:** 2026-11-24

The three reports are given as the reviewers wrote them. Line numbers refer to
the target as it stood at commit `7f9cb68`. The design reviewer marked each
statement about Stripe or AWS behaviour that it did not check online with
"confirm".

| Reviewer  | Blocker | Major | Nit |
| --------- | ------- | ----- | --- |
| Design    | 4       | 8     | 0   |
| Structure | 0       | 9     | 1   |
| Style     | 0       | 11    | 1   |

## Architecture (`egm-design`)

### Verdict

The design is not ready to build. Four defects sit in the text as written:

- A learner can pay for a class that was cancelled seconds earlier, and nothing refunds them.
- The payout formula pays out held money whenever a class payment exists at Stripe but not yet in the database.
- The "two independent totals" check disagrees by design after an ordinary late dispute, which stops all of that teacher's payouts for weeks.
- A class is released while its cancellation refunds are still unsent.

Beyond these, the refund table assumes Elevate's fee contains Stripe's actual fee, but the code builds it from an estimate. Resumption relies on Stripe idempotency keys that expire. The release and refund locks depend on dates and attendance marks the teacher controls. The stated rollback either stops paying teachers or pays out everything held.

Against the standard, problem, goals, architecture and risks are present. The Alternatives rule is only partly met: several rows (lines 779-781, 797, 814, 816) reject an option with "the author wants..." and give no concrete trade-off or link.

Scope and limits of this review:

- I read the target, the standard, AGENTS.md, and parts of the RFC, the Part 1 design, `infra/README.md` and the money code.
- ADR 003 was only searched and ADR 007 was not opened.
- My statements about Stripe and AWS behaviour come from memory of their documentation and were not checked online; each is marked "confirm".

#### 1. Blocker: fulfilment does not re-check the class, so a payment landing after a cancellation becomes an unrefunded seat

- **Lines:** 525-534, 627-637.
- **Quote:** "if the enrollment's hold is still current, or a seat is still free, activates the enrollment".
- **Scenario:**
  1. Learner A is on the Stripe page, holding a seat.
  2. The owner cancels. The transaction "ends every seat hold" and writes refund rows for active seats only; A has none. Nothing says A's payment page is expired.
  3. A pays. Fulfilment finds the hold ended but "a seat is still free" (every seat is), and activates A in a cancelled class.
  4. No refund row exists for A. If the class had earlier attendance, it is released 7 days later and A's money goes to the teacher.
- **Same gap elsewhere:** payments that land after the first block starts, or after the profile opts out. Opt-out (line 470) checks "a seat sold", not holds, so a payment in flight lands on an account already back on automatic payouts.
- **Change:** in fulfilment, under the class lock, re-apply the non-clock parts of `classOnSale`. On failure, write a refund row of a defined kind (teacher bears the fee if the teacher cancelled). Make Cancel and opt-out expire every open payment page, and make opt-out count holds.

#### 2. Blocker: the payout formula pays out held money while a class payment is at Stripe but not yet in the database

- **Lines:** 660-675, 851.
- **Quote:** "the smaller of A and A + P − held".
- **Checked:** the payment row is written only in `fulfilCheckout` (`apps/api/src/services/payments.service.ts`), from the webhook or the success-page poll.
- **Scenario:**
  1. A teacher has S$4,000 of settled class money, all held.
  2. 10:14:50: a learner pays S$500. Stripe adds S$410.12 to the teacher's pending balance.
  3. 10:15:00: the run computes both totals from the database as 4,000. They agree. The balance is A = 4,000, P = 410.12, so the payout is min(4,000, 410.12) = S$410.12.
  4. 10:15:05: the webhook writes the payment. Held is now 4,410.12 and the balance is 4,000.
- **Result:** S$410.12 of held money has left and nothing is flagged. If fulfilment never happens (`unattributed`, `unmatched`, or a handler error), the gap is permanent. Line 851 admits "a payment missing from both routes is not caught".
- **Related:** the formula also pays pending self-paced money out of settled class money.
- **Change:** derive the second total from Stripe rather than the same rows. Sum the un-reversed transfers to the account whose payment intent carries a class id (`listTransferAmountCents` in `providers/payments/stripe.ts` already lists transfers), and treat any transfer with no payment row as held. Also define "share after refunds" exactly: what a seat refunded at −F contributes, and what a `refund_sent` row contributes.

#### 3. Blocker: the two totals disagree by design, and a mismatch has no way out

- **Lines:** 660-667, 289, 613-620, 711.
- **Quote:** "or which have an open dispute" (calendar total) against "class payments with no `released_run_id`" (mark total).
- **Scenario A, late dispute:**
  1. A class is released on day 7 after its end and paid out.
  2. A learner disputes on day 30. Card disputes commonly arrive weeks after a service (confirm the window).
  3. `dispute_status` becomes `open`. The mark total excludes the payment (it is released); the calendar total includes it.
  4. The outcome is `mismatch`. The teacher gets no payout, self-paced money included, until the dispute closes or the payment is 85 days old.
- **Scenario B, move:** Move does not require the source class to be unreleased. A no-show in a released March class is moved to April. The payment now belongs to a class that is not due, so the totals mismatch. The learner can then take a full `moved_withdrew` refund against money already paid out.
- **Scenario C, block edit:** Part 1 lets unfrozen blocks change after publishing (`scheduled-classes-attendance.md` lines 692-693). Moving the last block later after release has the same effect.
- **Further:** no action is designed to clear a mismatch, and a mismatch also blocks the 85-day forced payout. The two totals read the same rows with the same predicate in the same run, so they catch little beyond a failed write.
- **Change:** define held by one rule, and make the check a comparison with Stripe (finding 2). State what a dispute after release does. Refuse a move out of a released or ended class. Give Support a recorded way to resolve a mismatch.

#### 4. Blocker: a class is released while its refunds are unfinished, and a refund that can never succeed has no defined end

- **Lines:** 439, 565-582, 637, 649-659.
- **Quote:** "A cancelled class is released 7 days after it was cancelled."
- **Gaps:**
  - The mark step checks attendance and disputes, not open `seat_refunds` rows.
  - The status `failed` is listed but never defined: when a row becomes `failed`, who sees it, whether it is retried.
- **Scenario:**
  1. A teacher cancels a class with 12 seats sold.
  2. One learner has an open dispute. Stripe refuses a refund on a charged-back charge (error `charge_disputed`; confirm). Another row fails because the reversal exceeds the balance.
  3. Those rows are retried every 15 minutes without success.
  4. On day 7 the class is released. The payment with no open dispute is marked and paid to the teacher. The learner is still unrefunded, and the reversal now has nothing to draw on.
- **Change:** never mark a payment that has an unfinished refund row, or a class whose cancellation has no `completed_at`. Define `failed`: after how many attempts, a Support list, and a manual retry. Say what Cancel, Withdraw and a discretionary refund do for a seat with an open dispute; skip the row and let the dispute decide.

#### 5. Major: the refund table assumes Elevate's fee is C plus Stripe's actual fee; the code builds it from an estimate

- **Lines:** 549-563, 126-128.
- **Quote:** "with Stripe's actual fee F ... so that A = N + C + F. Elevate's application fee is C + F."
- **Checked:**
  - `quote()` in `packages/core/src/domain/money.ts` sets `applicationFeeCents = amount − teacherNet`, using `stripeFeeEstimateCents`.
  - `fulfilCheckout` stores `stripeFeeActualCents` separately, and it can be null.
- **Failure:** with X = C, Elevate's net on a `teacher_cancelled` or `learner_withdrew` seat is estimate minus actual. That is negative for any card costing more than 3.4% + S$0.50 (international cards, by Stripe's published rates; confirm). The goal "Elevate's net on the seat is zero or more" fails. With a null actual fee, `seatRefund()` has no F.
- **Second point:** the transfer on a destination charge is the full amount A, with the fee taken back (confirm in the sandbox).
  - Step 1 therefore debits the teacher A, not N. Between steps 1 and 2 the balance is short by C + F (S$89.88 on S$500), not "only the fee" as line 850 says.
  - For a teacher whose only money is the cancelled class, the last seats' reversals always exceed the balance.
- **Change:**
  - Define X as `applicationFeeCents − stripeFeeActualCents`, clamped at zero, and R for a withdrawal as A − actual fee.
  - Fetch the balance transaction when the actual fee is null.
  - Word the pre-purchase figure as an estimate.
  - Test sending the fee refund before the charge refund, which limits the shortfall to F.

#### 6. Major: nothing limits a seat to one open refund, so withdrawal, cancellation, discretionary and Support refunds collide

- **Lines:** 580-582, 592-596, 607-636.
- **Quote:** "for any amount up to what the learner paid and has not had back".
- **Scenario A, withdraw during cancel:**
  1. A teacher cancels. The seats stay `active` until the job runs, up to 15 minutes later.
  2. A learner presses Withdraw. They are eligible (active, not attended, more than 7 days out). `learner_withdrew` runs in the request and returns A − F.
  3. The job's `teacher_cancelled` row for A is then refused by Stripe because only F is left.
  4. The learner is out the fee the design promised them, the row is stuck, and the cancellation never completes.
- **Scenario B, double grant:** the owner double-clicks, or the owner and a manager both grant S$200. Both requests read "refunded so far = 0", because a refund is recorded on the payment only at step 3. The learner gets S$400.
- **Checked:** `TransactionsService.refund` (Support) checks only `payment.status`, so it can also race a pending row.
- **Change:**
  - Add a partial unique index on `seat_refunds (payment_id)` for unfinished rows.
  - Compute "not had back" from the rows under the enrollment lock.
  - Refuse Withdraw on a cancelled class.
  - Make Support's refund go through, or wait for, the seat's row.

#### 7. Major: "every step is safe to repeat" depends on Stripe idempotency keys, which expire

- **Lines:** 568-572, 682-684, 882-883.
- **Quote:** "the idempotency keys stop a refund or a payout being sent twice".
- **Stripe behaviour:** keys are kept for about 24 hours (confirm).
- **Scenario:**
  1. Step 1 creates a S$482.50 withdrawal refund. The process dies before storing the id.
  2. The schedule is disabled (the design's own rollback step), or the job is down for more than a day with nobody paged (line 853).
  3. The next run replays `seat-refund:<id>` as a new request. A part refund succeeds a second time. A full refund fails and sticks.
- **Other gaps:**
  - `payout:<row id>` uses a new row per run, so it gives no protection across runs. Only the balance formula does.
  - Refund rows have no claim. The request and the job, or two overlapping runs, can execute the same row and email twice.
- **Change:** before each Stripe call, look up an existing refund, fee refund or payout by a metadata id on the charge, fee or account. Claim rows with `FOR UPDATE SKIP LOCKED`. Send the email off a conditional `done` update.

#### 8. Major: the seat guarantee has holes outside the locked count

- **Lines:** 88-91, 403-405, 512-519, 855.
- **Quote:** "a hold ends by the clock and no job releases it".
- **a. Paid in time, fulfilled late:**
  1. A pays at minute 5. The webhook is delayed past minute 35 (an outage or deploy) and A has closed the tab.
  2. B takes the "free" seat.
  3. A's event arrives. A is refunded as `seat_lost`, although A paid inside the hold, and Elevate bears the fee.
  - _Change:_ when a checkout would reuse an expired hold's seat, retrieve that hold's Stripe session first and fulfil it if paid.
- **b. Delayed payment methods:**
  - `createCheckoutSession` (`providers/payments/stripe.ts`) sets no `payment_method_types`.
  - `stripe-events.ts` already handles `checkout.session.async_payment_succeeded`.
  - A delayed method can therefore complete days after the hold.
  - _Change:_ pin class sessions to immediate methods.
- **c. Free seat-blocking:** each `POST /checkout/classes/:id` rewrites the hold to 35 minutes ahead, with no limit. A handful of accounts can keep a class full indefinitely. _Change:_ cap renewals per learner per class.
- **d. Seats lowered after sale:** Part 1 lets `seats` change after publishing (line 692). Nothing here stops it going below seats taken. _Change:_ refuse it.

#### 9. Major: the release check, the refund lock and the deadlines rest on data the teacher writes

- **Lines:** 47, 114-120, 652-657, 848.
- **Quote:** "if it has no check-in and no manual mark for any block ... leave it held".
- **Checked in Part 1:**
  - A manual mark is made by the instructor and "counts at once" (lines 117, 682).
  - A dispute of a manual mark is decided by the profile's owner or a manager (line 321).
  - Unfrozen blocks can be edited after publishing (line 693).
- **Scenario 1:** the instructor marks every learner present by hand at block one and cancels. No learner gets an automatic refund. Disputes of the marks are decided by the same profile. The class is released 7 days later. The accepted risk at line 848 covers "runs one block", not "runs none".
- **Scenario 2:** one manual mark defeats the no-attendance review.
- **Scenario 3:** after selling, the teacher moves the first block to within 7 days, which closes withdrawal for everyone. Or the teacher moves the last block beyond day 85, so the forced release pays before the class ends.
- **Change:**
  - Count only learner check-ins, or manual marks past their dispute window, for the lock and the release.
  - Send a cancellation where the only attendance is manual marks to Support.
  - Once a seat is sold, freeze block dates or bound the edits: the first block not earlier, the last block not later than payment plus 75 days.

#### 10. Major: behaviour at Stripe's time limit is unknown, and the design's protection is a mark, not a payout

- **Lines:** 175-186, 338, 348, 616, 659, 688, 852.
- **Quote:** "Also mark any payment older than 85 days".
- **Gaps:**
  - Marking does not move money. A `mismatch` (finding 3), a failed payout, an account whose payouts Stripe has disabled, or a stopped job all leave money past the limit with only a Support page to show it.
  - The design never says what Stripe does at the limit, and 90 days cannot be tested in a sandbox.
  - Move allows a class ending 82 days after payment (line 616). Its release is due on day 89, but the forced release on day 85 comes first, so the 7-day hold is broken.
  - A class sold 75 days out leaves Support 3 days for a "needs review" before the forced release.
- **Unsupported claims:**
  - Line 688, "a schedule cannot change the command of the task it starts", has no source (confirm against EventBridge Scheduler's universal target).
  - The RFC's unverified item "whether pausing payouts on teachers' accounts brings any licensing duty" (`scheduled-classes-brief.md` line 488) is missing from Open Questions.
- **Change:**
  - Get Stripe's written answer on the limit and on reversals against pending or insufficient balance before Phase 1, not Phase 4.
  - Make these gates with named owners.
  - Use the same day count for Move as for purchase.
  - Say who is told when a payment is past day 85 and still unpaid.

#### 11. Major: the stated rollbacks either stop paying teachers or pay out everything held

- **Lines:** 465-468, 690-694, 913-920.
- **Quote:** "or the profile's Stripe account is switched back to automatic payouts by hand".
- **Failures:**
  - Switching an account to automatic makes Stripe pay out the whole available balance, including all held class money (confirm).
  - A code rollback to Part 1's version re-registers "all three task definitions" from an image that has no `dist/release.js`. Every run then fails, and opted-in teachers receive nothing while the clock runs.
  - Part 1's code has no dispute handler. Its `applyRefund` (`transactions.service.ts`) decrements the course's enrol count for a class refund.
  - Opt-in crash: if the process dies after Stripe is switched to manual and before the acceptance is recorded, the job never pays that account and nothing shows it.
- **Change:**
  - Write the rollback for the state "seats sold, money held": keep the job image pinned to the last good Part 2 revision, separate from the API's.
  - Remove "switch to automatic" as a remedy unless held is zero.
  - Record opt-in intent before the Stripe call and reconcile `payout_mode` from `account.updated`.

#### 12. Major: security and privacy gaps

- **Lines:** 493-494, 627, 728-737, 853, 874-877.
- **Quote:** "Cancelling and moving: `class.manage`."
- **Gaps:**
  - Opt-in needs a recent sign-in. Cancel and discretionary refund do not, although Cancel is irreversible and charges the teacher the fee on every seat. `class.manage` is held by every manager (`packages/core/src/domain/permissions.ts`). A stolen manager session can cancel every class.
  - A money job runs with "nobody is paged".
  - Erasing coordinates leaves them in the 35 days of backups introduced in the same section. The procedure does not say so.
  - The public course response gains each class's venue address and times. For a class at a teacher's home, that publishes where they are and when.
- **Change:**
  - Require the recent-sign-in check on Cancel and on refunds.
  - Add one alarm on "no finished run in an hour" before real money is held.
  - State the backup retention in the erasure record.
  - Show only the area publicly and the full address after purchase.

### Files referenced

- docs/designs/scheduled-classes-selling.md
- docs/designs/scheduled-classes-brief.md
- docs/designs/scheduled-classes-attendance.md
- apps/api/src/services/payments.service.ts
- apps/api/src/services/transactions.service.ts
- apps/api/src/services/stripe-events.ts
- apps/api/src/providers/payments/stripe.ts
- packages/core/src/domain/money.ts
- packages/core/src/domain/permissions.ts
- infra/README.md

## Structure (`egm-structural`)

### Verdict

The design has every section the feature-spec standard asks for (Problem, Goals and Non-Goals, Architecture, Alternatives, Risks) and the heading levels nest correctly, but it should not pass Stage 7 as it stands. I found no Blocker and nine Major findings, plus one Nit. The largest problems are: the label "Drafting" is defined two opposite ways, so about 17 decisions have no clear decider; around ten alternatives are rejected only on the author's preference, which the standard's Alternatives Rule forbids; and several money rules are stated in two or three places with different wording or numbers (the attendance lock against Elevate's cancellation, the 85-day limit, the 75-day and 82-day horizons, the refund kinds). The design's phase references match the plan's headings (Phase 4 is refunds; a Verification Plan exists at line 1930).

Files read: the target (lines 1-955 in full, plan headings only), the standard, the structural persona, and the headings of `docs/designs/scheduled-classes-brief.md`. AGENTS.md was not opened.

#### 1. Major: "Drafting" is defined two opposite ways, so the decider of many decisions is unknown

- **Lines:** 29-31, 337-350, 772-773, 786, 804, 825; also the Risk statuses at 850, 852, 853, 855, 856, 859, 860.
- **Quotes:**
  - Line 30: "An AI assistant drafts the text and makes the mechanical choices, which the Technical Plan marks 'Drafting'."
  - Line 772: "'Drafting' is a choice the author made at a question while this design was drafted."
- **Problem:**
  - By the first definition, the 14 "Drafting" rows in the decisions table were decided by the AI assistant. By the second, the author decided them.
  - Three alternatives rows are recorded as bare "Drafting" (786, 804, 825), next to others marked "Drafting, rejected by author". A reader cannot tell who rejected them.
  - Several "Drafting" rows are money rules, not mechanical choices: the 85-day forced release, the 7-day withdrawal cut-off, and Elevate bearing the fee on a lost seat.
  - Seven risk rows say "Accepted" or "Accepted for the beta" with no decider, while two say "Accepted by author".
- **Suggested change:**
  - Use one definition throughout, and give the alternatives table a separate label such as "Author, during drafting".
  - Add a "Confirmed by author: yes/no" column to the decisions table.
  - Put a name on every "Accepted" risk status.

#### 2. Major: about ten alternatives are rejected on the author's preference alone, which breaks the Alternatives Rule

- **Lines:** 779, 780, 781, 782, 797, 814, 816, 834, 837, 840.
- **Quotes:**
  - Line 780: "The author wants a class to take the course's price."
  - Line 816: "The author wants the lock to hold in both cases."
  - Line 837: "The author chose to build nothing here".
- **Problem:**
  - The standard says rejection reasons "must state concrete technical or scope trade-offs and must not attribute a rejection to a maintainer without linking their issue, discussion, or PR."
  - These rows state a preference, not a trade-off.
  - The "Drafting, rejected by author" rows link to no record at all. The "RFC" rows link only to a whole section of the RFC.
  - Line 816 matters most: it rejects the one option that would remove the top risk (line 848), and gives no reason.
- **Suggested change:**
  - Add the concrete trade-off to each row. For example, at 780: a second price needs a price column, a quote path and refund arithmetic per class.
  - Link each author decision to where it is recorded: an RFC subsection anchor, an issue or a PR comment.

#### 3. Major: the attendance lock is stated without the Elevate exception that the body builds

- **Lines:** 114-117 and 325, against 124-125 and 633-635.
- **Quotes:**
  - Lines 114-115: "Once a learner has attended a block, no refund is automatic. This holds when the learner asks to leave and when the class is cancelled."
  - Line 325: "no refund is automatic, including when the class is cancelled."
  - Line 124: "When Elevate cancels a class, every learner is refunded in full".
  - Lines 634-635: "it writes `elevate_cancelled` rows for every active seat, attended or not."
- **Problem:**
  - Two goals contradict each other as written.
  - The decisions table has no row for "Elevate's cancellation refunds learners who attended", so that rule has no decider.
  - No CUJ covers Elevate's cancellation.
- **Suggested change:**
  - Reword 114-117 and 325 to "when the profile cancels".
  - Add a decisions row for Elevate's cancellation, with its decider.
  - Add a short CUJ for it.

#### 4. Major: the hold limit and the sale horizon appear with different numbers and different units

- **Lines:** 182, 298, 338, 348, 412, 484, 616, 644, 659, 852, 868.
- **Quotes:**
  - Line 298: "it is released 85 days after its earliest payment" (per class).
  - Line 659: "Also mark any payment older than 85 days, with the reason `stripe_limit`" (per payment).
  - Line 412: `release_reason` is a column on `classes`; `payments` (418-422) has no reason column.
  - Line 348: "85 days from the payment ... Drafting: Stripe's limit", against line 182: "Stripe's 90-day limit".
  - Line 484: "its last block ends within 75 days of now", against line 616: "whose last block ends within 82 days of the learner's payment".
- **Problem:**
  - The reader cannot tell whether the forced release is per class or per payment, or where its reason is stored.
  - 85 is called Stripe's limit when Stripe's is 90; the 5-day margin is not explained.
  - The 82-day move horizon has no decisions row and is missing from "Limits" (863-868).
  - A class ending 82 days after payment is due on day 89, after the 85-day forced release. So a move can produce a class that always releases by `stripe_limit`.
- **Suggested change:**
  - Add one small table of time limits (30, 35, 7, 75, 82, 85, 90) giving each one's start point, unit (class or payment), derivation and decider.
  - Make CUJ 11, line 659 and the data model agree with it.

#### 5. Major: the refund tables do not cover all refund kinds, and "the table above" has no status column

- **Lines:** 129-130, 396-401, 437, 554-559, 565-575, 594-595, 713.
- **Quotes:**
  - Line 437 lists seven kinds, including `dispute_lost`. The amounts table (554-559) has six; `dispute_lost` has no R or X.
  - Line 574: "set the enrollment's status by the table above". That table's columns are Kind, R, X, teacher's net and Elevate's net.
  - Line 129: "Every refund path frees the seat", against line 594: "a full refund sets the class enrollment to `refunded`, which frees the seat".
- **Problem:**
  - The send sequence starts with "create a Stripe refund of R". A lost dispute has no card refund to create, so the sequence does not fit `dispute_lost`.
  - The status mapping sits 170 lines earlier (396-401) and gives no status for a `discretionary` refund, whether part or full.
  - A part refund, whether discretionary or made in the Stripe dashboard, does not free the seat. The goal says every path does.
- **Suggested change:**
  - Add a `dispute_lost` row to the amounts table and say which send steps it skips.
  - Add an "Enrollment status after" column to that table, covering all seven kinds plus part refunds.
  - Reword the goal to "Every full refund frees the seat".

#### 6. Major: an open question is treated as settled in Risks, and the gates that open questions set are missing from the rollout order

- **Lines:** 172-192, 584-590, 850, 857, 908-912.
- **Quotes:**
  - Lines 180-181 (open): "What Stripe does when a reversal is larger than the teacher's available balance".
  - Line 850 (settled, "Accepted"): "The teacher's balance goes negative by Stripe's fee per seat, which Elevate carries until later sales cover it."
  - Line 857: "the release to real learners waits for a lawyer's read."
  - Line 190: "Needs a lawyer before real learners buy."
- **Problem:**
  - The risk row states as fact the behaviour the open question says is unknown.
  - The rollout "Order" names no lawyer's read, no sandbox test and no sign-off of the Chinese text, though three open questions and one risk depend on them.
  - Two open questions (reversal against balance, the 90-day count) have no resolving step and no fallback.
  - No open question has an owner.
  - The SSG question (191-192) concerns a non-goal.
- **Suggested change:**
  - Mark risk 850 "Open, depends on Open Question 3".
  - Add the gates to the rollout order as numbered steps.
  - Give each open question an owner, a "needed before" point and a fallback.
  - Move the SSG question to Future Improvements.

#### 7. Major: changes to live behaviour sit inside mechanism sections with no goal, risk or rollout note

- **Lines:** 95-97, 470-471, 503-504, 510, 598-603, 718-721.
- **Quotes:**
  - Line 598: "A fault fixed on the way."
  - Lines 602-603: "both paths are changed to use Stripe's own refund id, and the refunded total becomes the sum of the refund rows."
  - Lines 720-721: "a redelivered event whose stored row has an error and no success is handled again."
- **Problem:**
  - Both change how every payment is handled, self-paced included. Neither appears in Goals, Risks or Rollout, so the Verification Plan has nothing to map them to.
  - A reader of the goal "Existing self-paced checkout does not change" would not expect them.
  - Three smaller mechanisms also have no goal or CUJ: opting out (470-471), refusing the profile's owner or a member as a buyer (510), and promo codes on a class (503-504).
- **Suggested change:**
  - Add a goal such as "A refund is recorded once, whichever path reports it" and one for webhook retries, each with a risk row for the existing self-paced path.
  - Either add a goal or CUJ for opting out and for the buyer refusal, or list them under one heading as supporting rules.

#### 8. Major: several goals are not backed by the body, or are stated more strongly than it

- **Lines:** 82-83, 88-91, 135-136, 139-140, against 488-541, 516-517, 856, 906-907, 919-920.
- **Quotes and problems:**
  - Line 82: "Each goal names how it is checked." Most goals state an outcome and name no check.
  - Lines 135-136: "The refund terms are shown to the learner before they pay". Only CUJ 2 mentions this. "Buying a seat" (488-541) has no mechanism for it, and no terms version is recorded for the learner as it is for the owner at opt-in.
  - Lines 89-90: the seat is held "until the payment completes or the payment page expires". Lines 516-517 and CUJ 3 give a 30-minute page and a 35-minute hold.
  - Line 88: "A class never has more learners than seats", against line 856: "only the expired-hold case can oversell".
  - Line 139: "safe to roll back to Part 1's version", against line 919: "safe only with `CLASS_SALES` off first", and line 907, where Part 1 shows the new enum value as raw text.
- **Suggested change:**
  - Remove the sentence at line 82, or add a "Checked by" clause to each goal.
  - Add the refund-terms display and its recorded version to "Buying a seat".
  - Reword the three goals to carry the conditions the body states.

#### 9. Major: the release run's prose, tables, goals and journeys disagree

- **Lines:** 104-106, 245-252, 280, 456, 652-675, 892-893.
- **Quotes and problems:**
  - Line 105: "Each run records the balance". Steps 4 and 5 (666-669) skip the balance read on `mismatch` and `already_paid_today`.
  - Lines 892-893: "at most one balance read and one payout call a day". Step 5 reads the balance on every run until a payout is created, which is up to 96 times a day for a teacher with nothing to pay.
  - Line 456 lists the outcomes `nothing_due` and `failed`. The run steps never say when either is recorded.
  - Line 280: "The day's payout to the teacher's bank includes it". That is false if a payout already went out that day.
  - CUJ 6 (245-252) cancels a class before it starts. Such a class has no attendance, so step 3.1 (654-655) sends it to "needs review". The CUJ and the text do not say whether that is intended.
- **Suggested change:**
  - Add an outcome table: one row per outcome, with its trigger and what the run records.
  - Correct line 105, lines 892-893 and CUJ 9 to match it.
  - State what the review check does for a class cancelled before its first block.

#### 10. Nit: data model, cross-references and terms

- **Lines:** 179, 186, 331, 391, 587, 619, 832.
- **Problems:**
  - Line 391 says `enrollments` gains only `seat_held_until`. Line 619 adds `moved_at`, `moved_by` and `moved_from_class_id`. The fallback at line 587 adds "a new column on the refund row" that is not in the model either.
  - Open Questions (170) sits before the sections it cites, and line 186 cites a section "The release job" that does not exist. The heading is "Held money and the release job", subsection "Scheduling".
  - "The core controls" (331, 832) is never defined in this document, and the phrase does not appear in the RFC.
  - The same thing is called the release job, the job, the release task, the release program and a scheduled one-off task.
  - "Block" and "manual mark" depend on Part 1's word list.
- **Suggested change:**
  - Add the move columns to the data model.
  - Move Open Questions after Risks, or fix the section names it cites.
  - List the core controls by name.
  - Pick one name for the job, and add "block" to the word list.

## Style (`egm-style`)

### Verdict

The document does not yet meet the plain-English standard: 11 Major findings and 1 Nit, no Blockers. The largest problem is that the word list is not honoured. "Seat", "hold", "release", "run", "cancel" and "fee" each carry a second or third meaning in the body, and one party is called teacher, profile, payout account and provider. Three goals state a rule without the exception the Technical Plan gives it, and the day limits (30/35 minutes, 75/82/85/90 days) are stated differently in different places. Review covered the persona file and both chunks of the target. No standard file was supplied; I applied the house standard as described in the task. I did not read Part 1's word list, so terms such as "block", "manager" and "instructor" may be defined there.

#### 1. Major: the attendance rule contradicts Elevate's own cancellation (lines 114-117, 325, 124-125, 633-635)

- Line 114-117: "Once a learner has attended a block, no refund is automatic. This holds when the learner asks to leave and when the class is cancelled. From then on a refund is granted only by the profile's owner or a manager"
- Line 325: "no refund is automatic, including when the class is cancelled."
- Line 124: "When Elevate cancels a class, every learner is refunded in full"
- Line 635: "it writes `elevate_cancelled` rows for every active seat, attended or not."

The word list defines Cancel as "The teaching profile, or Elevate, ends a class", so the first two statements cover Elevate's cancellation and the last two contradict them. "Only by the profile's owner or a manager" also conflicts with Support's refund action (lines 129-130, 339).

Rewrite (114-117): "Once a learner has attended a block, they are refunded automatically in one case only: Elevate cancels the class. If the learner asks to leave, or the profile cancels the class, the profile's owner or a manager decides whether to refund and how much. They can do so until the class's money is released. After that the learner asks Support."
Rewrite (325): "…no refund is automatic, including when the profile cancels the class."

#### 2. Major: time limits stated differently in different places (lines 60, 88-90, 223-224, 298, 338, 348, 484, 616, 644, 659, 868, 949)

- **Hold length.** Line 88-90: "A seat is held from the moment checkout starts until the payment completes or the payment page expires." The page expires at 30 minutes (lines 60, 517). Line 223: "when A's hold ends, 35 minutes after it began."
- **Hold start.** "from the moment checkout starts" (88), "from the moment they press pay" (213), "has started paying" (40). The reader cannot tell whether "pay" is the button on Elevate's checkout page or on Stripe's payment page.
- **85 days.** Line 298 applies it to the class: "it is released 85 days after its earliest payment". Lines 644 and 659 apply it to each payment: "no payment is held past 85 days". Line 348 gives the reason as "Stripe's limit", but line 182 says "Stripe's 90-day limit".
- **82 days.** Line 616: "whose last block ends within 82 days of the learner's payment". The number is explained nowhere, and 82 plus the 7-day wait is 89, past the 85-day limit.
- **75 days.** Lines 338 and 868 give no starting point: "a class that ends within 75 days". Line 484 has it: "of now". Line 949 restates the limit as a class length: "classes longer than about ten weeks".

Rewrites:

- 88-90: "A seat is held from the moment the learner presses the pay button on Elevate's checkout page until the payment completes or 35 minutes pass. The Stripe payment page expires after 30 minutes, so the hold outlasts it by 5."
- 298: "If nobody does, each of its payments is released when it is 85 days old, and the Support payouts page flags it."
- 348 reason: "Drafting: Stripe's 90-day limit, less 5 days of margin."
- 616: "…and whose last block ends within 78 days of the learner's payment (the 85-day limit less the 7-day wait)." The author must confirm the number.
- 868: "A seat can be sold only when the class's last block ends within 75 days of the sale."
- 949: "…for classes whose last block ends more than 75 days after a seat is bought".

#### 3. Major: "seat" has three meanings, and "hold" is used for owning a seat (lines 39-40, 42, 88, 341, 399, 403, 495-496, 514-515, 786)

- Any class enrollment: line 39 "In the data it is a class enrollment"; line 495 "the signed-in learner's seats … each with the class, the enrollment and its status".
- Only an active enrollment: line 399 "`active` | A seat."
- A unit of capacity: line 88 "A class never has more learners than seats"; line 208 "seats left".
- Line 341: "A learner may hold seats in two classes of one course." Lines 514-515 end "the learner's other holds for classes of the same course", so in the word list's sense a learner can never have two holds in one course. Here "hold" means "own".
- "Held" is defined for money only (line 42) but is used for seats (74, 88, 213) and for a class (655, "leave it held").

Rewrites:

- Word list: "Seat: one learner's paid place in a class. In the data it is a class enrollment with status `active`." / "Places: the number of seats a class can sell." / "Seat hold: a place reserved for a learner from the start of checkout until they pay or 35 minutes pass. In the data it is a class enrollment with status `pending_payment` and `seat_held_until` in the future."
- 88: "A class never sells more seats than it has places."
- 341 and 786: "A learner may own seats in two classes of one course."
- 655: "…set `review_needed_at` and do not release it."

#### 4. Major: "the fee" names three amounts, and "net fee" a fourth (lines 48-49, 192, 271, 315, 333, 550-552, 568-569, 577-578, 587, 945)

- Stripe's fee (F): line 271 "the teacher bearing the fee"; line 315 "Elevate bearing the fee".
- Elevate's application fee (C + F): line 550 "Elevate's application fee is C + F"; line 552 "returned from Elevate's fee"; line 569 "Elevate's fee kept"; line 577-578 "a full refund with the fee refunded".
- Commission (C): line 49.
- The seat's price: line 192 "a learner paying the net fee".

"Elevate's fee" and "application fee" are not in the word list. Line 577-578 uses "the fee" for the application fee two lines after sentences where it means Stripe's fee.

Rewrites:

- Add to the word list: "Commission: Elevate's cut of a payment." / "Application fee: what Elevate collects from each payment, equal to the commission plus Stripe's fee."
- 271: "the teacher bearing Stripe's fee."
- 569: "with the transfer reversed and the application fee kept".
- 577-578: "the two Stripe calls are one: a full refund that also refunds the whole application fee".
- 192 and 333: "a learner paying the price less the subsidy".

#### 5. Major: one party has five names, and "teacher" is never defined (lines 41, 85, 100, 111, 188, 243, 449, 510, 650, 811, 819, 821)

- "an opted-in profile" (85), "An opted-in teacher" (100), "each opted-in payout account" (650), "one row per teacher per run" (449, a table keyed by `payout_account_id`).
- "the teacher bears Stripe's fee" (111) against "the teaching profile decides" (243).
- "when a provider cancels" (188, 811).
- Line 821 "A teacher who falls ill could not close their own class": here "teacher" is the person who cancels, which lines 110 and 328 say is the owner or a manager.
- Line 819: the row is about "The instructor", and its reason says "A writer, who cannot see earnings today". "Writer" is not defined.
- Line 510: "the profile's owner or a member". "Member" is not defined.

Rewrites:

- Add to the word list: "Teacher: the teaching profile as the party that sells a class and is paid for it. People act for it as owner, manager or instructor."
- Use "teacher" for money and "owner", "manager" or "instructor" for a person's action.
- 650: "For each opted-in teacher's payout account".
- 188: "when a teacher cancels".
- 819: "An instructor, who cannot see earnings today, could give away the profile's revenue." If "writer" is the role an instructor holds, say so.
- 821: "An owner who falls ill".

#### 6. Major: "release" and "run" are defined, then used in ordinary senses (lines 13, 16, 43-44, 64, 96-97, 250, 334, 383, 405, 646, 785, 786, 832, 838, 857)

- Release is defined as "The point at which a class's money stops being held". It is also used for a seat hold (405 "no job releases it"; 785 "A job that releases expired holds") and for a software release (16 "one per release"; 97 "installed before this release"; 857 "the release to real learners").
- Run is defined as "One execution of the release job". It is also used for a class (13 "one run of a course at fixed dates"; 786 "book two runs"; 832 "A class sold and never run").
- The job has five names: "release job" (44), "release task" (383), "release program" (646), "the job" (250, 582), "A scheduled one-off task" (334).

Rewrites:

- 405: "so a hold ends by the clock and no job ends it."
- 785: "A job that ends expired holds".
- 16: "three designs, one per version shipped".
- 97: "an app installed before this version".
- 857: "selling to real learners waits for a lawyer's read."
- 13: "classes: one teaching of a course at fixed dates".
- 786: "A learner may book two classes of one course".
- 832: "A class sold and never taught".
- 646: "The release job is the program `dist/release.js`. One run does this:". Use "release job" everywhere else.

#### 7. Major: the held-total check and the payout formula need two readings (lines 296, 549, 655, 662-665, 668-672)

- Line 662-665: "add up the teacher's share, after refunds, of class payments that are 85 days old or less and whose class is not due, or is under review, or which have an open dispute." The reader cannot tell whether "85 days old or less" applies to all three cases.
- Line 670-672: "available A and pending P, and work out the payout as the smaller of A and A + P − held, and never below zero." "A" already means the amount paid (line 549).
- One state has three names: "needs review" (296), "is not cleared" (655), "under review" (664).

Rewrites:

- 662-665: "**Total by calendar.** Without reading `released_run_id`, add up the teacher's share, after refunds, of each class payment that is 85 days old or less and meets at least one of these: its class is not due; its class is under review; the payment has an open dispute."
- 670-672: "Read the teacher's Stripe balance: the available amount V and the pending amount P. The payout is V + P − held, or V if that is smaller, or zero if the result is negative."
- 655: "if it has no check-in and no manual mark for any block, and no Support admin has cleared its review, set `review_needed_at`…". Use "under review" for the state throughout.

#### 8. Major: the words for ending a seat conflict, and passives hide who acts (lines 69, 131-132, 307-308, 336, 400-401, 562, 573-574, 811, 849)

- Line 401: "`cancelled` | The learner withdrew." The word list separates Cancel (a class ends for everyone) from Withdraw. A cancelled class sets enrollments to `refunded`, and a withdrawal sets `cancelled`. The table does not warn the reader.
- Line 573-574: "set the enrollment's status by the table above". The table above (554-559) has no status column. The status table (396-401) does not list `discretionary` or `learner_withdrew`. The reader cannot tell what a discretionary refund does to the enrollment.
- Line 69 "whoever ends a seat bears that fee" against line 849 "whoever cancels bears the fee". The second leaves out withdrawal.
- "A cancelled seat" (562, 811) applies Cancel to a seat.
- Line 131-132: "the teacher's share for that seat is taken back and the seat is closed". It does not say who takes it back, and "closed" is used only here and at 308.

Rewrites:

- 401: "`cancelled` | The learner withdrew (kind `learner_withdrew`). This is the existing status name; it does not mean the class was cancelled."
- 573-574: "set the enrollment's status: `cancelled` for `learner_withdrew`; `refunded` for `teacher_cancelled`, `moved_withdrew`, `elevate_cancelled`, `seat_lost` and `dispute_lost`; [state the rule for `discretionary`]."
- 849: "The 'whoever ends a seat bears Stripe's fee' rule".
- 562: "A seat in a class the teacher cancelled returns S$500".
- 131-132: "If the learner wins, Elevate reverses the transfer of the teacher's share for that seat and sets the enrollment to `refunded`, which frees the seat."

#### 9. Major: "Drafting" has two definitions (lines 29-31, 772-773, 786, 804, 825)

- Line 30-31: "An AI assistant drafts the text and makes the mechanical choices, which the Technical Plan marks "Drafting"."
- Line 772-773: ""Drafting" is a choice the author made at a question while this design was drafted."

Under the first, a "Drafting" row is the assistant's choice. Under the second, it is the author's. The Alternatives tables use both "Drafting" alone (786, 804, 825) and "Drafting, rejected by author", and the second definition does not separate them.

Rewrite (772-773): ""Drafting, rejected by author" is a choice the author made when asked during drafting. "Drafting" alone is a mechanical choice the AI assistant made; the decisions table marks the same choices "Drafting"." Relabelling the assistant's rows "Assistant" in both tables would be clearer.

#### 10. Major: three goals state a rule without the exception given later (lines 107-109, 133-134, 139-140)

- Line 107-108: "A wrong held total cannot pay money out. Each run works out the held total by two independent routes." Line 678 says "The two totals share the payment rows and the fee arithmetic". Line 851 says "A payment missing from both routes is not caught."
- Line 133-134: "A class with no recorded attendance is not released until Support has looked at it." Line 297-298: "If nobody does, it is released 85 days after its earliest payment".
- Line 139-140: "The first deploy that sells classes is safe to roll back to Part 1's version". Line 919-920: "safe only with `CLASS_SALES` off first".

Editorial action: CALIBRATE each goal to what the plan does.

Rewrites:

- 107-109: "**A held total wrong in its release marks cannot pay money out.** Each run works out the held total twice, once from the marks and once from dates and states. If the two differ for a teacher, the run pays that teacher nothing and shows the difference to Support. A payment missing from both totals is not caught."
- 133-134: "**A class with no recorded attendance is not released** until a Support admin has cleared it, or until its payments are 85 days old."
- 139-140: "**The first deploy that sells classes can be rolled back to Part 1's version** once `CLASS_SALES` is turned off…"

#### 11. Major: names with no definition, and steps the reader cannot carry out (lines 82, 142-143, 157, 178-179, 184-185, 187, 191, 466, 485, 584-585, 849, 908-912)

- "Phase 4" (178, 585, 849): "before Phase 4 of the plan". No phases are defined in lines 1-955. If they are defined after line 955, point to that section at first use.
- "SSG" (157, 187, 191) is never expanded.
- "payable" (466, 485): "requires the payout account to be payable" has no definition.
- "coordinates" (142-143) are not said to be the location recorded at check-in.
- Line 184-185 uses "task definition" and "revision" 500 lines before "Scheduling" explains them.
- Line 910-911: "Copy the GitHub variables." does not say which variables, from where or to where. "Opt one profile in on staging and rehearse." does not say what is rehearsed or who does it.
- Line 82: "The Verification Plan will map each one" refers to a section that lines 1-955 do not contain.

Rewrites:

- 178: "A test in a Stripe sandbox must pass before the build phase that adds refunds (Phase 4 in [section name])."
- 157: "No claim on SkillsFuture Singapore (SSG), the government body that funds course subsidies, and no subsidy at checkout."
- 466: "it requires the payout account to be payable, meaning Stripe has enabled charges and payouts on it [confirm]".
- 142: "one learner's check-in location coordinates can be erased by a Support admin, with an audit entry".
- 910-912: "The deployer copies [named variables] from [source] to [destination], deploys with `CLASS_SALES` off, and enables the schedule. On staging, the author opts one profile in and runs CUJs 1 to 13. Only then does the deployer turn `CLASSES` and `CLASS_SALES` on in production."

#### 12. Nit: table cells too terse to read without the prose (lines 326, 331, 337, 339, 340, 436, 445, 456, 834)

- Line 331: "The core controls and the release checks." Neither term is defined in the document; line 360 only points to "the RFC's own list".
- Lines 326 and 337: "until some days before the first block", and eleven rows later "The number of days before the first block | 7." The second row does not say which days.
- Line 339: "Drafting: after release the balance may be empty."
- Line 340: "Drafting: the change was the profile's."
- Line 436: "Restrict on delete."
- Line 445: `by_elevate` and `after_start` are unexplained.
- Line 456: `nothing_due`, `below_minimum` and `failed` are unexplained.
- Line 834: "RFC proposal, superseded".

Rewrites:

- 331: "The RFC's core controls ([name them]) plus two release checks: a class with no attendance waits for Support, and a disputed payment stays held. No ceiling on price times seats."
- 326: "A learner who has not attended can withdraw until 7 days before the first block, refunded less Stripe's fee. The author chose the rule; the assistant chose 7." Delete row 337.
- 339: "Drafting: after release the teacher's Stripe balance may not cover a refund."
- 340: "Drafting: the profile made the change, so the profile bears Stripe's fee."
- 436: "A row here blocks deletion of the enrollment, payment or class it points to."
- 456: add one clause per outcome, for example "`below_minimum`: the payout worked out to less than S$1".
- 834: "Proposed in the RFC; replaced by the author's later decision."
