# Stage 9: Implementation Readiness Report (round 1)

-   **Target:** `docs/designs/teacher-profiles.md`, DetailedRange lines 875–1749
-   **Date:** 2026-11-11
-   **Reviewers:**
    - `egm-implementation-readiness`, against `implementation-readiness-standard`: completed, 3
      Blocker, 12 Major, 6 Nit;
    - `egm-codebase-details`, against `implementation-readiness-standard`: completed, 4 Blocker,
      21 Major, 7 Nit;
    - `egm-style`, with its persona rules: completed, 4 Major, 7 Nit.
-   **Context given to reviewers:** `docs/spec.md`, `docs/adr/003-payments-destination-charges.md`,
    and read-only access to the repository.
-   **Verdict:** **not ready.** Round not clean.

Findings raised by more than one reviewer are merged. Source ids are `ir-n` (implementation
readiness), `cd-n` (codebase details) and `st-n` (style). Notes marked "Elephant" are mine. Where
I checked a claim myself, it says "verified".

**What checks out:** the file list for the `db.query` rewrite (0.8), every Teach and Support screen
path, `client.ts:14`, `pglite.ts:18`, `drizzle.config.ts:7`, `courses.service.ts:191`,
`payments.service.ts:160–166, 201–214, 216–219, 288`, `stripe.ts:107`, the extensions in `0000`,
the non-unique position indexes, the unique `quizzes.artefact_id`, `NODE_ENV=production` on
staging, the "Seeding" known gap, and the AGENTS.md status rule. The step structure is sound.

---

## Blockers

### IB1. Change-set approval loses data and leaves prerequisites undefined (ir-B1, cd-B4)

-   **Where:** 2.2, 2.8, 2.9; Technical Plan section 8.
-   **Finding:** draft rows point at draft IDs. Approval never remaps them to live IDs, and deleting
    draft lessons cascades (`courses.ts:83–85`, verified) and removes new artefacts that were "made
    live". Updating in place copies a draft `lesson_id` or `artefact_id` onto the live row, pointing
    it at a row about to be deleted. `lesson_prerequisites` has no `id`, `source_id`, `removed` or
    `updated_at`, and `setPrerequisites` replaces the whole set (`courses.service.ts:360`). Nothing
    says what `source_id` does on delete, or how a live row deleted during the change set is
    detected.
-   **Needed:** a field-by-field apply algorithm with draft-to-live remapping in a stated order,
    the `source_id` delete behaviour, the prerequisite apply and conflict rule, and a test that a
    new artefact in an existing lesson survives approval.
-   **Elephant note:** this is the fourth review stage to find this. Stage 8 (Z1) argues the
    better fix is Alternative N, which removes the apply step entirely.

### IB2. Payout-account state changes are undefined (ir-B2, cd-M8 in part)

-   **Where:** 1.18, 1.21; Technical Plan section 4.
-   **Finding:**
    - an owner with an `active` account who clicks onboarding again gets a second Stripe account,
      and its activation then breaks the one-active index inside the webhook. Today the link is
      reissued for the existing account (`connect.service.ts:28–51`);
    - nothing retires an account or switches the active one, yet Goal 5 and the 1.36 test depend on
      it;
    - `syncStatus` (the fallback when webhooks lag, `connect.service.ts:64–84`) gets no activation
      rule, so without `stripe listen` locally, or on return from onboarding, a teacher can be left
      unpayable;
    - creating the row before the Stripe call (so metadata can carry `elevatePayoutAccountId`) needs
      `stripe_account_id` nullable, or the order reversed; neither is stated;
    - onboarding return and refresh URLs still point at `/stripe/return`, which moves under
      `/p/:profileId/`;
    - the new `createConnectedAccount` signature drops today's `displayName`
      (`business_profile.name`, `stripe.ts:45–48`).
-   **Needed:** a payout-account state machine: reuse a non-retired account for onboarding links;
    who retires and in what transaction; one activation function shared by the webhook and
    `syncStatus`; creation order and nullability; the new URLs.
-   **Elephant note:** Stage 8 (Z4) proposes dropping `retired` and movable accounts from this
    build, which removes most of this.

### IB3. The reset order cannot run with the deploy workflow unchanged (ir-B3)

-   **Where:** D.4, D.6; Technical Plan section 12.
-   **Finding:** `dist/reset-schema.js` exists only in the new image, and the only way to build and
    register that image is a push to `staging` or `production`. That workflow immediately runs
    `node dist/migrate.js` (`.github/workflows/deploy.yml:84–112`) against the database that has not
    been reset. The new `0000` then fails against existing objects. D.6's claim that the workflow
    needs no change is wrong.
-   **Needed:** an exact procedure, such as letting the first deploy fail at migration, running
    `reset-schema` with the task definition it registered, then re-running the workflow; or
    building and pushing the image by hand first. Production deploys need reviewer approval, so
    the steps must be written out.
-   **Elephant note:** D.6 was my addition; this finding is correct.

### IB4. Several items point at the wrong files (cd-B1, cd-B2, cd-B3, ir-M4, cd-M10, cd-M5, cd-M21)

-   **1.14:** `apps/api/src/lib/request-context.ts` only holds the request origin. Hono context
    variables live in `AppEnv` in `apps/api/src/middleware/auth.ts:9–14`, so `actor` goes there
    (verified).
-   **1.13:** `AuthUser` is built in `AuthService.buildAuthUser` (`auth.service.ts:206–230`), not in
    the middleware. `auth.service.ts` must be in step 1.
-   **1.16:** Support `approve`, `reject` and `setCommission` already live in `TeachersService`
    (`teachers.service.ts:123–246`, verified), not `people.service.ts`. `approve` also inserts the
    `teacher` role and emails links to `/pending` and `/apply`, which must change.
-   **1.11 and 1.12:** `TeacherSummary` is in `contracts/auth.ts:24`, and `roleSchema` is in
    `contracts/common.ts:6` (verified). The plan has them swapped.
-   **1.21:** `account.updated` is handled in `ConnectService.applyAccountUpdated`
    (`connect.service.ts:87–100`). `stripe-events.ts` only dispatches. Errors reach
    `webhook_events.error` only when a handler throws (`routes/webhooks.ts:59–65`, which then
    returns 500). `routes/webhooks.ts` is missing from the list, and the plan does not choose
    between throwing and a new stored outcome.
-   **1.27:** `templates.ts` exports only `magicLinkEmail` and `simpleEmail`. Teacher emails are
    inline `simpleEmail(...)` calls in the services. New named templates break that pattern; reuse
    `simpleEmail` or say why not.

---

## Major

### IM1. The learner isolation does not isolate (ir-M1, cd-M1, cd-M2, cd-M3)

-   **Import scan catches nothing:** every learner service uses `import { schema as s } from
    '@elevate/db'` and `s.lessons`, so a test for named imports passes on today's code. It must
    match `s.lessons`, `s.artefacts`, `s.quizzes` and `s.lessonPrerequisites`.
-   **Types do not block raw reads:** `learnerDb.select().from(s.lessons)` still type-checks, and
    learner services receive the whole `Deps` with the raw `db` (`deps.ts:9–18`), which they need
    for writes. "Does not exist in their types" is not delivered.
-   **Relations set incomplete:** catalogue reads need `thumbnail` and `artefacts.media`
    (media assets), the profile, and `userRoles`; `quoteFor` needs the profile for commission.
-   **Wiring undefined:** `Deps` has no `learnerDb`; PGlite tests have no pool; the signature and
    type of `createLearnerDb` for both drivers are not given.

### IM2. Writer editing has no API contract (ir-M2)

-   **Where:** 2.8–2.10.
-   **Finding:** not stated: how a writer's first edit, which carries a live ID, maps to its draft
    copy; which IDs the builder uses after that; how `GET courses/:id` returns the draft tree
    ("unless a change set is requested" has no parameter); the route for `resolveConflicts`; and
    the status, error code and body for a conflicting approval.

### IM3. No route-by-route capability table (ir-M3)

-   **Where:** 1.15.
-   **Finding:** about 25 routes are grouped under `courses*` and `lessons/:id*`. Each needs its
    capability, and some depend on course status (`editDraft`, `editLive`, `proposeLiveEdit`), so a
    fixed `requireProfile(capability)` cannot decide them. `stripe/*` under `stripe.links` also
    blocks `GET stripe/status` for managers and staff; unclear if intended.
    `role-routes.test.ts` needs this table as its expected values.

### IM4. Drizzle 1.0 rewrite rules do not match the current code (ir-M9, cd-M4, cd-M15, cd-M20, cd-N7)

-   **Where:** 0.5, 0.6, 0.8, 0.9, 1.7, 1.8.
-   **Finding:**
    - most calls pass SQL expressions (`eq`, `and(...conditions)`, `orderBy: [desc(...)]`), not
      callbacks; dynamic filters (`exists` and `ilike` subqueries in the catalogue, a tuple cursor in
      people, `listSummaries(where: ReturnType<typeof and>)`) need a stated rule;
    - the `Db`, `PgliteDb` and `AnyDb` types must change to the relations-aware generics, and
      `packages/db/src/index.ts` is not in step 0;
    - the relations rewrite must also remove or rename `users.teacherProfile`, `users.courses`,
      `teacherProfiles.teachingSample`, `mediaAssets.owner` and `payments.teacher`; about 8 services
      use `teacher: { with: { teacherProfile } }` with no replacement given; `relationName` use
      needs a mapping;
    - the plan assumes the RC keeps the `NNNN_name.sql` and `_journal.json` layout that
      `migrations-folder.ts`, `migrate.ts` and the Dockerfile depend on. 0.10 should test it.

### IM5. Hand edits and the fallback conflict with the single `0000` (ir-M10, st-1)

-   **Where:** Implementation Plan intro, 0.10, 1.8.
-   **Finding:** the `citext` and `pg_trgm` lines added to `0000` by hand are wiped each time `0000`
    is regenerated. The view fallback, `drizzle-kit generate --custom`, makes a separate migration
    file, which contradicts Goal 8. "Generated once" at line 888 contradicts the regeneration in
    lines 889 and 1052.

### IM6. Contracts and screens that read dropped fields (ir-M11, cd-M12)

-   **Where:** 1.11, 1.12, 1.17, 1.32.
-   **Finding:** not stated: what happens to `TeacherProfileView`, `CourseView.teacher` (including
    `stripeChargesEnabled`), `CourseSummary.teacherName/teacherEmail`, `PersonSummary.teacher`,
    `PersonDetail.teacherProfile`, and the public card in `contracts/catalog.ts:60` (does `teacher.id`
    become the profile ID?). Screens reading dropped data: `details-form.tsx:43`
    (`user.teacher.commissionBps`), `layout.tsx:21,27`, `review-course.tsx:199–202`.
    `validateCourseForSubmission` takes `teacherStripeChargesEnabled`, which must become "active
    payout account with charges enabled".

### IM7. Catalogue preview and avatar (ir-M6, cd-M13)

-   **Where:** 1.23.
-   **Finding:** only the teacher or staff can preview an unpublished course today
    (`catalog.service.ts:136–139`); which members keep that is not stated. Avatars come from
    `users.avatarUrl` today (line 179). The plan reads `profiles.avatar_media_id` but gives no
    write path (no field, no settings screen), so learner teacher cards lose avatars and Goal 7
    breaks.

### IM8. Fulfilment's error path and the first-payout event (ir-M5, cd-M6, cd-M7)

-   **Where:** 1.20, 1.22.
-   **Finding:**
    - `fulfilCheckout` is also called by `syncSession` (`payments.service.ts:229–250`), where no
      `webhook_events` row exists; what it returns or records with missing metadata is not
      stated, and its return type has no error case;
    - the `firstPayout` event is emitted in `payments.service.ts:344–359`, not
      `analytics.service.ts`. Section 6 says per payout account, 1.22 says per profile. The event's
      `userId` and properties are not stated.

### IM9. Profile application and Teach routing (cd-M11, cd-M16)

-   **Where:** 1.16, 1.30, 1.32.
-   **Finding:** `apply` today updates a rejected application in place, and the rejection email
    invites a resubmit (`teachers.service.ts:58–88, 214–216`). Refusing with `409 profile_exists`
    breaks that, and Goal 7. With several profiles, the plan does not say whether `/apply` and
    `/pending` sit inside or outside `/p/:profileId`, what a writer whose own application is pending
    sees, or how `/` picks among unapproved profiles. `apps/teach/src/lib/urls.ts` has only
    `learnerUrl`, so the helpers are new.

### IM10. Seeding breaks staging checkout (ir-M8, ir-M12, cd-M17)

-   **Where:** 1.28, 1.29, 3.12.
-   **Finding:** demo profiles get `active` accounts with fake `acct_seed_*` IDs, so their courses
    pass payability, and Stripe then rejects the unknown destination with a 500. Today seeded
    teachers are cleanly unpayable. Also: `SEED_SUPER_ADMIN_EMAIL` is optional in `env.ts:20` and
    set by Terraform only when non-null; `--admin-only`'s handling of the seeded support agent and
    demo learner is not stated; the seed's media row hard-codes `provider: 'local'`
    (`seed/index.ts:109`).

### IM11. Fixtures for Goals 5 and 6 have no product path (ir-M7, st-3)

-   **Where:** 1.36, 1.38, Verification Plan.
-   **Finding:** in step 1 a user owns at most one personal profile and memberships do not exist,
    so the Goal 6 "user on two profiles" fixture needs a direct database insert, or the test moves
    to step 2. Goal 5's retired account also needs a direct insert. Coverage claims ("each slice-1
    goal has a test", "every goal maps to a named test") are not true as written: Goals 3, 4 and 8
    have no named test.

### IM12. Other gaps

-   **Media (cd-M14, st-2):** `createUploadSchema` (`contracts/media.ts:20–38`) and
    `packages/web-ui/src/components/MediaUploader.tsx` are missing from 1.26. The ownership check
    to change is in `getOwnedAsset` (`media.service.ts:197`). Items 1.5 and 1.26 disagree on
    whether access checks change in step 1 or step 2.
-   **`signed_in_at` duplicates `sessions.createdAt` (cd-M9):** sessions are created only at
    sign-in (`auth.service.ts:150, 168–183`) and renewal changes only `lastSeenAt` and
    `expiresAt`. `requireRecentSignIn` can use `createdAt` with no schema change.
-   **Support routes (cd-M19):** the new commission route must keep `requireRole('super_admin')`
    (`support.ts:76–79`); `PeopleService.setRole`'s `teacher` branch and the `role: 'teacher'`
    filters (`people.service.ts:89–113, 187–191`) must be removed.
-   **Rate limiter (ir-N1, cd-M18):** `rateLimit` already takes a custom `key`, so `rate-limit.ts`
    needs no change. It is in memory per process and uses `Date.now()`, so "20 per day" resets on
    deploy and cannot use `deps.now` in tests.
-   **UEN format is wrong (st-4, ir-N4):** local companies use 9 digits and a letter regardless of
    year; the `T`/`S` form is for other entities from 2009, including LLPs (`T..LL....X`). Key the
    rule on entity type, or accept either. _Elephant note: I agree; it should be checked against
    ACRA's published UEN scheme before step 3._

---

## Nits

| Id           | Where                       | Finding                                                                                                                                                                  |
| ------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ir-N2        | 0.1, 0.2                    | `check-dupes.mjs` is in both items; name the exact `drizzle-kit` RC; current pins are already exact.                                                                     |
| ir-N3, cd-N1 | 0.4                         | `columns.ts` sets no names; mark it "no change".                                                                                                                         |
| ir-N5        | 1.25                        | Staff audit `action`, `entityType` and `metadata` contents unspecified.                                                                                                  |
| ir-N6, st-n7 | 1148, 1194, 1389            | "The brief" is not in `docs/`; link it. Goal 7's "fixture and route-path changes only" is not literal (`teach-onboarding.test.ts:49, 77, 123` assert on `user.teacher`). |
| cd-N2        | 1.4                         | Name what happens to the `payments (teacher_id, paid_at)` index.                                                                                                         |
| cd-N3        | 1.25                        | The function is `recordAudit(deps, {...})`, not `record`.                                                                                                                |
| cd-N4        | 1.37                        | "a column named like a teacher reference" is fuzzy; list the names.                                                                                                      |
| cd-N5        | 1.20                        | Refunds made in the Stripe dashboard arrive through `applyChargeRefunded` and send owners no email; say if intended.                                                     |
| cd-N6        | 0.1                         | `@electric-sql/pglite` is also in `apps/api` dev dependencies; bump both.                                                                                                |
| st-n1        | 1366, 1549, 1672            | "slice" and "step" used for the same thing.                                                                                                                              |
| st-n2        | 1222, 1745                  | "author" is ambiguous in a product where teachers author courses.                                                                                                        |
| st-n3        | 1733                        | Drop "(the learner change is one line, but the check is cheap)".                                                                                                         |
| st-n4        | 964                         | "touches query syntax only, not results" is unverified; say the suites confirm it.                                                                                       |
| st-n5        | 1630                        | "has no way back" is an idiom.                                                                                                                                           |
| st-n6        | 1155, 1185, 1188            | Source line numbers go stale after step 0; name functions.                                                                                                               |
| st-n7        | 1.33, 1.20, D.5, cross-refs | 1.33 lists no edit; the refund change sits under the wrong file heading; "the promotion brief" and "the new boundaries" are vague; two cross-reference styles.           |
