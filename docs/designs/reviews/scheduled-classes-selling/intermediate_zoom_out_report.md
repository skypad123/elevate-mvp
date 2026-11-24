# Intermediate Zoom Out Report: Scheduled Classes, Part 2 (Selling a Class)

- **Stage:** 8 (Intermediate Zoom Out)
- **Target:** `docs/designs/scheduled-classes-selling.md`, full file
- **Reviewer:** `egm-zoom-out`, in a fresh context, given the Stage 5, 6 and 7
  reports
- **Date:** 2026-11-24

No fixes were applied between stages, so this stage judges the design's shape
in light of the earlier findings. It cites them as "Design 2", "Zoom Out 3",
"Inventive 5", "Structure 4", "Comprehension 3" and "Style 2". Statements about
Stripe marked "confirm" were not checked online.

## Intermediate Zoom Out (`egm-zoom-out`)

### Verdict

The design should not be patched finding by finding. Four of the five Blockers and about two thirds of the Majors come from two choices: class money is held in the teacher's own Stripe account under an account-wide manual-payout switch, and the cancelling party's fee is collected inside the Stripe refund call. Applying every suggested fix would make the design larger, because the Stage 7 fixes add roughly 25 checks, states and Support actions while the Stage 5 cuts remove four features. A smaller version exists that removes both root causes, but it reverses a decision the document records as the author's (Non-Goal line 161, alternative row 795). The recorded reason for that decision does not match the code. That decision, and four Stripe facts, must be settled before any other fix is worth making.

Review coverage:

- **Read:** the target lines 1-955 in full and the plan's headings; the zoom-out standard; the three stage reports; ADR 003 and ADR 007 in full; parts of the RFC brief.
- **Searched only:** `apps/api/src/providers/payments/stripe.ts`.
- **Not opened:** `AGENTS.md`, the Part 1 design, `earnings.service.ts`.
- **Unverified:** every statement about Stripe behaviour below is from memory of its documentation and is marked "confirm".

### 1. Root causes

**A. Class money sits in the teacher's Stripe account, behind a payout switch that covers the whole account** (decision row 335, Non-Goal 161). Elevate must therefore write a payout engine for all of an opted-in teacher's money, work out "held" by subtraction from a mixed balance, and live inside Stripe's 90-day limit.

- Blockers: Design 2, Design 3, and the two balance questions in Zoom Out 1.
- Majors: Zoom Out 3, 4, 5; Inventive 1, 3, 5; Design 10, 11; Comprehension 3, 5; Structure 4, 9; Style 2 (the day limits), 7, 10 (first goal).

**B. The fee owed by whoever ends a seat is collected inside the refund** (reverse the transfer, keep the application fee, part-refund it), against a balance Elevate cannot debit (line 69, lines 549-590).

- Blockers: Zoom Out 1; Design 4 (the reversal that exceeds the balance, and the undefined `failed`).
- Majors: Inventive 4; Design 5, 7; Comprehension 6; Structure 5, 6; Style 4.

**C. The attendance record decides refunds and release, including when the teacher cancels, and the teacher writes and rules on it** (rows 325 and 360, alternative 816).

- Majors: Inventive 2; Design 9; Zoom Out 8; Comprehension 4; Structure 2 (row 816), 3; Style 1, 10 (second goal).

**D. One release carries seven refund kinds and several optional features, and the payout job executes the refunds later** (moving, dispute automation, opt-out, Elevate's cancellation, readiness items).

- Blocker: Design 4 (released while refunds are unsent); Design 3 scenario B.
- Majors: Zoom Out 2, 6, 7, 9; Design 6; Comprehension 2, 10; Structure 5, 7; Style 8.

**Explained by none of these.** These survive any reshaping:

- Design 1 (Blocker), Design 8, Inventive 6 and Comprehension 11: the seat rules are checked when checkout starts and not again when the payment lands.
- Design 12 (security).
- The vocabulary and labelling findings: Structure 1, Style 3, 5, 6, 9, 11, Comprehension 1, 9, 12.
- The plan defects: Comprehension 7, 8.

### 2. Fix cost

The design gets larger.

**Fixes that add mechanism**

| Finding                            | What it adds                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Design 1                           | A re-check in fulfilment, a refund kind for it, and payment-page expiry on cancel and opt-out.                 |
| Design 2                           | A per-run listing of Stripe transfers as the second total.                                                     |
| Design 3                           | A Support action to clear a mismatch, a rule for a dispute after release, and a move refusal.                  |
| Design 4                           | A release gate on unfinished refund rows; a `failed` policy with attempt count, Support list and manual retry. |
| Design 5                           | A balance-transaction fetch and a second sandbox sequence.                                                     |
| Design 6                           | A partial unique index, and Support's refund routed through the seat row.                                      |
| Design 7                           | A lookup before every Stripe call, row claims and a conditional email.                                         |
| Design 8                           | A Stripe session lookup before reusing a hold, a payment-method pin, a renewal cap and a seats-edit refusal.   |
| Design 9                           | A second meaning of "attended", a Support route and a block-date freeze.                                       |
| Design 10                          | A day-85 notification and gates with named owners.                                                             |
| Design 11                          | A separately pinned job image, an opt-in intent record and `payout_mode` reconciled from a webhook.            |
| Design 12                          | Recent sign-in on two more routes, an alarm and an address split by purchase.                                  |
| Inventive 1A, 2A, 3A, 3B, 4A, 5, 6 | A mechanism each. Inventive 5 alone needs a paid-out mark on every payment, self-paced included.               |
| Structure 7, 8                     | Two goals and a recorded terms version per learner.                                                            |

**Fixes that remove mechanism**

- Zoom Out 3: the second total, the `mismatch` outcome and CUJ 10.
- Zoom Out 4: most run rows and the 15-minute cadence.
- Zoom Out 6: moving a learner.
- Zoom Out 7: dispute automation.
- Zoom Out 8: the review state.
- Zoom Out 9: the file-level plan.
- Zoom Out 10: opt-out and the readiness items.
- Inventive 1B: the whole payout engine.

About a third of the Design additions land on features Zoom Out would cut. Design 3 scenario B patches moving, part of Design 4 patches dispute handling, Design 9 patches the review, and Design 11 patches opt-out.

**Conflicting pairs**

- **Zoom Out 8 against Design 9 and Inventive 2A.** One cuts the attendance review; the others strengthen it with a second definition of "attended" and a deferred refund outcome.
- **Zoom Out 7 against Design 3, Design 4 and Inventive 3B.** One handles disputes by hand; the others extend automated handling to late disputes and to refund rows.
- **Zoom Out 10 against Design 11.** Zoom Out drops the opt-out route in favour of the by-hand procedure. Design 11 says that procedure (switch back to automatic) pays out everything held. With both applied, an opted-in profile has no way out.
- **Zoom Out 3, Design 2 and Inventive 5.** They are three different replacements for the second total: an existing after-the-fact report, a new gate from Stripe's transfers, and a three-way minimum with a paid-out mark.
- **Zoom Out 4 against Design 7.** Sending a cancellation's refunds from the API puts more execution in the request, which widens the unclaimed-row race Design 7 reports. It also reverses rows 346, 802 and 825.
- **Design 10 against Style 2.** Design asks for the purchase day count on a move (75); Style's rewrite says 78. Both are moot if moving is cut.

### 3. The smaller design

A smaller version exists. It removes A and B outright and dissolves most of C and D. **It reverses the author's decision at lines 161 and 795 (and RFC lines 612-614).**

**Changes shape**

- A class sale is charged to Elevate's Stripe balance, with no transfer at sale.
- Release is one Stripe transfer per class to the teacher's existing account: the teacher's shares of the seats not refunded, less any fee the teacher owes from cancelled seats.
- Self-paced sales and payouts are untouched.

**Stays**

- The class choice on the course page, class checkout with the seat hold, and fulfilment, with the Design 1 re-check and the Design 8b payment-method pin.
- `payments.class_id`, the cancellation columns, and one release mark per class.
- Opt-in, as a recorded acceptance of terms only; nothing changes at Stripe.
- Withdrawal 7 days ahead: one plain refund of the amount less Stripe's fee.
- The teacher's cancellation: a full refund per seat not attended, one row per seat so that it can resume.
- The 7-day wait before release.

**Goes**

- The manual-payout switch, `payout_mode`, both payout tables, the balance read and both held totals.
- The `mismatch` outcome, the once-a-day rule and the payout webhooks.
- The reverse-and-part-refund sequence and its fallback.
- The 85-day and 82-day rules, and possibly the 75-day rule (see the unverified list).
- Opt-out, the review columns and the dispute columns.
- The rollback problem in Design 11.

**By hand, for a handful of teachers**

- **Release.** A Support admin looks at each due class and presses release. That look replaces the no-attendance review, the dispute hold and the forced release. It reverses row 797. A daily job that only creates transfers is the next step up, and is far smaller than the payout engine.
- **Refunds for attended learners.** The owner decides and Support sends the refund. This changes row 327 in who presses the button, not in who decides.
- **Moving.** The learner withdraws and buys again. This reverses rows 329 and 362.
- **Disputes.** Support does not release a disputed seat. A dispute after release is handled in Stripe. This reverses row 336 for the first release.
- **Elevate's cancellation.** Support uses the existing full-refund action per seat.

**What it gives up**

- Elevate holds money owed to teachers. That is a licensing question for the lawyer the design already needs. RFC line 488 lists the same question for paused payouts as unverified, and this design's Open Questions omit it.
- A teacher sees held money only in Teach, not in Stripe, and must trust Elevate for it.
- A fee owed by a cancelling teacher is netted only against that teacher's other class money, not against self-paced income. With no other class money, Elevate carries it, as line 850 already admits for the current design.
- Elevate's own Stripe payouts must not sweep held class money to its bank, or Elevate keeps a float.
- ADR 003 becomes two payment models, and its reconciliation rule changes for class payments.
- No release happens without a person, until the small job is built.

**Unverified for this version (confirm all three)**

- Whether Stripe lets a Singapore platform take the charge itself and transfer later.
- Whether a time limit applies to money held on the platform. If one does, one sale-horizon rule remains.
- Whether the transfer can be tied to the original charges.

**If the author keeps line 161**, the fallback is Zoom Out 2's slice "2a" with one held rule, plus Design 1, 2, 4, 5, 6, 7 and 11. That patches A and B without removing them. It still depends on the untested refund sequence and on the unanswered balance and 90-day questions.

### 4. Disagreements

- **Zoom Out 5 is overstated.** A fixed 31-day delay holds self-paced money too, which reverses the author's row 324 ("Self-paced payouts are not held"); the finding names the cost but not the reversal. It also leaves root cause B whole, and a cancellation's refunds still need somewhere to run.
- **Zoom Out 2 keeps Elevate's cancellation in the first slice.** I would cut it (my finding 4).
- **Zoom Out 4 is right on the alarm and the row count.** I would not take its API-side refund execution, for the reason in section 2.
- **Zoom Out 8 against Design 9.** Both describe the defect correctly, and neither fix suits a first release. Cutting leaves teacher-written marks deciding money unchecked; strengthening adds a second "attended" and a third refund outcome. A person looking before release is cheaper than both. The alternative is the author reversing row 816.
- **Design 2's Blocker is half overstated.** The race needs a payment in the seconds before the one paying run of the day. The permanent case, a payment never recorded, is real: ADR 007 lines 22-24 describe how it happens. That half justifies the severity.
- **Inventive 5 says it is not the alternative rejected at row 800.** With a paid-out mark on every payment it is close to it, and it takes on that row's cost.
- **Comprehension 4 and Structure 9 call the cancelled-before-start case unclear.** Read literally, line 654 is a defect: every such class goes to "needs review" with nothing left to release. The consequence is noise on the Support page, not money.
- **Structure 2's demand for a linked record per author decision** cannot be met where the decision was made in a drafting session. Keep the half that asks for a concrete trade-off. It matters most for rows 788, 795, 797 and 816.
- **Structure 7 asks for new goals for the two live-path fixes.** I would ship them separately instead (my finding 5).
- **Style, Structure and Comprehension rewrites** of the day limits, the review goal and the move rules should wait. Several of those passages may be deleted.

### 5. Order of work

1. **Run the Stripe sandbox pass now, before approval.** It should answer:
   - the refund sequence;
   - a reversal against a short or pending balance;
   - how the 90 days are counted, and what Stripe does at the limit;
   - whether a teacher can change the payout schedule or start a payout from their dashboard (my finding 2);
   - the three questions for the platform-held version.

   Put the licensing question to the lawyer for both shapes.
2. **The author decides where class money sits**, with row 795's reason corrected. This decides whether Design 2, 3, 5, 10, 11 and most of root cause A exist at all.
3. **The author states the size of the first release and decides the cut list**: moving, dispute automation, the review, opt-out, Elevate's cancellation. Fix the "Drafting" label first (Structure 1), since it says which decisions are the author's to reverse.
4. **The author decides the attendance rule when the teacher cancels** (row 816).
5. **Fix what survives any shape:** Design 1, 6, 7, 8.
6. **Rewrite the text and word list, then the plan,** for the first slice only.

### Findings the earlier stages missed

**1. Blocker: the reason for rejecting platform-held money describes today's model.**

- **Lines:** 161, 795; also 308, 848.
- **Evidence:** `apps/api/src/providers/payments/stripe.ts` sets no `on_behalf_of` and no statement descriptor. It sets `losses: { payments: 'application' }` at line 39 and refunds from the platform at lines 196-197. Under Stripe's rules for destination charges (confirm), Elevate is already the seller on the card statement and already owns refunds and disputes. Inventive 1B left the code check open; this closes it.
- **Change:** rewrite row 795 with the real costs listed in section 3, and put the option back to the author.

**2. Major: the hold depends on a setting in an account the teacher has a dashboard for.**

- **Lines:** 198-204, 427-429, 463-468.
- **Evidence:** ADR 003 line 8 gives teachers an Express dashboard and ADR 007 lines 38-40 give the owner links to it. The design does not say whether the owner can change the payout schedule or start a payout there, and nothing compares `payout_mode` with Stripe after opt-in.
- **Change:** add this to Open Questions and the sandbox pass. If the teacher can do either, the hold is not a control as designed.

**3. Major: no size is stated for the first release.**

- **Lines:** 788, 797, 815, 822, 833, 836, 865-866.
- **Evidence:** by-hand options are rejected as "manual work for Support" with no number of teachers, classes, cancellations or disputes. The RFC's capped-exposure package (brief lines 296-297, 619-620) is never weighed as a whole; its parts are rejected one by one.
- **Change:** state the expected numbers for the beta under Limits, and re-test each of those rows against them.

**4. Major: Elevate's cancellation is an undefined feature that duplicates an existing action.**

- **Lines:** 124-125, 559, 577-578, 633-635.
- **Evidence:** nothing says when Elevate cancels or whether it can do so after release. It takes back the teacher's whole share even for blocks taught, which is the outcome row 813 rejects. Lines 577-578 say it is the same Stripe call as today's Support refund.
- **Change:** cut the route and the `elevate_cancelled` kind; Support refunds each seat with the existing action.

**5. Major: two changes to the live payment path are not behind `CLASS_SALES`.**

- **Lines:** 95-97, 598-603, 718-721, 913-914.
- **Evidence:** the refund-id change and the webhook retry change apply to every payment, so "rollback of selling" does not undo them.
- **Change:** ship both as their own change first, verified on self-paced sales.

**6. Major: a dispute won after its class was released leaves the payment held.**

- **Lines:** 422, 652-657, 712.
- **Evidence:** line 712 says "the next run marks the payment released if its class is", but the Mark step marks payments only when it releases a class. The payment stays unmarked until day 85 and the two totals disagree, the mirror of Design 3 scenario A.
- **Change:** if the job stays, add a step that marks payments of released classes with no open dispute.

**7. Nit: "Room for grant money" justifies mechanism by a non-goal.**

- **Lines:** 191-192, 333, 749-765, 840.
- **Evidence:** the review state and the refund-row shape are defended as leaving room for a subsidy flow nobody has verified.
- **Change:** delete the section and keep one line in Future Improvements.

### Files referenced

- docs/designs/scheduled-classes-selling.md
- docs/designs/reviews/scheduled-classes-selling/zoom_out_report.md
- docs/designs/reviews/scheduled-classes-selling/comprehension_report.md
- docs/designs/reviews/scheduled-classes-selling/critic_report.md
- docs/designs/scheduled-classes-brief.md
- docs/adr/003-payments-destination-charges.md
- docs/adr/007-payout-accounts.md
- apps/api/src/providers/payments/stripe.ts
- zoom-out-standard.md
