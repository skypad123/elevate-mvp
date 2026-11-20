# Goldfish Annotated Review Report

**Status: resolved** on 2026-11-19. The author chose "auto accept".

- Applied: every proposed fix in issues 1 to 23, as 48 text replacements in
  `docs/designs/learner-hover-preview.md`. The plan now starts at line 1459 and the file has
  2,403 lines, so the line numbers below are those of the version that was reviewed.
- Not applied: the declined part of issue 23 (the wording of ADR 011, `mux.md` and
  `infra/README.md`).
- Two fixes were applied with different wording from the text below, because the text below
  was wrong in one case each:
  - **Issue 1, a saved start that is not an option.** The proposal used
    `course.preview.resolved.startSeconds`, which is empty while the preview is off. The
    applied text says the select starts on the last option that is not above the saved
    start.
  - **Issue 4, reaching `limit` by hand.** The proposal did not say which video's count to
    set. The applied text says: on a course with two test videos whose clip is from the
    first, set the second video's `preview_fetches` to 10, then choose the second video.
- Not re-audited: no reviewer has read the plan since these edits.

**Target:** `docs/designs/learner-hover-preview.md` (lines 1458 to 2309, the Detailed
Implementation Plan)

**Stage:** 9 (Implementation Readiness Test), round 2. Findings come from
`implementation_readiness_report_round2.md`.

## How to read this report

- The 38 findings of Stage 9 are grouped into 23 issues, because reviewers often raised the
  same point. Each issue lists every finding it covers, and takes the highest severity any
  reviewer gave.
- Result of the sort: 22 issues are **PROPOSE FIX**. One (issue 23) is **PROPOSE FIX** for
  part and **DECLINE** for part. None is contested and none is escalated. Before sorting, the
  claims behind issues 1 to 6, 8, 9, 13, 14 and 21 were checked against the code or the
  design, and each holds.
- Every proposed edit keeps the design as it is decided today: the per-video count stays, and
  the video and start picker stays. Reviewers in Stages 5 and 8 recommended removing the
  count (`Z3`, `I2.3`) and the picker (`Z2`). No decision has been made on that. Issues
  marked **"Moot if the count goes"** or **"Moot if the picker goes"** patch a part those
  reviewers would delete.
- Four edits reach outside the target range, into the feature part of the design, because the
  same rule is stated there. Changing only the plan would leave the two parts in
  disagreement. Each is marked **"Also edits the feature part"**.
- Stage 5 to 8 findings are not resolved here. They stay open in their own reports.

## Prioritized Findings & AI Suggestions

### [Issue 1] [`readiness`, `plan-style`, `codebase`] - Severity: Major

- **Findings covered:** `readiness-2-1`, `plan-style-2-4`, `codebase-2-12`. Also raised in
  Stage 6 as `R2`.
- **Affected Scope:**
  [Lines 2009-2058](../../learner-hover-preview.md#L2009-L2058) (item 17, Teach
  control)
- **Discrepancy Description:** the start select lists "the selected video's `starts`" and the
  changes-left line uses "the selected video's `changesLeft`". With the video select on
  "Default" no video is selected, and that is the card's first state for every course. The
  plan also leaves open: an empty `videos` list; a saved start that is not among the options;
  whether the tick box and selects are disabled when `locked`; and the literal sentence for
  `pending`.
- **Rationale:** Teach has no component tests, so nothing catches a wrong guess.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** the critique is accurate. The default video is always `videos[0]`:
  `videos` holds the usable live videos in order, and the rule's default is the first usable
  video. `resolved` can't be used, because it is null while the preview is off. Moot if the
  picker goes. Stage 8 (`I2.7`) offers a different fix that changes the rule: allow a chosen
  start only together with a chosen video. This edit does not take it, because it changes
  what the rule accepts, which is the author's call.
- **_Proposed Edit:_**
  - Location: item 17, "The start field" bullet (line 2027). Add after its last sentence:
    "The video that supplies the starts, and the changes-left line under them, is the one
    selected, or `course.preview.videos[0]` while the select is on 'Default'. That entry is
    the course's default video, because `videos` holds the usable videos in the rule's
    order. When `videos` is empty, both selects hold only 'Default' and the changes-left line
    is left out."
  - Location: same bullet. Add: "A saved start can sit above the video's last allowed start,
    because a hand-made request can store one. The select then starts on
    `course.preview.resolved.startSeconds`, the value the rule lowered it to, and that does
    not count as a change."
  - Location: item 17, "The tick box" bullet (line 2015). Replace "When it is unticked, the
    select and the start field are disabled." with "When it is unticked, the two selects are
    disabled. When `locked` is true the tick box, both selects and the button are disabled,
    as the other cards in `details-form.tsx` set `disabled={locked}` on each input."
  - Location: item 17, after "The resolved line" bullet. Add a bullet: "**The state's
    sentence.** One line, taken word for word from the third column of the table under
    [The control in Teach](#the-control-in-teach). For `pending` the sentence is 'The clip is
    not up to date.', and the button reads 'Make clip'."

### [Issue 2] [`readiness`, `codebase`] - Severity: Major

- **Findings covered:** `readiness-2-2`, `codebase-2-1`.
- **Affected Scope:**
  [Lines 1585-1593](../../learner-hover-preview.md#L1585-L1593) (item 4),
  [1720-1723](../../learner-hover-preview.md#L1720-L1723) (item 10),
  [1834-1839](../../learner-hover-preview.md#L1834-L1839) (item 14),
  [2032-2034](../../learner-hover-preview.md#L2032-L2034) (item 17)
- **Discrepancy Description:** `changesLeft` is the allowance less `previewFetches`, with no
  floor. `check` adds to the count without testing the allowance, and two refreshes started
  together both fetch. So the count can pass the allowance, and Teach would print "This video
  has -1 clip changes left."
- **Rationale:** the builder must decide how `limit` is compared, whether the view clamps,
  and whether `check` refuses at the allowance.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. The plan's own "Two refreshes" test produces two fetches for
  one stored clip. Moot if the count goes. Also edits the feature part.
- **_Proposed Edit:_**
  - Location: item 4, a new bullet after `allowedStarts` (line 1580):
    "`previewChangesLeft(durationSeconds, previewFetches): number`: the allowance less
    `previewFetches`, and never less than 0. It is the only place the subtraction is done.
    The count can pass the allowance, because `check` counts without testing it and two
    refreshes started together can both fetch."
  - Location: item 4, `previewState` (lines 1588 to 1593). Replace "`limit` (the resolved
    video has no changes left)" with "`limit` (`changesLeft` is 0)", and replace "where
    `changesLeft` is the resolved video's allowance less its `previewFetches`, and 0 when
    nothing is resolved" with "where `changesLeft` is `previewChangesLeft` for the resolved
    video, and 0 when nothing is resolved".
  - Location: item 10, the allowance bullet (line 1720). Replace "and compares it with
    `previewAllowance`" with "and stops with `limit` when `previewChangesLeft` is 0".
  - Location: item 12 (line 1767). Replace "and its `changesLeft`" with "and its
    `changesLeft` from `previewChangesLeft`".
  - Location: item 14, `check` (line 1838). Add: "It does not test the allowance first: it is
    an operator's tool, and `previewChangesLeft` already keeps an over-count from showing as
    a negative number."
  - Location: item 5, a new case: "`previewChangesLeft` gives 10 for a 60-second video with
    no fetches, 0 at 10 fetches and 0 at 12."
  - Location: feature part, the `CourseView` block (line 829). Replace the comment
    "allowance less clips fetched" with "allowance less clips fetched, never below 0".

### [Issue 3] [`codebase`, `readiness`] - Severity: Major

- **Findings covered:** `codebase-2-3`, `readiness-2-7`.
- **Affected Scope:**
  [Lines 1786-1797](../../learner-hover-preview.md#L1786-L1797) (item 12),
  [1715-1723](../../learner-hover-preview.md#L1715-L1723) (item 10),
  [1838-1839](../../learner-hover-preview.md#L1838-L1839) (item 14)
- **Discrepancy Description:** `CoursesService.update` writes every field the request
  defines, equal or not, and `updatedAt` is set on every update. "Make clip" sends stored
  values back. Built the way the existing code is built, it moves `updated_at`. That remounts
  the Details form, which is keyed on `updatedAt`, and drops unsaved title and description
  edits. It also reorders the course lists. The plan does not say whether the count's own
  update keeps `updated_at`.
- **Rationale:** the design accepts the remount for "Save preview" only, and elsewhere avoids
  moving `updated_at` for system writes.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate; checked in `courses.service.ts` (lines 428 to 454),
  `packages/db/src/schema/columns.ts` and `builder.tsx` line 164. "Make clip" changes no
  setting, so it has no reason to write the row. Also edits the feature part.
- **_Proposed Edit:_**
  - Location: item 12, a new bullet before "The order is" (line 1786): "**Only a changed
    value is written.** A preview field goes into the row update only when its value differs
    from the stored one. A request whose preview fields all equal the stored values, and that
    carries no other field, writes nothing to the row. So 'Make clip' does not move
    `updated_at`: the Details form is not remounted, unsaved title and description edits are
    kept, and the course lists keep their order. The refresh still runs."
  - Location: item 12, "The order is" (line 1786). Replace "the row update; then" with "the
    row update, if any value changed; then".
  - Location: item 10 (line 1715). Replace "Every `UPDATE` in a refresh sets `updatedAt` to
    the column itself" with "Every `UPDATE` in a refresh, on `courses` and on `media_assets`,
    sets `updatedAt` to the column itself". Add to item 14's `check`: "Its count update keeps
    `updatedAt` the same way."
  - Location: item 16, "A teacher's choice" (line 1904). Replace "Sending the same values
    again calls the driver no more times and writes no audit row." with "Sending the same
    values again calls the driver no more times, writes no audit row and leaves the course's
    `updatedAt` as it was."
  - Location: feature part, "A known cost" (line 814). Add: "'Make clip' changes no setting,
    so it writes nothing to the course row and does not remount the form."

### [Issue 4] [`codebase`, `plan-style`] - Severity: Major

- **Findings covered:** `codebase-2-4`, `plan-style-2-3`. Also raised in Stage 6 as `R1`.
- **Affected Scope:**
  [Lines 2288-2297](../../learner-hover-preview.md#L2288-L2297) (Verification Plan),
  [2151-2157](../../learner-hover-preview.md#L2151-L2157) (item 22)
- **Discrepancy Description:** the walkthrough uses Mux test assets of at most 10 seconds and
  asks, for CUJ 4, for "one start inside the video, and one above it to see it lowered". A
  10-second video has one allowed start, 0, and the start control is a select with no free
  typing. Item 22 also asks for "the card in each of its seven states" without saying how
  `limit` or `paused` is reached by hand.
- **Rationale:** the step cannot be performed as written.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. The step was written before starts moved to 10-second steps
  and was not updated. Moot in part if the picker goes.
- **_Proposed Edit:_**
  - Location: Verification Plan, the CUJ 4 line (line 2291). Replace with: "CUJ 4: a
    10-second test asset has one allowed start, 0:00, so the walkthrough changes the video,
    not the start. On a course with two test videos, choose the second and confirm that the
    clip and the resolved line change. A start above the default, and the lowering of a start
    past the video's end, are covered by item 5 and by 'Starts are in steps' in item 16;"
  - Location: item 22, the first bullet (line 2152). Replace "the card in each of its seven
    states;" with: "the card in each of its seven states. Two need a set-up step: for
    `paused`, restart the local API with `COURSE_PREVIEWS=false`; for `limit`, set the
    video's `preview_fetches` to its allowance (10 for a test asset) with one SQL update,
    then change the video back and forth so a new clip is wanted;"
  - Location: item 22, "Proposed Changes" (line 2151). After "Mux test credentials" add:
    "(set up as sections 1 and 2 of `docs/runbooks/mux.md` describe; Mux deletes test assets
    after 24 hours, so the videos are uploaded the same day)". This also answers `R4` from
    Stage 6 and a point in `I2.11` from Stage 8.

### [Issue 5] [`codebase`, `readiness`] - Severity: Major

- **Findings covered:** `codebase-2-2`, `readiness-2-9` (first part).
- **Affected Scope:**
  [Lines 1929-1932](../../learner-hover-preview.md#L1929-L1932) (item 16)
- **Discrepancy Description:** the test "With the mailer made to throw" has no mechanism.
  `FakeMailer` only collects messages, and item 15 adds failure switches for storage and
  video but none for the mailer.
- **Rationale:** the builder must choose between a spy in the test and a new switch on
  `FakeMailer`, which is a file outside the plan's list.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate; `FakeMailer` in `apps/api/src/providers/mailer/types.ts` has
  no way to fail. A spy needs no file change, and `vi.spyOn` is already used in
  `apps/api/test/storage-s3.test.ts`. `createTestApp` returns `mailer`.
- **_Proposed Edit:_**
  - Location: item 16, "The placement in an approval" (line 1929). Replace "With the mailer
    made to throw," with "With the mailer made to fail for one call, by
    `vi.spyOn(t.mailer, 'send').mockRejectedValueOnce(new Error('mail down'))` in the test
    (`FakeMailer` itself does not change),".

### [Issue 6] [`plan-style`, `readiness`, `codebase`] - Severity: Major

- **Findings covered:** `plan-style-2-1`, `readiness-2-3`, `codebase-2-5`. Also `R5` and
  `Z4`.
- **Affected Scope:** [Line 1705](../../learner-hover-preview.md#L1705) (item 10)
- **Discrepancy Description:** "the union of the seven outcome names". The next line, item 14
  and the outcome table all say eight.
- **Rationale:** seven is the number of states, so a reader can leave `limit` out of the
  union. `backfill` returns a record keyed by it.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. Five reviewers found it.
- **_Proposed Edit:_**
  - Location: line 1705. Replace "the union of the seven outcome names" with "the union of
    the eight outcome names (`made`, `unchanged`, `cleared`, `none`, `not_live`, `paused`,
    `limit`, `failed`)".

### [Issue 7] [`plan-style`] - Severity: Major

- **Findings covered:** `plan-style-2-2`, `plan-style-2-5`. The same point about the feature
  part is `design-2-3`, `style-2-2`, `style-2-4`, `structural-2-3`, `R11` and `I2.4`.
- **Affected Scope:**
  [Lines 1491-1514](../../learner-hover-preview.md#L1491-L1514) (item 1),
  [2287](../../learner-hover-preview.md#L2287) and
  [2298-2300](../../learner-hover-preview.md#L2298-L2300) (Verification Plan)
- **Discrepancy Description:** item 1's Status says "Checks 1 to 3 passed, so the gate is
  open". Its own text asks for "one signed video of real lesson footage". The calls used one
  60-second flat-coloured animation, almost all at 320 pixels wide, with one clip at the
  shipped 480 pixels. The item is also written in the future tense for work its Status says
  is done.
- **Rationale:** the Status states a pass without limits, and the open point sits where
  nobody can act on it.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. The design itself says "Filmed footage will be larger, by an
  amount one video can't show." The edit states what ran and moves the unmeasured part to the
  staging step, where filmed videos exist. It asks for no new calls before code. That respects
  the author's earlier decision not to probe Mux further now. The staging measurement is a
  new step; the author may reject that half.
- **_Proposed Edit:_**
  - Location: item 1, "Status" and "Proposed Changes" (lines 1497 to 1514). Replace both
    with:
    - "**Status**: done on 2026-11-19, with a throwaway script kept outside the repository.
      The results are under Question 10."
    - "**What ran**: 59 requests for clips of one video in a Mux development environment: a
      60-second flat-coloured animation with signed playback, not a test asset and not filmed
      footage. 58 were at 320 pixels wide or another size, and one was at the shipped shape,
      480 pixels wide (242,552 bytes, 4.4 seconds)."
    - "**What it showed**: checks 1 to 3 passed on that video. Mux returns an animated WebP
      for a token with audience `g`, the clip is 4 seconds, and a start past the end is
      refused with a JSON body."
    - "**What it did not show**: the size and the time for filmed footage at 480 pixels,
      which the 3 MB cap and the 10-second timeout depend on; and checks 4 to 6, because the
      limit was never reached. The author chose to build to a conservative estimate of the
      limit (Question 13), so no item waits on Mux. Filmed footage is measured in staging
      (Verification Plan)."
    - "The repeatable form of the first three checks is the `previews check` command of item
      14."
  - Location: Verification Plan, line 2287. Replace "the real Mux calls of item 1, before any
    code is written;" with "the real Mux calls of item 1, made on 2026-11-19;".
  - Location: Verification Plan, the staging bullet (lines 2298 to 2300). Add: "Then
    `previews check` on at least two filmed videos, one of a person talking and one screen
    recording. Their sizes and times are written under Question 10. If either clip is over
    half the 3 MB cap, or took over half the 10-second timeout, the two constants are
    revisited before the learner PR deploys."

### [Issue 8] [`readiness`, `codebase`, `plan-style`] - Severity: Nit

- **Findings covered:** `readiness-2-4`, `codebase-2-9` (first part), `plan-style-2-9` (first
  part).
- **Affected Scope:** [Line 1787](../../learner-hover-preview.md#L1787) (item 12),
  [1809](../../learner-hover-preview.md#L1809) and
  [1815](../../learner-hover-preview.md#L1815) (item 13),
  [1704](../../learner-hover-preview.md#L1704) (item 10)
- **Discrepancy Description:** `await CoursePreviewService.refresh(courseId)` is written as a
  static call for a class built from `Deps`, and no item says how the three callers get an
  instance.
- **Rationale:** the codebase pattern is a private field set in the constructor;
  `ChangeSetsService` has an empty constructor body today.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate; worth fixing because three files are affected.
- **_Proposed Edit:_**
  - Location: item 10, after line 1704. Add: "`CoursesService`, `ReviewService` and
    `ChangeSetsService` each build one in their constructor
    (`this.previews = new CoursePreviewService(deps)`), as `CoursesService` builds
    `MediaService` today. `ChangeSetsService`'s constructor gains a body for it."
  - Location: line 1787. Replace `await CoursePreviewService.refresh(courseId)` with
    `await this.previews.refresh(courseId)`.
  - Location: lines 1809 and 1815. Replace "awaits `refresh(courseId)`" with "awaits
    `this.previews.refresh(courseId)`" in both.

### [Issue 9] [`readiness`, `codebase`, `plan-style`] - Severity: Nit

- **Findings covered:** `readiness-2-5`, `codebase-2-9` (second part), `plan-style-2-9`
  (second part). Also `Z9`.
- **Affected Scope:**
  [Lines 1729-1731](../../learner-hover-preview.md#L1729-L1731) (item 10),
  [1747](../../learner-hover-preview.md#L1747) (item 11),
  [1768](../../learner-hover-preview.md#L1768) (item 12)
- **Discrepancy Description:** item 10 defines `clipUrl(key)`; item 11 calls
  `storage.getUrl` directly; item 12 does not say which it uses. `getUrl` returns a promise
  and takes a non-null string, so line 1747 needs an `await` and a null guard.
- **Rationale:** the method may have no caller.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate; `getUrl(key: string, ttlSeconds?): Promise<string>` in
  `apps/api/src/providers/storage/types.ts`. Dropping the method is the smaller change: both
  callers test `previewIsShown` first, which already means the key is set.
- **_Proposed Edit:_**
  - Location: item 10, lines 1729 to 1731. Delete the `clipUrl(key)` bullet.
  - Location: item 11, line 1747. Replace with: "The address is
    `await this.deps.storage.getUrl(course.previewKey)`, asked for only when
    `previewIsShown` is true, so the key is never empty there."
  - Location: item 12, line 1768. Replace "sets `clipUrl` to the stored clip's address only
    when `previewIsShown` is true" with "sets `clipUrl` to
    `await this.deps.storage.getUrl(course.previewKey)` only when `previewIsShown` is true,
    and to `null` otherwise".

### [Issue 10] [`readiness`, `codebase`] - Severity: Nit

- **Findings covered:** `readiness-2-6`, `codebase-2-6`.
- **Affected Scope:**
  [Lines 1732-1736](../../learner-hover-preview.md#L1732-L1736) and
  [1706-1709](../../learner-hover-preview.md#L1706-L1709) (item 10)
- **Discrepancy Description:** `PreviewVideo.mediaId` is a required string, but a video item
  can have no file. The plan does not say `videosOf` skips such items. `refresh` for a course
  ID that does not exist has no named outcome.
- **Rationale:** `artefacts.mediaAssetId` is nullable, and item 16 has a test with such an
  item.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate.
- **_Proposed Edit:_**
  - Location: item 10, `videosOf` (line 1732). Add: "It leaves out an item whose `media` is
    null: a video item with no file has no media ID to name."
  - Location: item 10, `refresh` (line 1706). Add: "A course ID that matches no row returns
    `not_live`."

### [Issue 11] [`readiness`, `codebase`] - Severity: Nit

- **Findings covered:** `readiness-2-8`, `codebase-2-10`.
- **Affected Scope:**
  [Lines 1840-1846](../../learner-hover-preview.md#L1840-L1846) (item 14)
- **Discrepancy Description:** only "an unknown command exits with status 1" is given. Not
  stated: `check` with no media ID or one that is not found; a `--start` that is not a
  number; the exit status when `check` returns `ok: false` or `backfill` counts failures;
  whether `deps.close()` runs on the error path.
- **Rationale:** no test covers the entry file's argument parsing.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. A person runs these as one-off tasks and reads the output,
  so the exit status only needs to separate "ran" from "did not run".
- **_Proposed Edit:_**
  - Location: item 14, after "An unknown command exits with status 1." (line 1844). Add: "So
    does `check` with no media ID, or with a `--start` that is not a whole number of 0 or
    more; each prints one usage line to standard error. A media ID that matches no row gives
    `ok: false`, like a row that is not a ready Mux video. A command that ran exits with
    status 0 whatever it reports: `ok: false` and a count of `failed` are in the JSON for the
    person to read. An error that is thrown is printed to standard error and the exit status
    is 1. `deps.close()` is called in a `finally`, so it runs either way. The entry file has
    no test of its own; the walkthrough and the staging step in the Verification Plan run all
    three commands."

### [Issue 12] [`readiness`, `codebase`] - Severity: Nit

- **Findings covered:** `readiness-2-9` (second part), `codebase-2-13`.
- **Affected Scope:**
  [Lines 1877-1880](../../learner-hover-preview.md#L1877-L1880) (item 15)
- **Discrepancy Description:** three test set-ups need rows no helper provides: an image of
  this profile; a video item with no file; and a course video whose `previewFetches` is at
  its allowance while a clip is stored.
- **Rationale:** `createVideoMedia`'s `previewFetches` option applies only to a media row with
  no item.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. One sentence saying how each row is made is enough; three
  new helpers would be more than the tests need. The third row is moot if the count goes.
- **_Proposed Edit:_**
  - Location: item 15, a new bullet at the end (after line 1880): "Three rows have no helper
    and are written through `t.db` in the test that needs them: an image `media_assets` row
    of the profile (`kind: 'image'`, `provider: 'local'`, `status: 'ready'`), for the
    `wrong_kind` case and for `check` on an image; an `artefacts` row of type `video` with no
    `mediaAssetId`; and, for 'The allowance', an update that sets the fixture video's
    `preview_fetches` to 10 after its first clip is made."

### [Issue 13] [`readiness`, `codebase`] - Severity: Nit

- **Findings covered:** `readiness-2-10`, `codebase-2-11`.
- **Affected Scope:**
  [Lines 2070-2075](../../learner-hover-preview.md#L2070-L2075) (item 18)
- **Discrepancy Description:** the clip is "beside" the line with "the cover image's
  classes". Those classes make a full-width block, so two cannot sit side by side without a
  wrapper the plan does not describe. The line's own classes, and its place when the course
  has no cover image, are not given.
- **Rationale:** the builder has to invent the layout.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate; the cover image in `review-course.tsx` has
  `mb-4 aspect-[4/3] w-full max-w-md rounded-card object-cover`. Stacking needs no wrapper.
- **_Proposed Edit:_**
  - Location: item 18, lines 2070 to 2075. Replace "in the "Course page" card, under the
    cover image, one line" with "in the "Course page" card, straight after the cover image,
    or first in the card's body when the course has none, one line in a
    `<p className="mb-2 text-body-lg text-ink-secondary">`". Replace the last sentence with:
    "When `clipUrl` is set, the clip is an `<img>` under that line, not beside the cover,
    with `alt=""` and the cover image's classes
    (`mb-4 aspect-[4/3] w-full max-w-md rounded-card object-cover`)."

### [Issue 14] [`readiness`] - Severity: Nit

- **Findings covered:** `readiness-2-11`.
- **Affected Scope:**
  [Lines 2167-2175](../../learner-hover-preview.md#L2167-L2175) (item 23)
- **Discrepancy Description:** on the web bundle, `./CourseCardCover` imported from inside
  `CourseCardCover.web.tsx` resolves to the web file itself. So the props type must be
  re-exported as a type only, and the base component cannot be imported at run time. "The
  same cover" therefore means repeated markup, which the plan does not say.
- **Rationale:** a builder who imports the base component gets a file that imports itself.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. A type-only export is removed before the bundler resolves
  the path, so it is safe.
- **_Proposed Edit:_**
  - Location: item 23, lines 2169 to 2171. Replace "The props type is declared in the base
    file and re-exported by the web file:" with "The props type is declared in the base file.
    The web file re-exports it with
    `export type { CourseCardCoverProps } from './CourseCardCover'`. That line is a type-only
    export and is removed before the bundler resolves the path, which on web would point back
    at the web file. The type is:".
  - Location: item 23, "Web file" (line 2174). Replace "the same cover, plus the behaviour"
    with "the same 4:3 `View` and cover `Image`, written out again, because the web file
    can't import the base component for the reason above; plus the behaviour".

### [Issue 15] [`codebase`, `plan-style`] - Severity: Nit

- **Findings covered:** `codebase-2-8`, `plan-style-2-9` (third and fourth parts).
- **Affected Scope:**
  [Lines 1660-1666](../../learner-hover-preview.md#L1660-L1666) (item 7)
- **Discrepancy Description:** "The request uses the global `fetch`" comes before a
  constructor that injects `fetchImpl`. The clause "so the driver can be tested without a
  network" is attached to `config`, and belongs to `fetchImpl`.
- **Rationale:** a reader has to infer which one the request goes through.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate.
- **_Proposed Edit:_**
  - Location: item 7, lines 1661 to 1666. Replace from "The request uses the global `fetch`"
    to "be tested without a network." with: "The constructor becomes
    `constructor(private readonly config: MuxConfig, private readonly fetchImpl: typeof fetch = fetch)`.
    `config` stays the property the existing methods read. The request goes through
    `this.fetchImpl`, which is the global `fetch` unless a test passes another, so the driver
    can be tested without a network. It is sent with
    `AbortSignal.timeout(COURSE_PREVIEW.fetchTimeoutMs)`; the one signal covers the wait for
    the response and the reading of its body. The size is checked from `Content-Length` when
    present and again on the bytes read, against `COURSE_PREVIEW.maxBytes`. The content type
    passes when the `Content-Type` header, in lower case and cut at the first `;`, is
    `image/webp`."
  - This edit also carries the constants of issue 23.

### [Issue 16] [`plan-style`] - Severity: Nit

- **Findings covered:** `plan-style-2-6`.
- **Affected Scope:**
  [Lines 1853-1854](../../learner-hover-preview.md#L1853-L1854) (item 14)
- **Discrepancy Description:** "three commands" names the three entry files here and the
  three sub-commands (`backfill`, `count`, `check`) elsewhere.
- **Rationale:** one word, two sets.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate, and the sentence goes into the Dockerfile word for word.
- **_Proposed Edit:_**
  - Location: line 1853. Replace "It also carries three commands a person runs as one-off
    tasks:" with "It also carries three entry files a person runs as one-off tasks:".

### [Issue 17] [`plan-style`] - Severity: Nit

- **Findings covered:** `plan-style-2-7`.
- **Affected Scope:**
  [Lines 1460-1470](../../learner-hover-preview.md#L1460-L1470)
- **Discrepancy Description:** "Item 1 is a gate" is followed by a numbered list whose entry
  1 is the server PR.
- **Rationale:** "1" has two meanings ten lines apart.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate and a one-line change.
- **_Proposed Edit:_**
  - Location: lines 1467 to 1470. Change the numbered list to a bulleted list, keeping the
    two entries' text.

### [Issue 18] [`plan-style`] - Severity: Nit

- **Findings covered:** `plan-style-2-8`.
- **Affected Scope:** [Line 1609](../../learner-hover-preview.md#L1609) (item 5),
  [1921-1924](../../learner-hover-preview.md#L1921-L1924) and
  [1988](../../learner-hover-preview.md#L1988) (item 16)
- **Discrepancy Description:** "The same set-up as the first of these" sits in a list of
  about 35 cases and does not name its case. "The same with an empty choice" leaves out what
  is the same. "Count returns the number of live courses and the number with a clip" gives no
  fixture and no expected values. Line 1609 promises a case for each branch of two functions,
  and the list covers six.
- **Rationale:** each makes the reader work out what the plan could state.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate.
- **_Proposed Edit:_**
  - Location: line 1609. Replace "one case for each branch of `resolvePreview` and
    `previewState`:" with "one case for each branch of `resolvePreview` and `previewState`,
    and the listed cases for the module's other functions:".
  - Location: lines 1921 to 1922. Replace "The same with an empty choice: nothing but the
    switch changes." with "A `PATCH` with `previewEnabled: false` and an empty
    `previewMediaId` does the same: nothing but the switch changes."
  - Location: line 1923. Replace "The same set-up as the first of these." with "The same
    set-up as 'Off with a stale chosen video'."
  - Location: line 1988. Replace with: "**Count.** With the four courses of the Backfill
    case, after its first run, `count` returns `{ live: 3, withClip: 3 }`."

### [Issue 19] [`plan-style`] - Severity: Nit

- **Findings covered:** `plan-style-2-10`.
- **Affected Scope:**
  [Lines 1598-1599](../../learner-hover-preview.md#L1598-L1599) (item 4)
- **Discrepancy Description:** "the preview is on" (the `enabled` field) and "`previewsOn` is
  true" (the configuration value) sit in one sentence.
- **Rationale:** near-identical names for two different things.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate.
- **_Proposed Edit:_**
  - Location: line 1598. Replace "It is true only when the preview is on, a key is stored"
    with "It is true only when `enabled` is true, a key is stored".

### [Issue 20] [`plan-style`] - Severity: Nit

- **Findings covered:** `plan-style-2-11`.
- **Affected Scope:**
  [Lines 1763-1770](../../learner-hover-preview.md#L1763-L1770) (item 12),
  [2181](../../learner-hover-preview.md#L2181) (item 23),
  [2275-2276](../../learner-hover-preview.md#L2275-L2276) (Verification Plan)
- **Discrepancy Description:** lines 1765 to 1770 are one six-line sentence with five
  actions. "This service may read those tables" does not name the tables or say who allows
  it. "used instead on purpose" and "Neither should change" are vague.
- **Rationale:** wordiness and unclear modals.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate.
- **_Proposed Edit:_**
  - Location: line 1763. Replace "This service may read those tables." with "The schema guard
    test allows `CoursesService` to read `lessons` and `artefacts`."
  - Location: lines 1765 to 1770. Replace the sentence with four: "It calls `videosOf`,
    `resolvePreview` and `previewState`. It fills `videos` with the usable videos and their
    lesson and item titles, taken from the rows it holds. Each video gets its `starts` from
    `allowedStarts` and its `changesLeft`. A media ID that is on two items is listed once, at
    its first place." The `clipUrl` clause moves to its own sentence, as issue 9 words it,
    ending "so the image Teach and Support draw is what a visitor can see."
  - Location: line 2181. Replace "This hook is used instead on purpose, because" with "This
    hook is used instead, because".
  - Location: lines 2275 to 2276. Replace "Neither should change, because no package is
    added." with "Both give the result they give today, because no package is added."

### [Issue 21] [`plan-style`] - Severity: Nit

- **Findings covered:** `plan-style-2-12`.
- **Affected Scope:**
  [Lines 1845-1846](../../learner-hover-preview.md#L1845-L1846) (item 14)
- **Discrepancy Description:** "`createDeps` may log a warning about Stripe" hedges a
  condition that is known.
- **Rationale:** the condition is `STRIPE_SECRET_KEY` not being set.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate; `apps/api/src/deps.ts` logs it when the payments driver is
  unconfigured.
- **_Proposed Edit:_**
  - Location: line 1845. Replace "`createDeps` may log a warning about Stripe before that
    line;" with "`createDeps` logs a warning before that line when `STRIPE_SECRET_KEY` is not
    set;".

### [Issue 22] [`plan-style`] - Severity: Nit

- **Findings covered:** `plan-style-2-13`.
- **Affected Scope:**
  [Lines 2032-2034](../../learner-hover-preview.md#L2032-L2034) (item 17)
- **Discrepancy Description:** the sentence "This video has 7 clip changes left." gives "1
  clip changes left" at one.
- **Rationale:** text a teacher reads.
- **_AI Suggestion:_** PROPOSE FIX
- **_Justification:_** accurate. Moot if the count goes.
- **_Proposed Edit:_**
  - Location: line 2033. After "'This video has 7 clip changes left.'" add "At 1 it reads
    'This video has 1 clip change left.'"

### [Issue 23] [`readiness`, `codebase`] - Severity: Nit

- **Findings covered:** `readiness-2-12`, `codebase-2-7`.
- **Affected Scope:**
  [Lines 1557-1560](../../learner-hover-preview.md#L1557-L1560) (item 4),
  [1660-1663](../../learner-hover-preview.md#L1660-L1663) (item 7),
  [1696-1697](../../learner-hover-preview.md#L1696-L1697) (item 9),
  [2107](../../learner-hover-preview.md#L2107) and
  [2113](../../learner-hover-preview.md#L2113) (item 20),
  [2124-2141](../../learner-hover-preview.md#L2124-L2141) (item 21)
- **Discrepancy Description:** the 3 MB cap has no exact value, name or home. Whether the
  timeout covers the body read, and how the content type is compared, are not stated. The
  commented lines for `.env.example` and the two example variable files, and the Terraform
  variable's description, have no wording. ADR 011 and the additions to `mux.md` and
  `infra/README.md` are given as topics, where other records have exact sentences.
- **Rationale:** each is left to the builder.
- **_AI Suggestion:_** PROPOSE FIX for the constants and the configuration wording. DECLINE
  for the wording of ADR 011, `mux.md` and `infra/README.md`.
- **_Justification:_** the constants and the configuration lines are short and exact, so the
  plan should give them. The three records are prose of a page or more. Their content is
  listed under "Records and rules" in the feature part, and writing their sentences here
  would put the same text in two files.
- **_Proposed Edit:_**
  - Location: item 4, the constants (line 1560). Add `maxBytes: 3_000_000` and
    `fetchTimeoutMs: 10_000` to `COURSE_PREVIEW`. Issue 15 uses both.
  - Location: item 8 (lines 1685 to 1687). Replace "over 3 MB" with "over
    `COURSE_PREVIEW.maxBytes`" in both places.
  - Location: item 9 (line 1696). Replace with: "`.env.example` gains, in its video section,
    the line `# COURSE_PREVIEWS=true  # hover-preview clips on course cards; VIDEO_DRIVER=local makes none`."
  - Location: item 20 (line 2107). Replace with: "A module variable `course_previews`, a
    boolean with default `true` and the description 'Whether the API makes and returns
    hover-preview clips for course cards.'"
  - Location: item 20 (line 2113). Replace with: "Each example file gains the line
    `# course_previews = true  # false stops hover-preview clips being made and shown`."
  - Declined: the wording of ADR 011, `mux.md` and `infra/README.md`. No change.

## Summary of the sort

| Category    | Issues                   | Findings covered |
| ----------- | ------------------------ | ---------------- |
| PROPOSE FIX | 22, and part of issue 23 | 38               |
| CONTEST     | 0                        | 0                |
| ESCALATE    | 0                        | 0                |
| DECLINE     | part of issue 23         | part of 2        |

- **Moot if the count goes:** issue 2, issue 22, the count half of issues 1 and 3, and the
  third row of issue 12.
- **Moot if the picker goes:** issue 1, and the CUJ 4 half of issue 4.
- **Also edits the feature part:** issues 2 and 3, one line each; issue 1 points at a table
  there and does not change it.
- **Adds a step the author has not agreed to:** issue 7's staging measurement on filmed
  footage.
