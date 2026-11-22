# Stage 6: Comprehension Test

- **Target:** `docs/designs/learner-hover-preview.md`, lines 1 to 1206 (FeatureRange) and
  1207 to 1877 (DetailedRange)
- **Date:** 2026-11-19
- **Reviewer:** `egm-comprehension` (completed). It read the target alone: no reading list,
  no other repository file, no document standard.
- **Result:** every section could be paraphrased, so there are no Blockers. 2 Major, 14 Nit.

The two sections below are the reviewer's own account of the document. Compare them with
what the design means to say. A wrong account is a finding.

## What this proposes

On the learner web app, resting the mouse on a course card in Explore (or reaching it with
the keyboard) for 400 ms shows a silent 4-second animated WebP cut from one of the course's
lesson videos. It plays for up to 12 seconds and then the cover image returns. Phones, touch
screens and reduced-motion visitors keep the still cover and never download the clip.

The API makes the clip once by fetching it from Mux with a short-lived signed token. It
stores the clip as a public file under a new key each time and records the key on the course
row. The catalog returns a plain, non-expiring `previewUrl` per card.

One function, `CoursePreviewService.refresh`, makes, replaces or clears a clip. It is called
at Support's approval, at a change-set approval, at a save of the preview setting in Teach,
and by a hand-run backfill command. It never throws, so a Mux failure cannot block those
actions. Direct edits to a live course do not call it; instead the catalog hides a clip whose
source video has left the course, and Teach offers a "Make clip" button.

Clips are on by default, from the first usable video, starting 10 seconds in. Consent comes
from a new sentence on the two application pages. Existing profiles get an emailed notice and
a per-profile "previews allowed from" date 14 days later, which `refresh` enforces. A teacher
can change the video or start second, or turn the clip off, per course. Elevate can switch
the feature off everywhere with the `COURSE_PREVIEWS` environment value.

The work ships as a server PR and then a learner PR.

## How the existing system works, per this document

Explore is the learner app's home tab. It lists course cards 12 to a page, each with a still
cover image (a `media_assets` row pointed to by `thumbnailMediaId`), category, title,
teacher, price and counts. A course has no video of its own: video exists only as lesson
artefacts of type `video`, hosted in Mux with signed playback, and the API issues a playback
token only after an enrolment check. No visitor sees any footage before enrolling.

Teachers work in Teach, whose course builder has Curriculum, Map, Details and Review tabs,
all in English. A teaching profile has an owner, managers and writers; "staff" is an Elevate
super-admin acting inside a profile. Support staff approve courses in a separate portal. A
writer's edits to a live course are held as draft rows beside the live rows, in a change set
that the owner or a manager approves. Learner-facing reads go through `deps.learnerDb`.

Public files are served through the API's own file route with a one-year immutable cache
header. There is no CDN, and nothing is ever deleted from storage today. The API has no
queue, timer or scheduler, and one-off work such as the seed runs as a hand-started ECS
task. The apps send no client analytics events. Local development runs without Mux, and
seeded courses have no video.

## Findings

### Major

#### M1. "Live" means two things, and the design depends on which

- **Scope:** Terms (lines 328 to 344); The control in Teach (660 to 667, 685); Support's
  review page (698 to 702); items 4, 10, 12 and 17 (1290 to 1293, 1436 to 1448, 1578 to
  1579).
- **Discrepancy:** "Live" is a course status ("live course") and also a row kind ("live
  rows", as against a writer's draft rows). "A usable video" is defined as "a video item on
  the live course", and `PreviewVideo` is "one for each video item of the live course".
- **What the reader cannot tell:** whether the lesson rows of a course that has never been
  live (draft, under review, rejected) count as "live rows" that `resolvePreview` sees. The
  document never says.
- **Why it matters:** three behaviours rely on the answer being yes.
  - The draft-course test expects state `not_live`, not `no_video`.
  - Support's line shows "which video and start second the rule picks" for a course under
    review.
  - A writer on a draft can pick a video from the select, and the 422 check is worded "not
    on a video item of this live course".
- **Related wording:** item 12 uses a third phrasing, "the rows with no change set" (line
  1448), which is never tied back to "live rows".
- **Suggested fix:** one sentence in Terms saying that every row of a not-yet-live course is
  a live row in this sense.

#### M2. The release order lets the emails describe a hover that is not deployed

- **Scope:** Order of release (762 to 778); the detailed plan's "Release order" (1217 to
  1219); item 13 (1468 to 1472); item 15's notice email (1502 to 1511).
- **Discrepancy:** after the server PR deploys, an approval that makes a clip sends an email
  saying "Its course card shows a short silent preview ... when a visitor rests the mouse on
  it". The notice email says "From {date}, course cards ... show a short silent preview". The
  hover ships in the learner PR, which "can deploy any time after" the server PR.
- **What the reader cannot tell:** whether it is intended and accepted that these emails, and
  the public clip files they describe, can come before the behaviour. The other reading is
  that the learner PR must be deployed before the first approval or before the notice date.
- **Why it matters:** line 768 notes "the catalog returns `previewUrl` and nothing shows it",
  but does not connect that to the emails. No ordering constraint is stated.

### Nit

- **N3. Item 24 says three checks, the section lists four** (line 1755 against 782 to 790).
  The fourth is Mux's answer at the per-asset animated-image limit. A reader of the detailed
  range alone cannot tell whether it is in or out of the merge gate.
- **N4. "Thumbnail" names two different things** (lines 52 to 54, 64, 80, 466, 800): the
  course's cover image (`thumbnailMediaId`, `thumbnailUrl`, "next to the thumbnail"), and
  Mux's per-video thumbnail with its `t` token. The document never says that cover image and
  course thumbnail are the same thing, or that Mux thumbnails are something else.
- **N5. "Card" names both the learner's course card and Teach or Support panels** (CUJ 4 line
  272; lines 667, 670, 820). "The card shows the new clip" in CUJ 4 can be read as either.
- **N6. References to the brief that the reader cannot resolve here** (lines 43 to 55, 87 to
  88, 232 to 234, 961 to 962):
  - "decision 5" is cited and never described;
  - "the reviewers' belief holds" does not say who the reviewers are or state the belief;
  - Alternative J's "when told that on by default contradicted the goals as first approved"
    refers to drafting history the document does not contain;
  - the fourth of the "four separate designs" is not named.
- **N7. The departures from decision 9 are listed differently in two places** (lines 40 to
  55 against 807 to 808). The overview gives five departures, four touching decision 9.
  "Records and rules" names two only.
- **N8. The records list differs between the two ranges** (lines 794 to 808 against item 22
  at 1711 to 1729). Item 22 modifies `README.md` and adds a dated line to ADR 004. The
  feature-range section mentions neither edit.
- **N9. The same claim is stated with different certainty** (lines 594 to 596 against 1201
  to 1203). The learner card section says a function-valued `style` "is dropped by the
  `Link asChild` wrapper" and uses this as a reason. Future Improvements says the wrapper
  "appears to drop" it, "Read from source, not run".
- **N10. "A live course never stops being live" is asserted without support** (lines 501 to
  502). The rule "a course that is not live has no stored clip" rests on it. The agreement
  text quoted at line 74 says "while it is listed", which suggests a course can stop being
  listed. The document does not say whether unlisting, archiving or a suspended profile
  exists, or what happens to a clip then.
- **N11. The count and the catalog define "has a clip" differently** (Goal 9 at 128 to 130;
  line 737; item 15 at 1519 to 1520). `withClip` counts live courses with a key and
  `previewEnabled` true. The catalog also requires `COURSE_PREVIEWS` to be on and the source
  video to still be on the course. The printed number can exceed what visitors can see, and
  the document does not say so.
- **N12. Project-specific names used without a gloss.** None blocks the paraphrase:
  - "the hero animation" (622);
  - "the role table and its test" (655, named only at 1629);
  - "the schema guard test forbids outside two services" (500; the two services are never
    named);
  - "the live views" (425 to 427, 1249);
  - `requireProfile` (831);
  - "the save tracker" (1653);
  - `USER_ERROR_CODES` (1450);
  - "Support's recovery process" (746);
  - "My Learning" (585).
- **N13. Support agent, super-admin and staff are not related to each other** (lines 153 to
  155, 202, 324 to 326). A support agent "can't change a course"; a super-admin "acting
  inside the profile" can. The document does not say whether super-admins are a subset of
  Support users or a separate role.
- **N14. `integrations.mux` and `VIDEO_DRIVER` are not connected** (lines 174 to 177 against
  759 to 760). That the Terraform setting sets the video driver is left to inference.
- **N15. A sentence with a missing step** (lines 667 to 668). "The select offers only videos
  that pass all three, so the card shows these as the server's English sentence in the usual
  save-failed toast." "These" has no clear referent. The intended reasoning seems to be that
  the errors are nearly unreachable from the page and so get no wording of their own, but
  that is not stated.
- **N16. Terms are used for about 300 lines before the Terms section** (lines 9 to 315
  against 316 to 344). Teach, Support, writer, change set, staff, and the backfill, notice
  and count commands are all used in the Overview, Goals, Open Questions and CUJs before they
  are defined. All are defined later, so this is not a gap, but there is no forward pointer
  from the Overview.
