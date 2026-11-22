# ADR 011 — A public hover-preview clip of each course's video, stored once

**Status:** proposed · 2026-11-22

The design, its alternatives and the step-by-step plan are in
[`docs/designs/learner-hover-preview.md`](../designs/learner-hover-preview.md). This record keeps
the decisions. It makes one exception to [ADR 004](004-media-mux-and-storage.md), under which
lesson video is shown only after an enrolment check.

## Context

A course card in Explore shows one still cover image, and nobody outside a course can see any of
its teaching. All course video is lesson video, held in Mux with signed playback only. Mux can
cut a short animated image from a signed video, but only with a signed token that expires, and it
has no way to make only images of a video public. Teachers had agreed only to "a non-exclusive
hosting licence while it is listed", which does not cover showing lesson footage to people who
have not paid.

## Decision

- **A short silent clip of a course's video is public.** On the web, a visitor who rests the
  mouse on a course card sees 4 seconds of the course's video, 480 pixels wide at 10 frames a
  second, in place of the cover image. Lesson video itself stays signed, and playback still needs
  enrolment. This is the one exception to ADR 004's rule that playback addresses are minted only
  after an enrolment check.
- **The clip is fetched once and stored.** The API signs a Mux `gif` token (audience `g`), fetches
  `animated.webp` once, and stores the file under a new `public/previews/<courseId>/<uuid>.webp`
  key, served by the same public file route as cover images. A key's content never changes,
  because public files are cached as immutable. The catalog returns a plain, lasting address; no
  token is signed per card.
- **On by default, on the strength of the agreement sentence.** A course with video gets a clip
  from its first usable video, starting 10 seconds in, with nothing for the teacher to do. Both of
  Teach's application pages say, under the agreement, that Elevate may show such a preview. The
  teacher can pick another video or start in Teach, or turn the clip off, which deletes the file.
- **Clips are made inside requests and by a command a person runs.** `CoursePreviewService` is
  the only code that makes, replaces or clears a clip. Its `refresh` runs when Support approves a
  course, when a profile approves a writer's change set, and when someone saves the preview
  setting, and the `previews backfill` command runs it for every live course. There is no queue or
  scheduler.
- **A direct edit deletes a clip whose video has left the course.** Every direct edit to a live
  course's lessons or items finishes through `CoursesService.edited`, which calls
  `retireIfVideoGone`. That call never asks Mux. Nothing checks this again when the catalog is
  read.
- **Mux's per-video limit is respected by counting.** Each video gets at most 5 clips, ever
  (`COURSE_PREVIEW.maxClipsPerVideo`), half of the least Mux documents. Allowed starts are every
  10 seconds and are not cut to that number.
- **`COURSE_PREVIEWS` off is a pause, not a takedown.** The catalog stops returning addresses and
  no clip is made. Stored files stay and are still served to anyone who has an address.
- **Release condition.** The server pull request is in production before any teacher applies
  there, so every teacher applies under the agreement sentence. Nothing in the code checks it.

## Consequences

- Footage that a browser fetched can't be recalled: deleting a file stops new requests only.
  In a versioned bucket the deleted file is kept as an old version, which a lifecycle rule removes
  a day later once it is applied.
- Support's approval, a change-set approval and "Save preview" can each wait on Mux for up to 10
  seconds. A Mux failure never blocks them; the course goes without a clip until the next attempt.
- After an owner replaces a live course's first video, the course has no clip until "Make clip",
  a change-set approval or the backfill.
- A video has at most a default clip and four changes, fewer when it is on more than one course,
  and each `previews check` uses one for good.
- Local development makes no clip: the local video driver has no Mux.
- Managers and writers who join by invitation, and an owner installed by recovery, never saw the
  agreement sentence. Whether the full teacher agreement needs matching wording is open
  (Question 15 of the design).
