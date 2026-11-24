# Goldfish Review Report: Stage 8 (Intermediate Zoom Out)

**Target:** `docs/designs/scheduled-classes-attendance.md` (full file; lines
1-1033 read in full)

## Reviewer Status

| Reviewer       | Standard            | Status    |
| -------------- | ------------------- | --------- |
| `egm-zoom-out` | `zoom-out-standard` | completed |

The design document was not changed between Stage 5 and this stage, because the
review ran without stopping. The reviewer was given the three earlier reports
and asked not to repeat Stage 5. No Blocker at this altitude.

Claims marked "checked" were confirmed against the code after the review.

## Is the shape wrong, or does it need repairs?

**Repairs, plus cuts. The shape is right.**

- **The four load-bearing choices are unchallenged.** No report disputes a class
  as its own enrollment row, append-only events, a code worked out from a stored
  secret and the clock, or the `CLASSES` setting with test data.
- **The one Blocker is a specification gap.** Critic finding 1 concerns one pure
  function, `attendanceState`. It is not a structural fault.
- **The findings cluster in three places:** the correction and dispute rules,
  the second database user, and the location flag. The first two are sized for
  a release with real learners, which Part 1 does not have. Both shrink by
  removal.
- **The risk is in the repairs.** Stages 5 to 7 propose about fifteen additions.
  Taken together they would make Part 1 larger, and several pull against each
  other.

## The earlier recommendations, sorted

One fact sorts most of them. In production the three new tables stay empty
until Part 2, so their columns, indexes and event types can still be changed by
an ordinary migration. Part 1 fixes for good only the change to `enrollments`,
the `class_id is null` reads, and anything done to the live deploy path.

| Recommendation                                                                                  | Verdict                            | Reason                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precedence for the state table and a definition of "standing" (critic 1)                        | Needed                             | `attendanceState` is built in Part 1.                                                                                                                                              |
| Freeze a block only on `check_in` or `manual_mark` (zoom-out 6, critic 2)                       | Needed                             | One filter.                                                                                                                                                                        |
| Seed 20 learners and keep a block open (zoom-out 7, comprehension 3)                            | Needed                             | The seed is the only way to exercise Part 1.                                                                                                                                       |
| Fixed Singapore offset, two capabilities, constant radius (zoom-out 13 to 15)                   | Needed                             | Each removes work.                                                                                                                                                                 |
| Wording fixes: "switch", "additive", "every attempt", roles, "live"                             | Needed                             | Document edits only.                                                                                                                                                               |
| Account deletion against the new restrict rules (comprehension 4)                               | Decide now, build in Part 2        | No production row is affected in Part 1, but the answer shapes the schema.                                                                                                         |
| Risks section (critic 9)                                                                        | Needed, as a move                  | Fill it from the Open Questions and Rollout text. The document should not grow.                                                                                                    |
| Widen disputes to overturns (zoom-out 5)                                                        | Not this release                   | Finding 2.                                                                                                                                                                         |
| Reverse-overturn event (critic 1)                                                               | Not needed                         | Finding 5.                                                                                                                                                                         |
| Separate indexes for overturn and decision (critic 1)                                           | Replace with one index             | Finding 5.                                                                                                                                                                         |
| Harden the role split (critic 4) and complete it (zoom-out 1)                                   | Not this release                   | Finding 3.                                                                                                                                                                         |
| Side table for coordinates (zoom-out 12, critic 5)                                              | Not this release                   | Finding 6.                                                                                                                                                                         |
| Read-time flags (zoom-out 4) or a recheck event (critic 7)                                      | Not this release                   | Finding 6.                                                                                                                                                                         |
| Server clock offset, warning and skew test (critic 3)                                           | Replace with a smaller repair      | Finding 7.                                                                                                                                                                         |
| Second source-guard test (zoom-out 9)                                                           | Replace with an existing mechanism | Finding 4.                                                                                                                                                                         |
| Database cap on stored refusals (critic 2)                                                      | Not needed                         | Test data only, and the 20-a-minute limiter already bounds it.                                                                                                                     |
| Change the sign-in limiter key (critic 6)                                                       | Not this release                   | It changes sign-in protection on the live product for a flow with no production users. List it as a Part 2 prerequisite, and state "signed in beforehand" in the 20-learner check. |
| Record Support views of coordinates (critic 5); warn on removing an assigned member (critic 18) | Not this release                   | No real learner or class exists.                                                                                                                                                   |

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Part 1 has no rule for what must be right now - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Overview (18-26), Goals (66-115), Rollout (982-999), the
  69-item plan.
- **Discrepancy Description**: The document treats every part of Part 1 as
  equally final. Critic findings 3, 5, 6, 7 and 18 are about behaviour only a
  real class can show, and Part 1 cannot have one in production. Stage 5 asked
  for a cut line; the RFC already has one and no report used it.
- **Rationale & Recommendation**: Add a short "What Part 1 fixes for good"
  section listing the `enrollments` change, the self-paced reads and the deploy
  path. Take the cut order from the RFC (`scheduled-classes-brief.md` lines
  760-782): foundations, class setup, check-in and day view, then fallbacks and
  the Support view. Disputes are not a delivery step in the RFC at all. Move
  the tier-share goal with the fallbacks.

### 2. Disputes: move them out now, and widen them in the later design - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** Open Questions (158-168), CUJ 6, state table (409-410),
  routes at 500 and 536-537, `attendance.review`, Alternative 39.
- **Discrepancy Description**: Stage 5 findings 5 and 8 look opposed but apply
  at different times. Part 1 sends no notices, so a 7-day window lapses unseen.
  Removing disputes clears the sub-states, the two-decisions race, "Mark voided"
  against "Not arrived", the one-person-profile question, the 239 against 283
  mismatch and the spare capability.
- **Rationale & Recommendation**: Remove from Part 1 the two dispute event
  types, the `decision` column, three routes, the capability and the learner's
  "This was not me" screen. Keep the author's recorded decisions on the 7-day
  window and who reviews. Record for the later design that a dispute may point
  at any instructor-written event, at which point the `not_flagged` refusal can
  be lifted. This defers work the author chose, so it needs the author's
  agreement.

### 3. The second database user has gathered the most repair work and Part 1 needs it least - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** 576-600, Alternative 27, Rollout (989-995), items 12-16
  and 65-69.
- **Discrepancy Description**: Across the reports the split now needs about ten
  additions: `iam.tf`, `params.tf`, a grant on the `drizzle` schema, the seed
  and preview tasks, a single transaction for grants, a rehearsed way back and
  a proof of deploy order. Critic 4 shows it still leaves `enrollments.user_id`
  and block times open. All of it protects a table that is empty in production,
  by swapping the credential behind every query of the paid product.
- **Rationale & Recommendation**: Ship only the planned source-guard test in
  Part 1. Make the split its own deploy before Part 2's first sale, so a
  failure is traceable to one change. Correct a claim made in Stage 5 finding 2
  and critic finding 8: the generate script does not preserve hand-written
  lines in general. It re-adds two named `CREATE EXTENSION` lines to the one
  `_init` migration and nothing else (`packages/db/scripts/generate.ts`,
  checked), so a trigger would need that script extended. Decide trigger
  against split on the PGlite spike, which has not been run. This reverses the
  timing of an author decision, so it needs the author's agreement.

### 4. An existing mechanism would replace the hand filters - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** 474-491, items 3, 10 and 39 onward.
- **Discrepancy Description**: None of the earlier reports raised this. The
  repo already keeps unwanted rows from learner code with views and a
  restricted client. `packages/db/src/schema/courses.ts` defines `live_lessons`
  and three more views as "where `change_set_id` is null", and
  `packages/db/src/learner-relations.ts` builds `learnerDb` from them. That
  file binds `enrollments` to the raw table. `listForUser` and `loadGraph`
  already read enrollments through `learnerDb` (checked), and by the design's
  own table these are the two reads that open lessons, progress, quizzes and
  certificates.
- **Rationale & Recommendation**: Add a view of enrollments where `class_id` is
  null and bind `learnerDb`'s `enrollments` to it. The learner client then
  cannot return a class enrollment, in the way it cannot return a draft lesson.
  Move the catalog `viewer` and certificate lookups onto `learnerDb`. Keep hand
  filters only for payments, analytics and people. Drop the proposed second
  guard test. Not verified: that Drizzle `1.0.0-rc.5` accepts a view as the
  root of a relational query with its relations.

### 5. Three ways to undo an overturn are proposed; one already exists - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** 397-413, item 34.
- **Discrepancy Description**: Critic 1 asks for a reverse-overturn event.
  Stage 5 finding 5 asks for a dispute on an overturn. The design already
  allows a manual mark once a check-in no longer stands. Critic 1 also asks for
  two more partial unique indexes.
- **Rationale & Recommendation**: Add no new event type. State the precedence
  so a manual mark after an overturn reads "Present, marked by hand", and say
  an overturned learner cannot check in again. Use one unique index on
  `refers_to_event_id` and `type` where `refers_to_event_id` is set. It
  replaces the planned dispute index and also covers a double-clicked overturn.

### 6. The location repairs conflict with each other, and Part 1 needs none - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** 293, 383-385, 451-455, 532-533, Alternatives 22-23, Open
  Questions (146-150).
- **Discrepancy Description**: Read-time flags and an erasable side table
  together mean an erased reading loses its flag. A flag that disappears later
  leaves a permanent overturn of a check-in that is no longer flagged. A
  recheck event adds another event type. In Part 1 a flag blocks nothing and
  only the day view reads it.
- **Rationale & Recommendation**: Add none of the three in Part 1; record them
  as the choice Part 2 must make when a flag first has a consequence. Reword
  the "never changed" goal to say the API can never change a row, and name
  owner-run erasure as the one audited exception. Make a set venue a condition
  of the code route for an in-person class: only the instructor's code window
  shows a code, so `venue_not_set` cannot then occur and that status goes away.
  Store the venue fix's accuracy or drop the field.

### 7. The code window needs no wall clock - Severity: Major

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** 429-432, CUJ 7.
- **Discrepancy Description**: Critic 3 is right that a fast device clock locks
  out a whole class. Its repair adds a server-time field, an offset
  calculation, a warning threshold and a skew test.
- **Rationale & Recommendation**: For each code, return how many milliseconds
  remain until it starts. The window switches by time elapsed since the
  response arrived and never reads the device's clock. Show "offline" once the
  fetched codes run out, which also settles the mismatch between CUJ 7 and line
  431.

### 8. The Support class-day view has no production use in Part 1 - Severity: Nit

- **Reviewer Lens:** `egm-zoom-out`
- **Affected Scope:** CUJ 8, "Support: one class day" (557-562), the Support
  portal items.
- **Discrepancy Description**: The view serves "a class in trouble", and no
  production class exists until Part 2. It is the only route that returns
  coordinates. The RFC places it in the fallbacks step, after check-in.
- **Rationale & Recommendation**: Put it first below the cut line. If it moves,
  Part 1 has no route that returns coordinates, and the question of auditing
  Support's views moves with it. Staging testers can use the request log.

## Not checked by the reviewer

- Whether PGlite enforces grants or runs triggers. The spike is outstanding.
- Whether the pinned Drizzle release accepts a view as the root of the
  enrollment relations (finding 4).
- How account deletion works today.
- Whether the seed needs owner rights.
- Plan items 18-29 and 42-64.
