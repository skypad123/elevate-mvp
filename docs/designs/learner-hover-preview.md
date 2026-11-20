# Hover preview on course cards

-   **Author:** Sky Livingston
-   **Status:** Proposed
-   **Date:** 2026-11-19

---

## Overview

Explore, the learner app's home tab, lists courses as cards. Each card shows one still cover
image. This design lets a visitor on the web who rests the mouse on a card see a few seconds of
the course's video in place of the still, silent and looping, as YouTube does on its video
cards.

It does four things:

1.  **Plays a short silent clip on hover.** On the web, with a mouse, resting on a card swaps
    the cover image for an animated clip of the course's video. Moving away brings the cover
    image back.
2.  **Makes the clip once and stores it as a public image.** The API fetches a short animated
    WebP from Mux, the video host, and stores it beside the cover image. The catalog returns
    its address the same way it returns the cover image's. No token is signed per card.
3.  **Gives every course with video a clip, and lets the teacher change it.** A course gets a
    clip from a default video and start time without the teacher doing anything. In Teach, the
    teacher can pick a different video or start time, or turn the clip off. The agreement text
    on Teach's application pages gains a sentence saying that Elevate shows these previews. A
    course with no clip keeps its still cover image.
4.  **Leaves phones and touch screens as they are.** They show the still cover image and never
    download the clip.

This is the third of four separate designs drawn from
[learner-main-page-improvements.md](learner-main-page-improvements.md), called "the
brief" below. It does not depend on the first two
([learner-chinese.md](learner-chinese.md) and
[learner-teach-banner.md](learner-teach-banner.md)). It adds no text to the
learner app. Its two new agreement sentences are translated, and its new control in Teach's
course builder is English, because the builder is an English page today. The approval email
to a teacher gains one paragraph, in English like the rest of that email; its wording is in
item 13 of the plan.

It departs from the brief in five ways, each chosen by the author while drafting. See
[Open Questions](#open-questions).

-   **On by default.** The brief's decision 9 has the teacher pick the seconds or agree to a
    default for each course.
-   **Made at more moments than Support's approval,** which is the only moment decision 9
    names.
-   **Not remade by every edit.** Decision 9 says a new clip is made when an approved edit
    replaces the source video. Here that holds for a writer's approved change set. A direct
    edit by an owner or manager deletes the old clip and does not make a new one.
-   **No success measure.** The brief asks each design for one, and its Question 14 asks
    about a client event endpoint. This design counts clips and nothing else.
-   **No media row for the clip.** Decision 9 stores the clip "as a public image next to the
    thumbnail". The thumbnail is a `media_assets` row; the clip is a storage key on the
    course row, served from the same public file route.

## The Problem

-   **A visitor can't see any teaching before paying.** A course card shows a cover image, the
    category, the title, the teacher's name, the price, and the enrolment and lesson counts
    (`apps/learner/src/components/CourseCard.tsx`). The course page adds the description and
    the syllabus, and shows the same cover image. No screen plays any video to a visitor who
    has not enrolled. The cover image is whatever the teacher uploaded, and it need not show
    the teaching at all.
-   **A course has no video of its own.** A course row has only `thumbnailMediaId`, an image
    (`packages/db/src/schema/courses.ts`). All video belongs to lessons, as video artefacts.
    A preview has to come from lesson video, and something must choose which video and which
    seconds.
-   **Lesson video is paid content, and today nobody outside a course can see it.** Every Mux
    asset is created with signed playback only (`apps/api/src/providers/video/mux.ts`). The API
    hands out a playback token only after checking enrolment
    ([ADR 004](../adr/004-media-mux-and-storage.md)). A clip on the public catalog shows
    frames of paid lessons to anyone, signed in or not. That changes ADR 004's rule that lesson
    video is shown only after an enrolment check.
-   **Teachers have not agreed to that.** The agreement on Teach's application pages says only
    that Elevate "holds a non-exclusive hosting licence while it is listed"
    (`personalApply.agreement`, `companyApply.agreement`). It does not cover showing lesson
    footage to people who have not paid. Production is not deployed yet and no teacher has
    applied there, so the text can change before anyone agrees to it.
-   **Mux can't serve the clip to the public directly.** Checked against Mux's documentation on
    2026-11-19: an animated image from a signed asset needs its own signed token (audience `g`,
    separate from the video token `v` and the thumbnail token `t`). The start, end, width and
    frame rate go inside the token, not in the address. A token expires, so an address built
    from one can't be stored and reused. Mux has no policy that makes only images public: a
    public playback ID makes the whole video playable.
-   **The audience at launch is small, and nothing measures it.** The pilot is planned with three to
    five teachers (`docs/spec.md`). Hover exists only on desktop web; most learners are likely on
    phones. The app sends no analytics events of its own (events come only from the server), so
    nothing counts hovers. The brief records this and the author chose to build the preview anyway.
    Its decision 5 is that the hover preview is web-only and uses Mux's animated preview of
    existing course video. Its decision 9 is that the clip is made once and stored.

## Goals

1.  **Resting the mouse on a card shows the course's clip.** On the web, on a device with a
    mouse, a card whose course has a clip shows it in place of the cover image after 400
    milliseconds. The clip is silent. The 4-second clip plays three times, 12 seconds in all,
    and then the cover image returns. Moving the mouse away brings the cover image back at
    once. Reaching a card with the keyboard does the same as hover.
2.  **The application pages state the preview term before any teacher applies, and teachers
    control their own preview.** Three parts:
    -   **Teachers agree when they apply.** The agreement text on Teach's two application
        pages says that Elevate may show a short silent preview of a course's video to people
        who have not enrolled.
    -   **Nobody applies before that text exists.** No teacher has applied in production. The
        server PR is deployed there before production opens to teachers, so every teacher
        applies under the new text. This is a condition of release, not something the code
        checks.
    -   **The teacher can change the clip or turn it off.** A course with video gets a clip by
        default. Someone on the profile can pick a different video or start time, or turn the
        clip off. Turning it off removes it from the catalog and deletes the stored file,
        also while Elevate has previews switched off. If the delete fails, the clip stays
        hidden and the delete is tried again at the next refresh of that course.
3.  **A course with no clip looks as it does today.** So does every card on a phone, a tablet
    or a touch-only laptop, and every card for a visitor who has asked their device to reduce
    motion.
4.  **Phones and touch screens never download a clip.** The clip file is requested only when a
    card is hovered or reached with the keyboard. A visitor who never hovers downloads nothing
    for it. The catalog response does carry the clip's address, about 150 bytes per card.
5.  **The catalog response carries a plain, lasting address.** The list signs no token per
    card, and the clip's address does not expire. The response is the same for every visitor.
6.  **A preview failure never blocks a course.** If Mux is slow, fails or is not configured
    (local development uses no Mux), approving a course, approving edits and saving course
    details still succeed. The course goes without a clip until the next attempt.
7.  **A clip is deleted when its video leaves the course.** When a direct edit removes the
    video a clip was cut from, that request hides the clip and deletes its file. A writer's
    edit does the same when it is approved. If the delete fails, the clip stays hidden and
    the delete is tried again at the next refresh of that course. A new clip is made by
    "Make clip", the next approval, the next save of the preview setting, or the next run of
    the backfill command.
8.  **The feature can be turned off.** A teacher turns it off for one course in Teach, which
    deletes that course's clip. Elevate turns it off everywhere by changing one
    configuration value of the API and deploying it: the catalog stops returning clip
    addresses and no new clip is made. That is a pause, not a takedown. The stored files
    stay, and a file is still served to anyone who already has its address. No store release
    is needed, because the hover behaviour is web-only.
9.  **Elevate can count the live courses that have a clip.** The count command prints the
    number. Nothing counts hovers, so the count can't show whether learners use the preview or
    whether it changes enrolment.

## Non-Goals

-   **Previews on phones, tablets and touch screens.** No tap-to-preview, no autoplay while
    scrolling.
-   **Sound.** The clip is an animated image and has no audio track.
-   **A trailer the teacher uploads separately.** The clip is cut from video already on the
    course. The brief rejected a separate trailer.
-   **A video preview on the course page.** The course page keeps its still cover image. A
    free sample lesson or a playable trailer there is a separate feature.
-   **Making any lesson video public.** Lesson video stays signed, and playback still requires
    enrolment. Only the stored clip is public.
-   **Clips for the Teach and Support course lists.** Those lists keep still images.
-   **A consent step for each course.** A course gets a clip without the teacher switching
    anything on. The agreement in Goal 2 stands in for a per-course choice.
-   **Teachers who applied before the agreement sentence.** None exist in production, so this
    design has no notice email, waiting period or per-profile date for them. If production
    opens to teachers before the server PR is deployed, the design has to be revised first.
-   **Recording who accepted the agreement.** Nothing records acceptance today, and this design
    adds no record.
-   **Legal review of the agreement sentence.** This design adds the sentence to the two
    application pages. Whether the full teacher agreement, which is drafted outside the code,
    needs matching wording is open (Question 15).
-   **A way for Support to take a clip down.** A support agent can't change a course. A
    super-admin acting inside the profile in Teach can turn a clip off, as they can change a
    cover image.
-   **Translating the course builder.** The new control is on the builder's Details tab, which
    is English today. A teacher who read the agreement in Chinese meets the control in English.
-   **Showing lesson count and total length on the card.** The brief names it as a cheaper
    alternative. The card already shows the lesson count; total length is not added here.
-   **Server-side caching of the catalog.** This design adds no cache.
-   **Counting hovers.** No client event endpoint is added.
-   **Scheduled or background work.** The API has no queue, timer or scheduler, and this design
    adds none. Every clip is made inside a request or by a command a person runs.

## Open Questions

The question numbers here are this design's own. The brief's questions are cited as "the
brief's Question n". Questions 16 to 20 were answered without a number and were numbered
later.

### Open

-   **Question 14 (whether the per-video count stays), open since 2026-11-20:** the second
    review questioned the count of clips fetched for each video (Question 13). Five reviewers
    pointed out that the 59 real calls never met the limit it guards, and that it locks a
    video for good after ten fetches. The author chose to keep it until Mux answers the
    question written for its support team on 2026-11-19.
    -   If Mux says the limit is not enforced for animated images on signed playback, the
        count goes: the `preview_fetches` column, the `limit` outcome and state, and the
        changes-left line. The 10-second steps stay.
    -   If Mux says it is enforced, the count stays and the reply settles its details.

    Nothing else in the plan waits on this. The plan below is written with the count in.
-   **Question 15 (the full teacher agreement), open since 2026-11-20:** the application
    pages gain a sentence about previews. `docs/spec.md` describes a fuller teacher agreement,
    drafted outside the code, that grants a hosting licence only. Someone has to check that it
    covers previews before production opens to teachers. Who does that, and by when, is not
    decided.

### Answered

-   **Question 1 (when the clip is made), answered 2026-11-19 and changed 2026-11-20:** one
    function, `refresh`, brings a course's clip up to date. It is called in three places:
    when Support approves the course, when the profile approves a writer's edits to a live
    course, and when someone saves the preview setting in Teach. The backfill command runs
    the same function for every live course. The author chose this over a scheduled task
    that does all the fetching.
    -   **A direct edit does not call `refresh`,** because `refresh` can wait on Mux and an
        edit should not. Instead, the one function every direct edit finishes through
        deletes the clip when its video has left the course. That needs no call to Mux.
    -   **What changed.** The first answer hid such a clip with a check each time the catalog
        was read, and left its file in storage. It was chosen on a count of "about eleven
        call sites", which was wrong: all ten content-edit methods of `CoursesService`
        finish through one private function, `edited`. The second review found that the
        hidden file stayed public with no upper bound on how long. The author replaced the
        check on 2026-11-20 (Alternatives AL and AM).
-   **Question 2 (the default), answered 2026-11-19:** on by default. A course with video gets a
    clip from a default video and start time with no action from the teacher. Consent comes from the
    agreement text (Goal 2). The author chose this over a per-course switch that starts off. The
    author's reason, given on 2026-11-19: most course cards should have a preview, and a switch that
    starts off leaves that to each teacher acting.
-   **Question 3 (where and who in Teach), answered 2026-11-19:** the same rule as the cover
    image. The control is on the builder's Details tab and saves through the course-details
    route. On a draft or rejected course, anyone who can edit drafts may change it (owner,
    manager, writer, Elevate staff). On a live course, only owner, manager and staff. The
    author chose this over a capability limited to owner and manager, and over a rule that
    lets staff only turn a clip off.
-   **Question 4 (measurement), answered 2026-11-19:** count the live courses that have a
    clip, and nothing more. No client event endpoint is added and existing server events are
    not compared.
-   **Question 5 (the clip's shape), answered 2026-11-19 and changed the same day:** 480
    pixels wide, 4 seconds, 10 frames a second, in the video's own shape. The card crops it to
    4:3 in the browser, because Mux stretches the picture when asked for a different shape.
    The first answer was 320 pixels, chosen on estimates from Mux's demo videos. The real
    calls gave smaller sizes, and the author then chose 480 pixels (Questions 10 and 12).
-   **Question 6 (old files), answered while drafting:** the old file is deleted from storage
    when a clip is replaced or turned off. Leaving it would keep paid footage reachable at its
    old address after the teacher turned it off, against Goal 2.
-   **Question 7 (existing live courses):** withdrawn on 2026-11-19. See Question 11.
-   **Question 8 (the agreement sentence), answered 2026-11-19:** the author signed off the two
    Chinese sentences as written under [The agreement sentence](#the-agreement-sentence). A
    change to either sentence, in English or in Chinese, needs the sign-off again.
-   **Question 9 (Mux in staging and production), answered 2026-11-19:** yes. Production is
    not deployed yet; it will run with Mux on. The setting (`integrations.mux`) is in each
    environment's `terraform.tfvars`, which is not in the repository. Terraform turns it into
    the API's `VIDEO_DRIVER`: `mux` when it is on, `local` when it is off.
-   **Question 10 (Mux behaviour on a signed asset), answered 2026-11-19 by real calls:** on the one
    video tried, the calls behave as the design describes. The calls were made on a Mux development
    environment against a normal (not test) video with signed playback: 60 seconds, 16:9, basic
    quality, a flat-coloured animated lesson. They used the pinned SDK, `@mux/mux-node` 15.5.0,
    signing with `type: 'gif'` and string values, and the address `animated.webp?token=`.
    1.  **The token works.** The default clip as it was then (start 10, end 14, width 320, 10
        frames a second) answered 200 with `image/webp`: 40 frames, 4,000 milliseconds, 320 by 180
        pixels, set to loop without end.
    2.  **Size and time.** The default clip was 137,772 bytes. Across all 56 whole-second
        starts on the video, clips were between 66 KB and 241 KB, with a median near
        142 KB. A first request took 2.0 to 4.1 seconds, typically about 3 seconds. At 320
        pixels the 3 MB cap leaves more than ten times the room. The one clip at the shipped
        width, 480 pixels, was 242,552 bytes and took 4.4 seconds. Filmed footage was not
        measured.
    3.  **The end rule holds.** A clip from second 55 to 59, one second before the stored
        length, was 40 frames and 4,000 milliseconds.
    4.  **The limit was not reached.** Mux documents 10 animated images for a video under 100
        seconds. All 56 whole-second starts on this 60-second video succeeded, plus three
        clips at other sizes. So what Mux answers at the limit was not seen.
    5.  **Whether the limit resets** could not be tested, because it was never reached.
    6.  **A repeat is served from Mux's cache.** The same clip asked for again with a fresh
        token answered in 17 to 311 milliseconds, marked as a cache hit. Whether a repeat
        counts against the limit could not be tested either.

    Two more facts from the same calls:
    -   A start past the video's end answered 400 with a JSON body ("Invalid start time,
        must be smaller than end time"), which the driver's content-type check turns into
        "no clip".
    -   The same four seconds at other shapes: 480 pixels and 10 frames a second was
        242,552 bytes; 640 pixels and 10 frames a second was 360,998 bytes; 640 pixels, 15
        frames a second and five seconds was 618,466 bytes.

    These hold for this account on this day. The limit not applying is an observation, not
    something Mux documents.
-   **Question 11 (existing teachers), answered 2026-11-19:** there are none. Production is
    not deployed yet and no teaching profile exists there; the product is before version 1.0.
    The author removed the notice command and its email, the 14-day wait, the date on each
    profile, the `waiting` state and the seed change. The condition that replaces them is in
    Goal 2: the server PR is in production before the first teacher applies.
-   **Question 12 (the clip's size, after the measurements), answered 2026-11-19:** 480
    pixels. The 480-pixel figure is one measurement, 242,552 bytes for seconds 10 to 14 of
    a flat-coloured animation, which compresses well. By its ratio to the 320-pixel clip of
    the same seconds, clips of that video would run from about 0.12 MB to 0.42 MB. Filmed
    footage is expected to be larger, by an amount one video can't show.
-   **Question 13 (Mux's limit on animated images), answered 2026-11-19 by a conservative
    estimate:** the real calls never reached the limit, and Mux's guide does not say what happens at
    it. The design assumes the limit in Mux's guide is real: one animated image for every 10 seconds
    of a video, 10 for a video under 100 seconds, for the video's lifetime, with every clip Mux
    returns counted, a repeat included. Two rules keep a teacher inside it, and the author chose
    both over either alone:
    -   **The start moves in steps of 10 seconds,** and a video offers no more starts than
        its allowance.
    -   **The clips fetched for each video are counted,** and the refresh stops asking Mux
        when the count reaches the allowance.

    Whether the count stays is open again: see Question 14.
-   **Question 16 (a failed delete), answered 2026-11-19:** the clip's key stays on the course row
    until the delete of its file has succeeded. The clip is hidden first, then deleted, then
    forgotten, and a failed delete is tried again at the next refresh of that course. The old clip
    keeps showing until its replacement is stored. The author chose this over retiring the old clip
    before asking Mux, and over a list of files still to delete kept on the course row.
-   **Question 17 (the off switch and a stale choice), answered 2026-11-19:** the rule is
    enforced on the server. A
    chosen video is checked only when a request changes it to a new value, and never when
    the request turns the preview off. A stale choice stays stored and the card says so. The
    author chose this over removing the "not on this course" refusal, and over a fix in the
    Teach card alone.
-   **Question 18 (the default clip), answered 2026-11-19:** the default video is the course's first
    usable video in lesson order. The default clip starts 10 seconds in, or at second 0 when the
    video is shorter than 15 seconds. The author chose this over starting at second 0 and over
    starting a quarter of the way through.
-   **Question 19 (the data model), answered 2026-11-19:** plain columns on `courses`. The course
    row holds the clip's storage key (as `certificates` holds its PDF's key), the preview setting
    (off switch, chosen video, start second) and a record of which video and start the current clip
    was cut from. There is no media row for the clip. The author chose this over a `media_assets`
    row with a pointer on the course, and over a `course_previews` table.
-   **Question 20 (the Mux token type; the brief's Question 9, in part), answered
    2026-11-19:** Mux's "Secure video playback" guide lists a separate audience for animated
    images (`g`) and says image options must be claims inside the token.

## Critical User Journeys (CUJs)

### CUJ 1: A visitor hovers a card on a laptop

-   **Given**: a visitor on the learner web app, on a laptop with a mouse, with reduced motion
    off. Explore lists a live course that has a clip.
-   **When**: the visitor rests the mouse on that course's card for 400 milliseconds.
-   **Then**: the browser requests the clip and, once it has loaded, the clip fades in over the
    cover image. Twelve seconds after it loads, the cover image returns. If the visitor moves the
    mouse away sooner, the cover image returns at once. A sweep of the mouse across several
    cards requests nothing.

### CUJ 2: A visitor on a phone

-   **Given**: a visitor on the iOS or Android app, or on the web app on a phone.
-   **When**: the visitor scrolls Explore and taps a card.
-   **Then**: every card shows its cover image. No clip is requested. The tap opens the course
    page as it does today.

### CUJ 3: A new teacher's first course goes live

-   **Given**: a teacher's course has a video in its first lesson, at least 15 seconds long,
    and is under review.
-   **When**: a support agent approves the course.
-   **Then**: the course is live. Inside the same request the API fetches a 4-second clip from
    Mux, starting 10 seconds into that video, and stores it. The approval email tells the
    teacher that the course card shows a preview and where to change it. Explore returns the
    clip's address for that course.

### CUJ 4: A teacher picks a different moment

-   **Given**: an owner of a live course with a clip.
-   **When**: the owner opens the course's Details tab in Teach, picks another video and a
    start of 1:30 in the Hover preview card, and presses "Save preview".
-   **Then**: the request waits while the API fetches and stores the new clip, deletes the old file,
    and answers with the course. The Hover preview card shows the new clip. The audit log has a
    `course.preview` row with the old and new settings.

### CUJ 5: A teacher turns the preview off

-   **Given**: an owner of a live course with a clip.
-   **When**: the owner unticks "Show a hover preview" and presses "Save preview".
-   **Then**: the course has no clip. The catalog stops returning one, and the stored file is
    deleted. A browser that already fetched the clip may keep its copy.

### CUJ 6: Clips are repaired after a Mux outage

-   **Given**: Mux failed for an afternoon, and three courses were approved in that time. They
    are live with no clip.
-   **When**: a person runs the backfill command the next day.
-   **Then**: the command makes a clip for each of the three, leaves every other live course
    untouched without asking Mux for anything, and prints how many courses had each outcome.

### CUJ 7: An owner removes the previewed video

-   **Given**: a live course with two videos, whose clip was cut from the first lesson's
    video.
-   **When**: the owner deletes that video item from the live course in the curriculum editor.
-   **Then**: that request deletes the clip's file, and the course has no clip. No new clip
    is made in it, because that would wait on Mux. The Details tab shows that the clip is not
    up to date, with a "Make clip" button, which makes a clip from the second video. If the
    removed video was one the teacher had chosen, the card also says so, and "Make clip" and
    the tick box both still save. If it was the course's only video, the Details tab says
    the course has no video for a preview.

### CUJ 8: Mux fails during an approval

-   **Given**: a course under review, and Mux answering with an error or not at all.
-   **When**: a support agent approves the course.
-   **Then**: the approval succeeds after waiting on Mux for at most 10 seconds. The course is live
    with no clip, the failure is in the API log, and the teacher's email does not mention a preview.
    The Details tab shows "Make clip", and the backfill command also makes it.

## Technical Plan (Architecture)

### Terms

-   **Explore:** the learner app's home tab (`apps/learner/src/app/(tabs)/index.tsx`). It
    lists course cards, 12 to a page.
-   **Teach:** the teacher portal (`apps/teach`). **The builder** is its course editor
    (`apps/teach/src/routes/courses/builder.tsx`), with Curriculum, Map, Details and Review
    tabs.
-   **Support:** the internal staff portal (`apps/support`).
-   **A teaching profile** is what a teacher sells from. Its people are an owner, managers
    (company profiles only) and writers. **Staff** means an Elevate super-admin acting inside
    a profile in Teach.
-   **A video item:** a lesson artefact of type `video`. Its file is a row in `media_assets`.
-   **A usable video:** a video item among the course's live rows whose media row is a Mux video
    (`provider: 'mux'`) with `status: 'ready'`, a playback ID, and a stored length of at
    least 5 seconds. The length is the media row's, which comes from Mux, not the length a
    teacher can type on the item.
-   **The clip:** a 4-second silent animated WebP cut from one usable video, stored as a
    public file.
-   **The preview setting:** three values on the course: on or off, a chosen video, and a
    chosen start second. An empty chosen video or start means "the default".
-   **The source record:** which video and start second the stored clip was cut from.
-   **Live rows and draft rows:** `lessons` and `artefacts` hold a writer's pending edits to a
    live course as draft rows beside the live ones. Everything a learner is shown reads the
    live rows through `deps.learnerDb` (`AGENTS.md`). "Live" here is about the row, not the
    course's status: every row of a course that has never been live is a live row too,
    because draft rows exist only for edits to a live course.
-   **A change set:** a writer's pending edits to a live course. The profile's owner or a
    manager approves it; Support is not involved.
-   **The live views:** database views that show only the live rows of the course content
    tables. `deps.learnerDb` reads through them. This design uses the two for `lessons` and
    `artefacts`, under the relation names `liveLessons` and `liveArtefacts`.
-   **The schema guard test** (`apps/api/test/schema-guard.test.ts`) fails when any code
    other than `courses.service.ts` and `change-sets.service.ts` touches the raw `lessons`
    and `artefacts` tables.
-   **The course view:** what the API sends Teach and Support for one course, the
    `CourseView` type (`packages/core/src/contracts/teach.ts`). The builder and Support's
    review page both read it.
-   **`requireProfile`:** the check every Teach API route runs. The caller must be allowed
    to act in the profile and hold the capability the route names.
-   **`USER_ERROR_CODES`** (`packages/core/src/contracts/errors.ts`): the error codes a
    learner can meet, each with a translated message. A code that only Teach can produce is
    not in it.
-   **Recovery:** Support's way to change a profile's owner (`RecoveryService`), open to a
    super-admin only.
-   **The save tracker:** Teach's count of builder saves in flight, which drives the
    header's "Saving…" and "All changes saved" (`apps/teach/src/lib/save-tracker.tsx`).
-   **The hero animation:** the animated scene on Explore
    (`apps/learner/src/components/mascot/HeroScene.tsx`).

### Decisions made while drafting

The author's choices are under [Open Questions](#open-questions). These follow from them. They were
decided while drafting and not put to the author one by one. Where another option was weighed, it is
under [Alternatives Considered](#alternatives-considered).

1.  **The chosen video is stored as a media ID, not an artefact ID.** An artefact's ID can
    change when a change set is approved (a deleted item that a writer's draft brings back
    goes live under a new ID), and the source record needs a media ID anyway.
2.  **Clips exist only for live courses.** On a draft or rejected course the setting is saved
    and no clip is made. The clip is made when Support approves the course.
3.  **The save in Teach is its own button and waits for the clip.** The response carries the
    new clip, so Teach needs no polling.
4.  **Changing the setting writes an audit row,** as a price change does. It changes what the
    public sees of paid content.
5.  **The off switch for the whole feature is an API configuration value,** `COURSE_PREVIEWS`,
    on by default. [`docs/spec.md`](../spec.md) puts feature flags out of scope; this is one
    environment variable read at start-up, like `VIDEO_DRIVER`, not a flag system.
6.  **The clip is drawn as a second image over the cover,** mounted only while it plays. The
    hover code lives in a web-only file, so no native bundle contains it.
7.  **Local development and tests make no real clip.** The local video driver has no Mux and
    the API has no video tooling. The seed is unchanged: seeded courses have no video.
8.  **The agreement sentence is a second message** beside the existing one on each
    application page, so each message stays one sentence.

### Data flow

```text
 Teach, Details tab     Support           Profile                  a person
 "Save preview"         approves course   approves a change set    runs the command
 PATCH courses/:id      POST .../approve  POST .../approve         previews backfill
        |                     |                 |                       |
        +---------------------+--------+--------+-----------------------+
                                       v
              CoursePreviewService.refresh(courseId)        never throws
              1 read the course and its live rows           (deps.learnerDb)
              2 course not live?                  -> stop
              3 wanted = resolvePreview(setting, videos)    (packages/core)
              4 nothing wanted, a leftover, or the clip's video gone from the course?
                                                  -> hide, delete the file, forget the key
              5 COURSE_PREVIEWS off?              -> stop
              6 wanted equals the source record?  -> stop
              7 the video's allowance used up?    -> stop
                video.animatedPreview(...)        -> WebP bytes   (Mux, token audience g)
                storage.put  public/previews/<courseId>/<uuid>.webp
                wanted video gone from the course? -> delete the new file, stop
              8 an old clip is stored?            -> hide it, delete its file
              9 UPDATE courses SET preview_key, source record   (only if nothing changed)

 Teach, curriculum editor: a direct edit to a live course's lessons or items
   CoursesService.edited  ->  CoursePreviewService.retireIfVideoGone(courseId)
        the clip's video is no longer on the course?  -> hide, delete the file, forget the key
        never asks Mux, never throws

 Learner, Explore on the web
   GET /catalog/courses  ->  CatalogService.list
        previewUrl = the address of preview_key, when COURSE_PREVIEWS is on, the
        preview is on, and a source is recorded
   hover or keyboard focus, 400 ms  ->  <img src=previewUrl> over the cover image
```

### The data model

Seven new columns, all additive: six on `courses` and one on `media_assets`. Rows that exist
at release get the defaults.

`courses`:

| Column                         | Type and default                  | Meaning                                                            |
| ------------------------------ | --------------------------------- | ------------------------------------------------------------------ |
| `preview_enabled`              | boolean, not null, default `true` | The teacher's off switch.                                          |
| `preview_media_id`             | uuid, null, FK `media_assets`     | The chosen video. Empty means the default video.                   |
| `preview_start_seconds`        | integer, null, check `>= 0`       | The chosen start, a multiple of 10. Empty means the default start. |
| `preview_key`                  | text, null                        | The stored clip's storage key. Empty means no clip.                |
| `preview_source_media_id`      | uuid, null, FK `media_assets`     | The video the stored clip was cut from.                            |
| `preview_source_start_seconds` | integer, null                     | The start second the stored clip was cut from.                     |

`media_assets`:

| Column            | Type and default               | Meaning                                                   |
| ----------------- | ------------------------------ | --------------------------------------------------------- |
| `preview_fetches` | integer, not null, default `0` | How many clips Mux has returned for this video, in total. |

-   The count is on the video's row, not the course's, because Mux's limit is per video. A
    video used on two courses has one allowance.
-   Both foreign keys use `ON DELETE SET NULL`, as `thumbnail_media_id` does. Nothing deletes a
    media row today.
-   The database stores the key, never an address. Addresses are built when a response is
    made, as for cover images, because local development builds them from the request's
    origin.
-   The columns are on `courses` and not on `lessons` or `artefacts`. Those two tables feed
    the live views and the change-set copy and compare code, and a column there would need
    changes in all of them.

### The rule for what the clip shows

One pure function in `packages/core`, `resolvePreview`, decides what a course's clip should
be. The API's refresh and the course view both call it. Teach and Support show what the
course view sends and do not work the rule out again, so they can't disagree.

-   **Input:** the preview setting, and the course's video items in order. The order is
    lessons by position then creation time, then items by position then creation time. That
    is the order a learner sees; positions alone can tie.
-   **Output:** a video and a start second, or nothing.
-   **Rule:**
    1.  If the preview is off, nothing.
    2.  If a video is chosen and it is a usable video on the course, that video. Otherwise
        the first usable video in order. If there is none, nothing.
    3.  The start. Starts are multiples of 10 seconds. For a chosen start, the chosen value, lowered
        if needed to the last allowed start of the video. For the default, 10 seconds when the video
        is at least 15 seconds long, otherwise 0. A chosen start belongs to the chosen video:
        when a chosen video is not usable and the rule falls back to the default video, the
        chosen start is dropped and the default start is used. A chosen start with no chosen
        video goes with whichever video is the default at the time.
-   **The allowed starts of a video** are 0, 10, 20 and so on, for as long as the 4-second
    clip ends at least 1 second before the video's stored length (the stored length is
    rounded), and never more of them than the video's allowance. A 60-second video has six:
    0 to 50. A 105-second video has ten, 0 to 90, although second 100 would fit.
-   **A video's allowance** is the larger of 10 and its length in seconds divided by 10,
    rounded down. That is the limit in Mux's guide, taken as real (Question 13).
-   The clip's end is always the start plus 4 seconds. A usable video is at least 5 seconds
    long, so the end is never past the video's end.
-   A chosen video that has left the course is not an error. The rule falls back to the
    default, and Teach says so. The saved choice stays on the course row until a later save
    replaces it or empties it.
-   A video shorter than 5 seconds, or with no stored length, is not usable. A course whose
    only videos are like that has no clip.

The clip's shape is fixed: `width: 480`, 4 seconds, `fps: 10`. No height is sent, so the clip
keeps the video's own shape.

### Making the clip

**The video provider** gains one method, on all three drivers:

```text
animatedPreview(asset, { startSeconds, endSeconds, width, fps })
    -> { bytes: Uint8Array, mimeType: 'image/webp' } | null
```

-   **Mux driver:** signs a token with the SDK call the driver already uses for thumbnails:
    `jwt.signPlaybackId(playbackId, { type: 'gif', expiration: '5m', params: { start, end,
    width, fps } })`, with every value a string. It then requests
    `https://image.mux.com/<playbackId>/animated.webp?token=<token>`. This is the API's first
    plain HTTP request to another service, so the driver sets its own limits:
    -   a 10-second timeout;
    -   only status 200 with content type `image/webp` counts;
    -   a body over 3 MB is refused.

    Anything else returns `null`. Mux's error bodies are JSON, and without these checks one
    could be stored as a public `.webp`.
-   **Local driver:** returns `null`. It holds only the uploaded file.
-   **Fake driver (tests):** returns fixed bytes, records each call, and can be told to return
    `null` or throw.

**`CoursePreviewService.refresh(courseId)`** is the one function that makes, replaces or
clears a clip. It never throws: any error is logged with `deps.log.warn` and reported as
`failed`. It returns what it did, one of eight outcomes:

| Outcome     | Meaning                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `made`      | A clip was fetched and stored.                                                                                                                                                  |
| `unchanged` | The stored clip is already what the rule wants, or the course changed while this run was working: another refresh, a save, or a direct edit that removed the wanted video.      |
| `cleared`   | Nothing is wanted; the stored clip was hidden, its file deleted and its key forgotten.                                                                                          |
| `none`      | Nothing is wanted and nothing was stored (off, or no usable video).                                                                                                             |
| `not_live`  | The course is not live.                                                                                                                                                         |
| `paused`    | `COURSE_PREVIEWS` is off.                                                                                                                                                       |
| `limit`     | The video's allowance is used up, so Mux was not asked. A clip that is stored is left as it was; there may be none.                                                             |
| `failed`    | The fetch, a delete or a write failed. After a failed fetch the stored clip still shows. After a failed delete it is hidden, and the delete is tried again at the next refresh. |

The steps, numbered as in the diagram:

1.  **Read.** The course and its live lessons and items with their media, through `deps.learnerDb`.
    The service never touches the raw `lessons` and `artefacts` tables, which the schema guard test
    forbids outside two services.
2.  **Live.** Stop with `not_live` unless the course is live. A live course never stops being
    live, so a course that is not live has no stored clip.
3.  **Decide.** `resolvePreview` gives the wanted video and start.
4.  **Retire.** This step applies when a key is stored and any of these holds:
    -   nothing is wanted;
    -   the source record is empty, which marks a leftover from a delete that failed earlier;
    -   the source record's video is no longer among the live video items read in step 1.
        A writer's approved change set can remove it, and so can a direct edit whose own
        retire step failed.

    The third case matters because the steps after this one can stop with the old clip still
    stored: `paused`, `limit` and a failed fetch all do. Without it, a clip of a removed
    video would keep showing whenever the new clip could not be made.
    1.  **Hide.** A guarded `UPDATE` empties the source record. The catalog stops returning
        the clip at once. If no row changes, stop with `unchanged`.
    2.  **Delete.** `storage.delete(key)`. If it fails, log it and stop with `failed`. The key
        stays on the row, so the next refresh comes back to this step.
    3.  **Forget.** An `UPDATE` empties `preview_key` where it still holds that key.
    4.  If nothing is wanted, stop with `cleared`. Otherwise go on with no key stored.

    If nothing is wanted and no key is stored, stop with `none`. This step comes before the
    next one on purpose: a teacher who turns the preview off gets the file deleted even while
    previews are paused, and a leftover is cleaned up without waiting for Mux.
5.  **Paused.** Stop with `paused` if `COURSE_PREVIEWS` is off.
6.  **Unchanged.** If a clip is stored and the wanted video and start equal the source record,
    stop. This also keeps repeat runs from asking Mux for anything.
7.  **Fetch and store.**
    1.  **Allowance.** If the wanted video's `preview_fetches` has reached its allowance,
        stop with `limit`, without asking Mux. A clip that is stored keeps showing.
    2.  **Fetch.** Call `animatedPreview` with the start, an end 4 seconds later, the width
        and the frame rate. On `null`, stop with `failed`; a clip that is stored keeps
        showing.
    3.  **Count.** Add one to the video's `preview_fetches`, in SQL, so two refreshes can't
        lose each other's count. Only a clip Mux returned is counted: a refusal, an error or
        a timeout is not. A timed-out request that Mux did serve is therefore missed. A
        counted clip stays counted when a later step throws it away: a failed write in 7.4,
        the second look in 7.5, a lost guard or a failed delete in step 8, or a lost guard
        in step 9.
    4.  **Store.** Write the bytes to a new key,
        `public/previews/<courseId>/<random UUID>.webp`.
    5.  **Look again.** Read the course's live video items once more. If the wanted video is
        no longer among them, delete the file just written and stop with `unchanged`: a
        direct edit removed the video while Mux was answering, and nothing at read time
        would hide the clip.
8.  **Retire the old clip.** Only when a key is still stored, which means this is a
    replacement.
    1.  **Hide.** A guarded `UPDATE` empties the source record. If no row changes, delete the
        new file and stop with `unchanged`.
    2.  **Delete.** `storage.delete(oldKey)`. If it fails, delete the new file, log it and
        stop with `failed`. The old key stays on the row with an empty source record, so the
        next refresh retires it in step 4 and then makes the clip again.
9.  **Point the course at the new file.** One guarded `UPDATE` sets `preview_key` to the new
    key and writes the source record. If it returns no row, this run deletes the file it
    just wrote and stops with `unchanged`. If the update throws, its result is unknown, so
    the file is left where it is: deleting it could leave the row pointing at a file that
    is gone.

One rule applies to every step: **`preview_key` is emptied or replaced only after the
delete of that key's file has succeeded.** A row with a key and an empty source record means
"hidden, file still to be deleted". The catalog, the course view and the count all treat it
as no clip.

**The guard.** The guarded updates in steps 4, 8 and 9 require that `preview_key` still holds
what this run last saw on the row, and that the three setting columns still have the values
read in step 1. The "forget" update in step 4 compares the key alone: the file is gone
whatever the setting now says.

**What this does not do.** Nothing retries a failed delete on its own. The retry is the next refresh
of that course: a save of the preview setting, an approval, or the backfill. The teacher is not
told; the save answers 200 and only the log shows it. The backfill retries it, and reports `failed`
only if the delete fails again. And a clip the teacher changed keeps showing when Mux fails to give
the new one. A change made while previews are paused is hidden with everything else, and the old
clip shows again when previews are switched back on, until a refresh replaces it. The author chose
this on 2026-11-19 over retiring the old clip before asking Mux, which leaves a course with no clip
during every change.

Three details:

-   **A new key every time.** Public files are served with
    `Cache-Control: public, max-age=31536000, immutable` (`apps/api/src/routes/files.ts`), so
    a key's content must never change.
-   **The first deletions in the codebase.** Nothing calls `storage.delete` today. Deleting
    stops the address working for new requests. It can't recall a copy a browser already
    holds. In production the bucket is versioned, so a deleted clip is kept as an old version
    that nobody can request. This design adds a lifecycle rule that removes old versions
    under `public/previews/` one day after the delete. The rule is Terraform, so it works
    only once a person has applied it ([Order of release](#order-of-release)).
-   **System writes keep the course's `updated_at`.** Every update in a refresh assigns the column
    to itself (`updated_at = updated_at`). Drizzle fills the column on update only when the
    statement leaves it out, and assigning it to itself can't move it backwards, as writing back a
    value read ten seconds earlier could. Without this, a backfill would reorder Teach's and
    Support's course lists, which sort by it, and reset an open Details form.

### When the clip is made

`refresh` is called from three request paths and from the backfill command. In each request
the call comes after the work it follows has been committed.

-   **In the two approvals it comes after the audit row and before the emails.** The audit
    row is written at once, as it is today, so a crash during the wait for Mux can't leave an
    approval with no record. The emails are awaited without a catch, so a call placed after
    them would be skipped when an email fails.
-   **A change-set approval also calls `retireIfVideoGone` straight after its transaction,
    before the audit row.** The transaction is where the clip's video can leave the course.
    That call never asks Mux and never throws, so it costs the audit row nothing, and a
    failed audit write can't leave a removed video's clip showing.
-   **In the save it also comes after the audit row.** The setting and its audit row are
    written first, so the record is made before the wait for Mux and not after it. The two
    writes are separate statements, as in `setPrice` today. If the audit write fails:
    -   the save answers 500 and the refresh does not run;
    -   a preview saved as off is hidden at once, because the catalog reads the setting, and
        its file is deleted at the next refresh;
    -   that change has no audit row, and repeating the save writes none, because nothing
        changes the second time.

| Where                           | Placement                                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ReviewService.approve`         | After the `UPDATE` that sets the course live and its audit row, before the emails.                                                                                                                    |
| `ChangeSetsService.approve`     | `retireIfVideoGone` straight after the transaction returns; `refresh` after its audit row, before the email. Neither inside the transaction, which holds row locks on the course and all its content. |
| `CoursesService.update`         | After the row update and its audit row, when the request carried a preview field.                                                                                                                     |
| `CoursesService.edited`         | Not `refresh` but `retireIfVideoGone`, after a direct edit to a live course's lessons or items.                                                                                                       |
| The `previews backfill` command | Once for each live course.                                                                                                                                                                            |

It is not called when an owner, manager or staff edits a live course's lessons directly, or
when a Mux webhook marks a video ready: it can wait on Mux for up to 10 seconds, and an edit
should not. Two things cover those:

-   **A direct edit retires a clip whose video is gone.** Every content-edit method of
    `CoursesService` finishes through one private function, `edited`. After a direct edit it
    calls `CoursePreviewService.retireIfVideoGone(courseId)`, which never asks Mux and never
    throws:
    1.  Read the course row. Stop unless the course is live, a key is stored and a source is
        recorded. Most edits end here, at the cost of one small read.
    2.  Read the course's live video items. Stop if the source media is still among them.
    3.  Hide, delete and forget, as step 4 of `refresh` does. The hide's guard compares the
        key and the source record with the values just read. If the delete fails, the key
        stays with an empty source record, and the next refresh deletes the file.

    It runs whether or not `COURSE_PREVIEWS` is on. An edit made in a writer's change set
    does not call it, because that edit changes draft rows. The approval calls it when the
    edit goes live, and step 4 of the approval's `refresh` would do the same work.
-   **The course view** tells Teach when the stored clip is not what the rule wants, and Teach
    shows a "Make clip" button.

Nothing checks this again when the catalog is read. If the retire step fails before it hides
the clip, or a later edit path does not finish through `edited`, a clip of a removed video
keeps showing until the next refresh of that course, whose step 4 retires it whatever else
that refresh can or can't do. The author accepted that on 2026-11-20 in exchange for a
catalog query that stays as it is today (Alternative AM).

The cost, which the author accepted with this choice: after an owner replaces a live
course's first video, the course has no clip until someone presses "Make clip", a change set
is approved, or the backfill command runs.

Each of the first three places can wait on Mux for up to 10 seconds, and then stores the
clip.

### The catalog

`CourseCard` (`packages/core/src/contracts/catalog.ts`) gains `previewUrl: string | null`.
The course page's type, `CoursePublicView`, does not change.

`CatalogService.list` fills it. For each course it returns the address of `preview_key` only
when all of these hold:

-   `COURSE_PREVIEWS` is on;
-   `preview_enabled` is true and `preview_key` is set;
-   `preview_source_media_id` is set. A key with no recorded source is a clip that is hidden
    with its file still to be deleted.

This test is one function, `previewIsShown`, in `packages/core`. The course view and the
count command use the same function, so "has a clip" means the same in all three: the clip
Teach draws and the number the count prints are what a visitor can see.

The list query does not change. Whether the clip's video is still on the course is settled
when the course is edited, not when the catalog is read
([When the clip is made](#when-the-clip-is-made)).

The address comes from `deps.storage.getUrl(key)`, which for a public key joins strings and
does no I/O.

`CatalogService.toCard` has a second caller, `EnrollmentsService`, which builds the cards on
My Learning with its own query. Its cards get `previewUrl: null`: nothing there shows a clip.

### The learner card

No new package and no new text.

-   **`CourseCard.tsx`** keeps its layout. It gains state for "hovered" and "reached with the
    keyboard", set by `onHoverIn`, `onHoverOut`, `onFocus` and `onBlur` on the card's
    `Pressable`. It hands the 4:3 image area to a new component, `CourseCardCover`, with the
    cover address, the clip address and whether the card is active. Handlers are used because
    a function-valued `style` on that `Pressable` appears to be dropped by the `Link asChild`
    wrapper around it. That was read from source, not run.
-   **`CourseCardCover.tsx`** is the base file, which iOS and Android load. It draws the cover
    image as today and ignores the rest. It also exports `isKeyboardFocus`, which returns
    `false`.
-   **`CourseCardCover.web.tsx`** is the web file, with the same exports. It holds all the
    hover behaviour:
    -   **Who gets it.** The clip is shown only when
        `matchMedia('(hover: hover) and (pointer: fine)')` matches and
        `matchMedia('(prefers-reduced-motion: reduce)')` does not. Both are followed live, so
        plugging in a mouse or changing the setting takes effect without a reload.
    -   **The delay.** When the card becomes active, a 400 ms timer starts. Leaving clears it.
        `react-native-web`'s `Pressable` has no hover delay of its own.
    -   **The clip.** When the timer fires, a second `expo-image` is mounted over the cover,
        absolutely positioned, `contentFit="cover"`, with a 150 ms fade. The cover stays
        underneath, so there is no blank frame while the clip loads. Nothing gives the clip's
        address to an image, a prefetch or a style before that moment, so nothing is
        downloaded (Goal 4).
    -   **Stopping.** The clip is unmounted when the card stops being active, 12 seconds
        after it has loaded, or when it fails to load. `expo-image` can't pause an animated
        image on the web, so unmounting is the only way to stop it. A load failure is
        forgotten when the card stops being active, so the next hover tries again.
    -   **Keyboard.** `isKeyboardFocus(event)` checks `:focus-visible` on the focused
        element. `react-native-web` reports focus from a mouse click too, and a click should
        not start the clip. React Native's types give the event's target no DOM methods, so
        the web file checks at run time that the target is an `Element` before asking.
    -   **Assistive technology.** The clip's wrapper is hidden (`aria-hidden`, not focusable,
        no pointer events), as the hero animation is. The card stays one link with the same
        name.
-   **The crop.** The clip is 16:9 for most lesson video and the image area is 4:3, so
    `contentFit="cover"` cuts an eighth off each side.

### The control in Teach

A "Hover preview" card on the builder's Details tab, under "Cover image". It is its own
component with its own state, in English like the rest of the tab.

-   **What it shows:**
    -   a tick box, "Show a hover preview on the course card";
    -   a select of the course's usable videos by lesson and item title, with "Default: the
        course's first video" first. The list comes from the course view, not from the
        lessons on screen, which are draft rows for a writer. When the saved choice is not
        in the list, the select shows "Default" as selected, the card says "The video you
        chose is no longer on this course. The default is used.", and the next save sends an
        empty choice;
    -   a select of the chosen video's allowed starts, shown as times, with the default
        first, and a line saying how many clip changes that video has left;
    -   the stored clip, as an `<img>`;
    -   one line of state, and a "Save preview" button, or "Make clip" when the setting is
        saved and the clip is not up to date.
-   **The states,** which the API computes and sends in the course view:

    | State      | Meaning                                                                                 | What the card says                                                                                                        |
    | ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
    | `off`      | The preview is turned off.                                                              | No preview is shown.                                                                                                      |
    | `no_video` | The course has no usable video.                                                         | Add a video to a lesson to get a preview.                                                                                 |
    | `not_live` | The course is not live.                                                                 | The clip is made when the course goes live.                                                                               |
    | `paused`   | `COURSE_PREVIEWS` is off.                                                               | Elevate has previews switched off.                                                                                        |
    | `limit`    | The clip is not what the setting asks for, and the wanted video's allowance is used up. | This video has no clip changes left, so its clip can't be made or changed. Choose another video, or turn the preview off. |
    | `pending`  | A clip should exist and is missing or out of date.                                      | The clip is not up to date, with "Make clip".                                                                             |
    | `ready`    | The stored clip is what the rule wants.                                                 | This is what visitors see.                                                                                                |

-   **Saving.** Both buttons use `PATCH /teach/profiles/:profileId/courses/:id`, the route the cover
    image uses. "Save preview" sends the three setting fields, or the switch alone when the preview
    is being turned off. "Make clip" sends the chosen video and the start and leaves out the on or
    off value, so a tab left open can't turn back on a preview that was turned off elsewhere. No new
    route or capability is added, so the role table and its test need no new row.
-   **Who.** The existing details rule: draft and rejected courses, anyone with
    `course.editDraft`; live courses, `course.editLive`; courses under review, nobody. The
    builder already disables the Details tab for a writer on a live course, and its note there
    gains "hover preview".
-   **Checks on the server.** The rule is enforced on the server, so it holds for any client,
    including a browser tab left open with old code.
    -   **Only a new value is checked.** A chosen video is checked when the request changes
        it to a value different from the stored one. A value equal to the stored one is not
        checked again: it passed when it was saved, and a video that has since left the
        course is not an error. So "Make clip" can't be refused over a stale choice.
    -   **Turning off is never checked.** When the request carries the preview as off, only
        the switch is saved. A video or a start in the same request is ignored, whatever it
        is, and the stored choice stays. Turning off can't fail on the video. A value the
        request schema itself rejects, such as an ID that is not a UUID or a start that is
        not a multiple of 10, still answers 400, because the schema runs before this rule.
    -   **A new value is checked in three steps,** each with its own answer:
        -   not a file of this profile: 404, as for any other profile's media;
        -   a file of this profile that is not a video: 400 `wrong_kind`;
        -   a video that is not on a video item of this course: 422
            `preview_video_not_on_course`.

    The select offers only videos that pass all three, so a refusal can come only from a tab
    loaded before a video was removed, or from a hand-made request. The card shows it as the
    server's English sentence in the usual save-failed toast. The start must be a multiple
    of 10 from 0 to 86,400; one past the video's last allowed start is lowered, not refused.
    The stored value stays as it was sent, and the rule lowers it each time it resolves the
    clip.
-   **What the card's line follows.** The line naming the video and second shows what the
    last response resolved. It changes after a save, not while the teacher edits.
-   **A known cost.** Any write to the course row remounts the Details form, which is keyed by
    the course's `updatedAt`, and drops unsaved title or description edits. Saving the cover
    image does this today, and "Save preview" does the same. "Make clip" changes no setting,
    so it writes nothing to the course row and does not remount the form. The one exception
    is after a stale choice: the card then sends the choice and the start as empty, and the
    row is written once.

`CourseView` (`packages/core/src/contracts/teach.ts`) gains one field:

```text
preview: {
  enabled: boolean
  mediaId: string | null            // the saved choice; null is the default
  startSeconds: number | null       // the saved choice; null is the default
  resolved: { mediaId: string; startSeconds: number } | null   // what the rule picks now
                                                               // the usable live videos, in order
  videos: Array<{ mediaId: string; lessonTitle: string; itemTitle: string;
                  durationSeconds: number;
                  starts: number[];                            // the allowed starts, in seconds
                  changesLeft: number }>                       // allowance less fetches, never < 0
  clipUrl: string | null
  state: 'off' | 'no_video' | 'not_live' | 'paused' | 'limit' | 'pending' | 'ready'
}
```

### Support's review page

Support's course page (`apps/support/src/routes/review-course.tsx`) reads the same
`CourseView`. Its "Course page" card gains one line under the cover image: whether the
preview is on, and which video and start second the rule picks. For a live course it also
shows the stored clip. A reviewer can then watch that part of the video on the same page
before approving. Support gets no control.

### The agreement sentence

Each application page shows a second sentence under the existing one. The author signed off
the Chinese text on 2026-11-19 ([Question 8](#open-questions)):

| Key                               | English                                                                                                                                                                                            | Chinese (signed off 2026-11-19)                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `personalApply.agreementPreviews` | Elevate may show a few silent seconds of video from each of your courses on its course card, as a preview that anyone can see; you can change the preview or turn it off for each course.          | Elevate 可能会在课程卡片上展示每门课程中几秒无声的视频片段，作为所有人都能看到的预览；您可以为每门课程更换预览或将其关闭。     |
| `companyApply.agreementPreviews`  | Elevate may show a few silent seconds of video from each of the company's courses on its course card, as a preview that anyone can see; you can change the preview or turn it off for each course. | Elevate 可能会在课程卡片上展示公司每门课程中几秒无声的视频片段，作为所有人都能看到的预览；您可以为每门课程更换预览或将其关闭。 |

Nothing is stored when a teacher applies. The consent rests on the sentence being on the page
for every application, which the release condition in Goal 2 provides.

Two limits of this consent:

-   Managers and writers who join a profile by invitation never see the agreement page.
-   An owner installed by Support's recovery process did not apply.

### The commands

One new entry in the API image, `dist/previews.js`, with three commands. It is run the way
the seed is run: a person starts a one-off ECS task with a command override.

-   **`previews backfill`** calls `refresh` for every live course and prints a count for
    each outcome. It is the repair after a Mux outage, and after `COURSE_PREVIEWS` is switched
    back on. A second run asks Mux only for courses whose clip does not match the rule.
-   **`previews count`** prints the number of live courses and how many have a clip (Goal 9).
-   **`previews check`** asks Mux for one clip of a named video and prints whether it came
    back, its size and how long it took. It stores no file and changes no course. A clip that
    comes back is a real fetch, so it adds one to the video's count. It is the repeatable
    form of the first three checks, for when the Mux SDK is upgraded or the clip's shape
    changes. It does not test the limit, which would use up the video's allowance.

### Configuration and turning it off

-   **`COURSE_PREVIEWS`** is a boolean in the API's environment (`apps/api/src/env.ts`),
    default on. When off, the catalog returns no clip address, `refresh` makes nothing, and
    Teach shows `paused`. Stored files stay, except those the refresh retires before it
    checks the switch: a preview turned off, a course left with no usable video, and a
    leftover from a failed delete. A direct edit that removes a clip's video deletes that
    clip too. The switch is a pause, not a takedown: a stored file is still served to anyone
    who has its address, because the file route serves every public file. Deleting is per
    course, by turning that course's preview off.
-   **Terraform** passes it from a new module variable, `course_previews`, default `true`.
    Switching it off is a change to the environment's `terraform.tfvars`, a `terraform apply`
    by someone with AWS access, and a re-run of the Deploy workflow. It takes minutes, not
    seconds.
-   **A teacher** turns one course off in Teach.
-   **Mux off means no clips.** An environment whose video driver is `local` makes none
    ([Question 9](#open-questions)).

### Order of release

-   **The Mux checks came first.** They were made on 2026-11-19, before any code (item 1).
    They did not measure filmed footage; that is measured in staging before the learner PR
    deploys ([Checks before any code is written](#checks-before-any-code-is-written)).
-   **Two pull requests.**
    1.  **The server PR:** the migration, `packages/core`, the API (provider method, `refresh`
        and `retireIfVideoGone`, catalog field, the three `refresh` call sites, the two
        `retireIfVideoGone` call sites, the commands, the configuration value), Teach's
        control and agreement sentences, Support's line, and the documents. After it, the
        catalog returns `previewUrl` and no learner card shows it.
    2.  **The learner PR:** the card's hover behaviour. It needs the server PR.
-   **Both deploy on the same day** (the author's choice, 2026-11-19). Between the two
    deploys a clip can be public while no card shows it, and the approval email already says
    that the course card shows a preview. A teacher who looks in that time finds none.
    Nothing enforces the same day; the gap is accepted.
-   **The Chinese text is signed off** ([Question 8](#open-questions)). The server PR uses
    the two sentences exactly as written in this design.
-   **The server PR is in production before production opens to teachers** (Goal 2). So is
    the answer to Question 15.
-   **The Terraform of item 20 is applied by a person in each environment,** before
    production opens to teachers. The lifecycle rule for deleted clips does not exist until
    then. A late apply still works: the rule acts on versions that are already old. The
    `course_previews` variable needs no apply, because its default matches the API's.
-   **No backfill or migration command has to be run after either deploy.** Staging runs
    `previews count` and `previews check` between the two deploys, as a check
    ([Verification Plan](#verification-plan)).
-   **Native apps** need no build for this design. A native build made after the learner PR
    contains only the base cover component.

### Checks before any code is written

The checks were real calls to Mux, made on 2026-11-19 as item 1 of the plan, before any code.
They were meant for a signed video of real lesson footage. The video used was a 60-second
flat-coloured animation with signed playback, so they show how Mux behaves, and not how large
or how slow a clip of filmed footage is. The results are under Question 10 in
[Open Questions](#open-questions).

1.  **The token.** A token with `type: 'gif'` and string values for `start`, `end`, `width`
    and `fps` returns an animated WebP from `animated.webp`. Passed, with the default clip as
    it was then: start 10, end 14.
2.  **Size and time.** The file's size at the clip's shape, and how long a first request
    takes. Measured on 56 clips at 320 pixels, the width chosen at the time, and on one clip
    at the shipped 480 pixels (242,552 bytes, 4.4 seconds). Not measured on filmed footage.
3.  **The end.** A clip whose end is 1 second before the stored length of the video is 4
    seconds long. Passed.
4.  **At the limit.** What Mux answers when the video has used its limit of animated images
    ("1 GIF for every 10 seconds of duration per asset", at least 10). Not answered: the
    limit was never reached.
5.  **Whether the limit resets.** Not answered, for the same reason.
6.  **Whether a repeat counts against it.** Not answered, for the same reason.

Two things follow:

-   **Filmed footage is measured in staging.** The 3 MB cap, the 10-second timeout and the
    load figure in [Risks](#risks) rest on check 2. Before the learner PR deploys,
    `previews check` is run on two filmed videos in staging, and the constants are revisited
    if either clip is over half the cap or took over half the timeout
    ([Verification Plan](#verification-plan)).
-   **The limit is assumed, not observed.** The design builds to Mux's documented limit
    (Question 13). Whether the count that guards it stays is open (Question 14).

### Records and rules

-   **A new ADR, 011:** a public clip of signed lesson video, stored once; that it is on by
    default, on the strength of the agreement sentence; that clips are made inside requests
    and by a hand-run command. It notes the exception to ADR 004's line that playback URLs are
    minted only after an enrolment check. It also records the release condition: the server
    PR is in production before any teacher applies.
-   **`docs/runbooks/mux.md`:** its statement that every thumbnail and HLS address carries a
    short-lived token gains the stored clip and the `gif` token used once to fetch it.
-   **`infra/README.md` and `docs/runbooks/deploy.md`:** the three commands, when to run each,
    and the new configuration value.
    -   `infra/README.md` also gets the query that lists clips that are hidden or switched
        off with a file still stored:
        `select id from courses where preview_key is not null and (preview_source_media_id is null or not preview_enabled)`.
    -   `deploy.md`'s checklist before the first real transaction gains a line: the
        hover-preview server PR was deployed before any teacher applied. The check is
        `select count(*) from profiles where applied_at < '<time of that deploy>'`, which
        must return 0.
-   **`docs/runbooks/local-dev.md`:** local development shows no clip without Mux.
-   **`AGENTS.md`:** one rule: a clip is made, replaced or cleared only by
    `CoursePreviewService`, a stored clip always gets a new key, and a direct edit to a live
    course's content finishes through `CoursesService.edited`.
-   **The brief:** this design departs from the brief in the five ways listed in the
    [Overview](#overview), four of them from its decision 9. The brief itself is left as
    written.

## Risks & Mitigations

### Risks

| Risk                                           | What goes wrong                                                                                                                                                                                                                                                                                           | Mitigation or accepted cost                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A teacher objects after the footage is out** | A teacher did not read the agreement sentence, or reads it differently. A public clip can't be recalled from browsers that fetched it.                                                                                                                                                                    | Accepted by the author with "on by default". The control in Teach and the approval email's sentence are the mitigations. Turning it off deletes the stored file.                                                                                                                                                                                                                                                                      |
| **The default shows the wrong thing**          | Ten seconds into the first video is a title card, or content the teacher would not give away.                                                                                                                                                                                                             | Accepted. The teacher can pick another video or second. The approval email says a preview is showing.                                                                                                                                                                                                                                                                                                                                 |
| **A course sits without a clip**               | An owner replaces the first video of a live course. Nothing remakes the clip until "Make clip", a change-set approval or the backfill.                                                                                                                                                                    | Accepted with Question 1's answer. The Details tab shows the state. Running the backfill repairs it. No cadence is set and nothing reminds anyone to.                                                                                                                                                                                                                                                                                 |
| **Mux behaves differently on a signed asset**  | The string-valued options, the `.webp` extension with a `gif` token, or the sizes differ from what was read and measured.                                                                                                                                                                                 | Checked by real calls on one animated video on 2026-11-19 (Question 10): the token, the address and the clip's length are as designed. At 320 pixels clips were 66 KB to 241 KB; at 480 pixels, the design's width, one clip measured 0.24 MB. The size cap and content-type check stay as a guard.                                                                                                                                   |
| **The per-asset limit is reached**             | A teacher changes a video's clip until its allowance is used up: 10 changes for a video under 100 seconds, counting the default clip, every time a preview is turned off and on again, a clip retired by an edit and made again when the video comes back, and a fetched clip that a later step discards. | By design (Question 13; whether the count stays is open, Question 14): the refresh stops asking Mux, a clip that is stored stays, and the card says the video has no changes left. A video can reach the limit with no clip stored, and then it never gets one. The teacher can pick another video or turn the preview off. The card shows the number left before that. If Mux's real limit is looser, the allowance is one function. |
| **Requests get slower**                        | Support's approval, a change-set approval and "Save preview" wait for Mux. On a real signed video a first request took 2.0 to 4.1 seconds at 320 pixels and 4.4 seconds at 480, in one measurement; the timeout is 10.                                                                                    | Accepted. The timeout bounds the Mux fetch, and the buttons in Teach and Support already show a busy state.                                                                                                                                                                                                                                                                                                                           |
| **Clips load the API**                         | Every first view of a clip streams it from storage through the one API task (256 CPU units and 512 MiB by default). There is no CDN. A 480-pixel clip of animated footage measured 0.24 MB; filmed footage is expected to be larger.                                                                      | The browser caches a clip for a year. The 400 ms delay keeps sweeps from downloading. If it shows in the API's load, `S3_PUBLIC_BASE_URL` and a CDN are the next step, outside this design.                                                                                                                                                                                                                                           |
| **The clip looks soft or badly cropped**       | At 480 pixels the clip fills the card in the three-column grid at standard density. A high-density screen scales it up about 2 times, and a wide two-column card about 1.3 times. A 16:9 clip loses an eighth on each side. Portrait video is cropped top and bottom.                                     | Accepted with Question 12's answer. The width is one constant. Changing it later does not remake existing clips, because the source record holds only the video and the start.                                                                                                                                                                                                                                                        |
| **The clip does not restart**                  | A browser may resume an animated image mid-loop on a second hover. Nothing in `expo-image` or the HTML standard promises a restart.                                                                                                                                                                       | To be checked by hand in Chrome, Safari and Firefox in the learner PR. If one resumes mid-loop, that is accepted.                                                                                                                                                                                                                                                                                                                     |
| **The hover can't be tested automatically**    | Jest runs the iOS build of React Native. It proves the timer and the gates, not real pointer events, image loading or animation. The repo has no web end-to-end test.                                                                                                                                     | The learner PR lists hand checks in three browsers.                                                                                                                                                                                                                                                                                                                                                                                   |
| **Nobody can see the feature locally**         | Local development has no Mux, and the seed has no video.                                                                                                                                                                                                                                                  | The API tests use the fake driver. Seeing a real clip needs Mux test credentials, whose assets are watermarked and at most 10 seconds long, so the default start there is 0.                                                                                                                                                                                                                                                          |
| **Two refreshes at once**                      | Two requests make a clip for one course at the same moment.                                                                                                                                                                                                                                               | The guarded updates in steps 4, 8 and 9 cover the key and the setting: the loser deletes its own file.                                                                                                                                                                                                                                                                                                                                |
| **A delete fails**                             | Storage refuses to delete a clip that was turned off, replaced, or retired after its video was removed.                                                                                                                                                                                                   | The clip is hidden at once and its key stays on the row, so the next refresh of that course tries again. Nothing retries on its own and the teacher is not told; only the log shows it. The backfill retries it. A query in `infra/README.md` lists such rows, and previews switched off with a file still stored.                                                                                                                    |
| **A changed clip keeps showing**               | A teacher changes the video or the second and Mux fails. The old clip stays in the catalog, and the card says only that the clip is not up to date. After a change made while previews are paused, the old clip shows again when they are switched back on.                                               | Accepted by the author (2026-11-19), in preference to a course with no clip during every change. "Make clip" and the backfill replace it.                                                                                                                                                                                                                                                                                             |
| **A stray public file**                        | A new file is written and the update that points at it fails or loses.                                                                                                                                                                                                                                    | Accepted. When the update returns no row, the run deletes the file it wrote. When the update throws, or that delete fails, the file stays at an address nobody was given. Nothing lists stray files.                                                                                                                                                                                                                                  |
| **A teacher applied before the sentence**      | Production opens to teachers before the server PR is deployed, or a profile is made some other way. Its courses get clips although nobody on it saw the sentence.                                                                                                                                         | The release condition in Goal 2. Nothing in the code checks it. On staging, demo and test profiles are in this position; their footage is not real teachers'.                                                                                                                                                                                                                                                                         |
| **Someone who never saw the sentence**         | Managers and writers who join a profile by invitation never see the application page. An owner installed by Support's recovery did not apply.                                                                                                                                                             | Not mitigated. The sentence is shown to the person who applies for the profile and to nobody else.                                                                                                                                                                                                                                                                                                                                    |
| **Staff or a writer changes a teacher's clip** | Under the cover image's rule, staff can change a live course's preview, and a writer can set it on a draft.                                                                                                                                                                                               | Accepted by the author (Question 3). Staff requests are audit-logged by `requireProfile`, and every change writes `course.preview`, unless that write itself fails.                                                                                                                                                                                                                                                                   |
| **A teacher who reads Chinese meets English**  | The agreement sentence is translated; the control in the builder is not.                                                                                                                                                                                                                                  | Accepted. The builder is English until it is translated whole (`AGENTS.md`).                                                                                                                                                                                                                                                                                                                                                          |
| **A clip of a removed video stays up**         | The step that retires it after a direct edit fails before it hides the clip, a later edit path does not finish through `edited`, or a removal lands in the instant between a refresh's second look and its update.                                                                                        | Accepted by the author (2026-11-20). Nothing checks again when the catalog is read; that keeps the catalog query as it is today. The clip stays until the next refresh of that course, whose step 4 retires it. A test covers each way a video can be removed today, and the `AGENTS.md` rule names `edited`.                                                                                                                         |
| **Switching off does not take clips down**     | `COURSE_PREVIEWS` off hides the addresses and stops new clips. Stored files are still served to anyone who has an address, and a revert of the server PR leaves them too.                                                                                                                                 | Accepted by the author (2026-11-20): the switch is a pause. Turning one course's preview off deletes its file. Nothing deletes every clip at once (Alternatives AN and AO, and Future Improvements).                                                                                                                                                                                                                                  |
| **Success can't be measured**                  | Nothing counts hovers.                                                                                                                                                                                                                                                                                    | Accepted by the author (Question 4). The design claims only the count of courses with a clip.                                                                                                                                                                                                                                                                                                                                         |

### Rollout and rollback

-   **The migration is additive.** Seven nullable or defaulted columns. A reverted API ignores
    them.
-   **Turning the hover off** is a revert of the learner PR and a web deploy.
-   **Turning clips off everywhere** is `course_previews = false` in Terraform, an apply and a
    Deploy re-run. Stored files stay and are still served to anyone who has an address.
    Switching back on shows them again.
-   **Reverting the server PR** removes the catalog field, the control, the agreement
    sentences and the only code that deletes clips. Stored files stay in storage and stay
    served, at addresses the catalog gave to every visitor while the feature was on. Nothing
    deletes them all at once.
-   **A clip can't be recalled.** Deleting the file stops new requests. Browsers keep what
    they fetched for up to a year.

## Alternatives Considered

"The brief" is [learner-main-page-improvements.md](learner-main-page-improvements.md);
its list is under "Alternatives Weighed". An alternative marked "rejected by author" was put to
the author as a choice. One marked "rejected while drafting" was not.

### Where the footage comes from

#### Alternative A: Embed YouTube for the hover preview

-   **Pros**:
    -   No clip to make, store or serve.
-   **Cons**:
    -   Course video is in Mux, not on YouTube. Teachers would have to publish footage there.
-   **Reason for Rejection**: Rejected by author in the brief: the aim is YouTube's behaviour,
    not YouTube's hosting.

#### Alternative B: A separate trailer the teacher uploads

-   **Pros**:
    -   The teacher decides exactly what is public, and nothing is cut from paid lessons.
    -   No rule is needed for a default video or start.
-   **Cons**:
    -   Every teacher has to make and upload a trailer, so many cards may have none.
    -   A new upload, a new media kind and its review.
-   **Reason for Rejection**: Rejected by author in the brief, in favour of Mux's animated preview
    of video already on the course: every teacher would have to make and upload a trailer.

#### Alternative C: Lesson count and total length on the card, and no preview

-   **Pros**:
    -   No footage is made public, and nothing is stored or fetched.
    -   It works on phones, where most learners are likely to be.
-   **Cons**:
    -   It shows how much teaching there is, not what it looks like.
-   **Reason for Rejection**: Rejected by author: the brief names it as the cheaper
    alternative and decides on the preview (its decisions 5 and 9). The card already shows the
    lesson count.

### How the clip reaches the browser

#### Alternative D: Sign a preview token for each card in the catalog response

-   **Pros**:
    -   Nothing is stored, and a clip always matches the current video.
    -   Signing is local arithmetic, with no call to Mux.
-   **Cons**:
    -   The address expires, so the response can't be cached or kept by the app for long.
    -   A token on a public page is public anyway, so the footage is no more protected.
    -   The browser fetches from Mux on every first view, and each distinct start counts
        against Mux's per-asset limit.
-   **Reason for Rejection**: Rejected by author in the brief, in favour of making the clip
    once. The brief's reason was that a token signed for every card stops the catalog being
    cached. The catalog is not cached today, so that reason is about a later cache; consent
    and a lasting address are the reasons that stand now.

#### Alternative E: Fetch a signed address when a card is hovered

-   **Pros**:
    -   Tokens are signed only for cards somebody hovers.
-   **Cons**:
    -   A round trip before the clip can start.
    -   A public endpoint that hands out addresses needs rate limiting.
-   **Reason for Rejection**: Rejected by author in the brief: a round trip before each clip can
    start, and a public endpoint that hands out signed addresses.

#### Alternative F: A second, public playback ID on the lesson's Mux asset

-   **Pros**:
    -   Mux serves the clip from its own CDN. No fetch, storage or deletion code.
-   **Cons**:
    -   Mux has no policy that makes only images public. A public playback ID plays the whole
        lesson for anyone who has it.
-   **Reason for Rejection**: Rejected while drafting: it makes paid lesson video public,
    which is a non-goal.

#### Alternative G: A short, separate Mux asset with a public playback ID

-   **Pros**:
    -   The lesson stays signed, and Mux serves the clip.
    -   It could be real video, not an animated image.
-   **Cons**:
    -   A second asset for each course, billed for storage, with its own upload, webhook and
        clean-up.
-   **Reason for Rejection**: Rejected while drafting: a second asset to upload, wait for and clean
    up for each course, where this design stores one file.

#### Alternative H: Mux's range-limited video token for visitors who have not enrolled

-   **Pros**:
    -   Real video, from the same signed asset, limited to chosen seconds.
-   **Cons**:
    -   A token for each visitor and card, and a video player on each card.
    -   Delivery is billed by the minute.
-   **Reason for Rejection**: Rejected while drafting: it is Alternative D with a player
    added, and Goal 5 rules out a token per card.

### Consent

#### Alternative I: The teacher must pick the video and the second

-   **Pros**:
    -   The most deliberate consent: nothing is public until the teacher chooses it.
-   **Cons**:
    -   A teacher who never opens the setting never gets a clip, so many cards may have none.
-   **Reason for Rejection**: Rejected by author, in favour of on by default (Question 2): a teacher
    who never opens the setting never gets a clip, and the author wants most cards to have one.

#### Alternative J: One switch for each course, off until someone turns it on

-   **Pros**:
    -   Consent is one press, recorded for each course. The agreement text need not change.
    -   Consent does not depend on who applied before the agreement sentence existed.
-   **Cons**:
    -   Few teachers may turn it on.
-   **Reason for Rejection**: Rejected by author: most course cards should have a preview,
    and a switch that starts off leaves that to each teacher acting. Nothing measures how
    many teachers would turn it on, so this rests on the author's judgement. The author made
    the choice twice, the second time after being told that on by default contradicted the
    goals as first drafted; the goals were then rewritten.

#### Alternative K: On by default with no agreement sentence

-   **Pros**:
    -   Nothing to build beyond the clip itself.
-   **Cons**:
    -   The only text to point to in a dispute is "a non-exclusive hosting licence".
-   **Reason for Rejection**: Rejected by author, in favour of the agreement sentence: a
    dispute needs text that names previews.

#### Alternative L: A notice email, a waiting period and a date on each profile

-   **Pros**:
    -   Teachers who applied under the old agreement text are told before any of their
        courses gets a clip, and the API enforces the wait on every path.
-   **Cons**:
    -   A column on `profiles`, a `waiting` state, a hand-run command that emails every
        owner and manager, its tests, and a change to the seed.
    -   It serves only profiles that applied before the sentence existed.
-   **Reason for Rejection**: Rejected by author on 2026-11-19. This was the design's first
    answer to Question 7, with a 14-day wait chosen over 7 and 30. Production is not deployed
    and no teacher has applied, so there is nobody to notify.

#### Alternative M: Deploy with previews switched off, email teachers by hand, switch on later

-   **Pros**:
    -   No column and no command: the global switch is the gate, and a person sends the
        email.
-   **Cons**:
    -   Teachers who apply during the wait also get no clips until the switch is turned on.
    -   The wait is kept by a person, not by the code.
-   **Reason for Rejection**: Rejected by author on 2026-11-19, for the same reason as
    Alternative L: there is nobody to email.

### Who may change the clip

#### Alternative N: Owner and manager only, through a new capability

-   **Pros**:
    -   The people who answer for the profile's content decide. Writers and staff can't.
-   **Cons**:
    -   A new capability, route and test rows.
    -   Nobody at Elevate could take down one clip.
-   **Reason for Rejection**: Rejected by author, in favour of the cover image's rule (Question 3):
    it needs a new capability, a route and test rows, and leaves nobody at Elevate able to take one
    clip down.

#### Alternative O: Owner and manager change it; staff may only turn it off

-   **Pros**:
    -   Elevate can take a clip down and can't choose a teacher's footage.
-   **Cons**:
    -   A permission that depends on direction has no precedent in the role table.
-   **Reason for Rejection**: Rejected by author (Question 3): a permission that depends on the
    direction of the change has no precedent in the role table, and the cover image's rule needs
    nothing new.

### When the clip is made

#### Alternative P: Refresh at every place a live course's video can change

-   **Pros**:
    -   The clip is current within one request, and the catalog needs no check.
-   **Cons**:
    -   Every such edit can wait on Mux for up to 10 seconds.
    -   A future edit path that does not finish through `CoursesService.edited` leaves a
        public clip of a video the teacher removed.
-   **Reason for Rejection**: Rejected by author (Question 1): the wait on Mux inside an
    edit. The design takes the half of this that needs no Mux: a direct edit deletes a clip
    whose video is gone, and does not make the new one.

#### Alternative Q: A scheduled task does all the fetching

-   **Pros**:
    -   No request waits on Mux. Failures are retried, and the backfill is the same task.
-   **Cons**:
    -   The first scheduled work in the system: new Terraform, applied by hand in each
        environment. Clips lag by the interval.
-   **Reason for Rejection**: Rejected by author (Question 1): it would be the first scheduled work
    in the system, a scheduler and its task definition to build and run in each environment. What
    the design gives up without it is in the [Risks](#risks) table: a failed delete is retried only
    at the next refresh of that course, and a course can sit without a clip until someone acts.

#### Alternative R: Make the clip when the teacher submits, so Support reviews it

-   **Pros**:
    -   The reviewer sees the exact clip that will be public.
-   **Cons**:
    -   A public file exists for a course that may be rejected, and a resubmit remakes it.
-   **Reason for Rejection**: Rejected while drafting: Support's page names the video and the
    second, and plays that video, with no file stored before approval.

### The data model

#### Alternative S: A `media_assets` row for the clip, with a pointer on the course

-   **Pros**:
    -   Reuses the code that turns a cover image into an address.
-   **Cons**:
    -   The relation must be added in both relation files and loaded by the enrolments query.
    -   Any ready image row of a profile is accepted as a cover image or avatar, so the clip
        would need a filter.
-   **Reason for Rejection**: Rejected by author, in favour of columns on the course: a media row
    needs a relation in both relation files, a change to the enrolments query, and a filter to keep
    clips out of cover images and avatars.

#### Alternative T: A `course_previews` table

-   **Pros**:
    -   The fullest record, with room for when the clip was made and the last error.
    -   System writes would not touch the course row.
-   **Cons**:
    -   A new table, relations in both relation files, and a join in two queries.
-   **Reason for Rejection**: Rejected by author, in favour of columns on the course: a new table,
    relations in both relation files and a join in two queries, to hold what six columns hold.

#### Alternative U: Store the chosen video as an artefact ID

-   **Pros**:
    -   The choice follows the lesson item when its file is replaced.
-   **Cons**:
    -   An artefact's ID is lost when the item or its lesson is deleted, and changes when a
        deleted item comes back through a change set.
-   **Reason for Rejection**: Rejected while drafting: the source record needs a media ID in
    any case, and one kind of ID is simpler than two.

#### Alternative V: Unlink an old clip and leave its file

-   **Pros**:
    -   Matches every other file today: nothing is ever deleted from storage.
-   **Cons**:
    -   Paid footage stays reachable at its old address after the teacher turned it off.
-   **Reason for Rejection**: Rejected while drafting, against Goal 2 (Question 6).

### The clip itself

#### Alternative W: A smaller, larger or smoother clip

-   **Pros**:
    -   320 pixels is the lightest: 0.14 MB measured, against 0.24 MB at 480.
    -   640 pixels is the sharpest Mux offers, and 15 frames a second the smoothest of the
        shapes weighed.
-   **Cons**:
    -   320 pixels is scaled up 1.5 times in the card at standard density and 3 times on a
        high-density screen, so it looks softer than the cover image.
    -   640 pixels at 10 frames a second measured 0.36 MB, and at 15 frames a second and
        five seconds 0.62 MB, each served through the single API task.
-   **Reason for Rejection**: Rejected by author on 2026-11-19, in favour of 480 pixels, 4
    seconds and 10 frames a second. The author first chose 320 pixels, on estimates larger
    than the real calls later measured, and changed to 480 once the measurements were in
    (Questions 5 and 12).

#### Alternative X: A default start at second 0, or a quarter of the way through

-   **Pros**:
    -   Both are valid for a video of any length.
-   **Cons**:
    -   Second 0 can be a title card. A quarter of the way in may be the lesson's substance,
        and is harder for a teacher to predict.
-   **Reason for Rejection**: Rejected by author, in favour of 10 seconds in: second 0 can be a
    title card, and a quarter of the way in is harder for a teacher to predict.

#### Alternative Y: Crop the clip to 4:3 on the server

-   **Pros**:
    -   The file holds only what the card shows.
-   **Cons**:
    -   Mux does not crop animated images; asking for both width and height stretches the
        picture. The API would need a library that re-encodes animated WebP, and it has no
        image tooling.
-   **Reason for Rejection**: Rejected while drafting: the browser crops with one style
    value.

### Measurement

#### Alternative Z: Compare existing server events, or add a client event endpoint

-   **Pros**:
    -   An endpoint would count previews played and the course opens that follow.
-   **Cons**:
    -   Comparing has little to compare against when clips are on by default, and the
        documented `course_viewed` event is not sent by any code today.
    -   An endpoint would be the first unauthenticated write to the analytics table, behind
        an in-memory rate limiter.
-   **Reason for Rejection**: Rejected by author, in favour of counting clips only (Question 4):
    comparing has little to compare against when clips are on by default, and an endpoint would be
    the first unauthenticated write to the analytics table.

### Building it

#### Alternative AA: `Platform.OS` checks in the card, in place of a web-only file

-   **Pros**:
    -   One file.
-   **Cons**:
    -   The hover code ships in development native bundles, and is stripped from production
        ones only by the minifier.
-   **Reason for Rejection**: Rejected while drafting: the repo's convention for a whole
    implementation that differs on the web is a `.web.tsx` file, which native never loads.

#### Alternative AB: Swap the cover image's source for the clip

-   **Pros**:
    -   No second image element.
-   **Cons**:
    -   Going back re-creates the cover image, and the cover's first-load fade and the hover
        fade share one setting.
-   **Reason for Rejection**: Rejected while drafting: a second image over the cover is easier to
    test ("is the clip mounted").

#### Alternative AC: A seeded preview, or placeholder bytes from the local driver

-   **Pros**:
    -   Local development would show the hover with no Mux account.
-   **Cons**:
    -   Seeded courses have no video, so a seeded clip would need a source record that names
        no video, or a fake video in a seeded lesson. Placeholder bytes could be taken for
        real output, and deployed environments with Mux off use the local driver too.
-   **Reason for Rejection**: Rejected while drafting. See
    [Future Improvements](#future-improvements).

#### Alternative AD: A database setting that Support flips, as the off switch

-   **Pros**:
    -   Instant, with no AWS access needed, and audited.
-   **Cons**:
    -   There is no settings table, route or screen today.
-   **Reason for Rejection**: Rejected while drafting: one environment variable covers the
    case, at the cost of a deploy.

### Fixes weighed after the review

The first review, on 2026-11-19, found that turning a preview off could be refused, and that
a failed delete could not be retried. Fixes for both were drafted, and each was tested
against the ways it could fail. The limit on animated images was decided the same day
(Question 13). These are the options not taken.

#### Alternative AE: Remove the "not on this course" refusal

-   **Pros**:
    -   One error code and one query fewer. A chosen video that is not on the course simply
        falls back to the default, for every request.
-   **Cons**:
    -   The server accepts a choice that has no effect, and the only sign is the card's
        sentence.
-   **Reason for Rejection**: Rejected by author on 2026-11-19, in favour of checking a
    chosen video only when a request changes it. A newly picked video that is not on the
    course is still refused, at the cost of keeping the rule.

#### Alternative AF: Fix the off switch in the Teach card only

-   **Pros**:
    -   No server change: the card sends only the fields the teacher changed.
-   **Cons**:
    -   Any other caller that sends the stale choice is still refused.
    -   Teach has no component tests, so a later change to the card reopens the defect with
        every test passing.
-   **Reason for Rejection**: Rejected by author on 2026-11-19: the rule has to hold for any
    client, including a browser tab left open with old code.

#### Alternative AG: Retire the old clip before asking Mux for the new one

-   **Pros**:
    -   One refresh step fewer.
    -   A clip the teacher changed never keeps showing, also when Mux fails or previews are
        paused.
-   **Cons**:
    -   During every change the course has no clip for the length of the fetch, and none at
        all for as long as Mux keeps failing.
-   **Reason for Rejection**: Rejected by author on 2026-11-19, in favour of keeping the old clip
    until its replacement is stored: retiring first leaves a course with no clip during every
    change, and for as long as Mux fails.

#### Alternative AH: A list of files still to delete, kept on the course row

-   **Pros**:
    -   Every file whose address was given out is tracked until its delete succeeds,
        including the file a losing refresh wrote.
    -   The count command could report how many are waiting.
-   **Cons**:
    -   A seventh column on `courses`, array operations in raw SQL, and one more write for each
        deleted file.
-   **Reason for Rejection**: Rejected by author on 2026-11-19, in favour of keeping the one key on
    the row until its file is gone: a list needs one more column on `courses`, array operations in
    raw SQL, and one more write for each deleted file.

#### Alternative AI: Sweep the course's folder and delete everything but the current file

-   **Pros**:
    -   It also removes files that were never recorded, such as one left by a crash.
-   **Cons**:
    -   Storage needs a method to list a folder, on three drivers.
    -   A slow refresh can have its new file swept before it points the course at it. The
        course then shows a clip that answers 404, and nothing repairs it.
-   **Reason for Rejection**: Rejected while drafting: the race has no repair short of
    recording each file in the database, which is Alternative AH.

#### Alternative AJ: Wait for Mux's answer before building the picker

-   **Pros**:
    -   The rule would be built on what Mux does, not on a guess. The real calls suggest
        the limit is not enforced at all.
-   **Cons**:
    -   The Teach control, and with it the off switch, waits on a support reply of unknown
        length.
-   **Reason for Rejection**: Rejected by author on 2026-11-19, after first choosing it, in
    favour of building to a conservative estimate (Question 13).

#### Alternative AK: Only one of the two limit rules

-   **Pros**:
    -   Steps of 10 seconds alone need no column and no new state. The count alone keeps
        whole-second starts.
-   **Cons**:
    -   Steps alone do not hold if a repeat of the same clip counts against the limit:
        turning a preview off and on fetches the same clip again.
    -   The count alone lets a teacher spend a short video's ten changes on starts a few
        seconds apart.
-   **Reason for Rejection**: Rejected by author on 2026-11-19, in favour of both rules together:
    steps alone do not hold if a repeat counts against the limit, and the count alone lets a teacher
    spend ten changes on starts a few seconds apart. Whether the count stays is open (Question 14).

### Weighed after the second review

The second review ran on 2026-11-19 and 2026-11-20. Four of its reviewers found that a clip's
file stays public after its video is removed and after previews are switched off. These are
the changes weighed for that.

#### Alternative AL: Hide a removed video's clip when the catalog is read

This was the design until 2026-11-20.

-   **Pros**:
    -   The test is made on every read, so it can't go stale, and it covers an edit path
        nobody has written yet.
-   **Cons**:
    -   The clip is only hidden. Its file stays public until the next refresh of that
        course, and nothing schedules one.
    -   Every catalog page loads the live items of its 12 courses to compare one ID for each.
-   **Reason for Rejection**: Rejected by author on 2026-11-20: the file stays public for a
    time with no upper bound. Deleting it in the edit removes it at once.

#### Alternative AM: Delete at the edit and keep the catalog's check as well

-   **Pros**:
    -   The file is deleted at once, and a failed retire step or a missed edit path still
        can't show a clip of a removed video.
-   **Cons**:
    -   The most code of the three: both mechanisms and both sets of tests.
    -   The public catalog page keeps loading each course's items, to cover a failed
        statement or an edit path that does not exist yet.
-   **Reason for Rejection**: Rejected by author on 2026-11-20: the extra read on every
    catalog page. The cost accepted with this is that nothing backs the retire step up
    ([When the clip is made](#when-the-clip-is-made)).

#### Alternative AN: The file route refuses preview files while previews are switched off

-   **Pros**:
    -   Switching off stops clips being served at once, with one check of the environment
        and no database query.
    -   Switching back on brings every clip back with no fetch.
-   **Cons**:
    -   A route that serves every public file learns one feature's folder.
    -   It stops working if public files are put behind a CDN.
    -   The files stay in storage, and a revert of the server PR removes the check.
-   **Reason for Rejection**: Rejected by author on 2026-11-20, who kept the switch as a pause. The
    cost accepted is that stored clips stay served while it is off; the gain is a file route that
    knows nothing about previews.

#### Alternative AO: Switched off means no clip is wanted

-   **Pros**:
    -   Switching off and running the backfill deletes every stored clip, with no new
        command.
    -   The rule that the refresh retires before it checks the switch goes away.
-   **Cons**:
    -   Switching back on fetches every clip again. While the count stays (Question 14),
        each fetch uses one of a video's changes for good.
    -   A short switch-off during a Mux incident becomes a deletion that needs a full
        backfill afterwards.
-   **Reason for Rejection**: Rejected by author on 2026-11-20: the refetch, and its cost
    against every video's allowance.

---

## Additional Resources

-   [learner-main-page-improvements.md](learner-main-page-improvements.md): the
    brief and its review, which this design comes from.
-   [ADR 004](../adr/004-media-mux-and-storage.md): signed playback, and the rule that
    playback addresses are minted after an enrolment check.
-   [ADR 005](../adr/005-aws-hosting-and-environments.md): how the API runs, and one-off ECS
    tasks.
-   [Mux, "Get images from a video"](https://www.mux.com/docs/guides/get-images-from-a-video):
    the animated image address, its five options and the per-asset limit.
-   [Mux, "Secure video playback"](https://www.mux.com/docs/guides/secure-video-playback):
    token audiences, and options as claims inside the token.
-   [Expo SDK 58, Image](https://docs.expo.dev/versions/v58.0.0/sdk/image/): animated
    playback can't be controlled on the web.

## Future Improvements

-   **A CDN for public files,** if clips show in the API's load. The storage driver already
    takes `S3_PUBLIC_BASE_URL`.
-   **A way to see the hover locally without Mux,** such as a seeded course with a short video
    and a stored clip.
-   **Counting hovers,** through a client event endpoint, if the count of clips proves too
    coarse to decide anything.
-   **A scheduled repair,** if courses often sit without a clip after live edits.
-   **A sharper clip** once real sizes are known.
-   **Have the file route refuse a clip the course no longer shows.** An old address would
    stop working the moment the course row changes, whether or not the delete has succeeded.
    It costs a database query on every clip request and stops working if a CDN is put in
    front of public files.
-   **A command that deletes every stored clip,** for a takedown across the platform, which
    the configuration switch does not do.
-   **Tell the teacher when a delete fails,** which today shows only in the log and in the
    backfill's counts.
-   **A preview on the course page.**
-   **Noticed and not fixed here:** the card's pressed-state opacity is a function-valued
    `style` on a `Pressable` under `Link asChild`, which the wrapper appears to drop. Read
    from source, not run.

---

## Detailed Implementation Plan

Item 1 is a gate that comes before any code: the real Mux calls. The rest of the work lands
in two pull requests. Each must pass, on its own, what CI runs
(`.github/workflows/ci.yml`): `npm run check:dupes`, `npm run lint`, `npx expo-doctor` in
`apps/learner`, and `npx turbo run typecheck test build`. The server PR changes files under
`infra/`, so it must also pass `terraform fmt -check -recursive -diff` and
`terraform validate`, as `.github/workflows/infra.yml` runs them.

-   **The server PR:** the schema and migration, the rule in `packages/core`, the API, Teach's
    control and agreement sentences, Support's line, Terraform and the records. No file under
    `apps/learner` changes.
-   **The learner PR:** the card's hover behaviour. Only files under `apps/learner` change.

**Release order:** the server PR deploys first, and the learner PR deploys the same day. No
backfill or migration command has to be run after either deploy. The Terraform of item 20 is
applied by a person ([Order of release](#order-of-release)).

**The Chinese text:** the two `.zh.ts` files in item 19 need their text before the server PR
can pass `npx turbo run typecheck test`. The author signed the text off on 2026-11-19
([Question 8](#open-questions)); the files take it word for word from
[The agreement sentence](#the-agreement-sentence).

**No new package** is added in either pull request.

**The items are listed by area, not as commits.** Item 6 makes two fields required, so the
API does not typecheck again until items 11 and 12 are in. An order that passes typecheck at
each stop: items 2 and 3; then 4 and 5; then 7 to 10; then 6 with 11 and 12; then 13 to 16;
then 17 to 22.

### Target Files to Create/Modify

#### Before any code

##### 1. The real Mux calls

-   **Files**: none in the pull requests. A short throwaway script kept outside the
    repository, and `docs/designs/learner-hover-preview.md` (Modify), where the results are
    written.
-   **Type / Scope**: a gate that came before any code in items 2 to 26.
-   **Status**: done on 2026-11-19, with a throwaway script kept outside the repository. The
    results are under Question 10.
-   **Proposed Changes**: none remain. This is the record of what was done.
    -   **What ran.** The script signed the token as item 7 describes and requested 59
        different clips of one video in a Mux development environment: a 60-second
        flat-coloured animation with signed playback, not a test asset and not filmed
        footage. 56 clips were at 320 pixels wide, the width chosen at the time. Three were
        at other shapes, and one of those was the shipped shape, 480 pixels wide (242,552
        bytes, 4.4 seconds).
    -   **What it showed.** Checks 1 to 3 under
        [Checks before any code is written](#checks-before-any-code-is-written) passed on
        that video: Mux returns an animated WebP for a token with audience `g`, a clip that
        ends 1 second before the stored length is 4 seconds long, and the sizes were far
        under the 3 MB cap. A start past the video's end is refused with a JSON body.
    -   **What it did not show.** The size and the time for filmed footage at 480 pixels,
        which the 3 MB cap and the 10-second timeout depend on. And checks 4 to 6, because
        the limit was never reached. The author chose to build to a conservative estimate of
        the limit (Question 13), so no item waits on Mux. Filmed footage is measured in
        staging ([Verification Plan](#verification-plan)).
    -   The repeatable form of the first three checks is the `previews check` command of
        item 14.

#### The server PR

##### 2. Schema

-   **Files**: `packages/db/src/schema/courses.ts` (Modify),
    `packages/db/src/schema/media.ts` (Modify).
-   **Type / Scope**: Drizzle schema.
-   **Proposed Changes**:
    -   `courses` gains, after `thumbnailMediaId`:
        -   `previewEnabled`: boolean, not null, default `true`;
        -   `previewMediaId`: uuid, references `mediaAssets.id`, `onDelete: 'set null'`;
        -   `previewStartSeconds`: integer;
        -   `previewKey`: text;
        -   `previewSourceMediaId`: uuid, references `mediaAssets.id`, `onDelete: 'set null'`;
        -   `previewSourceStartSeconds`: integer.
    -   `mediaAssets` gains `previewFetches`: integer, not null, default `0`, after
        `durationSeconds`.
    -   A check `courses_preview_start_seconds_non_negative`:
        `preview_start_seconds is null or preview_start_seconds >= 0`, beside the price check.
    -   No relation is added, so `relations.ts` and `learner-relations.ts` do not change. The
        live views select from `lessons` and `artefacts` only, so they do not change either.

##### 3. Migration

-   **Files**: `packages/db/drizzle/<timestamp>_course_preview/migration.sql` (Create),
    `packages/db/drizzle/<timestamp>_course_preview/snapshot.json` (Create).
-   **Type / Scope**: migration.
-   **Proposed Changes**:
    -   Generated with `npm run db:generate -- --name course_preview`, never with
        `drizzle-kit generate` directly.
    -   It contains only: six `ALTER TABLE "courses" ADD COLUMN` statements, the two foreign
        keys, the check constraint, and one `ALTER TABLE "media_assets" ADD COLUMN`.
    -   It is additive. The API version that is running while the migration is applied ignores
        the new columns.

##### 4. The rule

-   **Files**: `packages/core/src/domain/course-preview.ts` (Create),
    `packages/core/src/domain/index.ts` (Modify).
-   **Type / Scope**: pure domain logic.
-   **Proposed Changes**:
    -   Constants, exported as `COURSE_PREVIEW`: `width: 480`, `lengthSeconds: 4`, `fps: 10`,
        `defaultStartSeconds: 10`, `minDurationForDefaultStart: 15`, `minDurationSeconds: 5`,
        `endMarginSeconds: 1`, `maxStartSeconds: 86_400`, `startStepSeconds: 10`,
        `minAllowance: 10`, `secondsPerAllowedClip: 10`, `maxBytes: 3_000_000`,
        `fetchTimeoutMs: 10_000`.
    -   Types:
        -   `PreviewSetting = { enabled: boolean; mediaId: string | null;
            startSeconds: number | null }`;
        -   `PreviewVideo = { mediaId: string; usable: boolean;
            durationSeconds: number | null }`, one for each video item among the course's live
            rows, in order. `durationSeconds` is the media row's length, never the item's. `usable`
            is decided by the API (item 10) and already includes the 5-second minimum;
        -   `ResolvedPreview = { mediaId: string; startSeconds: number }`;
        -   `CoursePreviewState = 'off' | 'no_video' | 'not_live' | 'paused' | 'limit' |
            'pending' | 'ready'`. It is declared here, and the contract in item 6 imports it.
    -   `resolvePreview(setting, videos): ResolvedPreview | null`, as specified in [The rule for
        what the clip shows](#the-rule-for-what-the-clip-shows). A media ID that appears on two
        items counts once, at its first place. The start it returns is always one of the video's
        `allowedStarts`.
    -   `previewAllowance(durationSeconds): number`: the larger of `minAllowance` and the
        length divided by `secondsPerAllowedClip`, rounded down.
    -   `allowedStarts(durationSeconds): number[]`: the multiples of `startStepSeconds` from
        0 for which start plus `lengthSeconds` is at most the length less `endMarginSeconds`,
        cut to the first `previewAllowance(durationSeconds)` of them. `resolvePreview` lowers
        a chosen start to the last of these that is not above it.
    -   `previewChangesLeft(durationSeconds, previewFetches): number`: the allowance less
        `previewFetches`, and never less than 0. It is the only place the subtraction is
        done. The count can pass the allowance, because `check` (item 14) counts without
        testing it and two refreshes started together can both fetch.
    -   **Which start applies.** A chosen start belongs to the chosen video. With a chosen
        video that is usable, the chosen start is used. With no chosen video, it is used on
        whichever video is the default at the time. When a chosen video is not usable and
        the rule falls back to the default video, the chosen start is dropped and the
        default start is used.
    -   `previewState(input): CoursePreviewState`, returning the first that applies, in this
        order: `off` (the setting is off); `paused` (the configuration value is off);
        `no_video` (`resolvePreview` returned nothing); `not_live`; `ready` (a key is stored and
        the source record equals the resolved preview); `limit` (`changesLeft` is 0);
        otherwise `pending`. Its input is one object:
        `{ setting: PreviewSetting; resolved: ResolvedPreview | null; courseStatus: string;
        previewKey: string | null; source: ResolvedPreview | null; previewsOn: boolean;
        changesLeft: number }`, where `changesLeft` is `previewChangesLeft` for the resolved
        video, and 0 when nothing is resolved.
    -   `previewIsShown(input): boolean`, the one test for "a visitor can see this clip".
        Its input is `{ enabled: boolean; previewKey: string | null;
        sourceMediaId: string | null; previewsOn: boolean }`. It is true only when `enabled`
        is true, a key is stored, a source is recorded, and `previewsOn` is true.
    -   `formatPreviewStart(seconds: number): string`: minutes and seconds, such as `0:10`
        and `1:35`, and hours from 3,600 seconds, such as `1:02:05`. Teach's card and
        Support's line both use it.
    -   `index.ts` re-exports the module.

##### 5. Rule tests

-   **Files**: `packages/core/test/course-preview.test.ts` (Create).
-   **Type / Scope**: unit test (vitest).
-   **Proposed Changes**: one case for each branch of `resolvePreview` and `previewState`,
    and the listed cases for the module's other functions:
    -   off gives nothing;
    -   no video, and a course whose only videos are not usable, give nothing;
    -   the default is the first usable video, skipping an unusable one before it;
    -   a chosen video that is usable is used; one that is not on the course, or not usable,
        falls back to the default;
    -   the default start is 10 for a 15-second video and 0 for a 14-second one;
    -   a chosen start of 90 on a 100-second video stays 90; on a 93-second video it becomes
        80; on a 5-second video it becomes 0;
    -   a chosen video that is not usable, with a chosen start of 90, gives the default
        video and the default start, not 90;
    -   no chosen video, with a chosen start of 30, gives the default video from second 30;
    -   `previewAllowance` gives 10 for 60 seconds, 10 for 105 and 120 for 1,200;
    -   `previewChangesLeft` gives 10 for a 60-second video with no fetches, 0 at 10 fetches
        and 0 at 12;
    -   `allowedStarts` gives 0 to 50 for 60 seconds, 0 to 90 for 105 seconds (ten starts,
        though second 100 would fit), and only 0 for 5 seconds;
    -   `formatPreviewStart` gives `0:10`, `1:35` and `1:02:05`;
    -   `previewIsShown` is false when any one of its four conditions fails, including a
        key with no source, and true when all hold;
    -   each of the seven states, including that `off` wins over `paused`, and that
        `ready` wins over `limit`: a clip that already matches needs no change.

##### 6. Contracts

-   **Files**: `packages/core/src/contracts/catalog.ts` (Modify),
    `packages/core/src/contracts/teach.ts` (Modify).
-   **Type / Scope**: contracts (TypeScript types and zod).
-   **Proposed Changes**:
    -   `CourseCard` gains `previewUrl: string | null`, after `thumbnailUrl`.
        `CoursePublicView` does not change.
    -   `updateCourseSchema` gains three optional fields: `previewEnabled` (boolean),
        `previewMediaId` (`uuidSchema`, nullable), and `previewStartSeconds` (an integer from
        0 to `COURSE_PREVIEW.maxStartSeconds` that is a multiple of
        `COURSE_PREVIEW.startStepSeconds`, nullable).
    -   A new type `CoursePreviewView`, the shape under
        [The control in Teach](#the-control-in-teach), with `CoursePreviewState` as its state.
    -   `CourseView` gains `preview: CoursePreviewView`.

##### 7. Video provider

-   **Files**: `apps/api/src/providers/video/types.ts` (Modify),
    `apps/api/src/providers/video/mux.ts` (Modify),
    `apps/api/src/providers/video/local.ts` (Modify),
    `apps/api/src/providers/video/fake.ts` (Modify).
-   **Type / Scope**: provider interface and its three drivers.
-   **Proposed Changes**:
    -   `VideoProvider` gains
        `animatedPreview(asset: MediaAssetRow, options: { startSeconds: number;
        endSeconds: number; width: number; fps: number }):
        Promise<{ bytes: Uint8Array; mimeType: 'image/webp' } | null>`. It returns `null` when
        no clip can be made. The failures it must turn into `null`, not an exception, are
        the ones item 8 lists.
    -   **Mux:** as under [Making the clip](#making-the-clip). It returns `null` when the
        asset has no playback ID.
        -   The constructor becomes
            `constructor(private readonly config: MuxConfig, private readonly fetchImpl: typeof fetch = fetch)`.
            `config` stays the property the existing methods read. `createVideoProvider`
            keeps passing one argument.
        -   The request goes through `this.fetchImpl`, which is the global `fetch` unless a
            test passes another, so the driver can be tested without a network.
        -   It is sent with `AbortSignal.timeout(COURSE_PREVIEW.fetchTimeoutMs)`. The one
            signal covers the wait for the response and the reading of its body.
        -   The size is checked from `Content-Length` when present and again on the bytes
            read, against `COURSE_PREVIEW.maxBytes`.
        -   The content type passes when the `Content-Type` header, in lower case and cut at
            the first `;`, is `image/webp`.
    -   **Local:** returns `null`.
    -   **Fake:** returns a fixed, small byte array with `mimeType: 'image/webp'`. It keeps a
        public list, `previewCalls`, of each call's asset ID and options, and a public field,
        `previewMode: 'ok' | 'null' | 'throw'`, that a test sets. It also has an optional
        public callback, `onPreview`, which it awaits at the start of each call. A test sets
        it to change the course while a refresh is waiting on the driver.

##### 8. Mux driver test

-   **Files**: `apps/api/test/mux-provider.test.ts` (Create).
-   **Type / Scope**: unit test (vitest), no network.
-   **Proposed Changes**: builds `MuxVideoProvider` with an RSA key made in the test and a
    stub `fetch`. Cases:
    -   the request goes to `https://image.mux.com/<playbackId>/animated.webp` with only a
        `token` query parameter;
    -   the token's payload has `aud: 'g'`, `sub` equal to the playback ID, and `start`,
        `end`, `width` and `fps` as strings;
    -   a 200 with `image/webp` returns the bytes;
    -   each of these returns `null`: a 400 with a JSON body; a 200 with `application/json`; a
        `Content-Length` over `COURSE_PREVIEW.maxBytes`, without the body being read; a body over
        `COURSE_PREVIEW.maxBytes` with no `Content-Length`; a rejected `fetch`; a timed-out `fetch`;
        and an asset with no playback ID.

##### 9. Configuration

-   **Files**: `apps/api/src/env.ts` (Modify), `.env.example` (Modify).
-   **Type / Scope**: environment configuration.
-   **Proposed Changes**:
    -   `COURSE_PREVIEWS: bool.default(true)`, beside the video settings.
    -   `.env.example` gains, in its video section, the line
        `# COURSE_PREVIEWS=true  # hover-preview clips on course cards; VIDEO_DRIVER=local makes none`.

##### 10. Preview service

-   **Files**: `apps/api/src/services/course-preview.service.ts` (Create).
-   **Type / Scope**: API service.
-   **Proposed Changes**:
    -   `class CoursePreviewService`, built from `Deps`. `CoursesService`, `ReviewService`
        and `ChangeSetsService` each build one in their constructor
        (`this.previews = new CoursePreviewService(deps)`), as `CoursesService` builds
        `MediaService` today. `ChangeSetsService`'s constructor gains a body for it.
    -   `RefreshOutcome`, the union of the eight outcome names (`made`, `unchanged`,
        `cleared`, `none`, `not_live`, `paused`, `limit`, `failed`), is exported from this
        file.
    -   `refresh(courseId): Promise<RefreshOutcome>`, the nine steps and eight outcomes under
        [Making the clip](#making-the-clip). The whole body is inside one `try`; the `catch`
        logs `course preview refresh failed` with the course ID through `deps.log.warn` and
        returns `failed`. A course ID that matches no row returns `not_live`.
        -   The guarded `UPDATE`s of steps 4, 8 and 9 compare `previewKey` with the value
            this run last saw on the row, and `previewEnabled`, `previewMediaId` and
            `previewStartSeconds` with the values read in step 1. Two empty values count as
            equal. Each uses `.returning()` to see whether a row changed. The "forget"
            update of step 4 compares `previewKey` alone.
        -   Every `UPDATE` in a refresh, on `courses` and on `media_assets`, sets `updatedAt`
            to the column itself, as a SQL expression, so the column's on-update default
            does not run.
        -   The read uses `deps.learnerDb.query.courses.findFirst` with `liveLessons` ordered by
            position then creation time, each with `liveArtefacts` ordered the same way, each with
            `media`. Items are filtered to `type === 'video'` in code, not in the query.
        -   Step 7's allowance check reads `previewFetches` from the wanted video's media
            row as loaded, and stops with `limit` when `previewChangesLeft` is 0. The count
            is added with `UPDATE media_assets SET preview_fetches = preview_fetches + 1`,
            through `deps.db`, after the driver has returned bytes and before the file is
            stored.
        -   An item is usable when its media has `kind: 'video'`, `provider: 'mux'`,
            `status: 'ready'`, a playback ID and a `durationSeconds` of at least
            `COURSE_PREVIEW.minDurationSeconds`.
        -   The writes use `deps.db` and touch only `courses`, and the one counter on
            `media_assets`.
    -   `videosOf(items): PreviewVideo[]`, a function exported from this file, not a method:
        turns an ordered list of `{ type, media }` into
        the rule's input. `refresh` maps its `liveArtefacts` rows to that list, and
        `CoursesService` maps its own rows (item 12), so "usable" is defined once. It
        leaves out an item whose `media` is null: a video item with no file has no media ID
        to name. The catalog does not use it.
    -   `retireIfVideoGone(courseId): Promise<void>`, the three steps under
        [When the clip is made](#when-the-clip-is-made). The whole body is inside one `try`;
        the `catch` logs `course preview retire failed` with the course ID through
        `deps.log.warn`.
        -   Its two reads use `deps.learnerDb`: the course row with `status`, `previewKey`
            and `previewSourceMediaId`, and then, only when a clip is stored, the course's
            `liveLessons` with their `liveArtefacts` (`type` and `mediaAssetId`).
        -   The hide, the delete and the forget are one private method that step 4 of
            `refresh` also calls, so the two can't drift apart. Here the hide's `UPDATE`
            compares `previewKey` and `previewSourceMediaId` with the values just read.
    -   Step 7.5 of `refresh`, "Look again", repeats the read of step 1 for the live video
        items only.

##### 11. Catalog

-   **Files**: `apps/api/src/services/catalog.service.ts` (Modify).
-   **Type / Scope**: API service.
-   **Proposed Changes**:
    -   `toCard(course, previewUrl: string | null = null)` sets the new field from its second
        argument. `EnrollmentsService` calls it with one argument and needs no change.
    -   `list` keeps its query: `with: { liveLessons: { columns: { id: true } } }` does not
        change.
    -   The address is `await this.deps.storage.getUrl(course.previewKey)`, asked for only
        when `previewIsShown` is true, so the key is never empty there.
    -   For each row, `list` passes a preview address only when `previewIsShown` (item 4)
        is true, with `previewsOn` from `env.COURSE_PREVIEWS`.
    -   `detail` does not change.

##### 12. Course view and save

-   **Files**: `apps/api/src/services/courses.service.ts` (Modify).
-   **Type / Scope**: API service. `apps/api/src/routes/teach.ts` needs no change: the
    `PATCH` route already passes the validated body to `update`.
-   **Proposed Changes**:
    -   `loadCourseView` fills `preview`.
        -   The rule's input is always the live rows. In the ordinary view those are the
            rows it already loads. In the draft view, which a writer on a live course gets,
            it loads only draft rows today, so it runs one more query for the live lessons,
            their video items and media, ordered by position then creation time. The schema
            guard test allows `CoursesService` to read `lessons` and `artefacts`.
        -   It calls `videosOf`, `resolvePreview` and `previewState`. It fills `videos` with
            the usable videos and their lesson and item titles, taken from the rows it
            holds. Each video gets its `starts` from `allowedStarts` and its `changesLeft`
            from `previewChangesLeft`. A media ID that is on two items is listed once, at
            its first place.
        -   It sets `clipUrl` to `await this.deps.storage.getUrl(course.previewKey)` only
            when `previewIsShown` is true, and to `null` otherwise, so the image Teach and
            Support draw is what a visitor can see.
    -   `update` accepts the three fields.
        -   **Turning off.** When the request carries `previewEnabled: false`, only the
            switch is saved. `previewMediaId` and `previewStartSeconds` in the same request
            are ignored, whatever they hold, and the stored values stay. A value the request
            schema rejects still answers 400, because the schema runs first.
        -   **An unchanged choice.** When `previewMediaId` equals `course.previewMediaId`,
            it is not checked.
        -   **A new choice.** Otherwise, when `previewMediaId` is a value, it calls
            `media.getProfileAsset(actor.profileId, id, { kind: 'video' })`, which answers
            404 or 400 `wrong_kind`, and then checks that the media is on a video item of
            this course among the live rows. If not, it throws
            `errors.unprocessable('preview_video_not_on_course', 'Choose a video that is on
            this course')`. The code is Teach-only, so it is not added to `USER_ERROR_CODES`.
        -   The stored row is read without a lock, so "equals the stored value" is compared
            with a read that another save can outdate. The worst case is a refusal that a
            reload clears; turning off is not affected.
        -   **Only a changed value is written.** A preview field goes into the row update
            only when its value differs from the stored one. A request whose preview fields
            all equal the stored values, and that carries no other field, writes nothing to
            the row. So "Make clip" does not move `updated_at`: the Details form is not
            remounted, unsaved title and description edits are kept, and the course lists
            keep their order. The refresh still runs. After a stale choice the card sends
            the choice and the start as empty, which are changed values, so that one "Make
            clip" does write the row.
        -   The order is: the row update, if any value changed; then, when any of the three
            stored values changed, an audit row with action `course.preview`, entity
            `course` and metadata
            `{ from: { enabled, mediaId, startSeconds }, to: { enabled, mediaId,
            startSeconds } }`, the three values read before the update and the three after
            it; then, when the request carried any of the three fields (changed or not),
            `await this.previews.refresh(courseId)`. The audit row comes first, as in the two
            approvals, so that the record is made before the wait for Mux. The row update
            and the audit insert are separate statements, as in `setPrice`.
        -   "Make clip" sends the chosen video and the start and no `previewEnabled`. The
            request carries a preview field, so the refresh runs, which is how it asks for a
            new attempt. On a course whose preview is off, no clip is made: the refresh
            ends in `none`, or in `cleared` when a leftover file was waiting.
        -   A failed refresh does not fail the save. The response is 200. When a clip is
            wanted the view's state is `pending`; after a failed delete on turning off it is
            `off`.
    -   The existing capability and lock checks in `update` cover the new fields.
    -   `edited(courseId, scope)` becomes an `async` method. When `scope` is `null`, which
        marks a direct edit, it awaits `this.previews.retireIfVideoGone(courseId)` and then
        loads the view as it does today. With a change set's scope it only loads the view.
        Its ten callers do not change. A direct edit to a course that is not live costs the
        one small read in which `retireIfVideoGone` sees that the course is not live.

##### 13. Approval hooks

-   **Files**: `apps/api/src/services/review.service.ts` (Modify),
    `apps/api/src/services/change-sets.service.ts` (Modify).
-   **Type / Scope**: API services.
-   **Proposed Changes**:
    -   `ReviewService.approve`: awaits `this.previews.refresh(courseId)` after `recordAudit`
        and `trackEvent`, and before the email loop. When the result is `made`, the approval
        email gains a third paragraph, after its two existing ones: "Its course card shows a
        short silent preview of your course's video when a visitor rests the mouse on it. You
        can change the preview or turn it off in Elevate Teach, under the course's Details
        tab."
    -   `ChangeSetsService.approve`: awaits `this.previews.retireIfVideoGone(courseId)`
        straight after `db.transaction(...)` has returned, before `recordAudit`. It then
        awaits `this.previews.refresh(courseId)` after `recordAudit` has run, and before the
        email to the writer. Nothing is added inside the transaction.
    -   Neither wraps a call in its own `try`: `refresh` and `retireIfVideoGone` do not
        throw.

##### 14. Backfill, count and check

-   **Files**: `apps/api/src/services/course-preview.service.ts` (Create, with item 10),
    `apps/api/src/previews.ts` (Create), `apps/api/tsup.config.ts` (Modify),
    `apps/api/Dockerfile` (Modify).
-   **Type / Scope**: API service, command-line entry, build configuration.
-   **Proposed Changes**:
    -   `CoursePreviewService` gains three methods:
        -   `backfill(): Promise<Record<RefreshOutcome, number>>`: calls `refresh` for every
            course with `status: 'live'`, one at a time, in `id` order. The result counts
            each of the eight outcomes by name.
        -   `count(): Promise<{ live: number; withClip: number }>`: `withClip` counts live
            courses for which `previewIsShown` (item 4) is true, which is what the catalog
            would return.
        -   `check(mediaId, startSeconds = 10): Promise<{ ok: boolean; bytes: number | null;
            mimeType: string | null; milliseconds: number }>`: loads the media row, calls
            `video.animatedPreview` with the clip's fixed shape, and reports what came back.
            It writes nothing to storage or to any course. A media ID that matches no row,
            or a row that is not a ready Mux video, gives `ok: false`. A clip that comes
            back is a real fetch, so it adds one to the video's `previewFetches` like any
            other, and that update keeps `updatedAt` as a refresh's does. It does not test
            the allowance first: it is an operator's tool, and `previewChangesLeft` already
            keeps an over-count from showing as a negative number.
    -   `previews.ts` is a one-off entry like `seed.ts`, but built on
        `createDeps(loadEnv())`, as `server.ts` is, because it needs storage and the video
        driver. It reads the command (`backfill`, `count`, or `check <mediaId>` with an
        optional `--start <seconds>`) from the arguments, runs it, prints the result as one
        line of JSON, and calls `deps.close()` in a `finally`, so it runs after an error
        too. `createDeps` logs a warning before that line when `STRIPE_SECRET_KEY` is not
        set; the JSON is the last line printed.
    -   **Exit status.** An unknown command exits with status 1. So does `check` with no
        media ID, or with a `--start` that is not a whole number of 0 or more; each prints
        one usage line to standard error. A command that ran exits with status 0 whatever it
        reports: `ok: false` and a count of `failed` are in the JSON for the person to read.
        An error that is thrown is printed to standard error and the exit status is 1. The
        entry file has no test of its own; the walkthrough and the staging step in the
        [Verification Plan](#verification-plan) run all three commands between them.
    -   It is run as `["node", "dist/previews.js", "backfill"]` in the task's command
        override, the form the seed uses.
    -   On a developer's machine it is run from `apps/api` the way the `dev` script runs the
        server: `node --env-file=../../.env --import tsx src/previews.ts backfill`.
    -   `tsup.config.ts` adds `src/previews.ts` to `entry` and to its comment.
    -   The `Dockerfile`'s header comment names only the server and the migration today. It
        gains one sentence: "It also carries three entry files a person runs as one-off tasks:
        `dist/seed.js`, `dist/reset-schema.js` and `dist/previews.js`." Its `COPY` of
        `apps/api/dist` already carries the new file.

##### 15. Test helpers

-   **Files**: `apps/api/test/helpers/test-app.ts` (Modify),
    `apps/api/src/providers/storage/fake.ts` (Modify).
-   **Type / Scope**: test helper and the fake storage driver.
-   **Proposed Changes**:
    -   `FakeStorage` gains a public set, `failDeleteKeys`. A `delete` of a key in the set
        throws. Tests use it to make one delete fail and leave the others working.
    -   `createCourse` takes `videos?: 0 | 1 | 2` (default 0) and `videoSeconds?: number`
        (default 60).
        -   For `videos: 1` the first lesson gets a video item; for `videos: 2` the second
            lesson gets one too. Each is inserted at position 1, after the item the lesson
            already has, with the title "Fixture video 1" or "Fixture video 2". Only video
            items count for the rule, so their place among other items does not matter.
        -   Each has its own `media_assets` row: `kind: 'video'`, `provider: 'mux'`,
            `status: 'ready'`, `playbackId: 'pb_fixture_<n>'`, `durationSeconds`, the
            profile's ID, and the two required columns `filename: 'fixture-video-<n>.mp4'`
            and `mimeType: 'video/mp4'`.
        -   The returned object gains `videos: Array<{ artefactId: string; mediaId: string }>`,
            in lesson order, so a test can call the item routes.
    -   A new helper, `createVideoMedia(profileId, { seconds = 60, previewFetches = 0 } =
        {})`, inserts the same
        kind of media row with no item and returns its ID. Tests use it for a video of the
        profile that is not on the course, and for the file a change set swaps in.
    -   Three rows have no helper and are written through `t.db` in the test that needs
        them:
        -   an image `media_assets` row of the profile (`kind: 'image'`, `provider: 'local'`,
            `status: 'ready'`, a `filename` and `mimeType: 'image/png'`), for the
            `wrong_kind` case and for `check` on an image;
        -   an `artefacts` row of type `video` with no `mediaAssetId`, for "A video item with
            no file";
        -   for "The allowance", an update that sets the fixture video's `preview_fetches`
            to 10 after its first clip is made.

##### 16. API tests

-   **Files**: `apps/api/test/course-preview.test.ts` (Create),
    `apps/api/test/checkout.test.ts` (Modify), `apps/api/test/change-sets.test.ts` (Modify).
-   **Type / Scope**: integration tests (vitest, PGlite in process), on the fake video and
    storage drivers.
-   **Proposed Changes**:
    -   `course-preview.test.ts`:
        -   **Support approval makes the clip.** A course with a 60-second video is approved.
            The fake driver was called once with start 10, end 14, width 480, fps 10. Storage
            holds one object under `public/previews/<courseId>/` with `image/webp`. The
            catalog list returns a `previewUrl` that `GET`s with status 200, `image/webp` and
            the immutable cache header. The approval email has the preview paragraph.
        -   **No video, no clip.** The fixture course without a video is approved: no call,
            `previewUrl` is null, and the email has no preview paragraph.
        -   **A failure does not block.** With `previewMode` set to `null`, then to `throw`:
            Support's approval answers 200 and the course is live with no clip; a change-set
            approval that leaves the clip's video on the course answers 200 and the old clip
            is kept; a `PATCH` that changes the start
            answers 200, the old clip is kept and the view's state is `pending`.
        -   **The placement in a save.** The fake driver's `onPreview` callback reads the
            audit log while the refresh waits, and finds the `course.preview` row already
            written.
        -   **A teacher's choice.** On a course with two videos, `PATCH` with the second
            video and start 30 makes a clip with a new key, deletes the old object, and
            writes one `course.preview` audit row. The second video's `previewFetches` is
            now 1. Sending the same values again calls the driver no more times, writes no audit
            row and leaves the course's `updatedAt` as it was.
        -   **Off.** `PATCH` with `previewEnabled: false` clears the key, deletes the object,
            and the catalog returns null.
        -   **Off while paused.** With `COURSE_PREVIEWS` off and a clip already stored,
            `PATCH` with `previewEnabled: false` still clears the key and deletes the object.
        -   **Draft courses.** `PATCH` on a draft course with a video saves the setting and
            makes no clip; the view's state is `not_live`.
        -   **Validation.** A video of another profile answers 404. An image of this profile
            answers 400 `wrong_kind`. A video of this profile that is not on the course
            answers 422 `preview_video_not_on_course`. A negative start answers 400.
        -   **Off with a stale chosen video.** On a course with two videos the owner
            chooses the second with start 30, then deletes its item from the live course.
            That delete has already removed the object and the key. A `PATCH` with
            `previewEnabled: false` and the stale `previewMediaId` then answers 200, not
            422, and the stored choice is unchanged.
        -   **Turning off ignores everything else.** A `PATCH` with `previewEnabled: false`
            and a video of the profile that is not on the course answers 200, not 422. The
            clip is cleared, and the stored choice and start are as they were. A `PATCH` with
            `previewEnabled: false` and an empty `previewMediaId` does the same: nothing but
            the switch changes.
        -   **"Make clip" with a stale chosen video.** The same set-up as "Off with a stale
            chosen video". A `PATCH` with the stored `previewMediaId` and start, and no
            `previewEnabled`, answers 200 and makes a clip from the first video starting at
            second 10, not 30: this is the request a tab loaded before the removal sends. A
            `PATCH` with an empty choice and an empty start, which is what the card sends,
            then empties both stored values and makes no new clip.
        -   **The placement in an approval.** With the mailer made to fail for one call, by
            `vi.spyOn(t.mailer, 'send').mockRejectedValueOnce(new Error('mail down'))` in
            the test (`FakeMailer` itself does not change), Support's approval answers 500
            as it does today, and the course is live, its audit row is written and its clip
            is stored. With `previewMode` set to `null`, the approval
            email has no preview paragraph.
        -   **A tab left open can't turn a preview back on.** The preview is off. A `PATCH`
            with a choice and a start and no `previewEnabled` answers 200; the preview stays
            off and no clip is made.
        -   **A key with no source is not shown.** A course given a `previewKey` with an
            empty source record returns `previewUrl: null`.
        -   **A video item with no file.** A course whose only video item has no file gets
            no clip, and the view's state is `no_video`.
        -   **Starts are in steps.** A `PATCH` with start 35 answers 400. A start of 90 on
            a 60-second video is saved and the clip is cut from second 50.
        -   **The allowance.** A course whose video already has `previewFetches` equal to
            its allowance: a `PATCH` that changes the start answers 200, the fake driver is
            not called, the old clip still shows, and the view's state is `limit` with
            `changesLeft: 0`. Turning the preview off still clears the clip. Picking the
            second video, which has changes left, makes a clip.
        -   **Only a returned clip is counted.** With `previewMode` set to `null`, a refresh
            leaves `previewFetches` as it was.
        -   **Short videos.** A course whose only video is 4 seconds long gets no clip, and
            the view's state is `no_video`.
        -   **A removed video item.** On a course with two videos, the owner deletes the
            previewed video item from the live course. The request answers 200 and the fake
            driver is not called. The stored object is gone, the row holds no key, the
            catalog returns `previewUrl: null`, and the view's state is `pending`. "Make
            clip" then makes a clip from the second video.
        -   **A removed lesson.** The same course; the owner removes the lesson that holds
            the previewed video. The object is gone and the state is `pending`.
        -   **A swapped file.** The same course; the owner changes the previewed item's file
            to another video of the profile, made with `createVideoMedia`. The object is
            gone and the state is `pending`.
        -   **An emptied file.** The same course; the owner sets the previewed item's file
            to empty. The object is gone and the state is `pending`.
        -   **The only video.** On a course with one video, deleting its item leaves no
            object and no key, and the state is `no_video`.
        -   **Other edits keep the clip.** Adding a lesson, reordering the lessons and
            renaming the previewed item each leave the object, the key and `previewUrl` as
            they were.
        -   **A failed delete on removal.** With the clip's key in `failDeleteKeys`, deleting
            the previewed item answers 200. The catalog returns null, the row keeps the key
            with an empty source record, and the object is still in storage. With the set
            emptied, the next refresh deletes the object and empties the key.
        -   **A writer's removal waits for approval.** A writer's change set removes the
            previewed video. The clip and its object stay. After the owner approves it, the
            object is gone and a clip from the second video is stored.
        -   **A writer's removal when the new clip can't be made.** The same change set,
            approved three times over in three set-ups: with `previewMode` set to `null`,
            with `COURSE_PREVIEWS` off, and with the second video's `preview_fetches` at its
            allowance. In each the object is gone and `previewUrl` is null.
        -   **A refresh retires a removed video's clip.** A course given a key and a source
            record that names a video not on the course: with `previewMode` set to `null`,
            `refresh` deletes the object and empties the key before it returns `failed`.
        -   **A stored clip survives the pause.** With `COURSE_PREVIEWS` off and an
            up-to-date clip stored, `refresh` returns `paused`, the key and the object stay,
            a `GET` of the stored address answers 200, and `previewUrl` is null. An app
            built on the same database with the switch on returns the address again.
        -   **A removal during a refresh.** The fake driver's `onPreview` callback deletes
            the wanted video's item while the refresh waits. The refresh stores no key,
            deletes the object it wrote and returns `unchanged`.
        -   **Retiring works while paused.** With `COURSE_PREVIEWS` off and a clip stored,
            deleting the previewed item still deletes the object.
        -   **The address is plain.** `previewUrl` equals `storage.getUrl(key)` and has no
            query string. The list is the same with and without a session.
        -   **A writer's view.** With an open change set, the draft view's `preview` is
            computed from the live rows, and `videos` lists the live videos.
        -   **Configuration off.** With `createTestApp({ COURSE_PREVIEWS: 'false' })`,
            approval makes no clip and a course given a `previewKey` directly returns
            `previewUrl: null`.
        -   **`updated_at` is kept.** The test reads a live course's `updatedAt`, calls
            `refresh` directly, and finds `previewKey` set and `updatedAt` unchanged.
        -   **A failed delete when turning off.** With the clip's key in `failDeleteKeys`,
            a `PATCH` with `previewEnabled: false` answers 200. The catalog returns null,
            the view's state is `off`, the row keeps the key with an empty source record,
            and the object is still in storage. With the set emptied, the next refresh
            deletes the object, empties the key and returns `cleared`.
        -   **A failed delete when replacing.** With the old key in `failDeleteKeys`, a
            `PATCH` that changes the start answers 200. The new object is gone, the old one
            is still in storage, the row holds the old key with an empty source record, the
            catalog returns null and the view's state is `pending`. With the set emptied,
            "Make clip" deletes the old object and makes the new clip.
        -   **A leftover is cleaned up while paused.** A row with a key and an empty source
            record, and `COURSE_PREVIEWS` off: a refresh deletes the object and empties the
            key before it stops with `paused`.
        -   **A leftover is not counted.** `count` leaves out a course whose key has no
            source record.
        -   **Two refreshes.** Two `refresh` calls started together leave one object in
            storage and a course that points at it.
        -   **A change during a refresh.** The fake driver's `onPreview` callback turns the course's
            preview off while the refresh waits. The refresh stores no key, deletes the object it
            wrote and returns `unchanged`.
        -   **Backfill.** Two live courses with video and no clip, one live course whose
            clip is up to date, and one draft course. `backfill` makes two clips, reports
            `made: 2` and `unchanged: 1`, and does not visit the draft. A second run reports
            `unchanged: 3` and calls the driver no more times.
        -   **Count.** With the four courses of the Backfill case, after its first run,
            `count` returns `{ live: 3, withClip: 3 }`.
        -   **Check** on a ready Mux video returns `ok: true`, the byte count and
            `image/webp`, and leaves storage and the course untouched. On an image it
            returns `ok: false`.
    -   `checkout.test.ts`, in `describe('catalogue')`: every seeded course's card has
        `previewUrl: null`.
    -   `change-sets.test.ts`: a writer's change set replaces the first video's file; after
        the owner approves it, the fake driver has been called for the new media and the
        course's source record names it. The test builds its own live course with a video,
        as the file's other tests build theirs.
    -   `apps/api/test/role-routes.test.ts` needs no change: no route is added, and its
        existing row for `PATCH courses/:id` already checks who may send it.

##### 17. Teach control

-   **Files**: `apps/teach/src/components/preview-card.tsx` (Create),
    `apps/teach/src/components/details-form.tsx` (Modify),
    `apps/teach/src/routes/courses/builder.tsx` (Modify).
-   **Type / Scope**: Teach portal (React). English literals: the builder is not a translated
    page.
-   **Proposed Changes**:
    -   `PreviewCard({ course, locked })`, as under
        [The control in Teach](#the-control-in-teach). It keeps its own state for the tick
        box, the select and the start field, initialised from `course.preview`.
        -   **The card's header.** Title "Hover preview". Description: "Four silent seconds
            of your course's video, shown on the course card in Explore when a visitor rests
            the mouse on it. Anyone can see it."
        -   **The tick box.** A plain `<input type="checkbox">` with a label, as
            `prerequisites-editor.tsx` uses; `@elevate/web-ui` has no checkbox component.
            Label: "Show a hover preview on the course card". When it is unticked, the
            two selects are disabled. When `locked` is true the tick box, both selects and
            the button are disabled, as the other cards in `details-form.tsx` set
            `disabled={locked}` on each input.
        -   **The select.** `NativeSelect`, label "Video". Its first option is "Default: the
            course's first video", with an empty value. The others come from
            `course.preview.videos`, labelled "<lesson title>: <item title>", with the media
            ID as the value. If the saved choice is no longer among them, the card starts
            with an empty choice and an empty start: the select shows "Default" as selected,
            the start field is empty, and the card says "The video you chose is no longer on
            this course. The default is used." The start is emptied with the choice because
            it was chosen for the removed video. The next save sends both as empty.
        -   **The start field.** `NativeSelect`, label "Start". Its first option is
            "Default", with an empty value. The others are the selected video's `starts`,
            shown with `formatPreviewStart`, such as "0:00", "0:10" and "0:20". There is no
            free typing, so the card has no error for a bad start. Changing the video resets
            the start to "Default".
        -   **Which video the starts come from.** The video that supplies the starts, and
            the changes-left line under them, is the one selected, or
            `course.preview.videos[0]` while the select is on "Default". That entry is the
            course's default video, because `videos` holds the usable videos in the rule's
            order. When `videos` is empty, both selects hold only "Default" and the
            changes-left line is left out.
        -   **A saved start that is not an option.** A saved start can sit above the video's
            last allowed start, because a hand-made request can store one. The select then
            starts on the last option that is not above the saved start, which is the value
            the rule lowers it to, and that does not count as a change.
        -   **Changes left.** Under the start, one line from that video's `changesLeft`:
            "This video has 7 clip changes left." At 1 it reads "This video has 1 clip
            change left." At 0 it reads "This video has no clip changes left.", and the
            start select is disabled.
        -   **The resolved line.** It names what the last response resolved, from
            `course.preview.resolved` and `videos`: "Shows 4 seconds of <lesson title>:
            <item title>, from <m:ss>.", with the time from `formatPreviewStart` (item 4).
            When nothing is resolved the line is left out; the state's sentence says why.
            The card does not call `resolvePreview` itself.
        -   **The state's sentence.** One line, taken word for word from the third column
            of the table under [The control in Teach](#the-control-in-teach). For `pending`
            the sentence is "The clip is not up to date.", and the button reads "Make clip".
        -   **The clip.** When `clipUrl` is set, an `<img>` with `alt=""` and the classes
            `aspect-[4/3] w-full rounded-card object-cover`, so the teacher sees the crop a
            visitor sees.
        -   **The button.** One button, `type="button"`, because the card sits inside the
            details form. It calls the existing `actions.updateCourse` through the save
            tracker. Its label and whether it is enabled follow this table, where "changed"
            means a control differs from what the card started with. A stale choice that the
            card started as empty does not count as a change:

            | The form                                | Label          | Enabled |
            | --------------------------------------- | -------------- | ------- |
            | Changed                                 | "Save preview" | Yes     |
            | Not changed, and the state is `pending` | "Make clip"    | Yes     |
            | Not changed, any other state            | "Save preview" | No      |

            It is also disabled while a request runs and when `locked` is true. "Save
            preview" sends the three fields, or `previewEnabled: false` alone when the box
            is unticked. "Make clip" sends the choice and the start as the card holds them,
            and no `previewEnabled`.
    -   `details-form.tsx` renders `PreviewCard` after the "Cover image" card.
    -   `builder.tsx`: the note shown to a writer on a live course becomes "The title,
        description, cover image, hover preview and price of a live course are for the owner
        or a manager to change."
    -   `apps/teach/src/lib/courses.ts` needs no change: `updateCourse` takes `UpdateCourse`,
        which item 6 widens.

##### 18. Support's line

-   **Files**: `apps/support/src/routes/review-course.tsx` (Modify).
-   **Type / Scope**: Support portal (React), English.
-   **Proposed Changes**: in the "Course page" card, straight after the cover image, or
    first in the card's body when the course has none, one line from `course.preview` in a
    `<p className="mb-2 text-body-lg text-ink-secondary">`: "Hover preview: off", "Hover
    preview: none (no video)", or "Hover preview: 4 seconds of <lesson title>: <item
    title>, from <m:ss>", using `preview.resolved`, `preview.videos` and
    `formatPreviewStart` (item 4). When `clipUrl` is set, the clip is an `<img>` under that
    line, not beside the cover, with `alt=""` and the cover image's classes
    (`mb-4 aspect-[4/3] w-full max-w-md rounded-card object-cover`).

##### 19. Agreement sentences

-   **Files**: `packages/i18n/src/messages/areas/personalApply.en.ts` (Modify),
    `packages/i18n/src/messages/areas/personalApply.zh.ts` (Modify),
    `packages/i18n/src/messages/areas/companyApply.en.ts` (Modify),
    `packages/i18n/src/messages/areas/companyApply.zh.ts` (Modify),
    `apps/teach/src/routes/apply.tsx` (Modify),
    `apps/teach/src/routes/apply-corporate.tsx` (Modify).
-   **Type / Scope**: message catalog and two translated pages.
-   **Proposed Changes**:
    -   The keys `personalApply.agreementPreviews` and `companyApply.agreementPreviews`, with
        the text under [The agreement sentence](#the-agreement-sentence). Each English file
        gets a translator comment above the key: "Agreement wording, under the first
        agreement sentence. 'Its course card' is the card of the course on Explore."
    -   Each page renders the new key as a second paragraph with the same classes. The
        existing paragraph is a direct child of a flex row that also holds the submit button,
        so the two paragraphs are wrapped in one element (`space-y-2`) and the row keeps two
        children: the agreement text and the button.

##### 20. Terraform

-   **Files**: `infra/terraform/modules/environment/variables.tf` (Modify),
    `infra/terraform/modules/environment/api.tf` (Modify),
    `infra/terraform/modules/environment/storage.tf` (Modify),
    `infra/terraform/envs/staging/main.tf` (Modify),
    `infra/terraform/envs/production/main.tf` (Modify),
    `infra/terraform/envs/staging/terraform.tfvars.example` (Modify),
    `infra/terraform/envs/production/terraform.tfvars.example` (Modify).
-   **Type / Scope**: infrastructure configuration. Applied by a person; CI only validates
    it.
-   **Proposed Changes**:
    -   A module variable `course_previews`, a boolean with default `true` and the
        description "Whether the API makes and returns hover-preview clips for course
        cards."
    -   `api.tf` adds `COURSE_PREVIEWS = tostring(var.course_previews)` to `api_environment`.
        The new name is longer than the others in that block, so `terraform fmt` has to be
        run to line the block's `=` signs up again; CI's format check fails otherwise.
    -   Each environment declares the variable and passes it through, as `csp_report_only` is
        passed.
    -   Each example file gains the line
        `# course_previews = true  # false stops hover-preview clips being made and shown`.
    -   The API's default is on, so previews are on before anyone applies the variable.
    -   `storage.tf`: `aws_s3_bucket_lifecycle_configuration.uploads` gains a second `rule`,
        with `id = "expire-old-preview-versions"`, `status = "Enabled"`,
        `filter { prefix = "public/previews/" }` and
        `noncurrent_version_expiration { noncurrent_days = 1 }`. In production the bucket is
        versioned, so a deleted clip is kept as an old version; this rule removes it a day
        later. Where versioning is suspended the rule does nothing. Unlike the variable, the
        rule does nothing until it is applied.

##### 21. Records

-   **Files**: `docs/adr/011-course-preview-clips.md` (Create),
    `docs/adr/004-media-mux-and-storage.md` (Modify), `docs/runbooks/mux.md` (Modify),
    `docs/runbooks/deploy.md` (Modify), `docs/runbooks/local-dev.md` (Modify),
    `infra/README.md` (Modify), `README.md` (Modify), `AGENTS.md` (Modify).
-   **Type / Scope**: records and agent rules.
-   **Proposed Changes**:
    -   **ADR 011,** in ADR 010's format, with the content listed under
        [Records and rules](#records-and-rules).
    -   **ADR 004** gains a dated line under its Decision: "(Added <date> with the hover
        preview design.) One exception: a short silent clip of a course's video is stored as
        a public image. See ADR 011." Its Consequences line "The whole app runs without Mux or S3
        accounts" gains "except hover previews on course cards, which need Mux".
    -   **`mux.md`,** in "How playback is protected": the clip, the `gif` token used once to
        fetch it, and that it needs no new Mux credential.
    -   **`deploy.md`:** the image's list of commands gains `dist/previews.js`, and the
        optional environment list gains `COURSE_PREVIEWS`. Its "Checklist before the first
        real transaction" gains one more checkbox item: "The hover-preview server PR was
        deployed before any teacher applied:
        `select count(*) from profiles where applied_at < '<time of that deploy>'` returns 0
        (ADR 011)."
    -   **`local-dev.md`:** "Hover previews need Mux. With the default local video driver no
        clip is made."
    -   **`README.md`:** its sentence that everything runs locally without third-party
        accounts gains "except hover previews on course cards, which need Mux".
    -   **`infra/README.md`:** a section beside "Seeding" with the three `run-task` commands,
        when to run the backfill (after a Mux outage, and after previews are switched back
        on), when to run the check (after a Mux SDK upgrade or a change to the clip's shape),
        how to switch previews off, and the query that lists clips that are hidden or
        switched off with a file still stored:
        `select id from courses where preview_key is not null and (preview_source_media_id is null or not preview_enabled)`.
    -   **`AGENTS.md`,** under Rules: "A course's hover-preview clip is made, replaced or
        cleared only by `CoursePreviewService`. A clip always gets a new `public/previews/`
        key, because public files are cached as immutable. A direct edit to a live course's
        lessons or items finishes through `CoursesService.edited`, which deletes a clip whose
        video has left the course; nothing checks that again when the catalog is read
        (ADR 011)."

##### 22. Teach and Support checks

-   **Files**: none.
-   **Type / Scope**: test coverage note. Teach and Support have no component tests.
-   **Proposed Changes**: checked by hand against a local API with Mux test credentials,
    set up as sections 1 and 2 of `docs/runbooks/mux.md` describe. Mux deletes test assets
    after 24 hours, so the videos are uploaded the same day. The checks:
    -   the card in each of its seven states. Two need a set-up step: for `paused`, restart
        the local API with `COURSE_PREVIEWS=false`; for `limit`, on a course with
        two test videos whose clip is from the first, set the second video's
        `preview_fetches` to 10, its allowance, with one SQL update, then choose the second
        video;
    -   a writer on a draft can save it, and on a live course sees it disabled;
    -   "Save preview" with other unsaved details: the form resets, as it does for the cover
        image;
    -   both application pages show the second sentence in English and Chinese;
    -   Support's review page shows the line for a course under review and for a live one.

#### The learner PR

##### 23. Cover component

-   **Files**: `apps/learner/src/components/CourseCardCover.tsx` (Create),
    `apps/learner/src/components/CourseCardCover.web.tsx` (Create).
-   **Type / Scope**: learner component, with a web-only file.
-   **Proposed Changes**:
    -   Both files export `CourseCardCover(props: CourseCardCoverProps)` and
        `isKeyboardFocus(event: FocusEvent): boolean`, with `FocusEvent` from `react-native`.
        The props type is declared in the base file: `{ thumbnailUrl: string | null;
        previewUrl: string | null; active: boolean }`. The web file re-exports it with
        `export type { CourseCardCoverProps } from './CourseCardCover'`. That line is a
        type-only export and is removed before the bundler resolves the path, which on web
        would point back at the web file.
    -   **Base file:** the 4:3 `View` and cover `Image` moved from `CourseCard.tsx`
        unchanged. `isKeyboardFocus` returns `false`.
    -   **Web file:** the same 4:3 `View` and cover `Image`, written out again, because the
        web file can't import the base component for the reason above; plus the behaviour
        under [The learner card](#the-learner-card):
        -   a hook inside the file, `useMediaQuery(query)`, that reads
            `window.matchMedia(query).matches`, follows its `change` event and removes the
            listener on unmount. It returns `false` when `window.matchMedia` is not a
            function, as the existing web files guard browser globals. The hero animation
            reads reduced motion through reanimated's `useReducedMotion`, which reads the
            setting once when the app starts. This hook is used instead, because it follows
            a change while the page is open;
        -   constants `HOVER_DELAY_MS = 400` and `MAX_PLAY_MS = 12_000`;
        -   the clip is mounted when `previewUrl` is set, the mouse query matches, the
            reduced-motion query does not, `active` has been true for `HOVER_DELAY_MS`, the
            clip has not failed to load during this hover, and `MAX_PLAY_MS` has not passed
            since its `onLoad`. Both timers are cleared, and the failure is forgotten, when
            `active` turns false and on unmount;
        -   `isKeyboardFocus` reads the event's `target` as `unknown`. It first checks that
            `Element` exists as a global, because Jest's environment has none. If the target
            is an `Element`, it returns `target.matches(':focus-visible')`, and `true` if
            the browser throws on that selector. Otherwise it returns `false`.
    -   No text is added, so no message catalog file changes.

##### 24. Card

-   **Files**: `apps/learner/src/components/CourseCard.tsx` (Modify).
-   **Type / Scope**: learner component.
-   **Proposed Changes**:
    -   Two pieces of state, `hovered` and `keyboardFocused`. The `Pressable` gains
        `onHoverIn`, `onHoverOut`, `onFocus` (which sets `keyboardFocused` from
        `isKeyboardFocus(event)`) and `onBlur`.
    -   The image area becomes `CourseCardCover`, with `thumbnailUrl` and `previewUrl` set
        from the course and `active` set to `hovered || keyboardFocused`.
    -   Nothing else in the card changes. Explore (`(tabs)/index.tsx`) and
        `lib/catalog.ts` do not change: the new field arrives through the typed API client.

##### 25. Learner tests

-   **Files**: `apps/learner/src/components/__tests__/CourseCardCover-web.test.tsx` (Create),
    `apps/learner/src/components/__tests__/CourseCard.test.tsx` (Create).
-   **Type / Scope**: jest-expo tests. Jest resolves the iOS files, so the web file is
    imported by its full name, as `device-languages-web.test.tsx` does.
-   **Proposed Changes**:
    -   **The harness for both files.**
        -   `expo-image` is mocked in each test file with a stand-in `Image` that renders a
            `View` and passes on `source`, `onLoad` and `onError`. No existing test renders
            `expo-image`, and the stand-in makes "is the clip mounted" a plain query. Load
            and error are fired with `fireEvent(image, 'load')` and `fireEvent(image,
            'error')`.
        -   Time is moved with Jest's fake timers.
    -   `CourseCardCover-web.test.tsx` also installs a fake `window.matchMedia`, whose
        answers and `change` events the test controls, and removes it afterwards, as
        `device-languages-web.test.tsx` does for window events. Cases:
        -   at rest, no clip is in the tree;
        -   `active` for 399 ms: no clip; at 400 ms: an image with the clip's address;
        -   `active` turning false removes it, and turning false before 400 ms never mounts
            it;
        -   12 seconds after its `onLoad`, it is removed while `active` is still true; before
            `onLoad` the 12 seconds do not run;
        -   it never mounts when the mouse query is false, when the reduced-motion query is
            true, or when `previewUrl` is null;
        -   a `change` event on either query takes effect without a remount: the mouse
            query turning true lets the clip mount, and the reduced-motion query turning
            true removes it;
        -   with no `window.matchMedia` at all, the clip never mounts;
        -   a load error removes it, and the next hover mounts it again;
        -   `isKeyboardFocus`, with a stand-in `Element` class installed on `globalThis` for
            the test: it returns what the target's `matches(':focus-visible')` returns;
            `true` when `matches` throws; `false` for a target that is not an `Element`;
            and `false` when no `Element` global exists.
    -   `CourseCard.test.tsx`, on the base file. The card renders a `Link`, so it is
        rendered with `renderRouter` from `expo-router/testing-library` and
        `wrapper: TestProviders`, as `sign-in.test.tsx` renders a screen. One case: a card
        with a `previewUrl` renders the cover image only, also after `hoverIn` and 400 ms.

##### 26. Browser checks

-   **Files**: none.
-   **Type / Scope**: test coverage note. Jest can't run real pointer events, image loading
    or animation, and the repo has no web end-to-end test.
-   **Proposed Changes**: checked by hand against an API with at least two courses that
    have clips, made by approving two courses with video on that API: staging, or the local
    set-up of item 22. The first five on the web build in Chrome, Safari and Firefox; the last on
    the two native apps:
    -   CUJ 1, including the sweep across cards with the network panel open;
    -   for each browser, note whether a second hover starts the clip from its first frame.
        Either answer passes; a browser that resumes mid-loop is written into the risk row
        "The clip does not restart";
    -   Tab to a card plays the clip; a mouse click on a card does not start it;
    -   with "reduce motion" on, and in the browser's touch emulation, no clip is requested;
    -   a screen reader announces the card as one link, with the same name while the clip
        plays;
    -   the iOS and Android apps show cover images only (CUJ 2).

### Verification Plan

-   **Compilation/Build**: `npx turbo run typecheck test build` after each pull request, as
    CI runs it. `build` is what bundles the new `dist/previews.js`, and what exports the
    learner app for every platform (`expo export --platform all`), which is the check that
    the base cover file bundles for iOS and Android.
-   **Unit Tests**: `npx turbo run test`. The learner's alone: `npm -w @elevate/learner test`.
-   **Static Analysis & Linting**:
    -   `npm run lint`. Biome 2.6.6 formats and checks Markdown too, this document
        included; that was confirmed by running it on this file.
    -   `npm run check:dupes` and `npx expo-doctor` in `apps/learner`, as CI runs them.
        Both give the result they give today, because no package is added.
    -   For the server PR, `terraform fmt -check -recursive -diff` in `infra/terraform`, and
        `terraform validate` in `bootstrap`, `envs/staging` and `envs/production`, as
        `.github/workflows/infra.yml` runs them.
-   **Test Coverage Requirement**: every branch of `resolvePreview` and `previewState`
    (item 5), every outcome of `refresh`, every way a direct edit can remove a clip's video,
    and every `null` path of the Mux driver (items 8 and 16), and every condition that
    mounts or removes the clip (item 25). Hand-checked
    only: Teach's card and Support's line (item 22), and the real browser behaviour
    (item 26).
-   **E2E/Integration**:
    -   the API integration tests of item 16;
    -   the real Mux calls of item 1, made on 2026-11-19;
    -   a walkthrough of CUJs 3 to 8 on a local API with Mux test credentials. Test assets
        are at most 10 seconds long, so the expectations change:
        -   CUJ 3: the clip starts at second 0;
        -   CUJ 4: a 10-second test asset has one allowed start, 0:00, so the walkthrough
            changes the video, not the start. On a course with two test videos, choose the
            second and confirm that the clip and the resolved line change. A start above
            the default, and the lowering of a start past the video's end, are covered by
            item 5 and by "Starts are in steps" in item 16;
        -   CUJ 6: approve a course while running with a wrong Mux signing key, restore
            the key, then run the backfill with the local command in item 14;
        -   CUJ 8: run with a wrong Mux signing key.

        The 10-second default start is then covered by the fake-driver tests and by item
        1, whose first call uses a start of 10;
    -   after the server PR deploys to staging: `previews count`, then an approval of a
        course with video, and a check that Explore's response carries its `previewUrl`.
        This needs Mux on in staging. Then `previews check` on at least two filmed videos,
        one of a person talking and one screen recording. Their sizes and times are written
        under Question 10. If either clip is over half the 3 MB cap, or took over half the
        10-second timeout, the two constants are revisited before the learner PR deploys;
    -   after the learner PR deploys to staging: the browser checks of item 26.
-   **Measurement**: `previews count` prints the live courses that have a clip. Nothing
    measures hovers ([Question 4](#open-questions)).

---

<!-- Provenance: Indicates initial structural drafting via EGM. -->

_Drafted with EGM_
