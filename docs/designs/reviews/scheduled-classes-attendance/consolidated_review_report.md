# Consolidated Review Report

**Target:** `docs/designs/scheduled-classes-attendance.md` (1,772 lines;
FeatureRange 1-1033, DetailedRange 1034-1772)

**Date:** 2026-11-24. **Mode:** all five stages, run without stopping. The
design was not changed between stages.

## Verdict

**The design's shape holds. The document is not ready to implement from.**

- No reviewer challenged the four choices the design rests on: a class as its
  own enrollment row, append-only attendance events, a code worked out from a
  stored secret and the clock, and the `CLASSES` setting with seeded test data.
- The implementation plan does not pass the readiness standard. An engineer
  would have to make impactful decisions the plan leaves open.
- Three clusters hold most of the findings: the correction and dispute rules,
  the second database user, and the location flag. Stage 8 judged that the
  first two are sized for a release with real learners, which Part 1 does not
  have, and that both shrink by removal.
- Every repository claim the reviewers checked against the code was accurate.
  The errors are omissions, not false statements.

## Stage summary

| Stage                      | Reviewers                                                           | Report                               | Blocker | Major | Nit |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------ | ------- | ----- | --- |
| 5 Initial zoom-out         | `egm-zoom-out`, `egm-inventive-catalyst`                            | `zoom_out_report.md`                 | 0       | 9     | 7   |
| 6 Comprehension            | `egm-comprehension`                                                 | `comprehension_report.md`            | 0       | 10    | 2   |
| 7 Critic                   | `egm-design`, `egm-structural`, `egm-style`                         | `critic_report.md`                   | 1       | 16    | 5   |
| 8 Intermediate zoom-out    | `egm-zoom-out`                                                      | `intermediate_zoom_out_report.md`    | 0       | 7     | 1   |
| 9 Implementation readiness | `egm-implementation-readiness`, `egm-codebase-details`, `egm-style` | `implementation_readiness_report.md` | 2       | 15    | 6   |

Counts are per report, after merging overlaps inside each stage. All eleven
reviewer runs completed. The comprehension reviewer's paraphrase matched the
design's intent.

Short names used below: Z = Stage 5, C = Stage 6, K = Stage 7, I = Stage 8, R =
Stage 9, each followed by the finding number in that stage's report.

## Decisions only the author can make

These change what Part 1 contains. Each reverses or re-times something the
author chose, or settles something the design left open. The repairs further
down depend on them.

### D1. The second database user: now, or as its own deploy before Part 2

- **Sources:** Z1, Z2, K4, I3, R4, R10, R11.
- **What the reviewers found:** the split needs about ten additions the plan
  does not have: `iam.tf`, `params.tf`, a grant on the `drizzle` schema,
  `reset-schema.ts`, the seed and preview tasks, one transaction for the
  grants, a rehearsed way back, and a rollout checklist. It still leaves
  `enrollments.user_id` and block times open to change. It protects a table
  that is empty in production, by swapping the credential behind every query of
  the paid product.
- **Options:** (a) ship only the source-guard test in Part 1 and make the split
  its own deploy before Part 2's first sale; (b) keep it in Part 1 and add
  everything above.
- **Open fact:** whether the in-memory test database enforces grants or runs
  triggers. If it does, the rule can be proven in CI, and the trigger option
  deserves a second look. Nobody has run this check.

### D2. Disputes: in Part 1, or with the release that has real learners and notices

- **Sources:** Z5, Z8, I2, K1, K10, K21.
- **What the reviewers found:** disputes add two event types, three routes, a
  capability, four sub-states and a 7-day timer. Part 1 sends no notice, so the
  window lapses unseen, and nothing reads the outcome. Removing them clears most
  of the state-table Blocker.
- **Options:** (a) move disputes out of Part 1, keep the recorded decisions on
  the 7-day window and who reviews, and note that the later design may let a
  dispute point at an overturn; (b) keep them in Part 1 and specify every mixed
  case.

### D3. The location flag: leave as stored, or change how it is judged

- **Sources:** Z4, Z12, Z15, K5, K7, I6.
- **What the reviewers found:** the flag is fixed when the row is written, so a
  late or badly set venue flags a whole class for good. Three repairs were
  proposed and they conflict: judging the flag at read time, moving coordinates
  to an erasable side table, and a recheck event.
- **Options:** (a) add none in Part 1, where a flag blocks nothing; require the
  venue to be set before the code route answers for an in-person class, which
  removes `venue_not_set`; record the three repairs as Part 2's choice; (b)
  pick one repair now.
- **Also for the author:** the coordinates are kept inside rows that may never
  change, so the first erasure breaks the "never changed" goal as written.
  Stage 8 suggests rewording the goal to "the API can never change a row" and
  naming owner-run erasure as the one audited exception.

### D4. Where Part 1 stops if time runs out

- **Sources:** Z3, I1, I8, R5.
- **What the reviewers found:** the document names no deadline, no estimate and
  nothing to drop. The RFC already orders the work: foundations, class setup,
  check-in and day view, then fallbacks and the Support view.
- **Options:** adopt that order as the cut line, land the foundations as their
  own deploy first, and put the Support view, the tier share and disputes below
  the line; or keep Part 1 whole.

### D5. A learner-side view of enrollments instead of hand-written filters

- **Sources:** I4, Z9.
- **What the reviewers found:** the repo already keeps draft lessons away from
  learner code with views behind a restricted client. The two reads that open
  lessons, progress, quizzes and certificates already go through that client.
  A view of enrollments where `class_id` is null would make the rule hold by
  construction for those reads.
- **Open fact:** whether the pinned Drizzle release accepts a view as the root
  of a relational query. Not verified.

### D6. The signed-out learner at the door

- **Sources:** K6, C3.
- **What the reviewers found:** the QR link always opens the browser, where an
  app user is signed out. Sign-in requests are limited to 30 per 15 minutes per
  network address, so a class on one venue network can lock later learners out.
- **Options:** state "signed in beforehand" in the 20-learner check and list the
  limiter as a Part 2 prerequisite; or change the limiter key now, which changes
  sign-in protection on the live product.

### D7. Account deletion against the new restrict rules

- **Sources:** C4.
- **What the reviewers found:** the old list is faulted for being deleted with
  the account, and the new rows restrict deletion of the enrollment and the
  acting user. The design does not say what happens when a learner or
  instructor with attendance rows deletes their account.

## Action items that need no author decision

### Blockers

| #   | Action                                                                                                                                                                                                                                                           | Sources         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| A1  | **State table.** Say rows are tested top to bottom and the first match wins. Define "standing". List the mixed cases: overturn then manual mark, mark after a void, an overturned learner trying again. Use one unique index on `refers_to_event_id` and `type`. | K1, C2, I5, R23 |
| A2  | **Item 18 constants.** Give each its anchor (before the block starts, after it ends, from the mark). Count `code_expired` with `code_wrong` in the lockout. Fix verification step 5.                                                                             | R1              |
| A3  | **Seed.** Name the learners, block times and lookup key. Create a fresh class when no seeded block is open or ahead. Make the count match the 20-learner check. Say how the seed makes the code secret.                                                          | R2, Z7, C3      |

### Major

| #   | Action                                                                                                                                                                                                             | Sources                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| A4  | **Freeze rule.** A block is frozen only once it has a `check_in` or `manual_mark`.                                                                                                                                 | Z6, K2                                |
| A5  | **Code window clock.** Return the time remaining until each code starts; switch on elapsed time, not the device's clock. Show "offline" when the fetched codes run out.                                            | K3, I7, C11                           |
| A6  | **Route-table test.** Define new markers and their rule in `allowed()`, the fixture ids, and the additions to each written-out list.                                                                               | R3                                    |
| A7  | **Missing files.** Add `reset-schema.ts`, `chrome.en.ts` and `chrome.zh.ts` (a `nav.classes` key with Chinese text). Add `iam.tf` and `params.tf` if D1 keeps the split. Drop "no file outside this list changes". | R4, Z1                                |
| A8  | **Phases.** Group the plan into phases that each end with typecheck and tests passing.                                                                                                                             | R5                                    |
| A9  | **Contracts.** Write the fields of each response type, each request schema's fields and limits, and the alphabet's characters.                                                                                     | R6                                    |
| A10 | **Error table.** Condition, status, code, message and details for every learner and Teach refusal, with the mapping from stored reasons.                                                                           | R7, R13, C11                          |
| A11 | **Clock.** The attendance service sets `createdAt` from `deps.now()` on every insert.                                                                                                                              | R8                                    |
| A12 | **Circular import.** Name the callbacks that carry `(): AnyPgColumn`, and the self-reference pattern.                                                                                                              | R9                                    |
| A13 | **Goals.** Reword "additive", "the switch", "every attempt is one row" and "the instructor can correct the record" to what the plan does. Define "tier" or remove it. Use one class size.                          | K11, K12, K13, K14, C5, C10, Z16, R12 |
| A14 | **Risks section.** Add it as a table, filled by moving the three decided "open questions" and the Rollout text.                                                                                                    | K9, K10                               |
| A15 | **Alternatives.** Put the deciding trade-off in each Reason line, link the RFC section, renumber, and correct the claim about the generate script in Alternative 27.                                               | K8, Z16, I3                           |
| A16 | **Terms.** One word per thing: the code screen, block, published course, the enum names for statuses. Define the four profile actors once. Say who drafted and who reviewed.                                       | K15, K16, K17, C1, C7, C8, C12, R23   |
| A17 | **Verification.** Give each step its expected result and command. Add a goal-to-test table that says which goals are proved by hand.                                                                               | R16, R17, C9                          |
| A18 | **Plan entries.** Add the missing "Why" lines, split bundled entries, and name the objects in items 11, 12, 65, 66 and 69. Say who calls `zonedToInstant`.                                                         | R14, R15                              |
| A19 | **Deploy steps.** If D1 keeps the split: the migration task's container, command and secrets, the exact workflow changes, and a rollout checklist. Explain how a Terraform apply relates to the running service.   | R11, C6                               |

### Nits

| #   | Action                                                                                                                                                                                  | Sources            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| A20 | Remove work: accept only `Asia/Singapore` with a fixed offset; two capabilities, or say why four; make the radius a constant; reuse the existing token encoder; name `refetchInterval`. | Z10, Z13, Z14, Z15 |
| A21 | Write attendance corrections only to `attendance_events`, not also to `audit_log`.                                                                                                      | Z11                |
| A22 | Reconcile the two descriptions of the HMAC step, and fix the `notFound` and `conflict` calls.                                                                                           | R18, R19, Z10      |
| A23 | Name backup retention as a Part 2 prerequisite.                                                                                                                                         | Z16, K21           |
| A24 | Split CUJ 6; use the screen names from the Components diagram; fix "stored in Singapore time".                                                                                          | K19, C11           |
| A25 | Promote the two nested headings; cite spec sections, not line numbers; move the solution paragraph out of The Problem.                                                                  | K20                |
| A26 | Say what happens when an assigned instructor leaves the profile.                                                                                                                        | K18                |
| A27 | Point the two AGENTS.md edits at sections that exist; say how the two-app test is built; fix item 39's "Why".                                                                           | R20, R21, R22      |
| A28 | Replace decorative wording with the plain fact.                                                                                                                                         | K22                |

## Where the reviewers disagree

| Subject                            | One view                                                              | The other view                                                                  | Stage 8's view                                                         |
| ---------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Disputes                           | Widen them to cover overturns (Z5).                                   | Move them out of Part 1 (Z8).                                                   | Move out now, widen in the later design (I2).                          |
| Undoing an overturn                | Add a reverse-overturn event (K1).                                    | Let a dispute undo it (Z5).                                                     | Neither: a manual mark already does it once precedence is stated (I5). |
| Location flag                      | Judge it at read time (Z4, K7).                                       | Move coordinates to an erasable side table (Z12, K5).                           | The two conflict; do neither in Part 1 (I6).                           |
| The trigger alternative            | Reassess it; the generate script preserves hand-written SQL (Z2, K8). | That claim is wrong: the script re-adds two extension lines only (I3, checked). | Decide after the test-database check.                                  |
| Guarding the "class is empty" rule | A second source-reading test (Z9).                                    | A view behind the learner client (I4).                                          | The view, if the pinned Drizzle allows it.                             |

## Checks nobody has run

- Whether the in-memory test database enforces grants and runs triggers.
- Whether the pinned Drizzle release accepts a view as the root of a
  relational query, and whether its migrator takes a journal-schema option.
- Whether `pg` exports `escapeLiteral`.
- Whether the seed needs owner rights.
- How account deletion works today.
- Browser location accuracy on an instructor's laptop.
- SSG's requirements and Singapore's privacy guidance, carried from the RFC.

## Traceability matrix

| Stage finding      | Consolidated item |
| ------------------ | ----------------- |
| Z1                 | D1, A7            |
| Z2                 | D1                |
| Z3                 | D4                |
| Z4                 | D3                |
| Z5                 | D2                |
| Z6                 | A4                |
| Z7                 | A3                |
| Z8                 | D2                |
| Z9                 | D5                |
| Z10                | A20, A22          |
| Z11                | A21               |
| Z12                | D3                |
| Z13, Z14           | A20               |
| Z15                | D3, A20           |
| Z16                | A13, A15, A23     |
| C1                 | A16               |
| C2                 | A1                |
| C3                 | A3, D6            |
| C4                 | D7                |
| C5                 | A13               |
| C6                 | A19               |
| C7, C8, C12        | A16               |
| C9                 | A17               |
| C10                | A13               |
| C11                | A5, A10, A24      |
| K1                 | A1, D2            |
| K2                 | A4                |
| K3                 | A5                |
| K4                 | D1                |
| K5                 | D3                |
| K6                 | D6                |
| K7                 | D3                |
| K8                 | A15               |
| K9, K10            | A14, D2           |
| K11, K12, K13, K14 | A13               |
| K15, K16, K17      | A16               |
| K18                | A26               |
| K19                | A24               |
| K20                | A25               |
| K21                | A23, D2           |
| K22                | A28               |
| I1                 | D4                |
| I2                 | D2                |
| I3                 | D1, A15           |
| I4                 | D5                |
| I5                 | A1                |
| I6                 | D3                |
| I7                 | A5                |
| I8                 | D4                |
| R1                 | A2                |
| R2                 | A3                |
| R3                 | A6                |
| R4                 | A7, D1            |
| R5                 | A8, D4            |
| R6                 | A9                |
| R7                 | A10               |
| R8                 | A11               |
| R9                 | A12               |
| R10, R11           | D1, A19           |
| R12                | A13               |
| R13                | A10               |
| R14, R15           | A18               |
| R16, R17           | A17               |
| R18, R19           | A22               |
| R20, R21, R22      | A27               |
| R23                | A1, A16           |

## Decisions taken after the review (2026-11-24)

Two checks were run first, as throwaway scripts outside the repo, against the
versions the repo pins (PGlite 0.5.16, Drizzle 1.0.0-rc.5):

- The in-memory test database enforces role grants and runs triggers. A second
  role with update, delete and truncate revoked on one table was refused all
  three and allowed insert and select.
- A view works as the root of a relational query with its relations, and a row
  outside the view is not found by its id.

| Decision                | Author's choice                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Second database user | Keep the split in Part 1, completed with everything the review found missing. The API tests run as the restricted role, so CI proves the rule.                                                                |
| D2 Disputes             | Keep disputes in Part 1 as designed, and add the missing rules: an order of precedence, a definition of "standing", and an index that prevents two decisions on one dispute.                                  |
| D3 Location flag        | The flag is fixed at check-in. For an in-person class no code is shown until the venue position is set. The venue reading's accuracy is stored and checked.                                                   |
| D3 Coordinates          | Latitude and longitude move to a side table keyed by the event. The API's database user may delete from it. The attendance row is never touched.                                                              |
| D4 Release              | One production release. The plan is grouped into build phases that each end with tests passing. No cut line.                                                                                                  |
| D5 Filter rule          | A view of self-paced enrollments behind the learner client. Hand-written conditions stay only in checkout, analytics and Support's person view.                                                               |
| D6 Signed-out learner   | The signed-out check-in page offers "open the app and type the code" beside "sign in here". The sign-in limit is listed for Part 2.                                                                           |
| D7 Account deletion     | Settled by fact, not by a choice: the code has no account deletion today, and a user with a payment already cannot be deleted. Attendance rows follow the same rule. The design states this as a known limit. |

These decisions change several action items: A7 and A19 now apply in full
(D1); A1 keeps the dispute states (D2); D3 adds a table and a grant rule; A8
stands without a cut line (D4); A13's "additive" wording must also cover the new
view (D5).
