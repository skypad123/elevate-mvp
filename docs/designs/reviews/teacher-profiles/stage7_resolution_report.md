Status: resolved

**Resolution (2026-11-11):** the author chose auto accept. Applied every PROPOSE FIX: B2 (Risks &
Mitigations section), B3 (reasons for O, Q, U, W; author attribution stated once), M2 and M11
(Related line with the brief and ADR 003), M6 (narrower staff capabilities, also in 1.9, CUJ 5 and
the staff test), M7, M8, M9 (section-to-step table, step tags on CUJs, CUJ 7, the manager variant
of CUJ 2, named screens), M10, M12 (capability table, measured figure, test wording) and the nits
marked PROPOSE FIX. Declined: four nits. **M1 stays escalated and open:** no reason for corporate
being MVP scope was given, so Alternative G is unchanged apart from its wording.

# Goldfish Annotated Review Report

**Target:** `docs/designs/teacher-profiles.md` (FeatureRange: lines 1–925, everything before
`## Detailed Implementation Plan`; the range has grown from 874 lines since Stage 7)

**Source findings:** `critic_report.md` (Stage 7, round 1). Ids such as B2 and M6 refer to that
report. The Stage 9 resolution is kept in `stage9_resolution_report.md`.

**Count:** 3 Blockers, 12 Majors, 20 Nits.
- Already fixed by the Stage 9 resolution: B1, M3, M4, M5, part of M10, and 5 nits.
- 1 ESCALATE (M1).
- PROPOSE FIX: B2, B3, M2, M6, M7, M8, M9, M10 (rest), M11, M12, and 12 nits (one in part).
- DECLINE: 4 nits (one in part).
- CONTEST: none.

**Needs you first:** M1 (escalated). Only you know why corporate profiles are MVP scope, and no
reviewer could read it. Three reviewers (Stage 5 A1, Stage 7 M1, Stage 8 Z5) flagged the missing
reason.

## Prioritized Findings & AI Suggestions

### [Issue 1] B1 [`design`] - Severity: Blocker

*   **Affected Scope:** section 8 "Approval"; CUJ 3.
*   **Discrepancy Description:** change-set approval deletes a writer's new content through a
    cascade.
*   ***AI Suggestion:*** none needed: already fixed.
*   ***Justification:*** the Stage 9 resolution (IB1 option A) rewrote section 8's approval as
    guarantees ("references between draft rows are rewritten to live IDs before any draft row is
    deleted"), added `copied_from_live`, `opened_prerequisites` and `source_id on delete set null`,
    and put the ordered procedure in item 2.8.

### [Issue 2] B2 [`structural`, `design`] - Severity: Blocker

*   **Affected Scope:** whole FeatureRange; new section between section 13 and Alternatives.
*   **Discrepancy Description:** no Risks & Mitigations section; scattered risks have no mitigation.
*   **Rationale:** the standard requires constraints, failure modes, security and scale limits with
    mitigations.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Justification:*** valid. A reader cannot find the accepted risks in one place, and some
    (forged registry documents, stale registry documents) appear only in the brief.
*   ***Proposed Edit:***
    *   Location: new `## Risks & Mitigations` after section 13.
    *   Change: one table, columns Risk, Impact, Mitigation or acceptance:

        | Risk | Impact | Mitigation or acceptance |
        |---|---|---|
        | Drizzle `1.0.0-rc.5` changes before 1.0 is final | query layer rewrite (Step 0) may need follow-up changes | exact pins; Step 0 lands alone with all suites passing; RC moves only on purpose |
        | `drizzle-kit` RC does not emit views or keeps a different migration layout | the single `0000` cannot be generated as planned | tested in 0.10 before step 2; fallback: the generate wrapper (1.8a) adds the view SQL |
        | Stripe company accounts behave differently from the assumptions | slice 3 is blocked | tested in Stripe test mode before step 3 (Open Questions) |
        | The reset cannot be undone | staging and production data are lost | accepted: there is no real data; procedure in section 12; production only after staging passes, with the author's go-ahead |
        | A forged or stale registry document | a company that is not who it claims, or no longer exists, is approved | accepted by the author in the brief; remaining safeguards are Stripe's own verification and the legal-name check |
        | Anyone holding a company's registry document can apply as it | as above | accepted; Elevate cannot prove the applicant is connected to the company |
        | The public name drifts from the verified legal name | learners see a different name from the verified one | accepted; display-name changes are audited |
        | A forwarded invitation lets someone join as a writer | unwanted writer | their live edits are held for approval; new courses need Support approval; the inviter is notified and can remove them |
        | An email change by Support is a takeover route | account takeover | `super_admin` only, audited, both addresses emailed, sessions revoked; accepted because Support cannot verify the requester reliably |
        | Opening a change set copies the whole course | write cost on the first writer edit | accepted at pilot size (courses of tens of lessons); revisit if a course passes a few hundred artefacts |
        | A paid checkout with missing metadata | the learner paid and has no enrolment | only possible if session creation omits the metadata; the error is stored and Support acts on it |
        | Staff acting in Teach | staff change a teacher's live content | narrower staff capabilities (M6), audit under the staff user, Teach banner |

    *   Also: replace line 729's "The accepted risks are listed in the brief" with "The accepted
        risks are in Risks & Mitigations".

### [Issue 3] B3 [`structural`, `design`, `style`] - Severity: Blocker

*   **Affected Scope:** Alternatives O, Q, U, W and H; the "Decided by author" notes.
*   **Discrepancy Description:** four rejections give no reason; H attributes to reviewers with no
    link.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Justification:*** valid. Each Cons list has the reason but the Reason field does not say it.
*   ***Proposed Edit:***
    - section intro: add "Every decision here is the author's (sky)." and change each Reason to
      start "Rejected:" instead of "Rejected by author";
    - O: "Rejected: an unvetted writer would change what paying learners see, and an audit trail
      only helps after the damage.";
    - Q: "Rejected: a new field without a pending twin bypasses review silently, and new rows still
      need hiding, so it removes no machinery.";
    - U: "Rejected: `support_agent` can edit any course but no other Teach action, and
      `super_admin` can request Stripe links; a named staff role fixes both in one place.";
    - W: "Rejected: an applicant could email anyone before Support has reviewed them.";
    - H: drop "following every reviewer".

### [Issue 4] M1 [`style`] - Severity: Major

*   **Affected Scope:** Alternative G; D.2.
*   **Discrepancy Description:** "corporate is MVP scope" justifies itself, and conflicts with the
    spec's freelance-teacher pilot.
*   ***AI Suggestion:*** ESCALATE.
*   ***Justification:*** the author stated during drafting that corporate profiles are needed for the
    MVP. The reason for that is not in any file a reviewer could read, and the Elephant does not
    know it either. This is the author's fact to supply. Without it, the next reviewer will raise it
    again.
*   ***Proposed Edit:*** once the author gives the reason, record it as a dated product decision in
    the Overview ("Decided by the author on 2026-11-11: corporate profiles are in the MVP because
    …") and in Alternative G. D.2 then updates the spec to match that decision.

### [Issue 5] M2 [`structural`, `style`] - Severity: Major

*   **Affected Scope:** sections 4 and 9; Alternative L; the header.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** add a "Related" line to the header: the brief
    (`[concepts_brief.md](../../concepts_brief.md)`) and ADR 003. In sections 4 and 9, drop the
    "replacing the brief's …" history and keep only the decision. The accepted risks move into
    Risks & Mitigations (Issue 2).

### [Issue 6] M3, M4, M5 - Severity: Major

*   ***AI Suggestion:*** none needed: already fixed by the Stage 9 resolution. Section 8 now lists
    every learner-facing reader, the allow-list guard and the Teach and Support code filter (M3).
    The quiz sentence describes today's behaviour (M4). The payout-account lifecycle is one
    reusable account with one activation function, and section 6 defines first payout and
    `payments.profile_id` (M5).

### [Issue 7] M6 [`design`] - Severity: Major

*   **Affected Scope:** section 2 "Staff"; CUJ 5.
*   **Discrepancy Description:** staff can change price, delete courses, edit live content directly
    and approve change sets, with no owner notice.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Justification:*** valid; CUJ 5 only needs content fixes. Stage 8 (Z8) agrees narrowing is the
    simpler fix.
*   ***Proposed Edit:*** section 2: `staff` gets `profile.read`, `profile.edit`, `course.editDraft`,
    `course.editLive`, `media.upload`, `earnings.read` and `members.read`, and not
    `course.setPrice`, `course.delete`, `course.submit`, `changeSet.review` or any member or Stripe
    capability. Reason: staff fix content to help a teacher; money, publishing and membership stay
    the teacher's. Each staff change is audited and Teach shows the banner. The same change goes
    into the pseudocode in 1.9.

### [Issue 8] M7 [`design`] - Severity: Major

*   **Affected Scope:** Open Questions; section 13.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** Open Questions, the `drizzle-kit` item: add "Tested in item 0.10 before step
    2. Fallback: the views are declared with `.existing()` and the generate wrapper (1.8a) adds their
    SQL to `0000`." Fix the Drizzle item: the upgrade is Step 0, before step 1.

### [Issue 9] M8 [`structural`] - Severity: Major

*   **Affected Scope:** section 1.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** add to section 1 "Changed tables": `course_change_sets` (new, step 2); the
    `change_set_id`, `source_id`, `removed` and `copied_from_live` columns on lessons, artefacts and
    quizzes, and `change_set_id` on `lesson_prerequisites`; the four `live_*` views, each pointing to
    section 8. Add `course_change_sets` to the ER diagram.

### [Issue 10] M9 [`structural`] - Severity: Major

*   **Affected Scope:** Technical Plan sections; CUJs.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:***
    - after the Technical Plan heading, a table mapping sections to steps: 1–6, 10, 12, 13 → step 1
      (13 is Step 0); 7, 8 → step 2; 9, 11 → step 3; section 4's company rules → step 3; section
      2's manager and writer rows → step 2;
    - tag each CUJ heading with its step;
    - add CUJ 7, "Support recovers a company's owner" (step 3), and a manager variant to CUJ 2 (a
      manager invitation accepted from a different email waits for the owner to confirm);
    - name the member and change-set review screens under section 7 and section 8.

### [Issue 11] M10 [`structural`, `style`] - Severity: Major

*   **Affected Scope:** Alternatives F and V (the inline assumptions); section 8.
*   ***AI Suggestion:*** PROPOSE FIX (the "Proposed rule" half was fixed in Stage 9).
*   ***Proposed Edit:*** add two Open Questions: "Stripe sorts connected accounts by legal form
    (individual or company), not by headcount" and "Apple sign-in may hand over a relay address,
    so an invited email may not match the accepting account". Alternatives F and V refer to them.

### [Issue 12] M11 [`structural`] - Severity: Major

*   **Affected Scope:** header; sections 4 and 5.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** the "Related" line (Issue 5) says: "Changes
    [ADR 003](../adr/003-payments-destination-charges.md): the destination is the profile's payout
    account, not the teacher's; commission stays on the profile." Section 5 says
    `payment_intent_data.transfer_data.destination` instead of "the checkout session's
    destination".

### [Issue 13] M12 [`style`] - Severity: Major

*   **Affected Scope:** lines 20–21, 68, 162; section 2; section 8 "Evidence"; Alternative S.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:***
    - Open Questions, the dashboard link: "it is clear who it lets in" becomes "which person the
      Express dashboard login link signs in for a company account: the representative Stripe holds,
      or the owner's email";
    - section 2: add the role-by-capability table (owner, manager, writer, staff × the 16
      capabilities); the Overview role table points to it;
    - line 68: replace "About 300 lines across 41 files" with the measured figure: "186 lines in 27
      files match `teacherId|teacher_id|teacherProfile|teacher_profiles|teacherProfiles` (git grep
      over `apps` and `packages`, migrations excluded, 2026-11-11)". *Note: the earlier figure came
      from the brainstorm reviewers with a wider pattern; this one is re-measured and repeatable.*
    - section 8: "Evidence that this works." becomes "Scratch-project test results."; Alternative S
      says "relational queries over views returned only live rows in a scratch project; generating
      the migration is untested".

### Nits

| Id | AI Suggestion | Proposed Edit or reason |
|---|---|---|
| design-1-9 | fixed | Invitations are now counted in the database (section 7). |
| design-1-10 | fixed | `profiles.type` does not change in this build (1.2). |
| design-1-11 | PROPOSE FIX | Section 12: say the old API errors between reset and redeploy (already added), that `0000` creates the extensions, and that old test-mode accounts with `elevateUserId` metadata will store `unknown_account` errors and can be ignored. |
| design-1-13 | PROPOSE FIX | Covered by Issue 10 (screens named). |
| structural-1-8 | DECLINE | Bold labels inside sections are readable; changing them to H4 adds headings to an already long document. |
| structural-1-9 | DECLINE | Mixed bullet markers render the same. |
| structural-1-10 | PROPOSE FIX | Rename "Promotion, for the later brief" to "Options kept open for the promotion brief" and say they are not alternatives to this design. |
| structural-1-11 | DECLINE | Plain section references are clear in a single file. |
| structural-1-12 | PROPOSE FIX | Keep the view-generation gap only in Open Questions; section 8 "Not tested" and section 13 point to it. Inline rejections in sections 5 and 8 point to the Alternatives by letter. |
| structural-1-13 | PROPOSE FIX | Non-Goals: "Google and Apple sign-in, which is a later brief." The SSO rejection stays in Alternative A only. |
| style-1-n1 | PROPOSE FIX | "the code assumes that everywhere" → "the schema, every Teach route and the payment code assume that". |
| style-1-n2 | PROPOSE FIX | "breaks in four ways" → "breaks in three ways", and point 4 becomes the reason to act now. |
| style-1-n3 | PROPOSE FIX | "are guesses until one arrives" → "are untested until a real company onboards". |
| style-1-n4 | fixed | Goal 5 now says what the totals must equal. |
| style-1-n5 | PROPOSE FIX | Drop the last sentence of Goal 13; Goal 14 states it. |
| style-1-n6 | fixed | Section 1 now explains the promotion overlap. |
| style-1-n7 | PROPOSE FIX | "Missing profiles return 404" → "Inaccessible profiles return 404". |
| style-1-n8 | fixed | Section 5 now names the case. |
| style-1-n10 | PROPOSE FIX | Section 13: drop "moved past beta but is not a stable release"; move the "Risk" paragraph into Risks & Mitigations. |
| style-1-n12 | DECLINE (part) and PROPOSE FIX (part) | Use "earnings follow the payout account" in both places. `teacher_not_payable` keeps its name on purpose (already stated in 1.20); DECLINE renaming it. |
