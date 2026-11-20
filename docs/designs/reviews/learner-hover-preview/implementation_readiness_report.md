# Stage 9: Implementation Readiness Test

- **Target:** `docs/designs/learner-hover-preview.md`, lines 1207 to 1877 (DetailedRange: the
  Detailed Implementation Plan, items 1 to 28, and the Verification Plan)
- **Date:** 2026-11-19
- **Round:** 1
- **Reviewers:** `egm-implementation-readiness` and `egm-codebase-details` against the
  implementation-readiness standard, `egm-style` with its own rules
- **Reading list given to all three:** the brief, `learner-chinese.md`,
  `learner-teach-banner.md`, ADR 004, ADR 005, `docs/spec.md`

Finding identifiers are `<reviewer>-<round>-<n>`.

## Style reviewer

**Status:** completed. 0 Blocker, 4 Major, 14 Nit.

**Coverage:** read in full the persona and the target scope. Read target lines 236 to 810
for cross-references. It did not check the plan's claims about existing source code; that is
the codebase reviewer's job.

**Overall:** the prose is dry and direct and matches the house tone of the sibling plans. No
hyperbole or marketing language. The findings are about counts, terms and claims that say
more than the plan shows.

### Major

#### style-1-1. Item 24 says three checks, the section lists four

- **Scope:** lines 1751 to 1757 (item 24) and 1854.
- **Discrepancy:** item 24 says "the three checks under Checks before the server PR merges".
  That section (lines 784 to 790) lists four. The heading "One real Mux call" and line 1854
  also understate it: the fourth check, what Mux answers at the animated-image limit, needs
  more than one request.
- **Rationale:** a wrong count in a merge gate lets an implementer stop one check short.
- **Action:** state four checks, or name the three that gate the merge, and drop "one" from
  the heading.

#### style-1-2. "Covered only by the tests and by item 24" says more than either covers

- **Scope:** line 1863.
- **Discrepancy:** "The 10-second default start is then covered only by the tests and by
  item 24." The checks item 24 points to never name a start of 10. The automated tests run on
  the fake driver, which only records that 10 was passed.
- **Action:** either say item 24's call uses the default start (10 to 14) on a video of 15
  seconds or more, or narrow the sentence to "covered by the fake-driver tests only".

#### style-1-3. "Every branch" is claimed three times and the listed cases fall short

- **Scope:** lines 1847 to 1849 (Test Coverage Requirement), against items 8 and 27.
- **Discrepancy:**
  - Item 25 says both media queries are followed through their `change` event, and that
    `useMediaQuery` returns `false` when `matchMedia` is missing. Item 27 has no case for
    either.
  - Item 25 says `isKeyboardFocus` returns `true` when the browser throws on the selector.
    Item 27 does not test it.
  - Item 7 checks the size twice, from `Content-Length` and on the bytes read. Item 8 has
    one "body over 3 MB" case.
- **Rationale:** the requirement and the item lists disagree, so a reviewer can't tell which
  one governs.
- **Action:** add the cases, or name the exceptions as the sibling plan does.

#### style-1-4. The notice email states the default as unconditional

- **Scope:** lines 1507 to 1508 (notice email, paragraph 2).
- **Discrepancy:** "The preview is four seconds from the first video in the course, starting
  ten seconds in." By the rule, the start is 0 for a video under 15 seconds, and the video is
  the first usable one, not the first.
- **Rationale:** this email is the consent notice to existing teachers.
- **Action:** for example, "usually starting ten seconds in; a short video starts at the
  beginning".

### Nit

- **style-1-5** (lines 1458 to 1459): "The response is 200 and the view's state is
  `pending`." The state is `pending` only when a clip is wanted. A failed clear after turning
  the preview off leaves `off`.
- **style-1-6** (line 1833): "whether a second hover starts the clip from its first frame"
  is worded as a question, with no expected result, so the tester can't pass or fail it.
- **style-1-7** (lines 1830 to 1838): the lead-in scopes the checks to "the web build in
  Chrome, Safari and Firefox". The last bullet checks the iOS and Android apps.
- **style-1-8** (lines 1447 to 1448): "among the rows with no change set" is a third wording
  for what the document defines as "live rows". The feature section's wording of the same
  check says "this live course", which is narrower.
- **style-1-9** (line 1483): "`apply`, `applyCorporate`, `reapplyCorporate` and the personal
  re-application" gives three identifiers and one description.
- **style-1-10** (lines 1351 to 1352): "does not throw for an expected failure" leaves
  "expected" undefined, and the fake driver has a `throw` mode.
- **style-1-11** (lines 1648 to 1649 and 1668 to 1669): the placeholders differ ("<lesson
  title>: <item title>" against "<lesson>: <item>"), and both mix placeholders with the
  literal "0:10", which reads as fixed text.
- **style-1-12** (lines 1798 to 1799): `<CourseCardCover thumbnailUrl previewUrl ... />` is
  valid JSX that passes `true` for both props. Write the values out or describe the props in
  prose.
- **style-1-13** (lines 1606 to 1608): "Two profiles with an empty date, one with a manager,
  and one rejected profile" reads as three or four profiles.
- **style-1-14** (lines 1500 to 1501, 1608, 1731, 1860): the notice period is 14 days and the
  backfill wait is 15, with no reason given for the extra day.
- **style-1-15** (lines 1545 and 1567): "the wait" is used as a term but never defined. The
  state is `waiting` and the defined term is "the preview date".
- **style-1-16** (line 1322): "a video marked not usable is never returned, chosen or not"
  repeats cases already listed.
- **style-1-17** (lines 1451 to 1456 and 1780 to 1784): each packs an ordered list into one
  sentence with nested semicolons. At 1453, "differs from the stored value" follows the row
  update, so "stored" is ambiguous; write "the value read before the update".
- **style-1-18, mechanical errors:**
  - line 1651 has a stray closing quotation mark: `states table."`;
  - line 1768 is about 140 characters and may fail `npm run lint`;
  - line 1559: "a `previewUrl` that `GET`s with status 200" uses a code token as a verb;
  - line 1707: "the server PR works" is vague; write "previews are on".

## Implementation-readiness reviewer

**Status:** completed. 0 Blocker, 4 Major, 11 Nit. Its verdict: not ready yet.

**Coverage:** read in full the persona, the standard, the whole target document, the brief,
ADR 004, ADR 005 and `docs/spec.md`. Skimmed the two sibling designs by headings. Checked
against the code: the schema, the API services and providers the plan touches, the test
helper, the Teach and Support pages, the learner card, the message files, Terraform and the
runbooks.

**Not verifiable** (no `node_modules` in this worktree): that `@mux/mux-node` accepts
`type: 'gif'`; that React Native 0.88 exports `FocusEvent`; that `expo-image` fires `onLoad`
and `onError` under jest-expo.

**Overall:** almost every claim the plan makes about the codebase checked out. The Majors are
places where the implementer would have to make a design choice, or would build on an
assumption nobody has tested.

### Major

#### readiness-1-1. Item 12's check on the chosen video contradicts "Make clip" and the fallback rule

- **Scope:** lines 1445 to 1450, 1457 and 1643 to 1646; the feature section at 449 to 450.
- **Finding:** `update` throws 422 `preview_video_not_on_course` whenever `previewMediaId` is
  a value that is not on a video item of the course. Line 1457 says "Make clip" sends the
  three fields unchanged. The feature section says a chosen video that has left the course
  "is not an error".
  - A teacher explicitly chooses video A, then deletes A's item.
  - The card shows `pending` with "Make clip", which re-sends the stale ID and gets a 422.
  - The card's select is filled from `course.preview.mediaId`, which is no longer an
    option. A browser will typically display the first option ("Default") while the state
    still holds the stale ID.
  - The tests do not cover this. The catalog-check test reads as the default-video case.
- **Guidance:** decide one and write it down: the server validates `previewMediaId` only when
  it differs from the stored value; or the card resets a missing choice to "Default" and
  sends empty; or "Make clip" sends an explicit empty value. Add a test for the chosen-video
  variant of CUJ 7.
- **Same defect as design-1-1** in the Stage 7 report, raised independently.

#### readiness-1-2. The notice command's dry run has no specified way to print who would be emailed

- **Scope:** lines 1496 to 1501 and 1521 to 1527; the feature section at 733 to 734.
- **Finding:** the feature section says `--dry-run` "prints who would be emailed". `notice`
  returns only `{ profiles, emails, failed }`, and `previews.ts` prints "the result as one
  line of JSON". Nothing carries or prints the recipients, although the dry run is the
  rehearsal for a one-shot mass email. Four things are left to the implementer:
  - where the recipient list is printed;
  - whether `profiles` and `emails` are would-be counts in a dry run;
  - whether `profiles` means found or notified;
  - whether a failed send stops the remaining recipients of that profile, and whether
    `emails` counts the partial sends.
- **Guidance:** fix the return shape, for example a `recipients` list in a dry run, and state
  the per-profile failure rule.

#### readiness-1-3. The plan builds on an untested Mux call, and the check is the last item

- **Scope:** item 24 (1751 to 1757), item 7 (1353 to 1357), item 8, and lines 1864 to 1868;
  Questions 9 and 10.
- **Finding:** the document says nobody has made this call and that if the first check fails
  "the design does not work as written". The plan orders that check as item 24 of 24, after
  the driver, its tests, the service, the pages and the documents are written. Item 8's
  assertions encode the same assumption. Question 9 is also open, and the staging
  verification can't run without it.
- **Guidance:** make the real Mux call the first step and record its result in the plan.
  Answer Question 9, or give the staging fallback.
- **Raised for the third time:** Z4 (Stage 5) and design-1-4 (Stage 7) say the same.

#### readiness-1-4. Item 18 (`PreviewCard`) leaves several behaviours to the implementer

- **Scope:** lines 1640 to 1655; the feature section at 629 to 674.
- **Finding:** the wording for the states and the tick box is given, but these are not:
  - **The button switch.** "Make clip when the setting is saved and the clip is not up to
    date" needs a rule for unsaved changes. It is not said whether that compares local
    state with `course.preview`, or whether "Make clip" appears only in `pending`.
  - **Invalid start input.** Nothing says what the card does with a non-integer, a
    negative, or a value over 86,400.
  - **Labels.** There is no label or hint for the start field or the select, and no
    description for the card.
  - **The tick box control.** `@elevate/web-ui` exports no checkbox. The precedent is a raw
    `<input type="checkbox">` in `prerequisites-editor.tsx`.
  - **The time format.** "from 0:10" has no rule for 60 seconds and above, or an hour and
    above. No such helper exists, and Support's line in item 19 needs the same one.
  - **Empty cases.** It is not said what the "Shows 4 seconds of…" line shows when nothing
    is resolved, or how the clip image is sized and what its alt text is.
- **Guidance:** add a short table of form state against button label and enabled state, the
  labels, the validation behaviour, and one named formatting function with its location.

### Nit

- **readiness-1-5.** "The three checks" should be four (line 1755). Same as style-1-1.
- **readiness-1-6.** Stray quotation mark at line 1651. Same as style-1-18.
- **readiness-1-7. Type locations are not stated** (items 4, 6 and 10).
  - `CoursePreviewState` is returned by `previewState` in the domain file but introduced in
    item 6 as the contract's state. It must live in `course-preview.ts`; say so.
  - `RefreshOutcome` has no stated home, and `PreviewRolloutService` imports it.
  - `previewState(input)` has no field names, unlike `resolvePreview`.
  - `clipUrl` and `videosOf` are not marked as instance methods or module exports.
- **readiness-1-8. The fallback start is ambiguous** (lines 1317 to 1318; feature section 441
  to 446). "Falls back to the default" does not say whether a chosen start still applies to
  the fallback video. Read literally, it does. Add a test case that pins it.
- **readiness-1-9. Refresh step 4 has no outcome for a guard miss** (lines 1396 to 1399).
  The clear uses the guarded `WHERE`, but only step 8 names the result when no row changes.
- **readiness-1-10. A test needs a hook the fake driver does not have** (lines 1359 to 1361
  and 1602 to 1604). "A change during a refresh" runs code while the driver is called; the
  fake has only `previewCalls` and `previewMode`. Name a spy or add a callback.
- **readiness-1-11. The `createCourse` helper is underspecified** (lines 1539 to 1543).
  - It returns media IDs only, but two tests need the video item IDs.
  - The return key names are not given.
  - `media_assets.filename` and `mimeType` are required columns and are not in the listed
    values.
  - The first lesson already has a text item at position 0, so the video ties with it.
    Harmless, but worth stating.
- **readiness-1-12. The paragraph's position in the approval email is not given** (lines
  1469 to 1472).
- **readiness-1-13. The audit metadata keys are not given** (lines 1453 to 1455).
- **readiness-1-14. The learner tests leave three set-up details open** (lines 1785 to 1787
  and 1805 to 1823).
  - jest-expo runs with no global `Element`, so `isKeyboardFocus` and its test need a
    `typeof Element` guard or a stubbed global.
  - `CourseCard.test.tsx` renders a `Link asChild`. Name `renderRouter` and the wrapper in
    `src/test-utils/providers.tsx`.
  - No existing test renders `expo-image`. Say how `onLoad` and `onError` are fired.
- **readiness-1-15. Two process gaps.**
  - **Staging re-seed.** Item 3 protects staging's demo profiles from the notice command
    only if the seed is re-run there after the migration. Neither the `infra/README.md`
    text in item 22 nor the Verification Plan lists that step.
  - **Checkpoints.** The server PR is one 24-item phase with no intermediate point at which
    it builds. Item 6 makes `CourseView.preview` and `CourseCard.previewUrl` required
    before items 11 and 12 supply them. A suggested commit order would cover it.

### Verified, no finding

- **Schema and migration (items 1 to 3):** `updatedAt` uses `$onUpdate`, so setting it
  explicitly keeps the value; migrations are `<timestamp>_<name>/` folders; the seed has
  exactly two profile inserts and two profile updates.
- **Services (items 10 to 15):** `getProfileAsset` answers 404 or 400 `wrong_kind` as the
  plan says; the learner relations expose what the new service reads and the schema guard
  allows it; the two approve methods have the placement the plan describes;
  `applicationValues` is the single place that sets `appliedAt` for all four application
  paths; `EnrollmentsService` is the only other caller of `toCard`; nothing else constructs a
  `CourseView` or `CourseCard`, so the server PR typechecks without touching `apps/learner`.
- **Storage and mail:** `put`, `delete` and `getUrl` exist; the files route sends the
  immutable header; the task role may delete; `Mailer.driver` exists; Terraform sets the
  console mailer when Resend is off, so the console refusal matters in practice.
- **Tests and tooling:** the test helpers and `describe('catalogue')` exist; every command in
  the Verification Plan exists.
- **Teach, Support, messages, infrastructure and documents:** the Details form is keyed by
  `updatedAt` and takes `locked`; both apply pages have the flex row the plan describes; the
  Terraform pattern exists; every runbook section and README sentence cited in item 22
  exists.

## Codebase-details reviewer

**Status:** completed. 0 Blocker, 6 Major, 7 Nit.

**Coverage:** read in full the persona, the standard, the whole target document, ADR 004 and
ADR 005. Searched the brief, the sibling designs and `docs/spec.md` for the relevant
passages.

**Not checkable** (no `node_modules`): that `@mux/mux-node` 15.5.0 accepts `type: 'gif'`;
that React Native 0.88 exports `FocusEvent`; that Biome 2.6.6 checks Markdown.

**What checked out**

- Every file marked Modify exists, and no file marked Create exists yet.
- About 55 statements about current code were checked against source and none was false.
  Among them: the two approve methods have the structure the plan places `refresh` into;
  `getProfileAsset` answers 404 and 400 `wrong_kind` as stated; the learner relations exist
  and the schema guard does not fire on those keys; nothing calls `storage.delete` today and
  the task role may delete; the Terraform pattern, the message keys, the flex row on both
  application pages, the builder note and the `PATCH courses/:id` row in the role test are
  all as described.

**Overall:** the plan's statements about existing code are accurate. The gaps are in test
infrastructure, the release steps and the verification gates.

### Major

#### codebase-1-1. The video fixture helper is under-specified for the tests that depend on it

- **Scope:** item 16 (lines 1539 to 1543); used by item 17 (1556 to 1604, 1625 to 1628).
- **Discrepancy and rationale:**
  - **Missing required columns.** `media_assets.filename` and `mime_type` are `NOT NULL`
    (`packages/db/src/schema/media.ts` lines 34 to 35). The plan lists kind, provider,
    status, playback ID, length and profile ID only, so the insert fails as written.
  - **Position collision.** The plan puts the video "at position 0" in each lesson.
    Position 0 is already the text item in the first lesson and the quiz in the second
    (`apps/api/test/helpers/test-app.ts` lines 258 to 274). Order then rests on the
    creation-time tiebreak. The plan does not say whether that is intended.
  - **No item title.** The Teach and Support labels are built from it.
  - **Item IDs not returned.** The helper returns "the media rows' IDs". Two tests need the
    video item's ID to call the item routes.
  - **No spare video.** Three tests need a ready Mux video of the profile that is not on
    the course: the 422 case, "A teacher's choice", and the change-set replacement. No
    helper is named for making one.

#### codebase-1-2. The fake video driver can't express a test the plan requires

- **Scope:** item 7 (1359 to 1361) against item 17 (1602 to 1604).
- **Discrepancy and rationale:** "A change during a refresh" needs test code to run while
  `animatedPreview` is being called. The fake has no callback of any kind
  (`apps/api/src/providers/video/fake.ts` lines 10 to 71), and item 7 adds only
  `previewCalls` and `previewMode`. The implementer has to choose between a hook on the fake
  and overriding the method in the test. The plan should name one.
- **Same as readiness-1-10,** rated higher here.

#### codebase-1-3. The learner test harness is not specified, and one case can't run as described

- **Scope:** item 25 (1785 to 1787); item 27 (1810, 1820 to 1823).
- **Discrepancy and rationale:**
  - **No DOM in Jest.** Jest runs the React Native environment. The existing web-file test
    has to install `addEventListener`, `removeEventListener` and `dispatchEvent` on
    `window` by hand (`device-languages-web.test.tsx` lines 13 to 23). `Element` is
    therefore very likely not a global there (read from source, not run).
    - "If it is an `Element`" needs a `typeof Element` guard, or it throws under Jest.
    - The case "returns what an `Element` target's `matches(':focus-visible')` returns"
      needs a stand-in `Element` class installed by the test.
    - The plan names only a fake `matchMedia` and fake timers.
  - **`CourseCard.test.tsx` has no stated harness.** `CourseCard` renders `Link asChild`
    and calls `usePreferences()` and `useTheme()`. The repo has three precedents and the
    plan picks none: explicit provider wrappers (`QuizRunner.test.tsx` lines 52 to 63),
    `TestProviders` (`src/test-utils/providers.tsx`), and `renderRouter`
    (`src/__tests__/sign-in.test.tsx` line 3). Whether `Link` gets a router context or is
    mocked is left to the implementer.
- **Same as readiness-1-14,** rated higher here.

#### codebase-1-4. What the notice command's dry run prints is contradicted inside the document

- **Scope:** item 15 (1496 to 1497, 1523 to 1524) against lines 733 to 734.
- **Discrepancy and rationale:** the feature section says `--dry-run` "prints who would be
  emailed". The plan fixes the return type as three counts and prints "the result as one
  line of JSON". Counts do not show who. The dry run is the rehearsal before real teachers
  are emailed, so the output has to be decided.
- **Same as readiness-1-2.**

#### codebase-1-5. The seed change only works if someone re-runs the seed on staging, and no step says so

- **Scope:** item 3 (1272 to 1275); release order (1217 to 1219); item 22's
  `infra/README.md` content (1730 to 1732); the Verification Plan's staging steps (1864 to
  1868).
- **Discrepancy and rationale:**
  - Item 3 says the update path exists so staging's demo profiles do not stay empty and
    get emailed by the notice command.
  - The seed is a one-off task a person runs by hand (`infra/README.md` lines 303 to 316).
    The Deploy workflow runs only `dist/migrate.js` (`deploy.yml` line 89).
  - No list in the plan includes "re-run `seed --demo` on staging before
    `previews notice`".
  - The staging verification is ambiguous for the same reason. It expects "a course
    approved for a profile that existed before the deploy carries none". That holds for a
    demo profile only if the seed has not been re-run.
- **Same as the first half of readiness-1-15,** rated higher here.

#### codebase-1-6. The stated gates are narrower than what CI enforces

- **Scope:** lines 1209 to 1210; Verification Plan 1842 to 1846; item 21 (1703).
- **Discrepancy and rationale:**
  - **`build` is missing.** CI runs `npx turbo run typecheck test build`, plus
    `npm run check:dupes` and `npx expo-doctor` (`ci.yml` lines 31 to 42). The plan's gate
    for each pull request is lint plus `typecheck test`.
    - Only `build` bundles the new entry `src/previews.ts` into `dist/previews.js`.
    - Only the learner's `build` script exports all platforms
      (`apps/learner/package.json` line 59). The plan runs
      `npx expo export --platform web` alone. The learner PR adds a base and `.web` file
      pair, so the native export is the check that the base file bundles.
  - **Terraform checks are missing.** Any change under `infra/**` runs
    `terraform fmt -check -recursive -diff` and `terraform validate` (`infra.yml` lines 28
    to 40). `COURSE_PREVIEWS` is longer than every key in `api_environment`, so adding the
    line as item 21 describes leaves the block misaligned and fails the format check. The
    Verification Plan lists neither command.

### Nit

- **codebase-1-7. Item 14 names four write sites; the code has one** (lines 1483 to 1485;
  test at 1621 to 1622). All application writes take their values from one private helper,
  `applicationValues` (`profiles.service.ts` lines 228 to 247). "The personal re-application"
  is a branch inside `apply`, not a function. The change is one line in the helper; as
  worded, an implementer may add it in four places. The listed test covers only a first
  personal application.
- **codebase-1-8. The Dockerfile comment is described loosely** (lines 1531 to 1532). The
  header comment names only `dist/server.js` and `dist/migrate.js`; it does not list `seed`
  or `reset-schema`. Adding `previews` to a list that omits the other hand-run commands is
  inconsistent; the plan should give the wording.
- **codebase-1-9. Existing helpers are not mentioned where the plan builds new ones.**
  - **Reduced motion.** The learner app already reads it through `useReducedMotion`
    (`HeroScene.tsx` lines 19 and 149). The plan writes its own `useMediaQuery`. If that is
    deliberate, say so; otherwise the app has two sources for one setting.
  - **Dates in Teach.** `formatDate(iso, options, locale = 'en-SG')` exists and takes a
    time zone (`packages/web-ui/src/components/StatCard.tsx` lines 50 to 57). The builder
    already uses it.
  - **Dates in the API.** The precedent for an `en-SG` date is
    `apps/api/src/lib/certificate-pdf.ts` line 206.
- **codebase-1-10. Small choices left to the implementer** (items 4, 6, 7, 10, 11, 12, 13,
  18). Each is small; together they miss the standard's rule that the plan leaves no
  decisions.
  - Where the optional `fetch` goes: a second constructor parameter or a config field.
  - How the catalog builds the address: `CatalogService` holds only a `MediaService`; item
    10 defines `clipUrl` on the preview service; the feature section names
    `deps.storage.getUrl`.
  - Whether `videosOf` is an instance method or an exported function.
  - Which files declare `CoursePreviewState` and `RefreshOutcome`.
  - **Titles and duplicates in `videos`.** `videosOf` returns no titles, yet the course
    view must fill lesson and item titles. The rule for a media ID on two items is given
    for `resolvePreview` but not for this list, whose entries become option values.
  - Where the preview paragraph sits among the approval email's two existing paragraphs.
  - Teach markup: no checkbox component exists, and no minutes-and-seconds formatter exists
    for "from 0:10".
- **codebase-1-11. The items are not buildable one at a time** (items 6, 11, 12). Item 6
  makes two fields required, and the object literals in `catalog.service.ts` and
  `courses.service.ts` fail typecheck until items 11 and 12. The only checkpoints are the
  two whole pull requests, and the server one spans about 60 files. Say that items 1 to 24
  are not individually committable, or order them so each stops at a passing typecheck.
- **codebase-1-12. A short window where the date is stamped without the sentence on screen**
  (release order; item 14). A deploy rolls the API first and uploads the web apps
  afterwards. In between, and for any browser holding the old Teach code, an application
  reaches the new API from a page without the new sentence and still gets a preview date.
  The window is minutes. Record it as accepted. (The Stage 7 design reviewer raised the same
  gap as design-1-7 and proposed a marker on the request.)
- **codebase-1-13. "Biome, which also checks this document" could not be confirmed** (line
  1845). `biome.json` has no Markdown section, and `ignoreUnknown: true` skips file types
  Biome does not handle. Confirm in a checkout with dependencies, or drop the parenthesis.

## Summary of round 1

| Reviewer                 | Status    | Blocker | Major | Nit |
| ------------------------ | --------- | ------- | ----- | --- |
| Implementation readiness | completed | 0       | 4     | 11  |
| Codebase details         | completed | 0       | 6     | 7   |
| Style                    | completed | 0       | 4     | 14  |

Fourteen Major findings in all. Four pairs are the same issue raised by two reviewers
(the dry run's output; the fake driver's missing hook; the learner test harness; the staging
re-seed), though the readiness reviewer rated three of those as nits. The round is not
clean.

Majors here that repeat an earlier stage:

- readiness-1-1 is design-1-1 from Stage 7 (the off switch and "Make clip" refused when the
  chosen video has left the course).
- readiness-1-3 is Z4 from Stage 5 and design-1-4 from Stage 7 (check Mux first).

Neither reviewer of the code found a false statement about existing code.
