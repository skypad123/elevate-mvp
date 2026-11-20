# Stage 5: Initial Zoom Out Review

- **Target:** `docs/designs/learner-hover-preview.md`, full file (lines 1 to 1877)
- **Date:** 2026-11-19
- **Reviewers:** `egm-zoom-out` (completed), `egm-inventive-catalyst` (see Part 2)
- **Reading list given to both:** the brief, `learner-chinese.md`, `learner-teach-banner.md`,
  ADR 004, ADR 005, `docs/spec.md`

## Part 1: Zoom-out reviewer (scope and simplicity)

**Verdict:** changes requested. 0 Blocker, 4 Major, 7 Nit.

**Review completeness**

- Read in full: the persona, the zoom-out standard, the target, the brief, ADR 004, ADR 005
  and `docs/spec.md`.
- Read in part: `learner-chinese.md` and `learner-teach-banner.md`, lines 1 to 140 each
  (overview through non-goals). The target says it does not depend on either.
- Code searches were run under the codebase root for every new helper the design proposes.

**Overall judgment**

- Context sufficiency passes. The objective and motivation are clear (lines 9-88).
- The design does not meet the "simplest possible way" bar. The build is seven columns, two
  new services, three CLI commands, a provider method on three drivers, the first outbound
  HTTP fetch and first storage deletions in the API, a Terraform variable through six files,
  a new ADR and about 30 integration cases.
- The design itself states the value is small: desktop hover only, a pilot with "a handful
  of teachers", most learners on phones, and no way to measure use (lines 84-88, 128-130).
- The decision to build is the author's (brief decisions 5 and 9) and the reviewer does not
  reopen it. The four Majors are places where the size can come down without giving up the
  feature.

### Major

#### Z1. The stored clip rests on a cache that does not exist

- **Affected scope:** Overview item 2 (lines 21-23), Goal 5 (115-117), "Making the clip"
  (457-534), "The catalog" (565-585), Alternative D (890-902).
- **Rationale:**
  - The stored-clip pipeline is the source of most server complexity, and its main stated
    reason is a cache that does not exist.
  - Lines 900-902 admit this: "the catalog is not cached today, so the brief's caching
    reason is about a later cache; consent and a lasting address are the reasons that
    stand now." Consent is the same under either approach, and a lasting address matters
    only for that future cache. That is premature optimisation under standard section 2.
  - Alternative D (sign an animated-image token in the catalog response) would remove:
    - `animatedPreview` with its timeout, content-type and size checks;
    - the storage write and the first deletions in the codebase;
    - the source record (two columns), the guarded `UPDATE` and the `updated_at` pin;
    - the staleness check in the catalog, the `pending` state and "Make clip";
    - the backfill as a repair tool;
    - up to 10 seconds added to three request paths;
    - the "Clips load the API" risk (line 822), because Mux would serve the image, not
      the single API task.
  - Exposure is the same: the token carries start, end and width as claims, so it unlocks
    only those 4 seconds.
  - Costs of D that the document should weigh honestly:
    - a heavier catalog query (live items plus media, to pick the video);
    - one local signature per card;
    - addresses that change per token, which hurts browser caching;
    - turn-off takes effect at token expiry, not at once;
    - Mux's billing for image delivery, which the reviewer did not check.
- **Requested change:** put D against the stored clip to the author again with this cost
  comparison, or give a present-day reason for the stored clip that does not rest on the
  future cache.

#### Z2. A permanent per-profile date for a one-time rollout

- **Affected scope:** Goal 2 (102-104), `profiles.previews_allowed_at` (414-418), "Existing
  teachers: the notice and the backfill" (717-746), items 3, 14, 15 and 16 (1264-1276,
  1478-1545), Alternative M (982-990).
- **Rationale:**
  - A permanent column and a permanent gate in `refresh` are built for a one-time rollout
    to a handful of profiles.
  - What the per-profile date adds:
    - a column on `profiles`;
    - the `waiting` outcome and the `waiting` state with two sentences;
    - `allowedFrom` in `CourseView`;
    - writes in four application paths and seed changes in four places;
    - Singapore date formatting;
    - the tests for the wait.
  - The design already has a global gate that can do this job: `COURSE_PREVIEWS`
    (750-753). Deploy with it off, tell the existing teachers, switch it on 14 days later,
    then run the backfill. No course gets a clip in the window, including one Support
    approves for an existing teacher, which is the case Alternative M was rejected over.
  - Cost: teachers who apply in those 14 days also wait, which harms nobody.
  - `previews notice` is a run-once command with a dry run, a console-mailer refusal,
    partial-failure rules and five test cases, for an audience the document calls a
    handful. `docs/spec.md` names three to five pilot teachers. A hand-sent email covers
    it.
- **Requested change:** drop the preview date and use the global switch as the rollout gate,
  or state why a per-profile date is needed after the first 14 days. Justify the notice
  command against the real number of existing profiles.

#### Z3. The video and start-second picker goes beyond what consent needs

- **Affected scope:** "The rule for what the clip shows" (429-455), "The control in Teach"
  (627-694), `preview_media_id` and `preview_start_seconds` (408-409), item 12 (1429-1460).
- **Rationale:**
  - With on by default, the smallest control that honours consent is an off switch. The
    video and start-second picker adds a lot on top of it:
    - two columns and the clamping rule;
    - the fallback for a chosen video that has left the course;
    - three-step server validation with a new 422 code, for a case the document says the
      UI cannot produce (667-668);
    - the `videos` array and `resolved` in `CourseView`;
    - an extra live-rows query in the writer's draft view (1436-1440);
    - much of the seven-state table.
  - The picker is also what creates the Mux per-asset limit risk (line 820).
  - The brief's decision 9 does ask for the teacher to pick the seconds, so this is the
    author's call. But that decision was written for an opt-in model. Under on by default
    the picker is an enhancement, not the consent mechanism.
- **Requested change:** consider shipping the default clip plus an off switch first, and
  adding the picker when a teacher asks. If the picker stays, the document should say why the
  off switch alone is not enough for the pilot.

#### Z4. Two facts that decide whether the feature works are checked after the build

- **Affected scope:** Questions 9 and 10 (174-182), "Checks before the server PR merges"
  (780-792), item 24 (1751-1757).
- **Rationale:**
  - Question 10: nobody has made the one Mux call the design depends on. Line 792 says
    that if it fails, "the design does not work as written and comes back for revision."
    The check is gated on merge of the server PR, after 24 items are built.
  - Question 9: whether staging and production run Mux is unknown. Both
    `terraform.tfvars.example` files have `mux = false`, and with it off no clip is ever
    made.
- **Requested change:** make the real Mux call and the Question 9 answer preconditions of
  approving the design, or step 0 of the plan, not merge gates.
- **Related slip:** item 24 says "the three checks" (line 1755) but the section lists four
  (784-790).

### Nit

- **Z5. The catalog reads every live item on every request** ("The catalog", 570-579; risk
  row, 833). The public list, the busiest endpoint, now loads every live item of every
  course to cover a rare event: an owner removing the previewed video from a live course.
  The author accepted this with Question 1. It sits oddly beside Goal 5's cacheability
  claim, and it disappears under Z1.
- **Z6. Pinning `updated_at` is a workaround** (531-534, 672-674, Alternative T at
  1055-1062). It exists because system-written state sits on the `courses` row. The standard
  prefers a structural fix. If Z1 to Z3 shrink the system-written columns, this may vanish.
  Otherwise say why the workaround beats the separate table.
- **Z7. `previews count` is a command, a service method and a test for one `count(*)`**
  (Goal 9 at 128-130; 737; 1519-1520), serving a goal the document says cannot show whether
  the feature works. `previews backfill` already prints a tally per outcome. Drop `count`, or
  fold the number into the backfill's output.
- **Z8. The 12-second cap is unexplained** (Goal 1 at 94-95; "Stopping" at 613-616; item 25
  at 1779-1784). It adds a second timer, state and tests. It is not in the brief and the
  document gives no reason for it. Moving the mouse or focus away already stops the clip.
  Justify it or drop it.
- **Z9. Following both media queries live is polish with no stated need** ("Who gets it" at
  602-605; item 25 at 1775-1778). No `useMediaQuery` hook exists in the repo, so the new hook
  duplicates nothing. For reduced motion, `HeroScene.tsx` (line 149) already uses
  reanimated's `useReducedMotion`; reusing it would match the existing pattern, at the cost
  of not following a change live.
- **Z10. Two overlapping lists of states** (outcomes table at 483-494; states table at
  641-651; `previewState` at 1300-1306). Eight refresh outcomes and seven view states share
  `not_live`, `paused` and `waiting`. Most of the spread comes from the preview date and the
  picker, so Z2 and Z3 would cut both.
- **Z11. The architecture section drops into code-level detail** (mainly "The learner card"
  at 587-625 and "Making the clip" at 522-534): the run-time `Element` check on the focus
  target, the dropped function-valued `style` under `Link asChild`, Drizzle's on-update
  behaviour, and the exact `WHERE` of the guarded update. These belong in the Detailed
  Implementation Plan, which already repeats most of them. The document is 1,877 lines with
  30 alternatives for a hover effect; that length hides the four decisions that matter.

### Reuse checks that held (no finding)

- `storage.delete` and `storage.put` exist on all three storage drivers, and nothing calls
  `delete` today, as the document says.
- `jwt.signPlaybackId` is already used for thumbnails in
  `apps/api/src/providers/video/mux.ts` (lines 86-91).
- `ownerAndManagerEmails`, `getProfileAsset` with a `kind` option, and `simpleEmail` all exist
  and are reused as described.
- No `fetch(` call exists under `apps/api/src`, so "the API's first plain HTTP request" is
  accurate.
- The `.web.tsx` split matches five existing web-only files in `apps/learner/src`.
- The new `previews.ts` entry follows the existing `seed.ts` and `migrate.ts` entries in
  `apps/api/tsup.config.ts`.

## Part 2: Inventive catalyst (compromises accepted too early)

**Result:** 3 Major, 2 Nit. All findings are advisory.

**Review completeness**

- Read in full: the persona, the zoom-out standard, the target, the brief, ADR 004, ADR 005
  and `docs/spec.md`.
- Read in part: `learner-chinese.md` and `learner-teach-banner.md`, first 260 lines each.
- Code spot-checked: `apps/api/src/routes/teach.ts`, `catalog.service.ts`,
  `courses.service.ts`, `routes/files.ts`, `providers/storage/types.ts`,
  `apps/teach/src/routes/courses/builder.tsx`,
  `packages/web-ui/src/components/MediaPreview.tsx`,
  `infra/terraform/modules/environment/iam.tf`.

**Examined and found balanced (no finding)**

- **A fetched clip can't be recalled** (lines 527-530, 846-847). A real limit, not a
  compromise. The unique key per clip already limits the exposure to copies already
  delivered.
- **Nothing downloads before the 400 ms timer** (606-612). Prefetching would break Goal 4.
- **Clips served through the single API task, no CDN** (822). At pilot scale the bottleneck
  is unproven, and `S3_PUBLIC_BASE_URL` keeps the exit open.
- **The off switch as an environment variable** (360-362, Alternative AD). Minutes to switch
  off is proportionate, and a per-course off exists.
- **Approvals awaiting Mux** (563, 821). Bounded at 10 seconds on a rare staff action.
- **Columns on `courses`, three call sites, a pure rule in `packages/core`.** Coherent.

### Major

#### C1. Clip freshness is traded against call sites, when the client already has the signal

- **Affected scope:** "When the clip is made" (536-563); Question 1 (186-194); Alternatives P
  and Q (1014-1032); risk rows "A course sits without a clip" (818) and "The backfill is
  forgotten" (830); CUJ 7 and CUJ 8.
- **The compromise:**
  - All three options weighed (eleven call sites, a scheduled task, three sites plus a
    manual button) assume the trigger must live on the server.
  - The accepted cost is a clip that stays missing after a direct live edit, after a Mux
    failure at approval, or after the preview date passes, until someone presses "Make
    clip" or remembers the backfill. Line 818 says "nothing reminds anyone to".
  - The signal already reaches the right client. Every curriculum mutation route in
    `apps/api/src/routes/teach.ts` (lines 339-504) returns the course view. Under this
    design that view carries `preview.state`, so the response to the edit that made the
    clip stale already says `pending`, to an owner or manager who may edit the live course.
- **Proposed resolution:** keep the catalog check as the safety rule and let the Teach
  builder supply the trigger. When the builder holds a live course whose state is `pending`
  and the person may edit live, it sends the existing "Make clip" request itself, on load and
  after curriculum edits settle. No server call site, scheduler or route is added, and the
  work stays inside a request. It also heals CUJ 8 and the forgotten backfill for any teacher
  who opens the builder. The button and the backfill remain as fallbacks.
- **Secondary costs:**
  - **Form reset.** The Details form is keyed by `updatedAt`. An unprompted save bumps it
    and would drop unsaved details edits. Either the client must not fire while that form
    has unsaved edits, or the save must skip the row write when no setting changed.
  - **Mid-edit churn.** Deleting video A before uploading its replacement can publish a
    clip from the next default video for some minutes: two Mux renders against the
    per-asset limit, and footage the teacher did not pick is briefly public.
  - **Retry bound.** A persistent Mux failure needs a limit, or every builder load costs a
    10-second request.
  - **Coverage gap.** It fires only while an eligible person has the builder open. Dormant
    courses still need the backfill.
  - **Untested logic.** The logic lands in a client with no component tests.

#### C2. A failed delete breaks the withdrawal promise, and nothing can retry it

- **Affected scope:** `refresh` steps 4, 8 and 9 (504-520); "The first deletions in the
  codebase" (527-530); risk row "A stray public file" (828); Goal 2 (105-108); Question 6
  (214-216).
- **The compromise:**
  - A failed delete is only logged (519-520). Step 4 clears `preview_key` before deleting
    the file, and step 9 deletes after the pointer has moved. If the delete fails, the
    database no longer holds the old key and no later refresh can retry it.
  - Line 828 accepts stray files because "the file is at an address nobody was given".
    That holds for a file written when the update then fails. It does not hold for a
    failed delete: that address was served to every Explore visitor.
  - The result is paid footage the teacher turned off or replaced, permanently fetchable.
    Question 6 rejected exactly this outcome as "against Goal 2".
  - No test in item 17 covers a failed delete.
- **Proposed resolution, in two separable parts:**
  - **Keep the handle until the delete succeeds.** In step 4, first clear the source record
    with the guarded update, so the catalog hides the clip at once. Then delete the file,
    and only then empty `preview_key`. A failed delete leaves the key in place and the next
    refresh retries. Deleting a missing object is already harmless in all three drivers.
  - **A sweep in the backfill.** Keys are already grouped per course
    (`public/previews/<courseId>/`). The backfill can list that prefix and delete every
    object that is not the current `preview_key`. This also covers replaced clips in step 9
    and files written when the update fails. The task role already has `s3:ListBucket`.
- **Secondary costs:**
  - Part one adds an in-between state (key set, source record empty). `previewState`, the
    catalog rule and `previews count` must all treat it as "no clip".
  - A bare reorder is unsafe: deleting first and then running the single guarded clear can
    leave a dead pointer that reads as `unchanged` if the teacher re-enables the preview in
    between.
  - Part two needs a new `list(prefix)` method on `StorageProvider`, across three drivers.
  - The sweep can race a refresh and delete a file that has been written but not yet
    pointed at, so it needs a minimum-age threshold.
  - Repair stays manual: it runs only when a person runs the backfill.

#### C3. The only per-course notice arrives after the footage is public

- **Affected scope:** CUJ 3 (255-264); the approval email (1468-1472); risk rows at 816-817;
  Alternatives I, J and R; "Support's review page" (696-702).
- **The compromise:**
  - Per-course consent was rejected because few cards would get clips, so on by default
    relies on the agreement sentence plus the approval email. That email is sent once the
    clip is already public and can't be recalled.
  - Line 817 accepts "ten seconds in is a title card, or content the teacher would not give
    away" as unavoidable.
  - Support's review page is given the resolved video and second before approval. The
    teacher's own submit step is not.
  - Alternative R was rejected over the stored file, but showing the teacher the resolved
    seconds needs no file.
- **Proposed resolution:** show the resolved preview on the builder's "Review & submit"
  panel, using the `preview.resolved` and `videos` fields the design already adds: "Public
  hover preview: 4 seconds of <lesson>: <item>, from 0:10", with a link to the Details
  control. On by default stays and no consent step is added. The notice moves to the one
  deliberate act that comes before exposure.
- **Secondary costs:**
  - One more English-only line in the builder, in a portal with no component tests.
  - The submitter may be a writer, so the owner may still not see it.
  - It informs but records nothing; it is not evidence of consent.
  - It does nothing for existing teachers' already-live courses.
  - The resolved pick can change between submit and approval if content is edited after a
    rejection.

### Nit

#### C4. Choosing a moment is coupled to publishing it

- **Affected scope:** "The control in Teach" (627-640); CUJ 4 (266-273); risk row "The
  per-asset limit is reached" (820); decisions 2 and 3 (354-357).
- **The compromise:** on a live course, the only way to see a candidate moment is to save.
  Each trial is a 1 to 6 second wait, a Mux render counted against the per-asset limit, and
  footage that is public at once. On a draft course the teacher sees no picture at all before
  approval.
- **Proposed resolution:** separate choosing from rendering by embedding the shared signed
  player (`MediaPreview`) in the preview card, with a "use current time" action that fills
  the start field. Mux is then asked for a clip only on a deliberate save. This works on
  drafts too.
- **Secondary costs:** the shared component must expose the player's current time, an API
  change in a package Support also uses (not verified by the reviewer). The Details tab gets
  heavier. Playback tokens are minted on that tab. The scrubbed frame is not the rendered
  clip, so the stored clip is still needed for confirmation.

#### C5. Pinning `updated_at` can move it backwards

- **Affected scope:** "System writes keep the course's `updated_at`" (531-534) and its test
  (1598-1599).
- **The compromise:** the refresh sets `updated_at` to the value read in step 1. That read
  can be up to 10 seconds old by step 8, and the guard in step 8 covers only the key and the
  three setting columns. A title or price save that lands during the Mux fetch has its
  `updated_at` rolled back. That mis-sorts the Teach and Support lists and changes the
  Details form's key, which is the reset the workaround exists to prevent.
- **Proposed resolution:** assign the column to itself in SQL (`SET updated_at = updated_at`)
  instead of to the value read. It can't move the value backwards. The structural alternative
  is Alternative T (a `course_previews` table).
- **Secondary costs:** a raw SQL expression in a Drizzle `set`; the reviewer did not verify
  that the on-update default is skipped for an explicit SQL value, so a test must confirm it.

## Where the two reviewers pull in different directions

The reports were written independently and are not reconciled here.

- **Size of the control.** Z3 asks to cut the picker to an off switch. C4 asks to add a video
  player to the picker.
- **The stored clip.** Z1 asks to reconsider storing a clip at all. C2 and C5 ask to make the
  stored-clip mechanics stricter.
- **Rollout.** Z2 asks to remove the per-profile date and the notice command. C3 asks to add
  a notice at submit.

The findings that do not depend on which direction is taken are Z4 (check Mux first), C2
(a failed delete can't be retried) and C5 (`updated_at` can move backwards).
