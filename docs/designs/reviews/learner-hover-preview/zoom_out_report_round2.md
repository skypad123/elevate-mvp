# Stage 5: Initial Zoom Out Review (round 2)

- **Target:** `docs/designs/learner-hover-preview.md`, full file (lines 1 to 2309)
- **Date:** 2026-11-19
- **Round:** 2. Round 1 reviewed an earlier version of 1,877 lines; its reports are in
  `docs/designs/reviews/learner-hover-preview/`. Neither reviewer was given them.
- **Reading list given to both:** the brief, `learner-chinese.md`, `learner-teach-banner.md`,
  ADR 004, ADR 005, `docs/spec.md`

## Reviewer Status

| Reviewer                 | Status    | Findings                  |
| ------------------------ | --------- | ------------------------- |
| `egm-zoom-out`           | completed | 0 Blocker, 5 Major, 4 Nit |
| `egm-inventive-catalyst` | completed | 0 Blocker, 3 Major, 2 Nit |

Both reviewers report that they read the target in full, all six reading-list files, their
persona and the zoom-out standard.

## All findings by severity

Total: 0 Blocker, 8 Major, 6 Nit.

| ID  | Severity | Finding                                                                                                             | Reviewer                 |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Z1  | Major    | Store-once architecture is justified by a speculative goal                                                          | `egm-zoom-out`           |
| Z2  | Major    | The video and start picker is the largest complexity driver and no longer carries consent                           | `egm-zoom-out`           |
| Z3  | Major    | The allowance counter guards a limit the document's own calls never observed                                        | `egm-zoom-out`           |
| Z4  | Major    | The architecture section is written at implementation altitude, duplicated in the plan, and the copies have drifted | `egm-zoom-out`           |
| Z5  | Major    | The reach does not match the stated root problem, and nothing can show whether it worked                            | `egm-zoom-out`           |
| C1  | Major    | "Hidden" is not "gone": the file route keeps serving clips the design calls switched off or removed                 | `egm-inventive-catalyst` |
| C2  | Major    | Detection is automatic; repair is manual and nobody is reminded                                                     | `egm-inventive-catalyst` |
| C3  | Major    | The teacher learns what is public after it is public; Support sees it before                                        | `egm-inventive-catalyst` |
| Z6  | Nit      | The global `COURSE_PREVIEWS` switch                                                                                 | `egm-zoom-out`           |
| Z7  | Nit      | Two of the three commands are speculative                                                                           | `egm-zoom-out`           |
| Z8  | Nit      | The catalog check is a read-path workaround for unhooked writes                                                     | `egm-zoom-out`           |
| Z9  | Nit      | Small reuse and minimalism points in the learner card and service                                                   | `egm-zoom-out`           |
| C4  | Nit      | The allowance is treated as scarce for life, yet several paths spend it on bytes that are thrown away               | `egm-inventive-catalyst` |
| C5  | Nit      | The named CDN escape hatch contradicts the takedown guarantee                                                       | `egm-inventive-catalyst` |

## Overlaps between the two reviewers

The findings below are kept separate because the reviewers reached different conclusions or
gave different severities. Severities are as each reviewer gave them.

- **Z3 and C4, the per-video count.** Both say the 10-second steps already keep the number of
  different clips inside the allowance. Z3 asks to drop the count until Mux is seen to refuse.
  C4 asks to keep fetched clips in a private copy so that a repeat costs no fetch, which also
  removes the count.
- **Z8 and C1, a video taken off a live course.** Both point out that the edits that can do
  this are in one file, `courses.service.ts`, and that hiding and deleting a clip needs no call
  to Mux. Z8 (Nit) would replace the catalog's read-time check with it. C1 (Major) would keep
  the catalog check as a safety net and add the delete, because today the file stays public.
- **Z6 and C1, the global switch.** Z6 says the switch is not a takedown. C1 confirms it in
  code and proposes that the file route refuse the `public/previews/` prefix while the switch
  is off.

## Claims checked by the main session

These were checked against the design and the code after the reviewers returned. Nothing else
in this report has been checked.

- **Z4, "seven outcome names": confirmed.** Line 1705 says "the union of the seven outcome
  names". Lines 560, 1706 and 1830 say eight. Eight is the number in the design.
- **Z4, "five departures" against two: confirmed.** Line 40 says the design departs from the
  brief in five ways. The Records entry for the brief (lines 951 to 952) names two.
- **Z1, a rate limiter exists: confirmed.** `rateLimit` from
  `apps/api/src/middleware/rate-limit.ts` is used on public routes in
  `apps/api/src/routes/checkout.ts` and `apps/api/src/routes/certificates.ts`.
- **C1, the file route serves any `public/` key: confirmed.**
  `apps/api/src/routes/files.ts` checks only that the key is safe and public, then serves it.

## Part 1: Zoom-out reviewer (scope and simplicity)

**Verdict:** no Blockers, 5 Major, 4 Nit. The reviewer says the design passes on context and
fails at Major level on speculative features and on altitude. It notes that most Major items
are decisions the author made and the document records, and that it flags them because the
document's own evidence argues against them.

### Z1. Store-once architecture is justified by a speculative goal - Severity: Major

**Affected scope:** Goals, Goal 5 (lines 117-119); Non-Goals (163-164); Alternatives D and E (1034-1055); "Making the clip" (642-645); Risks (966)

**Simplicity rationale**

- Goal 5 says the response stays the same "so it can be cached later without change", while server-side caching is a Non-Goal. That is a requirement written for a future feature.
- Alternative D concedes this: "the brief's caching reason is about a later cache; consent and a lasting address are the reasons that stand now" (1044-1046). The document does not explain how consent differs between a stored file and a token fixed to the same seconds. A lasting address matters only for caching.
- This one choice produces most of the machinery: the first storage deletions in the codebase, the nine-step refresh, stray files, the backfill, the catalog staleness check, and clips streamed through the single API task.
- Alternative E is rejected because "a public endpoint needs rate limiting". The codebase already has that: `rateLimit` in apps/api/src/middleware/rate-limit.ts, used on public routes in `routes/certificates.ts` and `routes/checkout.ts`.
- Present-day reasons for store-once do exist in the document's own measurements: a cold Mux render took 2.0-4.4 s (200-204), and Mux's limit behaviour is unknown. They are not the reasons given.
- Ask: state the present-day reasons and drop the "cached later" clause, or re-weigh D and E against the real cost.

### Z2. The video and start picker is the largest complexity driver and no longer carries consent - Severity: Major

**Affected scope:** Overview item 3 (24-28); Goal 2 (106-110); Non-Goals (146-147); data model (475-476); "The rule for what the clip shows" (508-529); "The control in Teach" (753-834); Alternatives AE and AF (1334-1355); plan items 6, 12, 17 (1638-1641, 1771-1800, 2001-2058)

**Simplicity rationale**

- With on-by-default, "the agreement in Goal 2 stands in for a per-course choice" (146-147). Control then needs only the off switch.
- The picker alone brings:
  - two setting columns;
  - three-step validation with a bespoke 422 code;
  - the stale-choice rules, which took an open question and two alternatives;
  - `allowedStarts`, and the `videos[]`, `starts` and `changesLeft` payload;
  - an extra live-rows query for the writer's draft view;
  - the "Save preview" versus "Make clip" button table;
  - the replacement path (step 8) and its risk row (973);
  - the limit apparatus in finding 3, because only repeated changes approach a limit.
- A first version with the default clip and an off switch is additive-compatible; the picker can come later without a dead end.
- The brief's decision 9 does include the picker, so this is the author's call. The design already departs from decision 9 in five other ways.

### Z3. The allowance counter guards a limit the document's own calls never observed - Severity: Major

**Affected scope:** Question 13 (178-191); Question 10 items 4-6 (207-213); `media_assets.preview_fetches` (481-488); allowance rule (517-522); `limit` outcome and state (570, 596-603, 779); Risks (964); Alternatives AJ and AK (1392-1414); plan items 2, 4, 10, 14, 16, 17 (1531, 1575-1580, 1720-1723, 1837-1839, 1940-1946, 2032-2034)

**Simplicity rationale**

- 59 clips were fetched from one 60-second video without reaching the limit, and repeats came from Mux's cache.
- The step rule already caps distinct clips at the allowance by construction (517-520).
- A Mux refusal is already handled: a non-200 answer becomes `null`, the outcome is `failed`, and the stored clip keeps showing (552-553, 599-600).
- The counter adds a column on a second table, an outcome, a state, a view field, a UI line and tests.
- It creates a permanent, self-imposed lockout: turning a preview off and on ten times uses up a short video for life (964).
- `previews check` spends the allowance (1837-1839), and the count is admitted to be inexact (603).
- If Mux says the limit is not enforced, "changing constants" (190-191) leaves the column, outcome and state behind.
- Ask: keep the 10-second step and drop the counter until a refusal is actually seen.

### Z4. The architecture section is written at implementation altitude, duplicated in the plan, and the copies have drifted - Severity: Major

**Affected scope:** Technical Plan (573-650, 713-751, 793-816) against the Detailed Implementation Plan (1699-1736, 1753-1801, 2161-2193); Open Questions (169-304); Alternatives Considered (993-1414)

**Simplicity rationale**

- The architecture section holds code-level detail: sub-step guards, the `updated_at = updated_at` Drizzle trick, `Link asChild` dropping a function-valued style, the run-time `Element` check, and per-branch HTTP codes.
- The same content is restated in the implementation plan, and the two already disagree:
  - line 1705 says "the union of the seven outcome names"; lines 560, 1706 and 1830 say eight;
  - line 40 says five departures from the brief; the Records section (951-952) lists two.
- Open Questions says "None" and then carries about 130 lines of decision history, including withdrawn answers (285-292).
- Alternatives lists 37 entries (A to AK), including designs already removed (L, M).
- The gate text "no code is written until the checks are made" appears three times beside "made on 2026-11-19" (893-894, 912-936, 1491-1514).
- A fresh reader has to dig the interface-level design (data model, the refresh contract, the catalog field, card behaviour) out of 2,309 lines.
- Ask: keep the architecture section to interfaces and data flow, state each rule once, and move the decision history to an appendix or the ADR.

### Z5. The reach does not match the stated root problem, and nothing can show whether it worked - Severity: Major

**Affected scope:** Overview (50-51); The Problem (58-63, 84-88); Goal 9 (130-132); Non-Goals (136-142); Risks (979); Measurement (2302-2303)

**Simplicity rationale**

- The root problem is "a visitor can't see any teaching before paying".
- The design builds the expensive part (a public pipeline for paid footage, a change to the agreement, the first storage deletions) and connects it to the smallest surface: desktop hover only. The document itself says most learners are on phones.
- The course page, where the purchase decision is made, is a Non-Goal.
- The brief asked each design for a success measure; this one drops it. Goal 9's count "can't show whether learners use the preview".
- docs/spec.md sets the MVP goal as proving the money loop; this feature is in none of its 15 build steps.
- The author made this decision in the brief (decisions 5 and 9). The proportionate response is the thin version in findings 2 and 3.

### Z6. The global `COURSE_PREVIEWS` switch - Severity: Nit

**Affected scope:** Goal 8 (127-129); drafting decision 5 (427-429); refresh step 5 (592, 631-633); "Configuration and turning it off" (876-889); Risks (973); rollback (985-989); plan item 20 (2096-2114)

**Simplicity rationale**

- The spec puts feature flags out of scope.
- The switch costs a `paused` outcome and state, an ordering constraint (retire before paused), six Terraform files, and a documented wrong behaviour: a clip changed while paused shows its old version again when previews are switched back on.
- It is not a takedown: stored files stay public at their addresses.
- It takes "minutes, not seconds" and needs AWS access, which is about what a revert of the learner PR costs (985). The banner design used a revert as its off switch.

### Z7. Two of the three commands are speculative - Severity: Nit

**Affected scope:** "The commands" (862-874); plan item 14 (1820-1855)

**Simplicity rationale**

- `previews count` serves Goal 9, which the document says decides nothing. The backfill's outcome counts, or one SQL query, give the same number.
- `previews check` exists for a hypothetical SDK upgrade or shape change. It repeats the throwaway script from item 1 and spends the allowance.
- `backfill` is the only one with a present need.

### Z8. The catalog check is a read-path workaround for unhooked writes - Severity: Nit

**Affected scope:** "When the clip is made" (671-682); "The catalog" (686-711); Risks (978); Alternative P (1166-1175)

**Simplicity rationale**

- Every public catalog page, for every visitor including phones, now loads all live items of 12 courses to cover a rare write.
- Code check in apps/api/src/services/courses.service.ts: outside change-set approval, only `removeLesson`, `updateArtefact` and `removeArtefact` can take a video off a live course.
- A database-only "hide" at those three sites, with no Mux wait, would meet Goal 7 without touching the hot path. The "about eleven call sites" figure is for keeping the default current, which this design does not do anyway.
- The document's fail-safe argument (a future edit path that forgets the call) is legitimate. Either way the file stays public until the next refresh, so the check hides only the address.

### Z9. Small reuse and minimalism points in the learner card and service - Severity: Nit

**Affected scope:** "The learner card" (728-731); plan item 23 (2176-2182); item 25 (2231-2236); item 10 (1729-1731)

**Simplicity rationale**

- The `useMediaQuery` hook with live `change` listeners: reading `matchMedia(...).matches` when the 400 ms timer fires is always current and needs no hook, listener or change-event tests. No such hook exists in the repo today, so nothing is being reinvented.
- `CoursePreviewService.clipUrl` repeats what `MediaService.publicUrl` does (apps/api/src/services/media.service.ts:277-282).
- `formatPreviewStart`: no m:ss helper exists in core, web-ui, Teach or Support, so a core helper is fine. Two inline copies exist in the learner app (`components/media/AudioArtefact.tsx:21`, `components/QuizRunner.tsx:248`) and could adopt it.

### Reuse the design gets right (no finding)

Confirmed by the reviewer's code search:

- `storage.delete` exists on all three storage drivers and has no caller.
- `jwt.signPlaybackId` is already used for thumbnails in `apps/api/src/providers/video/mux.ts:86-91`.
- `media.getProfileAsset(..., { kind })` is the cover image's check (`courses.service.ts:442`).
- The `.web.tsx` split is an existing convention (five files under `apps/learner/src`).
- `apps/api/src/seed.ts` is the precedent for a one-off entry.
- The storage-key-on-row pattern matches `certificates.pdfStorageKey`.
- `CatalogService.list` loads only `liveLessons: { columns: { id: true } }` today, as the design says.

**Files the reviewer read in full:** the persona (agents/zoom_out.md); the standard (resources/document_standards/zoom-out-standard.md); the target learner-hover-preview.md (all 2,309 lines); learner-main-page-improvements.md; learner-chinese.md (all 1,881 lines); learner-teach-banner.md (all 1,290 lines); docs/adr/004-media-mux-and-storage.md; docs/adr/005-aws-hosting-and-environments.md; docs/spec.md; plus the code files apps/api/src/services/catalog.service.ts, apps/api/src/providers/video/mux.ts and apps/learner/src/components/CourseCard.tsx. Other code was checked by search only.

## Part 2: Inventive catalyst (trade-offs presented as unavoidable)

**Verdict:** no Blockers, 3 Major, 2 Nit. The reviewer says the base design (a clip made
once, stored under a key that never changes, a plain address, and a check when the catalog is
read) resolves the brief's main contradiction. It says five accepted trade-offs are presented
as unavoidable and are not. All five are advisory.

### C1. "Hidden" is not "gone": the file route keeps serving clips the design calls switched off or removed - Severity: Major

**Affected scope**

- Goals 7 and 8 (lines 123-129)
- CUJ 7 (lines 359-372)
- "When the clip is made" (lines 671-682)
- "Configuration and turning it off" (lines 878-882)
- "Rollout and rollback" (lines 986-989)
- Alternative P (lines 1166-1175)
- Future Improvements (lines 1445-1448)

**False compromise:** the design offers only two positions.

- Accepted: a clip that is hidden stays publicly fetchable at its old address until a person triggers a refresh. This covers a clip hidden by `COURSE_PREVIEWS` off and a clip whose video the owner deleted from the live course.
- Deferred: the file route runs a database query on every clip request.
- I confirmed `apps/api/src/routes/files.ts` serves any `public/` key unconditionally, so the global switch stops advertising clips but does not stop serving them.
- Goal 7's title ("A clip never outlives its video on the course") overstates what happens: the file does outlive it.
- Alternative P was rejected because "every such edit can wait on Mux" and "about eleven call sites". Neither holds for the retire half of `refresh`, which needs no Mux.

**Proposed resolution:** Segmentation, in two parts.

- Split `refresh` into its Mux-free retire half (hide, delete, forget) and its fetch half. Run only the retire half after direct live-content edits, with one new branch: "source media no longer on the live course: hide, delete, forget, stop".
- Those edits are confined to one file. `addLesson`, `removeLesson`, `addArtefact`, `updateArtefact`, `removeArtefact` and the reorder methods are all in `apps/api/src/services/courses.service.ts`, and `apps/api/test/schema-guard.test.ts` allows only that file and `change-sets.service.ts` to touch the raw content tables.
- Keep the catalog check as the safety net. A forgotten call site then degrades to today's design, not to a leak.
- For the global switch, have the file route refuse the `public/previews/` prefix while `COURSE_PREVIEWS` is off. That is an environment read, not a database query.

**Secondary liabilities**

- The file route learns one feature's prefix.
- The prefix gate stops working once a CDN or `S3_PUBLIC_BASE_URL` fronts public files. The design's own future item has the same limit.
- Edit requests gain a storage delete and its failure path, which must be non-throwing like `refresh`.
- Copies already in browsers stay either way.

### C2. Detection is automatic; repair is manual and nobody is reminded - Severity: Major

**Affected scope**

- Non-Goals "Scheduled or background work" (lines 166-167)
- "What this does not do" (lines 627-635)
- "When the clip is made" (lines 671-684)
- Risks "A course sits without a clip" (line 962) and "A delete fails" (line 972)
- CUJs 6 and 8
- Alternatives P and Q (lines 1166-1184)

**False compromise:** "no queue, timer or scheduler" is taken to imply that repair is a person's job.

- The repair paths are "Make clip" or a hand-run backfill, and "nothing reminds anyone to".
- Only two alternatives were weighed: synchronous refresh at every edit (P) and a scheduler (Q).
- The system already computes `pending` on every `loadCourseView` and detects stale clips on every catalog read. Only the action is manual.

**Proposed resolution:** Self-Service on existing traffic.

- Teach's preview card sends the existing "Make clip" PATCH once per mount when the state is `pending` and the viewer holds the capability.
- This needs no new route, no server background work and no scheduler.
- It also retries failed deletes and courses approved during a Mux outage (CUJs 6 and 8) the next time anyone on the profile opens the course. The backfill becomes a rarely needed tool.

**Secondary liabilities**

- A page load now causes a write and up to a 10-second Mux wait. It must not block rendering.
- The PATCH writes the course row and so remounts the Details form (lines 814-816). The trigger must fire before any edit or be skipped when the form is dirty.
- Automatic remakes spend `preview_fetches` without a human choosing to.
- Repair still depends on someone opening the course.
- Teach has no component tests (line 1352), so the trigger is hand-checked.
- It retries once per mount, so a failing Mux gets one attempt per visit, not a loop.
- The Mux `video.asset.ready` webhook was considered as a trigger. It is not recommended: `apps/api/src/routes/webhooks.ts` is built for a "fast 200".

### C3. The teacher learns what is public after it is public; Support sees it before - Severity: Major

**Affected scope**

- Goal 2 (lines 98-110)
- CUJ 3 (lines 325-333)
- "Support's review page" (lines 836-842)
- Item 13, the approval email (lines 1809-1814)
- Risks "A teacher objects after the footage is out" and "The default shows the wrong thing" (lines 960-961)
- Alternatives I and J (lines 1090-1109)

**False compromise:** coverage and informed consent are treated as a binary.

- The two options weighed are on-by-default with notice after the fact, or opt-in with few clips.
- The exposure is irreversible: "A clip can't be recalled", and browsers keep it for a year.
- Both listed mitigations, the Teach control and the approval email, act after the footage is out.
- Meanwhile `resolvePreview` already runs on drafts (state `not_live`, `resolved` filled), and Support's page shows the chosen video and second before approval.

**Proposed resolution:** Preliminary Action.

- Show the same resolved line in Teach's "Review & submit" panel, `apps/teach/src/components/review-panel.tsx`. It already has a readiness checklist with jump-to-tab links.
- Suggested wording: "Card preview: 4 seconds of <lesson>: <item>, from 0:10. Change or turn off."
- `CourseView.preview` already carries the data, so no API change is needed. The default stays on and coverage is unchanged.
- Courses under review are locked (lines 789-790), so what the submitter saw is what is cut.

**Secondary liabilities**

- One more English-only line in the builder.
- It is still notice, not recorded consent, which the design keeps as a non-goal.
- It is a hand-checked Teach surface.
- A writer who submits sees it, but only an owner or manager can submit.

### C4. The allowance is treated as scarce for life, yet several paths spend it on bytes that are thrown away - Severity: Nit

**Affected scope**

- "The data model" (lines 485-488)
- "Making the clip" steps 7 to 9 (lines 595-615)
- Risks "The per-asset limit is reached" (line 964) and "Two refreshes at once" (line 971)
- Item 14 `check` (lines 1834-1839)
- Alternative AK (lines 1403-1414)

**False compromise:** delete-on-off plus a single key slot is accepted as costing fetch budget. Under the design's own assumptions (the limit is real, lasts the video's lifetime, and repeats count), identical clips are fetched and counted again in five cases:

- when an old-file delete fails (step 8.2 discards the new clip);
- when a guard is lost or two refreshes race;
- on every off-then-on;
- when one video is on two courses, which share one allowance;
- on every `previews check`.

**Proposed resolution:** Extraction, separating "fetched bytes" from "published file".

- Keep fetched bytes under a private (non-`public/`) key addressed by media ID, start and shape.
- Publishing copies them to a fresh `public/previews/` key. Turning off deletes only the public copy.
- Repeats then cost no Mux fetch.
- The 10-second grid already bounds distinct clips to the allowance. So `preview_fetches`, the `limit` state and `changesLeft` could be dropped.

**Secondary liabilities**

- Private copies of paid-footage clips persist after a teacher turns the preview off. Goal 2's "deletes the stored file" would need rewording and the agreement's intent checking.
- One more storage object per distinct clip, with no clean-up.
- A copy step on publish.
- The shape must be part of the key.
- Given that 59 fetches on one 60-second video never hit the limit (lines 207-213), leaving this as designed is defensible.

### C5. The named CDN escape hatch contradicts the takedown guarantee - Severity: Nit

**Affected scope**

- Goal 2 (lines 108-110)
- "Three details" (lines 639-645)
- Risks "Clips load the API" (line 966)
- Future Improvements (lines 1435-1436)

**False compromise:** the design accepts "serve through the single API task" and names `S3_PUBLIC_BASE_URL` plus a CDN as the next step.

- Goal 2 and Alternative V rest on "deleting stops the address working for new requests".
- With `public, max-age=31536000, immutable`, a CDN would keep serving a deleted clip for up to a year.
- Deferring the CDN is right under YAGNI. The unstated condition is the gap.

**Proposed resolution:** Beforehand Cushioning, as a document change only.

- Record that the CDN step requires `refresh` to issue an invalidation on delete, or a short shared-cache lifetime (`s-maxage`) on the `public/previews/` prefix.

**Secondary liabilities**

- An invalidation is one more external call with its own failure path inside `refresh`.
- A short `s-maxage` raises origin hits.

### Not raised, judged balanced

- The read-time catalog check (fail-safe derivation, small row cost).
- Synchronous "Save preview" (the wait is the feature).
- The environment-variable kill switch over a settings table.
- Columns on `courses` over a new table.
- A `.web.tsx` split for the hover code.

**Files the reviewer read in full:**

- `agents/inventive_catalyst.md`
- `resources/document_standards/zoom-out-standard.md`
- `docs/designs/learner-hover-preview.md` (lines 1-2309)
- `docs/designs/learner-main-page-improvements.md`
- `docs/designs/learner-chinese.md` (lines 1-1881)
- `docs/designs/learner-teach-banner.md` (lines 1-1290)
- `docs/adr/004-media-mux-and-storage.md`
- `docs/adr/005-aws-hosting-and-environments.md`
- `docs/spec.md`
- `apps/api/src/routes/files.ts`
- `apps/api/src/routes/webhooks.ts`
  Partially read or grepped for grounding: `apps/api/test/schema-guard.test.ts` (lines 1-90), `apps/api/src/services/courses.service.ts`, `apps/teach/src/components/review-panel.tsx`, `apps/teach/src/routes/courses/builder.tsx`.
