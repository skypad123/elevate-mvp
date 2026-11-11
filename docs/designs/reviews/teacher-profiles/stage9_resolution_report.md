Status: resolved

# Goldfish Annotated Review Report

**Target:** `docs/designs/teacher-profiles.md` (lines 875–1749, Detailed Implementation Plan)

**Resolution (2026-11-11):** the author chose IB1 option A (keep change sets, specify the apply
step) and IB2 option B (one reusable payout account per profile), then auto-accepted. Applied: all
16 findings and the 13 nits marked PROPOSE FIX. Declined: st-n2, st-n6, cd-N7. Contested and
escalated: none. Where a fix touched the Technical Plan (sections 1, 4, 5, 6, 7, 8, 12, Goal 5 and
the ER diagram), it was changed there too so the two parts agree. Two follow-ups stay open by
design: the exact RQB v2 `RAW` filter syntax (checked at the start of Step 0) and the UEN patterns
(checked against ACRA before step 3).

**Source findings:** `implementation_readiness_report.md` (Stage 9, round 1). Ids such as IB1 and
IM4 refer to that report.

**Count:** 16 findings plus nits. 0 CONTEST, 0 ESCALATE, 2 PROPOSE FIX that need an author decision
first, 14 PROPOSE FIX, nits: 13 PROPOSE FIX and 3 DECLINE.

**Read this first.** IB1 and IB2 each have two ways to fix them, and the choice is architectural,
so it is the author's. The choice also decides what IM1, IM2, IM4, IM5 and IM11 need:

| If the author picks | Then |
|---|---|
| IB1 option B (Alternative N) | IM1 and IM2 are deleted; Step 0 is deleted, so IM4 is deleted and most of IM5 goes |
| IB2 option B (one reusable account) | the Goal 5 fixture in IM11 goes; IB2's state machine shrinks to three items |

Fixes for the other findings do not depend on these choices and can be applied either way.

All edits below are to the Detailed Implementation Plan. Where a fix must also change the Technical
Plan so the two agree, the edit says so.

## Prioritized Findings & AI Suggestions

### [Issue 1] IB1 [`implementation-readiness`, `codebase-details`] - Severity: Blocker

*   **Affected Scope:** [Lines 1401–1479](docs/designs/teacher-profiles.md#L1401-L1479) (2.2, 2.8, 2.9); Technical Plan section 8.
*   **Discrepancy Description:** approval never remaps draft IDs to live IDs, so deleting draft
    lessons cascades and deletes new artefacts; prerequisite apply and conflict rules, `source_id`
    delete behaviour and deleted live rows are undefined.
*   **Rationale:** an implementer would have to design the apply algorithm (Zero-Decision Rule).
*   ***AI Suggestion:*** PROPOSE FIX, **author decision needed**.
*   ***Justification:*** the finding is correct (`artefacts.lesson_id` cascades,
    `packages/db/src/schema/courses.ts:83–85`). Four review stages found this. There are two valid
    fixes:
    - **Option A, keep change sets and specify the apply step.** Writes a merge procedure into 2.8.
      Keeps the views, the learner client and Step 0. Leaves IM1 and IM2 to fix as well.
    - **Option B, adopt Alternative N.** Writers edit draft, rejected and never-submitted courses;
      on a live course they are refused. Removes 2.2's columns, the views, `learner-relations.ts`,
      2.4–2.6, 2.8, the change-set part of 2.9, 2.10's change-set routes, `change-set-review.tsx`,
      `change-sets.test.ts`, Goal 11, CUJ 3 and Step 0. Held live edits become a later brief, as an
      additive migration.
*   ***Proposed Edit:***
    *   **Option A**, location 2.8: replace "approve (applies as in section 8, conflict check
        first)" with an ordered procedure, in one transaction:
        1. lock the change set and its course;
        2. conflict check: a live row is in conflict if its `updated_at` is after
           `opened_at_snapshot`, **or** a draft row's `source_id` no longer exists; prerequisites are
           in conflict if the live set of links differs from the set copied at opening (stored as
           `opened_prerequisites` JSON on `course_change_sets`);
        3. build a map from each draft ID to its live ID (`source_id`, or the draft's own ID for
           new rows);
        4. lessons: update each live lesson from its draft (all columns except `id`, `course_id`,
           `change_set_id`, `source_id`); clear `change_set_id` on new lessons;
        5. artefacts: rewrite `lesson_id` through the map, then the same update and clear;
        6. quizzes: rewrite `artefact_id` through the map, then the same update and clear;
        7. prerequisites: delete the course's live links and insert the draft links with both ends
           rewritten through the map (matching `setPrerequisites`, `courses.service.ts:360`);
        8. delete live rows whose draft is marked `removed`;
        9. delete all remaining rows with this `change_set_id`; set the change set to `approved`.

        `source_id` gets `on delete set null`, so an owner deleting the live row leaves a draft
        with a null `source_id` and the step 2 check reports it. Section 8 "Approval" is shortened
        to the invariants: "approval keeps live IDs, applies all edits or none, and reports
        conflicts". Add to `change-sets.test.ts`: a new artefact in an existing lesson survives
        approval; a prerequisite added and one removed both apply; an owner deleting a live lesson
        during the change set is reported as a conflict.
    *   **Option B**: delete the items listed above; in 2.9 replace the change-set routing with
        "writers without `course.editLive` get 403 `course_live` on any edit to a course whose
        status is `live` or `pending_review`"; rewrite Goal 11 as "Writers cannot change a live
        course" with a role-route test; move Alternative N's text to the chosen design and record
        held change sets as a rejected alternative with the review cost as the reason.

### [Issue 2] IB2 [`implementation-readiness`, `codebase-details`] - Severity: Blocker

*   **Affected Scope:** [Lines 1159–1201](docs/designs/teacher-profiles.md#L1159-L1201) (1.18, 1.19, 1.21); Technical Plan sections 1, 4, 6.
*   **Discrepancy Description:** onboarding can create a second account; nothing retires one;
    `syncStatus` has no activation rule; creation order and `stripe_account_id` nullability are
    undefined; return URLs are not moved; `displayName` is dropped silently.
*   **Rationale:** the state machine is left to the implementer.
*   ***AI Suggestion:*** PROPOSE FIX, **author decision needed** on one part.
*   ***Justification:*** correct (`connect.service.ts:28–51, 64–84`). The `retired` state and
    movable accounts exist only for promotion, which is a Non-Goal.
    - **Option A, keep `retired` and movable accounts.** Add a Support-only "retire payout
      account" action, a test-only path, or say no flow reaches it and keep the fixture as a direct
      insert.
    - **Option B, one reusable account per profile in this build.** Keep the `payout_accounts`
      table and `payments.payout_account_id`, which is what is costly to add later. Keep `status`
      as `onboarding` and `active` only. Drop `retired`, `retired_at`, the changeable `profile_id`
      and the "one active" partial index (replaced by a unique `profile_id`). Promotion adds them
      later as additive changes.
*   ***Proposed Edit:*** whichever option is chosen, add to 1.18:
    - `onboardingLink` reuses the profile's existing non-retired account, whatever its status,
      and reissues the link for it; it creates an account only when none exists;
    - creation order: insert the `payout_accounts` row with `stripe_account_id` null, call Stripe
      with its ID in metadata, then set `stripe_account_id`, in one transaction (the column becomes
      nullable and stays unique);
    - one function, `applyAccountState(account, flags)`, holds the activation rules; both
      `ConnectService.applyAccountUpdated` and `syncStatus` call it;
    - return and refresh URLs become `${TEACH_URL}/p/:profileId/stripe/return` and `/refresh`;
    - `createConnectedAccount` keeps `displayName` and passes the profile's display name as
      `business_profile.name`;
    - `businessType` is taken from the profile type: `personal` gives `individual`, `corporate`
      gives `company`.

    Option B also edits section 1, section 6, Goal 5 ("money is grouped by payout account",
    measured with one account per profile and a payment whose `payout_account_id` is checked) and
    the 1.36 fixture.

### [Issue 3] IB3 [`implementation-readiness`] - Severity: Blocker

*   **Affected Scope:** [Lines 1702–1723](docs/designs/teacher-profiles.md#L1702-L1723) (D.4, D.6); Technical Plan section 12.
*   **Discrepancy Description:** `reset-schema` is only in the new image, and the deploy that
    builds it migrates before any reset is possible.
*   **Rationale:** the stated order cannot be run.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Justification:*** correct. `deploy.yml` builds the image, registers the task definition,
    then runs `migrate.js` and stops on failure, leaving the running API untouched (lines 84–112). It
    reuses an existing image for the same commit and supports `workflow_dispatch`.
*   ***Proposed Edit:*** replace section 12's "Order in each environment" and D.4's procedure with:
    1. push the commit to the environment branch. The deploy builds the image and registers the
       task definition, then **fails at the migration step, as expected**; the running API is left
       on the old version;
    2. run `reset-schema` as a one-off task with the task definition that deploy just registered
       (`aws ecs list-task-definitions --family-prefix <family> --sort DESC --max-items 1`), with a
       container override of the command and `ALLOW_SCHEMA_RESET=yes` in the environment;
    3. re-run the Deploy workflow for that branch with `workflow_dispatch`. It reuses the image,
       applies the new `0000`, and rolls the service;
    4. run `seed --demo` (staging) or `seed --admin-only` (production) as a one-off task with the
       same task definition.

    The old API serves errors between steps 2 and 3; this is accepted because there are no users.
    Production needs the reviewer's approval in steps 1 and 3. D.6 becomes "No change: the
    procedure above uses the existing workflow, including its expected failure in step 1."

### [Issue 4] IB4 [`codebase-details`, `implementation-readiness`] - Severity: Blocker

*   **Affected Scope:** 1.11–1.16, 1.21, 1.27.
*   **Discrepancy Description:** several items name the wrong file.
*   **Rationale:** the file list would send the implementer to the wrong places.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Justification:*** each was checked against the code.
*   ***Proposed Edit:***
    - 1.14: replace `apps/api/src/lib/request-context.ts` with `apps/api/src/middleware/auth.ts`
      (`AppEnv`, lines 9–14);
    - 1.13: add `apps/api/src/services/auth.service.ts`; `buildAuthUser` (lines 206–230) builds
      `profiles`; the middleware only adds `requireProfile`;
    - 1.16: Support `approve`, `reject` and `setCommission` move from `teachers.service.ts`
      (lines 123–246) to `profiles.service.ts`; `approve` no longer inserts the `teacher` role; the
      email links become `${TEACH_URL}/p/:profileId`;
    - 1.11: `roleSchema` loses `teacher` in `packages/core/src/contracts/common.ts:6`; 1.12:
      `TeacherSummary` in `packages/core/src/contracts/auth.ts:24` becomes `ProfileSummary`;
    - 1.21: the rules go into `ConnectService.applyAccountUpdated` (`connect.service.ts:87–100`)
      through `applyAccountState` (Issue 2); an unknown account **throws** an `unknown_account`
      error, which `routes/webhooks.ts:59–65` already stores in `webhook_events.error`; Stripe's
      retry is then acknowledged as a duplicate. Add `routes/webhooks.ts` to the list only if its
      behaviour changes (it does not);
    - 1.27: new emails use `simpleEmail(...)` inline in the services, as all teacher emails do now;
      `templates.ts` is not changed.

### [Issue 5] IM1 [`implementation-readiness`, `codebase-details`] - Severity: Major

*   **Affected Scope:** 2.3, 2.4, 1.37, 2.16.
*   **Discrepancy Description:** the import scan misses `s.lessons`; raw reads still type-check;
    learner relations are missing tables; `learnerDb` wiring is undefined.
*   ***AI Suggestion:*** PROPOSE FIX (only if IB1 option A; deleted under option B).
*   ***Justification:*** correct; learner services use `schema as s` (`catalog.service.ts:9`).
*   ***Proposed Edit:*** 2.3: the learner relations include `courses`, the four views, `mediaAssets`,
    `profiles`, `users` (name and avatar only), `userRoles`, enrolments, progress, attempts and
    certificates. `createLearnerDb(client)` takes the same client as `createDb` and `createPgliteDb`
    and returns `LearnerDb`. 2.4: `Deps` gains `learnerDb: LearnerDb`. The guarantee is stated
    honestly: the types remove `query.lessons`, but `select().from(s.lessons)` still compiles, so
    the scan test is the guard. 1.37 and 2.16: the scan fails on `s.lessons`, `s.artefacts`,
    `s.quizzes`, `s.lessonPrerequisites` and named imports of them, in an allow-list form: only
    `courses.service.ts` and `change-sets.service.ts` may use them.

### [Issue 6] IM2 [`implementation-readiness`] - Severity: Major

*   **Affected Scope:** 2.8–2.10.
*   ***AI Suggestion:*** PROPOSE FIX (only if IB1 option A).
*   ***Proposed Edit:*** add to 2.10: `GET courses/:id?draft=1` returns the open change set's tree
    with draft IDs plus `sourceId` on each item; the builder uses draft IDs after the first edit;
    the first edit on a live ID opens the change set and responds with the draft tree so the client
    swaps IDs; `POST courses/:id/change-set/approve` returns `409 { code: 'change_set_conflict',
    conflicts: [{ kind, liveId, draftId }] }`; `POST .../resolve` takes `{ choices: [{ draftId,
    keep: 'live' | 'draft' }] }`.

### [Issue 7] IM3 [`implementation-readiness`] - Severity: Major

*   **Affected Scope:** [Lines 1127–1138](docs/designs/teacher-profiles.md#L1127-L1138) (1.15).
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** add a table to 1.15 with one row per route: method and path, capability,
    and whether the course status changes it. Examples: `GET courses` → `profile.read`;
    `PATCH courses/:id` → `course.editDraft` when the status is `draft` or `rejected`,
    `course.editLive` when `live`, refused when `pending_review`; `PUT courses/:id/price` →
    `course.setPrice`; `GET stripe/status` → `profile.read` (read-only, so managers and staff can see
    it); `POST stripe/*-link` → `stripe.links`. Status-dependent checks run in the service after
    the course loads, through `can`. `role-routes.test.ts` reads this table as its expected values.

### [Issue 8] IM4 [`implementation-readiness`, `codebase-details`] - Severity: Major

*   **Affected Scope:** 0.5–0.9, 1.7.
*   ***AI Suggestion:*** PROPOSE FIX (deleted if IB1 option B removes Step 0).
*   ***Proposed Edit:*** 0.8: SQL-expression filters (`eq`, `and(...)`, `exists`, `ilike`, the
    people cursor) move to RQB v2's raw-SQL filter (`where: { RAW: (t) => ... }`); `orderBy` arrays
    become the callback form; `listSummaries(where)` takes a `RAW` filter. 0.6: add
    `packages/db/src/index.ts`; `Db`, `PgliteDb` and `AnyDb` take the relations type. 0.5 and 1.7:
    list each renamed or removed relation (`users.teacherProfile`, `users.courses`,
    `teacherProfiles.teachingSample`, `mediaAssets.owner`, `payments.teacher`), give the
    replacement `with:` tree (`profile: true`), and map each `relationName` to an explicit
    `from`/`to` pair. 0.10: also check that the RC keeps `NNNN_name.sql` and `meta/_journal.json`;
    if not, `migrations-folder.ts`, `migrate.ts` and the Dockerfile `COPY` change with it.
    *Note: the exact RQB v2 filter syntax must be checked against the 1.0 docs during Step 0.*

### [Issue 9] IM5 [`implementation-readiness`, `style`] - Severity: Major

*   **Affected Scope:** [Lines 886–891](docs/designs/teacher-profiles.md#L886-L891), 0.10, 1.8.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** new item 1.8a, `packages/db/scripts/generate.ts` (Create): runs
    `drizzle-kit generate`, then adds the `citext` and `pg_trgm` lines (and, if 0.10 shows the kit
    does not emit views, the view SQL) to the top of the generated `0000`. `npm run db:generate`
    calls it, so regenerating keeps them. A test checks that `0000` starts with the extension lines.
    Replace "is generated once, at the end of step 1" with "is first generated at the end of step
    1, then regenerated at the end of steps 2 and 3". Remove the `--custom` fallback from 0.10.

### [Issue 10] IM6 [`implementation-readiness`, `codebase-details`] - Severity: Major

*   **Affected Scope:** 1.11, 1.12, 1.17, 1.32.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** add to 1.12:
    - `TeacherProfileView` becomes `ProfileView`: `id`, `type`, `status`, the application fields,
      `commissionBps`, `payout: { status, chargesEnabled } | null`, `actingAsStaff`;
    - `CourseView.teacher` becomes `CourseView.profile`: `{ id, displayName, ownerEmail, payable }`;
      `CourseSummary.teacherName`/`teacherEmail` become `profileName`/`ownerEmail`;
    - `PersonSummary.teacher` and `PersonDetail.teacherProfile` become `profiles: ProfileSummary[]`;
    - the public card in `contracts/catalog.ts:60` keeps its shape; `teacher.id` becomes the
      profile ID.

    1.17: `validateCourseForSubmission` takes `payable` (active payout account with charges
    enabled) in place of `teacherStripeChargesEnabled`. 1.32: `details-form.tsx` reads commission
    from `GET profile`; `layout.tsx` reads the display name from `ProfileProvider`;
    `review-course.tsx` uses `course.profile`.

### [Issue 11] IM7 [`implementation-readiness`, `codebase-details`] - Severity: Major

*   **Affected Scope:** [Lines 1217–1225](docs/designs/teacher-profiles.md#L1217-L1225) (1.23).
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** add to 1.23: any member of the course's profile, and staff, can preview an
    unpublished course (`catalog.service.ts:136–139`). Teacher cards use the profile's avatar
    (`avatar_media_id`); a personal profile with no avatar falls back to the owner's
    `users.avatarUrl`, so cards look as they do today (Goal 7); a corporate profile with none shows
    initials. Add `avatarMediaId` to the profile update schema (1.12) and an avatar upload to
    `settings.tsx` (1.32).

### [Issue 12] IM8 [`implementation-readiness`, `codebase-details`] - Severity: Major

*   **Affected Scope:** 1.20, 1.22; Technical Plan section 6.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** 1.20: `fulfilCheckout` gains the outcome `'unattributed'` when payee
    metadata is missing or names no account. The webhook path throws on it, so it is stored in
    `webhook_events.error`; `syncSession` returns `status: 'pending'` and logs an error. The
    `firstPayout` event (`payments.service.ts:344–359`) is counted per profile: the first payment
    on any of its payout accounts, measured from profile approval; `userId` is the owner's user ID;
    properties are `profileId` and `payoutAccountId`. 1.22 keeps only the median in
    `analytics.service.ts`. Section 6 is changed to say per profile.
*   **Note:** Stage 5 (B2) proposed recording these payments as unattributed and taking the payee
    from the Stripe destination. That is a larger change to section 5 and is not part of this fix.

### [Issue 13] IM9 [`codebase-details`] - Severity: Major

*   **Affected Scope:** 1.16, 1.30, 1.32.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** 1.16: `apply` updates the user's personal profile in place when it is
    `applied` or `rejected`, as today, and refuses with `409 profile_exists` only when it is
    `approved`. 1.30: `/apply` stays outside profiles; any page under `/p/:profileId` shows the
    pending page when that profile is not approved; `/` opens the last-used profile if it is still
    in the list, else the first approved one, else the first one; the switcher lists every profile
    with its status, so a writer on an approved profile whose own application is pending can use
    both. `urls.ts`: "create helpers", not "helpers take a profile ID".

### [Issue 14] IM10 [`implementation-readiness`, `codebase-details`] - Severity: Major

*   **Affected Scope:** 1.28, 1.29, 3.12.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** demo profiles get **no** payout account, so demo courses are unpayable, as
    today. 3.12's corporate demo profile gets none either. `seed --admin-only` and `--demo` both
    fail with a clear error when `SEED_SUPER_ADMIN_EMAIL` is missing; `--admin-only` creates only
    the super admin (no support agent, no learner). The seed's media rows take `provider` from the
    storage provider passed in, not the hard-coded `'local'` (`seed/index.ts:109`).

### [Issue 15] IM11 [`implementation-readiness`, `style`] - Severity: Major

*   **Affected Scope:** 1.36, Verification Plan.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:*** 1.36: `profile-isolation.test.ts` creates the second profile with a direct
    database insert of a `corporate` profile owned by the same user, since step 1 has no other way;
    the Goal 5 fixture (if IB2 option A) is a direct insert too, and says so. Tag every test with
    its goal: `permissions.test.ts` and `role-routes.test.ts` → Goal 3; the fulfilment cases in
    `payout-accounts.test.ts` → Goal 4; the Verification Plan's migration check → Goal 8. Replace
    "Every goal in Goals maps to at least one named test" with that list.

### [Issue 16] IM12 [`codebase-details`, `style`, `implementation-readiness`] - Severity: Major

*   **Affected Scope:** 1.5, 1.24, 1.26, 1.38, 2.11, 3.2.
*   ***AI Suggestion:*** PROPOSE FIX.
*   ***Proposed Edit:***
    - 1.26: add `packages/core/src/contracts/media.ts` (`createUploadSchema` gains `profileId`) and
      `packages/web-ui/src/components/MediaUploader.tsx` (passes it); the rule goes into
      `getOwnedAsset` (`media.service.ts:197`); 1.5 drops "step 2 makes access checks use it";
    - 1.38: drop the `signed_in_at` column; `requireRecentSignIn` uses `sessions.createdAt`, which is
      set only at sign-in (`auth.service.ts:150, 168–183`); `packages/db/src/schema/auth.ts` is
      removed from the item; Technical Plan section 4 changes to match;
    - 1.24: the commission route keeps `requireRole('super_admin')`; remove `PeopleService.setRole`'s
      `teacher` branch and the `role: 'teacher'` filters (`people.service.ts:89–113, 187–191`);
    - 2.11: drop `rate-limit.ts`; invitations are counted in the database (`profile_invitations`
      rows for the profile with `created_at` in the last 24 hours, using `deps.now`), so the limit
      survives restarts and is testable;
    - 3.2: companies use 9 digits and a letter (any year); LLPs use `T`, two digits, `LL`, four
      digits and a letter. The validator checks the pattern for the chosen `entity_type`. Cite
      ACRA's published UEN format, which must be checked before step 3.

### Nits

| Id | AI Suggestion | Proposed Edit or reason |
|---|---|---|
| ir-N2 | PROPOSE FIX | Keep `check-dupes.mjs` in 0.2 only; name the exact `drizzle-kit` RC version found in Step 0; drop "no `^` or `~`". |
| ir-N3, cd-N1 | PROPOSE FIX | 0.4 becomes "Verify, no change expected: the helpers set no column names." |
| ir-N5 | PROPOSE FIX | 1.25: staff entries use `action: 'staff.<route>'`, `entityType: 'profile'`, `metadata: { method, path }`. |
| ir-N6, st-n7 | PROPOSE FIX | Link `concepts_brief.md` where "the brief" is cited (a Stage 7 fix covers the FeatureRange). Goal 7 wording: "test changes are limited to fixtures, route paths and the renamed fields". |
| cd-N2 | PROPOSE FIX | 1.4: the `(teacher_id, paid_at)` index becomes `(profile_id, paid_at)`, plus `(payout_account_id, paid_at)`. |
| cd-N3 | PROPOSE FIX | 1.25: `recordAudit(deps, {...})` gains `profileId`. |
| cd-N4 | PROPOSE FIX | 1.37: the guard reads the generated `0000` and fails on any foreign key from `courses`, `payments` or `media_assets.profile_id` to `users` (also answers Stage 5 C3). |
| cd-N5 | PROPOSE FIX | 1.20: refunds made in the Stripe dashboard (`applyChargeRefunded`, `transactions.service.ts:244–278`) send the same owner emails. |
| cd-N6 | PROPOSE FIX | 0.1: bump `@electric-sql/pglite` in both `packages/db` and `apps/api`. |
| st-n1 | PROPOSE FIX | Use "step" in the Implementation Plan and add one line: "steps 1–3 are slices 1–3". |
| st-n2 | DECLINE | "Author" is the document's standard field name; the header names sky. |
| st-n3 | PROPOSE FIX | Drop the parenthesis. |
| st-n4 | PROPOSE FIX | "Intended to change syntax only; the existing suites confirm results are unchanged." |
| st-n5 | PROPOSE FIX | "otherwise cannot get back an owner who can sign in." |
| st-n6 | DECLINE | Line numbers are quoted with function names in most items, and step 0 does not move them much. |
| st-n7 | PROPOSE FIX | 1.33 becomes "No code change expected: the type change flows through"; move the refund change under 1.22's file list; D.5 names the boundaries (profile-scoped routes, `requireProfile`, learner reads only through views). Cross-references use "section N". |
| cd-N7 | DECLINE | Covered by Issue 8. |
