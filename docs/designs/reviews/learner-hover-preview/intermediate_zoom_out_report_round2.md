# Stage 8: Intermediate Zoom Out Review (round 2)

- **Target:** `docs/designs/learner-hover-preview.md`, full file (lines 1 to 2309)
- **Date:** 2026-11-19
- **Round:** 2. The round 1 report is in `docs/designs/reviews/learner-hover-preview/`.
- **Reviewer:** `egm-zoom-out`, a new instance with no memory of Stage 5 (completed)
- **Given to it:** the six reading-list files, and the three reports of this round:
  `zoom_out_report_round2.md`, `comprehension_report_round2.md` and `critic_report_round2.md`
- **Result:** 0 Blocker, 7 Major, 11 Nit. One finding (I1.6) holds three Nits and two
  findings (I2.4, I2.5) each hold a Major part and a Nit part; each is counted once here, at
  its higher severity. The reviewer's own count is 6 Major and 9 Nit.

The design was not edited between Stage 5 and this stage. So the reviewer was given two jobs:
find what Stage 5 missed, and judge the additions that Stages 6 and 7 recommended.

Identifiers: `I1.n` are fresh findings and `I2.n` are judgements of earlier recommendations.
`Z` and `C` identifiers are in `zoom_out_report_round2.md`, `R` identifiers in
`comprehension_report_round2.md`, and `design-2-n`, `structural-2-n` and `style-2-n` in
`critic_report_round2.md`.

## The reviewer's summary

Context is sufficient. The reviewer says three changes each remove machinery and between them
dissolve most Stage 6 and Stage 7 findings:

- retire a stale clip in the one function every direct edit returns through, and drop the
  catalog's read-time check (I1.1, I2.2);
- make the global switch mean "nothing wanted", so the existing backfill is the purge (I2.1);
- drop the per-video fetch count (I2.3).

## All findings by severity

| ID    | Severity                                  | Finding                                                                                 |
| ----- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| I1.1  | Major                                     | Question 1 was decided on a call-site count the code does not have                      |
| I2.1  | Major                                     | The global-switch recommendations conflict; one change replaces them                    |
| I2.2  | Major                                     | Removed-video recommendations: one removes machinery, two add it                        |
| I2.3  | Major                                     | The counter recommendations maintain machinery that should go                           |
| I2.4  | Major (re-measure), Nit (the rest)        | Gate: support the re-measurement, reject the new state                                  |
| I2.5  | Major (release condition), Nit (detector) | Consent: take the checklist line and the named condition, not the detector              |
| I2.10 | Major                                     | Document structure: two recommendations pull in opposite directions                     |
| I1.2  | Nit                                       | One PATCH carries three intents                                                         |
| I1.3  | Nit                                       | The year-long browser copy is inherited from the file route, not required by the design |
| I1.4  | Nit                                       | The 12-second cap has no stated reason                                                  |
| I1.5  | Nit                                       | New evidence for Z1, not a repeat                                                       |
| I1.6  | Nit (each)                                | Disagreements with Stage 5                                                              |
| I2.6  | Nit                                       | Audit ordering: the recommendation is not free; a simpler one exists                    |
| I2.7  | Nit                                       | Picker findings: restrict, do not add a rule                                            |
| I2.8  | Nit                                       | Rejection rationales: write them after the removals                                     |
| I2.9  | Nit                                       | Old versions in the bucket                                                              |
| I2.11 | Nit                                       | Local Mux set-up already exists                                                         |
| I2.12 | Nit                                       | Remaining items                                                                         |

## Claims checked by the main session

Checked against the code after the reviewer returned. The other findings have not been
checked.

- **I1.1: confirmed.** `apps/api/src/services/courses.service.ts` has a private function
  `edited(courseId, scope)` at line 392, and ten methods return through it (lines 545 to 780).
  The design's Alternative P counts "about eleven call sites" and does not mention this
  function.
- **I2.9: confirmed** in Stage 7 (`design-2-9` in `critic_report_round2.md`).

## Where this reviewer disagrees with earlier reviewers

- **With C1 (Stage 5):** C1 would keep the catalog check and add a delete at edit time. This
  reviewer says that is the option with the most machinery, and to pick one.
- **With C2 (Stage 5):** C2 would have Teach send "Make clip" when the page opens. This
  reviewer calls it speculative at pilot size.
- **With C4 (Stage 5):** C4 would keep a private copy of fetched clips. This reviewer sides
  with Z3 and would drop the count.
- **With `design-2-1` (Stage 7):** it would add a check in the file route and a purge command.
  This reviewer says the existing backfill can do the purge if "switched off" means "nothing
  wanted".
- **With `design-2-6` (Stage 7):** it would add a reset for the count. This reviewer says the
  count should go.
- **With `design-2-10` and part of `design-2-4` (Stage 7):** it would add an alarm and a
  consent detector. This reviewer says a line of SQL in the runbook is enough for each.
- **Between `structural-2-1` and `style-2-5` (Stage 7):** one asks to number and anchor the
  decision log, the other to cut it down. This reviewer says cut it down and move the history
  to ADR 011.

## Part 1: Fresh high-altitude findings (not in the Stage 5 report)

### I1.1. Question 1 was decided on a call-site count the code does not have

**Severity:** Major

**Affected scope:** Open Questions, Question 1 (231-239); "When the clip is made" (671-682); "The catalog" (703-705); CUJ 7 (359-372); Risks rows 962 and 978; Alternative P (1166-1175).

**Reasoning:**

- Alternative P is rejected for "about eleven call sites" and "a future edit path that forgets the call". Z8 counted three sites and C1 one file. The code is narrower than both.
- Every content-edit method in apps/api/src/services/courses.service.ts returns through one private function, `edited(courseId, scope)` (line 392; callers at 545, 555, 578, 603, 645, 683, 719, 731, 754, 780).
- `scope === null` already marks a direct edit of live rows. `edited` calls `loadCourseView`, which for that scope already loads the live lessons, items and media.
- apps/api/test/schema-guard.test.ts (line 24) lets only that file and change-sets.service.ts touch the raw content tables. The change-set approval already calls `refresh`.
- So a Mux-free retire (hide, delete, forget when the source media is no longer a live video item) placed once in `edited` covers every direct edit, including future ones in that file. The "forgotten call site" con is the only reason the catalog check exists.
- With it, the catalog list keeps today's query (`liveLessons: { columns: { id: true } }`), `previewIsShown` loses its `videoMediaIds` input, and CUJ 7's lingering file, risk row 978 and the Goal 7 heading problem go away.
- Trade to state: the hide is a separate statement after the edit commits. If it fails, the clip stays advertised until the next refresh. That is the price of dropping the read-time check.
- Ask: re-weigh Question 1 with this fact and choose one mechanism, not both.

### I1.2. One PATCH carries three intents

**Severity:** Nit

**Affected scope:** "The control in Teach" (783-801); item 12 (1771-1797); item 16 cases at 1915-1935; Alternatives AE and AF (1334-1355).

**Reasoning:**

- The course-details PATCH now means "save the setting", "turn off" and "make the clip again". The third is a request that carries a preview field with unchanged values.
- The special rules follow from that overload: only a new value is checked; turning off ignores the other fields; "Make clip" leaves out the switch so an old tab can't turn a preview back on. About five integration cases cover them.
- What it saves is one row in the role table. `CoursesService.update` today is plain column writes with no audit row or external call (lines 428-454).
- This dissolves under Z2: with no picker the setting is one boolean.

### I1.3. The year-long browser copy is inherited from the file route, not required by the design

**Severity:** Nit

**Affected scope:** "Three details" (639-641); Risks row 960; "Rollout and rollback" (990-991).

**Reasoning:**

- "Browsers keep what they fetched for up to a year" is written as unavoidable. It comes from apps/api/src/routes/files.ts (lines 30-33), which gives every `public/` key `max-age=31536000, immutable`.
- A cover image has no recall requirement; a clip of paid footage does. Each clip already gets a new key, so nothing in the design needs the long lifetime except repeat-view load on the API.
- No machinery is needed. State it as a chosen trade (API load against recall time).
- If a shorter lifetime for `public/previews/` is wanted, it is the same prefix condition that design-2-1 proposes for the file route; do not add two.

### I1.4. The 12-second cap has no stated reason

**Severity:** Nit

**Affected scope:** Goal 1 (94-95); CUJ 1 (314); "The learner card" (739-742); item 23 (2183-2188); item 25 (2229-2230).

**Reasoning:**

- The brief asks for a delay and a return on mouse-out. The cap adds a second timer, load tracking and two test cases.
- A reason exists (keyboard focus can rest on a card indefinitely) but the document does not give it. State it or drop the cap.

### I1.5. New evidence for Z1, not a repeat

**Severity:** Nit

**Affected scope:** Alternatives D and E (1034-1055); report findings design-2-1, design-2-2, design-2-9, design-2-10.

**Reasoning:**

- Four Stage 7 findings are about files that stay served after "off". That is a present-day cost of store-once. Under D or E "off" takes effect within a token's lifetime and needs no delete code.
- Alternative D's and E's Pros do not record this. The re-weighing Z1 asked for is incomplete without it.

### I1.6. Disagreements with Stage 5

**Severity:** Nit (each)

- C1, "keep the catalog check as the safety net and add the retire": this is the option with the most machinery. Given 1.1, pick one.
- C2, Teach sends "Make clip" on mount: it adds a write and a Mux wait to a page view, makes fetches without a person choosing, and collides with the Details form remount (814-816). Once 1.1 is in place, the state left unrepaired is "no clip", which is safe. Speculative at pilot size.
- C4, a private copy of fetched bytes: a second storage tier to protect the counter Z3 would delete, and it keeps a teacher's footage after "off", against Goal 2. I side with Z3.

## Part 2: Judgement of the Stage 6 and Stage 7 recommendations

### I2.1. The global-switch recommendations conflict; one change replaces them

**Severity:** Major

**Concerns:** design-2-1 (all three recommendations), style-2-3 (Goal 8), with Z6, C1 and C5.

**Reasoning:**

- design-2-1 asks for a prefix gate in the file route tied to `COURSE_PREVIEWS`. It is cheap: `Deps` carries `env` (apps/api/src/deps.ts line 10) and the route receives `deps`. But a generic route learns one feature's prefix, and C5 notes it stops working behind a CDN.
- design-2-1 also asks for a `previews purge` command. That is a fourth command, where Z7 already found two of three without a present need.
- Z6 asks to drop the switch altogether. The three cannot all be taken.
- Simpler: when `COURSE_PREVIEWS` is off, `refresh` treats it as "nothing wanted". Switching off and running the existing backfill then hides, deletes and forgets every clip.
- This removes the retire-before-paused ordering rule (589-592), the "old clip shows again when switched back on" behaviour (631-633, row 973) and the "stored files stay" caveats (880-882, 987).
- It adds nothing. The backfill is already the documented step after switching back on (867-869). The revert path becomes one runbook line: switch off and backfill before reverting.
- Its only cost is a refetch per course on switching back on, which matters only while the fetch count exists (2.3).

### I2.2. Removed-video recommendations: one removes machinery, two add it

**Severity:** Major

**Concerns:** design-2-2, design-2-8, design-2-10, style-2-3 (Goal 7), structural-2-5, with Z8 and C1.

**Reasoning:**

- design-2-2's main recommendation (retire on direct-edit paths) removes machinery when done as in 1.1. It also makes Goal 7's heading true, returns CUJ 7 to three bullets and removes the need for a new risk row.
- design-2-2's fallback (a clean-up action in `no_video` and `pending`, plus a backfill cadence) adds a button-table row and a manual routine. Take it only if the main one is declined.
- design-2-8 (`EXISTS` in place of loading items) is feasible; apps/api/src/services/catalog.service.ts already uses `exists(...)` at lines 86-101. But it optimises a read that 1.1 deletes. Do not do both.
- design-2-10 (a log metric or alarm): the infra has none today. A search of infra finds no metric filter, alarm or scheduled rule. The first alarm in the system for a state that the next refresh repairs is disproportionate.
- design-2-10's other option, extending `previews count`, piles onto a command Z7 questioned. If a signal is wanted, one SQL line in the runbook (`preview_key` set, source empty) is enough.

### I2.3. The counter recommendations maintain machinery that should go

**Severity:** Major

**Concerns:** design-2-6, R3, R14, the `changesLeft` half of R2, with Z3 and C4.

**Reasoning:**

- design-2-6 asks for a reset step or command, a second `limit` wording and skipping cache hits. Each adds to a counter guarding a limit that 59 fetches never met.
- A reset is an operator override of a lock the design imposes on itself. Cache-hit detection depends on a response marking Mux does not document (211-213, 223-224).
- R3 needs a second `limit` sentence; R14 needs `check` to respect or skip the count.
- Dropping `preview_fetches` dissolves all of them, plus the `limit` outcome and state, Alternative AK, two test cases and the non-atomic check. A Mux refusal already becomes `failed` and `pending` (552-553, 599-600), and the 10-second step bounds distinct clips.

### I2.4. Gate: support the re-measurement, reject the new state

**Severity:** Major (re-measure), Nit (the rest)

**Concerns:** design-2-3, style-2-2, style-2-4, structural-2-3, R11.

**Reasoning:**

- Re-running check 2 at 480 pixels on filmed footage is evidence, not machinery. It is the only Stage 7 item that could change a constant (the 3 MB cap, the 10-second timeout).
- Staging can supply the footage: `testMode` is `!env.isProd` (apps/api/src/providers/video/index.ts line 24) and ADR 005 says staging runs with `NODE_ENV=production`.
- "Specify what the teacher sees when a clip is permanently over the cap" would add a state or reason field for a case not shown to exist. Measure first; if filmed clips approach the cap, change a constant.
- The tense findings need one edit: replace the three gate passages (893-894, 912-936, 1491-1514) with a single dated record. Run the re-check first, then write it once.

### I2.5. Consent: take the checklist line and the named condition, not the detector

**Severity:** Major (release condition), Nit (detector)

**Concerns:** design-2-4, style-2-3 (Goal 2), style-2-1.

**Reasoning:**

- The checklist line is cheap. docs/runbooks/deploy.md already has "Checklist before the first real transaction" (lines 72-81).
- The detector with a configured consent-from date is a new configuration value, a query and a test, for a population the design says is zero. `profiles.appliedAt` exists (packages/db/src/schema/profiles.ts line 59), so one SQL check at the first production deploy answers it with no code.
- The sentence and the clip-making code ship in the same PR, so the condition reduces to "this PR is in the first production deploy".
- Making "offline agreement updated" a named condition with an owner adds no machinery. docs/spec.md line 77 shows that agreement grants only a hosting licence. It is a real open item and belongs under Open Questions (style-2-1), together with the message to Mux and the filmed-footage measurement.
- The two extra risk rows are document-only.

### I2.6. Audit ordering: the recommendation is not free; a simpler one exists

**Severity:** Nit

**Concerns:** design-2-7.

**Reasoning:**

- "One transaction for the setting and its audit row" needs a new helper: `recordAudit` writes through `deps.db` and takes no transaction (apps/api/src/services/audit.service.ts lines 5-25).
- `setPrice`, the precedent the design cites, updates and then audits without a transaction (courses.service.ts lines 461-469).
- Simpler: use the approvals' order everywhere: row update, audit row, then refresh. The design's reason for the reverse order (661-662) describes a state it already tolerates: `preview_enabled = false` hides the clip at once and the next refresh deletes the file.

### I2.7. Picker findings: restrict, do not add a rule

**Severity:** Nit

**Concerns:** R1, R2, R13, with Z2.

**Reasoning:**

- R2 can be closed by allowing a stored start only together with a stored video. With "Default" selected, the start select offers only "Default"; the first video is in the list anyway, so nothing is lost.
- That removes a rule branch (1581-1584), a test (1620) and the case where a start silently moves to a different video, and makes line 514 true.
- R13: state that the row keeps the value and the resolved start is lowered. Do not add a refusal code.
- R1 is a document fix. All three dissolve under Z2.

### I2.8. Rejection rationales: write them after the removals

**Severity:** Nit

**Concerns:** design-2-5, structural-2-2.

**Reasoning:**

- Document-only, and supported. But AE, AF, AJ, AK, N and O disappear under Z2 and Z3; do not write rationales for entries about to be deleted.
- For Alternative Q, the weighing must not become adoption. The infra has no scheduled resource and is applied by hand (ADR 005). After 2.1 to 2.3, three of the four risks design-2-5 cites shrink, and the rejection is easy to state.

### I2.9. Old versions in the bucket

**Severity:** Nit

**Concerns:** design-2-9.

**Reasoning:**

- Confirmed: infra/terraform/modules/environment/storage.tf enables versioning under `protect_data`, and its only lifecycle rule aborts multipart uploads.
- A prefix-scoped expiry rule is a few lines of Terraform and no code. It is proportionate if Goal 2 keeps "deletes the stored file". The alternative is to reword the goal. Either, not both.

### I2.10. Document structure: two recommendations pull in opposite directions

**Severity:** Major

**Concerns:** structural-2-1, style-2-1, style-2-5, style-2-6, structural-2-4, structural-2-9, style-2-13, style-2-16, R5, R7, R12, R15, with Z4.

**Reasoning:**

- structural-2-1 asks to number, order and anchor all 18 entries of the decision log. style-2-5 asks to reduce it to current decisions. Reduce: the history belongs in ADR 011, which the design already plans (940-943). Do not add anchors to text that is about to move.
- style-2-6 (state each fact once) fixes R5, R12, R15, structural-2-9 and style-2-13 as a class. Correcting each count separately leaves the duplication that produced them.
- For Goal 5, delete "so it can be cached later" and the matching Non-Goal clause (163-164). That satisfies Z1's ask, style-2-3 and the third bullet of design-2-8.

### I2.11. Local Mux set-up already exists

**Severity:** Nit

**Concerns:** R4.

**Reasoning:**

- docs/runbooks/mux.md sections 1 and 2 cover the credentials, `VIDEO_DRIVER=mux`, the webhook tunnel and the polling fallback. The fix is one link from item 22 and the Verification Plan, not new documentation or a seeded preview.
- One fact the design misses: mux.md lines 13-14 say test assets are deleted after 24 hours. Risk row 970 names the watermark and the 10-second length only. Hand checks in items 22 and 26 must use videos uploaded the same day, or "Make clip" and the backfill fail.

### I2.12. Remaining items

**Severity:** Nit

**Concerns:** style-2-7 to style-2-12, style-2-14, style-2-15, style-2-17 to style-2-20, structural-2-6 to structural-2-8, R6, R8, R9, R10.

**Reasoning:** wording and layout only. None adds or removes machinery; no zoom-out objection.

## Review completeness

**Checked and confirmed while judging:** no `fetch(` call exists in apps/api/src, so "the API's first plain HTTP request" holds and there is no HTTP helper to reuse.

**Files read in full:** the persona (agents/zoom_out.md); the standard (resources/document_standards/zoom-out-standard.md); the target (all 2,309 lines); zoom_out_report_round2.md; comprehension_report_round2.md; critic_report_round2.md; docs/designs/learner-main-page-improvements.md; docs/spec.md; docs/adr/004-media-mux-and-storage.md; docs/adr/005-aws-hosting-and-environments.md; apps/api/src/routes/files.ts; apps/api/src/services/catalog.service.ts; infra/terraform/modules/environment/storage.tf; docs/runbooks/deploy.md; docs/runbooks/mux.md. Read in part or by search only: apps/api/src/services/courses.service.ts (lines 50-109, 330-404, 420-769), apps/api/test/schema-guard.test.ts (1-90), audit.service.ts, deps.ts, env.ts, providers/video/mux.ts and index.ts, infra (search), apps/teach/src (search). Not read in full: docs/designs/learner-chinese.md (not opened) and docs/designs/learner-teach-banner.md (one search); no finding depends on them.
