# Stage 9: Implementation Readiness Test (round 2)

- **Target:** `docs/designs/learner-hover-preview.md`, lines 1458 to 2309 (DetailedRange)
- **Date:** 2026-11-19
- **Round:** 2. Round 1 reviewed an earlier version; its report is in
  `docs/designs/reviews/learner-hover-preview/`. No reviewer was given it.
- **Reviewers:** `egm-implementation-readiness` and `egm-codebase-details` against the
  implementation-readiness standard, `egm-style` with its own rules
- **Reading list given to all three:** the brief, `learner-chinese.md`,
  `learner-teach-banner.md`, ADR 004, ADR 005, `docs/spec.md`

Finding identifiers are `<reviewer>-<round>-<n>`. The style reviewer's findings in this stage
are `plan-style-2-n`, to keep them apart from `style-2-n` in `critic_report_round2.md`.

## Reviewer Status

| Reviewer                       | Status    | Blocker | Major | Nit |
| ------------------------------ | --------- | ------- | ----- | --- |
| `egm-implementation-readiness` | completed | 0       | 2     | 10  |
| `egm-codebase-details`         | completed | 0       | 4     | 9   |
| `egm-style`                    | completed | 0       | 4     | 9   |
| **Total**                      |           | 0       | 10    | 28  |

All three read the whole design, lines 1 to 2309. None read the six reading-list files in
full; each says no finding of its own depends on them. The codebase reviewer opened the code
for every file, symbol, signature, helper and command the plan cites and reports that none
contradicts the code.

**Verdict on readiness:** the readiness reviewer says the plan is executable except for two
gaps, each of which leaves a behaviour choice to the implementer. No reviewer raised a
Blocker.

## All findings by severity

| ID                | Severity | Finding                                                                                                            |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `readiness-2-1`   | Major    | Teach card: nothing says which video feeds the start select and the "changes left" line when "Default" is selected |
| `readiness-2-2`   | Major    | `changesLeft` can go below zero, and no rule covers it                                                             |
| `codebase-2-1`    | Major    | `changesLeft` can go below zero, and nothing says what happens then                                                |
| `codebase-2-2`    | Major    | "With the mailer made to throw" has no mechanism and no file                                                       |
| `codebase-2-3`    | Major    | Whether an unchanged preview field is written, and so moves `updated_at`, is not stated                            |
| `codebase-2-4`    | Major    | The CUJ 4 walkthrough can't be done as written                                                                     |
| `plan-style-2-1`  | Major    | Outcome count contradicts itself                                                                                   |
| `plan-style-2-2`  | Major    | "Checks 1 to 3 passed, so the gate is open" outruns the evidence                                                   |
| `plan-style-2-3`  | Major    | The CUJ 4 walkthrough cannot be done as written                                                                    |
| `plan-style-2-4`  | Major    | "The selected video" is undefined when the select holds "Default"                                                  |
| `readiness-2-3`   | Nit      | `RefreshOutcome` is called seven names in one place and eight in two others                                        |
| `readiness-2-4`   | Nit      | How the three call sites get a `CoursePreviewService` instance is not stated                                       |
| `readiness-2-5`   | Nit      | Two ways to build the clip address, and item 12 does not pick one                                                  |
| `readiness-2-6`   | Nit      | `videosOf` and `refresh` have unstated edge inputs                                                                 |
| `readiness-2-7`   | Nit      | Whether the `media_assets` counter update keeps `updated_at` is ambiguous                                          |
| `readiness-2-8`   | Nit      | The `previews` command's failure behaviour is not defined or tested                                                |
| `readiness-2-9`   | Nit      | Three test set-ups need fixtures that item 15 does not provide                                                     |
| `readiness-2-10`  | Nit      | Support's line has no stated layout                                                                                |
| `readiness-2-11`  | Nit      | The web cover file's re-export from the base file can resolve to itself                                            |
| `readiness-2-12`  | Nit      | Several text and constant details are left to the implementer                                                      |
| `codebase-2-5`    | Nit      | "Seven" outcome names where there are eight                                                                        |
| `codebase-2-6`    | Nit      | `videosOf` and a video item with no file                                                                           |
| `codebase-2-7`    | Nit      | The 3 MB cap has no exact value or home                                                                            |
| `codebase-2-8`    | Nit      | "Global `fetch`" against the injected `fetchImpl`                                                                  |
| `codebase-2-9`    | Nit      | How callers reach `refresh`, and who calls `clipUrl`                                                               |
| `codebase-2-10`   | Nit      | Edge cases of the `previews` command                                                                               |
| `codebase-2-11`   | Nit      | Support's clip placement                                                                                           |
| `codebase-2-12`   | Nit      | `locked` on the card's inputs                                                                                      |
| `codebase-2-13`   | Nit      | Three test fixtures have no helper                                                                                 |
| `plan-style-2-5`  | Nit      | Item 1 describes a finished gate in the present tense                                                              |
| `plan-style-2-6`  | Nit      | "Three commands" names two different sets                                                                          |
| `plan-style-2-7`  | Nit      | List numbers collide with item numbers                                                                             |
| `plan-style-2-8`  | Nit      | Ambiguous back-references in the test list                                                                         |
| `plan-style-2-9`  | Nit      | Imprecise code references                                                                                          |
| `plan-style-2-10` | Nit      | Near-homonyms in `previewIsShown`                                                                                  |
| `plan-style-2-11` | Nit      | Wordiness and vague modals                                                                                         |
| `plan-style-2-12` | Nit      | Hedge without its condition                                                                                        |
| `plan-style-2-13` | Nit      | User-facing copy has no singular form                                                                              |

## Findings that say the same thing

Each finding is kept under its own reviewer below, with the severity that reviewer gave.
`Z`, `C`, `R`, `I` and Stage 7 identifiers are in this round's other four reports.

- **Which video feeds the start select on "Default".** `readiness-2-1`, `plan-style-2-4`,
  with `R2` from Stage 6. Three reviewers.
- **`changesLeft` can go below zero.** `readiness-2-2`, `codebase-2-1`. It follows from the
  per-video count, which `Z3`, `I2.3` and `design-2-6` question as a whole.
- **The CUJ 4 hand check cannot be done.** `codebase-2-4`, `plan-style-2-3`, with `R1`.
- **Seven outcome names where there are eight.** `readiness-2-3`, `codebase-2-5`,
  `plan-style-2-1`, with `R5` and `Z4`. Five reviewers. The style reviewer gave it Major.
- **The gate's "passed" outruns its evidence.** `plan-style-2-2`, `plan-style-2-5`, with
  `design-2-3`, `style-2-2`, `style-2-4`, `structural-2-3`, `R11` and `I2.4`.
- **The mailer made to throw, and other missing fixtures.** `codebase-2-2`, `codebase-2-13`,
  `readiness-2-9`. The codebase reviewer gave the mailer Major; the readiness reviewer, Nit.
- **How callers reach `refresh`, and who calls `clipUrl`.** `readiness-2-4`, `readiness-2-5`,
  `codebase-2-9`, `plan-style-2-9`, with `Z9`.
- **`videosOf` and a video item with no file.** `readiness-2-6`, `codebase-2-6`.
- **The 3 MB cap has no value or home.** `readiness-2-12`, `codebase-2-7`.
- **Edge cases of the `previews` command.** `readiness-2-8`, `codebase-2-10`.
- **Support's clip placement.** `readiness-2-10`, `codebase-2-11`.
- **`locked` on the card's inputs.** `readiness-2-1`, `codebase-2-12`.
- **"Global `fetch`" against `fetchImpl`.** `codebase-2-8`, `plan-style-2-9`.
- **Whether the count's update keeps `updated_at`.** `readiness-2-7`, `codebase-2-3`.

## How Stage 8 bears on these findings

Stage 8's reviewer recommended three changes that would remove parts of the plan. No decision
has been made on them. If they were taken, these findings would no longer apply:

- **Dropping the per-video count (`I2.3`):** `readiness-2-2`, `codebase-2-1`, the count half
  of `readiness-2-1`, `readiness-2-7`, `plan-style-2-13`, and the third fixture in
  `codebase-2-13`.
- **Dropping the catalog's read-time check (`I1.1`):** no Stage 9 finding is about it.
- **Removing the video and start picker (`Z2`):** `readiness-2-1`, `plan-style-2-4`,
  `codebase-2-4`, `plan-style-2-3` and `codebase-2-12` in part.

## Claims checked by the main session

Checked against the code and the design after the reviewers returned. The other findings have
not been checked.

- **`codebase-2-3`: confirmed.** `CoursesService.update`
  (`apps/api/src/services/courses.service.ts`, lines 428 to 454) writes every field the
  request defines, equal or not. `updatedAt` in `packages/db/src/schema/columns.ts` is set on
  every update. `apps/teach/src/routes/courses/builder.tsx` line 164 keys the Details form on
  `updatedAt`. So "Make clip", built the way the existing code is built, remounts the form
  and drops unsaved edits. The design accepts that for "Save preview" and does not mention it
  for "Make clip".
- **`codebase-2-2`: confirmed.** `FakeMailer` in `apps/api/src/providers/mailer/types.ts` only
  collects messages. It has no way to fail.
- **`readiness-2-4`: confirmed.** Line 1787 of the design writes
  `await CoursePreviewService.refresh(courseId)`, a static call, for a class the plan says is
  built from `Deps`.
- **`plan-style-2-13`: confirmed.** Lines 2032 to 2034 give the sentence for 7 and for 0, and
  none for 1.

## Readiness reviewer

**Status:** completed. 0 Blocker, 2 Major, 10 Nit.

**The reviewer's summary:** Result: no Blockers, 2 Major, 10 Nit. The plan is executable except for the two Major gaps, which each leave a behaviour choice to the implementer.

### readiness-2-1. Teach card: nothing says which video feeds the start select and the "changes left" line when "Default" is selected - Severity: Major

**Scope:** item 17, lines 2019-2034 (also 2043-2058); file `apps/teach/src/components/preview-card.tsx`

**Finding:** The start select's options are "the selected video's `starts`" and the line under it comes from "the selected video's `changesLeft`". With the video select on "Default" (empty value), there is no selected video. That is the card's initial state for every course. The plan does not say whether to use `videos[0]`, the video named by `preview.resolved`, or nothing. A default video with a chosen start is a supported combination (item 5, line 1620), so the card must offer starts in that state.

**Related cases left open in the same component:**

- `videos` is empty (`no_video`), or `resolved` is null because the preview is off.
- The saved `startSeconds` is not in the video's `starts`. Item 16 line 1938-1939 has the server accept and store 90 on a 60-second video, so the controlled select gets a value with no matching option.
- Whether the tick box and the two selects are disabled when `locked` is true. Line 2055 covers only the button; item 22 line 2153 expects the writer to see the card "disabled".
- The literal sentence for `pending` (the spec table gives "The clip is not up to date, with 'Make clip'", which is a description, not a string).

**Guidance:** State the video used for `starts` and `changesLeft` when the choice is empty, what the start select shows for an out-of-list saved start, and the disabled rule for all three controls. Teach has no component tests (item 22), so nothing catches a wrong guess.

### readiness-2-2. `changesLeft` can go below zero, and no rule covers it - Severity: Major

**Scope:** item 4 lines 1585-1593; item 10 lines 1720-1723; item 12 lines 1765-1767; item 14 lines 1834-1839; item 17 lines 2032-2034

**Finding:** `changesLeft` is defined as allowance less `previewFetches`. Two paths push `previewFetches` past the allowance:

- `check` adds one for every clip returned and is not told to test the allowance first.
- `refresh` reads the count from the row as loaded and increments after the fetch, so two concurrent refreshes at allowance minus one both fetch. The "Two refreshes" test at lines 1979-1980 exercises exactly this interleaving.

**What is undefined as a result:**

- `previewState`'s `limit` test ("no changes left") is not given as `<= 0` or `=== 0`.
- The `CoursePreviewView.videos[].changesLeft` contract value has no floor.
- The Teach line has wording for a positive number and for 0 only, so a literal build renders "This video has -1 clip changes left."

**Guidance:** Name one place that clamps to 0 (the natural one is where `changesLeft` is computed for both `previewState` and the view), state the `limit` comparison, and say whether `check` refuses at the allowance. Add the over-allowance case to item 5 or item 16.

### readiness-2-3. `RefreshOutcome` is called seven names in one place and eight in two others - Severity: Nit

**Scope:** item 10 lines 1705-1706; item 14 lines 1829-1830

**Finding:** Line 1705 says "the union of the seven outcome names"; line 1706 says "eight outcomes" and item 14 counts "each of the eight outcomes". The spec table (lines 562-571) lists eight: `made`, `unchanged`, `cleared`, `none`, `not_live`, `paused`, `limit`, `failed`. Change "seven" to "eight" on line 1705. `backfill` returns `Record<RefreshOutcome, number>`, so the union's size is load-bearing.

### readiness-2-4. How the three call sites get a `CoursePreviewService` instance is not stated - Severity: Nit

**Scope:** item 12 line 1787; item 13 lines 1809 and 1815; item 10 line 1704

**Finding:** Line 1787 writes `CoursePreviewService.refresh(courseId)` as if static, while item 10 makes it a class "built from `Deps`". The codebase pattern is a private field set in the constructor (`this.media = new MediaService(deps)` in `apps/api/src/services/courses.service.ts`). `ChangeSetsService` currently has an empty constructor body. Say that `CoursesService`, `ReviewService` and `ChangeSetsService` each construct one in their constructor.

### readiness-2-5. Two ways to build the clip address, and item 12 does not pick one - Severity: Nit

**Scope:** item 10 lines 1729-1731; item 11 line 1747; item 12 line 1768

**Finding:** Item 10 defines `clipUrl(key)`. Item 11 calls `this.deps.storage.getUrl(course.previewKey)` directly. Item 12 says only "the stored clip's address". As written, `clipUrl` may have no caller. Name the caller or drop the method. Also, `StorageProvider.getUrl` returns `Promise<string>` and takes a non-null `string`, so line 1747 needs an `await` and a null guard.

### readiness-2-6. `videosOf` and `refresh` have unstated edge inputs - Severity: Nit

**Scope:** item 10 lines 1706-1709 and 1732-1736; item 4 lines 1564-1567

**Finding:**

- `PreviewVideo.mediaId` is a required string, but a video item can have `mediaAssetId` null. The plan does not say that `videosOf` skips such items.
- `refresh` for a course ID that does not exist has no named outcome (`not_live`, or `failed` through the catch).

### readiness-2-7. Whether the `media_assets` counter update keeps `updated_at` is ambiguous - Severity: Nit

**Scope:** item 10 lines 1715-1716 and 1720-1723; item 14 lines 1837-1839

**Finding:** "Every `UPDATE` in a refresh sets `updatedAt` to the column itself" reads as covering the `preview_fetches + 1` update, but its stated reason is about `courses`. `media_assets` also has an on-update `updatedAt`. The same increment in `check` is not "in a refresh". State yes or no for both.

### readiness-2-8. The `previews` command's failure behaviour is not defined or tested - Severity: Nit

**Scope:** item 14 lines 1840-1846; Verification lines 2298-2300

**Finding:** Only "an unknown command exits with status 1" is given. Not stated:

- `check` with no media ID, or with an ID that is not found.
- A `--start` value that is not a number or not an allowed start.
- The exit status when `check` returns `ok: false`, or when `backfill` counts `failed` above 0.
- Whether a thrown error prints JSON.
  No test or hand check covers the entry file's argument parsing; item 16 tests the service methods only.

### readiness-2-9. Three test set-ups need fixtures that item 15 does not provide - Severity: Nit

**Scope:** item 15 lines 1859-1880; item 16 lines 1912-1913, 1929-1930, 1990-1991

**Finding:**

- "With the mailer made to throw": `FakeMailer` in `apps/api/src/providers/mailer/types.ts` has no failure mode, and that file is not in the list. Say that the test reassigns `t.mailer.send`, or add the file.
- The `wrong_kind` and `check`-on-an-image cases need an image media row of the profile. Only `createVideoMedia` is specified.

### readiness-2-10. Support's line has no stated layout - Severity: Nit

**Scope:** item 18 lines 2070-2075

**Finding:** The line is "under the cover image" and the clip "beside it" with "the cover image's classes". Those classes are `mb-4 aspect-[4/3] w-full max-w-md rounded-card object-cover`. Two `w-full max-w-md` images cannot sit side by side without a wrapper the plan does not describe. The text line's own classes, and where it goes when the course has no cover image, are also not given.

### readiness-2-11. The web cover file's re-export from the base file can resolve to itself - Severity: Nit

**Scope:** item 23 lines 2169-2175

**Finding:** On the web bundle, `./CourseCardCover` imported from inside `CourseCardCover.web.tsx` resolves to the web file. The props type must therefore be re-exported with `export type { ... } from`, and the base component cannot be imported at run time. "The same cover" means duplicated markup. Say both. The existing web files in `apps/learner/src` are no guide here: none was checked for importing its base file.

### readiness-2-12. Several text and constant details are left to the implementer - Severity: Nit

**Scope:** item 7 lines 1660-1663; item 9 lines 1696-1697; item 20 lines 2107 and 2113; item 21 lines 2124-2141

**Finding:**

- The 3 MB cap has no constant name or home; `COURSE_PREVIEW` in item 4 does not include it.
- Whether the 10-second timeout covers the body read is not stated.
- Whether the content-type test is an exact match or tolerates parameters is not stated.
- The commented lines for `.env.example` and the two `terraform.tfvars.example` files, and the Terraform variable's `description`, have no wording.
- ADR 011 and the `mux.md` and `infra/README.md` additions are given as topics, while the other records in item 21 have exact sentences.

#### What the readiness reviewer confirmed, could not verify, and read

**Checked against the codebase and found consistent (no finding):**

- Server PR typecheck: no file under `apps/learner`, `apps/teach` or `apps/support` builds a `CourseCard` or `CourseView` literal, so the two new required fields break only the API files that items 11 and 12 change.
- Terraform file list: `csp_report_only` is declared and passed in `envs/*/main.tf` and `modules/environment/variables.tf`, matching item 20.
- Fixtures: `createCourse` builds two lessons with one item each at position 0; `media_assets` requires only `kind`, `provider`, `filename` and `mimeType`; `createTestApp` takes env overrides. All match item 15 and item 16.
- Existing code the plan leans on: `getProfileAsset(..., { kind })` answers 404 then 400 `wrong_kind`; `liveArtefacts.media` exists in `packages/db/src/learner-relations.ts`; `recordAudit` takes a free-string action; `DetailsForm` is keyed by `updatedAt`; `createDeps` returns `close`; the `describe('catalogue')` block exists in `checkout.test.ts`.
- Item 5's arithmetic: every stated expectation for `previewAllowance`, `allowedStarts` and the lowered starts follows from item 4's definitions.

**Files read in full:** the persona `agents/implementation_readiness.md` (lines 1-63); the standard `resources/document_standards/implementation-readiness-standard.md` (lines 1-38); the target `docs/designs/learner-hover-preview.md` lines 1-2310 (spec 1-1457 as definition, plan 1458-2309 as the reviewed range). The six GoldfishContext documents were not read in full: only `docs/spec.md` was searched, and no finding depends on them. Codebase files were consulted for the checks listed above.

## Codebase reviewer

**Status:** completed. 0 Blocker, 4 Major, 9 Nit.

**The reviewer's summary:** Result: no Blockers, 4 Major, 9 Nit. Every file the plan marks Modify exists, every path carries a Create/Modify marker, and no cited symbol, signature, helper or command contradicts the code.

### codebase-2-1. `changesLeft` can go below zero, and nothing says what happens then - Severity: Major

**Scope:** item 4 (lines 1585-1593), item 10 (1720-1723), item 14 (1834-1839), item 17 (2032-2034); the "Two refreshes" test (1979-1980).

**Discrepancy:** `changesLeft` is "allowance less `previewFetches`" with no floor. `limit` is "no changes left", and the card only defines the text "At 0". Two paths in the plan push `previewFetches` past the allowance:

- `check` adds one "like any other", with no allowance guard stated.
- Two concurrent refreshes both read `previewFetches` "from the media row as loaded" and both increment. The plan's own "Two refreshes" test produces 2 fetches for one stored clip.

**Rationale:** the implementer must decide three things: whether `previewState` tests `<= 0` or `=== 0`, whether the view clamps to 0, and whether `check` refuses at the allowance. Otherwise Teach can print "This video has -1 clip changes left."

### codebase-2-2. "With the mailer made to throw" has no mechanism and no file - Severity: Major

**Scope:** item 16 (lines 1929-1932), item 15 (1857-1880).

**Discrepancy:** `FakeMailer` in `apps/api/src/providers/mailer/types.ts` only collects messages. Item 15 adds explicit switches for storage (`failDeleteKeys`) and video (`previewMode`, `onPreview`) but nothing for the mailer. No test under `apps/api/test` makes the mailer fail today.

**Rationale:** the implementer chooses between `vi.spyOn(t.mailer, 'send').mockRejectedValueOnce(...)` (the pattern in `apps/api/test/storage-s3.test.ts:49-61`) and a new switch on `FakeMailer`. The second edits a file outside the plan's list.

### codebase-2-3. Whether an unchanged preview field is written, and so moves `updated_at`, is not stated - Severity: Major

**Scope:** item 12 (lines 1786-1797), item 10 (1715-1716, 1720-1723), item 14 (1838-1839).

**Discrepancy:** `CoursesService.update` (`apps/api/src/services/courses.service.ts:435-452`) writes every field that is defined in the patch, equal or not. `updatedAt` has `$onUpdate` (`packages/db/src/schema/columns.ts:11-15`). The plan says "the row update; then ... refresh" without saying whether "Make clip", which sends stored values back, performs the write.

**Rationale:** following the existing pattern, "Make clip" bumps `updated_at`. That has two effects:

- It remounts `DetailsForm`, keyed on `c.updatedAt` at `apps/teach/src/routes/courses/builder.tsx:164`, dropping unsaved title and description edits. The spec accepts this cost for "Save preview" only (lines 814-816).
- It reorders the course lists, which the spec (646-650) goes out of its way to avoid for system writes.

**Related gap:** "Every `UPDATE` in a refresh sets `updatedAt` to the column itself" does not say whether it covers the `media_assets` counter update, whose `updatedAt` also has `$onUpdate`, or `check`'s increment, which is not in a refresh.

### codebase-2-4. The CUJ 4 walkthrough can't be done as written - Severity: Major

**Scope:** Verification Plan (lines 2288-2291), against item 4 (1577-1580) and item 17 (2027-2031).

**Discrepancy:** the walkthrough uses Mux test assets "at most 10 seconds long". By item 4, `allowedStarts(10)` is `[0]`, since start + 4 must be at most 9. Item 17's start field is a select of allowed starts with "no free typing". So the card offers no second start "inside the video", and no way to send "one above it to see it lowered".

**Rationale:** the step needs a hand-made `PATCH` (say `previewStartSeconds: 90`) or a non-test asset. The plan should say which, or drop the step and cite the item 16 case "Starts are in steps".

### codebase-2-5. "Seven" outcome names where there are eight - Severity: Nit

**Scope:** item 10, line 1705, against line 1706 ("eight outcomes"), line 1830 and the spec table at 562-571.

- `RefreshOutcome` has eight members: `made`, `unchanged`, `cleared`, `none`, `not_live`, `paused`, `limit`, `failed`. "Seven" is the state count, not the outcome count.

### codebase-2-6. `videosOf` and a video item with no file - Severity: Nit

**Scope:** item 4 (1564-1567), item 10 (1732-1736).

- `PreviewVideo.mediaId` is `string`, "one for each video item". `artefacts.mediaAssetId` is nullable (`packages/db/src/schema/courses.ts:178`), and the test at 1936-1937 uses such an item. The plan should say `videosOf` drops items whose `media` is null.

### codebase-2-7. The 3 MB cap has no exact value or home - Severity: Nit

**Scope:** item 7 (1662-1663), item 8 (1685-1687).

- `3_000_000` or `3 * 1024 * 1024` is not stated. `COURSE_PREVIEW` (1557-1560) has no such constant and the driver item names none.

### codebase-2-8. "Global `fetch`" against the injected `fetchImpl` - Severity: Nit

**Scope:** item 7 (1661-1666).

- The sentence says the request "uses the global `fetch`" while the new constructor parameter exists so the request goes through `this.fetchImpl`. It should say `fetchImpl`, which defaults to the global.

### codebase-2-9. How callers reach `refresh`, and who calls `clipUrl` - Severity: Nit

**Scope:** items 10 to 13 (1729-1731, 1747, 1768, 1787, 1809, 1815).

- `refresh` is an instance method, but line 1787 writes `CoursePreviewService.refresh(courseId)`.
- No item says that `CoursesService`, `ReviewService` and `ChangeSetsService` each construct a `CoursePreviewService` in their constructor. That is the existing pattern at `courses.service.ts:61-67` and `review.service.ts:13-17`; `ChangeSetsService` (`change-sets.service.ts:375-376`) holds only `deps`.
- `clipUrl(key)` has no named caller. Item 11 calls `storage.getUrl` directly, and item 12 does not say which it uses.

### codebase-2-10. Edge cases of the `previews` command - Severity: Nit

**Scope:** item 14 (1834-1846).

- Not stated: a `check` on a media ID that does not exist (throw or `ok: false`); `check` with no ID or a non-integer `--start`; the exit status when `backfill` reports `failed` outcomes; whether `deps.close()` runs on the error path.

### codebase-2-11. Support's clip placement - Severity: Nit

**Scope:** item 18 (2070-2075).

- The clip is "beside it" with "the cover image's classes". Those are `mb-4 aspect-[4/3] w-full max-w-md rounded-card object-cover` (`apps/support/src/routes/review-course.tsx:129-135`), a full-width block. "Beside" the line or the cover needs a wrapper the plan does not describe.

### codebase-2-12. `locked` on the card's inputs - Severity: Nit

**Scope:** item 17 (2015-2018, 2055).

- Only the button is said to be disabled when `locked`. Item 22 expects a writer on a live course to see the card disabled. The other cards in `apps/teach/src/components/details-form.tsx` set `disabled={locked}` on each input; the plan should say the tick box and both selects do the same.

### codebase-2-13. Three test fixtures have no helper - Severity: Nit

**Scope:** item 15 (1865-1880), against item 16 (1912-1914, 1936-1937, 1940-1944).

- These rows have to be written through `t.db` directly: an image of this profile; a video item with no file; a course video whose `previewFetches` is already at its allowance while a clip is stored. `createVideoMedia`'s `previewFetches` option applies only to a media row with no item.

#### What the codebase reviewer confirmed, could not verify, and read

**Confirmed against the code, no discrepancy**

- **CI and infra:** the four commands in `.github/workflows/ci.yml`; `terraform fmt` and `validate` in `.github/workflows/infra.yml` over `bootstrap`, `envs/staging`, `envs/production`.
- **Database:**
  - `npm run db:generate -- --name course_preview` passes through `packages/db/scripts/generate.ts`.
  - `courses_price_cents_non_negative` exists beside the new check; `thumbnailMediaId` uses `onDelete: 'set null'`.
  - `learnerRelations` has `courses.liveLessons`, `liveLessons.liveArtefacts`, `liveArtefacts.media`.
  - The schema guard regexes do not match the planned `with:` keys.
- **Contracts:**
  - `CourseCard` is built only in `CatalogService.toCard`; `EnrollmentsService` calls it with one argument (`enrollments.service.ts:44`).
  - `CourseView` is built only in `loadCourseView`.
  - `uuidSchema` is imported in `contracts/teach.ts`; `USER_ERROR_CODES` exists.
  - The typecheck order in lines 1482-1485 holds.
- **API:**
  - Signatures match: `getProfileAsset(profileId, assetId, { ready?, kind? })` answering 404 or 400 `wrong_kind`; `errors.unprocessable(code, message)`; `deps.log.warn(msg, data)`.
  - The `PATCH` route passes the validated body to `update`.
  - Approval placement matches: `ReviewService.approve` has two email paragraphs and runs `recordAudit` then `trackEvent` then the email loop; `ChangeSetsService.approve` runs the transaction, then `recordAudit`, then the email.
  - The catalog `list` `with` matches line 1745.
  - `bool` exists in `env.ts`; `createTestApp(overrides)` takes string values.
  - `FakeStorage` and `FakeVideoProvider` are as described.
  - The files route serves `public/` keys with the immutable header.
  - The API task role has `s3:DeleteObject` (`infra/terraform/modules/environment/iam.tf:46`).
  - `role-routes.test.ts` has the `PATCH courses/:id` row with capability `details`.
  - No existing test approves a course that has a ready Mux video, so the plan's list of changed tests is complete.
- **Build and commands:** `tsup.config.ts` has four entries and a comment; the Dockerfile header names only the server and migration; `seed.ts` and `server.ts` are as described; the `dev` script form matches the local command; `infra/README.md` has the "Seeding" section and the command-override form.
- **Teach and Support:**
  - The "Cover image" card sits inside the form.
  - The `builder.tsx` note text matches.
  - `actions.updateCourse` takes `UpdateCourse`.
  - `NativeSelect` exists; `@elevate/web-ui` has no checkbox component; `prerequisites-editor.tsx` uses a plain one.
  - Both apply pages have the agreement `<p>` as a direct child of the flex row with the button.
  - All four i18n area files exist.
- **Terraform:** the longest key in `api_environment` is `STORAGE_DRIVER`, so `COURSE_PREVIEWS` does force a re-align; the `csp_report_only` pass-through pattern exists in both environments and both example files.
- **Docs:** ADR 010 exists and 011 does not; ADR 004's Consequences line, `mux.md` section 3, `deploy.md`'s command and optional lists, `README.md` line 42 and the `AGENTS.md` Rules section are as cited.
- **Learner:** `CourseCard.tsx`'s structure matches; `HeroScene` uses `useReducedMotion`, `aria-hidden` and `pointerEvents: 'none'`; `device-languages.web.ts` guards browser globals; `device-languages-web.test.tsx`, `sign-in.test.tsx` (`renderRouter` with `wrapper: TestProviders`) and `test-utils/providers.tsx` are as cited; the `build` script is `expo export --platform all`.

**Not verified**

- This worktree has no `node_modules`. `@mux/mux-node` 15.5.0's `gif = "g"` token type and React Native's `FocusEvent` export were checked in a sibling worktree's install, not this one.
- Whether RNTL 14's `fireEvent(…, 'hoverIn')` reaches `Pressable.onHoverIn` on the iOS preset (item 25, line 2245).
- The claim that Biome 2.6.6 checks this Markdown file (line 2273).

**Read in full:** the persona file; the standard; the target file lines 1-2309 (plan 1458-2309 and spec 1-1457); `docs/adr/004-media-mux-and-storage.md`; and the code files cited above. `docs/spec.md` was searched only, `docs/adr/010` was read to line 30, and `learner-main-page-improvements.md`, `learner-chinese.md`, `learner-teach-banner.md` and `docs/adr/005` were not opened because no finding depended on them.

## Style reviewer

**Status:** completed. 0 Blocker, 4 Major, 9 Nit.

**The reviewer's summary:** Summary: 0 Blockers, 4 Major, 9 Nits. The plan's prose is dry and free of marketing language. The Major findings are a contradictory count, a status claim that outruns its evidence, a hand check that cannot be performed as written, and an undefined referent in the Teach card.

### plan-style-2-1. Outcome count contradicts itself - Severity: Major

**Scope:** item 10, line 1705, against lines 1706 and 1830 and the spec table at lines 560-571.

**Discrepancy:** line 1705 calls `RefreshOutcome` "the union of the seven outcome names". Line 1706 says "eight outcomes", line 1830 says "each of the eight outcomes", and the spec lists eight (`made`, `unchanged`, `cleared`, `none`, `not_live`, `paused`, `limit`, `failed`).

**Rationale:** "seven" also matches the number of `CoursePreviewState` values (line 1569), so a reader can conflate the two unions or leave `limit` out. Change "seven" to "eight".

### plan-style-2-2. "Checks 1 to 3 passed, so the gate is open" outruns the evidence - Severity: Major

**Reviewer's action tag:** Action: CALIBRATE, and RELOCATE the residual caveat

**Scope:** item 1, lines 1497-1502; Verification Plan, lines 2287 and 2296-2300.

**Discrepancy:** line 1501 requires "one signed video of real lesson footage". The recorded run (spec lines 193-204, 267-270, 921-922) used one 60-second flat-coloured animation, at 320 pixels wide, with one clip at the shipped 480 pixels. The spec says "Filmed footage will be larger, by an amount one video can't show."

**Rationale:** check 2 is "the file's size at the clip's shape", and the shipped shape was measured once, on footage the spec says compresses well. The Status line states an unqualified pass.

**Edit:** narrow the Status to what ran (320 pixels, one animated video, one 480-pixel clip, no filmed footage). Move the open point to the step where someone can act on it: add a `previews check` run on filmed footage to the staging step at lines 2298-2300, with the byte count compared against the 3 MB cap.

### plan-style-2-3. The CUJ 4 walkthrough cannot be done as written - Severity: Major

**Scope:** Verification Plan, lines 2288-2292, against item 4 lines 1577-1580 and item 17 lines 2027-2031. A related gap is in item 22, line 2152.

**Discrepancy:** line 2291 asks for "one start inside the video, and one above it to see it lowered" on a test asset of at most 10 seconds. By `allowedStarts`, a 10-second video has one allowed start, 0. The start select offers only allowed starts and "There is no free typing".

**Rationale:** the card cannot send a start above the video, and the only start inside it equals the default. The step needs its method stated (for example a hand-made `PATCH` with `previewStartSeconds: 90`) or its expectation rewritten.

**Related:** item 22's "the card in each of its seven states" does not say how `limit` (ten counted fetches) or `paused` (a restart with `COURSE_PREVIEWS` off) is reached by hand.

### plan-style-2-4. "The selected video" is undefined when the select holds "Default" - Severity: Major

**Scope:** item 17, lines 2019-2034.

**Discrepancy:** the start options are "the selected video's `starts`" and the changes-left line comes from "the selected video's `changesLeft`". The select's first option, "Default: the course's first video", has an empty value and names no entry of `course.preview.videos`.

**Rationale:** the default option is the initial state for most courses, and the text does not say which video supplies the starts and the count (`videos[0]`, `preview.resolved`, or none). `resolved` is null while the preview is off, so the two candidates differ. State the rule in one sentence.

### plan-style-2-5. Item 1 describes a finished gate in the present tense - Severity: Nit

**Reviewer's action tag:** Action: DROP the inactive conditional

**Scope:** item 1, lines 1496-1512; line 2287.

**Discrepancy:** the Status says the calls were "made on 2026-11-19", but Proposed Changes reads as pending ("It runs the six checks", "which then moves to 'Answered'", "If the first check fails, the design comes back for revision before item 2 starts"). Lines 1511-1512 repeat the Status at 1497-1498. Line 1509 ("They are on file there for later changes, not only in a pull request") repeats line 1506.

**Rationale:** check 1 passed, so line 1510 guards a failure mode that is no longer reachable. Put the item in the past tense and state each fact once.

### plan-style-2-6. "Three commands" names two different sets - Severity: Nit

**Scope:** item 14, lines 1853-1854; item 21, lines 2132 and 2138; spec line 864.

**Discrepancy:** the Dockerfile sentence uses "three commands" for the entry files `dist/seed.js`, `dist/reset-schema.js` and `dist/previews.js`. Elsewhere "three commands" means `backfill`, `count` and `check`.

**Rationale:** use "entries" for the files and "commands" for the sub-commands.

### plan-style-2-7. List numbers collide with item numbers - Severity: Nit

**Scope:** lines 1460-1470.

**Discrepancy:** "Item 1 is a gate" is followed by a numbered list whose entry 1 is the server PR.

**Rationale:** bullets or "PR A / PR B" remove the second meaning of "1".

### plan-style-2-8. Ambiguous back-references in the test list - Severity: Nit

**Scope:** item 16, lines 1921-1924; line 1988; item 5, line 1609.

**Discrepancy:** "The same set-up as the first of these" sits in a list of about 35 cases and does not name its antecedent (presumably "Off with a stale chosen video"). "The same with an empty choice" is elliptical. "Count returns the number of live courses and the number with a clip" gives no fixture or expected values, unlike its neighbours. Line 1609 promises "one case for each branch of `resolvePreview` and `previewState`", but the list also covers four other functions.

**Rationale:** name the referenced case and state the expected numbers.

### plan-style-2-9. Imprecise code references - Severity: Nit

**Scope:** item 7, lines 1661-1666; item 10, lines 1704 and 1729-1731; item 11, line 1747; item 12, lines 1768 and 1787; item 13, lines 1809 and 1815.

**Discrepancy:**

- `await CoursePreviewService.refresh(courseId)` is static-call notation for a class "built from `Deps`", and items 12 and 13 do not say how the instance is reached.
- `clipUrl` names both a service method and a view field, and item 11 calls `storage.getUrl` directly, so the method's caller is unstated.
- "The request uses the global `fetch`" precedes a constructor that injects `fetchImpl`.
- In "keeping `config` as the property the existing methods read, so the driver can be tested without a network", the "so" clause belongs to `fetchImpl`, not `config`.

**Rationale:** each one makes the reader infer what the plan could state.

### plan-style-2-10. Near-homonyms in `previewIsShown` - Severity: Nit

**Scope:** item 4, lines 1598-1599.

**Discrepancy:** "the preview is on" (the `enabled` field) and "`previewsOn` is true" (the configuration value) sit in one sentence.

**Rationale:** write "`enabled` is true".

### plan-style-2-11. Wordiness and vague modals - Severity: Nit

**Scope:** lines 1763-1770, 2181 and 2275-2276.

**Discrepancy:**

- Lines 1765-1770 are one six-line sentence carrying five actions; split it.
- "This service may read those tables" (line 1764): "may" reads as permission or as possibility, and "those tables" is unnamed. Say that the schema guard test allows `CoursesService` to read `lessons` and `artefacts`.
- "used instead on purpose" (line 2181): drop "on purpose".
- "Neither should change" (lines 2275-2276): say what stays the same, the result of the two checks.

### plan-style-2-12. Hedge without its condition - Severity: Nit

**Reviewer's action tag:** Action: CALIBRATE

**Scope:** item 14, lines 1845-1846.

**Discrepancy:** "`createDeps` may log a warning about Stripe".

**Rationale:** the condition is known: `STRIPE_SECRET_KEY` unset (`apps/api/src/deps.ts`, lines 33-34). Name it. The decision the caveat serves, parsing the last line, is sound.

### plan-style-2-13. User-facing copy has no singular form - Severity: Nit

**Scope:** item 17, lines 2032-2034.

**Discrepancy:** the template "This video has 7 clip changes left." gives "1 clip changes left" at one.

**Rationale:** state the singular sentence, as the zero case is stated.

#### What the style reviewer confirmed, could not verify, and read

**Claims about existing behaviour that I checked and found accurate (KEEP, not findings):**

- The CI commands (lines 1462-1463) match `.github/workflows/ci.yml`.
- Biome is 2.6.6 (line 2273).
- The learner `build` script is `expo export --platform all` (line 2269).
- The Dockerfile header names only the server and the migration (line 1852).
- `COURSE_PREVIEWS` is longer than the other names in `api_environment` (line 2109).
- `prerequisites-editor.tsx` is the only checkbox in Teach and web-ui (line 2016).
- Teach and Support have no test files (line 2150).
- No learner test file references `expo-image` (line 2217).

**Read in full:** agents/style.md (lines 1-68); docs/designs/learner-hover-preview.md lines 1-2309 (target range 1458-2309 and the specification at 1-1457); .github/workflows/ci.yml (lines 1-42). Read in part for claim checks: apps/api/Dockerfile (lines 1-25) and grep results in package.json, apps/learner/package.json, apps/api/src/deps.ts and infra/terraform/modules/environment/api.tf. The six GoldfishContext documents were not opened, because no finding depended on them.
