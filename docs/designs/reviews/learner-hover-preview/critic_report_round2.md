# Stage 7: Critic Review (round 2)

- **Target:** `docs/designs/learner-hover-preview.md`, lines 1 to 1457 (FeatureRange)
- **Date:** 2026-11-19
- **Round:** 2. Round 1 reviewed an earlier version; its report is in
  `docs/designs/reviews/learner-hover-preview/`. No reviewer was given it.
- **Reviewers:** `egm-design` and `egm-structural` against the feature-spec standard,
  `egm-style` with its own rules
- **Reading list given to all three:** the brief, `learner-chinese.md`,
  `learner-teach-banner.md`, ADR 004, ADR 005, `docs/spec.md`

Finding identifiers are `<reviewer>-<round>-<n>`.

## Reviewer Status

| Reviewer         | Status    | Blocker | Major | Nit |
| ---------------- | --------- | ------- | ----- | --- |
| `egm-design`     | completed | 0       | 5     | 5   |
| `egm-structural` | completed | 0       | 2     | 7   |
| `egm-style`      | completed | 0       | 6     | 14  |
| **Total**        |           | 0       | 13    | 26  |

Coverage differs by reviewer. The design critic read all six reading-list files in full. The
structural reviewer read the two sibling designs in part and did not read ADR 004, ADR 005 or
`docs/spec.md`. The style reviewer consulted the brief and `docs/spec.md` by search and did
not open the other four. Each says no finding of its own depends on a file it did not read.

## All findings by severity

| ID               | Severity | Finding                                                                                                              |
| ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `design-2-1`     | Major    | Neither kill path stops the clips being served                                                                       |
| `design-2-2`     | Major    | A removed video's clip stays public indefinitely, with no risk row, and one case has no teacher-side exit            |
| `design-2-3`     | Major    | The "before any code" gate is declared passed on evidence that does not meet its own conditions                      |
| `design-2-4`     | Major    | Default-on consent rests on a manual sequencing condition that nothing enforces or detects                           |
| `design-2-5`     | Major    | Several rejections cite the author's choice and state no deciding trade-off                                          |
| `structural-2-1` | Major    | Open Questions holds an unordered decision log under a pseudo-heading                                                |
| `structural-2-2` | Major    | Reason-for-Rejection lines that give an attribution and no trade-off                                                 |
| `style-2-1`      | Major    | "Open Questions: None" is contradicted by the text under it                                                          |
| `style-2-2`      | Major    | Release gate and check text left in pre-check tense                                                                  |
| `style-2-3`      | Major    | Goal headings state absolutes that their own bodies narrow                                                           |
| `style-2-4`      | Major    | Tested-behaviour claims are broader than the evidence                                                                |
| `style-2-5`      | Major    | Open Questions narrates drafting history, out of order, with superseded values first                                 |
| `style-2-6`      | Major    | The same facts are restated across sections, and copies have drifted                                                 |
| `design-2-6`     | Nit      | The lifetime allowance creates a permanent lockout on an assumption the doc's own evidence contradicts               |
| `design-2-7`     | Nit      | The save path writes its audit row after an external call of up to 10 seconds                                        |
| `design-2-8`     | Nit      | The catalog check loads every live item on an unauthenticated, unlimited endpoint, and a cheaper form is not weighed |
| `design-2-9`     | Nit      | "Deletes the stored file" leaves the bytes as S3 noncurrent versions with no expiry                                  |
| `design-2-10`    | Nit      | A teacher is not told about failures that leave their footage reachable                                              |
| `structural-2-3` | Nit      | The Mux-check gate is described in three places in conflicting tense                                                 |
| `structural-2-4` | Nit      | The "Fixes weighed after the review" group is organised by process history                                           |
| `structural-2-5` | Nit      | CUJ 7 breaks the Given/When/Then shape                                                                               |
| `structural-2-6` | Nit      | Hard-wrap inconsistencies from unreflowed edits                                                                      |
| `structural-2-7` | Nit      | External references are code spans, not links                                                                        |
| `structural-2-8` | Nit      | Orphaned comment in the `CourseView` block                                                                           |
| `structural-2-9` | Nit      | Departure lists disagree between the Overview and "Records and rules"                                                |
| `style-2-7`      | Nit      | Unverified behaviour stated as fact                                                                                  |
| `style-2-8`      | Nit      | "Checked" used for a check not yet made                                                                              |
| `style-2-9`      | Nit      | "A few dozen bytes per card"                                                                                         |
| `style-2-10`     | Nit      | The 10-second bound is stated for the whole request                                                                  |
| `style-2-11`     | Nit      | Predictions and frequencies without evidence                                                                         |
| `style-2-12`     | Nit      | "Have one answer that fits the goals"                                                                                |
| `style-2-13`     | Nit      | Departure list is inconsistent between sections                                                                      |
| `style-2-14`     | Nit      | One term, several referents; one concept, several terms                                                              |
| `style-2-15`     | Nit      | Subjective or idiomatic wording                                                                                      |
| `style-2-16`     | Nit      | Approximate or ambiguous counts                                                                                      |
| `style-2-17`     | Nit      | Goal 1 wording                                                                                                       |
| `style-2-18`     | Nit      | "Nothing shows it"                                                                                                   |
| `style-2-19`     | Nit      | New-text inventory omits the approval email                                                                          |
| `style-2-20`     | Nit      | Mixed units and line wrapping                                                                                        |

## Findings that say the same thing

Each finding is kept under its own reviewer below, with the severity that reviewer gave. The
groups show where two or more reviewers, in this stage or an earlier one, reached the same
point independently. `Z` and `C` identifiers are in `zoom_out_report_round2.md`; `R` identifiers are
in `comprehension_report_round2.md`.

- **A clip's file stays public after every "off" path.** `design-2-1` (the global switch and
  a revert), `design-2-2` (a removed video), `design-2-10` (a failed delete), `style-2-3`
  (Goal 7's heading), with `C1`, `Z6` and `Z8` from Stage 5. Four reviewers raised it.
- **The gate before any code.** `design-2-3`, `structural-2-3`, `style-2-2`, `style-2-4`, with
  `R11` from Stage 6. The checks ran on one flat-coloured animation, mostly at 320 pixels, and
  the gate's own text asks for real lesson footage at the clip's shape.
- **Open Questions is a decision log out of order.** `structural-2-1`, `style-2-1`,
  `style-2-5`, with `R7` and `Z4`.
- **Rejections that name the author and no trade-off.** `design-2-5`, `structural-2-2`.
- **The per-video count.** `design-2-6`, with `Z3`, `C4` and `R3`.
- **Five departures against two.** `structural-2-9`, `style-2-13`, with `R12` and `Z4`.
- **Repetition and drift.** `style-2-6`, with `Z4`.
- **Line wrapping.** `structural-2-6`, `style-2-20`.
- **"A seventh column".** `style-2-16`, with `R15`.

## Claims checked by the main session

Checked against the design and the code after the reviewers returned. The other findings have
not been checked.

- **`design-2-1`: confirmed.** `apps/api/src/routes/files.ts` serves any `public/` key with no
  configuration check. Lines 986 to 989 of the design say stored files stay "at addresses
  nobody is given"; the catalog gave each address to every visitor while the feature was on.
- **`design-2-3`: confirmed.** Line 914 asks for "a signed video of real lesson footage".
  Lines 194 to 195 record that the calls used "a flat-coloured animated lesson".
- **`design-2-9`: confirmed.** `infra/terraform/modules/environment/storage.tf` enables bucket
  versioning when `protect_data` is set, and its only lifecycle rule aborts incomplete
  multipart uploads. A deleted clip is kept as a noncurrent version.
- **`structural-2-8`: confirmed.** In the `CourseView` block (lines 826 to 830) the comment
  "the usable live videos, in order" sits under `changesLeft` and describes `videos`.

## Design critic

**Status:** completed. 0 Blocker, 5 Major, 5 Nit.

**The reviewer's summary**

Summary: 0 Blockers, 5 Major, 5 Nits. All five required areas are present (problem, goals and non-goals, architecture, alternatives, risks). The findings are about paid footage staying publicly reachable after every "off" path, evidence that does not meet the design's own gate, an unenforced consent condition, and rejection rationales that rest on authority.

### design-2-1. Neither kill path stops the clips being served - Severity: Major

**Affected scope:** Goals, Goal 8 (lines 127-129); Configuration and turning it off (876-889); Rollout and rollback (981-991).

**Finding:** `COURSE_PREVIEWS=false` only removes `previewUrl` from the catalog and stops new fetches; "Stored files stay" (880, 987). Reverting the server PR also leaves every file in place (988-989), and removes the only code that deletes them.

- Line 989 calls these "addresses nobody is given". That is wrong: each address was returned to every visitor who loaded Explore while the feature was on.
- I checked `apps/api/src/routes/files.ts`: it serves any `public/` key with no auth, no rate limit and no configuration check, with `Cache-Control: public, max-age=31536000, immutable`.
- So the emergency switch for "paid footage is public and a teacher or lawyer objects" hides links and revokes nothing.

**Recommendation:**

- Have the files route answer 404 for the `public/previews/` prefix when `COURSE_PREVIEWS` is off. This is an environment check with no database query, unlike the costlier variant under Future Improvements (1445-1448).
- Add a `previews purge` command that deletes every stored clip and empties the keys, and name it as the step to run before a revert.
- Reword Goal 8 to say what "off" actually revokes.

### design-2-2. A removed video's clip stays public indefinitely, with no risk row, and one case has no teacher-side exit - Severity: Major

**Affected scope:** Goal 7 (123-126); CUJ 7 (359-372); When the clip is made (671-682); Alternative V (1226-1232); Risks table (958-979).

**Finding:** Goal 7's heading says "A clip never outlives its video on the course", but only the catalog link is removed. The file stays served at its old address "until the next save of the preview setting, approval or backfill" (372, 675-676). Nothing is scheduled, so that window is unbounded.

- Alternative V is rejected for exactly this exposure: "Paid footage stays reachable at its old address after the teacher turned it off".
- A teacher who deletes a video because it must come down gets no sign that four seconds of it are still public.
- In the only-video case the state is `no_video`, and the button table in the plan (2049-2053) shows "Save preview" disabled when nothing changed. The teacher cannot trigger the delete without first changing a control.
- The Risks table covers "A course sits without a clip" and "A stray public file" (an address never given out). It has no row for this case, where the address was given out.

**Recommendation:**

- Add the risk row with an explicit bound.
- Do the hide-delete-forget step, without the Mux fetch, on the direct-edit paths that remove a video item. Deleting does not carry the Mux wait that Alternative P was rejected for.
- Failing that, enable a clean-up action in the `no_video` and `pending` states and state a backfill cadence in the runbook.
- Reword Goal 7's heading to match its body.

### design-2-3. The "before any code" gate is declared passed on evidence that does not meet its own conditions - Severity: Major

**Affected scope:** Open Questions, Questions 10, 5 and 12 (192-224, 254-270); Order of release (893-894); Checks before any code is written (912-936); risk rows "Mux behaves differently", "Requests get slower", "Clips load the API" (963, 965, 966).

**Finding:** The gate requires "a signed video of real lesson footage" (914) and "the file's size at the clip's shape" (920). The calls used "a flat-coloured animated lesson" (194-195) at 320 px.

- The chosen shape, 480 px, has one sample: 242,552 bytes and 4.4 s.
- The doc itself says "Filmed footage will be larger, by an amount one video can't show" (269-270), yet line 934 records "Checks 1 to 3 passed".
- Line 893 says no code is written until "the six checks have been made". Checks 4 to 6 are unanswered.

**Why it matters:** three design constants rest on that one best-case sample.

- **The 3 MB cap:** an over-cap clip returns `null`, so the state is `pending` and "Make clip" can never succeed. The teacher is given no reason.
- **The 10 s timeout:** 4.4 s was measured on trivially compressible content. A timeout is also a fetch that Mux may have served and the count misses (603).
- **API load:** the "Clips load the API" risk is sized from the same sample. I checked `infra/terraform/modules/environment/variables.tf`: the task defaults to 256 CPU units and 512 MiB.

**Recommendation:**

- Re-run check 2 at 480 px, 4 s, 10 fps on several filmed videos, including 1080p talking-head and screen-recording footage, before the gate is called open. Record the size and first-byte time distribution.
- Specify what the teacher sees when a clip is permanently over the cap or over the timeout.
- Correct lines 893 and 934.

### design-2-4. Default-on consent rests on a manual sequencing condition that nothing enforces or detects - Severity: Major

**Affected scope:** Goal 2 (98-105); Non-Goals (148-155); The agreement sentence (854-860); Order of release (907-908); Records and rules (938-952); risk row "A teacher applied before the sentence" (975).

**Finding:** the only control between "on by default" and publishing paid footage without agreement is "the server PR is in production before production opens to teachers".

- **Nothing enforces it.** The code does not check it (104-105).
- **Nothing can detect a violation.** Acceptance is not stored (854), and no check compares `profiles.created_at` with the deploy time.
- **It has no home outside this document.** The Records list adds commands and the configuration value to `deploy.md`, not this release condition.
- **The consent limits have no risk row.** Managers with `course.editLive` and invited writers never see the sentence, and an owner installed by Support's recovery never applied (857-860). Neither appears in the Risks table.
- **The offline agreement may disagree.** `docs/spec.md` line 77 describes a teacher agreement drafted outside the code that grants only a "non-exclusive hosting license". Whether it matches is left to "whoever drafts it" (153-155), with no gate.

**Recommendation:**

- Put the release condition in the production-opening checklist in `docs/runbooks/deploy.md` and in ADR 011.
- Add a cheap detector: have `previews count` or the backfill report live courses whose profile was created before a configured consent-from date. This needs no column, email or wait, so Alternative L's costs do not apply.
- Add risk rows for the invited-member and recovered-owner cases.
- Make "offline agreement updated" a named release condition with an owner.

### design-2-5. Several rejections cite the author's choice and state no deciding trade-off - Severity: Major

**Severity note from the reviewer:** Major (the standard's Alternatives Rule)

**Affected scope:** Alternatives E (1055), N (1153-1154), O (1162), P (1174-1175), Q (1184), S (1205), T (1214), X (1259), Z (1283-1284); the Question entries they point to: Question 1 (231-239), Question 3 (245-250), the data model (297-301).

**Finding:** the standard requires rejection rationales to "state concrete technical or scope trade-offs" and bars attributing a rejection to a person without a linked record.

- These entries read "Rejected by author (Question n)" or "in favour of X".
- The Questions they cite say only "The author chose this over ...".
- A reader can infer a reason from the Cons list, but the document does not say which con decided it.
- The gap that matters most is Alternative Q, the scheduled task. Its rejection gives no reason, yet the absence of a scheduler is the root of at least four accepted risks: failed deletes never retried, leftover public files (finding 2), courses sitting without a clip, and approvals blocking up to 10 s.

**Recommendation:** for each listed alternative, add one sentence naming the deciding trade-off. For Q, weigh the one-off Terraform cost against those four risks explicitly.

### design-2-6. The lifetime allowance creates a permanent lockout on an assumption the doc's own evidence contradicts - Severity: Nit

**Affected scope:** Question 13 (178-191); Making the clip, step 7 (596-603); state table, `limit` (779); risk row "The per-asset limit is reached" (964).

**Finding:**

- **The evidence points the other way.** 59 clips succeeded on a 60-second video whose documented limit is 10 (207-209), yet the design hard-caps at 10 for the video's life.
- **Off then on consumes it.** Turning a preview off deletes the file, so turning it on refetches. A single-video course toggled past the cap can never have a clip again.
- **The `limit` text is wrong in that case.** It says "The clip shown stays" when no clip is stored.
- **There is no operator reset.** The only release is a code change to a constant.
- **The check is not atomic.** The allowance is read and then incremented, so two refreshes at count 9 both fetch.
- **Some real fetches are not counted.** Over-cap bodies and served-but-timed-out requests are missed (603), so the local count can sit below Mux's while the UI promises changes left.

**Recommendation:** add a runbook step or command to reset `preview_fetches`, fix the `limit` wording for the no-clip case, and consider not counting responses Mux marks as cache hits (211-213).

### design-2-7. The save path writes its audit row after an external call of up to 10 seconds - Severity: Nit

**Affected scope:** When the clip is made (657-668).

**Finding:** for approvals the doc argues the audit row must come first, so "a crash during the wait for Mux can't leave an approval with no record". For the save it puts the audit row after the refresh. A crash, a deploy or a failed audit write in that window leaves a change to what the public sees with no record.

- `course.preview` audit rows are the stated mitigation for "Staff or a writer changes a teacher's clip" (976).
- I checked `apps/api/src/services/courses.service.ts`: `update` writes no audit row today, so this ordering is new.

**Recommendation:** write the setting and its audit row in one transaction, then refresh. That also removes the stated reason for the current order.

### design-2-8. The catalog check loads every live item on an unauthenticated, unlimited endpoint, and a cheaper form is not weighed - Severity: Nit

**Affected scope:** Goal 5 (117-119); The catalog (703-705); risk row "The catalog reads more rows" (978); Alternative P (1166-1175).

**Finding:** every Explore page will load all live artefacts of 12 courses to compare one ID per course.

- The accepted cost gives no figure for items per course.
- No alternative weighs a per-course SQL `EXISTS` on `preview_source_media_id`, which returns one boolean and no extra rows.
- Goal 5 says the response "can be cached later without change", but Goal 7 depends on the check running on every read. A later cache would delay hiding by its lifetime, which the doc does not say.

**Recommendation:** use or weigh the `EXISTS` form, and state the interaction between caching and Goal 7.

### design-2-9. "Deletes the stored file" leaves the bytes as S3 noncurrent versions with no expiry - Severity: Nit

**Affected scope:** Goal 2 (106-110); Making the clip, "The first deletions in the codebase" (642-645); Future Improvements (1442-1443).

**Finding:** I checked `infra/terraform/modules/environment/storage.tf`: versioning is enabled when `protect_data` is set, and the only lifecycle rule aborts incomplete multipart uploads. A clip that is turned off is therefore retained indefinitely, though it cannot be requested.

**Recommendation:** add the noncurrent-version expiry rule for `public/previews/` in the server PR, which already changes Terraform, and do not defer it.

### design-2-10. A teacher is not told about failures that leave their footage reachable - Severity: Nit

**Affected scope:** What this does not do (627-635); risk row "A delete fails" (972).

**Finding:** after a failed delete on turning off, the save answers 200, the state is `off`, and the file is still served at its old address until some later refresh. Only the log shows it, and nothing alerts on that log line.

**Recommendation:** at minimum, name an operator signal such as a log metric or alarm, or have `previews count` report rows holding a key with an empty source record.

#### What the design critic checked and did not flag, and what it read

**Checked and not flagged**

- **Delete permission:** the API task role grants `s3:DeleteObject` (`infra/terraform/modules/environment/iam.tf` line 46).
- **Repeat deletes:** deleting a missing key succeeds on both drivers (local `rm` with `force`; S3 `DeleteObject`), so the step-4 retry cannot wedge.
- **"A live course never stops being live":** this matches the code. Only `review.service.ts` sets `live`, and no path leaves it.
- **Catalog baseline:** `CatalogService.list` loads `liveLessons` today, as the doc says.
- **Token call:** the Mux driver already signs thumbnails with `jwt.signPlaybackId`, as the doc says.

**Files read in full**

- `agents/design_critic.md` (1-64)
- `resources/document_standards/feature-spec-standard.md` (1-40)
- `docs/designs/learner-hover-preview.md` (1-1457 in scope, and 1458-2310 for cross-checking only)
- `docs/designs/learner-main-page-improvements.md` (1-336)
- `docs/designs/learner-chinese.md` (1-1881)
- `docs/designs/learner-teach-banner.md` (1-1290)
- `docs/adr/004-media-mux-and-storage.md` (1-20)
- `docs/adr/005-aws-hosting-and-environments.md` (1-45)
- `docs/spec.md` (1-78)

**Code read to verify claims, under the repository root:** `apps/api/src/routes/files.ts`, `apps/api/src/providers/storage/local-disk.ts` and `s3.ts`, `apps/api/src/services/catalog.service.ts`, `infra/terraform/modules/environment/storage.tf` (all in full); `apps/api/src/services/courses.service.ts` (420-459); and grep extracts only of `apps/api/src/providers/video/mux.ts`, `infra/terraform/modules/environment/iam.tf`, `variables.tf` and `api.tf`.

## Structural reviewer

**Status:** completed. 0 Blocker, 2 Major, 7 Nit.

**The reviewer's summary**

Verdict: no Blockers, 2 Major, 7 Nit. The review is complete for the target range.

Blueprint check against the standard: all five required areas are present.

- Problem Statement: "The Problem" (line 56)
- Goals & Non-Goals: "Goals" (90) and "Non-Goals" (134)
- Proposed Architecture: "Technical Plan (Architecture)" (382)
- Risks & Mitigations: line 954
- Alternatives Considered: line 993

Other checks that passed:

- Heading hierarchy is sequential (H1 > H2 > H3 > H4) with no skipped levels.
- All three code fences are closed, and all tables are well formed.
- Alternatives are lettered A to AK without a gap, and each has Pros, Cons and Reason for Rejection.
- In-document anchors resolve: `#open-questions`, `#the-agreement-sentence`, `#future-improvements`.
- Stated counts match their lists (four things, five departures, seven columns, eight outcomes, seven states, six checks, three commands).
- The link targets for ADR 004, ADR 005 and the three sibling designs exist. I did not confirm that `../spec.md` exists.

### structural-2-1. Open Questions holds an unordered decision log under a pseudo-heading - Severity: Major

**Affected scope:** "## Open Questions", lines 169-304. Inbound references at lines 40-41, 415, 847, 889, 905, 936 and about 45 "Question n" citations.

**Discrepancy:** The section reads "None." (174), then a plain-text "Answered:" label (176) that is not a heading, then 18 entries over about 130 lines. The entries appear in the order 13, 10, 8, 9, 1, 2, 3, 4, 5, 12, 6, unnumbered, unnumbered, 7, 11, unnumbered, unnumbered, "the brief's Question 9".

- Five entries have no number and cannot be cited: "A failed delete" (274), "The off switch and a stale choice" (280), "The default clip" (293), "The data model" (297) and the brief's Question 9 (302).
- Line 171 says the question numbers are "this design's own", yet the list follows no visible order. Links whose text names one question (for example `[Question 8](#open-questions)`) land on the section top.

**Rationale:** The rest of the document uses this section as its index of decisions, so each citation forces a linear scan. A reader skimming headings sees "Open Questions: None" and misses the record. The entries also rely on mechanisms defined 100 to 400 lines later (refresh, the catalog check, the source record, the 3 MB cap, the content-type check; "Terms" starts at 384).

**Sibling comparison:** learner-chinese.md (149-165) and learner-teach-banner.md (132-149) keep questions in numeric order, about 15 lines, with no "None./Answered:" split.

**Expected:** numeric order, a number on every entry, "Answered" as an H3 (or a separate "Decisions" H2), and per-question anchors.

### structural-2-2. Reason-for-Rejection lines that give an attribution and no trade-off - Severity: Major

**Affected scope:** "## Alternatives Considered". Alternative E (1055), Alternative O (1162), Alternative Q (1184). To a lesser degree B (1018-1019), I (1096), N (1153-1154), P (1174-1175), S (1205), T (1214), X (1259), Z (1283-1284), AG (1366-1367), AH (1378-1379), AK (1413-1414).

**Discrepancy:** The standard (feature-spec-standard.md, lines 19-21) says rejection rationales "must state concrete technical or scope trade-offs and must not attribute a rejection to a maintainer without linking their issue, discussion, or PR."

- E reads "Rejected by author in the brief." O reads "Rejected by author (Question 3)." Q reads "Rejected by author (Question 1)." None states a trade-off, and the pointers go to the unanchored Open Questions list or to the brief as a whole.
- The lesser group says only "in favour of <the chosen option>", with the trade-off left to be inferred from the Cons bullets.

**Rationale:** The template's own slot for the rationale is empty or circular in these entries. The Cons bullets do carry the substance, so this is a compliance gap in the rationale field, not a missing evaluation of alternatives.

**Caveat:** whether "author" counts as "maintainer" under the standard is a judgement call. I read it as the same rule, because the entries attribute the decision to a person and link no record.

### structural-2-3. The Mux-check gate is described in three places in conflicting tense - Severity: Nit

**Affected scope:** "### Order of release" (893-894), "### Checks before any code is written" (912-936), Open Questions Questions 10 and 13 (178-224).

**Discrepancy:** Line 893 states a standing precondition: "No code is written until the six checks have been made and their results are in this design (item 1)". Lines 914-932 are still written as a plan, including "Checks 4 to 6 decide how the 'pick a different moment' control behaves". A bold postscript at 934-936 then says checks 4 to 6 are unanswered.

- Question 13 settles that behaviour by a conservative estimate, so line 930 is superseded text. Within lines 1-1457 nothing says the gate is open; that statement exists only at line 1497 in the implementation plan.
- "item 1" (893, 915) refers to that plan with no link.

**Rationale:** Status was appended and the sections were not rewritten, so a reader of either section alone gets the wrong state.

### structural-2-4. The "Fixes weighed after the review" group is organised by process history - Severity: Nit

**Affected scope:** lines 1328-1414.

**Discrepancy:** Every other H3 group under Alternatives is by subject. This one is by when the alternative arose.

- Its intro (1330-1332) names two review findings: turning off could be refused, and a failed delete could not be retried. Alternatives AJ and AK (1392-1414) concern the Mux limit (Question 13) and match neither.
- "The review" and "a small workflow" are not linked or defined.

**Expected:** AE and AF under the Teach control or "Who may change the clip", AG to AI under "When the clip is made" or "The data model", AJ and AK under a limit group. Alternatively, widen the intro.

### structural-2-5. CUJ 7 breaks the Given/When/Then shape - Severity: Nit

**Affected scope:** "### CUJ 7", lines 359-372.

**Discrepancy:** All other CUJs have exactly three bullets. CUJ 7 adds a fourth, "If it was the course's only video:" (370-372), which is a second scenario with its own outcome.

**Expected:** split it into its own CUJ, or fold it into the Then bullet.

### structural-2-6. Hard-wrap inconsistencies from unreflowed edits - Severity: Nit

**Affected scope:** prose lines over the 100-column wrap at 242, 514, 575 and 649; short-wrapped lines at 94-95, 633 and 785-787.

**Rationale:** The rest of the prose is wrapped at 100 columns. These render correctly but mark edits that were not reflowed.

### structural-2-7. External references are code spans, not links - Severity: Nit

**Affected scope:** "## Additional Resources", lines 1426-1431.

**Discrepancy:** The two Mux guides and the Expo page are given as backticked URLs, which do not render as links. Every other reference in the list is a Markdown link.

**Sibling comparison:** learner-teach-banner.md line 672 links the Expo docs as `[Expo WebBrowser](https://...)`.

### structural-2-8. Orphaned comment in the `CourseView` block - Severity: Nit

**Affected scope:** "### The control in Teach", lines 826-830.

**Discrepancy:** The comment `// the usable live videos, in order` (830) sits on its own line after the `changesLeft` comment. It reads as a second description of `changesLeft`, but it describes `videos` (826).

### structural-2-9. Departure lists disagree between the Overview and "Records and rules" - Severity: Nit

**Affected scope:** lines 40-54 against 951-952.

**Discrepancy:** The Overview lists five departures from the brief, four of them against decision 9. "Records and rules" says the design supersedes decision 9 "where the two differ (on by default; made at more moments than Support's approval)", which names two.

**Rationale:** The parenthetical reads as a complete list. "Not remade by every edit" and "no media row" are missing from it.

#### What the structural reviewer checked and did not flag, and what it read

**Files read:** agents/structural.md (full); resources/document_standards/feature-spec-standard.md (full); docs/designs/learner-hover-preview.md lines 1-1457 (full) plus 1458-1516 for cross-checks; learner-chinese.md and learner-teach-banner.md by heading outline and excerpts only (Open Questions and Additional Resources); learner-main-page-improvements.md by heading outline only; ADR 004, ADR 005 and spec.md not read.

## Style reviewer

**Status:** completed. 0 Blocker, 6 Major, 14 Nit.

**The reviewer's summary**

Standard: none supplied. Findings: 0 Blocker, 6 Major, 14 Nit.

The prose is plain and mostly hedge-free. The defects are claims that outrun their evidence, text left in pre-check tense, drafting history in place of current state, and repetition that has drifted.

### style-2-1. "Open Questions: None" is contradicted by the text under it - Severity: Major

**Affected scope:** Open Questions, lines 169-174, 190-191; Non-Goals, 153-155; Checks before any code is written, 934-936.

**Discrepancy:** line 174 says "None." Line 190 says "The message to Mux is still worth sending", with no owner or date. Lines 934-935 say checks 4 to 6 "are unanswered". Lines 153-155 leave the full teacher agreement's wording to "whoever drafts it".

**Rationale:** three unresolved items sit under a heading that says nothing is unresolved. "Still worth sending" is a subjective judgment with no operator decision attached. Action: CALIBRATE. Either list them as open with an owner, or state each as a closed decision ("not sent; the design does not depend on the reply").

### style-2-2. Release gate and check text left in pre-check tense - Severity: Major

**Affected scope:** Order of release, lines 893-894; Checks before any code is written, lines 914-936.

**Discrepancy:** "No code is written until the six checks have been made and their results are in this design" and "If the first check fails, the design ... comes back for revision" read as pending. Line 934 then reports them made, with three unanswered. Lines 930-931 say "Checks 4 to 6 decide how the 'pick a different moment' control behaves", but Question 13 (178-191) decided that without them. Line 914 requires "real lesson footage"; the calls used "a flat-coloured animated lesson" (194-195), and line 270 separates that from "filmed footage".

**Rationale:** the spec range never says whether the gate is satisfied. Only the out-of-scope plan does (line 1497, "the gate is open"). A reader cannot tell whether the stated precondition was met. Action: CALIBRATE. Rewrite as a record of what was run, on what footage, and what the gate now is.

### style-2-3. Goal headings state absolutes that their own bodies narrow - Severity: Major

**Affected scope:** Goals, lines 98-110 (Goal 2), 114-116 (Goal 4), 117-119 (Goal 5), 123-126 (Goal 7).

**Discrepancy:**

- Goal 2, "Teachers have agreed to previews": nothing records acceptance (151-152, 854), the condition is "not something the code checks" (104-105), and two groups never see the sentence (857-860).
- Goal 4, "download nothing extra": the next sentences add the address in every catalog response.
- Goal 5, "can be cached later without change": Goal 7 relies on a check made each time the catalog is read.
- Goal 7, "A clip never outlives its video on the course": the file stays public in storage until a later refresh (371-372, 675-676) and in browsers for up to a year (990-991).

**Rationale:** goals are what verification is measured against, so a heading must be the verifiable statement. Action: CALIBRATE each heading to what the body delivers. For Goal 7: "The catalog stops returning a clip whose video has left the course." For Goal 2: "The application pages state the preview term before any teacher applies."

### style-2-4. Tested-behaviour claims are broader than the evidence - Severity: Major

**Affected scope:** Open Questions, lines 192-193, 197-204; Checks, line 934; Risks table, line 963.

**Discrepancy:** "the design works as written" and "Checks 1 to 3 passed" rest on one 60-second flat-coloured animation, with calls mostly at 320 pixels. The design's width is 480, with one sample (242,552 bytes, lines 219-220, 267-268). "The 3 MB cap leaves more than ten times the room" (202-203) is a 320-pixel figure. The document's own 480-pixel estimate of up to 0.42 MB (269) gives about seven times, and filmed footage is unmeasured (270).

**Rationale:** the caveats exist (223-224, 267-270) but sit away from the summary claims. Action: CALIBRATE the summary sentences to "one animated video; 56 calls at 320 pixels, one at 480", and RELOCATE the 480-pixel and filmed-footage caveat next to the 3 MB claim.

### style-2-5. Open Questions narrates drafting history, out of order, with superseded values first - Severity: Major

**Affected scope:** Open Questions, lines 176-304; also 1107-1109, 1129-1131, 1247-1250, 1328-1332.

**Discrepancy:** answers run 13, 10, 8, 9, 1, 2, 3, 4, 5, 12, 6, three unnumbered, 7, 11, two unnumbered, then the brief's 9. A reader meets "the default clip as it was then (... width 320 ...)" at line 197 before the 480-pixel decision at 254-265. Withdrawn answers are told as events: Question 7 ("answered ... and withdrawn the same day", 285-287); "The author first chose to ask Mux, then chose not to wait" (180); "The author made the choice twice ... the goals were then rewritten" (1107-1109); "A small workflow proposed fixes and attacked each one" (1331).

**Rationale:** sequence-of-events prose makes the reader rebuild the current decision from its history. Action: state each decision once in its current form, in numeric order, and reduce superseded answers to one line each or drop them. Questions 7 and 11 can merge. "Attacked" and "small workflow" are undefined process jargon.

### style-2-6. The same facts are restated across sections, and copies have drifted - Severity: Major

**Affected scope:** document-wide; representative lines below.

**Discrepancy:**

- "Production is not deployed / no teacher has applied": lines 76-77, 102, 148, 228-229, 288-289, 1130-1131, 1142.
- Failed delete is retried at the next refresh, teacher not told, only the log shows it: 109-110, 274-276, 571, 584-585, 627-631, 972, 1449-1450.
- Old clip keeps showing; chosen over retiring it first: 276-279, 631-635, 973, 1357-1367.
- File stays "at an address the catalog no longer gives out": 371-372, 675-676, 989.

**Rationale:** repetition lengthens a 1,457-line spec and the copies no longer agree. Loosening the limit is "changing constants" (191) but "one function" (964). The departures from the brief number five (40-54) but two (951-952). Action: state each fact once in the Technical Plan and cross-reference by section from Goals, Risks and Alternatives.

### style-2-7. Unverified behaviour stated as fact - Severity: Nit

**Affected scope:** The learner card, lines 720-722; Future Improvements, 1452-1454.

**Discrepancy:** 720-722 says a function-valued `style` "is dropped by the `Link asChild` wrapper". 1453-1454 says the wrapper "appears to drop" it, "Read from source, not run". The function-valued style exists at `apps/learner/src/components/CourseCard.tsx` line 19; the dropping is not evidenced.

**Action:** CALIBRATE 720-722 to the hedged form.

### style-2-8. "Checked" used for a check not yet made - Severity: Nit

**Affected scope:** Risks table, lines 968-969.

**Discrepancy:** "Checked by hand in Chrome, Safari and Firefox in the learner PR" is planned work. Row 963 uses "Checked by real calls on 2026-11-19" for completed work.

**Action:** CALIBRATE to "To be checked by hand".

### style-2-9. "A few dozen bytes per card" - Severity: Nit

**Affected scope:** Goal 4, line 116.

**Discrepancy:** the key format at lines 604-605 (`public/previews/<courseId>/<uuid>.webp`) is 94 characters before the origin, the `/api/files/` path and the JSON field name, so the address is over 120 bytes.

**Action:** CALIBRATE to "about 150 bytes" or a computed figure.

### style-2-10. The 10-second bound is stated for the whole request - Severity: Nit

**Affected scope:** CUJ 8, line 378; When the clip is made, line 684.

**Discrepancy:** "at most 10 more seconds" and "up to 10 seconds slower". The timeout covers only the Mux request (548). Storage writes, deletes and row updates are added. Risk row 965 has it right: "The timeout bounds the Mux fetch".

**Action:** CALIBRATE both lines to match row 965.

### style-2-11. Predictions and frequencies without evidence - Severity: Nit

**Affected scope:** lines 84-85, 270, 966, 1016, 1025, 1095, 1257.

**Discrepancy:** "most learners are likely on phones" (85) becomes "where most learners are" (1025). "The pilot has a handful of teachers" (84) is present tense, while 288-289 says no teaching profile exists. "So most cards would have none" (1016), "few cards would have one" (1095), "Second 0 is often a title card" (1257) and "Filmed footage will be larger" (270, 966) have no data behind them.

**Action:** CALIBRATE to "may", "can" or "is expected to", and keep the hedge consistent with line 85. Lines 1106-1107 ("rests on the author's judgement") are the model.

### style-2-12. "Have one answer that fits the goals" - Severity: Nit

**Affected scope:** Decisions made while drafting, lines 415-416.

**Discrepancy:** several of these decisions have weighed alternatives with stated pros: U (decision 1), R (2), AD (5), AA and AB (6), AC (7).

**Action:** CALIBRATE to "decided while drafting and not put to the author; alternatives are under Alternatives Considered".

### style-2-13. Departure list is inconsistent between sections - Severity: Nit

**Affected scope:** Overview, lines 40-54; Records and rules, 951-952.

**Discrepancy:** the Overview lists five departures, four of them from the brief's decision 9. Records names two "where the two differ".

**Rationale:** the brief is "left as written", so this line is the supersession record and should be complete or point to the Overview list.

### style-2-14. One term, several referents; one concept, several terms - Severity: Nit

**Affected scope:** lines 282, 341, 368, 502, 902, 964, 973, 1340; lines 25, 107, 335, 339, 931, 961, 1090, 1193.

**Discrepancy:**

- "The card" means the learner course card, Teach's "Hover preview" card and Support's "Course page" card. In CUJ 4's acceptance clause (341, "The card shows the new clip") the referent is unclear.
- The start is called "start time", "start second", "start", "second" and "moment".
- "So the three can't disagree" (502) follows four named parties (refresh, course view, Teach, Support).

**Action:** use "course card" and "Hover preview card", and the defined "start second" throughout.

### style-2-15. Subjective or idiomatic wording - Severity: Nit

**Affected scope and suggested replacements:**

- 72, "That is a new rule about who sees what": name ADR 004's enrolment rule.
- 115, "pays no data for it".
- 178 and 1401, "conservative estimate": it is an assumption that the documented limit is enforced, not an estimate.
- 202, "about 3 seconds in the middle": say median.
- 280 and 793, "the rule is the server's": say "enforced on the server".
- 303, "the reviewers' belief holds": state the fact; a fresh reader does not know the reviewers.
- 617, "One rule holds the steps together".
- 962, "from time to time": give a cadence or say none is set.
- 966, "single small API task": give the size.
- 1075-1076, "far more moving parts".
- 1305-1306, "simpler to reason about".

### style-2-16. Approximate or ambiguous counts - Severity: Nit

**Affected scope:** lines 1171, 1376.

**Discrepancy:** "About eleven call sites" pairs a hedge with an exact number. "A seventh column" (Alternative AH) is ambiguous when the design already adds seven columns, six of them on `courses`.

### style-2-17. Goal 1 wording - Severity: Nit

**Affected scope:** Goals, lines 93-96.

**Discrepancy:** "after a short delay" is unmeasurable where CUJ 1 gives 400 milliseconds. "It plays for 12 seconds, three times through for a 4-second clip" implies clip length varies; it is fixed at 4 seconds (400, 531).

### style-2-18. "Nothing shows it" - Severity: Nit

**Affected scope:** Order of release, lines 898-899.

**Discrepancy:** the same PR adds the stored clip to Teach's card (768) and Support's page (840-841).

**Action:** CALIBRATE to "no learner card shows it", as line 902 has it.

### style-2-19. New-text inventory omits the approval email - Severity: Nit

**Affected scope:** Overview, lines 36-38; referenced at 331-332, 379, 902-903, 960-961.

**Discrepancy:** the Overview accounts for the agreement sentences and the Teach control but not the approval email's preview sentence. The spec range gives neither its wording nor its language; the plan mentions only "the preview paragraph" (line 1894).

### style-2-20. Mixed units and line wrapping - Severity: Nit

**Affected scope:** lines 200-221, 257-269, 1239-1246 (units); lines 94-96, 242, 514, 575, 633, 649, 785-787 (wrapping).

**Discrepancy:** the same measurements appear as bytes, KB and MB (137,772 bytes; 142 KB; 0.14 MB). The listed lines break the file's 100-column wrap or are wrapped short.

#### What the style reviewer checked and did not flag, and what it read

**KEPT (reviewed, not findings)**

- Lines 78-83 and 223-224: dated Mux documentation checks and the "observation, not something Mux documents" caveat.
- Line 150: the revise-if-production-opens-first condition.
- Line 642: "Nothing calls `storage.delete` today". No call exists in `apps/api/src` outside the fake driver's own map.
- Lines 1430-1431: the Expo SDK 58 citation, which matches `apps/learner/package.json`.

**Read in full:** agents/style.md (all); docs/designs/learner-hover-preview.md lines 1-1457 (all, in four parts), plus lines 1458-1532 of the out-of-scope plan. Context consulted by targeted search only, not read in full: docs/designs/learner-main-page-improvements.md (lines 262-273 and matches), docs/spec.md (line 63), apps/learner/src/components/CourseCard.tsx, apps/learner/package.json, apps/api/src/providers/storage, packages/db/src/schema/courses.ts. Not opened: learner-chinese.md, learner-teach-banner.md, ADR 004, ADR 005; no finding depends on them.
