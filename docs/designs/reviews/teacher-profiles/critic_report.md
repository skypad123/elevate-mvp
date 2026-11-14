# Stage 7: Critic Review Report (round 1)

-   **Target:** `docs/designs/teacher-profiles.md`, FeatureRange lines 1–874
-   **Date:** 2026-11-11
-   **Reviewers:**
    - `egm-design`, against `feature-spec-standard`: completed, 1 Blocker, 7 Major, 5 Nit;
    - `egm-structural`, against `feature-spec-standard`: completed, 2 Blocker, 5 Major, 7 Nit;
    - `egm-style`, with its persona rules: completed, 6 Major, 12 Nit.
-   **Context given to reviewers:** `docs/spec.md`, `docs/adr/003-payments-destination-charges.md`,
    and read-only access to the repository.
-   **Round status:** not clean. Open Blockers and Majors remain.

Findings that several reviewers raised are merged, and each lists its source ids
(`design-1-n`, `structural-1-n`, `style-1-n`). Elephant notes are mine, not the reviewers'. I checked
the code claims marked "verified" myself.

---

## Blockers

### B1. Change-set approval deletes a writer's new content (design-1-1)

-   **Where:** section 8 "Opening a change set" and "Approval" (lines 455–464, 486–492); CUJ 3.
-   **Finding:**
    - Draft rows point at other draft rows. A draft artefact's `lesson_id` is the draft lesson, a
      draft quiz's `artefact_id` is the draft artefact, and draft prerequisites use draft lesson IDs.
    - Approval updates live rows from drafts, makes source-less drafts live, then deletes "the
      remaining draft rows". Deleting the draft lesson cascades to every artefact still pointing at
      it (`artefacts.lesson_id` is `onDelete: 'cascade'`, `packages/db/src/schema/courses.ts:83–85`,
      verified).
    - So the artefact a writer adds to an existing lesson in CUJ 3 is deleted on approval. Quizzes
      on new artefacts and prerequisite links break the same way.
    - Also unspecified: how prerequisite changes are applied (no `source_id`, no `updated_at`); what
      the `source_id` reference does when an owner deletes the live row; and that an owner deleting a
      live row moves no `updated_at`, so the conflict check misses it.
-   **Recommendation:**
    - make approval an ID remap: before deleting drafts, rewrite every reference on surviving draft
      rows (`lesson_id`, `artefact_id`, prerequisite ends) from the draft ID to its `source_id`;
    - apply prerequisites as "replace the course's live set of links";
    - define what happens to `source_id` when its live row is deleted (for example, set it to null
      and record a conflict), and detect deleted live rows in the conflict check;
    - add a test that the new artefact in CUJ 3 survives approval.
-   **Elephant note:** the comprehension test (Stage 6, finding 2) and the inventive catalyst
    (Stage 5, C1) found parts of this. Three independent reviewers now agree that section 8's apply
    step is wrong as written.

### B2. No Risks & Mitigations section (structural-1-1, design-1-5)

-   **Where:** whole FeatureRange. Risk content is spread across "Weak points" (72–80), section 4
    (385), section 9 (535–537), section 13 (602–603) and Alternative G (674–675).
-   **Finding:** the standard requires the spec to state its constraints, failure modes, security
    implications and scalability limits, with their mitigations. Most of the scattered risks have no
    mitigation. Risks with no mitigation or explicit acceptance:
    - rewriting the whole query layer onto an ORM release candidate in the slice that promises
      unchanged behaviour (Goal 7);
    - the reset, which cannot be undone;
    - forged registry documents;
    - the cost of copying a whole course into draft rows on the first writer edit;
    - the 20-invitations-per-day limit, with no reason given for the number.
-   **Recommendation:** add an H2 "Risks & Mitigations" between the Technical Plan and Alternatives:
    a table of risk, impact, and mitigation or explicit acceptance. Move the scattered items into it,
    and copy in the accepted entity-check risks that line 729 points to in the brief.

### B3. Some rejections give no reason, and all are attributed with no link (structural-1-2, design-1-12, style-1-11, style-1-12 in part)

-   **Where:** Alternatives O, Q, U, W (lines 755, 774, 817, 834); H (685); the "Decided by author"
    notes at 377, 404, 444 and 534.
-   **Finding:**
    - O, Q, U and W say only "Rejected by author", with no trade-off. Their Cons exist, but the
      Reason does not say why the Cons outweigh the chosen design's costs.
    - Alternative H adds "following every reviewer", with no link.
    - The standard forbids attributing a decision without a linked record. Saying "Rejected by
      author" in every entry is also repetitive in a single-author design (style).
-   **Recommendation:** give each Reason the deciding trade-off in one clause (for O: "unreviewed
    changes reach paying learners"). Say "decisions are the author's" once in the section intro, and
    drop "following every reviewer".

---

## Major

### M1. Corporate's MVP-scope claim is circular and conflicts with the spec (style-1-1)

-   **Where:** Alternative G (671–673).
-   **Finding:** "part of the MVP's launch scope, so deferring them means launching without a feature
    the MVP needs" justifies scope with scope. It contradicts lines 74–77 (no demand; the case rests
    on point 4) and `docs/spec.md:3, 65–69, 73`.
-   **Recommendation:** state the real basis (the author's scope decision, and what drives it) and
    where it was made. Do not present it as a requirement from the spec.
-   **Elephant note:** this repeats the Stage 5 blocker (A1). A third reviewer has now raised it.

### M2. References to a brief the reader cannot see (structural-1-3, style-1-2)

-   **Where:** lines 377, 534–535, 729.
-   **Finding:** line 729 ("The accepted risks are listed in the brief") makes the rejection of
    Alternative L impossible to judge from this document.
-   **Recommendation:** link `concepts_brief.md` by path, and bring the accepted risks into the
    document (see B2). Stage 6 (finding 3) also lists line 1147, 1194 and 1389 in the
    Implementation Plan.

### M3. Learner-read isolation covers three services, but more readers would see draft rows (design-1-3)

-   **Where:** section 8 "What learners read" (474–481).
-   **Finding:** other code reads the content tables directly:
    - My Learning progress counts every artefact (`apps/api/src/services/enrollments.service.ts`,
      verified), so draft copies would roughly halve learners' progress percentages;
    - the drop-off analytics in `analytics.service.ts:46–56` would count draft lessons;
    - checkout loads lessons (`payments.service.ts:41`);
    - the Teach live editor and Support's course preview would show live and draft rows mixed.
-   **Recommendation:** list every reader of the four tables and mark each as live only, draft
    only, or both. Move every live-only reader onto the view-based client. Change the import-scan test
    to an allow-list of files that may import the raw tables, not a deny-list of three.
-   **Elephant note:** Implementation step 2.6 already moves `enrollments`, `analytics` and `payments`
    onto the views, but section 8 does not say so, and the test in 1.37 and 2.16 still checks only
    three files. Teach and Support reads are not covered anywhere.

### M4. A quiz attempt in progress does not keep its questions (design-1-2)

-   **Where:** section 8, line 495.
-   **Finding:** `submitAttempt` grades against the current quiz row
    (`apps/api/src/services/learning.service.ts:365–379`, verified). Approval updates the live quiz
    in place, so an attempt started before approval is graded against the new answer key. The
    design's claim is false against the code.
-   **Recommendation:** store the questions, or a version, on `quiz_attempts` at start and grade
    against them. Otherwise refuse approval while attempts are open.

### M5. The payout-account lifecycle has gaps (design-1-4, design-1-8)

-   **Where:** sections 1, 4 and 6 (279–286, 365–371, 378–379, 409–416).
-   **Finding:**
    - an owner with an `active` account who restarts onboarding has none in `onboarding`, so a
      second Stripe account is created. Today `ensureAccount` reuses the account
      (`connect.service.ts:28–30`). When the second one enables charges, the one-active index fails
      inside the webhook handler;
    - no transition into `retired` is defined in any slice, yet Goal 5 depends on it (also Stage 5
      B1 and Stage 6 finding 1);
    - nothing says who chooses `businessType`, or what happens to an individual account on a
      corporate profile, or the reverse; such an account would stay in `onboarding` for ever;
    - `syncStatus` (`connect.service.ts:65–84`) also writes the flags but is not given the activation
      rules;
    - refunds against a retired or moved account are not covered: who may refund, how the ledger
      shows it, and a negative balance under `losses.payments: application`;
    - `payments.profile_id` is kept "for audit" but no query reads it. First-payout analytics fires
      today with the teacher's user ID (`payments.service.ts:344–359`), and the design does not say
      which identity it carries, or what "first" means for a profile with two accounts.
-   **Recommendation:** reuse any non-retired account for onboarding links; define the retire
    transition and who triggers it, or say no flow reaches it in this build and why the state
    exists; derive `businessType` from the profile type; send `syncStatus` through the same
    activation function; add a paragraph on refunds; define first payout and its identity fields.

### M6. Staff can do more than CUJ 5 needs (design-1-7)

-   **Where:** section 2 (334–336); CUJ 5.
-   **Finding:** `staff` gets `course.setPrice`, `course.delete`, `course.editLive` and
    `changeSet.review`. A `super_admin` can change a live course's price or content with no review
    and no owner notice. Stripe link requests do notify the owner.
-   **Recommendation:** remove `course.setPrice`, `course.delete` and `changeSet.review` from
    `staff`, or email the owner on each staff change. State why the rest stay.

### M7. No fallback if Drizzle view generation fails (design-1-6)

-   **Where:** Open Questions (164–169), section 8 "Not tested", section 13.
-   **Finding:** the design does not say what happens if `drizzle-kit` does not emit `CREATE VIEW`,
    or views over `lesson_prerequisites` fail.
-   **Recommendation:** make the test a gate at the start of slice 1, with a named fallback.
-   **Elephant note:** the Implementation Plan already has both: Step 0 is separate (0.10 names the
    fallback, hand-written views with `.existing()`). The FeatureRange does not mention them, so
    this is a pointer to add, not new work.

### M8. The data model section is incomplete (structural-1-5)

-   **Where:** section 1 (234–308).
-   **Finding:** `course_change_sets`, the new columns on four content tables, the four views and
    `sessions.signed_in_at` appear only in later sections. The ER diagram leaves them out, along
    with `audit_log` and `sessions`.
-   **Recommendation:** list every new table, column and view in section 1, and point to the later
    sections for behaviour.

### M9. Technical Plan sections are not tied to slices (structural-1-6, structural-1-14 in part)

-   **Where:** sections 1–13; CUJs.
-   **Finding:** Goals are grouped by slice, but sections and CUJs are not. Section 4 mixes slice 1
    and slice 3 behaviour. The slice 2 member screens have no section. There is no CUJ for owner
    recovery or for the manager `awaiting_confirmation` path.
-   **Recommendation:** add a slice label to each section and CUJ, or a table mapping sections to
    slices.

### M10. Undecided items sit outside Open Questions (structural-1-7, style-1-9)

-   **Where:** line 500 ("Proposed rule"), the inline assumptions at 662 and 825.
-   **Finding:** the course-details rule was approved with the Technical Plan but is still worded
    "Proposed rule", and Implementation 2.9 states it as decided. Two assumptions are marked inline
    but missing from Open Questions.
-   **Recommendation:** state the rule as decided. Move the two assumptions into Open Questions.

### M11. ADR 003 is changed but not referenced (structural-1-4)

-   **Where:** sections 4 and 5 (387–395); Overview.
-   **Finding:** ADR 003 sets the "teacher account" as the destination and commission "per teacher".
    This design changes both and never links the ADR. "The checkout session's destination" should
    use the ADR's field name, `payment_intent_data.transfer_data.destination`.
-   **Recommendation:** add a "Related" line linking ADR 003 and saying what changes.

### M12. Wording that claims more than the evidence shows (style-1-3, style-1-4, style-1-5, style-1-6)

-   **Line 162:** "it is clear who it lets in" has no pass or fail condition. Say what is observed
    (which Stripe identity the Express login link signs in for a company account).
-   **Lines 20–21 and section 2:** "everything" and "run the profile" are vague. The role-to-capability
    rows that Goal 3 refers to are not shown. Add the role-by-capability matrix to section 2.
-   **Line 68:** "About 300 lines across 41 files" gives no counting method. Give the search pattern,
    or drop the number.
-   **Line 502 and line 796:** "Evidence that this works" and "confirmed this" overstate a scratch
    test whose own "Not tested" list leaves out the migration and the real schema. Retitle the
    section "Scratch-project test results", and say exactly what was confirmed.

---

## Nits

| Id              | Where                    | Finding                                                                                                                                                                                                                      |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| design-1-9      | 436–437                  | The rate limiter is in memory per process, so a 24-hour window resets on every deploy. Count invitations from `profile_invitations.created_at` instead.                                                                      |
| design-1-10     | 255                      | `profiles.type` is "changeable" with no route or rules. Say it does not change in this build.                                                                                                                                |
| design-1-11     | 560–575                  | The reset leaves running API tasks on old code against an empty schema (scale to zero, or accept the outage); say whether `0000` recreates extensions and grants; old test-mode accounts will write `webhook_events` errors. |
| design-1-13     | 493–494                  | The conflict picker screen is not named in slice 2's scope.                                                                                                                                                                  |
| structural-1-8  | section 8, 13            | Bold text stands in for sub-headings; use H4.                                                                                                                                                                                |
| structural-1-9  | throughout               | Mixed bullet markers (`*` and `-`).                                                                                                                                                                                          |
| structural-1-10 | 859–871                  | "Promotion, for the later brief" breaks the Alternatives template.                                                                                                                                                           |
| structural-1-11 | 165, 445, 654            | Cross-references are plain text, not links.                                                                                                                                                                                  |
| structural-1-12 | 168, 512, s.13; 404, 444 | The view-generation gap is stated three times; inline rejections repeat Alternatives.                                                                                                                                        |
| structural-1-13 | 144–145                  | A Non-Goal contains a rejection; it belongs in Alternative A.                                                                                                                                                                |
| style-1-n1      | 47                       | "the code assumes that everywhere" is hyperbole; name the scope.                                                                                                                                                             |
| style-1-n2      | 56                       | "breaks in four ways": point 4 is the reason to act now, not a way the model breaks.                                                                                                                                         |
| style-1-n3      | 79                       | "guesses until one arrives" is informal.                                                                                                                                                                                     |
| style-1-n4      | 98                       | "correct totals" is not defined.                                                                                                                                                                                             |
| style-1-n5      | 128–129                  | Goal 14 repeats the last sentence of Goal 13.                                                                                                                                                                                |
| style-1-n6      | 287                      | "the later promotion overlap" is undefined (also Stage 6, finding 5).                                                                                                                                                        |
| style-1-n7      | 337                      | Heading says "Missing profiles"; the rule covers inaccessible ones.                                                                                                                                                          |
| style-1-n8      | 400                      | "only on a bug": name the case.                                                                                                                                                                                              |
| style-1-n10     | 581–584, 602             | Repeated "release candidate" wording; the risk sentence names no decision.                                                                                                                                                   |
| style-1-n12     | 411/867, 214             | "earnings follow the account" vs "the payout account"; `teacher_not_payable` keeps the old name.                                                                                                                             |

---

## What the reviewers confirmed

-   **Code citations checked as accurate:** `teachers.ts:11–13`, `payments.service.ts:160–166`,
    `201–214`, `288`, `earnings.service.ts:138–157`, `stripe.ts:36–49`, `107`,
    `connect.service.ts:23–24`, `courses.service.ts:191`, learner `profile.tsx:44`, and spec lines 3,
    69 and 73.
-   **Structure:** heading levels never skip, all fenced blocks are closed, and every core section
    the standard requires is present and substantive.
-   **Kept on purpose (style):** "stops a stolen session, not a stolen inbox", the forged-document
    risk, the assumption markers and the "Weak points" section are each backed by evidence.
-   **Outside the range:** the Implementation Plan says "four steps" while the FeatureRange says three
    slices. Step 0 explains this; Stage 9 should check that the wording lines up.
