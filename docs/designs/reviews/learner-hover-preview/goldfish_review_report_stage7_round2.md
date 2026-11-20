# Goldfish Annotated Review Report

**Status: resolved** on 2026-11-20. The author chose "auto accept".

- Applied: the proposed fixes of issues 2 to 10 and 12 to 21. Issue 3 went in as open
  Question 15, naming nobody, as the gate message said it would.
- Not applied: issue 11 (declined, waits on Question 14) and the declined parts listed in the
  summary. Issue 1 needed nothing.
- The line numbers below are those of the file before these fixes. It now has 2,668 lines and
  the plan starts later.
- Two fresh checkers then read the result and found three Major problems, all in the three
  fixes that change the build. Each was corrected the same day:
  - **Issue 9, the lifecycle rule.** It does nothing until a person applies the Terraform,
    and the release order said no command was needed. "Order of release" now has a step for
    the apply, and says a late apply still works.
  - **Issue 10, the runbook query.** It missed the row that issue 8's new order can leave: a
    preview saved as off with its file still stored. The query now also selects
    `not preview_enabled`.
  - **Issue 8, the audit order.** The text claimed every change has a record before the wait
    for Mux. If the audit write itself fails, the change has no record and a repeat writes
    none. The text now says so. A test for the order, "The placement in a save", was added
    to item 16.
- Smaller corrections from the same check: Alternative Q's reason no longer cites "new
  Terraform applied by hand", which the design now also needs; Alternative W no longer says
  "four times larger", a figure the shortened Question 5 dropped; Alternative Z says "little"
  as its own Cons do; the Records entry for the brief says four of the five departures are
  from decision 9; the Overview says "the agreement text on Teach's application pages", not
  "the teacher agreement".
- The checkers' fixes have not been read by a third party.

**Target:** `docs/designs/learner-hover-preview.md` (lines 1 to 1573, the feature part, as the
file stands on 2026-11-20)

**Stage:** 7 (Critic Review), round 2. Findings come from
`critic_report_round2.md`, in this folder. Their line numbers are
those of the version reviewed on 2026-11-19; the numbers below are today's.

## How to read this report

- Stage 7's 39 findings are grouped into 21 issues. Each issue lists the findings it covers
  and takes the highest severity any reviewer gave.
- Seven findings were settled, in whole or in part, by the three decisions of 2026-11-20
  (issue 1). They are listed so the record is complete; nothing more is proposed for them.
- Nothing is contested. Every finding describes the text accurately; that was checked
  against the file and, for six of them, against the code.
- One issue (issue 3) needs a fact only the author has. It is marked **ESCALATE**.
- Three proposed fixes change what gets built, not only what the document says. Each is
  marked **"Changes the build"**: issues 8, 9 and 10.
- Five fixes also edit the Detailed Implementation Plan, which is outside the target range,
  so that the two parts keep saying the same thing. Each is marked **"Also edits the plan"**.

## Prioritized Findings & AI Suggestions

### [Issue 1] [`design`, `structural`, `style`] - Severity: Major

- **Findings covered:** `design-2-1` (neither kill path stops clips being served),
  `design-2-2` (a removed video's clip stays public), `design-2-8` (the catalog check loads
  every item), `structural-2-5` (CUJ 7 has four bullets), the "None" part of `style-2-1`, the
  Goal 7 part of `style-2-3`, and the "eleven call sites" part of `style-2-16`.
- **Affected Scope:** Goals 7 and 8, Open Questions, CUJ 7, "When the clip is made", "The
  catalog", "Configuration and turning it off", Risks, "Rollout and rollback".
- **Discrepancy Description:** as in the critic report.
- **Rationale:** as in the critic report.
- **_AI Suggestion:_** PROPOSE FIX, already applied on 2026-11-20
- **_Justification:_** the author decided each on 2026-11-20 and the design was edited the
  same day. A removed video's clip is now deleted in the edit, and the catalog check is gone.
  The off switch stays a pause, and the text now says so. Open Questions holds Question 14.
  Two recommendations of `design-2-1` were declined by the author with that decision: the
  check in the file route (Alternative AN) and a purge command (Future Improvements).
- **_Proposed Edit:_**
  - None. Recorded only.

### [Issue 2] [`design`, `structural`, `style`] - Severity: Major

- **Findings covered:** `design-2-3`, `structural-2-3`, `style-2-2`, `style-2-4`.
- **Affected Scope:** [Lines 206-238](../../learner-hover-preview.md#L206-L238)
  (Question 10), [964-965](../../learner-hover-preview.md#L964-L965) (Order of
  release), "Checks before any code is written", and the Risks row "Mux behaves differently
  on a signed asset".
- **Discrepancy Description:** the gate asks for "a signed video of real lesson footage" and
  "the file's size at the clip's shape". The calls used one flat-coloured animation, almost
  all at 320 pixels. Question 10 says "the design works as written". The Order of release
  still says "No code is written until the six checks have been made", in the present tense,
  while checks 4 to 6 are unanswered.
- **Rationale:** the 3 MB cap, the 10-second timeout and the API-load estimate rest on one
  best-case sample, and a reader can't tell whether the gate was met.
- **_AI Suggestion:_** PROPOSE FIX for the text. DECLINE two recommendations.
- **_Justification:_** accurate. The plan's item 1 was rewritten as a dated record on
  2026-11-19, and a measurement on filmed footage was added to its staging step; the feature
  part was not. Declined: re-running the checks on filmed videos before code, because the
  author chose on 2026-11-19 to make no more calls now; and a card state for a clip that is
  always over the cap, because no such clip has been seen (Stage 8, `I2.4`).
- **_Proposed Edit:_**
  - Location: Order of release, first bullet. Replace with: "**The Mux checks came first.**
    They were made on 2026-11-19, before any code (item 1). They did not measure filmed
    footage; that is measured in staging before the learner PR deploys
    ([Checks before any code is written](#checks-before-any-code-is-written))."
  - Location: "Checks before any code is written", whole body. Replace with a record in the
    past tense: what the checks were meant for (real lesson footage), what video was used (a
    60-second flat-coloured animation), and for each of the six checks its result. Checks 1
    and 3: passed. Check 2: measured on 56 clips at 320 pixels and one at the shipped 480
    pixels (242,552 bytes, 4.4 seconds), and not on filmed footage. Checks 4 to 6: not
    answered, because the limit was never reached (Question 14). Then one paragraph: the 3 MB
    cap, the 10-second timeout and the load figure in Risks rest on check 2, and filmed
    footage is measured in staging with `previews check` before the learner PR deploys.
  - Location: Question 10, first sentence. Replace "the design works as written." with "on
    the one video tried, the calls behave as the design describes."
  - Location: Question 10, item 2. Replace "The 3 MB cap leaves more than ten times the room.
    These are at 320 pixels; the one clip made at 480 pixels took 4.4 seconds." with "At 320
    pixels the 3 MB cap leaves more than ten times the room. The one clip at the shipped
    width, 480 pixels, was 242,552 bytes and took 4.4 seconds. Filmed footage was not
    measured."
  - Location: Risks, "Mux behaves differently on a signed asset". Replace "Checked by real
    calls on 2026-11-19 (Question 10):" with "Checked by real calls on one animated video on
    2026-11-19 (Question 10):".

### [Issue 3] [`design`, `style`] - Severity: Major

- **Findings covered:** the offline-agreement part of `design-2-4`, and the "whoever drafts
  it" part of `style-2-1`.
- **Affected Scope:** [Lines 158-160](../../learner-hover-preview.md#L158-L160)
  (Non-Goals, "Legal review of the agreement sentence").
- **Discrepancy Description:** `docs/spec.md` line 77 describes a teacher agreement drafted
  outside the code that grants only a hosting licence. Whether it covers previews is left to
  "whoever drafts it", with no owner and no gate, under a heading that said nothing was
  open.
- **Rationale:** default-on consent rests on agreement text. If the full agreement disagrees
  with the sentence on the application page, the page's sentence may not be enough.
- **_AI Suggestion:_** ESCALATE
- **_Justification:_** the critique is valid, and the fact needed to fix it is outside every
  file: who drafts the full agreement, and whether it exists yet. The document can only
  record that this is open. The proposed edit does that and names nobody.
- **_Proposed Edit:_**
  - Location: Open Questions, a new open entry: "**Question 15 (the full teacher agreement),
    open:** the application pages gain a sentence about previews. `docs/spec.md` describes a
    fuller teacher agreement, drafted outside the code, that grants a hosting licence only.
    Someone has to check that it covers previews before production opens to teachers. Who
    does that, and by when, is not decided."
  - Location: Non-Goals, "Legal review of the agreement sentence". Replace "is for whoever
    drafts it." with "is open (Question 15)."
  - Location: Order of release, the bullet "The server PR is in production before production
    opens to teachers". Add: "So is the answer to Question 15."

### [Issue 4] [`design`, `style`] - Severity: Major

- **Findings covered:** the rest of `design-2-4`, and the Goal 2 part of `style-2-3`.
- **Affected Scope:** [Lines 98-105](../../learner-hover-preview.md#L98-L105)
  (Goal 2), "Records and rules", and the Risks table.
- **Discrepancy Description:** the only thing between "on by default" and a public clip
  nobody agreed to is "the server PR is in production before production opens to teachers".
  Nothing enforces it, nothing can detect a breach, and it is written only in this design.
  The two consent limits (people invited to a profile, and an owner installed by recovery)
  have no risk row. Goal 2's heading says "Teachers have agreed", and nothing records
  agreement.
- **Rationale:** a release condition with no home is forgotten by the time it applies.
- **_AI Suggestion:_** PROPOSE FIX. DECLINE the coded detector.
- **_Justification:_** accurate. `docs/runbooks/deploy.md` already has a checklist before the
  first real transaction, and `profiles.applied_at` exists, so one line and one query give
  the condition a home and a check with no code. A detector with its own configured date
  would be a new value, a query and a test for a population the design says is zero
  (Stage 8, `I2.5`). Also edits the plan.
- **_Proposed Edit:_**
  - Location: Goal 2, heading. Replace "**Teachers have agreed to previews, and control their
    own.**" with "**The application pages state the preview term before any teacher applies,
    and teachers control their own preview.**"
  - Location: "Records and rules", the `deploy.md` entry. Add: "`deploy.md`'s checklist before
    the first real transaction gains a line: the hover-preview server PR was deployed before
    any teacher applied, checked with
    `select count(*) from profiles where applied_at < '<time of that deploy>'`, which must
    return 0." Add the same condition to the ADR 011 entry.
  - Location: plan item 21, the `deploy.md` and ADR 011 bullets. The same additions.
  - Location: Risks, a new row: "**Someone who never saw the sentence** | Managers and
    writers who join a profile by invitation never see the application page. An owner
    installed by Support's recovery did not apply. | Not mitigated. The sentence is shown to
    the person who applies for the profile and to nobody else."

### [Issue 5] [`design`, `structural`] - Severity: Major

- **Findings covered:** `design-2-5`, `structural-2-2`.
- **Affected Scope:** Alternatives B, E, I, N, O, Q, S, T, X, Z, AG, AH and AK.
- **Discrepancy Description:** these entries say "Rejected by author" or "in favour of" the
  chosen option and name no trade-off. The standard requires a concrete trade-off.
- **Rationale:** the reader has to guess which of the listed cons decided it. Alternative Q
  matters most: with no scheduler, a failed delete is never retried on its own and a course
  can sit without a clip.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. Each added sentence names a cost that is already in that
  entry's Cons or in the Question it cites. None states a motive the author did not give.
- **_Proposed Edit:_** in each, the mark stays and this is added after it:
  - B: "every teacher would have to make and upload a trailer."
  - E: "a round trip before each clip can start, and a public endpoint that hands out signed
    addresses."
  - I: "a teacher who never opens the setting never gets a clip, and the author wants most
    cards to have one."
  - N: "it needs a new capability, a route and test rows, and leaves nobody at Elevate able
    to take one clip down."
  - O: "a permission that depends on the direction of the change has no precedent in the
    role table; the cover image's rule needs nothing new."
  - Q: "it would be the first scheduled work in the system, with new Terraform applied by
    hand in each environment. What the design gives up without it is in the Risks table: a
    failed delete is retried only at the next refresh of that course, and a course can sit
    without a clip until someone acts."
  - S: "a media row needs a relation in both relation files, a change to the enrolments
    query, and a filter to keep clips out of cover images and avatars."
  - T: "a new table, relations in both relation files and a join in two queries, to hold
    what six columns hold."
  - X: "second 0 can be a title card, and a quarter of the way in is harder for a teacher to
    predict."
  - Z: "comparing has nothing to compare against when clips are on by default, and an
    endpoint would be the first unauthenticated write to the analytics table."
  - AG: "retiring first leaves a course with no clip during every change, and for as long
    as Mux fails."
  - AH: "a list needs one more column, array operations in raw SQL, and one more write for
    each deleted file."
  - AK: "steps alone do not hold if a repeat counts against the limit, and the count alone
    lets a teacher spend ten changes on starts a few seconds apart." Whether the count stays
    is Question 14.
  - AN: prefix "Rejected by author on 2026-11-20:", as the other entries of that day have.

### [Issue 6] [`structural`, `style`] - Severity: Major

- **Findings covered:** `structural-2-1`, `style-2-5`, and the last entry's wording from
  `style-2-15`.
- **Affected Scope:** [Lines 174-324](../../learner-hover-preview.md#L174-L324)
  (Open Questions).
- **Discrepancy Description:** "Answered:" is plain text, not a heading. Its 18 entries run
  13, 10, 8, 9, 1, 2, 3, 4, 5, 12, 6, then two with no number, 7, 11, two more with no
  number, and the brief's Question 9. Five entries can't be cited. Withdrawn answers are
  told as events, and "the reviewers' belief holds" names reviewers the reader has not met.
- **Rationale:** the rest of the document cites this section about 45 times as its index of
  decisions. Each citation means reading down an unordered list.
- **_AI Suggestion:_** PROPOSE FIX. DECLINE per-question anchors.
- **_Justification:_** accurate. The two reviewers pull opposite ways: one asks to number and
  anchor every entry, the other to cut the section down. Stage 8 (`I2.10`) said to cut. This
  edit orders and numbers the entries and trims the told history, and adds no anchors: links
  to "Question n" go on landing on the section.
- **_Proposed Edit:_**
  - Location: the section. Add two H3 headings, "Open" and "Answered". "Open" holds
    Questions 14 and 15.
  - Location: "Answered". Put the entries in numeric order, 1 to 13.
  - Location: the five entries with no number. Number them after the open ones: 16 "A failed
    delete", 17 "The off switch and a stale choice", 18 "The default clip", 19 "The data
    model", 20 "The Mux token type (the brief's Question 9, in part)".
  - Location: Question 7. Replace the entry with one line: "**Question 7 (existing live
    courses):** withdrawn on 2026-11-19. See Question 11."
  - Location: Question 13. Delete "The author first chose to ask Mux, then chose not to
    wait."
  - Location: Question 5. Replace its three sub-bullets with one sentence: "The first answer
    was 320 pixels, chosen on estimates from Mux's demo videos; the real calls gave smaller
    sizes, and the author then chose 480 pixels (Questions 10 and 12)."
  - Location: Question 20. Replace "the reviewers' belief holds. Mux's" with "Mux's".
  - Location: the intro sentence. Add: "Entries 16 to 20 were answered without a number and
    were numbered later."

### [Issue 7] [`style`] - Severity: Major

- **Findings covered:** `style-2-6`.
- **Affected Scope:** document-wide.
- **Discrepancy Description:** the same facts are restated across sections, and copies have
  drifted. Named examples: "production is not deployed, no teacher has applied" (seven
  places); a failed delete is retried at the next refresh (seven places); loosening the
  limit is "changing constants" in one place and "one function" in another; the departures
  from the brief number five in the Overview and two in "Records and rules".
- **Rationale:** repetition lengthens the document, and copies stop agreeing.
- **_AI Suggestion:_** PROPOSE FIX for the copies that disagree. Not fixed: the repetition
  itself.
- **_Justification:_** the critique is accurate and the drift is the real harm. Two of the
  three drifted copies are already gone: "changing constants" was removed on 2026-11-20, and
  the "seven outcome names" was corrected on 2026-11-19. The third is fixed here. Removing
  the repetition is not proposed. Each repeated fact sits in a section a reader enters
  directly: a Goal, a Risks row, an Alternative. Replacing the fact with a pointer makes
  those sections lean on others. This is a judgement, and it leaves the finding open in
  part; the author can ask for the full pass.
- **_Proposed Edit:_**
  - Location: "Records and rules", the entry for the brief. Replace "where the two differ (on
    by default; made at more moments than Support's approval)" with "in the five ways listed
    in the [Overview](#overview)". This is also `structural-2-9` and `style-2-13`.

### [Issue 8] [`design`] - Severity: Nit

- **Findings covered:** `design-2-7`.
- **Affected Scope:** "When the clip is made": the bullet "In the save it comes before the
  audit row" and the table row for `CoursesService.update`.
- **Discrepancy Description:** in the save, the audit row is written after a call to Mux that
  can take 10 seconds. A crash or a failed audit write in that time leaves a change to what
  the public sees with no record. The approvals do it the other way round, for that reason.
- **Rationale:** the `course.preview` audit row is the stated mitigation for "Staff or a
  writer changes a teacher's clip".
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate; `CoursesService.update` writes no audit row today, so this
  order is new. The reviewer's fix, one transaction for the setting and the audit row, needs
  a helper that does not exist (Stage 8, `I2.6`). The smaller fix is the approvals' order:
  row update, audit row, then refresh. The design's reason for the present order describes a
  state it already accepts: with the setting saved as off, the clip is hidden at once and
  the next refresh deletes the file. **Changes the build.** Also edits the plan.
- **_Proposed Edit:_**
  - Location: the bullet. Replace with: "**In the save it also comes after the audit row.**
    The setting and its audit row are written first, so every change to what the public sees
    has a record before the wait for Mux. If the audit write fails, the save answers 500 and
    the refresh does not run: a preview saved as off is hidden at once, because the catalog
    reads the setting, and its file is deleted at the next refresh."
  - Location: the table row. Replace "After the row update and before its audit row" with
    "After the row update and its audit row".
  - Location: plan item 12, "The order is". Replace with the order: the row update, if any
    value changed; then, when any of the three stored values changed, the audit row; then,
    when the request carried any of the three fields, the refresh. Delete the sentence that
    explains the old order.

### [Issue 9] [`design`] - Severity: Nit

- **Findings covered:** `design-2-9`.
- **Affected Scope:** Goal 2 ("deletes the stored file"), "Three details", Future
  Improvements.
- **Discrepancy Description:** in production the bucket is versioned, and its only lifecycle
  rule aborts unfinished uploads. A clip that is turned off is kept as an old version with
  no expiry.
- **Rationale:** "deletes the stored file" is not true in production today.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate; checked in
  `infra/terraform/modules/environment/storage.tf`. The server PR already changes Terraform,
  and the rule is a few lines with no code. The other way out, rewording Goal 2 to say the
  bytes are kept, would leave a teacher's footage in storage for good after they turned it
  off. **Changes the build.** Also edits the plan.
- **_Proposed Edit:_**
  - Location: "Three details", "The first deletions in the codebase". Replace "In production
    the bucket is versioned, so the bytes stay as an old version that nobody can request."
    with "In production the bucket is versioned, so a deleted clip is kept as an old version
    that nobody can request. This design adds a lifecycle rule that removes old versions
    under `public/previews/` one day after the delete."
  - Location: Future Improvements. Delete the entry "Expiring old versions of deleted
    clips".
  - Location: plan item 20. Add the file
    `infra/terraform/modules/environment/storage.tf` (Modify) and the change: a second `rule`
    in `aws_s3_bucket_lifecycle_configuration.uploads`, with `id`
    `"expire-old-preview-versions"`, `status = "Enabled"`, `filter { prefix =
    "public/previews/" }` and `noncurrent_version_expiration { noncurrent_days = 1 }`.

### [Issue 10] [`design`] - Severity: Nit

- **Findings covered:** `design-2-10`.
- **Affected Scope:** "What this does not do", and the Risks row "A delete fails".
- **Discrepancy Description:** after a failed delete the save answers 200, and the file
  stays served at its old address until some later refresh. Only the log shows it.
- **Rationale:** nobody is told, and nothing alerts on the log line.
- **_AI Suggestion:_** PROPOSE FIX, with a query in the runbook. DECLINE an alarm.
- **_Justification:_** accurate. The infrastructure has no metric filter or alarm today, and
  the first one in the system would be out of proportion for a state the next refresh
  repairs (Stage 8, `I2.2`). One query finds the rows. **Changes the build** only by a line
  in a runbook. Also edits the plan.
- **_Proposed Edit:_**
  - Location: "Records and rules", the `infra/README.md` entry. Add: "and the query that
    lists clips hidden with their files still to delete:
    `select id from courses where preview_key is not null and preview_source_media_id is null`."
  - Location: plan item 21, the `infra/README.md` bullet. The same addition.
  - Location: Risks, "A delete fails". Add to the mitigation: "A query in `infra/README.md`
    lists such rows."

### [Issue 11] [`design`] - Severity: Nit

- **Findings covered:** `design-2-6`.
- **Affected Scope:** Question 13, step 7 of "Making the clip", the `limit` state, the Risks
  row "The per-asset limit is reached".
- **Discrepancy Description:** the count locks a video for good on an assumption the real
  calls contradict; there is no reset; the check is not atomic; some real fetches are not
  counted.
- **Rationale:** a lockout the design imposes on itself.
- **_AI Suggestion:_** DECLINE
- **_Justification:_** a Nit, and the author decided on 2026-11-20 to keep the count until
  Mux answers (Question 14). The wording part is already done: the `limit` sentence no
  longer says "the clip shown stays", and the Risks row names every way the count is spent.
- **_Proposed Edit:_**
  - None.

### [Issue 12] [`style`] - Severity: Major

- **Findings covered:** the Goal 4 and Goal 5 parts of `style-2-3`, `style-2-9`,
  `style-2-17`.
- **Affected Scope:** [Lines 92-119](../../learner-hover-preview.md#L92-L119) (Goals
  1, 4 and 5), and the Non-Goal "Server-side caching of the catalog".
- **Discrepancy Description:** Goal 4's heading says "download nothing extra", and its body
  adds the address in every catalog response, called "a few dozen bytes" where the address
  is over 120. Goal 5 says the response "can be cached later without change", a requirement
  for a cache the design says it does not build. Goal 1 says "after a short delay" where
  CUJ 1 says 400 milliseconds, and words the 12 seconds as if clip length varied.
- **Rationale:** verification is measured against the goals, so each heading has to be the
  statement that can be checked.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. The address is `public/previews/`, two UUIDs and `.webp`, 94
  characters before the origin, the file route's path and the field name.
- **_Proposed Edit:_**
  - Location: Goal 1. Replace "after a short delay. The clip is silent. It plays for 12
    seconds, three times through for a 4-second clip, and then the cover image returns."
    with "after 400 milliseconds. The clip is silent. The 4-second clip plays three times,
    12 seconds in all, and then the cover image returns."
  - Location: Goal 4. Replace the heading with "**Phones and touch screens never download a
    clip.**". Replace "pays no data for it" with "downloads nothing for it", and "a few dozen
    bytes per card" with "about 150 bytes per card".
  - Location: Goal 5. Replace "The response stays the same for every visitor, so it can be
    cached later without change." with "The response is the same for every visitor."
  - Location: Non-Goals. Replace "Goal 5 keeps it possible; this design adds no cache." with
    "This design adds no cache."

### [Issue 13] [`structural`] - Severity: Nit

- **Findings covered:** `structural-2-4`.
- **Affected Scope:** "Fixes weighed after the review" (line 1406 on).
- **Discrepancy Description:** every other group of alternatives is by subject; this one is
  by when the alternative arose. Its intro names two review findings, and Alternatives AJ
  and AK match neither. "The review" and "a small workflow" are not defined.
- **Rationale:** the intro reads as covering the whole group and does not.
- **_AI Suggestion:_** PROPOSE FIX for the intro. DECLINE moving the entries.
- **_Justification:_** accurate. Moving nine entries into subject groups would change which
  letters sit where, and about twenty citations use the letters.
- **_Proposed Edit:_**
  - Location: the group's intro. Replace with: "The first review, on 2026-11-19, found that
    turning a preview off could be refused, and that a failed delete could not be retried.
    Fixes for both were drafted, and each was tested against the ways it could fail. The
    limit on animated images was decided the same day (Question 13). These are the options
    not taken."

### [Issue 14] [`structural`, `style`] - Severity: Nit

- **Findings covered:** `structural-2-6`, the wrapping part of `style-2-20`.
- **Affected Scope:** prose lines over 100 columns (today: 262, 539, 691, 1718 and 2234) and
  lines wrapped short (in Goal 1 and in "What this does not do").
- **Discrepancy Description:** the rest of the prose is wrapped at 100 columns.
- **Rationale:** marks of edits that were not reflowed.
- **_AI Suggestion:_** PROPOSE FIX for the wrapping. DECLINE the units part of `style-2-20`.
- **_Justification:_** accurate. Two of the five long lines are in the plan and are reflowed
  with the rest. The mixed units (bytes, KB, MB) are left: each figure is quoted as it was
  measured or estimated.
- **_Proposed Edit:_**
  - Location: the listed lines. Reflow each paragraph to 100 columns. No word changes.

### [Issue 15] [`structural`] - Severity: Nit

- **Findings covered:** `structural-2-7`.
- **Affected Scope:** Additional Resources.
- **Discrepancy Description:** the two Mux guides and the Expo page are code spans, which do
  not render as links. Every other entry is a link.
- **Rationale:** a sibling design links its Expo page.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate.
- **_Proposed Edit:_**
  - Location: the three entries. Make each title a Markdown link to its address, and drop
    the address in brackets.

### [Issue 16] [`structural`] - Severity: Nit

- **Findings covered:** `structural-2-8`.
- **Affected Scope:** [Lines 894-898](../../learner-hover-preview.md#L894-L898) (the
  `CourseView` block).
- **Discrepancy Description:** the comment "the usable live videos, in order" sits on its own
  line after the `changesLeft` comment and reads as describing `changesLeft`. It describes
  `videos`.
- **Rationale:** a reader copies the wrong meaning.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate; confirmed on 2026-11-19.
- **_Proposed Edit:_**
  - Location: the block. Move the comment up to its own line directly above `videos:`.

### [Issue 17] [`style`] - Severity: Nit

- **Findings covered:** `style-2-7`, `style-2-8`, `style-2-10`, `style-2-12`, `style-2-18`.
- **Affected Scope:** lines 395, 433, 749, 786, 971 and the Risks row "The clip does not
  restart".
- **Discrepancy Description:** an unverified behaviour stated as fact; "Checked" used for a
  check not yet made; the 10-second bound stated for the whole request; "one answer that
  fits the goals" where alternatives were weighed; "nothing shows it" where Teach and
  Support do.
- **Rationale:** each claims a little more than is known.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate in each case.
- **_Proposed Edit:_**
  - Location: line 786. Replace "is dropped by the `Link asChild` wrapper around it." with
    "appears to be dropped by the `Link asChild` wrapper around it. That was read from
    source, not run."
  - Location: Risks, "The clip does not restart". Replace "Checked by hand" with "To be
    checked by hand".
  - Location: CUJ 8, line 395. Replace "the approval succeeds after at most 10 more seconds"
    with "the approval succeeds after waiting on Mux for at most 10 seconds".
  - Location: line 749. Replace "Each of the first three places can make its request up to 10
    seconds slower." with "Each of the first three places can wait on Mux for up to 10
    seconds, and then stores the clip."
  - Location: line 433. Replace "have one answer that fits the goals, so they were not put to
    the author one by one." with "were decided while drafting and not put to the author one
    by one. Where another option was weighed, it is under
    [Alternatives Considered](#alternatives-considered)."
  - Location: line 971. Replace "and nothing shows it." with "and no learner card shows it."

### [Issue 18] [`style`] - Severity: Nit

- **Findings covered:** `style-2-11`.
- **Affected Scope:** lines 84-85, 290, 1093, 1102, 1172, 1335, and the Risks row "Clips load
  the API".
- **Discrepancy Description:** predictions stated as facts: "The pilot has a handful of
  teachers" (no teaching profile exists), "where most learners are", "so most cards would
  have none", "few cards would have one", "Second 0 is often a title card", "Filmed footage
  will be larger".
- **Rationale:** no data is behind them, and line 85 itself hedges where line 1102 does not.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. `docs/spec.md` line 77 gives the pilot's planned size:
  "recruit 3-5 pilot teachers".
- **_Proposed Edit:_**
  - Location: line 84. Replace "The pilot has a handful of teachers." with "The pilot is
    planned with three to five teachers (`docs/spec.md`)."
  - Location: line 1102. Replace "where most learners are" with "where most learners are
    likely to be".
  - Location: line 1093. Replace "so most cards would have none" with "so many cards may
    have none".
  - Location: line 1172. Replace "so few cards would have one" with "so many cards may have
    none".
  - Location: line 1335. Replace "Second 0 is often a title card." with "Second 0 can be a
    title card."
  - Location: line 290 and the Risks row. Replace "Filmed footage will be larger" with
    "Filmed footage is expected to be larger" in both.

### [Issue 19] [`style`] - Severity: Nit

- **Findings covered:** `style-2-14`.
- **Affected Scope:** line 361 (CUJ 4), line 527.
- **Discrepancy Description:** "the card" means the learner's course card, Teach's "Hover
  preview" card and Support's "Course page" card. In CUJ 4, "The card shows the new clip" is
  unclear. Line 527 says "the three can't disagree" after naming four parties. The start is
  called by five names.
- **Rationale:** one word, several things.
- **_AI Suggestion:_** PROPOSE FIX for the two unclear places. DECLINE the renaming across
  the document.
- **_Justification:_** accurate. The two named places are fixed. Renaming every "card" and
  every word for the start is a pass over the whole document for a Nit, and a blind
  replacement would be wrong where "the card" is plainly one of the three.
- **_Proposed Edit:_**
  - Location: line 361. Replace "The card shows the new clip." with "The Hover preview card
    shows the new clip."
  - Location: line 527. Replace "so the three can't disagree" with "so they can't disagree".

### [Issue 20] [`style`] - Severity: Nit

- **Findings covered:** `style-2-15`, and the "seventh column" part of `style-2-16`.
- **Affected Scope:** lines 72, 216, 300, 659, 858, 1152, 1384, 1454, and two Risks rows.
- **Discrepancy Description:** subjective or idiomatic wording, listed by line in the critic
  report, and "A seventh column" where the design already adds seven.
- **Rationale:** each can be said exactly.
- **_AI Suggestion:_** PROPOSE FIX for ten. DECLINE one.
- **_Justification:_** accurate. Declined: replacing "conservative estimate". The phrase is
  the author's own name for the decision in Question 13, and the entry says what it assumes.
  The API task's size was checked in `infra/terraform/modules/environment/variables.tf`.
- **_Proposed Edit:_**
  - Line 72: "That is a new rule about who sees what." becomes "That changes ADR 004's rule
    that lesson video is shown only after an enrolment check."
  - Line 216: "about 3 seconds in the middle" becomes "typically about 3 seconds".
  - Lines 300 and 858: "the rule is the server's" becomes "the rule is enforced on the
    server".
  - Line 659: "One rule holds the steps together:" becomes "One rule applies to every step:".
  - Risks, "A course sits without a clip": "Running the backfill from time to time repairs
    it; nothing reminds anyone to." becomes "Running the backfill repairs it. No cadence is
    set and nothing reminds anyone to."
  - Risks, "Clips load the API": "the single small API task" becomes "the one API task (256
    CPU units and 512 MiB by default)".
  - Line 1152: "far more moving parts than one stored file, for a 4-second silent clip."
    becomes "a second asset to upload, wait for and clean up for each course, where this
    design stores one file."
  - Line 1384: "simpler to reason about and to test" becomes "easier to test".
  - Line 1454: "A seventh column," becomes "A seventh column on `courses`,".

### [Issue 21] [`style`] - Severity: Nit

- **Findings covered:** `style-2-19`.
- **Affected Scope:** [Lines 36-38](../../learner-hover-preview.md#L36-L38)
  (Overview).
- **Discrepancy Description:** the Overview accounts for the agreement sentences and the
  Teach control as the design's new text. It leaves out the paragraph added to the approval
  email, and the feature part gives neither its wording nor its language.
- **Rationale:** the inventory of new text is incomplete.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. The wording is in plan item 13. Teacher emails are English
  (`AGENTS.md`).
- **_Proposed Edit:_**
  - Location: Overview, after "because the builder is an English page today." Add: "The
    approval email to a teacher gains one paragraph, in English like the rest of that email;
    its wording is in item 13 of the plan."

## Summary of the sort

| Category                     | Issues                                   | Notes                                  |
| ---------------------------- | ---------------------------------------- | -------------------------------------- |
| PROPOSE FIX, already applied | 1                                        | Settled by the decisions of 2026-11-20 |
| PROPOSE FIX                  | 2, 4, 5, 6, 7 (part), 8, 9, 10, 12 to 21 | 18 issues                              |
| ESCALATE                     | 3                                        | Needs a fact only the author has       |
| DECLINE                      | 11                                       | Waits on Question 14                   |
| CONTEST                      | none                                     |                                        |

- **Changes the build:** issue 8 (the save writes its audit row before the refresh), issue 9
  (a lifecycle rule in Terraform), issue 10 (one query in a runbook).
- **Also edits the plan:** issues 4, 8, 9, 10 and 14.
- **Parts declined inside a fixed issue:** more Mux calls before code, and a card state for
  an oversized clip (issue 2); a coded consent detector (issue 4); per-question anchors
  (issue 6); removing repetition across the document (issue 7); an alarm (issue 10); moving
  alternatives between groups (issue 13); mixed units (issue 14); renaming "card" and "start"
  throughout (issue 19); replacing "conservative estimate" (issue 20).
