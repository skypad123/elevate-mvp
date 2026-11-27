# Comprehension Report: Stage 6

**Target:** `docs/designs/scheduled-classes-attendance.md` (FeatureRange lines
1-1033, DetailedRange lines 1034-1772)

**Reviewer:** `egm-comprehension`, completed. It read the target document and
nothing else, with no standard. The reviewer's result follows in full.

There are no Blockers: every section can be paraphrased. There are 10 Major
findings and 2 Nits.

## What this proposes

Part 1 of three adds the records and screens needed to take attendance at a live
class, with nothing that touches money. It adds three tables (`classes`,
`class_blocks`, `attendance_events`) and a nullable `enrollments.class_id`, so a
class enrollment is its own row beside a self-paced one; every existing learner
endpoint is filtered to self-paced rows.

Learners check in per time block with a code that rotates every 60 seconds, by
QR link in a phone browser or by typing 6 characters in the app. The code is
derived from a per-block secret and the server clock, so nothing is stored per
rotation. Location is recorded as evidence and only ever flags a check-in.

Attendance is append-only: corrections (overturn, manual mark, dispute,
decision) are new rows pointing at earlier ones. A second database user for the
API, which cannot update or delete attendance rows, enforces this; the owner
credential moves to a separate migration task. The assigned instructor runs a
polled day view and a projectable code window, Support gets a read-only
class-day view, and everything sits behind a `CLASSES` switch that is on in
staging and off in production.

## How the existing system works, per this document

Elevate sells self-paced courses through a Hono API on Postgres (Drizzle schema,
generated migrations), running as one ECS task deployed by a GitHub workflow
after Terraform is applied. There are three clients: a Teach web portal, a
Support web portal, and an Expo learner app that runs on web and native.

A learner holds at most one enrollment per course, enforced by a unique
constraint. Any active enrollment opens the whole course, because nothing reads
the enrollment's `mode` column. The enrollment row also carries an unused
`attendance_records` list that is rewritten whole and deleted with the account.

Teaching profiles have an owner and members with roles (manager, writer, staff)
mapped to capabilities, checked by `requireProfile`; Support routes use
`requireRole('support_agent')`. The API and migrations both connect as the owner
user `elevate`. Learner-facing errors are codes worded in English and Chinese;
Teach pages are English only. There is no push channel, map service or alarms.

## Findings

Findings 1, 2, 4, 5, 7 and 8 are in the FeatureRange. Findings 3 and 9 are in
the DetailedRange. Findings 6, 10, 11 and 12 span both.

### 1. "Live course" has two meanings - Severity: Major

- **Affected Scope:** FeatureRange. Lines 13, 89-90, 174, 539, 777, 889; also
  1187 and 1582 in the DetailedRange.
- **Discrepancy Description & Rationale:** The Overview uses "live course" for
  an instructor-led course, as opposed to self-paced. Publishing requires "the
  course is live" (539) and Alternative 19 says "how a course goes live" (777),
  where "live" means published or approved. The reader cannot tell whether a
  class can attach to any published self-paced course or only to a distinct kind
  of course. That decides what the class form's "live courses only" filter and
  the publish check must test.

### 2. The learner state rules overlap and the correction sequences are not specified - Severity: Major

- **Affected Scope:** FeatureRange. State table at lines 400-413 and check-in
  steps at 437-457; also files 18, 34 and 54 in the DetailedRange.
- **Discrepancy Description & Rationale:** The six states are not mutually
  exclusive and no precedence is given, so an engineer writing
  `attendanceState` has to guess in these cases:
  - **Voided mark, no check-in:** this matches both "Not arrived" and "Mark
    voided".
  - **Overturned check-in, then a manual mark:** the service allows it, because
    no check-in "stands". The state table does not say whether the result is
    "Overturned" or "Present, marked by hand", and the day view offers a manual
    mark only for "a learner who has not arrived".
  - **Overturned learner tries again:** the unique index allows one `check_in`
    per block and enrollment, and step 3 answers 200 with the existing state.
    That learner can apparently never check in again; this is not stated.
  - **Standing manual mark, then a check-in:** the steps do not cover it.
  - **Re-marking after a void:** "the latest manual mark" implies more than one
    mark is possible, but this is never said.
  - **Step 6 statuses:** it does not say that `denied`, `unavailable` and
    `unsupported` pass through from the client, or which wins against
    `venue_not_set`.

### 3. The staging test cannot run as written from the seeded data - Severity: Major

- **Affected Scope:** DetailedRange. File 15 (1182-1192) and the Verification
  Plan (1748-1768).
- **Discrepancy Description & Rationale:**
  - **Learner count:** the seed creates class enrollments for
    `learner@example.com` and four new learners, which is five. The pass or fail
    line requires "20 seeded learners" to check in within five minutes.
  - **Block times:** the seed makes "three one-day blocks starting on the day
    the seed runs" with no times given. Check-in is open only from 30 minutes
    before a block to 30 minutes after, and a second seed run "creates nothing
    twice". The document does not say how a tester gets an open block on the day
    they test.
  - **Step 3 against CUJ 2:** step 3 scans the QR signed out and cites CUJ 2,
    but CUJ 2 assumes a signed-in learner. Lines 470-472 say the link code will
    have expired after sign-in, so the learner types it. By file 62 that stores
    `typed_code`, not the "QR link" method CUJ 2 expects.
  - **"Playtest":** the word appears only at line 1766 and is not defined.

### 4. Account deletion is given as a reason for the change, then not addressed - Severity: Major

- **Affected Scope:** FeatureRange. The Problem (42-46) and the data model (357,
  377-379).
- **Discrepancy Description & Rationale:** The old list is faulted for being
  "deleted with the learner's account". The new rows restrict deletion of the
  enrollment, block, class and acting user. The document never says how account
  deletion works today, or what happens when a learner or instructor with
  attendance rows deletes their account. The reader cannot tell whether the
  deletion is refused, the user row is kept, or it is anonymised. It appears in
  neither Non-Goals nor Open Questions.

### 5. "The switch" is described as two different things - Severity: Major

- **Affected Scope:** FeatureRange. Goal "Class selling is off" (86-88),
  Overview (24-26), "The switch" (564-574), Rollout (987-988).
- **Discrepancy Description & Rationale:** The goal says that with the switch
  off no learner request can create a class enrollment. Line 491 says no Part 1
  route creates one at all, and `CLASSES` gates every class route rather than
  selling. The reader cannot tell whether "class selling" is `CLASSES` or a
  separate Part 2 switch.
  - **Seed in production:** the rollout says the previous API version is safe
    "because no class enrollment can exist in production". The demo seed is what
    creates class enrollments, and the document does not say that "demo mode"
    cannot run in production.
  - **Staging rollback:** on staging, class enrollments do exist. The
    forced-failure rehearsal returns to the previous version, which by the
    Problem section would treat them as self-paced enrollments. This is not
    discussed.

### 6. The order of events on the first deploy cannot be checked from the document - Severity: Major

- **Affected Scope:** FeatureRange lines 576-594 and 989-995; DetailedRange
  files 66 and 69 (1698-1730).
- **Discrepancy Description & Rationale:** Terraform is "applied first" and
  points the API task's `DATABASE_URL` at the restricted user's connection
  string. That user is only created later, by the migration task. The document
  does not explain how the Terraform-managed task definition relates to the
  revisions the deploy workflow registers, or whether applying Terraform itself
  restarts the service. A reader cannot confirm that the API never starts as
  `elevate_api` before that user exists.
  - **Rollback mechanism:** what makes ECS "return to the previous revision" is
    not named.
  - **File 69 wording:** "with no command override needed beyond `node
    dist/migrate.js`" does not say whether an override is used.

### 7. The voices and authorities in the document are not identified - Severity: Major

- **Affected Scope:** FeatureRange. Lines 142-143, the "Decided by" column
  (278-297), 599-600, 757, 830, 864, 896, 1005; also 1772.
- **Discrepancy Description & Rationale:** The header names one author, yet the
  text refers to "the author" in the third person and says "an addition of mine
  to the author's choice" (600). The "Decided by" column separates "Author" from
  "Drafting". Alternatives cite "five reviewers", "the migration reviewer" and
  "the maintenance reviewer". Nowhere does it say who or what the drafter and
  the reviewers are, or whether a "Drafting" decision has been approved. A new
  reader cannot tell which decisions are settled.

### 8. Profile roles and related terms are used but not explained - Severity: Major

- **Affected Scope:** FeatureRange. Lines 137-138, 380, 508-520, 749, 165-168;
  also files 17, 26, 49 and 52 in the DetailedRange.
- **Discrepancy Description & Rationale:** ADR 006 is linked for "the role
  table", but what a writer or staff member is appears nowhere in this document.
  - **Role count:** the Non-Goal rejects "a fourth instructor role", while the
    capability table shows four roles already (Owner, Manager, Writer, Staff).
  - **"Staff":** it is a profile role in the table, and appears to mean Support
    staff in "a non-staff user refused" (1535).
  - **Approval and profile type:** "`UNAPPROVED`", "none before approval",
    "profile type" and "personal profile" depend on a profile-approval concept
    that is never introduced.
  - **Staff navigation:** Staff hold `attendance.read`, but the Classes item
    shows only for `class.manage` or `attendance.take` (1563-1564), so it is
    unclear how Staff reach a roster.

### 9. The claim that every goal has a named test does not hold on the page - Severity: Major

- **Affected Scope:** DetailedRange. Lines 1739-1741, checked against files 16,
  26, 49, 50-57 and 64.
- **Discrepancy Description & Rationale:** The plan says every goal maps to a
  named test in file 26, 49 or 64. These goals have none there:
  - **Stale day view:** "updated N s ago", "not updating" and the code window's
    "offline" have no test, because no Teach or Support portal test file is
    listed at all.
  - **Database-enforced rule:** it is covered only by file 16, which is outside
    the three named files, skipped in CI and run by hand.
  - **Class of 20 in five minutes:** this is a manual staging check.

### 10. "Tier" is listed but not defined as a calculation - Severity: Major

- **Affected Scope:** FeatureRange lines 114-115 and 412-413; DetailedRange
  lines 1586-1587 and 1766-1768.
- **Discrepancy Description & Rationale:** The goal names four tiers (self
  check-in, flagged, overturned, manual), while the state table has six states
  plus an app-only flag "counted separately". The document does not give the
  mapping from states to tiers, say whether the app flag is a fifth tier, or say
  what the denominator is (per block or per class). The only matching endpoint,
  `GET classes/:id`, is described as returning "per-state counts", so it is
  unclear which response carries the share. The playtest's pass condition
  depends on it.

### 11. Small internal mismatches - Severity: Nit

- **Affected Scope:** Both ranges, as listed.
- **Discrepancy Description & Rationale:**
  - **Offline rule:** CUJ 7 says the code window goes "offline" when it cannot
    refresh for longer than one period (250-252). Lines 431-432 and 1595 say it
    does so when it has no code for the current minute, which with two codes
    fetched ahead is up to about three minutes.
  - **Venue accuracy:** `setVenueLocationSchema` takes `accuracyM` (1265), but
    `classes` has no column for it (334).
  - **Time storage:** CUJ 1 says blocks are "stored in Singapore time" (179);
    the data model says they are instants (349).
  - **Places changed:** "about a dozen places in the API and the learner app"
    (54-55) compares with seven API rows in the table (479-487) and no
    learner-app place. `activeCourseIds` and `ensureActive` appear only in file
    39.
  - **Refusal names:** refusal reasons (`not_open_yet`, `closed`,
    `too_many_attempts`) and error codes (`check_in_not_open`,
    `check_in_closed`, `check_in_locked`) differ with no stated mapping.
  - **Class size:** the Goals say 20, Performance says 30.
  - **Numbering:** "Alternative 39" sits between 7 and 8.
  - **Test command:** `npx turbo run test` is said to run "the core, i18n, API
    and learner suites", leaving it unclear whether the db suite is included.

### 12. Project terms with no definition or link - Severity: Nit

- **Affected Scope:** Both ranges, as listed.
- **Discrepancy Description & Rationale:**
  - **"Beta records: treated as kept"** (296): the decision cannot be
    interpreted at all.
  - **"the five weeks"** (732): no timeline is stated anywhere.
  - **"the two packages" / "a separate package"** (888-889): this seems to mean
    product offering, not code package.
  - **"demo mode" and "demo seed"** (297, 1186): where they run is not said.
  - **"the course's draft-rows pattern"** (892).
  - **"held payouts"** (21).
  - **"Compliance Register"** (1051).
  - **"the Stripe pages"** (1555).
  - **"ADR 008"** (1320): cited without a link, unlike ADRs 006 and 010.
  - **"active" enrollment** (441): enrollment statuses are never listed.
  - **SSG:** never expanded, and its relation to SkillsFuture and Singpass (46,
    127, 155, 670) is assumed. These are not project terms, but the motivation
    rests on them.
