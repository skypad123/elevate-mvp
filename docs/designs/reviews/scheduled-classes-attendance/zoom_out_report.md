# Goldfish Review Report: Stage 5 (Initial Zoom Out)

**Target:** `docs/designs/scheduled-classes-attendance.md` (lines 1-1772, full file)

## Reviewer Status

| Reviewer                 | Standard            | Status    |
| ------------------------ | ------------------- | --------- |
| `egm-zoom-out`           | `zoom-out-standard` | completed |
| `egm-inventive-catalyst` | none                | completed |

Neither reviewer raised a Blocker. The zoom-out reviewer found the document
passes on context and on root-problem focus. Both judged the core sound:
append-only events, a code worked out from a stored secret and the clock,
polling, and a class as its own enrollment row. The findings are about rules
layered on that core and about Part 1 carrying more than it needs.

Claims marked "checked" were confirmed against the code after the review.

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. The second database user is incomplete against the code - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
- **Affected Scope:** "The API's database user" (576-600), Rollout (982-999),
  plan items 12-16, 46, 65-69, line 1037.
- **Discrepancy Description**:
  - The deploy role may run only the API task family
    (`infra/terraform/modules/environment/iam.tf` lines 128-138, checked). The
    new migration task could not be run. `iam.tf` is not in the plan, and line
    1037 says no other file changes.
  - The `DATABASE_URL` parameter is declared in `params.tf` line 9 (checked),
    not `database.tf` as item 65 implies.
  - `applyApiRole` grants on the `public` schema only. The API reads
    `drizzle.__drizzle_migrations` at startup
    (`packages/db/src/pending-migrations.ts` lines 23 and 29, checked). As the
    restricted user that check fails on every start and hides the real
    "migrations pending" warning.
  - The seed and preview one-off tasks would run as the restricted user.
    Whether the seed needs owner rights was not checked.
  - The threat the split defends against, a compromised API process, is stated
    only in Alternative 38.
  - Part 1 has no production row to protect, yet the change swaps the
    credential behind every query of the existing paid product.
- **Rationale & Recommendation**: State the threat model in the Technical Plan.
  Then either defer the role split to Part 2, where the first real row can
  exist, keeping the source-guard test in Part 1; or keep it and add `iam.tf`,
  `params.tf`, the `drizzle` schema grant and the one-off tasks to the plan.

### 2. The database rule may be provable in the test database - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`, `egm-zoom-out`
- **Affected Scope:** 595-600, 1153-1165, 1194-1203, 1742-1744; Alternative 27.
- **Discrepancy Description**: The design says the in-memory test database
  cannot enforce the rule, so the proof is a test run by hand. That test checks
  only `attendance_events` and one update on `enrollments`. The larger risk is a
  missed grant on a table that exists today. The test database is PGlite, which
  is Postgres. If it honours roles and grants, the whole existing API suite
  could run as the restricted role and fail a pull request on a missing grant.
  Alternative 27 rejects a trigger because hand-written SQL "can be lost on
  regeneration", but the repo already solved that for `CREATE EXTENSION` in
  `packages/db/scripts/generate.ts`.
- **Rationale & Recommendation**: Spike whether PGlite 0.5.16 enforces grants
  under a non-owner role (not verified by either reviewer). If it does, apply
  the grants in test setup and drop the by-hand step. Reassess the trigger on
  the same evidence.

### 3. Part 1 is not the smallest release and has no cut line - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Overview table (18-22), Goals (66-115), the 69-item plan.
- **Discrepancy Description**: The RFC says the concept does not fit five weeks
  and asks for a first release holding only the tables, the narrowed rule, the
  class-aware lookups and the switch. Part 1 ships that risky change to the live
  product in the same release as about 50 files of features nobody can use in
  production. The design names no deadline, no estimate and nothing to drop if
  time runs out.
- **Rationale & Recommendation**: Add an ordered cut line. Land the foundations
  (schema, `class_id is null` filters, switch) as their own deploy before the
  feature work. Mark the Support search, the tier-share display and disputes as
  first to move.

### 4. The location judgement is fixed when the row is written - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`, `egm-zoom-out`
- **Affected Scope:** 293, 334-335, 383-385, 406-407, 451-455, 533, Alternative
  22, CUJ 2.
- **Discrepancy Description**: `location_status` and `distance_m` are worked out
  once at insert. A learner who checks in before the instructor sets the venue
  is flagged `venue_not_set` for good. A badly set venue flags the whole class
  `out_of_range` for good; the day view is a web page and a laptop has no GPS.
  No action clears a flag: the only instructor action on a flag is overturn,
  which removes the attendance. Alternative 22 keeps coordinates "so stored
  distances can be worked out again", but nothing works them out again.
  `setVenueLocationSchema` takes `accuracyM`, which no column stores and no rule
  uses.
- **Rationale & Recommendation**: Keep the row as the observation. Let
  `attendanceState` work out the flag at read time from the stored reading and
  the class's current venue. One audited venue correction then repairs every
  row. Cost: a flag can appear or disappear later, and the venue's history
  becomes evidence that today lives only in `audit_log`.

### 5. "Only flagged check-ins can be overturned" and "an overturn cannot be disputed" are one problem - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** Open Questions (158-164), Alternative 39, route at 534,
  service rule at 1390-1393.
- **Discrepancy Description**: Alternative 39 was rejected because a writer
  could remove a valid check-in and the learner could not dispute it. The second
  reason is a property of this design. `refers_to_event_id`, the dispute route's
  `:eventId`, the 7-day window and the review capability are already general.
- **Rationale & Recommendation**: Let a dispute point at any instructor-written
  event, an overturn as well as a manual mark. Overturn can then apply to any
  standing check-in, which removes the `not_flagged` refusal and both open
  questions. This reverses a decision the author made, so it needs the author's
  say. Cost: more disputes reach owners and managers.

### 6. One early tap can lock a block - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** 292, 353-355, 441-459, 1371-1372.
- **Discrepancy Description**: Every refusal is stored, and a block is frozen
  once it has "any attendance event". A learner who tries to check in before the
  window opens writes a `not_open_yet` event, which freezes the block's times
  and blocks its deletion.
- **Rationale & Recommendation**: Freeze a block only once it has a `check_in`
  or `manual_mark`. The frozen-block query gains a type filter.

### 7. The test data cannot support Part 1's own pass or fail check - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`, `egm-inventive-catalyst`
- **Affected Scope:** Goal at 100-101, item 15 (1182-1192), Verification Plan
  (1748-1768).
- **Discrepancy Description**: The goal says 20 learners check in within five
  minutes; the seed creates five. The seeded blocks start on the day the seed
  runs and last three days, and a second run creates nothing. After three days
  staging has no open block. A class made in Teach has no learners.
- **Rationale & Recommendation**: When no seeded class has a block open or
  ahead, the seed creates a fresh class from the run date. Raise it to 20
  learners.

### 8. The dispute workflow has no consumer in Part 1 - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** CUJ 6, state table (409-410), routes at 500 and 536-537,
  `attendance.review`, items 18, 22, 24, 27, 34, 49, 54.
- **Discrepancy Description**: Disputes add two event types, three routes, a
  capability, four sub-states, a 7-day timer and messages in two languages. Part
  1 has no real learners and no notices, and nothing reads "upheld", "voided" or
  "settled".
- **Rationale & Recommendation**: Keep `refers_to_event_id` and the event
  shape. Move the dispute types, routes and screens to the release that brings
  real learners and notices. This conflicts with finding 5, which widens
  disputes; the author must choose one direction.

### 9. A forgotten `class_id is null` filter gives away the self-paced course - Severity: Major

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** 56-58, 474-491, 1063-1071, 1434-1475.
- **Discrepancy Description**: The rule is enforced only by a sentence in
  `AGENTS.md`. The API has about twenty query sites on `enrollments`, and Parts
  2 and 3 will add more at the moment class enrollments exist in production.
- **Rationale & Recommendation**: Add a source-reading test like
  `schema-guard.test.ts`: any file that queries `enrollments` by something other
  than its id must mention `classId` or be on a short allow-list.

### 10. Reuse in the rotating code and the polling hooks - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** 417-423, items 19, 32, 53.
- **Discrepancy Description**: `apps/api/src/lib/crypto.ts` already turns bytes
  into a 20-character Crockford token. `encodeCode` is a second encoder with a
  30-character alphabet, which needs bias handling that 32 symbols do not. Line
  419 says the code uses `hmacHex`; item 32 says raw `createHmac`. TanStack
  Query's `refetchInterval` already pauses in hidden tabs.
- **Rationale & Recommendation**: Extract one encoder, consider Crockford's 32
  symbols, reconcile the two HMAC descriptions, and name `refetchInterval` in
  item 53.

### 11. Corrections are written twice - Severity: Nit

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** 602-608, 1396-1397.
- **Discrepancy Description**: Overturn, manual mark and dispute decision go
  into `attendance_events` and again into `audit_log`. `recordAudit` takes no
  transaction, so the two can disagree, and the audit copy is the one that can
  be changed.
- **Rationale & Recommendation**: Write attendance corrections only to
  `attendance_events`. Keep `recordAudit` for class-level actions.

### 12. Erasing coordinates breaks "never changed" - Severity: Nit

- **Reviewer Lens:** `egm-inventive-catalyst`
- **Affected Scope:** Goal at 70-75, Open Questions (146-150), line 384.
- **Discrepancy Description**: The first erasure of one learner's coordinates
  is an update to an append-only row by the owner user.
- **Rationale & Recommendation**: Put raw `lat` and `lng` in a side table keyed
  by event id. Erasure is a delete there. Cost: one more table and a join.

### 13. General time-zone conversion with no picker - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** 291, 543-545, items 20 and 26.
- **Discrepancy Description**: Every Part 1 class is `Asia/Singapore`, a fixed
  +08:00, yet item 20 builds a general converter and item 26 tests daylight
  saving.
- **Rationale & Recommendation**: Keep the column, accept only
  `Asia/Singapore`, and convert with the fixed offset.

### 14. Four capabilities for two grant sets - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** 508-520, item 17.
- **Discrepancy Description**: `attendance.review` has the same grants as
  `class.manage`. `attendance.take` goes to every stored role and never acts
  alone.
- **Rationale & Recommendation**: Two capabilities plus the instructor check
  would do. If four are kept for naming, say so.

### 15. Venue settings with no control - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** 334-335, 385, item 22.
- **Discrepancy Description**: `venue_radius_m` is a per-class column that no
  screen changes. The venue fix's accuracy is accepted and not stored.
- **Rationale & Recommendation**: Make the radius a constant until a screen
  sets it. Store and check the venue fix's accuracy, or drop the field.

### 16. Document altitude and consistency - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Alternatives (610-939), Goal at 102, line 1037.
- **Discrepancy Description**: 39 alternatives, many restating decisions the RFC
  already records; Alternative 39 sits between 7 and 8. The goal "the instructor
  can correct the record" is a pass or fail check, while the Open Questions say
  an unflagged check-in cannot be corrected. The RFC's precondition to lengthen
  backup retention is not carried forward as a Part 2 prerequisite.
- **Rationale & Recommendation**: Point to the RFC for restated alternatives,
  scope the correction goal to flagged in-person check-ins, drop the absolute
  claim at 1037, and list backup retention under what Part 2 must do first.

## Not checked by the reviewers

- Whether PGlite 0.5.16 enforces grants under a non-owner role.
- Whether the seed needs owner rights.
- Browser location accuracy on an instructor's laptop.
- The line numbers the plan cites in `catalog.service.ts`,
  `learning.service.ts`, `certificates.service.ts`, `analytics.service.ts`,
  `people.service.ts` and `enrollments.service.ts`.
