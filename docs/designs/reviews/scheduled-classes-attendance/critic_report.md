# Goldfish Review Report: Stage 7 (Critic Review)

**Target:** `docs/designs/scheduled-classes-attendance.md` (FeatureRange, lines
1-1033)

## Reviewer Status

| Reviewer         | Standard                | Status    |
| ---------------- | ----------------------- | --------- |
| `egm-design`     | `feature-spec-standard` | completed |
| `egm-structural` | `feature-spec-standard` | completed |
| `egm-style`      | none                    | completed |

Totals before merging: 1 Blocker, 25 Major, 6 Nit. After merging overlaps: 1
Blocker, 16 Major, 5 Nit. Claims marked "checked" were confirmed against the
code after the review.

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. The learner-state table does not give one state per learner - Severity: Blocker

- **Reviewer Lens:** `egm-style`, `egm-design`
- **Affected Scope:** 397-413 (indexes and state table), 445-446, 534-537.
- **Discrepancy Description**:
  - The six states are not mutually exclusive and no order of precedence is
    given. An overturned check-in followed by a manual mark fits both
    "Overturned" and "Present, marked by hand". A voided mark fits both "Mark
    voided" and "Not arrived".
  - "Standing" is never defined. The sub-states "open to dispute, disputed,
    upheld, settled" appear only in a table cell with no rule for each.
  - Rows can never be changed, so any conflicting row is permanent, and only two
    cases are guarded by an index. Not covered: two decisions on one dispute
    (an owner and a manager at the same moment), a repeated overturn or manual
    mark from a double click, and a second manual mark after a voided one.
  - An instructor's mistaken overturn cannot be undone. The learner cannot check
    in again, because the unique index blocks a new row, and the only repair is
    a manual mark that asserts an identity document was checked.
- **Rationale & Recommendation**: State that rows are tested top to bottom and
  the first match is the state, define "standing", and list the mixed cases. Add
  partial unique indexes for one overturn per check-in and one decision per
  dispute. Add a way to reverse an overturn as a new event pointing at it.

### 2. A refused attempt freezes the block for good - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** 353-355, 441-459.
- **Discrepancy Description**: A block is frozen once it has any attendance
  event, and a `not_open_yet` refusal is one. One early tap, even days ahead,
  stops the profile from changing or removing the block. Refusal rows are
  bounded only by the in-memory limit of 20 a minute per user, in a table
  nothing can delete from.
- **Rationale & Recommendation**: Freeze only on a `check_in` or `manual_mark`.
  Cap window refusals per learner and block in the database, or keep them out of
  `attendance_events`.

### 3. The code window trusts the instructor device's clock - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** 429-432, CUJ 7 (248-252).
- **Discrepancy Description**: The window receives codes with start times and
  "switches code on its own clock". A device more than about a minute fast
  shows a future code, which the server answers as `code_wrong`. Each learner
  then uses five tries and is locked out, so the whole class fails together. A
  slow clock gives intermittent `code_expired`.
- **Rationale & Recommendation**: Return the server's time with each code
  response and switch on the corrected offset. Warn when the offset is large.
  Add a journey or test for a skewed clock.

### 4. The restricted database user reaches production with no switch and no stated way back - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** 576-600, 982-999, goal at 70-75.
- **Discrepancy Description**:
  - "Rollback of the feature is the switch" covers only class routes. The
    credential swap, the dropped unique constraint and the `class_id is null`
    filters go to production unswitched. A missing privilege on a rare path,
    such as a refund or a webhook, passes the health check.
  - "ECS returns to the previous revision, which still connects as the owner"
    is true only for the first deploy. The circuit breaker with rollback is on
    (`api.tf` lines 99-101, checked).
  - `migrate.ts` grants update and delete on every table and then revokes them
    on `attendance_events`. Unless that is one transaction, the API can alter
    attendance rows for a moment on each deploy.
  - The API user can still update `enrollments.user_id` and a block's times. A
    manual mark names its learner only through the enrollment.
  - The deploy role can run the migration task with any command.
- **Rationale & Recommendation**: State and rehearse the revert path for the
  credential split. Run grants and revoke in one transaction, or never grant
  update and delete on that table. Copy the learner's user id onto each event,
  or say what the database rule does not cover.

### 5. Coordinates sit inside rows that may never change, and views are not recorded - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** 146-150, 384-385, Alternatives 22-23, 947-955.
- **Discrepancy Description**: An erasure request is met by updating rows as the
  owner, which contradicts "never changed or deleted". Any later retention rule
  has the same conflict. Alternative 23 was rejected only because it "needs a
  deletion job"; no alternative keeps the personal data outside the immutable
  row. Support's reads of coordinates are not audited, while Alternative 4
  counts "nothing records who viewed a file" against storing images.
- **Rationale & Recommendation**: Evaluate a side table for the reading, keyed
  by event id, and record it as a considered alternative either way. Record
  Support views of coordinates, or say why not.

### 6. The QR path assumes a browser sign-in that most app users will not have - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** CUJ 2 (185-188), 470-472, goal at 100-101, Alternative 12.
- **Discrepancy Description**: The QR link always opens the browser. A learner
  who uses the app is signed out there and must request an emailed sign-in,
  wait, return and type the current code. For app users that is the main path,
  not the edge case. Anonymous sign-in requests are limited to 30 per 15
  minutes per client address (`apps/api/src/routes/auth.ts` line 14, checked;
  the key is the address for a signed-out request, checked). A class on one
  venue network shares one address, so 20 to 30 learners with a few retries
  reach the limit and later learners cannot sign in.
- **Rationale & Recommendation**: Name the expected path for a signed-out
  learner. Options: key that limiter by email for this flow, have the
  signed-out QR page offer "open the app and type the code", or ask learners to
  sign in beforehand. Add a pass or fail check for a class that starts signed
  out.

### 7. The venue position has no quality check and flags are never re-evaluated - Severity: Major

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** 293, 334, 400-413, 451-455, Alternative 22.
- **Discrepancy Description**: The venue is one reading from the instructor's
  device, often a laptop. Its accuracy is neither stored nor checked. A bad
  reading flags every learner against a 200 m radius no screen can change.
  Learners who arrive before the venue is set are flagged for good. Correcting
  the venue later clears nothing.
- **Rationale & Recommendation**: Store the venue reading's accuracy and warn
  above a threshold. Work out the flag at read time from the stored coordinates
  and the current venue, or add a "recheck" event. Say what the day view does
  when the code window is opened with no venue set.

### 8. Rejections restate the decision or credit people without a link - Severity: Major

- **Reviewer Lens:** `egm-structural`, `egm-design`, `egm-style`
- **Affected Scope:** Alternatives Considered (610-939).
- **Discrepancy Description**: The standard requires a concrete trade-off in
  each rejection and forbids attributing one without a link. About ten entries
  give only "Rejected by author" plus the chosen option: Alternatives 2, 9, 10,
  11, 15, 20, 22, 23, 27 and 37. Alternative 39 is circular ("as the RFC says").
  Others cite "three reviewers", "five reviewers", "the migration reviewer" and
  "the maintenance reviewer" with no pointer. "Rejected by author, for 60
  seconds" reads as a duration. Alternative 27 rejects a trigger because
  hand-written SQL "can be lost on regeneration", while the generate script
  already preserves hand-written lines, and the chosen grant is also
  hand-written SQL that local and test databases do not enforce.
- **Rationale & Recommendation**: Put the deciding trade-off in each Reason
  line and link the RFC section that records it. Redo Alternative 27 on
  enforcement coverage. Renumber so Alternative 39 is in order.

### 9. No Risks and Mitigations section - Severity: Major

- **Reviewer Lens:** `egm-structural`, `egm-design`
- **Affected Scope:** Non-Functional Requirements (943-999), whole document.
- **Discrepancy Description**: The standard requires failure modes, security
  implications and scalability limits, each with a mitigation. The risk content
  is split across Open Questions, Security and privacy, Rollout and Future
  Improvements, with no list pairing a risk with a mitigation. Failure modes
  the plan creates have no entry: the restricted user is created only "when
  both are set", so a missing setting leaves the API on the owner user; the
  code window's clock; no alarms. Limits (one API task, an in-memory limiter,
  polling) are implied and never stated.
- **Rationale & Recommendation**: Add "## Risks & Mitigations" as a risk,
  impact and mitigation table, as the sibling design `learner-hover-preview.md`
  has, and keep Rollout and rollback under it.

### 10. Three "open questions" are decisions already made - Severity: Major

- **Reviewer Lens:** `egm-structural`, `egm-style`
- **Affected Scope:** 158-168.
- **Discrepancy Description**: "A wrong check-in that carries no flag cannot be
  corrected", "A learner cannot dispute an overturn" and "A one-person profile
  reviewing its own manual mark" each say the author decided or accepted them.
  None asks anything.
- **Rationale & Recommendation**: Move them to the Risks section as accepted
  risks. Leave erasure approval, the location wording and the SSG session unit
  as the open questions.

### 11. The "additive" goal is contradicted by the document's own text - Severity: Major

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** Goals 84-85, data model 368-370, Rollout 984-999.
- **Discrepancy Description**: The goal says database changes are additive and
  the previous API works after a rollback. The data model drops the old unique
  constraint in the same migration. The rollback claim rests on "no class
  enrollment can exist in production", but staging has the switch on and seeded
  class enrollments. Line 998-999 forbids deploying older versions after Part 2.
- **Rationale & Recommendation**: Restate the goal as what is meant: the
  previous version behaves the same against the new schema while no class
  enrollment exists. Name the dropped constraint as the one non-additive step.

### 12. "The switch" means two things - Severity: Major

- **Reviewer Lens:** `egm-structural`, `egm-style`
- **Affected Scope:** 24-26, 86-92, 174, 564-574, 987-988, 996-997.
- **Discrepancy Description**: The Overview and the goal describe a switch that
  keeps selling off. The plan has one setting, `CLASSES`, that turns every class
  route off, and nothing in Part 1 creates a class enrollment through the API at
  all. The goal's check is true with the switch on or off, so it tests nothing.
  "A profile can set up a class" is unqualified, yet no production profile can.
  Line 570-571 and line 996-997 disagree on whether `GET /me/classes` answers
  404 or an empty list.
- **Rationale & Recommendation**: Use "the `CLASSES` setting" everywhere. Reword
  the selling goal as "no route creates a class enrollment". Say class setup is
  checked on staging only.

### 13. "Every attempt is one row" is not what the plan does - Severity: Major

- **Reviewer Lens:** `egm-structural`, `egm-style`
- **Affected Scope:** Goals 70-71, 441-446, 459; glossary line 37.
- **Discrepancy Description**: Step 1 answers 404 for a learner with no class
  enrollment and stores nothing. Step 3 answers 200 for a repeat and stores
  nothing. "Attempt" means a refused try in the glossary and every try in the
  goal. The glossary names five event kinds; the enum has six.
- **Rationale & Recommendation**: Narrow the goal to attempts by an enrolled
  learner that reach the code check, state the two exceptions, and fix the
  glossary.

### 14. Two goals have nothing to check them against - Severity: Major

- **Reviewer Lens:** `egm-structural`, `egm-style`
- **Affected Scope:** Goals 100-101, 106-115.
- **Discrepancy Description**: "Tier" is not in the word list, its four tiers do
  not match the six states, and no section says which screen or endpoint shows
  the share. "A class of 20 checks in within five minutes" does not say how it
  is measured when classes are test data; Performance uses 30. "Honest about
  being stale" and "can see a class in trouble" give no check.
- **Rationale & Recommendation**: Define "tier" and map it to states, name where
  the share appears, and give each goal a measurable check.

### 15. Roles are undefined and the instructor rule is stated three ways - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** 89, 137-138, 174-175, 239, 280, 283, 336, 510-520, 541.
- **Discrepancy Description**: "Owner", "manager", "writer" and "staff" are
  never defined. The document refuses "a fourth role" while its table has four
  columns. Line 280 says the instructor acts "whatever their role", but Staff
  hold no `attendance.take`. The owner is a member at 174-175 and separate from
  members at 336 and 541. Line 239 says only the owner sees disputes; line 283
  says owner or manager.
- **Rationale & Recommendation**: Define the four actors once. Say the
  instructor must be the owner, a manager or a writer.

### 16. Words that carry two meanings - Severity: Major

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** as listed.
- **Discrepancy Description**:
  - "Window" is a time span and a browser window (108, 187, 429, 443, 547-555).
  - "Period" is a time block (33) and a code minute (193, 252, 386).
  - "Day" and "block" name the same unit: "day view", "class day", "run a day"
    (36, 111, 257-258, 513-520, 557-562), though a day can hold several blocks.
  - "Live" means taught in real time (13) and published (539, 777).
  - "Package" means a product offering (888-890) and a code package (401).
  - The app location status is "not available in the app" (204) and
    `unsupported`; a different value, `unavailable`, means a timeout. The
    instructor's visible fields are listed three ways (288, 531, 949).
- **Rationale & Recommendation**: Call the browser window "the code screen".
  Use "block" where one block is meant. Use "published" for course status. Use
  the enum names for statuses.

### 17. Unnamed actors and undefined references - Severity: Major

- **Reviewer Lens:** `egm-style`, `egm-structural`
- **Affected Scope:** 142-143, 291-297, 599-600, 732, 999, and the reviewer
  citations in Alternatives.
- **Discrepancy Description**: "An addition of mine to the author's choice" has
  no referent. "Drafting" appears as an actor in the "Decided by" column.
  "The five weeks" refers to a deadline stated nowhere. "The decision record"
  is not named. "Beta records: treated as kept" cannot be understood. SSG, ECS
  and ADR are not expanded.
- **Rationale & Recommendation**: State once who drafted the document and what
  the reviews were. Name ADR 012. Expand abbreviations at first use.

### 18. Nothing handles an instructor who leaves the profile - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** 336, 517-520, 539-541.
- **Discrepancy Description**: Membership is checked only at publish. If the
  instructor is removed, nobody can open the code window until an owner or
  manager reassigns.
- **Rationale & Recommendation**: Warn on removing a member assigned to a class
  with future blocks, and show it on the class list.

### 19. Journeys that are not one Given, When, Then - Severity: Nit

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** CUJs 1, 3, 4, 6.
- **Discrepancy Description**: CUJ 6 covers three actors and a three-day gap.
  CUJ 4's Given has no class or platform. CUJs 3 and 6 say the learner "opens
  the class", while Non-Goals puts "the class page" in Part 3. CUJ 1 says
  blocks are "stored in Singapore time"; the data model says instants.
- **Rationale & Recommendation**: Split CUJ 6 and use the screen names from the
  Components diagram.

### 20. Heading levels and dangling references - Severity: Nit

- **Reviewer Lens:** `egm-structural`
- **Affected Scope:** 60-64, 1003, 1007, 1010, 1017.
- **Discrepancy Description**: "Additional Resources" and "Future Improvements"
  are nested under Non-Functional Requirements. The last paragraph of The
  Problem describes the solution. "Product spec, lines 33 and 63" will drift
  once the plan edits that file. `docs/designs/teacher-profiles.md` is plain
  text where its neighbours are links.
- **Rationale & Recommendation**: Promote the two headings, cite section names,
  and move the solution paragraph.

### 21. Smaller gaps against the standard and the RFC - Severity: Nit

- **Reviewer Lens:** `egm-design`
- **Affected Scope:** 479-487, whole document.
- **Discrepancy Description**: The RFC's "lengthen database backup retention"
  is not named as a Part 2 prerequisite. `activeCourseIds` and `ensureActive`
  are missing from the filter table; neither has a caller outside its own
  service (checked), and plan item 39 does list them. No notice of a manual
  mark is sent in Part 1 or planned in Part 3, so the 7-day window can lapse
  without the learner knowing.
- **Rationale & Recommendation**: Add the backup item, list the two helpers in
  the table, and put the silent dispute window in the Risks section.

### 22. Decorative wording and figures that do not agree - Severity: Nit

- **Reviewer Lens:** `egm-style`
- **Affected Scope:** 50, 54, 100, 106, 111, 428, 905-906, 973.
- **Discrepancy Description**: "Has nowhere to live", "honest about being
  stale", "a class in trouble", "harmless", "for no gain". "About a dozen
  places" against seven rows in the table. A class is 20 at line 100 and 30 at
  line 973. "Safe to project" does not say safe from what.
- **Rationale & Recommendation**: Replace with the plain fact in each case.

## Not checked by the reviewers

- ADR 006 and ADR 010 in detail.
- That `requireProfile`, `recordAudit` and `schema-guard.test.ts` behave as the
  specification describes.
- Whether the in-memory test database can enforce grants.
- Whether the portals or the learner app read enrollments by learner and course
  outside the listed table.
- How the code handles removing a member today.
- SSG's requirements and the Singapore privacy guidance.
