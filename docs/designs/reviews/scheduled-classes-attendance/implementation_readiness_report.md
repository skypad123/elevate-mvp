# Goldfish Review Report: Stage 9 (Implementation Readiness Test)

**Target:** `docs/designs/scheduled-classes-attendance.md` (DetailedRange, lines
1034-1772)

## Reviewer Status

| Reviewer                       | Standard                            | Status    |
| ------------------------------ | ----------------------------------- | --------- |
| `egm-implementation-readiness` | `implementation-readiness-standard` | completed |
| `egm-codebase-details`         | `implementation-readiness-standard` | completed |
| `egm-style`                    | none                                | completed |

**Verdict from the readiness reviewer: the plan does not pass the standard.** An
engineer could not implement from it without making impactful decisions.

Totals before merging: 2 Blocker, 23 Major, 11 Nit. After merging overlaps: 2
Blocker, 15 Major, 6 Nit. The accuracy reviewer found no false statement about
a file, function, table or export that exists today; every cited line number
it checked was right. Claims marked "checked" were confirmed against the code
after the review.

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. The constants in item 18 lost what they measure from, and the lockout disagrees with the test - Severity: Blocker

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Item 18 (1220-1222), item 26 (1303), Verification step 5
  (1756).
- **Discrepancy Description**: "Check-in opens 30 minutes before, closes 30
  minutes after" does not say before or after what; "30 minutes after the
  start" is the rejected Alternative 8. "Lockout after 5 wrong codes" leaves
  out expired codes, which the Technical Plan counts and verification step 5
  depends on. "Dispute window 7 days" does not say from when. Step 5 says
  "stale", but a code more than about 12 minutes old is `none`, not `expired`.
- **Rationale & Recommendation**: Write each constant with its anchor: opens 30
  minutes before the block starts, closes 30 minutes after it ends; 5 refused
  attempts with reason `code_wrong` or `code_expired` in 10 minutes lock the
  learner out for 5 minutes from the latest; 7 days after the mark is made; an
  accuracy worse than 500 m has status `inaccurate`.

### 2. The seed cannot supply what the verification needs - Severity: Blocker

- **Reviewer Lens:** `egm-style`, `egm-codebase-details`,
  `egm-implementation-readiness`
- **Affected Scope:** Item 15 (1182-1192), Verification (1748-1768).
- **Discrepancy Description**: The seed creates five class learners; the pass
  criterion needs 20. The blocks start on the day the seed runs and a second
  run creates nothing, so three days later staging has no open block. The four
  new learners have no email addresses, the blocks have no clock times, and the
  seed's lookup key for "creates nothing twice" is not named. The seed lives in
  `packages/db` and cannot import `newBlockSecret()` from `apps/api`, so how it
  makes `code_secret` is not said.
- **Rationale & Recommendation**: Name the learners, the block times and the
  lookup key (for example profile plus a fixed class name). Create a fresh
  class when no seeded block is open or ahead. Make the counts match.

### 3. The route-table test cannot take the new rows as described - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
- **Affected Scope:** Item 48 (1502-1510), item 35 (1403-1407).
- **Discrepancy Description**: `apps/api/test/role-routes.test.ts` decides the
  expected answer with `allowed()`, which ends in `can(actor,
  route.capability)` (lines 300-312, checked). An allowed route must not answer
  401, 403 or 404. With the writer as instructor, the owner and manager hold
  `attendance.take` but get 403 on the code, venue, overturn and manual-mark
  routes, so the existing "owner can use every route" test fails. With the
  owner as instructor, the writer's test fails. The roster route has no single
  capability, and its `profile.read` guard is granted before approval, so an
  unapproved owner is "allowed" by the table and refused by the service. The
  written-out refusal lists for manager, writer, staff and the two unapproved
  cases need entries. The `Fixture` type needs class, block, enrollment and
  dispute event ids.
- **Rationale & Recommendation**: Define new markers, as the file does for
  `content`, `details` and `owner` (for example `instructor` and `roster`).
  State their rule in `allowed()`, the fixture each route needs, and the exact
  additions to each list. Decide whether an unapproved profile may list
  classes.

### 4. Files the work must touch that the plan does not list - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
- **Affected Scope:** Line 1037, items 4, 46, 52, 56, 65-66.
- **Discrepancy Description**:
  - `apps/api/src/reset-schema.ts` reads only `DATABASE_URL` and throws when it
    is missing (lines 16-17, checked). Item 4 documents running it from the
    migration task, which gets `MIGRATION_DATABASE_URL`.
  - Both portals' navigation is translated: labels are `t('nav.*')` and the
    keys live in `packages/i18n/src/messages/areas/chrome.en.ts` and
    `chrome.zh.ts` (checked). AGENTS.md forbids English literals in navigation.
    Neither file is listed.
  - `infra/terraform/modules/environment/iam.tf` and `params.tf`, established
    in Stage 5.
  - `apps/api/src/seed.ts` uses `DATABASE_URL`, so the staging seed runs as the
    restricted user. That works for inserts, but the plan should say so.
- **Rationale & Recommendation**: Add each file with its change, and a
  `nav.classes` key with Chinese text under the same sign-off as item 27. Drop
  the absolute claim at line 1037.

### 5. The plan has no phases or checkpoints - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`
- **Affected Scope:** Lines 1036-1037, all 69 items.
- **Discrepancy Description**: The standard requires phases that each leave the
  code buildable and testable. In the given order several points do not build:
  item 25 adds a required `classesEnabled` that the API does not set until item
  45; item 17 adds capabilities the route-table test does not cover until item
  48; item 3 writes rules before any code obeys them. The infrastructure items
  are last with no checkpoint for the Terraform apply, the GitHub variable or
  the rehearsal.
- **Rationale & Recommendation**: Group into phases, each ending with `npx
  turbo run typecheck test` green: database and core; API and tests; Teach;
  Support; learner; infrastructure and deploy; documents.

### 6. Response shapes and request limits are named but not defined - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`, `egm-style`
- **Affected Scope:** Item 22 (1260-1275), item 34, item 53.
- **Discrepancy Description**: Ten response types have no field lists and
  appear nowhere else in the document. `createClassSchema` and
  `updateClassSchema` name only `blocks`. `method`, `platform` and `decision`
  have no values in the entry that defines them. No length or range limits are
  given. `overturn(...)`, `manualMark(...)` and `decideDispute(...)` have
  elided arguments. Item 19 does not give the alphabet's characters. Query keys
  are described, not named.
- **Rationale & Recommendation**: Write each type's fields, each schema's
  fields and limits, and one line per response type naming its route.

### 7. The error contract is left to the implementer - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`, `egm-style`,
  `egm-codebase-details`
- **Affected Scope:** Items 24, 32, 33, 34, 36, 49.
- **Discrepancy Description**: The seven learner codes have no HTTP status, no
  mapping from the stored refusal reasons, and no `details`; AGENTS.md says
  variable parts go in `details`, and `check_in_locked` needs the time the
  lockout ends. One thing has three sets of names: stored reasons, error codes,
  and `matchCode` results. On the Teach side only `block_frozen` and
  `not_flagged` are named; no code is given for a manual mark while one stands,
  each failed publishing check, an instructor who is not a member, deleting a
  published class, or deciding a dispute twice. `conflict` is shown with one
  argument; its signature is `conflict(code, message)`.
- **Rationale & Recommendation**: Add a table of condition, status, code,
  message and details.

### 8. Tests cannot move `created_at` with the test clock - Severity: Major

- **Reviewer Lens:** `egm-codebase-details`
- **Affected Scope:** Items 34 and 49.
- **Discrepancy Description**: The lockout and the dispute window are measured
  from `attendance_events.created_at`. The `createdAt()` column helper is
  `defaultNow()`, the database's real clock, while the test app's clock is
  fixed and moved with `setClock`.
- **Rationale & Recommendation**: State that the service sets `createdAt:
  deps.now()` on every insert and that every window, lockout and code period
  reads `deps.now()`.

### 9. The circular import needs an explicit column type - Severity: Major

- **Reviewer Lens:** `egm-codebase-details`
- **Affected Scope:** Items 7 and 8.
- **Discrepancy Description**: `classes.ts` and `commerce.ts` must import each
  other. The repo's one existing pair writes `references((): AnyPgColumn =>
  ...)` with a comment saying why (`packages/db/src/schema/profiles.ts` lines
  46-54, checked). A plain callback fails typecheck. `refers_to_event_id`
  points at its own table and needs the self-reference pattern in `courses.ts`.
- **Rationale & Recommendation**: Say which callbacks carry `(): AnyPgColumn`.

### 10. The role helper and its test disagree, and the test cannot run on staging - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`, `egm-codebase-details`
- **Affected Scope:** Items 12 and 16, Verification "Database rule".
- **Discrepancy Description**: `applyApiRole` grants on `public`; the test
  migrates "into a throwaway schema", where the restricted user has no rights.
  The migration journal lives in a separate `drizzle` schema, so a second
  migrate on an already-migrated database does nothing. The init migration
  creates `citext` unqualified. "Again on staging" has no way to run: the
  database is reachable only from the API task, and the image has no test
  runner. Grant then revoke is not said to be one transaction, so on each
  deploy the API user briefly holds update and delete on the attendance table.
- **Rationale & Recommendation**: Use a throwaway database. Run the statements
  on one client inside one transaction. For staging, specify a small check
  script run as a one-off task, or drop the claim.

### 11. The migration task and workflow change are too loose - Severity: Major

- **Reviewer Lens:** `egm-implementation-readiness`
- **Affected Scope:** Items 66, 67, 69.
- **Discrepancy Description**: The workflow hard-wires the container name into
  the image swap, the command override and the log stream name. The plan does
  not say the migration container keeps that name. "No command override needed
  beyond `node dist/migrate.js`" reads either way. The existing values are
  GitHub Environment variables, not repository variables, and the family name
  differs per environment. Nothing says to copy the variables again after the
  Terraform apply; without it the deploy fails at registration. Between the
  apply and the first successful deploy, the newest API revision points at a
  database user that does not exist, so a seed or preview task run then fails.
- **Rationale & Recommendation**: State the migration task's container name,
  command, environment and secrets. Give the exact workflow changes. Add an
  ordered rollout checklist: apply, copy variables, deploy, seed.

### 12. "Tier" is a pass criterion that no entry builds - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Item 54 `detail.tsx`, lines 1767-1768.
- **Discrepancy Description**: The four tiers are named only in the Goals. No
  function in item 18 computes them, no response type carries them, no service
  method returns them and no test covers them. "The class page" means the Teach
  detail page at line 1768 and the learner screen at line 1658.
- **Rationale & Recommendation**: Add the function to item 18, a field to
  `ClassDetail`, and a test to item 26.

### 13. `matchCode` and its test disagree on "expired" - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Items 32 and 49.
- **Discrepancy Description**: "One of the ten periods before" does not say
  before what. Item 49 says "older ones are `expired`" with no upper bound,
  while a code 12 or more periods old is `none`. The same span is a "period" in
  items 19 and 32 and a "minute" in item 54.
- **Rationale & Recommendation**: "`current` for the current period,
  `previous` for the one before it, `expired` for any of the ten periods before
  that, and `none` otherwise."

### 14. Entries without a "Why", and entries that bundle several files - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** 19 of 69 items have no "Why" (23, 30, 45, 50, 52-57, 59,
  61-68); items 7, 17, 32, 33, 34 restate the change. Bundled: 15, 26, 44, 53,
  56, 58, 64, 67, 68.
- **Discrepancy Description**: The preamble says each file names what changes
  and why. Item 44 covers two services with no function names, where items
  39-43 name the function and lines. Item 68 says "both
  `terraform.tfvars.example`" with no paths.
- **Rationale & Recommendation**: Add the reason to each entry, and say which
  change goes in which file.

### 15. Instructions whose object or actor is missing - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Items 7, 11, 12, 20, 33, 65, 66, 69.
- **Discrepancy Description**: Item 11's "the two partial indexes" does not say
  which two of four, and gives a check with no action if it fails. Items 65-66
  name no parameter path or Terraform resource. Item 12's "grants connect and
  usage" does not say on which database and schema. No entry says who calls
  `zonedToInstant`: the contract sends wall-clock times, so the API must
  convert, yet item 33 does not mention it. Item 7's "indexes as listed under
  Performance" includes one that belongs to item 8.
- **Rationale & Recommendation**: Name each object.

### 16. Verification steps that cannot be run or judged - Severity: Major

- **Reviewer Lens:** `egm-style`, `egm-implementation-readiness`
- **Affected Scope:** Lines 1734-1768.
- **Discrepancy Description**: Steps 1, 2 and 6 name actions with no expected
  result. Step 9's "older learner build" and step 4's installed app need builds
  no step produces. Step 10 does not say how to force a failing image.
  "Validated through Docker" gives no command. Step 3 needs the phone on the
  private network and the sign-in code from the API log when email is off.
  `npx expo-doctor` must run inside `apps/learner`.
- **Rationale & Recommendation**: Give each step its expected result and its
  command.

### 17. Claims that outrun what the plan shows - Severity: Major

- **Reviewer Lens:** `egm-style`, `egm-implementation-readiness`
- **Affected Scope:** Lines 1037, 1541, 1735-1741.
- **Discrepancy Description**: "Every goal maps to a named test in file 26, 49
  or 64" has no mapping. The append-only goal is proved only by item 16, which
  is outside that list and does not run in CI. "Every branch covered" names no
  command. The test run omits the db suite.
- **Rationale & Recommendation**: Add a goal-to-test table and say which goals
  are proved by hand.

### 18. Two HMAC helpers are named - Severity: Nit

- **Reviewer Lens:** `egm-codebase-details`
- **Affected Scope:** Item 32, Technical Plan line 419.
- **Discrepancy Description**: The Technical Plan says the code uses `hmacHex`,
  which returns hex. Item 32 says `createHmac` and `timingSafeEqual`, which
  `crypto.ts` does not export. `safeEqualHex` only compares hex.
- **Rationale & Recommendation**: Pick one: add an exported helper to
  `crypto.ts` and list that file, or import from `node:crypto` and check length
  first.

### 19. Wrong arguments to the error helpers - Severity: Nit

- **Reviewer Lens:** `egm-codebase-details`, `egm-implementation-readiness`
- **Affected Scope:** Item 31, items 33-34.
- **Discrepancy Description**: `errors.notFound('Not found')` gives the message
  "Not found not found". `conflict('block_frozen')` is missing its message
  argument.
- **Rationale & Recommendation**: Use `errors.notFound()`, and give each
  message.

### 20. Two AGENTS.md edits point at sections that do not exist - Severity: Nit

- **Reviewer Lens:** `egm-implementation-readiness`
- **Affected Scope:** Item 3.
- **Discrepancy Description**: AGENTS.md has no list of server switches and no
  deploy notes.
- **Rationale & Recommendation**: Say where the text goes, or keep those two in
  `infra/README.md`.

### 21. No way is named to build two apps over one database - Severity: Nit

- **Reviewer Lens:** `egm-codebase-details`
- **Affected Scope:** Items 47 and 49.
- **Discrepancy Description**: `createTestApp` always creates its own
  database. The test is possible by calling `createApp(t.deps)` a second time.
- **Rationale & Recommendation**: Say that in item 49.

### 22. Edits whose "Why" does not apply - Severity: Nit

- **Reviewer Lens:** `egm-implementation-readiness`
- **Affected Scope:** Item 39.
- **Discrepancy Description**: `activeCourseIds` and `ensureActive` have no
  callers. `ensureActive` looks up by id, so the filter there means "treat as
  not found".
- **Rationale & Recommendation**: Say so, or leave them alone.

### 23. The same thing under two names - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** Across entries.
- **Discrepancy Description**: "Day" means one block in `day.tsx` and a
  calendar day in the schedule editor. "The owner" is the profile owner in some
  entries and the database owner in others. The API's database user has four
  names. "Manual mark", "mark by hand", "the mark". "Standing" is never
  defined. Item 49 says every class route answers 404 and one answers an empty
  list.
- **Rationale & Recommendation**: One name per thing. "Polls" is the plain word
  for "asks every 3 seconds".

## Claims checked by the reviewers and found accurate

- Every cited line number: `catalog.service.ts` 161-165, `payments.service.ts`
  141-145, `learning.service.ts` 50-79, both certificate functions, the three
  queries in `enrollments.service.ts`, and `docs/spec.md` lines 33 and 63.
- No insert into `enrollments` names a conflict target, so dropping the
  constraint breaks no `onConflict`.
- Routes in a second file mounted at `/teach` are picked up by the route-table
  test.
- Every Teach, Support and learner file the plan modifies exists where it
  says. `useMemberActions`, `SIGNED_IN_ONLY`, the signed-in group and the bare
  `Outlet` branch are as described.
- `requireProfile`, `uuidParam`, `ensureActor`, `requireUser`, `validate`,
  `rateLimit`, `recordAudit`, `deps.log`, `randomToken`, `qrcode` and the
  `web-ui` components exist with the signatures the plan uses.
- A Terraform apply does not restart the running API.
- The check-in rate limit is keyed by user, so a shared classroom network does
  not trip it.

## Not checked by the reviewers

- Whether `pg` exports `escapeLiteral` as item 12 assumes. The worktree has no
  `node_modules`.
- Whether the pinned Drizzle migrator accepts a journal-schema option.
- The fields of `ProfileView`, and whether a test fixture builds one by hand.
- Items 1-5, 17-29 and 65-69 against the code, beyond the points above.
