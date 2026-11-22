# Stage 7: Critic Review

- **Target:** `docs/designs/learner-hover-preview.md`, lines 1 to 1206 (FeatureRange)
- **Date:** 2026-11-19
- **Round:** 1
- **Reviewers:** `egm-design` and `egm-structural` against the feature-spec standard,
  `egm-style` with its own rules
- **Reading list given to all three:** the brief, `learner-chinese.md`,
  `learner-teach-banner.md`, ADR 004, ADR 005, `docs/spec.md`

Finding identifiers are `<reviewer>-<round>-<n>`.

## Structural reviewer

**Status:** completed. 0 Blocker, 1 Major, 7 Nit.

**Coverage:** read in full the persona, the standard and target lines 1 to 1206. Read in part
the two sibling designs and the brief, as the house-structure baseline. ADR 004, ADR 005 and
`docs/spec.md` were only confirmed to exist as link targets.

**What passes**

- All five areas the standard names are present: the problem (line 56), goals and non-goals
  (90, 132), the architecture (314), alternatives (849, 30 entries, each with Pros, Cons and
  Reason for Rejection) and risks (810).
- The H2 sequence, the metadata block and the horizontal rules match the two sibling designs.
- The heading hierarchy skips no level.
- All 19 Markdown links in scope resolve.
- The brief citations (decisions 5 and 9, Questions 9 and 14, "Alternatives Weighed") exist
  in the brief.
- Stated counts match their lists: four things, five departures, seven columns, eight
  outcomes, seven states, three drivers, three commands, three call sites, and diagram steps
  1 to 9 against prose steps 1 to 9.
- Tables and code fences are well formed and closed.

### Major

#### structural-1-1. Eighteen "Rejected by author" lines carry no link, and three state no trade-off

- **Scope:** Alternatives Considered, lines 851 to 1127: entries A, B, C, D, E, I, J, K, L,
  N, O, P, Q, S, T, W, X and Z.
- **Discrepancy and rationale:** the standard says rejection rationales "must state concrete
  technical or scope trade-offs and must not attribute a rejection to a maintainer without
  linking their issue, discussion, or PR." None of these Reason for Rejection lines carries a
  link. The rule names "a maintainer"; the reviewer read it as covering the document's author
  acting as decision-maker.
  - **Entries citing the brief (A to E)** rely on the one link in the section intro (line
    851), which has no anchor. The sibling design links the anchor inside the Reason line
    itself and adds the trade-off after a colon.
  - **Entries citing "(Question N)" (I, L, N, O, P, Q, W, Z)** cite plain text, not a link
    to `#open-questions`. The answered entries they point to record only "The author chose
    this over ...".
  - **Entries citing nothing (K, S, T, X):** K, S and T restate the chosen design, and X
    only restates "10 seconds in".
  - **Bare Reason lines:** E (line 911), O (line 1010) and Q (line 1032) state no trade-off
    in the Reason line at all. The trade-off sits only in the Cons bullets.
  - **Alternative J (lines 961 to 962)** cites two events ("twice ... again when told that
    on by default contradicted the goals as first approved") that appear nowhere in the
    document or in a linked record. A fresh reader can't trace them.
- The Cons bullets do carry concrete trade-offs in most entries, so the gap is mainly the
  missing link or anchor, plus the three bare Reason lines.

### Nit

- **structural-1-2. Open Questions departs from the sibling layout** (lines 166 to 234).
  - Open Questions 8, 9 and 10 come first, then a plain-paragraph label "Answered:", then
    Questions 1 to 7. The numbers read 8, 9, 10, 1 to 7.
  - Three answered entries have no number ("The default clip", line 223; "The data model",
    line 227; "The brief's Question 9, in part", line 232). Alternatives S, T and X
    therefore have no question to cite.
  - Question 6 (line 214) is marked "answered while drafting" with no date, while its
    neighbours carry a date. Line 348 says drafting decisions belong under "Decisions made
    while drafting", so Question 6 is in the wrong list or lacks its date.
  - Question 8 (line 171) is a noun phrase, not a question.
- **structural-1-3. Two H3 headings are duplicated** (lines 399 and 1043, "The data model";
  lines 536 and 1012, "When the clip is made"). The Alternatives group headings reuse
  Technical Plan heading text, so each anchor resolves only to the first occurrence. No
  current link targets them.
- **structural-1-4. Alternatives are H4 under nine H3 groups** (lines 855 to 1169). Both
  sibling designs put each alternative at H3 directly under the H2. The nesting is valid and
  reasonable for 30 entries, but it departs from house structure and causes structural-1-3.
  Renaming the groups (for example "Alternatives: the data model") would resolve both.
- **structural-1-5. Four entries bundle two alternatives each** (L at 973, W at 1084, X at
  1095, Z at 1117). The Pros and Cons lists are not parallel. In Z the Pros cover only the
  client endpoint while the Cons cover both options.
- **structural-1-6. CUJ 7 has a fourth bullet** (lines 302 to 304), "If it was the course's
  only video:", after Then. Every other journey is a strict Given, When, Then triple with
  variants nested under Then. Its colon is also inside the bold, unlike `**Given**:`.
- **structural-1-7. Three external references are not links** (Additional Resources, lines
  1181 to 1186). The two Mux guides and the Expo page give their URLs as code spans. The
  Alternatives intro (851 to 852) also names the brief's section without the anchor link the
  sibling uses.
- **structural-1-8. Two lists of departures from the brief do not match** (lines 807 to 808
  against 43 to 54). The Overview lists five, four of which concern decision 9. "Records and
  rules" names only two.

## Design reviewer

**Status:** completed. 0 Blocker, 5 Major, 6 Nit. Its verdict: revise before approval.

**Coverage:** read in full the persona, the standard, the target (lines 1 to 1206 as scope,
1207 to 1877 to check definitions), the brief, ADR 004 and ADR 005. `docs/spec.md` and the
two sibling designs were searched, not read in full.

**Claims it checked against the code and found accurate:** the task role may delete objects;
public files are served as immutable for a year; no code path moves a course out of `live`;
the Mux driver already signs thumbnails with string options; the catalog list loads lesson
IDs only and `toCard` has one other caller; approval's audit and emails are awaited with no
catch. Not verified: Mux's documented limits and token behaviour.

### Major

#### design-1-1. The off switch and "Make clip" can be refused once the chosen video has left the course

- **Scope:** lines 449 to 450, 653 to 669; defined further at 1445 to 1457 and 1640 to 1655.
- **Finding:**
  - Line 449 says a chosen video that has left the course "is not an error" and the rule
    falls back to the default.
  - Lines 653 to 665 say "Save preview" and "Make clip" send all three setting fields, and
    the server answers 422 `preview_video_not_on_course` for a video not on the course.
  - The plan confirms the check runs whenever `previewMediaId` is a value, and that "Make
    clip" sends the fields unchanged.
  - The card fills its select from the saved choice, and nothing says a stale choice is
    reset to empty.
  - So after an owner deletes an explicitly chosen video, "Make clip" fails, and so does
    unticking the box and saving.
- **Why it matters:** the off switch is the main consent mitigation (Goal 2, risk row at
  816). It fails at the moment the stale file most needs deleting.
- **Recommendation:** state one rule. Either validate `previewMediaId` only when it differs
  from the stored value and the preview is not being turned off, or have the card send empty
  for a choice missing from `preview.videos`. Add a test for "turn off with a stale chosen
  video".

#### design-1-2. The catalog keeps serving a clip the teacher has replaced

- **Scope:** lines 494, 508 to 511, 570 to 575, 752 to 753, 820, 841 to 842; plan 1458 to
  1459.
- **Finding:** the catalog's three conditions never compare the stored clip with the current
  setting. Two paths leave public a clip the teacher moved away from:
  - **A failed fetch.** The teacher changes video or start and Mux fails, or refuses on the
    per-asset limit. The save answers 200, "the stored clip is left as it was", and the
    old clip stays in the catalog. The card says only "The clip is not up to date".
  - **A change while paused or waiting.** Step 5 stops before making anything, so the old
    clip stays stored. When `COURSE_PREVIEWS` is turned back on, "switching back on shows
    them again" republishes the old clip.
- **Why it matters:** step 4 deliberately honours "off" even while paused. A change of
  footage is not treated the same way, and the teacher is not told the old clip is still
  showing.
- **Recommendation:**
  - when a request changed the setting and `refresh` does not end in `made` or
    `unchanged`, clear the key and delete the file;
  - or have the catalog hide any clip whose source record differs from what the setting
    resolves to;
  - word the `pending` line to say whether visitors currently see a clip;
  - say what the card shows when the Mux per-asset limit is used up, since "Make clip"
    would fail every time.

#### design-1-3. Hidden is not removed, and one risk row misstates this

- **Scope:** lines 121 to 124 (Goal 7), 214 to 216 (Question 6), 302 to 304, 519 to 520, 553
  to 555, 646, 752 to 753, 828, 841 to 845.
- **Finding:**
  - **Inconsistent reasoning.** Question 6 rejects leaving files because paid footage would
    stay "reachable at its old address". When a teacher deletes the video itself, the
    design accepts exactly that, with no time bound. A deleted video is the stronger
    signal: it may be a takedown for privacy or copyright.
  - **No obvious control.** In the only-video case the card shows `no_video` with no
    button. The file goes only if the teacher presses "Save preview" on an unrelated
    setting.
  - **Row 828 is wrong for old keys.** It says a stray file "is at an address nobody was
    given". When step 9's delete fails, the stray file is the old clip, whose address went
    to every catalog visitor. The key is already cleared from the row, so nothing retries
    it.
  - **The global switch withdraws nothing.** `COURSE_PREVIEWS` off and a revert of the
    server PR both leave every file fetchable. There is no bulk purge, per profile or for
    everything.
- **Recommendation:**
  - add a `previews purge [--profile <id>]` command that clears keys and deletes files;
  - make failed deletes retryable, for example by having the backfill delete everything
    under `public/previews/<courseId>/` except the current key;
  - add a risk row for "a removed video's clip remains fetchable", with the takedown
    procedure;
  - reword Goal 7 to "the catalog never links a clip whose video has left the course", or
    add a clear-only hook, with no Mux call, to the paths that delete or replace a live
    video item.

#### design-1-4. The two facts that decide whether the feature works are left until after it is built

- **Scope:** lines 174 to 182 (Questions 9 and 10), 328 to 331, 759 to 760, 780 to 792, 819.
- **Finding:**
  - **Question 10.** Nobody has made the one call the design rests on. The check is
    scheduled "before the server PR merges", after about 24 work items, though line 792
    says a failure sends the design back for revision.
  - **Question 9.** Whether staging and production run Mux is unknown. The production
    example file has `mux = false`. With it off, production makes no clip.
  - **An unstated consequence.** "Usable" requires `provider: 'mux'`, so any video uploaded
    while an environment ran the local driver never gets a clip, even after Mux is
    switched on.
  - **Sizing.** The 0.6 MB figure and the 3 MB cap rest on two Mux demo videos, not lesson
    footage.
- **Recommendation:**
  - make the real Mux call a gate before implementation starts, and record the result in
    the design;
  - add two checks: whether the per-asset limit is for the asset's lifetime or resets, and
    whether a repeat request with identical options counts against it;
  - answer Question 9 now from the real settings. If production videos are not Mux assets,
    say how many live courses could get a clip at all.

#### design-1-5. Eighteen of thirty rejections are attributed to the author, and the riskiest has no trade-off

- **Scope:** lines 851 to 853 and the Reason lines of A, B, C, D, E, I, J, K, L, N, O, P, Q,
  S, T, W, X and Z.
- **Finding:** the standard requires rejection rationales to "state concrete technical or
  scope trade-offs" and not to attribute a rejection to a person without a linked record.
  - Several Reason lines are attribution only: E (911), O (1010) and Q (1032).
  - Others say "Rejected by author, in favour of X" and point to an answered question that
    records the choice without the reasoning, for example Question 2.
  - Alternative J, off by default, is the weakest (954 to 962). Its only disadvantage is
    "Few teachers may turn it on", which is unmeasured in a design that says nothing can
    measure value. Its reason is a history of the author's choices, including that on by
    default "contradicted the goals as first approved".
- **Why it matters:** on by default is the decision that publishes existing teachers' paid
  footage unless they opt out. It overrides the brief's decision 9 and adds the notice
  command, the preview date and the backfill.
- **Recommendation:** rewrite each Reason line to carry the trade-off itself. For
  Alternatives I and J, state the concrete reason on by default is worth the consent risk and
  the extra machinery, or record that the trade-off was accepted without evidence.
- **Same scope as structural-1-1,** raised independently.

### Nit

- **design-1-6. The catalog check loads every live item, and the sizing figure is wrong**
  (lines 319, 577 to 579, 833). The risk row says "12 courses a page". The API accepts a
  `limit` up to 50 and fetches one more, with no session and no rate limit, on one small
  task. Recommendation: use a correlated `EXISTS` on the live items for
  `preview_source_media_id`; the same query already uses `exists(...)` for search. Otherwise
  correct the figure and list `EXISTS` as a rejected alternative.
- **design-1-7. The preview date at application assumes the sentence was on screen** (lines
  714 to 715, 772 to 774). The API and Teach deploy separately, and a page left open keeps
  its old code. An applicant can submit from a page without the sentence and still get a
  preview date. Recommendation: have the apply request carry an explicit marker and set the
  date only then; a profile without it falls to the notice path.
- **design-1-8. Refresh before the audit row in Support's approval** (lines 310, 538 to 547,
  563, 821). Today the gap between the update that sets a course live and its audit row is
  milliseconds. The design widens it to the full Mux wait; a crash or task stop in that
  window leaves a live course with no audit row and no email. The stated reason justifies
  placing the call before the emails, not before the audit. The 10-second bound also covers
  only the Mux fetch. Recommendation: audit first, then refresh, then emails; bound the whole
  refresh or say "about 10 seconds".
- **design-1-9. "Nothing counts hovers" overlooks a signal the design creates** (lines 50 to
  51, 128 to 130, 834). Clips are served by the API's file route, and the request logger
  logs every path, so each first play per browser is already a log line with the course ID
  in it. Recommendation: name that log query as the measure, and say what result would lead
  Elevate to keep or remove the feature.
- **design-1-10. The loser of the step 8 race reports `unchanged` when the result may be
  wrong** (lines 488, 515 to 518, 827). If a refresh that read before a change-set commit
  wins the guarded update, the later refresh, which read the newer state, discards its file.
  The stored clip is then not what the rule wants, and nothing retries. Recommendation:
  re-run once on a miss, or return a distinct outcome.
- **design-1-11. The notice email is English only, with no reason given** (lines 146 to 147,
  727 to 729, 832). It is the only consent vehicle for existing teachers. `simpleEmail`
  already accepts a locale and `users.locale` exists. Recommendation: send it in the
  recipient's language, or add the reason for English to the risk row.

## Summary of round 1

| Reviewer   | Status    | Blocker | Major | Nit |
| ---------- | --------- | ------- | ----- | --- |
| Design     | completed | 0       | 5     | 6   |
| Structural | completed | 0       | 1     | 7   |
| Style      | completed | 0       | 7     | 22  |

Thirteen Major findings in all. Two are the same issue raised twice (design-1-5 and
structural-1-1), so twelve distinct ones. The round is not clean.

Findings here that repeat an earlier stage:

- design-1-4 repeats Z4 from Stage 5 (check Mux before building).
- design-1-3 and style-1-5 overlap C2 from Stage 5 (a failed delete can't be retried; hidden
  is not removed).
- style-1-1 repeats N7 from Stage 6, and style-1-2 repeats N9.

## Style reviewer

**Status:** completed. 0 Blocker, 7 Major, 22 Nit.

**Coverage:** read in full the persona and target lines 1 to 1206. No style standard was
supplied; the persona's rules were applied. The sibling designs and the brief were read in
part for tone and cross-checks. The two ADRs and `docs/spec.md` were not opened. Four claims
about existing behaviour were checked against the code and held.

**Overall:** the prose is mostly dry and specific. The Majors are all cases where one part
of the document contradicts another part, or says more than its evidence supports.

### Major

#### style-1-1. Contradictory account of the brief's decision 9

- **Scope:** lines 45 to 46, against 47 to 48 and 807 to 808.
- **Discrepancy:** line 45 says Support's approval "is the only moment decision 9 names".
  Line 47 then says "Decision 9 says a new clip is made when an approved edit replaces the
  source video", which is a second moment. The brief confirms both moments. Lines 807 to 808
  list only two decision-9 departures, while the Overview lists four that touch decision 9.
- **Action:** state once what decision 9 names and make the two lists agree.

#### style-1-2. The same behaviour is asserted as fact and as unverified

- **Scope:** lines 594 to 596, against 1201 to 1203.
- **Discrepancy:** the learner card section says a function-valued `style` on that
  `Pressable` "is dropped by the `Link asChild` wrapper". Future Improvements says the
  wrapper "appears to drop" it, "Read from source, not run". The handler-based design is
  justified by the unhedged version.
- **Action:** match line 594 to the evidence, or run it and remove the hedge.

#### style-1-3. "Have one answer that fits the goals" says more than the document shows

- **Scope:** lines 348 to 349.
- **Discrepancy:** the Alternatives section gives rejected options with real advantages for
  several of the eight drafting decisions: U (decision 1), AD (decision 5), AA and AB
  (decision 6), AC (decision 7). The sentence is the stated reason these were not put to the
  author.
- **Action:** say what happened. For example: "The drafter chose these without asking the
  author; the rejected options are under Alternatives U and AA to AD."

#### style-1-4. The device scope is stated more broadly than the mechanism delivers

- **Scope:** lines 29 to 30, 109 to 114 and 134, against 602 to 605.
- **Discrepancy:** the Overview, Goal 4 and the Non-Goal say "phones and touch screens" (Goal
  3 adds "a tablet") "never download the clip". The actual gate is
  `matchMedia('(hover: hover) and (pointer: fine)')`, followed live. A tablet with a
  trackpad, or a touch-screen laptop with a mouse, therefore gets the clip. Only Goal 3's
  "touch-only laptop" is precise.
- **Action:** define the class once (for example "devices whose main pointer can't hover")
  and use it in all four places.

#### style-1-5. Goal 7's headline is contradicted by the body

- **Scope:** line 121, against 302 to 304 and 553 to 555.
- **Discrepancy:** "A clip never outlives its video on the course." The body guarantees only
  that the catalog stops returning the address. The file stays publicly fetchable at an
  address earlier catalog responses already gave out, cached as immutable for a year, until
  some later refresh. "At an address the catalog no longer gives out" understates this in
  the same way. Lines 215 to 216 reject that same condition as "against Goal 2" when the
  teacher turns the clip off.
- **Action:** match the headline to the mechanism: "The catalog never returns a clip whose
  video has left the course."

#### style-1-6. "Deletes the stored file" is unqualified in the goal and the risk row

- **Scope:** lines 107, 214 to 216 and 816, against 529 to 530 and 1197 to 1198.
- **Discrepancy:** lines 529 to 530 say the production bucket is versioned and "the bytes
  stay as an old version". Expiring those versions is a Future Improvement.
- **Action:** change Goal 2 and the risk row to "stops serving the file at its address", or
  move the versioning caveat to Goal 2, where a reader decides whether the consent promise
  is met. Also narrow "nobody can request" (line 530) to "not reachable through the public
  file route".

#### style-1-7. Measurements are stated without their source where decisions rest on them

- **Scope:** lines 821 to 822 (also 1090), against 178 to 182 and 786 to 787.
- **Discrepancy:** "Measured first requests took 1 to 6 seconds" names no asset type or
  sample size, and it is the basis for accepting a 10-second wait on three request paths.
  "Every first view of a clip streams about 0.6 MB" is stated as fact for real lesson
  footage, while Question 10 says nobody has made the signed-asset call. Lines 208 to 213
  word the same numbers carefully ("measured on two of Mux's demo videos", "estimated").
- **Action:** word lines 821 to 822 the same way.

### Nit

**Precision**

- **style-1-8** (line 114): "a few dozen bytes per card". The key alone is about 94 bytes.
  Say "roughly 150 bytes" or drop the number.
- **style-1-9** (lines 310, 563, 821): "at most 10 more seconds". The timeout bounds the Mux
  fetch only; the storage write, update and delete add to it.
- **style-1-10** (lines 84 to 85, 881): "a handful of teachers" is vague; the sibling cites
  the spec's "three to five". Line 85 hedges "most learners are likely on phones", but
  Alternative C uses it unhedged as an advantage.
- **style-1-11** (lines 92 to 95): "after a short delay" is unmeasured in a goal (CUJ 1 gives
  400 ms). "Three times through for a 4-second clip" implies the length varies. Line 95 has
  a stray line break mid-sentence.
- **style-1-12** (lines 245 to 246): "A sweep of the mouse across several cards requests
  nothing" is true only if no card is rested on for 400 ms.
- **style-1-13** (lines 501 to 502): "A live course never stops being live" is a
  safety-relevant claim about existing behaviour with no citation.
- **style-1-14** (line 527): "The first deletions in the codebase." The codebase deletes
  database rows in many services. Say "the first storage deletions".
- **style-1-15** (line 624): "16:9 for most lesson video". Unverified "most".
- **style-1-16** (line 736): "It is safe to run again." "Safe" is a judgement. State the
  fact: a re-run asks Mux only for courses whose clip does not match the rule.
- **style-1-17** (line 818): "Running the backfill from time to time repairs it; nothing
  reminds anyone to." No cadence or owner. Put a concrete instruction in the runbook entry,
  or drop "from time to time".
- **style-1-18** (lines 742 to 746): "stated plainly" is filler. The one-email-per-profile
  point is not a limit of consent and belongs with the notice command. "The profile's date
  stands" leaves out the consequence: an owner who never saw the sentence gets clips.
- **style-1-19** (line 830): "which harms nobody" is subjective. Say "existing cards keep
  the still cover image".
- **style-1-20** (lines 872, 951, 979, 1100): predictions stated as fact: "most cards would
  have none", "few cards would have one", "Seven is shorter than a holiday", "Second 0 is
  often a title card". Line 960 hedges the same kind of claim.
- **style-1-21** (line 1019): "About eleven call sites." Hedged yet precise. Give the count
  or list the sites.
- **style-1-22** (lines 1194 to 1195): "if the count of clips proves too coarse to decide
  anything". Goal 9 already says it is.

**Subjective wording**

- **style-1-23** (lines 931, 949, 1058, 1148 to 1149): "far more moving parts", "the most
  deliberate consent", "the fullest record", "simpler to reason about". The neighbouring
  bullets already give the facts.

**Terms and structure**

- **style-1-24** (lines 40, 346, 852 to 853): "while drafting" carries two meanings. At line
  40 it means the author decided; at 346 and 853 it means not put to the author. Line 214,
  "answered while drafting", is therefore ambiguous about who decided.
- **style-1-25** (lines 168 to 234): Question 8 is a fragment, not a question. Two answered
  entries have no number. This design's Question 9 sits beside "the brief's Question 9", and
  line 760 cites "Question 9" bare.
- **style-1-26** (lines 232 to 233): "the reviewers' belief holds". Name the belief: animated
  images need their own token type.
- **style-1-27** (line 433): "so the three can't disagree". Four things are named before it.
- **style-1-28** (lines 667 to 668): "The select offers only videos that pass all three, so
  the card shows these as the server's English sentence" does not follow. The missing step:
  the errors are reachable only by a stale or hand-made request, so no dedicated message is
  built.

**Repetition**

- **style-1-29:**
  - each answered question restates its rejected options, which the Alternatives cover in
    full; a cross-reference would do;
  - "the author chose" or "accepted" appears on 17 lines, against 5 to 7 in the siblings;
  - the stray-file sentence appears four times (lines 303, 553 to 555, 828, 844);
  - the delete-while-paused rule appears three times (107 to 108, 505 to 507, 752 to 753);
  - line 962 is drafting history; state the contradiction or drop it.
