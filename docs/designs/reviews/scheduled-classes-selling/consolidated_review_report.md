# Consolidated Review Report: Scheduled Classes, Part 2 (Selling a Class)

- **Target:** `docs/designs/scheduled-classes-selling.md` at commit `7f9cb68`
  (design: lines 1-955; implementation plan: lines 956-2016)
- **Mode:** consolidated report, all five stages, no fixes between stages
- **Reading list given to reviewers:** `AGENTS.md`, the RFC, the Part 1 design,
  ADR 003, ADR 007, ADR 010 and `infra/README.md`. The comprehension reviewer
  read the target alone.
- **Date:** 2026-11-24

## Verdict

The design is not ready to build, and it should not be fixed finding by
finding.

Ten reviewer runs returned 109 findings: 11 Blockers, 90 Majors and 8 Nits.
After removing repeats they come to 10 Blockers, 20 Majors and 4 Nits. Most of
them trace to four choices in the design, and two of those four are decisions
the document records as the author's. Fixing each finding the way its reviewer
suggests would make the design larger: the Stage 7 fixes add about 25 checks,
states and Support actions, while the Stage 5 cuts remove four features, and
several fixes patch features that another reviewer would cut.

So the next step is not editing. It is three things in order: answer the
Stripe questions the design rests on; put four decisions back to the author
with the facts the reviews found; then rewrite for a smaller first release.

## Reviewers

| Stage | Reviewer                       | Range     | Blocker | Major | Nit | Status    |
| ----- | ------------------------------ | --------- | ------- | ----- | --- | --------- |
| 5     | `egm-zoom-out`                 | Full file | 1       | 8     | 1   | completed |
| 5     | `egm-inventive-catalyst`       | Full file | 0       | 5     | 1   | completed |
| 6     | `egm-comprehension`            | Full file | 0       | 11    | 1   | completed |
| 7     | `egm-design`                   | 1-955     | 4       | 8     | 0   | completed |
| 7     | `egm-structural`               | 1-955     | 0       | 9     | 1   | completed |
| 7     | `egm-style`                    | 1-955     | 0       | 11    | 1   | completed |
| 8     | `egm-zoom-out`                 | Full file | 1       | 5     | 1   | completed |
| 9     | `egm-implementation-readiness` | 956-2016  | 3       | 11    | 0   | completed |
| 9     | `egm-codebase-details`         | 956-2016  | 2       | 11    | 1   | completed |
| 9     | `egm-style`                    | 956-2016  | 0       | 11    | 1   | completed |

The full text of each report is beside this file: `zoom_out_report.md`,
`comprehension_report.md`, `critic_report.md`,
`intermediate_zoom_out_report.md` and `implementation_readiness_report.md`.

**What was checked after the reviewers reported.** Seven code claims were
re-checked by hand and all seven hold: `PayoutView` is already exported from
`contracts/teach.ts`; the per-email sign-in limit already exists in
`auth.service.ts`; Part 1's guard test forbids setting `classId` on an
enrollment; `netAfterRefunds` is pro-rata; `applyRefund` leaves the enrollment
alone unless the payment is fully refunded; `syncSession` answers "paid" for
every outcome but one; and `markProcessed` sets the processed time on failure
too. `stripe.ts` sets no `on_behalf_of` and no statement descriptor.

**What was not checked.** No reviewer could reach Stripe or AWS. Every
statement about their behaviour is from memory of the documentation and is
marked "confirm" in the reports.

## The four choices behind most findings

Stage 8 grouped the findings by cause. The grouping holds up against the
individual reports.

| Choice                                                                                                                                   | Recorded as       | Findings it produces       |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------- |
| **A.** Class money waits in the teacher's own Stripe account, behind a payout switch that covers the whole account.                      | Author (RFC)      | B1, B2, B4, B5, M6, M7, M8 |
| **B.** The fee owed by whoever ends a seat is collected inside the Stripe refund, against a balance Elevate cannot debit.                | Author (RFC)      | B1, B6, B7, B8, M2, M5     |
| **C.** Attendance decides refunds and release, including when the teacher cancels, and the teacher writes and rules on the record.       | Author (drafting) | M4, M13                    |
| **D.** One release carries seven refund kinds, moving, dispute automation, a review state, opt-out and four items left over from Part 1. | Mixed             | B6, M1, M9, M10            |

Not explained by any of the four, and needed whatever shape the design takes:
B3, B9, B10, M3, M11 and the writing findings.

## Blockers

### B1. The design rests on Stripe behaviour nobody has tested

- **Sources:** Zoom Out 1; Design 5, 10; Stage 8 finding 2; Readiness 12;
  Structure 6.
- **What is unknown:**
  - whether a refund with the transfer reversed and Elevate's fee kept can be
    followed by a part refund of that fee;
  - what Stripe does when a reversal is larger than the teacher's available
    balance, or draws on pending money;
  - how the 90 days are counted, and what Stripe does at the limit;
  - whether a teacher can change the payout schedule, or start a payout, from
    their own Stripe dashboard. If they can, the hold is not a control;
  - which API call switches these accounts to manual payouts on the installed
    SDK (`stripe` 23.1.0). The plan leaves that choice to the engineer;
  - whether the transfer on a destination charge is the full amount with the
    fee taken back. If so, the first refund step leaves the teacher short by
    the whole application fee (S$89.88 on S$500), not by Stripe's fee alone.
- **Why it blocks:** the plan schedules the test before Phase 4, after three
  phases have built tables, arithmetic and a test double around the untested
  sequence. The design's own fallback "would break the goal".
- **Action:** run one sandbox session that answers all six before the document
  is rewritten. It needs Stripe test-mode keys.

### B2. The reason recorded for rejecting platform-held money describes today's model

- **Sources:** Stage 8 finding 1; Inventive 1.
- **What is wrong:** the design rejects charging class sales to Elevate and
  transferring at release because "Elevate would become the seller on the card
  statement and own every refund and dispute". The code sets no
  `on_behalf_of`, sets `losses: { payments: 'application' }`, and refunds from
  the platform. Under Stripe's rules for destination charges (confirm), Elevate
  is already the seller on the statement and already owns refunds and
  disputes.
- **Why it blocks:** choice A produces four other Blockers. The option that
  removes it was turned down for a reason that does not hold. Its real costs
  are different: Elevate would hold money owed to teachers (a licensing
  question), the teacher would see held money only in Teach, and ADR 003 would
  become two payment models. Three Stripe facts for that shape are also
  unverified.
- **Action:** correct the alternative's row, add the three questions to the
  sandbox session, and put the choice back to the author. This is decision 1
  below.

### B3. A payment that lands after the class changed becomes a seat nobody refunds

- **Sources:** Design 1; Readiness 7; Code 5.
- **Scenario:** a learner is on the payment page; the owner cancels the class;
  the learner pays. Fulfilment finds "a seat is still free", because every
  seat now is, and activates the learner in a cancelled class. No refund row
  exists for them. If the class had earlier attendance, it is released and the
  money goes to the teacher.
- **Same gap:** a payment landing after the first block starts, or after the
  profile opts out. Also, `syncSession` reports a lost seat as "paid", so the
  confirmation page would say "Your seat is booked"; and the existing
  duplicate-payment paths (`refundDuplicate`, `retryDuplicateRefund`) can
  refund a class payment outside the new refund service.
- **Action:** fulfilment re-checks the class under its lock and lists every
  branch with the row written and the outcome returned. Cancel and opt-out
  expire open payment pages. Add a "seat lost" outcome to the sync answer and
  the confirmation page.

### B4. The payout formula pays out held money for a class payment the database does not know about

- **Sources:** Design 2; Inventive 5.
- **Scenario:** the payout is the balance less the held total, and the held
  total comes only from payment rows. A payment row is written at fulfilment.
  A payment that Stripe has and the database does not, for seconds or for
  ever, raises the balance without raising the held total. ADR 007 describes
  how a paid session can write no payment.
- **Note:** Stage 8 judges the seconds-long race narrow, because it needs a
  payment just before the one paying run of the day. The permanent case
  justifies the severity.
- **Action:** depends on decisions 1 and 4. If the job stays, the payout must
  be bounded by money the database can name, or the second total must come
  from Stripe's transfers.

### B5. The two held totals disagree by design, and a mismatch has no way out

- **Sources:** Design 3; Zoom Out 3; Stage 8 finding 6; Comprehension 5.
- **Cases that mismatch with no fault present:** a dispute opened after
  release; a dispute won after release; a learner moved out of a released
  class; a block edited later after release.
- **Cost:** a mismatch pays that teacher nothing, self-paced money included,
  and blocks the 85-day forced release. No action is designed to clear one.
- **Also:** both totals read the same rows with the same arithmetic in the
  same run, so they catch little beyond a failed write. The goal says "two
  independent routes"; the body says they share the rows.
- **Action:** decision 4 below. The second total was the author's addition, so
  the replacement is the author's choice.

### B6. A class is released while its refunds are unsent, and a refund that cannot succeed never ends

- **Sources:** Design 4; Readiness 4; Plan writing 3.
- **What is wrong:** the release step checks attendance and disputes, not
  unfinished refund rows. The status `failed` is listed and never defined: the
  plan can be read as "a failed row is never retried" or as "nothing ever sets
  failed". No entry names what calls `executePending()`.
- **Scenario:** a cancellation's refund is refused because the charge is
  disputed or the reversal exceeds the balance. It is retried every 15 minutes.
  On day 7 the class is released and paid to the teacher with the learner
  still unrefunded.
- **Action:** never release a payment with an unfinished refund row or a class
  whose cancellation is incomplete. Define `failed`: when, who sees it, how it
  is retried. Say what happens to a refund for a seat with an open dispute.

### B7. A seat refund is recorded twice, and `applyRefund` cannot do what the plan asks of it

- **Sources:** Readiness 3; Code 2, 3; Comprehension 2; Structure 5; Plan
  writing 5.
- **What is wrong:**
  - Stripe sends `charge.refunded` for refunds the API makes. The webhook will
    often record the refund before the executor's last step, with the
    self-paced refund email. The learner then gets two emails, and the plan
    does not say what the executor does when its own call reports "already
    recorded".
  - `applyRefund` opens its own transaction, so "record the refund, set the
    status and mark the row done together" cannot be done by calling it.
  - It touches the enrollment only on a full refund. A withdrawal refunds the
    amount less the fee, so `cancelled` is never set by that route.
  - It has no "leave the enrollment alone" value, which a full discretionary
    refund needs.
  - A lost dispute has no Stripe refund id, and the refunds table requires a
    unique one.
  - "Refund row" means a `seat_refunds` row in some entries and a `refunds`
    row in others.
- **Action:** tag the executor's Stripe refunds and have the webhook skip
  them; give `applyRefund` an optional transaction and an explicit enrollment
  outcome; say what a lost dispute records; add one table giving the
  enrollment status after each of the seven kinds, and after a part refund.

### B8. "The teacher's share after refunds" has no formula, and the one in the code is wrong for the new refunds

- **Sources:** Readiness 2; Code 4.
- **What is wrong:** every payout depends on this number and no entry defines
  it. The only such function, `netAfterRefunds`, is pro-rata. On the S$500
  example it gives S$14.35 for a withdrawn seat where the refund table says 0,
  and 0 for a teacher-cancelled seat where the table says −S$17.50. Both held
  totals would share the error, so the mismatch check would not catch it. The
  Teach earnings page uses the same function.
- **Action:** one named function in `money.ts`, with its rule per refund kind
  and whether a negative share lowers the held total. Use it for the held
  total and for earnings on class payments.

### B9. Phases 3, 4 and 5 cannot pass their own end check

- **Source:** Readiness 1.
- **What is wrong:** Part 1's `class-guards.test.ts` fails if any file sets
  `classId` on an enrollment. Phase 3 does that in class checkout and Phase 4
  does it in a move. The guard is relaxed only in entry 6.4.
- **Action:** move the guard change into Phase 3 and extend it in Phase 4.

### B10. The new type `PayoutView` collides with an existing export

- **Source:** Code 1.
- **What is wrong:** `contracts/teach.ts` already exports `PayoutView`, the
  payout account view. A second export fails typecheck in Phase 1, and inside
  `teach.ts` the name would resolve to the wrong type without an error.
- **Action:** rename the new type in entries 1.12, 5.6 and 8.6.

## Majors

| ID  | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                         | Sources                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| M1  | **Nothing limits a seat to one open refund.** A learner can withdraw in the minutes between a cancellation and its refunds, and loses the fee they were promised. Two people granting the same discretionary refund both succeed. Support's refund can race a pending row.                                                                                                                                                                      | Design 6; Readiness 4                                               |
| M2  | **Resumption relies on Stripe idempotency keys, which expire after about a day (confirm).** A stopped job replays a part refund as a new one. The payout key uses a new row id per run, so it protects nothing across runs. Rows are not claimed, so the request and the job can run the same row. The payout step's write order is not given.                                                                                                  | Design 7; Readiness 6                                               |
| M3  | **The seat guarantee has holes outside the locked count.** A learner who paid inside the hold but was fulfilled late loses the seat. Delayed payment methods are not excluded. Each new checkout renews a hold with no limit. Seats can be lowered below seats taken. A move into a class where the learner has an old row breaks a unique index.                                                                                               | Design 8; Code 10; Comprehension 11; Inventive 6                    |
| M4  | **The record that locks a refund and unlocks a release is written by the party it pays.** An instructor can mark every learner present by hand and cancel; disputes of those marks are decided by the same profile. One manual mark defeats the no-attendance review. Block dates can be edited after sale to close withdrawal or pass the day limit.                                                                                           | Design 9; Inventive 2; Zoom Out 8; Comprehension 4                  |
| M5  | **The refund arithmetic is under-defined.** Elevate's fee is built from an estimate of Stripe's fee, so Elevate's net is negative on costlier cards. The actual fee can be null. "Scales to what remains" has two readings. Rounding is not stated. `dispute_lost` has no row. The commission rate appears nowhere.                                                                                                                             | Design 5; Readiness 5; Comprehension 6; Plan writing 8; Inventive 4 |
| M6  | **The day limits do not connect.** 85 is called Stripe's limit when Stripe's is 90. 82 has no stated origin. A move to a class ending on day 82 is due on day 89, after the forced release. The forced release is per class in one place and per payment in another, and its reason is stored only on the class.                                                                                                                                | Comprehension 3; Structure 4; Style 2; Design 10; Inventive 3       |
| M7  | **The stated ways back either stop paying teachers or pay out everything held.** Switching an account to automatic pays out held class money. A code rollback leaves the schedule running an image with no release program. A crash between the Stripe switch and the recorded acceptance leaves an account nothing pays. Each Terraform apply registers a placeholder-image revision that an unpinned schedule would run.                      | Design 11; Code 8                                                   |
| M8  | **A 15-minute job for a once-a-day payout, with nobody told when it stops.** 95 of 96 runs write a row per teacher and pay nothing. The outcomes `nothing_due` and `failed` appear in no step. The performance note says one balance read a day; the steps read it every run.                                                                                                                                                                   | Zoom Out 4; Structure 9; Style 7                                    |
| M9  | **There is no first slice.** Nothing can be sold until all eleven phases are built. Moving, dispute automation, the review state, opt-out, Elevate's own cancellation, the four readiness items and the "room for grant money" section can each be cut or deferred. No size is stated for the beta, and by-hand options are rejected without one.                                                                                               | Zoom Out 2, 6, 7, 9, 10; Stage 8 findings 3, 4, 7; Comprehension 10 |
| M10 | **Two changes to the live payment path are not behind `CLASS_SALES`.** The refund-id change and the webhook retry apply to every self-paced payment and have no goal, risk or rollback. `record` is shared with the Mux route, and a failed event cannot be told from a handled one. The new Stripe events are never subscribed to: two runbooks are missing from the plan.                                                                     | Structure 7; Stage 8 finding 5; Readiness 11; Code 6, 11            |
| M11 | **Security and privacy gaps.** Cancelling and refunding need no recent sign-in, though cancelling is irreversible and every manager can do it. The public course answer gains each class's venue address and times. Erased coordinates stay in 35 days of backups, and the procedure does not say so.                                                                                                                                           | Design 12                                                           |
| M12 | **Several goals are stated more strongly than the body.** "Never more learners than seats", "a wrong held total cannot pay money out", "a class with no attendance is not released", "safe to roll back" and "every refund path frees the seat" each have an exception later in the text. "Refund terms shown before paying" has no mechanism.                                                                                                  | Structure 8; Style 10                                               |
| M13 | **The attendance lock contradicts Elevate's own cancellation.** Two goals conflict as written; the rule that Elevate refunds attended learners has no decision row and no user journey.                                                                                                                                                                                                                                                         | Structure 3; Style 1                                                |
| M14 | **The decision record is unreliable.** "Drafting" is defined as the assistant's choice in one place and the author's in another, so about 17 decisions have no clear decider, some of them money rules. Ten alternatives are rejected on preference with no trade-off. An open question is treated as settled in Risks. The rollout order omits the lawyer, the sandbox test and the Chinese sign-off. The RFC's licensing question is missing. | Structure 1, 2, 6; Style 9; Comprehension 12                        |
| M15 | **The word list is not honoured.** "Seat", "hold", "release", "run", "cancel" and "fee" each carry a second meaning. One party is called teacher, profile, payout account and provider. "Block", "attended", the roles and "payable" depend on Part 1's list. "The core controls" is never defined. The job has five names.                                                                                                                     | Comprehension 1, 9; Style 3, 4, 5, 6, 8, 11; Plan writing 10        |
| M16 | **The plan has screens with no data source.** `contracts/classes.ts` is in no entry, though its status schema and `LearnerClass` must change. The class checkout page cannot get the class from a quote that requires `courseId`. No endpoint lists move targets. Support's transaction detail is not extended. Filling `viewer` from a seat would send older apps to the self-paced course.                                                    | Readiness 8, 9; Code 9                                              |
| M17 | **New tables and response types are named, not specified.** Column types, nullability and delete rules are left out. Class checkout "reuses" helpers that are private or inline, and misses the existing below-minimum check.                                                                                                                                                                                                                   | Readiness 10, 12; Code 12                                           |
| M18 | **Phase 10 and the verification steps cannot be followed.** Entry 10.8 applies to AWS inside a phase that applies nothing, and is done after the deploy it decides. The local walkthrough cancels a class with no paid seat, and the release program runs as a second process against a fake that keeps its state in memory.                                                                                                                    | Comprehension 7, 8; Plan writing 1, 2, 9; Readiness 13, 14; Code 13 |
| M19 | **The per-email sign-in limit already exists.** `AuthService` refuses a sixth request per email in 15 minutes, counted in the database, with a test. Entry 6.1 reduces to changing one number.                                                                                                                                                                                                                                                  | Code 7                                                              |
| M20 | **Plan entries with two readings.** Entry 4.8 uses one error code for five conditions and none for the 82-day refusal. Entry 3.5 does not say whether a lost seat gets a receipt. Entry 5.7 does not say which route needs an admin. About a dozen "Why" lines restate the change or cite the author.                                                                                                                                           | Plan writing 4, 6, 7, 11                                            |

## Nits

| ID  | Finding                                                                                               | Sources         |
| --- | ----------------------------------------------------------------------------------------------------- | --------------- |
| N1  | Entry 3.11 names the `owner` marker; the Stripe link routes use `capability: 'stripe.links'`.         | Code 14         |
| N2  | Entry headings that do not match the entry (7.4 lists a file it does not change; 10.8 is not a file). | Plan writing 12 |
| N3  | Table cells too terse to read without the prose.                                                      | Style 12        |
| N4  | The data model omits the move columns; Open Questions cites a section name that does not exist.       | Structure 10    |

## Where reviewers disagree, and where a finding is not accepted

- **Cut the attendance review, or strengthen it.** Zoom Out 8 cuts it; Design
  9 and Inventive 2 add a second meaning of "attended" and a deferred refund.
  Stage 8 says neither suits a first release and a person looking before
  release is cheaper than both. This is decision 3.
- **Dispute automation.** Zoom Out 7 handles disputes by hand; Design 3 and 4
  extend automation to late disputes. They cannot both be applied.
- **Opt-out.** Zoom Out 10 drops the route in favour of the by-hand procedure;
  Design 11 shows that procedure pays out everything held. With both applied
  an opted-in profile has no way out.
- **Three replacements for the second total.** An existing after-the-fact
  report (Zoom Out 3), a gate from Stripe's transfers (Design 2), and a
  three-way minimum with a paid-out mark on every payment (Inventive 5).
- **A fixed 31-day payout delay with a 24-day sale window (Zoom Out 5).** Not
  accepted as a change. It would hold self-paced money too, which reverses the
  author's decision that self-paced payouts are not held. It belongs in the
  alternatives table with that cost.
- **"There is no migration task definition" (Code 13).** Not accepted as
  written. Part 1's plan creates `aws_ecs_task_definition.migrate` in its Phase
  6, which this plan lists as a prerequisite. The reviewer was not told that
  Part 1's infrastructure is unbuilt. The parts that stand: the deploy role
  needs `ecs:RunTask` on the release family, and the entry should name Part
  1's entry.
- **"The plan names files that do not exist" (Zoom Out 9).** True and
  expected: the plan states that Part 1 must be built first. The useful half
  is the order of work: the file-level plan should be written after the shape
  is settled.
- **A linked record for each author decision (Structure 2).** Cannot be met
  for decisions made in a drafting session. The half that stands is that each
  rejection needs a concrete trade-off.
- **Rewrites of the day limits, the review goal and the move rules.** Wait
  until decisions 1 and 2 are made; several of those passages may be deleted.

## Decisions for the author, in order

1. **Where class money sits.** Keep it in the teacher's Stripe account with
   manual payouts, or charge class sales to Elevate and transfer at release.
   The second removes choices A and B and with them B4, B5, the day limits,
   the payout engine and the untested refund sequence. It costs a licensing
   question, a teacher's view of held money in Teach only, and two payment
   models. It needs three more Stripe facts. This reverses a decision recorded
   in the RFC.
2. **The size of the first release.** State the expected number of teachers,
   classes and cancellations for the beta, then decide the cut list: moving,
   dispute automation, the review state, opt-out, Elevate's own cancellation,
   the readiness items.
3. **Attendance as money evidence when the teacher cancels.** Keep the lock as
   it is; count only learner check-ins and undisputed marks; send a
   mid-class cancellation to Support; or refund in proportion to blocks not
   taught.
4. **The second held total.** Keep it with its false mismatches fixed, or
   replace it with a check against Stripe. Moot if decision 1 changes.
5. **Where a cancellation's refunds run, and how often the job runs.** Daily
   or hourly, with one alarm that reaches a person.

## Order of work

1. Run the Stripe sandbox session (B1, plus the three questions in B2). Put
   the licensing question to the lawyer for both shapes.
2. The author takes decisions 1 to 5.
3. Fix what survives any shape: B3, B9, B10, M1, M2, M3, M11.
4. Ship the two live-path fixes (M10) and the readiness items as their own
   small changes, verified on self-paced sales.
5. Rewrite the design text and word list for the first slice, then the plan.
6. Re-review the rewritten document. This review allows one re-audit per
   stage.

## After the review: the Stripe test session (2026-11-24)

Step 1 of the order of work was run the same day. The full results are in
`stripe_sandbox_results.md`. What it settles:

| Item | Before                                                       | After                                                                                                                                                                       |
| ---- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1   | The refund sequence was untested.                            | It works, in either order, and the amounts match the design's table.                                                                                                        |
| B1   | A reversal larger than the balance was unknown.              | It succeeds and the teacher's balance goes negative. Elevate carries it through a reserve on its own balance.                                                               |
| B1   | Whether a teacher can pay themselves out was unknown.        | They can from the Express dashboard, unless the platform turns off "Edit payout schedule" and "Manual payouts".                                                             |
| B1   | The call for manual payouts was left to the engineer.        | `POST /v1/accounts/{id}` with `settings[payouts][schedule][interval]=manual` works on the pinned version and is not deprecated.                                             |
| B1   | The 90-day count and what happens at the limit.              | Still open. The documentation does not say.                                                                                                                                 |
| B2   | Who the seller is today rested on a reading of the code.     | Confirmed by test and by documentation: the platform is the business of record and bears disputes. Charging on the platform and transferring later also works in Singapore. |
| B5   | "Disputes usually arrive after release" was unconfirmed.     | The window is about 120 days, counted from the class date for a later service. Release is 7 days after the class.                                                           |
| B6   | A refund on a disputed charge was said to be refused.        | Confirmed: `charge_disputed`, while open and after a loss.                                                                                                                  |
| M3   | The fix "pin class checkout to immediate methods".           | `payment_method_types` is refused on the pinned version. Another mechanism is needed.                                                                                       |
| M5   | The estimate inside Elevate's fee against Stripe's real fee. | Confirmed on a foreign card: S$20.00 against S$17.50. The real fee also arrives a few seconds after the payment succeeds.                                                   |

Payouts themselves could not be tested: Stripe requires a liveness check on a
Singapore account before it enables them.

## Traceability

Each raw finding maps to one consolidated item, or to the "not accepted"
list (marked NA).

| Reviewer                | Finding → item                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Zoom Out (Stage 5)      | 1→B1; 2→M9; 3→B5; 4→M8; 5→NA; 6→M9; 7→M9; 8→M4; 9→M9; 10→M9                                                  |
| Inventive (Stage 5)     | 1→B2; 2→M4; 3→M6; 4→M5; 5→B4; 6→M3                                                                           |
| Comprehension (Stage 6) | 1→M15; 2→B7; 3→M6; 4→M4; 5→B5; 6→M5; 7→M18; 8→M18; 9→M15; 10→M9; 11→M3; 12→M14                               |
| Design (Stage 7)        | 1→B3; 2→B4; 3→B5; 4→B6; 5→M5 and B1; 6→M1; 7→M2; 8→M3; 9→M4; 10→M6 and B1; 11→M7; 12→M11                     |
| Structure (Stage 7)     | 1→M14; 2→M14; 3→M13; 4→M6; 5→B7; 6→M14 and B1; 7→M10; 8→M12; 9→M8; 10→N4                                     |
| Style (Stage 7)         | 1→M13; 2→M6; 3→M15; 4→M15; 5→M15; 6→M15; 7→M8; 8→M15; 9→M14; 10→M12; 11→M15; 12→N3                           |
| Zoom Out (Stage 8)      | 1→B2; 2→B1; 3→M9; 4→M9; 5→M10; 6→B5; 7→M9                                                                    |
| Readiness (Stage 9)     | 1→B9; 2→B8; 3→B7; 4→B6 and M1; 5→M5; 6→M2; 7→B3; 8→M16; 9→M16; 10→M17; 11→M10; 12→B1 and M17; 13→M18; 14→M18 |
| Code (Stage 9)          | 1→B10; 2→B7; 3→B7; 4→B8; 5→B3; 6→M10; 7→M19; 8→M7; 9→M16; 10→M3; 11→M10; 12→M17; 13→M18 (part NA); 14→N1     |
| Plan writing (Stage 9)  | 1→M18; 2→M18; 3→B6; 4→M20; 5→B7; 6→M20; 7→M20; 8→M5; 9→M18; 10→M15; 11→M20; 12→N2                            |
