# Stage 6: Comprehension Test (round 2)

**Status on 2026-11-20:** every finding below has been acted on. The line numbers are those
of the version reviewed on 2026-11-19.

| Finding | What was done                                                                                                                                                                                                                               | When                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| R1      | The CUJ 4 hand check was rewritten: a 10-second test video has one start, so the check changes the video.                                                                                                                                   | 2026-11-19, with the Stage 9 fixes              |
| R2      | The plan says which video feeds the start select on "Default". The rule now says a start chosen with no chosen video goes with whichever video is the default.                                                                              | 2026-11-19 and 2026-11-20                       |
| R3      | The `limit` card text no longer says "the clip shown stays", and the Risks row says a video can reach the limit with no clip. Whether the count stays is open Question 14.                                                                  | 2026-11-20                                      |
| R4      | The hand checks point at sections 1 and 2 of `docs/runbooks/mux.md`, and item 26 says how its two courses with clips are made.                                                                                                              | 2026-11-19 and 2026-11-20                       |
| R5      | "Seven outcome names" corrected to eight.                                                                                                                                                                                                   | 2026-11-19                                      |
| R6      | The three places where "the live course" meant the course's live rows now say so: Terms, the data-flow diagram and item 4.                                                                                                                  | 2026-11-20                                      |
| R7      | Open Questions is in numeric order under "Open" and "Answered" headings.                                                                                                                                                                    | 2026-11-20, with the Stage 7 fixes              |
| R8      | Terms gained eight entries: the live views, the schema guard test, the course view, `requireProfile`, `USER_ERROR_CODES`, recovery, the save tracker and the hero animation. Question 9 says how `integrations.mux` becomes `VIDEO_DRIVER`. | 2026-11-20                                      |
| R9      | "The pilot has a handful of teachers" became "is planned with three to five teachers".                                                                                                                                                      | 2026-11-20, with the Stage 7 fixes              |
| R10     | The Problem states the brief's decisions 5 and 9. Alternative D states the brief's caching reason. "The reviewers' belief" and "a small workflow" are gone.                                                                                 | 2026-11-20                                      |
| R11     | The gate is written as a record of what ran.                                                                                                                                                                                                | 2026-11-19 (plan) and 2026-11-20 (feature part) |
| R12     | The Records entry points at the Overview's five departures.                                                                                                                                                                                 | 2026-11-20, with the Stage 7 fixes              |
| R13     | The design says a too-large start is stored as sent and lowered each time the rule resolves, and that a value the request schema rejects still answers 400 when turning off.                                                                | 2026-11-20                                      |
| R14     | The commands section says `previews check` stores no file and changes no course, and adds one to the video's count.                                                                                                                         | 2026-11-20                                      |
| R15     | "A seventh column" became "A seventh column on `courses`".                                                                                                                                                                                  | 2026-11-20, with the Stage 7 fixes              |

Not re-read by a fresh reviewer since these changes.

- **Target:** `docs/designs/learner-hover-preview.md`, lines 1 to 1457 (FeatureRange) and
  1458 to 2309 (DetailedRange)
- **Date:** 2026-11-19
- **Round:** 2. The round 1 report is in `docs/designs/reviews/learner-hover-preview/`.
- **Reviewer:** `egm-comprehension` (completed). It read the target alone: no reading list,
  no other repository file, no document standard.
- **Result:** every section could be paraphrased, so there are no Blockers. 4 Major, 11 Nit.

The two sections below are the reviewer's own account of the document. Compare them with
what the design means to say. A wrong account is a finding.

## What this proposes

On the learner web app, resting a mouse on a course card in Explore (or reaching it with the keyboard) for 400 ms fades a silent, looping 4-second animated WebP over the still cover image for up to 12 seconds. Phones, touch screens, native apps and reduced-motion visitors keep the still image and never download the clip. The API makes the clip once: it signs a short-lived Mux token (audience `g`), fetches a 480-pixel, 10 fps animated WebP, stores it as a public file under `public/previews/<courseId>/<uuid>.webp`, and the catalog returns its plain, non-expiring address as `previewUrl`. Every live course with a usable video gets a clip by default (first usable video, start at second 10, or 0 for a video under 15 seconds). Consent rests on a new sentence on Teach's two application pages. In the builder's Details tab a teacher can pick another video, pick a start in 10-second steps, or turn the clip off.

One function, `CoursePreviewService.refresh`, makes, replaces or clears a clip. It is called from Support's approval, a change-set approval, the Teach save, and a hand-run `previews backfill` command. It never throws, never blocks the request it follows, and counts fetches per video against a conservative reading of Mux's per-asset limit. Direct edits to a live course do not call it; instead the catalog hides a clip whose source video has left the course. A `COURSE_PREVIEWS` environment value switches the feature off everywhere. The work lands as a server PR and a learner PR, deployed the same day, after a gate of real Mux calls.

## How the existing system works, per this document

Explore is the learner app's home tab and lists course cards, 12 to a page, each with a still cover image (`thumbnailMediaId`, a `media_assets` row served from a public file route through the API, with no CDN). A course has no video of its own. Video belongs to lessons as "video" artefacts whose files are Mux assets with signed playback only, and the API hands out playback tokens only after an enrolment check (ADR 004).

Teachers sell from a teaching profile (owner, managers, writers). Teach is their portal, with a course builder; Support is the staff portal that approves courses. A writer's edits to a live course sit as draft rows beside the live rows in `lessons` and `artefacts` until an owner or manager approves the change set, and learner-facing reads go through `deps.learnerDb`, which sees only live rows.

The API has no queue or scheduler and has never deleted from storage or made a plain HTTP call to another service. Local development uses a local video driver with no Mux, and seeded courses have no video. Production is not deployed and no teacher has applied there. The app sends no client analytics events.

## One point in the paraphrase to compare

Added by the main session, not by the reviewer.

- The reviewer writes that `refresh` "never blocks the request it follows". The design says
  it never fails that request. The Teach save does wait for it, for up to the 10-second
  limit on the call to Mux. If the reviewer meant "never fails", the paraphrase matches.

## Findings

| ID  | Severity | Finding                                                                  |
| --- | -------- | ------------------------------------------------------------------------ |
| R1  | Major    | The CUJ 4 walkthrough cannot be done as written                          |
| R2  | Major    | Which video supplies the starts when the video select is on "Default"    |
| R3  | Major    | `limit` is described as if a clip is always stored                       |
| R4  | Major    | Local Mux set-up is assumed                                              |
| R5  | Nit      | Seven outcomes or eight                                                  |
| R6  | Nit      | "The live course" has two meanings                                       |
| R7  | Nit      | Open Questions is read before its terms exist                            |
| R8  | Nit      | Project terms used without definition or link                            |
| R9  | Nit      | "The pilot has a handful of teachers" against "no teacher has applied"   |
| R10 | Nit      | References to the brief and to reviews that are not restated             |
| R11 | Nit      | What the gate requires                                                   |
| R12 | Nit      | Which departures supersede the brief                                     |
| R13 | Nit      | Is a too-large start stored or only resolved lower; and "whatever it is" |
| R14 | Nit      | `previews check` "stores nothing" but writes a count                     |
| R15 | Nit      | "A seventh column"                                                       |

### R1. The CUJ 4 walkthrough cannot be done as written - Severity: Major

**Affected scope:** Verification Plan, E2E/Integration, lines 2288-2297; compare "The rule for what the clip shows" lines 517-520, item 17 lines 2027-2031, the risk row at line 970.

**Discrepancy:** The walkthrough uses Mux test assets "at most 10 seconds long" and asks, for CUJ 4, for "one start inside the video, and one above it to see it lowered".

- By the allowed-starts rule, a 10-second video has one allowed start, 0, which is also its default.
- The start control is a select of allowed starts with "no free typing", so a start above the video cannot be entered in the card at all.
- CUJ 4 itself (line 339) picks 1:30.
- The step reads as left over from before the 10-second step rule. A reader cannot tell what the hand check is meant to do: a hand-made request, or a different expectation.

### R2. Which video supplies the starts when the video select is on "Default" - Severity: Major

**Affected scope:** "The control in Teach" lines 760-767; item 17 lines 2019-2034; item 4 lines 1581-1584; item 5 line 1620.

**Discrepancy:** The start select lists "the selected video's `starts`" and the changes-left line uses "the selected video's `changesLeft`". When the video select is on "Default: the course's first video" (empty value), no video is selected, and the document does not say which `videos` entry supplies them.

- The rule supports a chosen start with no chosen video (line 1620: "gives the default video from second 30"), so the card must offer starts in that case.
- An implementer has to guess `videos[0]` or `resolved.mediaId`. One who offers only "Default" makes "pick a different start on the default video" unreachable.
- Related: "a chosen start belongs to the video it was chosen for" (line 514) is not true in this case. If the first video is later replaced, the stored start silently applies to a different video.

### R3. `limit` is described as if a clip is always stored - Severity: Major

**Affected scope:** outcome table line 570; state table line 779; risk row line 964; step 7.1 line 596-597.

**Discrepancy:** The outcome says "The stored clip is left as it was", the card says "The clip shown stays", and the risk row says "the clip shown stays". The document's own rules reach `limit` with no clip stored:

- turning a preview off deletes the clip and turning it on fetches again, each counted (line 964 says so);
- `previews check` adds to the count (line 1838-1839);
- a failed delete during a replacement leaves a leftover that step 4 deletes before step 7.1 stops (lines 610-612).
- In each case the card's sentence is false and that video can never again supply a clip. The document does not state that outcome, or what the card should say.

### R4. Local Mux set-up is assumed - Severity: Major

**Affected scope:** item 22 lines 2151-2157; Verification Plan lines 2288-2294; risk row line 970; item 26 line 2252.

**Discrepancy:** Teach's card, Support's line and CUJs 3 to 8 are verified only by hand "against a local API with Mux test credentials". Nothing states or links how to get there:

- which environment values turn the Mux driver on locally (only `VIDEO_DRIVER=local` is named);
- how an uploaded video reaches `status: 'ready'` with a stored length on a developer's machine, given line 672 says a Mux webhook marks a video ready;
- how the "at least two courses that have clips" of item 26 come to exist.
- `docs/runbooks/mux.md` is named only as a file to edit, not as the set-up guide.

### R5. Seven outcomes or eight - Severity: Nit

**Affected scope:** item 10 line 1705, against lines 560, 1706 and 1830.

**Discrepancy:** `RefreshOutcome` is "the union of the seven outcome names". The table lists eight, and the next line and item 14 say eight. There are seven states and eight outcomes; the count here looks swapped.

### R6. "The live course" has two meanings - Severity: Nit

**Affected scope:** Terms lines 396-409; lines 461, 696, 1565, 1597.

**Discrepancy:** Terms says "live" is about the row, not the course's status. But "a usable video: a video item on the live course" and "the live course's video items" read as the status.

- The states `no_video` and `not_live`, and the draft-course test (line 1910), need usable videos to exist on a course that is not live.
- Saying "the course's live rows" would remove the ambiguity.

### R7. Open Questions is read before its terms exist - Severity: Nit

**Affected scope:** Open Questions lines 169-304.

**Discrepancy:** The section is a decision log placed before the Technical Plan and ordered 13, 10, 8, 9, 1, 2, 3, 4, 5, 12, 6, 7, 11, with three unnumbered entries.

- It uses "the refresh", "the driver's content-type check", "the 3 MB cap", "allowance", "the `waiting` state" and "the seed change" before any is introduced.
- "The end rule" (line 205) is never defined under that name. It has to be matched to check 3 at line 923 and the 1-second margin at line 518.
- "The default clip as it was then" (line 197) is understood only after reading Question 5.

### R8. Project terms used without definition or link - Severity: Nit

**Affected scope:** lines 495 and 1536 ("the live views"); 576 ("the schema guard test forbids outside two services", never named); 1717-1718 (`liveLessons`, `liveArtefacts`); 748 and 2179 ("the hero animation"); 860 ("Support's recovery process"); 976 (`requireProfile`); 1782 (`USER_ERROR_CODES`); 2044 ("the save tracker"); 229 against 429 (`integrations.mux` in Terraform against `VIDEO_DRIVER` in the API, relation unstated); 501 ("the course view", used before `CourseView` is introduced at line 818).

**Discrepancy:** Each can be guessed, but none is defined inline or linked. The live-views group matters most, because the catalog check and the "never touches the raw tables" rule rest on it.

### R9. "The pilot has a handful of teachers" against "no teacher has applied" - Severity: Nit

**Affected scope:** The Problem line 84; lines 76-77, 102, 288-289.

**Discrepancy:** The pilot is not defined, and the present tense conflicts with production not being deployed and having no teaching profile. A reader cannot tell whether the pilot is planned, or running somewhere other than production.

### R10. References to the brief and to reviews that are not restated - Severity: Nit

**Affected scope:** lines 87-88 and 1029 ("decisions 5 and 9"; decision 5 is never described); line 302-304 ("the reviewers' belief holds"; neither the reviewers nor the belief is stated); line 1045-1046 ("the brief's caching reason"); line 1330-1332 ("The review found…", "A small workflow proposed fixes and attacked each one").

**Discrepancy:** The brief is linked, so decision numbers are traceable. Which review, who the reviewers were and what "a small workflow" is are not said anywhere in the document.

### R11. What the gate requires - Severity: Nit

**Affected scope:** Order of release line 893-894; Checks lines 929-936; item 1 lines 1496-1512.

**Discrepancy:** "No code is written until the six checks have been made and their results are in this design", yet checks 4 to 6 are unanswered and "the gate is open".

- Only check 1 has a stated failure consequence; the passing criterion for the gate is never stated.
- Line 930 still says checks 4 to 6 "decide how the control behaves", which Question 13 replaced.
- Item 1's changes are in the future tense ("which then moves to Answered") for work its Status line says is done.

### R12. Which departures supersede the brief - Severity: Nit

**Affected scope:** Records and rules line 951-952, against Overview lines 40-54.

**Discrepancy:** The Overview lists five departures, at least four of them from decision 9. Records says this design supersedes decision 9 on two (on by default; more moments). "Not remade by every edit" and "no media row" are left out.

### R13. Is a too-large start stored or only resolved lower; and "whatever it is" - Severity: Nit

**Affected scope:** lines 810-811, 513, 1938-1939; lines 799-801 and 1772-1774 against item 6 lines 1638-1641.

**Discrepancy:** Two points.

- "One past the video's last allowed start is lowered, not refused" and "a start of 90 on a 60-second video is saved and the clip is cut from second 50" do not say whether the row keeps 90. If it does, the card's start select is initialised with a value not among its options, and that case is not described.
- When turning off, a video or start in the request "is ignored, whatever it is". The schema still validates the start (multiple of 10, 0 to 86,400) and the ID's format before `update` runs, so a malformed value presumably still answers 400. The text does not say.

### R14. `previews check` "stores nothing" but writes a count - Severity: Nit

**Affected scope:** The commands lines 871-874; item 14 lines 1834-1839.

**Discrepancy:** The feature section says the command stores nothing. Item 14 says it adds one to `previewFetches`. Whether it stops at the allowance, as `refresh` does, is not stated.

### R15. "A seventh column" - Severity: Nit

**Affected scope:** Alternative AH line 1376; lines 467 and 983.

**Discrepancy:** The design already has seven new columns (six on `courses`, one on `media_assets`), so "a seventh column" for the rejected list is ambiguous. It means a seventh on `courses`.

## Claims checked by the main session

Checked against the design after the reviewer returned. The other findings have not been
checked.

- **R1: confirmed.** Lines 2288 to 2297 still ask for a start "above" a 10-second test video
  "to see it lowered". The card's start control is now a select of allowed starts, so that
  step cannot be done in the card.
- **R2: confirmed.** Lines 760 to 767 say the start select lists "the chosen video's allowed
  starts". The design does not say which video supplies them when the video select is on
  "Default".
- **R14: confirmed.** Lines 871 to 874 say `previews check` "stores nothing". Item 14 (lines
  1834 to 1839) says it adds one to the video's `previewFetches`.
- **R5: confirmed** in Stage 5 (finding Z4 in `zoom_out_report_round2.md`).

## Review completeness

Lines read: 1-2309 of docs/designs/learner-hover-preview.md (FeatureRange 1-1457 and DetailedRange 1458-2309, in full), plus the persona file agents/comprehension.md. No other project file was opened.
