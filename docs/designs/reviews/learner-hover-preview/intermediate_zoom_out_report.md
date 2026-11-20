# Stage 8: Intermediate Zoom Out Review

- **Target:** `docs/designs/learner-hover-preview.md`, full file (lines 1 to 1877)
- **Date:** 2026-11-19
- **Reviewer:** `egm-zoom-out` (completed)
- **Given:** the Stage 5 report (`zoom_out_report.md`) and the six reading-list files. It was
  not given `comprehension_report.md` or `critic_report.md`, so S4 below may overlap the
  critic's report.
- **Verdict:** changes requested, unchanged from Stage 5. 0 Blocker, 0 new Major, 4 new Nit,
  and one extension to Stage 5's Z11.

## Additions since Stage 5

- **None.** The target has no content responding to the comprehension or critic stages. The
  author made no edits between Stage 5 and this run.
- No new complexity or low-level detail has come from those stages, because nothing was
  added.
- Every finding below is about text that was already there at Stage 5.

## Do the Stage 5 findings stand?

- **Yes, all eleven (Z1 to Z11) stand as written.** The reviewer re-checked each one's line
  references against the target and they still match.
- The slip noted under Z4 is still present: item 24 says "the three checks" (line 1755)
  against four listed (784 to 790).
- The four Majors are still the decisions that set the size of the build: Z1 (the stored
  clip), Z2 (the per-profile date and notice command), Z3 (the picker) and Z4 (the Mux checks
  after the build).
- Context sufficiency still passes (lines 9 to 88).

## Findings Stage 5 missed

### S1. The global switch has no named incident, and does not withdraw footage (Nit)

- **Affected scope:** Goal 8 (125 to 127), decision 5 (360 to 362), refresh step 5 and the
  step 4 ordering rule (504 to 509), the catalog (573), the `paused` state (649),
  "Configuration and turning it off" (750 to 757), rollback (840 to 842), items 9 and 21
  (1377 to 1384, 1691 to 1707), two tests (1576 to 1577, 1595 to 1597).
- **Rationale:**
  - **It does not withdraw footage.** Turning `COURSE_PREVIEWS` off leaves every stored
    file fetchable at its address, so it does not serve a consent incident.
  - **A broken or heavy hover already has a path:** a revert of the learner PR and a web
    deploy (line 840). Both routes take minutes.
  - **Its only unique effect is that the API stops making clips.** Goal 6 and the
    10-second timeout already bound that case.
  - **The cost is spread wide:** a `paused` outcome and state, the "step 4 before step 5"
    rule, two tests, a Terraform variable through six files and runbook text.
  - **The sibling design declines this.** `learner-teach-banner.md` turns its banner off by
    reverting the PR, citing `docs/spec.md` line 63, which puts feature flags out of scope.
  - **The brief does not require it.** Its ask is for each design to say how the feature is
    turned off, raised over native rollback. This feature is web-only.
  - **Interaction with Z2:** if Z2's proposal is taken, the switch earns its place as the
    rollout gate. If Z2 is declined and the per-profile date stays, the switch has no
    stated job.
- **Requested change:** name the incident the switch is for that a revert of the learner PR
  does not cover, or drop it along with `paused` and the Terraform variable.

### S2. The design narrows "the whole app runs without Mux" and amends only half the record (Nit)

- **Affected scope:** decision 7 (365 to 367), risk row "Nobody can see the feature locally"
  (826), Alternative AC (1151 to 1160), item 22 (1719 to 1729), items 23 and 28 (1739 to
  1749, 1825 to 1838), Verification Plan (1855 to 1869).
- **Rationale:**
  - ADR 004's Consequences (line 18) say "The whole app runs without Mux or S3 accounts",
    and `README.md` line 42 says the same.
  - Item 22 edits the README sentence and ADR 004's Decision, but leaves ADR 004's
    Consequences line, which becomes untrue.
  - The untested parts are the ones that need Mux: Teach's card, Support's line and the
    real browser behaviour are hand-checked only (items 23 and 28).
  - Item 28 has no local path. It needs "an API with at least two courses that have
    clips", which means staging with Mux on or personal Mux test credentials.
  - Staging depends on Question 9, which is still open. That strengthens Z4.
- **Requested change:** add ADR 004's Consequences line to item 22, and state in the
  Verification Plan where items 23 and 28 run if staging has Mux off. The reviewer does not
  ask for a seeded clip; that is the author's call under Alternative AC.

### S3. Teach already has a date formatter; the design specifies its own (Nit)

- **Affected scope:** lines 692 to 694, item 18 (1650 to 1651), item 15 (1513 to 1515).
- **Rationale:**
  - `formatDate` exists in `packages/web-ui/src/components/StatCard.tsx` (line 50), with
    `en-SG` as its default and options passed through, so a time zone can be given. A hook
    form, `useFormatDate`, is in `packages/web-ui/src/preferences/format.ts` (line 15).
  - `builder.tsx` already imports `formatDate`. The design does not name it for the
    `waiting` sentence.
  - The stated hazard is server-only. "The one-off task runs in UTC" applies to the notice
    email, not to a browser, which formats in the teacher's own zone like every other Teach
    date.
  - The API has no shared formatter, so the email's formatting is new either way.
- **Requested change:** name `formatDate` for the Teach card and keep the pinned zone for the
  email only. All of this disappears under Z2.

### S4. An optional Mux call is placed ahead of the approval's audit row (Nit)

- **Affected scope:** "When the clip is made" (538 to 547), item 13 (1468 to 1476).
- **Rationale:**
  - Today the audit row follows the status change at once: in
    `apps/api/src/services/review.service.ts` (lines 46 to 80) the order is the status
    update, the `course.approve` audit row, the analytics event, then the emails.
  - The design puts up to 10 seconds of Mux between the first two. `docs/spec.md` step 15
    names the audit log on approve.
  - The stated reason covers only emails: a later call "would be skipped when an email
    fails". Only the email needs the outcome, for one paragraph.
  - A smaller placement gives the same protection: audit row first, then `refresh`, then
    the emails. The same applies to `ChangeSetsService.approve`.
  - `CoursesService.update` is different. Its order has its own stated reason and is not
    questioned here.
- **Requested change:** move `refresh` to after the audit row and before the emails in the
  two approve paths, or say why the audit row must wait.
- **Overlap:** the Stage 7 design reviewer raised the same point as design-1-8.

### Extension to Z11 (no new finding)

Z11 named "The learner card" and "Making the clip" as the main drops into code-level detail.
The same kind of detail sits in three more architecture sections, and the Detailed
Implementation Plan repeats each (items 11, 12, 13 and 18):

- "When the clip is made" (538 to 541): which awaits lack a catch.
- "The catalog" (577 to 585): the two columns loaded, and `toCard`'s second caller.
- "The control in Teach" (660 to 674, 692 to 694): the three status codes, the form keyed by
  `updatedAt`, and the UTC note.

## Examined, no finding

- Keyboard focus, reduced motion and the `(hover: hover) and (pointer: fine)` query are asked
  for by the brief. They are not scope creep.
- `resolvePreview` and `previewState` in `packages/core/src/domain` match the existing
  pure-rule files there.
- The `course.preview` audit row follows `course.price`.
- Storage deletes will work in production: the task role already has `s3:DeleteObject`.
- `mailer.driver === 'console'`, `errors.unprocessable`, the `liveLessons` and
  `liveArtefacts` relations, and `media.publicUrl` wrapping `storage.getUrl` are all as the
  document describes.
- The Terraform pass-through matches how `csp_report_only` is passed.
- The pressed-state `style` function under `Link asChild` is in `CourseCard.tsx` lines 18 to
  19, as the document says.
- `COURSE_PREVIEWS` does not exist anywhere in `apps`, `packages` or `infra` today.

## Editorial slip

Line 1651 has a stray closing quote: `states table."`.
