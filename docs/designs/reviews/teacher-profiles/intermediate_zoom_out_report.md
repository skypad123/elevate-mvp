# Stage 8: Intermediate Zoom Out Report

-   **Target:** `docs/designs/teacher-profiles.md` (lines 1–1749), not edited since Stage 5
-   **Date:** 2026-11-11
-   **Reviewer:** `egm-zoom-out`, fresh context, against `zoom-out-standard`. It also read the Stage
    5, 6 and 7 reports.
-   **Context given to the reviewer:** `docs/spec.md`, `docs/adr/003-payments-destination-charges.md`,
    and read-only access to the repository.
-   **Verdict:** needs revision, for scope. The context is judged good enough.

**Main finding:** the later stages make the scope problem worse. Most of the fixes that Stages 6 and
7 require fall on two features that Stage 5 already flagged as unneeded: held change sets (slice 2),
and the `retired` and movable payout-account states (slice 1, built for promotion, which is a
Non-Goal). Each correctness fix adds machinery to a part of the design that could be removed.

Elephant notes say where a finding runs against a decision the author already made. They are mine,
not the reviewer's.

---

## Z1. Blocker: the fixes change sets need grow the most speculative part of the design (Stage 5 A3 and C1, now stronger)

-   **Where:** section 8; 2.2–2.9, 2.14, 2.16; Alternatives N, R, S; critic B1, M3, M4; comprehension
    2 and 4.
-   **What the later stages add to slice 2:** an ID remap at approval; "replace the live set" for
    prerequisites; rules for a `source_id` whose live row was deleted; detection of deleted live
    rows; a quiz-attempt snapshot or an approval block; an allow-list of every reader of four
    tables; a definition of which course states count as live. That is on top of four draft tables,
    four views, a second relations set, a learner client, a conflict picker and the Drizzle RC.
-   **Why it matters:**
    - no teacher has asked for writers, and the spec's pilot is 3 to 5 freelance teachers;
    - the apply step is wrong in three ways, and fixing it means writing a small merge engine;
    - the catalyst's "one working copy" idea removes the conflict check and picker, but not the ID
      remap, the quiz issue or the reader list;
    - only Alternative N removes all of it, and its cost is how the product works today.
-   **Ask:** if slice 2 stays, adopt Alternative N. Drop Step 0, section 8's storage and views, and
    2.2–2.6, 2.8, 2.9 and the change-set part of 2.14. Writers keep draft-course editing,
    invitations and profile media. Held live edits can come later as an additive migration.
-   **Elephant note:** the author chose held change sets over Alternative N in the brief, and chose
    views with the Drizzle upgrade during drafting. This finding asks the author to reverse both,
    citing the cost the later stages found. It does not dispute that held edits are useful.

## Z2. Major: views do not replace the shared filter that Alternative R rejected

-   **Where:** section 8 "What learners read"; Alternative R; 2.6; 2.9; critic M3.
-   **Finding:** the raw content tables are read in seven services, including `courses.service.ts`
    (57 references). Support's course preview goes through `CoursesService`
    (`apps/api/src/services/review.service.ts:9`). Teach and Support reads can never use the learner
    client, and 2.9 already hides drafts from them with a `change_set_id is null` filter in code.
    So the design has two mechanisms: views, a learner client and an import scan for some readers,
    and a shared code filter for the rest. The shared filter is what Alternative R was rejected for.
-   **Effect:** the RC upgrade buys isolation for only part of the readers. If change sets stay,
    Alternative R (one filter everywhere, on Drizzle 0.45) is the more consistent choice. With
    Alternative N, none of this is needed.

## Z3. Major: the quiz-attempt problem already exists today, so a snapshot here is scope creep

-   **Where:** section 8, lines 495–496; critic M4.
-   **Finding:** owners already edit live quizzes in place: `live` is an editable status
    (`apps/api/src/services/courses.service.ts:24`). `quiz_attempts` stores no question snapshot
    (`packages/db/src/schema/learning.ts:38–56`). An attempt in progress is already graded against
    the answer key at submission. The defect is the false sentence, not missing machinery.
-   **Ask:** correct the sentence to describe today's behaviour, add a line to Risks if wanted, and
    do not build attempt snapshots in this design.

## Z4. Major: the payout-account fixes exist only because of the `retired` and movable states (Stage 5 B1, now stronger)

-   **Where:** section 1 `payout_accounts`; sections 4 and 6; Goal 5; 1.18, 1.22, 1.36; critic M5;
    comprehension 1 and 5.
-   **Finding:** every lifecycle fix the critic asks for, except deriving `businessType` and routing
    `syncStatus`, comes from states no flow in this build reaches: `retired`, a changeable
    `profile_id`, and several accounts per profile. Goal 4 is met by an unchangeable
    `payments.payout_account_id`, and that column is the part that would be expensive to add after
    launch. Adding a `retired` value or allowing `profile_id` to change later is additive.
-   **Ask:** keep `payout_account_id` on payments and one non-retired account per profile, reused
    as `ensureAccount` does today (`connect.service.ts:28–41`). Drop `retired`, `retired_at`, the
    movable `profile_id`, the account-switch fixture and Goal 5's two-account test. Leave the
    lifecycle to the promotion brief.
-   **Elephant note:** the brief's list "What the first build's data model must allow" asks for
    these states so promotion needs no rework. The reviewer's counter is that the only part needing
    rework later is the payment column, which this proposal keeps. The money queries would still
    group by payout account, so earnings already follow the account. That leaves the brief's
    goal intact with less built now. The author has to decide whether the brief's list was a
    requirement or a means to that goal.

## Z5. Major: corporate and helpers as launch scope still stand, and are reinforced (Stage 5 A1 and A2)

-   **Where:** Alternative G; D.2; critic M1.
-   **Finding:** a third reviewer (critic M1) found the scope claim circular. The Technical Plan not
    separating slices (critic M9) is a sign of three features in one design. Most rows the Risks
    section would hold (the RC, forged documents, copy cost, untested Stripe company accounts) come
    from slice 2, slice 3 and Step 0. A2 still holds: slices 2 and 3 add tables and nullable
    columns, so they can ship after launch.
-   **Ask:** record a dated product decision with its reason and stop D.2 rewriting the spec to fit,
    or cut this design to slice 1 and give slices 2 and 3 their own briefs.
-   **Elephant note:** the author has stated corporate is needed for the MVP. That decision stands
    until the author changes it; the open gap is that the document gives no reason for it.

## Z6. Major: writing the fixes inline would drop the Technical Plan's altitude further (Stage 5 C2, raised from Nit)

-   **Where:** sections 5, 8, 13; the fixes for critic B1, M3, M5, M8.
-   **Finding:** the ID-remap algorithm, reader lists, column-by-column additions and per-transition
    account rules are implementation detail. In the Technical Plan they would bury the
    architecture in a document that is already 1749 lines. Section 8 already reads like an apply
    procedure and section 13 like an upgrade checklist.
-   **Ask:** keep the Technical Plan to components, boundaries and invariants ("approval keeps live
    IDs; learners never see drafts"). Put algorithms and file lists in the Implementation Plan.
    Prefer the cuts in Z1 and Z4 first, which remove most of this text.

## Z7. Nit: the Risks & Mitigations section is right and adds no scope

-   **Where:** critic B2.
-   **Note:** keep it to one short table. After the cuts in Z1, Z4 and Z5, most rows go away, and
    the reset and invitation abuse remain.

## Z8. Nit: narrowing staff capabilities is a simplification and should be taken

-   **Where:** section 2; critic M6.
-   **Note:** removing `course.setPrice`, `course.delete` and `changeSet.review` from `staff` makes
    the role smaller. That is better than emailing the owner on every staff change, which adds
    machinery. Stage 5 A5 still applies: in slice 1, write only the `owner` and `staff` rows.

---

## Stage 5 findings still open and unchanged

-   **A4 (unrequested security and recovery features):** stands. Critic M9 notes owner recovery and
    the manager `awaiting_confirmation` path have no CUJ.
-   **B2 (fulfilment relies on metadata and drops paid sales):** stands.
-   **C3 (schema guard is a text scan):** stands, and under Z2 it would also have to grow into an
    allow-list.
-   **D1 (one squashed `0000` keeps everything off staging until slice 3):** strengthened. Each fix
    added to slice 2 delays the first staging run further.

## Where the later stages weaken Stage 5

-   Nowhere materially.
-   **Comprehension 4 (course lifecycle)** is partly answered by the code: `pending_review` is not
    editable; `draft`, `rejected` and `live` are (`courses.service.ts:24`). The document should say
    so in one line.
