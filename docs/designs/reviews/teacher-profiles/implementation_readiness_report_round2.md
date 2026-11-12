Status: resolved without a further review round (the re-audit cap was reached)

**Resolution (2026-11-11):** the author chose "fix them, no re-review". All Blockers and Majors
were fixed in the design, and most Nits. The change-set apply procedure (2.8) was rewritten with
named terms (copied and new drafts, the map), parent-first updates that never write a live ID onto
a draft row, per-lesson prerequisites, stored resolutions and explicit handling of live-only rows,
removed new drafts and stale IDs. Three product decisions were made by the author: dashboard
refunds email the learner and the owner; a rejected corporate application can be edited and
resubmitted by its owner; only the owner changes roles, on corporate profiles. The fixes have not
been read by a fresh reviewer.

# Stage 9: Implementation Readiness Report (round 2, the one allowed re-audit)

-   **Target:** `docs/designs/teacher-profiles.md`, lines 1037–2144 (commit `dc5a256`)
-   **Date:** 2026-11-11
-   **Reviewers** (fresh, no access to earlier reports):
    - `egm-implementation-readiness`: completed, 1 Blocker, 9 Major, 10 Nit;
    - `egm-codebase-details`: completed, 4 Blocker, 8 Major, 9 Nit;
    - `egm-style`: completed, 4 Major, 14 Nit.
-   **Verdict:** not ready. Round not clean. This was the one re-audit the review allows, so the cap
    is reached.

Ids: `ir2-n`, `cd2-n`, `st2-n`. "Verified" marks claims I checked against the code. Elephant notes
are mine.

**What improved since round 1:** both code reviewers confirmed every quoted line reference, the full
file lists for 0.8, 1.32 and 1.34, the deploy step names, and the Terraform and template claims.
The round 1 problems (wrong files, missing contracts, the reset order) are not raised again. What
remains is mostly in the change-set apply procedure, which is still the weakest part of the design.

---

## Blockers

### R2-B1. Approval breaks the unique index on `quizzes.artefact_id` (ir2-B1, cd2-B3)

-   **Where:** 2.2 (line 1712–1714), 2.8 step 6 (line 1796).
-   **Finding:** step 6 rewrites every draft quiz's `artefact_id` through the map. For a copied quiz
    that gives the live artefact's ID, which the live quiz already holds, while the draft quiz still
    exists until step 9. Any change set on a course with a quiz fails. Verified
    (`courses.ts:102–105`).
-   **Fix:** rewrite `lesson_id` and `artefact_id` only on new (promoted) drafts. For copied drafts,
    put the mapped value into the update of the live row and leave the draft row unchanged. Add a
    test with a quiz.

### R2-B2. Prerequisites are saved per lesson, not per course, and approval can hit the primary key (cd2-B2)

-   **Where:** 2.8 step 7 (lines 1798–1801); section 8 "Storage" (outside the range, but the basis).
-   **Finding:** `setPrerequisites` replaces one lesson's links (`courses.service.ts:381`, verified),
    and the contract is per lesson. So "replace the course's set, as the editor does today" is
    wrong. Also, `lesson_prerequisites` has primary key `(lesson_id, prerequisite_lesson_id)`
    without `change_set_id` (verified, `courses.ts:74`). A link between two new lessons maps to
    itself, so step 7 inserts a row identical to the draft row still present: a primary-key
    violation.
-   **Fix:** describe today's rule correctly; in step 7, delete the draft link rows before inserting
    the mapped set, or add `change_set_id` to the primary key (it would then need a default for
    live rows, so deleting first is simpler).

### R2-B3. The migration guard cannot pass (cd2-B1)

-   **Where:** 1.8a (lines 1243–1252).
-   **Finding:** `courses.reviewed_by` and `payments.user_id` (the learner) still reference `users`,
    correctly. The guard as written fails on them.
-   **Fix:** name the columns: `courses.profile_id`, `payments.profile_id`,
    `payments.payout_account_id` and `media_assets.profile_id` must not reference `users`.

### R2-B4. Dashboard refunds send no email today (cd2-B4)

-   **Where:** 1.22 (lines 1465–1467).
-   **Finding:** only `refund` emails the learner (`transactions.service.ts:191`, verified).
    `applyChargeRefunded` and `applyRefund` send nothing, so "in addition to today's learner email"
    is wrong for dashboard refunds.
-   **Fix (needs a decision):** dashboard refunds email the owner only, or the owner and the learner.

---

## Major

### R2-M1. Change-set conflicts and choices are incomplete (ir2-M1, ir2-M2, ir2-M3, st2-n6, st2-n14)

-   a live row the owner adds after opening counts as a conflict but has no draft, so choices keyed
    by `draftId` can never resolve it: leave live-only additions out of the check, or key by
    `liveId`;
-   no column stores the choices: add `resolutions jsonb` to `course_change_sets`;
-   `keep: 'live'` on a lesson cascades to the writer's new artefacts in it, against the "nothing
    added is lost" guarantee: say what happens to its draft children;
-   a new draft marked `removed` goes live, because step 4 promotes every new draft: skip `removed`
    in step 4, or delete a new draft when it is removed;
-   after the change set opens, which row an edit hits is undefined: a stale live ID from a writer,
    a draft ID from an owner, and whether the 1.17 lookup matches draft rows (it would, by
    `course_id`). Proposed: map live IDs to drafts for actors without `editLive`, refuse draft IDs
    for actors with it (404), and the builder always loads `?draft=1` while a change set is open;
-   "`approve` then succeeds" should be "no longer reports the resolved conflicts".

### R2-M2. Service signatures need the actor, not just a profile ID (ir2-M4, cd2-n9)

-   1.17 says every function takes `profileId`; 1.15 and 2.9 need the actor's capabilities. State
    `(actor: Actor, courseId, …)`. `MediaService` is outside the profile path, so `loadActor` must
    be callable on its own. `requireProfile` needs `deps` for its lookup.

### R2-M3. Staff in the Teach client do not work (ir2-M5, cd2-M7)

-   a `super_admin` acting as staff is not in `user.profiles`, so `ProfileProvider` cannot find the
    profile and `gate.tsx` sends them to `/apply`. Proposed: `ProfileProvider` falls back to
    `GET profile` and takes `role = 'staff'` from `actingAsStaff`; `gate.tsx` lets `super_admin`
    through on `/p/*`; the client role type gains `staff`.

### R2-M4. Unapproved profiles get full capabilities (ir2-M6, cd2-M8 in part)

-   Today an applicant has no `teacher` role and cannot reach course routes. In the plan an
    `applied` or `rejected` owner resolves as `owner` with everything, which breaks Goal 7.
    Proposed: on a profile that is not approved, only `profile.read` and `profile.edit` are granted.
    The People "learner" filter (`people.service.ts:94–102`) needs a new definition too:
    proposed, a user who owns no profile and has no membership.

### R2-M5. Member and invitation API is not specified (ir2-M7, ir2-M8)

-   no methods or paths for list, invite, revoke, remove, confirm and `changeRole`; no rules for
    `changeRole`; 2.13 gives no fields;
-   nothing moves an invitation to `expired`, so an expired `pending` row blocks re-inviting under the
    partial unique index. Proposed: treat `expires_at < now` as expired and set the status lazily on
    invite, list and accept; a second invite to a pending email resends it; resends count toward the
    20.

### R2-M6. Clocks: database time against `deps.now()` (cd2-M2)

-   `sessions.created_at` and `profile_invitations.created_at` use the database default, while the
    checks use `deps.now()` (fixed in tests). Verified: `createSession` sets only `expiresAt`.
    Proposed: both inserts write `createdAt: deps.now()`.

### R2-M7. Learner-read guard still has a hole (cd2-M3)

-   learner services still receive the raw `db`, so `deps.db.query.lessons` is typed, and the guard
    scans only for `s.lessons`. Proposed: the guard also fails on
    `db.query.(lessons|artefacts|quizzes|lessonPrerequisites)` and on `with: { lessons` in the
    learner-facing files.

### R2-M8. Other gaps

-   **Step 1 file boundary (cd2-M1):** `learning.service.ts` and `courses.service.ts` use the
    `teacher` join (13 places, not about 8) and are missing from step 1.
-   **`GET stripe/status` writes (cd2-M4):** it calls Stripe and can activate an account, so it is
    not read-only. Proposed: keep it on `profile.read` and record that a GET may update the flags,
    or give it `stripe.links`.
-   **Media and `support_agent` (cd2-M5):** Support previews course media and teaching samples today
    through `support_agent`. The new rule must keep `hasRole(user, 'support_agent')`.
-   **Idempotency-key test (cd2-M6):** the fake provider has no key. Proposed: export the key builder
    and test it directly.
-   **Corporate re-application (ir2-M9):** a rejected entity keeps its UEN, so re-applying gets 409.
    Needs a decision: update in place, free the UEN on rejection, or rejection is final.
-   **Wording (st2-1 to st2-4):** the goal-to-test mapping is claimed for 2.16 and 3.13 but is only in
    1.36; "step" means both the plan step and the reset procedure step in D.4; Goal 15 has no exit
    step; the production reset approver is "the author" in one place and "the reviewer" in another.

---

## Nits (selected)

| Id              | Finding                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ir2-N1, st2-3   | Goals 3 and 8 cannot be shown at the end of step 1 (the route test is step 2; Goal 8 is measured on staging).                                             |
| ir2-N2          | Name-check ordering: match before charges enabled; `active` falling back when charges are disabled.                                                       |
| ir2-N3          | `pending.tsx` shows Stripe and name-check steps for an approved corporate profile, against 1.30's rule.                                                   |
| ir2-N4          | A personal email change must also update `identities.providerSubject`.                                                                                    |
| ir2-N5, cd2-n6  | Ledger row fields and the old `teacherId` checkout metadata key are not settled.                                                                          |
| ir2-N6, cd2-n7  | The seed's storage writer needs an explicit provider name; promo codes need a seed mode.                                                                  |
| ir2-N7          | D.4's `run-task` commands leave out `--cluster`, `--launch-type` and `--network-configuration`.                                                           |
| cd2-n1, cd2-n2  | `createLearnerDb` takes the client those functions return; the relation key is `quiz`, not `quizzes`.                                                     |
| cd2-n3          | The learning service already returns 404 for IDs not in the loaded graph, so no extra view lookup is needed.                                              |
| cd2-n4          | Invitation tokens should reuse `randomToken` and the HMAC helper, not plain SHA-256.                                                                      |
| st2-5 to st2-18 | Wording and formatting: results stated before they exist, an item placed in the wrong step, "slice" against "step", deferred version values, indentation. |
