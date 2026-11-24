# Goldfish Review Report: Stage 9 Re-audit (Implementation Readiness)

**Target:** `docs/designs/scheduled-classes-attendance.md` (DetailedRange, lines
1044-2078), as revised on 2026-11-24 after the first review.

This is the one re-audit the review process allows for this stage.

## Reviewer Status

| Reviewer                       | Standard                            | Status    |
| ------------------------------ | ----------------------------------- | --------- |
| `egm-implementation-readiness` | `implementation-readiness-standard` | completed |
| `egm-codebase-details`         | `implementation-readiness-standard` | completed |
| `egm-style`                    | none                                | completed |

## Verdict

**The revised plan does not yet pass the standard, but it is close.** Two of the
three reviewers found no Blocker. The style reviewer found one: the plan never
gives the spelling a `state` field carries.

- **First-round findings:** of 23, 17 are resolved and 6 are partly resolved.
  None is unresolved.
- **New material that holds up against the code:** the view behind the learner
  client, the grant list, the migration task, the workflow change and the way
  back. Nothing in the new entries cites a file, function, resource or line
  that does not exist.
- **Where the new findings sit:** the route-table test entry, the seed entry,
  the hand checks that end Phases 3 and 4, the role SQL, and names missing from
  the shared tables.

Totals after merging the three reports: 1 Blocker, 13 Major, 10 Nit.

Claims marked "checked" were confirmed after the review, by reading the code or
by a throwaway script outside the repo against the pinned versions.

## The 23 first-round findings

| #   | Finding                                    | Status                                                             |
| --- | ------------------------------------------ | ------------------------------------------------------------------ |
| 1   | Constants lost their anchors               | Resolved                                                           |
| 2   | Seed cannot supply the verification        | Partly: see finding 5 below                                        |
| 3   | Route-table test cannot take the rows      | Partly: see finding 2 below                                        |
| 4   | Unlisted files                             | Resolved                                                           |
| 5   | No phases or checkpoints                   | Resolved; Phases 3 and 4 have a new problem, finding 4             |
| 6   | Response shapes and limits undefined       | Partly: see finding 7 below                                        |
| 7   | Error contract left to the implementer     | Resolved; message wording still unwritten                          |
| 8   | `created_at` and the test clock            | Resolved                                                           |
| 9   | Circular import column type                | Resolved                                                           |
| 10  | Role helper and its test disagree          | Resolved                                                           |
| 11  | Migration task and workflow too loose      | Resolved                                                           |
| 12  | "Tier" built by no entry                   | Resolved, as "check-in mix"                                        |
| 13  | `matchCode` and "expired"                  | Resolved                                                           |
| 14  | Entries without a "Why"; bundles           | Resolved                                                           |
| 15  | Missing object or actor                    | Resolved; parameter paths still unnamed                            |
| 16  | Verification steps cannot be run or judged | Partly: steps 11 and 13 lack a method                              |
| 17  | Claims that outrun the plan                | Resolved                                                           |
| 18  | Two HMAC helpers                           | Resolved                                                           |
| 19  | Wrong arguments to error helpers           | Resolved                                                           |
| 20  | AGENTS.md edits to missing sections        | Resolved                                                           |
| 21  | Two apps over one database                 | Resolved                                                           |
| 22  | "Why" that does not apply                  | Resolved                                                           |
| 23  | One thing under two names                  | Partly: the database user and "the owner" still have several names |

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. State names, sub-states and location statuses are missing from the shared tables - Severity: Blocker

- **Reviewer Lens:** `egm-style`, `egm-implementation-readiness`
- **Affected Scope:** Shared tables (1053-1104); entries 1.13, 1.17, 1.20,
  3.10, 5.1, 5.7.
- **Discrepancy Description**: Entry 1.13 says "one of the seven statuses" and
  "by the precedence table" without naming either. The six states appear only
  as display names in the specification. No line gives the string a `state`
  field carries, and no field on `RosterRow` or `LearnerClass` carries the
  manual-mark sub-state that two screens display.
- **Rationale & Recommendation**: Add rows to the shared tables: the six state
  values, the four sub-state values, and the seven location statuses, which are
  also the values of `flagReason`. Give `manualMark` a `subState` field.

### 2. The route-table test entry produces a failing test - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
- **Affected Scope:** Entry 2.21 (1574-1595).
- **Discrepancy Description**:
  - The marker rules call a writer on an unapproved profile "allowed" on the
    roster and the four instructor routes, while `requireProfile` answers 403,
    because no class capability is granted before approval. The existing test
    for an unapproved writer then fails at the end of Phase 2.
  - The two unapproved-profile tests assert lists of permitted routes, not
    refused ones, so "add the routes the list refuses" does not match the file.
  - "The fixture class's instructor is `writer@example.com`" holds only on one
    of the three profiles the fixture is built for.
  - No request body is given for the fourteen rows. If the instructor or edit
    row names the caller, the owner becomes the instructor and later rows
    answer 200 where 403 is expected.
  - The entry does not say the fixture class is published and in person. A
    draft class with attendance rows would answer 500 on delete.
  - Publishing an already published class has no row in the Teach error table.
  - The extra test needs its own learners and a venue set before the code
    route.
- **Rationale & Recommendation**: Write the rules as `instructor`:
  `can(actor, 'attendance.take') && actor.role === 'writer'`; `roster`:
  `can(actor, 'class.read') && (can(actor, 'attendance.read') || actor.role
  === 'writer')`. Say the unapproved tests need no list change. Give each row's
  body, the fixture class's status and delivery, and its instructor on each
  profile.

### 3. A writer who is not the instructor gets 404 by one rule and 403 by another - Severity: Major

- **Reviewer Lens:** `egm-style`, `egm-implementation-readiness`
- **Affected Scope:** Teach error table (1091-1092); entries 2.4, 2.5, 2.21.
- **Discrepancy Description**: Row 1 says a writer opening a class they do not
  instruct gets 404. Row 2 and entry 2.21 say that writer gets 403 on the four
  instructor routes. The roster route for that writer has no stated answer.
- **Rationale & Recommendation**: State the answer per route and which lookup
  `AttendanceService` uses.

### 4. The end checks of Phases 3 and 4 cannot be done as written - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`, `egm-style`,
  `egm-codebase-details`
- **Affected Scope:** Lines 1046-1047, 1637-1638, 1741-1742, 1869-1871.
- **Discrepancy Description**:
  - "A local API with the demo seed" yields no class. The local seed is
    `packages/db/scripts/seed.ts`, which the plan does not list and which
    passes no `classes` option (checked). `CLASSES=true` reaches `.env.example`
    only in Phase 6.
  - "The Teach steps" and "the Support step" are not numbered, and several need
    learner check-ins that Phase 5 builds.
  - Phase 6 ends with "the staging rehearsal done" and in the next sentence
    forbids applying to AWS without a go-ahead.
- **Rationale & Recommendation**: Add `packages/db/scripts/seed.ts` to entry
  2.19 and move the `.env.example` line to Phase 2. End Phases 3 and 4 with
  typecheck and build only, and move the hand walkthrough to the end of Phase
  5. End Phase 6 with validation; make the rehearsal a separate, gated step.

### 5. The seed entry leaves decisions open and has no test - Severity: Major

- **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`,
  `egm-style`
- **Affected Scope:** Entry 2.19 (1539-1561).
- **Discrepancy Description**:
  - `seedDatabase` has four callers the entry does not mention: the local
    script and three API tests. The entry does not say the two new options are
    optional.
  - It does not say whether a second run tops up a demo class that is still
    current. Walkthrough step 12 needs that.
  - "Creating the users if missing" cannot use the seed's `upsertUser`, which
    overwrites the name on conflict and would rename real testers.
  - The secret's text encoding is not given. The API side uses base64url.
  - "First published course" needs an order: the first demo profile has two.
  - Where `SEED_CLASS_LEARNER_EMAILS` is read, and how it reaches the staging
    task, is not said.
  - No test covers the first run, a second run, a run after the last block has
    ended, or `classes` false.
- **Rationale & Recommendation**: Settle each point in the entry and add a seed
  test.

### 6. The role SQL is described, not given, and one part cannot be written as described - Severity: Major

- **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`
- **Affected Scope:** Entries 1.8 and 1.9 (1187-1206).
- **Discrepancy Description**: `GRANT CONNECT ON DATABASE` takes a name, not
  `current_database()` (checked: a syntax error). Postgres has no `CREATE ROLE
  IF NOT EXISTS`. The role's attributes and the default-privileges statement
  are not stated. This is the security boundary of the design.
- **Rationale & Recommendation**: Put the literal statement list in entry 1.8.
  A check after the review confirmed these forms run on the pinned test
  database: a `DO` block that looks the role up in `pg_roles` and creates or
  alters it; `format('grant connect on database %I ...', current_database())`
  inside a `DO` block; the grants, both revokes and `ALTER DEFAULT PRIVILEGES`
  in one transaction. With them, the restricted role could read the migration
  journal, was refused update on both attendance tables with error code
  `42501`, could delete a location row, could update a table created
  afterwards, and could not create a table. The `pg` client has `escapeLiteral`
  (checked).

### 7. The contracts still leave shapes to the implementer - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`, `egm-style`
- **Affected Scope:** Entries 1.13, 1.17, 2.5, 2.8, 4.4.
- **Discrepancy Description**: `GET /support/classes` has no query schema and
  no response type; `GET /support/classes/:id` has no response type. The
  `dispute` field, `SupportClassBlock.block` and `attemptsByReason` have no
  shape. `attemptsLeft` has no formula. `decideDispute` has no rule function.
  `checkInMix(states)` must split flagged check-ins by reason, which a list of
  states cannot show. `validateBlocks` returns "the first problem" while the
  editor shows several messages. The rule that separates `'erased'` from `null`
  coordinates is not given. `recordAudit` is called with no action names.
- **Rationale & Recommendation**: Define each. A workable rule for erased
  coordinates: `accuracy_m` is set on the event and no location row exists.

### 8. The constants table leaves out numbers the entries use - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Constants table (1055-1068) and the entries that use it.
- **Discrepancy Description**: Missing: the venue radius, the two accepted and
  ten expired code periods, three codes per answer, the 60-block limit, the
  15-minute attempts window, the 10-second "not updating" threshold, and the
  time zone. The table holds descriptions, not identifiers. The lockout row
  does not say whether a learner is still locked at exactly 5 minutes, which a
  test checks.
- **Rationale & Recommendation**: Add a name column, the file each constant
  goes in, and the missing rows.

### 9. One thing under two names - Severity: Major

- **Reviewer Lens:** `egm-style`, `egm-implementation-readiness`
- **Affected Scope:** As listed.
- **Discrepancy Description**: `closedAt` in error details against `closesAt`
  and `checkInClosesAt`; `closedAt` for a dispute against `disputeUntil`. "The
  six counts" against seven fields in `CheckInMix`. A block secret from
  `randomToken` in the API and from `randomBytes(32)` in the seed, with no
  encoding stated. `codeFor`, `codesFor` and `codes` differ by one letter. "The
  walkthrough", "the staging rehearsal" and "staging step N" name overlapping
  things. The API's database user and "the owner" each have several meanings.
- **Rationale & Recommendation**: One name each.

### 10. Verification claims outrun what the plan shows - Severity: Major

- **Reviewer Lens:** `egm-style`, `egm-codebase-details`
- **Affected Scope:** Lines 1108-1110, 1173-1175, 2016-2020; entries 2.18 and
  6.9.
- **Discrepancy Description**:
  - "`check-api-role.js` after each deploy" has no step in the workflow. The
    only run is a manual step of the first deploy. The specification also says
    in one place that the program reads `MIGRATION_DATABASE_URL`; entry 2.18's
    `DATABASE_URL` is the correct one. How "permission denied" is recognised,
    and the exit codes, are not stated.
  - The goal "the previous API version keeps working" points at a step that
    tests an old learner build, which is a different thing.
  - `classes-setting.test.ts` tests the setting being off, not that no route
    creates a class enrollment.
  - "A check run during the review showed" names no version and no place to
    find the check.
- **Rationale & Recommendation**: Add a workflow step for the check with a
  skip condition for when the split is switched off, or say plainly that it is
  run by hand. Recognise the refusal by error code `42501`. Point each goal at
  what proves it.

### 11. Walkthrough steps cannot produce or show their expected results - Severity: Major

- **Reviewer Lens:** `egm-style`, `egm-implementation-readiness`
- **Affected Scope:** Lines 2031-2074.
- **Discrepancy Description**: Step 6 expects a lockout after five tries; the
  lockout answers on the sixth. Step 2 says "20 learners", which is wrong once
  testers are added for step 12. Step 4 expects "present", which needs the
  phone to be where the venue was set. Step 7's dispute has no expected result.
  Step 8 gives no numbers. Step 9 has nobody checking in during the deploy.
  Step 13 has no way to observe "runs as the owner" and never sets the variable
  back. Steps 11 and 13 need builds or images that no step produces. The
  preamble does not say the steps must run while a seeded block is open.
- **Rationale & Recommendation**: Give each step its observation. For step 13,
  `check-api-role.js` exiting non-zero is the observation.

### 12. Entries disagree on who reaches the roster - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Entries 3.4, 3.9, 3.10.
- **Discrepancy Description**: 3.9 links the roster only "for the assigned
  instructor". 3.10 says someone who is not the instructor sees the table
  without actions. 3.4 says staff reach rosters, citing `class.read` where the
  roster needs `attendance.read`.
- **Rationale & Recommendation**: 3.9 links the roster for the assigned
  instructor and anyone with `attendance.read`.

### 13. The Terraform entries ask for an edit that is not needed and omit names - Severity: Major

- **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`
- **Affected Scope:** Entries 6.1, 6.2, 6.3, 6.4.
- **Discrepancy Description**: The execution role already allows every
  parameter under the prefix (`iam.tf` lines 24-29), so the first change in 6.4
  is not needed. 6.2 names Terraform resources but not the parameter paths.
  `random_password.api_db` needs `length = 32, special = false`, as the existing
  password does, because the connection string is built without URL-encoding.
  The migration task is given `SESSION_SECRET` and the API environment, which
  `migrate.ts` never reads.
- **Rationale & Recommendation**: Name the parameters, reduce 6.4 to the
  `EcsRunMigration` change, state the password settings, and drop what the
  migration task does not read.

### 14. The Support nav item shows while production has classes off - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`
- **Affected Scope:** Entries 4.2 and 4.4.
- **Discrepancy Description**: Teach hides Classes through `classesEnabled`.
  Support has no such signal, so for all of Part 1 in production it would show
  an item whose routes answer 404.
- **Rationale & Recommendation**: Decide whether to hide it and by what field.

### Nits

| #   | Finding                                                                                                                                                                            | Lens                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 15  | `createPgliteDb` takes a positional `dataDir` today; the plan calls it with an object and does not state the new signature. No caller passes `dataDir`.                            | Codebase, Readiness |
| 16  | `packages/db/scripts/reset.ts` reads only `DATABASE_URL`; with two local users `npm run db:reset` would fail.                                                                      | Codebase            |
| 17  | Entry 2.10 leaves `db` unused in `catalog.service.ts`'s `detail`, which fails lint.                                                                                                | Codebase            |
| 18  | Comments go stale in `learner-relations.ts`, `packages/db/src/index.ts`, the Dockerfile, `SeedOptions` and `apps/api/src/seed.ts`.                                                 | Codebase            |
| 19  | Line 785 says the seed "only reads and inserts"; it also updates. Updates on those tables are granted, so it works.                                                                | Readiness           |
| 20  | The eight error messages, the `learnerClass` keys and the roster labels are described but not worded, though the walkthrough expects exact strings.                                | Readiness, Style    |
| 21  | AGENTS.md says Teach capabilities come from the route table in `docs/designs/teacher-profiles.md`; entry 7.3 does not update that line.                                            | Readiness           |
| 22  | Nine "Why" lines are labels, not reasons. Entry 1.16 exports `./classes` before 1.17 creates it.                                                                                   | Style               |
| 23  | Four entries anchor on line numbers that move with any earlier edit; name the function first.                                                                                      | Style               |
| 24  | Entry 1.17 does not say whether the schema normalises a typed code or only the client does. Entry 2.17's "logs that it ran without the password" reads as if no password was used. | Style               |

## Claims in the revised plan that were checked and hold

- Nothing relies on `enrollments` being a table through the learner client:
  its only uses are two reads, and no insert, update, delete or row lock goes
  through it.
- The reads the plan moves onto the learner client use only relations that
  exist there.
- No existing API test runs SQL that needs owner rights, so the suite can run
  as the restricted role.
- Every Terraform resource, local, statement and output the entries cite exists
  as named. A second task definition with the same container name fits the
  workflow's image swap, command override and log stream name.
- The Dockerfile copies the whole of `dist`, so `check-api-role.js` ships with
  no Dockerfile change.
- A circuit-breaker rollback returns to a revision whose connection string
  still points at the owner parameter, and the way back passes the deploy's
  Terraform fingerprint check.

## Not checked by the reviewers

- What drizzle-kit generates for the partial unique indexes and the view. Entry
  1.7 makes the implementer read the SQL.
- `envs/production/main.tf`, `variables.tf` and the two tfvars examples.
- Whether `toView` is the only place a `ProfileView` is built, and whether an
  existing test compares a whole profile body.
- Phases 3 to 5 against the portal and learner source, beyond file existence.
