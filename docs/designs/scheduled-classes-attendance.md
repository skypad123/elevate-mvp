# Scheduled Classes, Part 1: Class Records and Attendance

- **Author:** skypad123
- **Status:** In Review
- **Date:** 2026-11-24

---

## Overview

Elevate sells self-paced online courses. The scheduled-classes RFC
([scheduled-classes-brief.md](./scheduled-classes-brief.md)) adds classes: one
run of a course at fixed dates, taught in real time by one instructor to a
limited group of learners, at a venue or remotely.

The author split the RFC into three designs, one per release:

| Part              | Covers                                                                                                                                                           | Real learners can     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1 (this document) | The class and attendance records, the change that lets a class be its own enrollment, the Teach screens to set up a class and run a block, and learner check-in. | Nothing new.          |
| 2                 | Selling a class: class checkout, seat holds, payouts held until after the class, cancellation and refunds.                                                       | Buy a seat, check in. |
| 3                 | The class page, materials shared by the teacher, and change notices.                                                                                             | Open class materials. |

Part 1 builds everything attendance needs and nothing that touches money. No
route in Part 1 creates a class enrollment, and the `CLASSES` setting keeps
every class route off in production. Classes and class enrollments exist only
as seeded test data on staging until Part 2 ships.

**How this document was written.** The author directed the design and made the
product decisions. An AI assistant drafted the text and made the mechanical
choices; the Technical Plan marks those "Drafting", and the author approved
them with each section. Two rounds of automated reviewers read the RFC, and a
five-stage review read this design; their reports are listed under Additional
Resources.

### Words used in this document

| Word                   | Meaning                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Class                  | One scheduled run of a course: dates, an instructor, a number of seats, a venue or "remote".                                                                               |
| Block                  | One period of a class in which attendance is taken once. The default is one block per calendar day; a day can hold more than one.                                          |
| Class enrollment       | An enrollment row that belongs to one class. It is separate from a self-paced enrollment of the same course.                                                               |
| Check-in               | A learner recording their own attendance for a block.                                                                                                                      |
| Attempt                | Any try at check-in that reaches the code check, whether it succeeds or is refused.                                                                                        |
| Roster screen          | The Teach screen the instructor uses for one block while it is open for check-in.                                                                                          |
| Code screen            | A second browser window showing only the rotating code, for a projector.                                                                                                   |
| Check-in window        | The time span in which a block accepts check-ins.                                                                                                                          |
| Code period            | One 60-second span in which one code is current.                                                                                                                           |
| Attendance event       | One row recording one thing that happened: a refused attempt, a check-in, an overturn, a manual mark, a dispute or a dispute decision.                                     |
| Published course       | A course that Support has approved and that is on sale. Its status in the code is `live`.                                                                                  |
| Owner, manager, writer | The three roles a person can hold on a teaching profile. The owner runs it; managers exist only on company profiles; a writer drafts course content and cannot publish it. |
| Staff                  | An Elevate employee with the `super_admin` role acting inside a teaching profile in the Teach portal. Not stored on the profile.                                           |
| Support agent          | An Elevate employee using the separate Support portal.                                                                                                                     |
| SSG                    | SkillsFuture Singapore, the government agency that funds training. Singpass is the national sign-in service SSG requires for attendance on funded courses.                 |

## The Problem

A teaching profile that runs a class in a room, or on a video call, has no way
to record who attended. Elevate has a placeholder for it: a list inside the
enrollment row. That list is rewritten whole on every change, has no field for
who recorded an entry or why, and goes when the enrollment row goes. It cannot
support a refund decision, and it cannot be matched against an SSG attendance
record later.

Three more things stand in the way before a single check-in can happen:

- **There is no record of a class**, its dates, its instructor or its blocks.
- **A learner can hold only one enrollment per course.** The author decided that
  a class is a separate purchase with its own progress and certificate, which
  means a second enrollment row. Nine places in the API assume there is only
  one; they are listed under "What a class enrollment can and cannot do".
- **Any active enrollment opens the whole self-paced course.** The enrollment
  has a `mode` column for "self-paced or class", and no code reads it. A class
  enrollment created today would be a free copy of the self-paced course.

## Goals

Each goal names how it is checked. The Verification Plan maps each one to a
test or a staging step.

- **An attendance record that can be audited.** Every attempt by a learner with
  a class enrollment that reaches the code check, pass or fail, is one row in
  `attendance_events`. The API can never change or delete a row there; a
  correction is a new row that points at the row it corrects. Each row says who
  acted, when on the server's clock, by which method and why. The API's
  database user holds only insert and select on that table, and the API test
  suite runs as that user.
- **A class is its own enrollment, and existing behaviour does not change.** A
  learner can hold a self-paced enrollment and a class enrollment for the same
  course. For a learner with no class enrollment, every existing learner
  endpoint returns what it returned before.
- **A class enrollment opens no self-paced content.** Through every existing
  route, a class enrollment is not found: no lesson, progress, quiz or
  certificate.
- **The previous API version keeps working against the new schema** while no
  class enrollment exists, during a deploy and after a rollback. The migration
  adds tables, a column, a view and indexes, and drops one constraint that it
  replaces with a narrower rule.
- **No route creates a class enrollment.** Classes and class enrollments exist
  only where the demo seed runs with `CLASSES` on, which is staging.
- **A profile can set up a class**, checked on staging: the owner or a manager
  creates a class for a published course, with blocks, an instructor, seats, a
  venue or remote, saves it as a draft and publishes it.
- **A learner can check in without installing anything**: by opening the QR
  link in a phone browser, or by typing the 6-character code in the browser or
  the installed app. No native module is added.
- **Location is evidence and never blocks.** For an in-person class the reading
  is stored with the check-in. A reading that is refused, unavailable,
  inaccurate, out of range, or not available in the app is flagged, and the
  check-in still counts.
- **The class does not wait on the instructor.** On staging, 20 seeded learners
  who are already signed in check in within five minutes while the instructor
  fills in no form.
- **The instructor can correct the record, within stated limits.** Per learner
  and with a reason, the assigned instructor can overturn a flagged check-in,
  or mark a learner present by hand with a statement that an identity document
  was checked. No image is stored. A manual mark counts at once and the learner
  can dispute it for 7 days. An unflagged check-in cannot be overturned.
- **The roster screen shows when it is out of date.** It shows the time since
  its last successful update and switches to "not updating" after 10 seconds
  without one.
- **A deploy during a class does not break check-in.** Codes shown before,
  during and after an API restart are accepted in their own code periods.
- **Support can read one block of one class**: attempts by reason, each
  learner's last attempt, coordinates, and every overturn and manual mark.
  Support can change nothing.
- **The check-in mix is visible per block and per class** on the Teach class
  page: how many learners checked in themselves with no flag, were flagged
  from the app, were flagged for another reason, were overturned, were marked
  by hand, or have not arrived.

## Non-Goals

- **Selling a class.** Class checkout, seat holds, the class choice on the
  course page, held payouts, cancellation and refunds are Part 2.
- **Real learners in a production class.** That needs Part 2.
- **The class page and class materials.** What a class learner can open, files
  added for a class, class progress and the class certificate are Part 3. Part
  1 has a learner screen that shows attendance only.
- **Notices to learners**, including a notice that they were marked by hand or
  that a class changed. Part 3.
- **Reminders and push notifications.**
- **Any connection to SSG or Singpass.** Each attendance event records how it
  was captured, in `type` and `method`, so a later release can add events
  captured another way. Nothing is sent or received.
- **A minimum-attendance rule**, or any refund or payout decision made from
  attendance.
- **An in-app QR scanner or a native location module.**
- **Storing identity documents or learner photos.**
- **A tool to erase a learner's coordinates.** Part 1 stores them where they
  can be erased; it does not build the screen or the approval step.
- **Account deletion.** Elevate has none today.
- **Removing the old attendance list and the unused `mode` column.** They stay,
  unused, because removing a column in the same release would break the
  previous API version.
- **A fifth actor.** An instructor is the owner, a manager or a writer who is
  assigned to a class.
- **A cut line.** The author chose one release with no agreed order of what to
  drop.

## Open Questions

- **The wording shown before the browser asks for location.** It must say why
  the position is taken, that it is kept with the attendance record, and that
  refusing does not block check-in. The author signed off the Chinese text
  on 2026-11-27.
- **Who approves a request to erase one learner's coordinates.** Part 1 makes
  erasure possible without the owner database credential. Who may ask and who
  approves is not decided. Decision needed from: the author, before Part 2.
- **Whether a block maps one-to-one onto an SSG course session.** Not checked
  against SSG's attendance interface. If it does not, a later mapping table is
  needed; nothing in Part 1 prevents one.
- **Whether keeping coordinates for the life of the record has a lawful basis
  and a stated retention period.** Needs a legal check before Part 2 puts real
  learners in a class.

## Critical User Journeys (CUJs)

### CUJ 1: A profile sets up and publishes a class

- **Given**: `CLASSES` is on. A profile owner has a published course and a
  writer on the profile.
- **When**: The owner opens Classes in the Teach portal, creates a class for
  the course, enters a name, seats, "in person" with a venue address, picks the
  writer as instructor, adds three days with a start and end time each, and
  publishes.
- **Then**: The class is published with three blocks, each stored as a start
  and end instant, with the class's time zone `Asia/Singapore`. Each block has
  its own code secret. The audit log has "class created" and "class published".
  Nothing on the learner's course page changes.

### CUJ 2: A signed-in learner checks in from the phone's camera

- **Given**: A published in-person class. The learner has a class enrollment
  and is signed in to Elevate in the phone's browser. It is ten minutes before
  the block starts. The instructor has set the venue position and opened the
  code screen.
- **When**: The learner points the phone's camera at the QR code, opens the
  link, reads why location is asked for, allows it, and presses "Check in".
- **Then**: The learner sees "You are checked in". One `check_in` event is
  stored with method `qr_link`, location status `ok`, the accuracy, the
  distance to the venue and the code period it matched; the coordinates are
  stored in the side table. Within about three seconds the roster screen shows
  the learner as present.

### CUJ 3: A learner checks in inside the app by typing the code

- **Given**: The same class. The learner is signed in to the installed app.
- **When**: The learner opens the class from My Learning, presses "Check in",
  and types the six characters shown on the code screen.
- **Then**: The learner sees "You are checked in". The event has method
  `typed_code` and location status `unsupported`. The roster screen shows the
  learner as present with the flag "checked in from the app, no location".

### CUJ 4: A learner opens the QR link while signed out

- **Given**: The same class. The learner uses the installed app and is signed
  out in the phone's browser.
- **When**: The learner opens the QR link.
- **Then**: The page shows two choices: "Open the Elevate app and type the
  code", and "Sign in here". The first opens the app at that block's check-in
  screen, where the learner types the current code. The second sends an emailed
  sign-in and returns to the check-in page, where the learner types the current
  code, because the one in the link has expired.

### CUJ 5: A wrong or expired code

- **Given**: A learner with a class enrollment, inside the check-in window, on
  the check-in screen in a browser.
- **When**: They type a code that was current three minutes ago and press
  "Check in".
- **Then**: They see "That code has expired. Type the code showing now." An
  `attempt_refused` event is stored with reason `code_expired`. After five
  refused attempts with reason `code_wrong` or `code_expired` in ten minutes,
  further attempts for that block are refused for five minutes, and the roster
  screen shows "too many wrong codes" beside the learner.

### CUJ 6: The instructor overturns a flagged check-in

- **Given**: A learner checked in with a location 4 km from the venue. The
  roster screen shows them as present, flagged "far from the venue (4.0 km)".
- **When**: The assigned instructor chooses "Overturn" on the learner's row,
  picks the reason "not in the room" and confirms.
- **Then**: A new `overturn` event is stored, pointing at the check-in, with
  the instructor and the reason. The learner's state for that block becomes
  "Overturned". The check-in row is unchanged. The learner cannot check in
  again for that block; the instructor can mark them by hand if the overturn
  was a mistake.

### CUJ 7: A manual mark

- **Given**: A learner's phone is not working. The roster screen shows them as
  "not arrived".
- **When**: The assigned instructor chooses "Mark present by hand", picks the
  reason "phone not working" and the document type they checked, and confirms.
- **Then**: A `manual_mark` event is stored with the reason and the document
  type, and no document number or image. The learner's state is "Present,
  marked by hand", open to dispute until 7 days after the mark.

### CUJ 8: A learner disputes a manual mark, and the profile decides

- **Given**: The learner from CUJ 7, three days later, signed in to the app.
- **When**: The learner opens the class, sees "Marked present by your
  instructor: phone not working", and presses "This was not me" with a short
  note. Later the profile's owner opens the class's disputes and chooses
  "Void" with a reason.
- **Then**: A `dispute` event points at the mark, and a `dispute_decision`
  event with decision `voided` points at the dispute. The learner's state
  becomes "Mark voided". Had the owner chosen "Uphold", the state would stay
  "Present, marked by hand", shown as upheld.

### CUJ 9: A manual mark nobody disputes

- **Given**: A manual mark made 7 days and one minute ago, with no dispute.
- **When**: The learner opens the class.
- **Then**: The mark is shown as settled and has no "This was not me" action.
  A dispute request for it is refused with `dispute_window_closed`.

### CUJ 10: A deploy during a class

- **Given**: The code screen is open and learners are checking in.
- **When**: A new API version is deployed, so two versions run side by side and
  then the old one stops.
- **Then**: Every code is accepted in its own code period and the one after
  it, by either version, because each code is worked out from the block's
  stored secret and the server clock. The code screen keeps showing the codes
  it fetched in advance while a request fails, and shows "offline" once it has
  shown the last of them.

### CUJ 11: A Support agent reads one block

- **Given**: An instructor reports that nobody can check in.
- **When**: A Support agent opens the class in the Support portal and selects
  the current block.
- **Then**: They see the block's times and time zone, the venue position,
  accuracy and radius, the counts of attempts by reason for the last 15
  minutes, each learner's state, last attempt, reason, distance and
  coordinates, and every overturn and manual mark. The page has no action that
  changes anything.

### CUJ 12: Nothing changes for a self-paced learner

- **Given**: A learner with one self-paced enrollment, using an app version
  installed before this release. As seeded test data, the same learner also has
  a class enrollment for the same course.
- **When**: They open My Learning, the course page and a lesson.
- **Then**: Every response is the same as before this release. The class
  enrollment is not in My Learning's course list, the course page reports the
  self-paced enrollment, and a lesson request made with the class enrollment's
  id is answered "not found".

## Technical Plan (Architecture)

### Decisions made while drafting and after review

| Question                                  | Decision                                                                                                         | Decided by           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------- |
| Who runs a block and corrects attendance  | Only the assigned instructor: the owner, a manager or a writer. An owner or manager can reassign the instructor. | Author               |
| Who creates and publishes a class         | The owner and managers.                                                                                          | Author               |
| What Support and staff may do             | Read any class, including coordinates in the Support portal. Change nothing.                                     | Author               |
| Who decides a disputed manual mark        | The profile's owner or a manager.                                                                                | Author               |
| Check-in window                           | From 30 minutes before a block starts to 30 minutes after it ends.                                               | Author               |
| Code rotation                             | A new code every 60 seconds. The code from the previous period is also accepted.                                 | Author               |
| Where check-in runs                       | In the browser and in the installed app. The app has no location reading.                                        | Author               |
| Dispute window                            | 7 days from the manual mark.                                                                                     | Author               |
| Which check-ins can be overturned         | Only a check-in that carries a location flag.                                                                    | Author               |
| How "never changed" is enforced           | A separate database user for the API, in Part 1, with the API tests running as that user.                        | Author, after review |
| Where the owner database credential lives | On a separate migration task definition. The running API never holds it.                                         | Author               |
| Disputes                                  | Stay in Part 1.                                                                                                  | Author, after review |
| When a location flag is decided           | At check-in, and never again. An in-person class shows no code until the venue position is set.                  | Author, after review |
| Where coordinates are stored              | In a side table keyed by the event, which the API's database user may delete from.                               | Author, after review |
| How the release is built                  | One production release, built in phases that each end with tests passing.                                        | Author, after review |
| How existing reads are kept to self-paced | A view of self-paced enrollments behind the learner database client.                                             | Author, after review |
| The signed-out learner                    | The signed-out check-in page offers "open the app" beside "sign in here".                                        | Author, after review |
| Time zone                                 | A named time zone column on the class, default `Asia/Singapore`. No picker in Part 1.                            | Drafting             |
| Blocks                                    | Stored rows, created with the class and frozen once a check-in or manual mark exists for them.                   | Drafting             |
| Venue position                            | Taken from the instructor's device with "Set the venue location here" on the roster screen.                      | Drafting             |
| Roster updates                            | The page polls the API every 3 seconds.                                                                          | Drafting             |
| The QR image                              | Drawn by the API with the `qrcode` package it already has, sent as SVG.                                          | Drafting             |
| Test data                                 | The demo seed creates a class with 20 class enrollments, and a fresh one when the last has ended.                | Drafting             |

### Components

```text
Teach portal (web)                 Learner app (web + native)        Support portal (web)
  Classes list / class form          My Learning: "Your classes"       Class view (read only)
  Roster screen ─ polls 3 s ─┐       Class attendance screen                    │
  Code screen ── polls 20 s ─┤       Check-in screen                            │
                             │            │                                     │
                             ▼            ▼                                     ▼
┌──────────────────────────────── API (Hono) ────────────────────────────────────────┐
│ /teach/profiles/:profileId/classes/...   /me/classes/...     /support/classes/...  │
│        ClassesService                  AttendanceService (the only writer of       │
│        (classes, blocks)                attendance_events; inserts only)           │
│                    class-code: code = HMAC(block secret, code period)              │
└───────────────┬───────────────────────────────┬────────────────────────────────────┘
                │ API database user             │ owner database user
                │ (running API, tests)          │ (migration task only)
                ▼                               ▼
  classes ─< class_blocks ─< attendance_events >─ enrollments (class_id set)
                                    │
                                    └─ attendance_event_locations (lat, lng; erasable)
```

### Data model

Four new tables, one new column and one new view. All names follow the repo's
`snakeCase.table` and `snakeCase.view` convention.

**`classes`**

| Column                                                   | Type                           | Notes                                                                   |
| -------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `id`                                                     | uuid                           | Primary key.                                                            |
| `profile_id`                                             | uuid                           | The teaching profile. Restrict on delete.                               |
| `course_id`                                              | uuid                           | The course this class runs. Restrict on delete.                         |
| `name`                                                   | text                           | Shown to the instructor and learner, for example "March weekend class". |
| `delivery`                                               | enum `class_delivery`          | `in_person` or `remote`.                                                |
| `venue_address`                                          | text, nullable                 | Free text. Required for `in_person` before publishing.                  |
| `venue_lat`, `venue_lng`, `venue_accuracy_m`             | double precision, nullable     | Set together from the instructor's device.                              |
| `venue_set_at`, `venue_set_by`                           | timestamp and uuid, nullable   | When and by whom the venue position was last set.                       |
| `venue_radius_m`                                         | integer, default 200           | No screen changes it in Part 1.                                         |
| `instructor_user_id`                                     | uuid                           | The owner, or a current member of the profile. Restrict on delete.      |
| `seats`                                                  | integer                        | Stored now, enforced by Part 2.                                         |
| `time_zone`                                              | text, default `Asia/Singapore` | An IANA name. The API sets it; no request can.                          |
| `status`                                                 | enum `class_status`            | `draft` or `published`. Part 2 adds more values.                        |
| `published_at`, `created_by`, `created_at`, `updated_at` |                                |                                                                         |

**`class_blocks`**

| Column                     | Type                     | Notes                                                              |
| -------------------------- | ------------------------ | ------------------------------------------------------------------ |
| `id`                       | uuid                     | Primary key.                                                       |
| `class_id`                 | uuid                     | Cascade on delete, so deleting a draft class removes its blocks.   |
| `position`                 | integer                  | Order within the class. Unique with `class_id`.                    |
| `starts_at`, `ends_at`     | timestamp with time zone | Instants. `ends_at` is after `starts_at`.                          |
| `code_secret`              | text                     | 32 random bytes, created with the block. Never sent to any client. |
| `created_at`, `updated_at` |                          |                                                                    |

A block's times can change, and a block can be removed, until the block has a
`check_in` or a `manual_mark` event. After that it is frozen: the API refuses
the change with `block_frozen`. A refused attempt does not freeze a block. A
block that has only refused attempts can have its times changed but cannot be
removed, because attendance rows restrict the delete; the editor says so.

**`enrollments.class_id`** (new, nullable, restrict on delete)

`NULL` means a self-paced enrollment, which is every row that exists today. A
value means a class enrollment. The existing `mode` column stays unused.

The rule "one enrollment per learner per course" is replaced by two rules,
built like the three partial unique indexes the schema already has:

- `enrollments_one_self_paced_per_course`: one row per learner and course
  where `class_id` is null;
- `enrollments_one_per_class`: one row per learner and class where `class_id`
  is not null.

The old constraint `enrollments_user_id_course_id_unique` is dropped in the
same migration. The previous API version only ever writes self-paced rows and
names no conflict target on its enrollment inserts, so it behaves the same
under the new rules.

**`self_paced_enrollments`** (new view)

`select` from `enrollments` where `class_id is null`. The learner database
client's `enrollments` is bound to this view; see "What a class enrollment can
and cannot do".

**`attendance_events`**

| Column                                                         | Type                               | Notes                                                                                                              |
| -------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `id`                                                           | uuid                               | Primary key.                                                                                                       |
| `class_id`, `block_id`, `enrollment_id`                        | uuid                               | All restrict on delete.                                                                                            |
| `learner_user_id`                                              | uuid                               | The learner the event is about, copied from the enrollment when the row is written. Restrict on delete.            |
| `type`                                                         | enum `attendance_event_type`       | `attempt_refused`, `check_in`, `overturn`, `manual_mark`, `dispute`, `dispute_decision`.                           |
| `actor_user_id`                                                | uuid                               | Who did it. Restrict on delete.                                                                                    |
| `actor_role`                                                   | text                               | `learner`, `owner`, `manager` or `writer`, as it was at that moment.                                               |
| `method`                                                       | text, nullable                     | `qr_link` or `typed_code`, for attempts and check-ins.                                                             |
| `refusal_reason`                                               | text, nullable                     | For `attempt_refused`: `code_wrong`, `code_expired`, `not_open_yet`, `closed`, `too_many_attempts`.                |
| `location_status`                                              | text, nullable                     | `not_required`, `ok`, `out_of_range`, `inaccurate`, `denied`, `unavailable`, `unsupported`.                        |
| `accuracy_m`, `distance_m`                                     | double precision, nullable         | The reading's accuracy and the computed distance to the venue.                                                     |
| `venue_lat`, `venue_lng`, `venue_accuracy_m`, `venue_radius_m` | nullable                           | A copy of the venue as it was at that moment.                                                                      |
| `code_period`                                                  | bigint, nullable                   | The code period that matched.                                                                                      |
| `client_time`                                                  | timestamp with time zone, nullable | The device's clock, as evidence only.                                                                              |
| `platform`, `app_version`                                      | text, nullable                     | `web`, `ios` or `android`.                                                                                         |
| `reason_code`                                                  | text, nullable                     | A fixed reason for an overturn or manual mark, so the learner app can show it in the learner's language.           |
| `reason`                                                       | text, nullable                     | The typed note. Required when the reason code is `other`, and for a dispute and a decision.                        |
| `id_document_type`                                             | text, nullable                     | For a manual mark: the type of document checked. Not its number.                                                   |
| `decision`                                                     | text, nullable                     | For `dispute_decision`: `upheld` or `voided`.                                                                      |
| `refers_to_event_id`                                           | uuid, nullable                     | An overturn points at a check-in, a dispute at a manual mark, a decision at a dispute.                             |
| `request_id`                                                   | text                               | The API request that wrote the row.                                                                                |
| `created_at`                                                   | timestamp with time zone           | Set by the service from the API's clock, `deps.now()`. Every window, lockout and code period reads the same clock. |

Two partial unique indexes keep the record consistent under retries and
double clicks:

- one `check_in` per block and enrollment;
- one row per `refers_to_event_id` and `type` where `refers_to_event_id` is
  set. This allows one overturn per check-in, one dispute per manual mark and
  one decision per dispute.

**`attendance_event_locations`**

| Column       | Type                     | Notes                                                               |
| ------------ | ------------------------ | ------------------------------------------------------------------- |
| `event_id`   | uuid                     | Primary key. References `attendance_events.id`, restrict on delete. |
| `lat`, `lng` | double precision         | The reading.                                                        |
| `created_at` | timestamp with time zone |                                                                     |

A row is written with a check-in or refused attempt that carried a reading.
Deleting a row erases the coordinates and leaves the event row, with its
distance, accuracy and status, untouched. Once erased, that distance cannot be
checked again.

### The state of one learner in one block

Definitions:

- A check-in **stands** when no overturn refers to it.
- A manual mark **stands** when no dispute decision of `voided` refers to a
  dispute that refers to it.

One pure function in `packages/core`, `attendanceState(events, now)`, tests
these rows from top to bottom. The first that matches is the state.

| Order | State                   | When                                                                                                    |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| 1     | Present, marked by hand | The latest manual mark stands.                                                                          |
| 2     | Present                 | A check-in stands and its location status is `ok` or `not_required`.                                    |
| 3     | Present, flagged        | A check-in stands and its location status is anything else. The flag carries that status as its reason. |
| 4     | Mark voided             | There is a manual mark and the latest one does not stand.                                               |
| 5     | Overturned              | There is a check-in and it does not stand.                                                              |
| 6     | Not arrived             | None of the above.                                                                                      |

"Present, marked by hand" has four sub-states, tested in this order:

| Sub-state | When                                                         |
| --------- | ------------------------------------------------------------ |
| Upheld    | A decision of `upheld` exists for a dispute of the mark.     |
| Disputed  | A dispute of the mark exists with no decision.               |
| Settled   | No dispute, and more than 7 days have passed since the mark. |
| Open      | No dispute, and 7 days or less have passed.                  |

What may follow what:

- **A manual mark** is allowed only when the state is Not arrived, Overturned
  or Mark voided. So a learner can be marked again after a void, and a mistaken
  overturn is repaired with a manual mark.
- **A check-in** is written only when the learner has no check-in row for the
  block and no standing manual mark. A learner whose check-in was overturned
  cannot check in again for that block.
- **An overturn** needs a standing check-in in state "Present, flagged".
- **A dispute** needs a standing manual mark that is the learner's own, 7 days
  old or less, with no dispute yet.
- **A decision** needs a dispute with no decision.

The check-in mix counts each learner once by state: Present becomes "self
check-in"; Present, flagged with status `unsupported` becomes "flagged from the
app"; any other flag becomes "flagged, other"; and Overturned, Present marked
by hand, and Not arrived are counted as themselves. Mark voided counts as not
arrived.

### The rotating code

- Each block has its own secret. The code for a code period is worked out with
  `createHmac('sha256', secret)` from `node:crypto` over the period number,
  where the period number is the server time in whole minutes.
- The typed code is the first 6 characters of that value, mapped onto a
  30-character alphabet with no look-alikes: the digits 2 to 9 and the letters
  A to Z without I, L, O and U. The link carries 20 characters of the same
  value, since nobody types it.
- A submitted code is `current` if it matches the current period, `previous`
  if it matches the one before, `expired` if it matches any of the ten periods
  before that, and `none` otherwise. `current` and `previous` are accepted.
  Codes are compared with `timingSafeEqual` after a length check.
- Nothing is stored per rotation and no job rotates anything. Any API process
  can check any code.
- The code screen polls the API every 20 seconds. Each answer holds the code
  for the current period and the next two, each with its QR image as SVG and
  two numbers: the milliseconds until it starts and until it ends. The screen
  switches code by the time elapsed since the answer arrived, and never reads
  the device's clock. It shows "offline" once it has shown the last code it
  holds.
- For an in-person class the code route answers `venue_not_set` until the
  venue position is set. No learner can check in without a code, and only the
  code screen shows one, so every in-person check-in has a venue to measure
  against.
- The QR link is `<learner web address>/class/check-in/<block id>?c=<link code>`.

### Check-in

One endpoint, `POST /me/classes/blocks/:blockId/check-in`, takes the code, the
method, the platform, the app version, the device time, and either a location
reading or the reason there is none. In order, the service:

1. Finds the learner's active class enrollment for the block's class. If there
   is none it answers 404, the same as for an unknown block, and stores
   nothing.
2. If the learner has a standing check-in or a standing manual mark for the
   block, answers 200 with the existing state and stores nothing. A repeat is
   not an error.
3. If the learner's check-in for the block was overturned, refuses with
   `check_in_overturned` and stores nothing.
4. Checks the window: reason `not_open_yet` more than 30 minutes before the
   block starts, `closed` more than 30 minutes after it ends.
5. Counts the learner's refused attempts for the block with reason
   `code_wrong` or `code_expired` in the last 10 minutes. At five or more it
   refuses with reason `too_many_attempts` until 5 minutes after the latest of
   them.
6. Checks the code: `none` gives reason `code_wrong`, `expired` gives
   `code_expired`.
7. Works out the location status. A remote class is `not_required`. For an
   in-person class: if the request says `denied`, `unavailable` or
   `unsupported`, that is the status. Otherwise the service computes the
   distance from the reading to the venue; the status is `inaccurate` if the
   reading's accuracy is worse than 500 m, `out_of_range` if the distance
   minus the reading's accuracy minus the venue's accuracy is more than the
   radius, and `ok` otherwise.
8. Inserts one event, `check_in` or `attempt_refused`, and a location row if a
   reading was sent, in one transaction, and writes one log line with the
   class, block, learner, outcome and reason. The log line has no coordinates.

Steps 4 to 6 each store an `attempt_refused` event. Steps 1 to 3 store nothing.

The check-in screen is one expo-router screen used on web and native:

- It can be opened signed out. Signed out on web, it shows the two choices in
  CUJ 4. "Open the Elevate app" is a link to
  `elevate://class/check-in/<block id>`, using the app's existing `elevate`
  scheme. Signed out on native, it goes to sign-in and returns.
- On web it asks for location with the browser's own `navigator.geolocation`,
  after showing the learner why. Refusing sends `denied`; no reading within 10
  seconds sends `unavailable`.
- On native it sends `unsupported` and asks for nothing.
- Opened from the QR link while signed in, the code is already filled in.
  Otherwise the learner types six characters.

### What a class enrollment can and cannot do

Existing learner reads keep meaning "self-paced". The repo already keeps draft
lessons away from learner code with views behind a restricted database client,
`deps.learnerDb`. This design uses the same mechanism: `learnerDb`'s
`enrollments` is bound to the `self_paced_enrollments` view, so a read through
it cannot return a class enrollment, and a class enrollment looked up by its id
is not found.

| Place                                                        | Today                                               | After                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `EnrollmentsService.listForUser` (`GET /me/enrollments`)     | Reads through `learnerDb`.                          | No code change. Class enrollments are not listed.                                         |
| `LearningService.loadGraph`                                  | Reads through `learnerDb`.                          | No code change. Every lesson, progress and quiz route answers 404 for a class enrollment. |
| `CatalogService` course page `viewer`                        | Reads through the full client.                      | Reads through `learnerDb`. Only the self-paced enrollment is reported.                    |
| `CertificatesService.forEnrollment` and `issueForEnrollment` | Read through the full client.                       | Read through `learnerDb`. 404 for a class enrollment.                                     |
| `EnrollmentsService.activeCourseIds` and `ensureActive`      | Read through the full client; neither has a caller. | Read through `learnerDb`.                                                                 |
| `PaymentsService.startCheckout` lookup by learner and course | Reads through the full client.                      | Stays on the full client, with the condition `class_id is null` added by hand.            |
| `AnalyticsService` totals and per-course counts              | Raw SQL.                                            | The condition `class_id is null` added by hand.                                           |
| `PeopleService` per-person count                             | Raw SQL.                                            | The condition `class_id is null` added by hand.                                           |
| The demo seed's lookup by learner and course                 | Full client.                                        | The condition `class_id is null` added by hand.                                           |

`CoursesService.remove` keeps counting every enrollment, so a course with a
class enrollment cannot be deleted. `courses.enrol_count` is untouched: nothing
in Part 1 creates a class enrollment through the API.

Writes to an enrollment stay on the full client. They are reached only after a
read through `learnerDb` has found the row.

Class data lives on new endpoints only:

| Endpoint                                       | Who     | Does                                                                                           |
| ---------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `GET /me/classes`                              | Learner | Lists the learner's class enrollments with class, blocks and own state per block.              |
| `GET /me/classes/blocks/:blockId`              | Learner | What the check-in screen needs: class name, block times, whether location is asked, own state. |
| `POST /me/classes/blocks/:blockId/check-in`    | Learner | Check-in, as above.                                                                            |
| `POST /me/classes/attendance/:eventId/dispute` | Learner | Disputes the learner's own manual mark within 7 days.                                          |

### Teach: classes and the roster screen

All routes sit under `/teach/profiles/:profileId` and use `requireProfile` with
a capability, as every Teach route does. A class is looked up with its profile
in the same query and answers 404 when it is not there.

New capabilities in `packages/core/src/domain/permissions.ts`. None is granted
before Support approves the profile.

| Capability                                                                      | Owner | Manager | Writer | Staff |
| ------------------------------------------------------------------------------- | ----- | ------- | ------ | ----- |
| `class.read` (list classes and open one)                                        | Yes   | Yes     | Yes    | Yes   |
| `class.manage` (create, edit, publish, delete a draft, reassign the instructor) | Yes   | Yes     | No     | No    |
| `attendance.read` (read the roster of any class of the profile)                 | Yes   | Yes     | No     | Yes   |
| `attendance.take` (run a block and correct it, if also the assigned instructor) | Yes   | Yes     | Yes    | No    |
| `attendance.review` (decide disputes)                                           | Yes   | Yes     | No     | No    |

Four capabilities would have had the same grants as two; they are kept apart
so each route names what it does, and so a later change to one does not move
the others.

`attendance.take` alone is not enough: the service also requires the actor to
be the class's assigned instructor. That check is one function,
`isAssignedInstructor`, used by every roster action. An owner who is not the
instructor can read the roster and cannot change it. Staff are never the
instructor, because `instructor_user_id` must be the owner or a member.

Who gets which refusal: a writer can read only the classes they instruct, so a
writer who is not a class's instructor gets 404 on every route for that class.
An owner or manager who is not the instructor can read the class and gets 403
on the four instructor routes.

| Route (after `/teach/profiles/:profileId/`)                           | Guard                                            | Does                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `GET classes`                                                         | `class.read`                                     | Lists classes. A writer sees only classes they instruct.                                                   |
| `POST classes`                                                        | `class.manage`                                   | Creates a draft with its blocks.                                                                           |
| `GET classes/:id`                                                     | `class.read`                                     | One class with blocks and the check-in mix. For a writer, 404 unless assigned.                             |
| `PATCH classes/:id`                                                   | `class.manage`                                   | Edits fields and replaces unfrozen blocks.                                                                 |
| `POST classes/:id/publish`                                            | `class.manage`                                   | Validates and publishes.                                                                                   |
| `PUT classes/:id/instructor`                                          | `class.manage`                                   | Reassigns. Audited.                                                                                        |
| `DELETE classes/:id`                                                  | `class.manage`                                   | Draft classes only.                                                                                        |
| `GET classes/:id/blocks/:blockId/roster`                              | `class.read`, then `attendance.read` or assigned | The roster with each learner's state, flag reason, distance, accuracy and last refusal. Never coordinates. |
| `GET classes/:id/blocks/:blockId/code`                                | `attendance.take` and assigned                   | Current and next two codes with QR images.                                                                 |
| `PUT classes/:id/venue-location`                                      | `attendance.take` and assigned                   | Sets the venue position from the device. Audited.                                                          |
| `POST classes/:id/blocks/:blockId/learners/:enrollmentId/overturn`    | `attendance.take` and assigned                   | Overturns a flagged check-in. Reason required.                                                             |
| `POST classes/:id/blocks/:blockId/learners/:enrollmentId/manual-mark` | `attendance.take` and assigned                   | Marks present by hand. Reason and document type required.                                                  |
| `GET classes/:id/disputes`                                            | `attendance.review`                              | Open and decided disputes.                                                                                 |
| `POST classes/:id/disputes/:eventId/decision`                         | `attendance.review`                              | Upholds or voids. Reason required.                                                                         |

The roster route is the one route whose guard is not a single capability. The
route table test gives it its own marker; see the implementation plan.

Publishing requires: the course is published and belongs to the profile, at
least one block, no two blocks overlapping, every block ending in the future,
the instructor is the owner or a current member, and for an in-person class a
venue address. After publishing, the name, venue address, seats, instructor and
unfrozen blocks can still change; the course and the delivery cannot.
Publishing a class that is already published answers 200 and changes nothing.

Setting the venue position stores the device's reading and its accuracy. A
reading with accuracy worse than 100 m is refused with `venue_accuracy_poor`
unless the request confirms it; the page shows the accuracy and asks. The
position can be set again; earlier check-ins keep the venue copy and the flag
they were written with.

The Teach pages are English, like the course builder, and are not added to the
translated set. The navigation label is translated, because both portals'
navigation is. Dates and times use the browser's own date and time inputs. The
Teach form sends wall-clock dates and times; the API converts them to instants
in the class's time zone. "SGT" is shown beside every time, since every Part 1
class is in `Asia/Singapore`.

The roster screen and the code screen:

- **The roster screen**, private to the instructor: one row per learner with
  state, flag reason, distance, last refusal, and the actions the state
  allows. It shows "updated N s ago", turns to "not updating" after 10 seconds
  without a successful answer, and does not poll while the tab is hidden.
- **The code screen**, opened with `window.open` from the roster screen: the
  class name, the block's time, the QR code, the six characters and a
  countdown. It shows no learner names and no attendance data, so it can be
  projected.

### Support: one class

`GET /support/classes` (search by profile, class name or learner email),
`GET /support/classes/:id` and `GET /support/classes/:id/blocks/:blockId`, all
behind the existing `requireRole('support_agent')`. The block route returns
what CUJ 11 lists, including coordinates from the side table, or "erased" where
the row is gone. There are no write routes.

### The `CLASSES` setting

A new server setting `CLASSES`, a boolean that defaults to off, declared beside
`COURSE_PREVIEWS` in `apps/api/src/env.ts` and passed by Terraform. It is on in
staging and off in production until Part 2. It is the only setting; "class
selling" is not a separate switch in Part 1, because Part 1 has no selling.

- Off: `GET /me/classes` answers an empty list. Every other Teach, learner and
  Support class route answers 404.
- The Teach profile view gains a `classesEnabled` field so the portal hides the
  Classes item when it is off. The Support portal reads a new route, `GET
  /support/features`, and hides its Classes item the same way. The learner app
  needs no flag: an empty list shows nothing.
- The demo seed creates class data only when `CLASSES` is on, so production
  cannot hold a class enrollment even if the demo seed is run there by
  mistake.

### The API's database user

**What it defends against.** Two things: a code path, now or later, that
updates or deletes an attendance row; and an API process that has been taken
over. A build-time test covers only the first. A database trigger covers the
first and can be dropped by whoever holds the owner credential, which today is
the API itself. A separate database user covers both, because the running API
no longer holds a credential that can change the rule.

**What it does not cover.** The API user can still update other tables. Block
times are protected only by the API's freeze rule. Each event carries its own
`learner_user_id`, so changing an enrollment's owner afterwards does not change
who an event says attended. The deploy role can run the migration task with any
command, so anyone who can deploy can act as the owner.

**How it works.**

- Migrations and `reset-schema.js` are the only programs that need the owner.
  They read `MIGRATION_DATABASE_URL` and fall back to `DATABASE_URL` when it is
  not set. `check-api-role.js` runs as the API's user and reads only
  `DATABASE_URL`.
- After applying migrations, `migrate.ts` calls `applyApiRole` when
  `API_DATABASE_USER` and `API_DATABASE_PASSWORD` are both set. On one
  connection and in one transaction it:
  1. creates the user if missing, or resets its password;
  2. grants connect on the current database and usage on the `public` and
     `drizzle` schemas;
  3. grants select on the migration journal in `drizzle`, which the API reads
     at startup;
  4. grants select, insert, update and delete on every table in `public`, and
     usage on its sequences;
  5. revokes update, delete and truncate on `attendance_events`;
  6. revokes update and truncate on `attendance_event_locations`, leaving
     select, insert and delete;
  7. sets default privileges so tables the owner creates later are covered.

  Because it is one transaction, the API user never holds update or delete on
  `attendance_events`, even for a moment.
- Terraform adds a generated password, two SSM parameters, and a second task
  definition, `migrate`, used for the owner-only programs. That task holds the
  owner connection string. The API's task definition gets the restricted
  string as `DATABASE_URL`, unless the Terraform variable
  `api_uses_restricted_database_user` is set to false.
- The deploy workflow registers a new revision of both task definitions with
  the new image, runs migrations from the migration task, then rolls the
  service. A Terraform apply does not restart the running service: the service
  ignores task-definition changes, and only a deploy moves it to a new
  revision.
- The seed and preview tasks keep running from the API's task definition, as
  the restricted user. Neither changes or deletes an attendance row; both
  insert and update other tables, which the restricted user may do.

**How it is proven.**

- The API test helper applies the same grants to the in-memory test database
  and switches the connection to the restricted role before any test runs. The
  whole API suite then runs as that role, so a missing grant fails a pull
  request. A check run during this review, against PGlite 0.5.16 and recorded in
  the consolidated review report, showed the test database enforces grants: the restricted role was refused update, delete and truncate
  and allowed insert and select.
- `packages/db/test/api-role.test.ts` asserts the refusals directly.
- A build-time test fails if any source file other than
  `attendance.service.ts` inserts into `attendance_events`, or if any file
  updates or deletes it.
- After each deploy, the workflow runs `check-api-role.js` as a one-off task
  from the API's task definition. It attempts an update that matches no row and
  exits 0 only if the database refuses it with error code `42501`. The step is
  skipped while `api_uses_restricted_database_user` is false.

**The way back.** If the restricted user breaks a path in production, set
`api_uses_restricted_database_user` to false, apply Terraform, and deploy. The
API then connects as the owner again. This is rehearsed on staging.

### What is recorded where

| Record                            | Holds                                                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attendance_events`               | Every refused attempt, check-in, overturn, manual mark, dispute and decision.                                                                                          |
| `attendance_event_locations`      | The coordinates of a reading.                                                                                                                                          |
| `audit_log` through `recordAudit` | Low-volume actions: class created, published, edited after publishing, instructor changed, venue position set, overturn, manual mark, dispute decided. No coordinates. |
| The request log                   | One line per attempt with class, block, learner, outcome and reason. No coordinates.                                                                                   |

## Alternatives Considered

Each row gives what the option offered, the trade-off that decided against it,
and where the decision is recorded. "RFC" is the
[Alternatives Weighed](./scheduled-classes-brief.md#alternatives-weighed)
section of the RFC. "Drafting" is a choice the author made at a question while
this design was drafted. "Review" is a decision in the
[consolidated review report](./reviews/scheduled-classes-attendance/consolidated_review_report.md#decisions-taken-after-the-review-2026-11-24).

Options about selling a class, held payouts, refunds, class materials and
notices are in the RFC and move into the designs for Parts 2 and 3.

### Proof of attendance

| Alternative                                                            | What it offered                                         | Why it was rejected                                                                                                                            | Recorded                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Refuse a check-in until the location check passes                      | A check-in would mean "was near the venue".             | Indoor readings are often tens of metres off or missing, and each failure would wait for the instructor in the first minutes of class.         | RFC, rejected by author         |
| Drop the location reading                                              | No permission prompt, no personal data, no flags.       | Nothing would separate a learner in the room from one who was sent the code.                                                                   | RFC, rejected by author         |
| The instructor clears each flag before the check-in counts             | A human decision on every flagged check-in.             | A learner shown "checked in" could be left uncleared, and clearing would become routine clicking.                                              | RFC, rejected by author         |
| The instructor can overturn any check-in                               | A remote class, which has no flags, could be corrected. | An instructor, who may be a writer, could remove a valid check-in, and a learner cannot dispute an overturn.                                   | Drafting, rejected by author    |
| Store a learner photo and an identity document image for a manual mark | Documentary evidence for a later dispute.               | Image uploads are stored under a public key, the production bucket keeps old versions of deleted files, and nothing records who viewed a file. | RFC, rejected by author         |
| The learner must confirm a manual mark before it counts                | Two accounts agree on every mark.                       | A manual mark is mostly needed when the learner's phone is not working, so "never confirmed" would be the normal case.                         | RFC, rejected by author         |
| A minimum-attendance rule                                              | One meaning for "attended the class".                   | Nothing in Part 1 uses a pass or fail result; the record keeps the evidence for a later rule.                                                  | RFC, rejected by author for now |
| Connect to SSG's attendance system                                     | One attendance record for funded classes.               | SSG requires its own Singpass check-in for funded courses, and the product spec lists SkillsFuture flows as out of scope.                      | RFC, set aside by author        |

### Check-in rules

| Alternative                                         | What it offered                                                        | Why it was rejected                                                                                                                                  | Recorded                       |
| --------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Check-in closes a fixed time after the block starts | The record would mean "was there at the start".                        | Every latecomer would need a manual mark during teaching. The stored time already shows how late a learner was.                                      | Drafting, rejected by author   |
| The instructor opens and closes check-in            | Fits a class that starts late or runs over.                            | The record would depend on the instructor remembering to open and close it.                                                                          | Drafting, rejected by author   |
| A code that changes every 30 seconds                | Forwarding a code would have to happen almost live.                    | More learners would see "code expired" while typing, and a projected QR would change while phones are still being raised.                            | Drafting, rejected by author   |
| A code that changes every 5 minutes                 | Almost nobody would see "code expired".                                | A photo of the screen would let anyone enrolled check in from anywhere for several minutes.                                                          | Drafting, rejected by author   |
| Check-in in the browser only                        | One path to build, and a location reading on every in-person check-in. | A learner who uses only the app would have to sign in again in the browser, by email, at the door.                                                   | Drafting, rejected by author   |
| An in-app QR scanner and a native location module   | The app could scan and read location itself.                           | Two native modules need a new store build and review, with permission wording in two languages, before the beta date.                                | RFC, rejected by author        |
| Leave the signed-out learner to sign in by email    | No new link type.                                                      | For an app user that is the main path, and sign-in requests are limited to 30 per 15 minutes per network address, which one venue network can reach. | Review D6, rejected by author  |
| Change the sign-in limit now                        | A whole class could sign in at the door.                               | It loosens abuse protection on the live product's sign-in for a feature with no production users.                                                    | Review D6, rejected by author  |
| The code screen switches code on the device's clock | Simple to build.                                                       | A device clock a minute fast shows a code the server refuses, and each learner then uses up five tries and is locked out.                            | Review, decided while revising |

### Who may act

| Alternative                                                               | What it offered                                                | Why it was rejected                                                                                              | Recorded                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| The owner and managers can also run and correct any block                 | Cover for an absent instructor without reassigning.            | Someone who is not in the room could correct attendance.                                                         | Drafting, rejected by author       |
| The instructor runs the block and only the owner or a manager corrects it | A writer could never change the record.                        | A writer alone in a room could not help a learner who cannot check in.                                           | Drafting, rejected by author       |
| A separate "instructor" role                                              | One name for the person in the room.                           | It touches invitations, the membership list, the route table and both portals.                                   | RFC, rejected on technical grounds |
| Support decides disputes                                                  | A neutral reviewer.                                            | Each dispute would be manual work for Support, and Elevate would alter a record it later uses to decide refunds. | Drafting, rejected by author       |
| Support can overturn and mark attendance                                  | A record could be fixed when the instructor cannot be reached. | A mark made by someone who was never in the room, employed by the party deciding the refund.                     | Drafting, rejected by author       |
| Support approves a class before it is published                           | Matches how a course is approved.                              | It adds a queue to every schedule.                                                                               | RFC, rejected by author            |

### Disputes and location data

| Alternative                                                 | What it offered                                                                                              | Why it was rejected                                                                                                 | Recorded                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| A 14-day dispute window                                     | More learners would have seen the mark.                                                                      | Anything that needs a settled record would wait two weeks after the last manual mark.                               | Drafting, rejected by author  |
| One dispute deadline per class, 7 days after it ends        | One date per class.                                                                                          | A mark made on the first day of a long class would stay unsettled for the whole class.                              | Drafting, rejected by author  |
| Move disputes to Part 2                                     | Part 1 would lose two event types, three routes, a capability and a screen that no real learner can use yet. | The author wants the whole path built and tested before real learners exist.                                        | Review D2, rejected by author |
| Widen disputes to cover overturns                           | The "flagged only" rule could be lifted.                                                                     | It reverses that rule, adds screens in two languages, and sends more disputes to owners and managers.               | Review D2, rejected by author |
| Store only the distance to the venue                        | The least personal data.                                                                                     | If the venue position was set wrongly, stored distances could not be worked out again.                              | Drafting, rejected by author  |
| Store coordinates and delete them some time after the class | Precise positions would not be held for long.                                                                | It needs a deletion job, and the author wants the coordinates kept with the record.                                 | Drafting, rejected by author  |
| Keep coordinates inside the attendance row                  | No extra table.                                                                                              | The first erasure would be an update to a row the design says can never change, run with the owner credential.      | Review D3, rejected by author |
| Judge the location flag when the record is read             | One venue correction would repair every row.                                                                 | A flag could appear or vanish afterwards, and an overturn made while a check-in was flagged could outlive the flag. | Review D3, rejected by author |
| A "recheck" event after a venue correction                  | Every change would be on the record.                                                                         | One more event type and state rule, in a release where a flag blocks nothing.                                       | Review D3, rejected by author |
| A map or address-lookup service for the venue position      | The venue could be placed at class setup.                                                                    | A new paid dependency and a front-end library; an address lookup can land on the wrong building.                    | Drafting                      |

### The record and the data model

| Alternative                                                                         | What it offered                                                                                                         | Why it was rejected                                                                                                                                      | Recorded                                   |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Keep attendance in the existing `attendance_records` list                           | No new table.                                                                                                           | The list is rewritten whole, so an entry can be changed or lost without trace, and it has no actor or reason.                                            | RFC, rejected on technical grounds         |
| A build-time test as the only guard on attendance rows                              | No database machinery.                                                                                                  | The database itself would accept a change from any code path the test misses.                                                                            | Drafting and Review D1, rejected by author |
| A database trigger that rejects update and delete                                   | Enforced with one database user, in tests, local development and production, with no change to Terraform or the deploy. | Whoever holds the owner credential, which is the API today, could drop the trigger. It stops bugs, not a compromised API.                                | Review D1, rejected by author              |
| Make the database user split its own deploy before Part 2                           | A failure would be traceable to one change, and Part 1 would not touch the live product's credential.                   | The author wants the rule in place and proven from the first release.                                                                                    | Review D1, rejected by author              |
| Keep both database credentials on the API's task definition                         | One added secret and no workflow change.                                                                                | The running API's environment would hold the owner credential.                                                                                           | Drafting, rejected by author               |
| Mark a class on the existing enrollment with the `mode` column                      | No schema change.                                                                                                       | A learner could never hold both enrollments of one course, and a refunded row is reused on the next checkout, which would overwrite the class.           | RFC, rejected on technical grounds         |
| One enrollment per course, with a seat table that owns progress                     | The one-enrollment rule would stay.                                                                                     | Progress, quiz attempts, certificates and payments all point at the enrollment; a second owner means changing the payment path and copying three tables. | RFC, rejected on technical grounds         |
| Drop the one-enrollment rule without replacing it                                   | The simplest migration.                                                                                                 | That rule is the only thing that stops two self-paced purchases of one course from two browser tabs.                                                     | RFC, rejected on technical grounds         |
| One unique rule using `NULLS NOT DISTINCT`                                          | A single rule over learner, course and class.                                                                           | Nothing in the schema uses it; two partial unique indexes follow the three the schema already has.                                                       | Drafting                                   |
| Hand-written `class_id is null` conditions everywhere, with or without a guard test | No schema change.                                                                                                       | A query that forgets the condition gives a class learner the self-paced course, and a text-matching test can be satisfied by a comment.                  | Review D5, rejected by author              |
| Fill class lists from self-paced enrollments, or place learners by hand             | Attendance could be tried with real learners before class checkout exists.                                              | It mixes the two products and gives a class seat without a sale.                                                                                         | RFC, rejected by author                    |
| Copy the course's draft-rows pattern for a class schedule                           | Edits to a published class could wait for approval.                                                                     | A third draft mechanism with the same words and different rules.                                                                                         | RFC, rejected on technical grounds         |

### Delivery

| Alternative                                                          | What it offered                                                     | Why it was rejected                                                                                                                                      | Recorded                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Keep the current code in server memory, or store a row per rotation  | Simple to write.                                                    | A code held in memory is refused by the other process during every deploy; a row per rotation is a write every minute per open block that nothing reads. | RFC, rejected on technical grounds |
| Server push for the roster screen                                    | Check-ins would appear at once.                                     | The single API task drops every connection on deploy, and in-process fan-out blocks ever running a second task.                                          | RFC, rejected on technical grounds |
| Draw the QR code in the browser                                      | No image in the API response.                                       | A new dependency in the Teach portal; the API already has the `qrcode` package.                                                                          | Drafting                           |
| One design for the whole RFC, or two                                 | Cross-cutting choices decided once.                                 | It would need every open decision on money settled before its implementation plan could be written.                                                      | Drafting, rejected by author       |
| Foundations as a first production deploy, with or without a cut line | A failure in the risky change would be traceable to a small deploy. | The author chose one release, to coordinate one deploy and one rehearsal.                                                                                | Review D4, rejected by author      |

---

## Risks & Mitigations

| Risk                                                                                                                                                     | Impact                                                                                            | Mitigation                                                                                                                                                                                       | Status              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| The release is large and has no agreed order of what to drop. The RFC warned the work does not fit the time.                                             | The release is late, or scope is cut under pressure.                                              | The plan is built in seven phases that each end with tests passing, so work can stop at a phase boundary.                                                                                        | Accepted by author  |
| One production deploy carries the schema change, the view, the database user split and every feature file.                                               | If production breaks, the cause could be any of them.                                             | The deploy is rehearsed on staging, including a forced failure. `CLASSES` turns off every class route; `api_uses_restricted_database_user` turns off the split. The schema change has no switch. | Accepted by author  |
| A grant is missing for the API's database user on a path nobody exercised.                                                                               | That path fails in production with "permission denied".                                           | The whole API test suite runs as the restricted role. `check-api-role.js` runs after each deploy. The way back is one Terraform variable.                                                        | Mitigated           |
| A wrong check-in that carries no flag cannot be corrected. This covers every check-in in a remote class, and a forwarded code used with a good location. | A learner who was not there stays marked present.                                                 | None in Part 1. The stored method, time and location status let a later rule or review weigh the record.                                                                                         | Accepted by author  |
| A learner cannot dispute an overturn.                                                                                                                    | A learner wrongly overturned depends on the instructor marking them by hand.                      | The instructor can repair a mistaken overturn with a manual mark.                                                                                                                                | Accepted by author  |
| On a one-person profile the owner is also the instructor, and reviews disputes of their own marks.                                                       | A dispute on such a profile has no second reviewer.                                               | Every mark, dispute and decision is on the record with its actor.                                                                                                                                | Accepted by author  |
| A venue position set wrongly flags that class's check-ins for good.                                                                                      | The check-in mix for that class is wrong, and correct check-ins can be overturned.                | No code is shown until the venue is set. A reading worse than 100 m needs confirming. Each event keeps the venue copy it was judged against.                                                     | Accepted by author  |
| Part 1 sends no notice of a manual mark.                                                                                                                 | The 7-day dispute window can pass without the learner knowing.                                    | The class screen shows the mark. Part 3 adds notices; real learners arrive with Part 2.                                                                                                          | Accepted for Part 1 |
| A learner without the app who arrives signed out must sign in by email, and sign-in requests are limited to 30 per 15 minutes per network address.       | On one venue network, later learners cannot sign in.                                              | The signed-out page offers the app. The staging check uses learners who are already signed in. Part 2 must settle the limit before real classes.                                                 | Open for Part 2     |
| Coordinates are personal data kept for the life of the record, with no erasure tool and no record of who viewed them.                                    | A request to erase cannot be met through the product, and a Support agent's view leaves no trace. | Coordinates sit in a side table the API user may delete from. Only Support routes return them. Part 2 must add the erasure step and the view record before real learners.                        | Open for Part 2     |
| A learner or instructor with attendance rows cannot be deleted from the database.                                                                        | An account deletion feature, when built, must anonymise instead of delete.                        | Elevate has no account deletion today, and a user with a payment already cannot be deleted.                                                                                                      | Known limit         |
| The assigned instructor leaves the profile.                                                                                                              | Nobody can open the code screen until an owner or manager reassigns the class.                    | The class page shows the instructor; `PUT classes/:id/instructor` reassigns.                                                                                                                     | Accepted            |
| Staging holds class enrollments, so a rollback there runs the previous version against them.                                                             | The previous version treats them as self-paced enrollments on staging.                            | Staging only. Production holds none until Part 2.                                                                                                                                                | Accepted            |
| Production database backups are kept for 7 days.                                                                                                         | Thin for a record meant to support refund decisions.                                              | Part 2 must lengthen retention before real attendance is recorded.                                                                                                                               | Open for Part 2     |
| Code using the full database client for a learner read by mistake.                                                                                       | The view does not cover it, and a class enrollment could be returned.                             | AGENTS.md states the rule. The entitlement test covers every existing learner route.                                                                                                             | Accepted            |
| The Teach and Support portals have no automated tests.                                                                                                   | A regression in the roster screen or code screen is caught only by hand.                          | State and timing logic lives in `packages/core`, which is tested. The staging walkthrough covers each screen.                                                                                    | Accepted            |

### Limits

- One API task. If it is down when a block starts, neither check-in nor the
  manual mark works until it returns.
- The per-user request limit is held in memory and resets on restart. The
  wrong-code lockout is counted in the database and does not.
- Polling: 20 open roster screens make about seven requests a second. The
  design does not scale past a few hundred open roster screens on one task.

## Non-Functional Requirements

### Security and privacy

- **Coordinates** are returned only by the Support block route. The Teach
  roster returns state, flag reason, distance, accuracy and last refusal. No
  log line and no audit entry contains coordinates.
- **Purpose is shown first.** Before the browser's location prompt, the
  check-in screen says why the position is taken, that it is kept with the
  attendance record, and that refusing does not block check-in. English and
  Chinese.
- **The code secret never leaves the API.** No route returns `code_secret`. The
  code route returns three codes at most, and only to the assigned instructor.
- **Guessing.** Six characters from 30 give about 729 million codes, two of
  which are valid at any moment. Five refused codes lock a learner out of a
  block for five minutes, counted in the database. The check-in route also has
  the in-memory limit of 20 requests a minute per signed-in user.
- **Reading across profiles.** Every class lookup for Teach filters by the
  actor's profile in the same query and answers 404 otherwise. A learner can
  read and write only events of their own class enrollment.
- **Identity documents.** Only the type of document checked is stored. The form
  has no field for a number and no upload.
- **The owner database credential** is held only by the migration task
  definition.

### Performance

- A class of 20 checking in over five minutes is about one request every 15
  seconds. Each open roster screen is one indexed query every 3 seconds.
- The roster returns the whole block each time. At class sizes of tens this is
  smaller than keeping a cursor correct.
- Indexes: `attendance_events (block_id, enrollment_id, created_at)`,
  `attendance_events (class_id, created_at)`, `class_blocks (class_id,
  position)` unique, `classes (profile_id, status)`, `enrollments (class_id)`.

### Rollout and rollback

- **One migration.** It adds four tables, one nullable column, one view and
  indexes, and drops the constraint `enrollments_user_id_course_id_unique`,
  which the two partial unique indexes replace. No column or enum value that
  existing code reads is renamed or removed.
- **The previous API version stays safe** while no class enrollment exists,
  which in production is until Part 2. It writes only self-paced rows.
- **Order of the first deploy:**
  1. Apply Terraform. This creates the two parameters, the migration task
     definition, the IAM changes and the `classes` variable. The running
     service does not restart.
  2. Copy Terraform's `github_environment_variables` output to the GitHub
     Environment again, as `infra/README.md` describes, so
     `ECS_MIGRATE_TASK_FAMILY` exists.
  3. Deploy. The workflow registers both task definitions, runs migrations from
     the migration task, which creates the restricted user, then rolls the
     service onto it.
  4. Run `check-api-role.js` as a one-off task.
  5. On staging, run the demo seed.

  Between steps 1 and 3 the newest API task revision points at a database user
  that does not exist yet. No one-off task is run in that window.
- **Rehearsal on staging**, before production: the five steps above; a forced
  failure of the new version, to confirm ECS returns to the previous revision;
  and the way back, by setting `api_uses_restricted_database_user` to false,
  applying and deploying.
- **Rollback of the features** is `CLASSES=false`. **Rollback of the database
  user split** is the Terraform variable. **The schema change has no
  rollback**; the previous version runs against it.
- **After Part 2 sells its first class**, no version older than this release
  may be deployed. ADR 012 records this rule.

## Additional Resources

- [Scheduled classes RFC](./scheduled-classes-brief.md): the brief, the two
  reviews of it, and the rejected options.
- [Review of this design](./reviews/scheduled-classes-attendance/consolidated_review_report.md):
  the consolidated report, with the five stage reports beside it.
- [Product spec](../spec.md), sections "Data Model" and "Out of Scope": the
  placeholder and the out-of-scope list this design changes.
- [ADR 006: teacher profiles](../adr/006-teacher-profiles.md) and
  [the teacher profiles design](./teacher-profiles.md): the role table and
  route rules.
- [ADR 008: theming, preferences and translation](../adr/008-theming-preferences-i18n.md)
  and [ADR 010: locale resolution](../adr/010-locale-resolution-and-email-language.md):
  which pages are translated and how learner-facing errors are worded from
  codes.
- [Infrastructure notes](../../infra/README.md): one-off tasks, deploys and
  known gaps.

## Future Improvements

- **Reporting failures that never reach the server.** A learner with no network
  sends nothing.
- **A tool to erase one learner's coordinates**, with an approval step and a
  record of each Support view.
- **Alerts.** One alarm on API errors and one on a burst of refused check-ins.
  The repo has no alarms today.
- **Removing `enrollments.mode` and `enrollments.attendance_records`**, in a
  release after this one is the oldest version that can be deployed.
- **Teach class pages in Chinese**, when a Teach page set is next translated
  whole.
- **A venue position set at class setup**, if a map service is ever added.
- **Disputes of overturns**, which would let the "flagged only" rule be lifted.

---

## Detailed Implementation Plan

The work is in seven phases, in build order. Phases 1, 2 and 5 end with
`npx turbo run typecheck test` passing; Phases 3 and 4 end with `npx turbo run
typecheck build` passing; Phase 6 ends with Terraform and the workflow
validated; Phase 7 ends with lint passing. A hand walkthrough on a local
machine follows Phase 5. The rollout to staging is a separate step after Phase
7 and needs the author's go-ahead.

Each entry is one file unless it says otherwise, and gives the change and the
reason. Entries name the function or query to change; line numbers are a guide
and move as earlier entries land.

**Phase 1 is built.** Its entries, 1.1 to 1.20, were built in commits
`58ab5dc`, `4be1739`, `99c894b` and `e62c2d3`, and merged on 2026-11-24. Those
entries were corrected afterwards to describe what was built, where the build
found the plan wrong or silent. Each correction is marked "As built".

**Phase 2 is built** in the working tree, not yet committed, on 2026-11-25.
Lint, typecheck and every test pass (API: 41 files, 387 tests). Where the
build differed from an entry, the difference is listed under "As built" at
the start of Phase 2. Phases 3 and 4 are built in the same way, with their
notes at the start of each phase. Phase 6 is built and validated through
Docker; nothing was planned or applied in AWS. Phases 5 and 7 are built.
Every phase is built. Across the repository, lint, typecheck, every build
and 684 tests pass. The local walkthrough, steps 1 to 9, passed on
2026-11-25 against a throwaway database, with the API running as the
database owner. It ran after the demo class's day, so steps 2 to 9 used a
class created in step 1, with the demo class's enrollments copied onto it.
It found one misleading line, fixed before the commit: a session whose
check-in had not opened showed every learner as "not arrived"; it now says
"Check-in not open yet". Left as they are: the roster shows "too many wrong
codes" in two columns, and Support's audit log shows action codes such as
`class.created`. Staging steps 10 to 13 have not been run.

### Shared definitions used by the entries

**Values.** These are the strings the API sends and stores.

| Field                                                                   | Values                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state` of a learner in a block                                         | `marked_by_hand`, `present`, `present_flagged`, `mark_voided`, `overturned`, `not_arrived`, tested in that order. Shown as "Present, marked by hand", "Present", "Present, flagged", "Mark voided", "Overturned", "Not arrived". |
| `subState` of a standing manual mark                                    | `upheld`, `disputed`, `settled`, `open`, tested in that order.                                                                                                                                                                   |
| `location_status`, and `flagReason` when the state is `present_flagged` | `not_required`, `ok`, `out_of_range`, `inaccurate`, `denied`, `unavailable`, `unsupported`. The first two are never a flag reason.                                                                                               |
| `refusal_reason`                                                        | `code_wrong`, `code_expired`, `not_open_yet`, `closed`, `too_many_attempts`.                                                                                                                                                     |
| `method`                                                                | `qr_link`, `typed_code`.                                                                                                                                                                                                         |
| `platform`                                                              | `web`, `ios`, `android`.                                                                                                                                                                                                         |
| `decision`                                                              | `upheld`, `voided`.                                                                                                                                                                                                              |
| Overturn `reasonCode`                                                   | `not_in_room`, `wrong_person`, `other`.                                                                                                                                                                                          |
| Manual mark `reasonCode`                                                | `phone_not_working`, `no_phone`, `no_network`, `app_problem`, `other`.                                                                                                                                                           |
| `idDocumentType`                                                        | `nric`, `fin`, `passport`, `driving_licence`, `student_or_staff_pass`, `other`.                                                                                                                                                  |
| Audit actions                                                           | `class.created`, `class.published`, `class.updated`, `class.instructor_changed`, `class.venue_set`, `attendance.overturned`, `attendance.manual_marked`, `attendance.dispute_decided`.                                           |

**Constants.**

| Name                                    | Value                                                                                | File in `packages/core/src/domain/` |
| --------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| `CHECK_IN_OPENS_BEFORE_MS`              | 30 minutes before the block starts                                                   | `attendance.ts`                     |
| `CHECK_IN_CLOSES_AFTER_MS`              | 30 minutes after the block ends                                                      | `attendance.ts`                     |
| `LOCKOUT_REFUSALS`                      | 5 refused attempts with reason `code_wrong` or `code_expired`                        | `attendance.ts`                     |
| `LOCKOUT_WINDOW_MS`                     | counted over the last 10 minutes                                                     | `attendance.ts`                     |
| `LOCKOUT_MS`                            | 5 minutes: locked while now is before the latest counted refusal plus 5 minutes      | `attendance.ts`                     |
| `DISPUTE_WINDOW_MS`                     | 7 days: a mark can be disputed while now is at or before the mark's time plus 7 days | `attendance.ts`                     |
| `READING_ACCURACY_LIMIT_M`              | 500; a learner's reading worse than this has status `inaccurate`                     | `attendance.ts`                     |
| `VENUE_ACCURACY_CONFIRM_M`              | 100; a venue reading worse than this needs confirming                                | `attendance.ts`                     |
| `DEFAULT_VENUE_RADIUS_M`                | 200                                                                                  | `attendance.ts`                     |
| `ATTEMPTS_SUMMARY_WINDOW_MS`            | 15 minutes, for Support's attempts by reason                                         | `attendance.ts`                     |
| `ROSTER_STALE_MS`                       | 10 seconds without a successful answer shows "not updating"                          | `attendance.ts`                     |
| `MAX_BLOCKS`                            | 60                                                                                   | `class-time.ts`                     |
| `CLASS_TIME_ZONE`                       | `Asia/Singapore`                                                                     | `class-time.ts`                     |
| `CODE_PERIOD_MS`                        | 60 seconds                                                                           | `class-code.ts`                     |
| `EXPIRED_PERIODS`                       | 10: the ten periods before the previous one                                          | `class-code.ts`                     |
| `CODES_PER_ANSWER`                      | 3: the current period and the next two                                               | `class-code.ts`                     |
| `TYPED_CODE_LENGTH`, `LINK_CODE_LENGTH` | 6 and 20                                                                             | `class-code.ts`                     |
| `CODE_ALPHABET`                         | `23456789ABCDEFGHJKMNPQRSTVWXYZ` (30 characters)                                     | `class-code.ts`                     |

The polling intervals, 3 seconds for the roster and 20 seconds for the code
screen, and the 10-second location limit are set in the client files that use
them (entries 3.6 and 5.6).

`attemptsLeft` is `LOCKOUT_REFUSALS` minus the learner's refused attempts with
reason `code_wrong` or `code_expired` for the block in the last 10 minutes,
counting the one just stored, and never below 0. The fifth such refusal
carries 0. The next attempt is refused with `check_in_locked`.

**Learner-facing errors.** Each code is in `USER_ERROR_CODES`. Each is thrown
with `new HttpError(status, code, message, details)`, as
`learning.service.ts` does for `enrollment_inactive`.

| Condition                                                                      | Stored refusal reason | Status | Code                    | Details        | English message                                                          |
| ------------------------------------------------------------------------------ | --------------------- | ------ | ----------------------- | -------------- | ------------------------------------------------------------------------ |
| No active class enrollment for the block's class; unknown block; `CLASSES` off | none                  | 404    | `not_found`             | none           | existing                                                                 |
| More than 30 minutes before the block starts                                   | `not_open_yet`        | 409    | `check_in_not_open`     | `opensAt`      | "Check-in for this class is not open yet."                               |
| More than 30 minutes after the block ends                                      | `closed`              | 409    | `check_in_closed`       | `closesAt`     | "Check-in for this class has closed."                                    |
| Locked out                                                                     | `too_many_attempts`   | 429    | `check_in_locked`       | `lockedUntil`  | "Too many wrong codes. Try again in a few minutes."                      |
| Code matches no accepted or expired period                                     | `code_wrong`          | 422    | `check_in_code_wrong`   | `attemptsLeft` | "That code is not right. Type the code showing now."                     |
| Code matches an expired period                                                 | `code_expired`        | 422    | `check_in_code_expired` | `attemptsLeft` | "That code has expired. Type the code showing now."                      |
| The learner's check-in for the block was overturned                            | none                  | 409    | `check_in_overturned`   | none           | "Your check-in for this class was overturned. Speak to your instructor." |
| Dispute more than 7 days after the mark                                        | none                  | 409    | `dispute_window_closed` | `disputeUntil` | "The time to dispute this has passed."                                   |
| The mark already has a dispute                                                 | none                  | 409    | `already_disputed`      | none           | "You have already disputed this."                                        |
| Dispute of a mark that is not the learner's own, or does not stand             | none                  | 404    | `not_found`             | none           | existing                                                                 |

The learner app shows the times in `details` in its own wording; the messages
above are the fallback text. The Chinese text is drafted with the
implementation and signed off by the author.

**Teach errors.** English only; not in `USER_ERROR_CODES`. Thrown with
`errors.conflict(code, message)`, `errors.unprocessable(code, message,
details)` or `errors.forbidden()`.

| Condition                                                                                                                                                           | Status | Code                      | Details                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Class not in the actor's profile; unknown block, enrollment or dispute id for that class; any route for a class when the actor is a writer who does not instruct it | 404    | `not_found`               | none                                                                                                                    |
| A code, venue-location, overturn or manual-mark request from an owner or manager who is not the assigned instructor                                                 | 403    | `forbidden`               | none                                                                                                                    |
| Block dates or times that fail validation                                                                                                                           | 422    | `blocks_invalid`          | `problems`: a list of `{ index, problem }`, problem one of `end_not_after_start`, `overlaps`, `too_many`                |
| Changing or removing a frozen block                                                                                                                                 | 409    | `block_frozen`            | `blockId`                                                                                                               |
| Removing a block that has refused attempts                                                                                                                          | 409    | `block_has_attempts`      | `blockId`                                                                                                               |
| Publishing a draft class that fails a check                                                                                                                         | 422    | `class_not_publishable`   | `problems`: any of `course_not_published`, `no_blocks`, `block_ended`, `instructor_not_member`, `venue_address_missing` |
| Instructor is not the owner or a current member                                                                                                                     | 422    | `instructor_not_member`   | none                                                                                                                    |
| Deleting a published class; changing its course or delivery                                                                                                         | 409    | `class_published`         | none                                                                                                                    |
| Code route for an in-person class with no venue position                                                                                                            | 409    | `venue_not_set`           | none                                                                                                                    |
| Setting a venue position on a remote class                                                                                                                          | 409    | `class_is_remote`         | none                                                                                                                    |
| Venue reading worse than 100 m without `confirmPoorAccuracy`                                                                                                        | 422    | `venue_accuracy_poor`     | `accuracyM`                                                                                                             |
| Overturn when no check-in stands                                                                                                                                    | 409    | `no_check_in`             | none                                                                                                                    |
| Overturn of a check-in with no flag, including any check-in in a remote class                                                                                       | 409    | `not_flagged`             | none                                                                                                                    |
| Manual mark when the learner is present                                                                                                                             | 409    | `already_present`         | none                                                                                                                    |
| Decision on a dispute that already has one                                                                                                                          | 409    | `dispute_already_decided` | none                                                                                                                    |

**Roster labels** (English, in `roster.tsx`): the six state names above; flag
reasons "far from the venue (N km)", "location too imprecise", "location
refused", "no location reading", "checked in from the app, no location"; and
"too many wrong codes" while `lockedUntil` is in the future.

### Phase 1: Database and shared logic

**Ends with:** `npx turbo run typecheck test` passing. The existing API tests
pass unchanged against the new schema and the view, which shows that the
behaviour those tests cover did not change.

#### 1.1 `packages/db/src/schema/enums.ts` (Modify)

- **Change:** Add `classDeliveryEnum` (`in_person`, `remote`),
  `classStatusEnum` (`draft`, `published`) and `attendanceEventTypeEnum`
  (`attempt_refused`, `check_in`, `overturn`, `manual_mark`, `dispute`,
  `dispute_decision`).
- **Why:** Postgres enums are declared in this file, and the new tables need
  three.

#### 1.2 `packages/db/src/schema/classes.ts` (Create)

- **Change:** Declare `classes`, `classBlocks`, `attendanceEvents` and
  `attendanceEventLocations` with `snakeCase.table`, the columns in the
  Technical Plan, and the helpers from `columns.ts`. `attendanceEvents.createdAt`
  uses `ts().notNull()` with no database default, because the service sets it.
  This file and `commerce.ts` import each other, so
  `attendanceEvents.enrollmentId` is written `references((): AnyPgColumn =>
  enrollments.id, { onDelete: 'restrict' })`, as `profiles.ts` does for
  `mediaAssets`. `refersToEventId` points at its own table with the
  self-reference pattern used in `courses.ts`. `classBlocks.codeSecret` holds
  32 random bytes as base64url text. Indexes: `attendance_events (block_id,
  enrollment_id, created_at)`, `attendance_events (class_id, created_at)`,
  `class_blocks (class_id, position)` unique, `classes (profile_id, status)`,
  and two partial unique indexes built with
  `uniqueIndex(name).on(...).where(sql...)`: `attendance_events_one_check_in`
  on (block, enrollment) where `type = 'check_in'`, and
  `attendance_events_one_per_referred_event` on (`refers_to_event_id`, `type`)
  where `refers_to_event_id is not null`.
- **As built:** `classes.venue_set_by` and `classes.created_by` reference
  `users` and are set to null when the user is deleted, as
  `promoCodes.createdBy` is. `refers_to_event_id` restricts on delete. A check
  constraint, `class_blocks_ends_after_starts`, makes the database refuse a
  block whose end is not after its start.
- **Why:** Classes, blocks, attendance and coordinates each need their own
  table: the old list on the enrollment row cannot be audited, and coordinates
  must be erasable without touching an event.

#### 1.3 `packages/db/src/schema/commerce.ts` (Modify)

- **Change:** Add nullable `classId`, written `references((): AnyPgColumn =>
  classes.id, { onDelete: 'restrict' })`, and an index on it. Replace
  `unique().on(t.userId, t.courseId)` with the partial unique indexes
  `enrollments_one_self_paced_per_course` and `enrollments_one_per_class`. Add
  `selfPacedEnrollments`, a `snakeCase.view('self_paced_enrollments')` that
  selects from `enrollments` where `classId` is null, written like the live
  views in `courses.ts`. Change the comment on `AttendanceRecord` and
  `attendanceRecords` to say they are superseded by `attendance_events` and
  must not be written.
- **Why:** Lets a class be its own enrollment while keeping one self-paced
  enrollment per course, and gives the learner client a view to read through.

#### 1.4 `packages/db/src/schema/index.ts` (Modify)

- **Change:** Add `export * from './classes'`.
- **Why:** Every schema file is exported here.

#### 1.5 `packages/db/src/schema/relations.ts` (Modify)

- **Change:** Add the four tables to `tables`. Add relations: `classes` to
  profile, course, instructor, blocks and enrollments; `classBlocks` to class
  and events; `attendanceEvents` to class, block, enrollment, learner, actor
  and location; `enrollments.class` (nullable) and
  `enrollments.attendanceEvents`.
- **Why:** `db.query.*` reads relations from this one call.

#### 1.6 `packages/db/src/learner-relations.ts` (Modify)

- **Change:** In `tables`, bind the key `enrollments` to
  `selfPacedEnrollments`. The relations block for `enrollments` keeps its
  shape, since the view has the same columns. Update the file's header comment,
  and the comment on `LearnerDb` in `packages/db/src/index.ts`, to say the
  client also leaves out class enrollments.
- **Why:** A read through `learnerDb` then cannot return a class enrollment.
  Nothing writes, locks or infers a row type through `learnerDb`'s
  `enrollments` today. A check recorded in the consolidated review report
  showed Drizzle 1.0.0-rc.5 accepts a view as the root of a relational query
  with its relations; the existing learning and enrollment tests repeat that
  proof in this phase.

#### 1.7 `packages/db/drizzle/<timestamp>_classes_attendance/` (Create, generated)

- **Change:** Run `npm run db:generate -- --name classes_attendance`. Read the
  generated `migration.sql` and confirm that it creates
  `enrollments_one_self_paced_per_course` and `enrollments_one_per_class`,
  creates the view `self_paced_enrollments`, drops
  `enrollments_user_id_course_id_unique`, and drops nothing else. If it differs,
  change the schema files and generate again; do not edit the SQL.
- **Why:** Migrations are generated, never written by hand.

#### 1.8 `packages/db/src/roles.ts` (Create)

- **Change:** Export two functions. The role name must match
  `^[a-z_][a-z0-9_]*$` in both; anything else throws before any SQL runs.

  `apiRoleGrantStatements(role)` returns these statements, in this order:

  ```sql
  do $$ begin execute format('grant connect on database %I to <role>', current_database()); end $$;
  grant usage on schema public, drizzle to <role>;
  grant select on all tables in schema drizzle to <role>;
  grant select, insert, update, delete on all tables in schema public to <role>;
  grant usage on all sequences in schema public to <role>;
  revoke update, delete, truncate on attendance_events from <role>;
  revoke update, truncate on attendance_event_locations from <role>;
  alter default privileges in schema public grant select, insert, update, delete on tables to <role>;
  alter default privileges in schema public grant usage on sequences to <role>;
  ```

  `applyApiRole(pool, { user, password })` throws on an empty password. It
  takes one client from the pool and runs, between `begin` and `commit`:
  1. `select 1 from pg_roles where rolname = $1`, with the role name as a bound
     value;
  2. `create role <user> login nosuperuser nocreatedb nocreaterole password
     <literal>` when step 1 found nothing, or `alter role` with the same
     attributes and password when it found the role;
  3. the statements above.

  The password is quoted with the client's `escapeLiteral`, because Postgres
  accepts no bound values in `create role` and `alter role`, and the statement
  is never logged. On an error it rolls back and rethrows.
- **As built:** The plan first put steps 1 and 2 inside one `do $$ ... $$`
  block. A password that contains `$$` ends that block early, and
  `escapeLiteral` does not guard against it. The lookup is its own statement
  so the password is never inside a dollar-quoted body. The build checked this
  on Postgres 17 with a password containing `$$`, a quote and a space, on a
  first run and a second.
- **Why:** One place defines what the API's database user may do, shared by
  the migration task and the tests. A check recorded in the consolidated
  review report showed each statement form runs on PGlite 0.5.16 and gives the
  intended refusals. The list does not stop the API's user creating a table.
  That refusal comes from Postgres 15 and later, where the `public` schema no
  longer lets every user create in it. RDS runs Postgres 17 and PGlite behaves
  the same; on an older Postgres the user could create tables.

#### 1.9 `packages/db/src/pglite.ts` and `packages/db/src/index.ts` (Modify)

- **Change:** `pglite.ts`: change the signature to `createPgliteDb(options?: {
  dataDir?: string; apiRole?: string })`. No caller passes `dataDir` today.
  When `apiRole` is given, after migrating it runs through `client.exec`: a
  `do` block that creates the role with `nologin` if it is missing, the
  statements from `apiRoleGrantStatements`, and `set role <apiRole>`.
  `index.ts`: export `applyApiRole` and `apiRoleGrantStatements`.
- **Why:** The in-memory test database can then run as the restricted role.

#### 1.10 `packages/db/scripts/migrate.ts` and `packages/db/scripts/reset.ts` (Modify)

- **Change:** Both connect with `MIGRATION_DATABASE_URL` when set, else
  `DATABASE_URL`. `migrate.ts` then calls `applyApiRole` when
  `API_DATABASE_USER` and `API_DATABASE_PASSWORD` are both set.
- **Why:** A developer can run locally with two users, and `npm run db:reset`
  keeps working in that setup; the default one-user setup is unchanged.

#### 1.11 `packages/db/test/api-role.test.ts` (Create)

- **Change:** With `createPgliteDb({ apiRole: 'elevate_api' })`: insert and
  select on `attendance_events` succeed; update, delete and truncate on it are
  refused; insert, select and delete on `attendance_event_locations` succeed
  and update is refused; update on `enrollments` succeeds; select on the
  migration journal succeeds; creating a table is refused; a role name with an
  upper-case letter or a space throws.
- **Why:** Proves the grant list in CI.

#### 1.12 `packages/core/src/domain/permissions.ts` (Modify)

- **Change:** Add `class.read`, `class.manage`, `attendance.read`,
  `attendance.take` and `attendance.review` to `CAPABILITIES`. Add `class.read`
  and `attendance.take` to `WRITER`, and `class.read` and `attendance.read` to
  `STAFF`. Owner and manager receive all five through `ALL` and `MANAGER`. None
  is added to `UNAPPROVED`.
- **As built:** `can()` has never limited staff by a profile's status, and this
  entry does not change that. Staff keep `class.read` and `attendance.read` on
  a profile that is not approved. An owner, manager or writer has none of the
  five before approval.
- **Why:** The capability table in the Technical Plan.

#### 1.13 `packages/core/src/domain/attendance.ts` (Create)

- **Change:** The `attendance.ts` constants and the value lists above.
  Functions:
  - `checkInWindow(block)` returns `opensAt` and `closesAt`.
  - `checkInWindowStatus(block, now)` returns `not_open_yet`, `open` or
    `closed`. The window is open at exactly `opensAt` and at exactly
    `closesAt`.
  - `distanceMeters(a, b)`.
  - `locationStatus({ delivery, venue, sent })` implements step 7 of Check-in
    and returns one of the seven `location_status` values.
  - `lockedUntil(events, now)` and `attemptsLeft(events, now)`, by the rules
    above.
  - `attendanceState(events, now)` returns `{ state, flagReason, subState,
    disputeUntil }` by the two precedence orders above.
  - `canOverturn(events, now)` and `canManualMark(events, now)` take the
    learner's events for the block and the time. `canDispute(events,
    markEventId, now)` and `canDecide(events, disputeEventId, now)` also take
    the event being acted on. Each returns `true` or the error code from the
    tables above. `canDispute` tests in this order: the mark exists and stands
    (`not_found`), the 7 days have not passed (`dispute_window_closed`), no
    dispute exists yet (`already_disputed`).
  - `canCheckIn(events)` returns `true`; `repeat` when the learner has a
    standing check-in or manual mark; or `overturned` when their check-in for
    the block was overturned.
  - `checkInMix(rows)` takes `{ state, flagReason }` per learner and returns
    the seven `CheckInMix` fields.
- **As built:** The file also exports the lists `ATTENDANCE_EVENT_TYPES`,
  `ATTENDANCE_ACTOR_ROLES`, `NO_READING_STATUSES` and `CLASS_AUDIT_ACTIONS`.
  Three edges the plan left open were settled:
  - A refusal exactly 10 minutes old still counts toward the lockout.
  - A reading with an accuracy of exactly 500 m is accurate enough;
    `inaccurate` means more than 500.
  - `locationStatus` throws when an in-person class has a reading and no venue
    position. The API must not reach it in that state, because no code is
    shown until the venue is set.
- **Why:** The API, both portals and the learner app must agree on one
  definition of a learner's state.

#### 1.14 `packages/core/src/domain/class-code.ts` (Create)

- **Change:** The `class-code.ts` constants; `codePeriod(now)`;
  `encodeCode(bytes, length)`, which maps hash bytes onto the alphabet,
  skipping bytes of 240 or above so every character is equally likely, and
  throws if fewer than `length` characters result (a 32-byte hash gives at
  least 20 in all but a negligible share of cases; the caller then rehashes
  with a counter); and `normaliseTypedCode(input)`, which upper-cases and
  strips spaces and dashes.
- **Why:** The learner app and the API both normalise what is typed, and the
  API encodes; all use the same alphabet.

#### 1.15 `packages/core/src/domain/class-time.ts` (Create)

- **Change:** `MAX_BLOCKS` and `CLASS_TIME_ZONE`. `zonedToInstant(date, time,
  timeZone)` and `instantToZoned(instant, timeZone)` built on
  `Intl.DateTimeFormat`, with no new dependency. `validateBlocks(blocks)`
  returns every problem as `{ index, problem }`, with the problems in the Teach
  error table.
- **As built:** The file also exports `isValidZonedDateTime` and the list
  `BLOCK_PROBLEMS`. A wall-clock time that falls in a daylight-saving gap
  moves forward, and one that occurs twice takes the earlier instant.
  `too_many` is reported once for each block past the sixtieth.
- **Why:** `ClassesService` converts the wall-clock dates and times a request
  carries into instants; the portals convert instants back for display, and
  the schedule editor shows each problem beside its row.

#### 1.16 `packages/core/src/contracts/classes.ts` (Create)

- **Change:** Request schemas:
  - `createClassSchema`: `courseId` (uuid), `name` (1 to 120 characters),
    `delivery`, `venueAddress` (optional, up to 300), `seats` (integer 1 to
    500), `instructorUserId` (uuid), `blocks` (1 to 60 of `{ date:
    'YYYY-MM-DD', startTime: 'HH:mm', endTime: 'HH:mm' }`). No `timeZone`.
  - `updateClassSchema`: the same fields, all optional; each block may carry
    `id`.
  - `setInstructorSchema`: `userId`.
  - `setVenueLocationSchema`: `lat` (-90 to 90), `lng` (-180 to 180),
    `accuracyM` (0 or more), `confirmPoorAccuracy` (optional boolean).
  - `checkInSchema`: `code` (a string of up to 40 characters; the schema
    applies `normaliseTypedCode` and then requires 6 characters for
    `typed_code` or 20 for `qr_link`), `method`, `platform`, `appVersion` (up
    to 40), `clientTime` (ISO instant), `location` (either `{ lat, lng,
    accuracyM }` or `{ status: 'denied' | 'unavailable' | 'unsupported' }`).
  - `overturnSchema`: `reasonCode`, `reason` (up to 500; required when the code
    is `other`).
  - `manualMarkSchema`: `reasonCode`, `reason` (as above), `idDocumentType`.
  - `disputeSchema`: `reason` (1 to 500).
  - `disputeDecisionSchema`: `decision`, `reason` (1 to 500).
  - `supportClassSearchSchema`: `q` (1 to 120 characters), `limit` (1 to 50,
    default 20).

  Response types. Every list route answers `{ items: T[] }`.
  - `CheckInMix`: `enrolled`, `selfCheckIn`, `flaggedFromApp`, `flaggedOther`,
    `overturned`, `markedByHand`, `notArrived`. The last six add up to
    `enrolled`.
  - `ClassBlockView`: `id`, `position`, `startsAt`, `endsAt`, `frozen`,
    `checkInOpensAt`, `checkInClosesAt`.
  - `ClassSummary` (`GET classes`): `id`, `name`, `courseId`, `courseTitle`,
    `delivery`, `status`, `seats`, `timeZone`, `instructor: { userId,
    displayName }`, `firstBlockStartsAt`, `lastBlockEndsAt`, `enrolledCount`.
  - `ClassDetail` (`GET classes/:id` and every class write): `ClassSummary`
    plus `venueAddress`, `venue: { lat, lng, accuracyM, radiusM, setAt } |
    null`, `publishedAt`, `viewerIsInstructor`, `blocks: (ClassBlockView & {
    mix: CheckInMix })[]`, `mix: CheckInMix`.
  - `ManualMarkView`: `eventId`, `reasonCode`, `reason`, `markedAt`,
    `subState`, `disputeUntil`.
  - `RosterRow`: `enrollmentId`, `learner: { userId, displayName, email }`,
    `state`, `flagReason`, `distanceM`, `accuracyM`, `checkedInAt`, `method`,
    `lastRefusal: { reason, at } | null`, `lockedUntil`, `manualMark:
    ManualMarkView | null`.
  - `RosterView` (`GET .../roster`, and the answer to overturn and
    manual-mark): `block: ClassBlockView`, `serverTime`, `venueSet`,
    `learners: RosterRow[]`.
  - `CodeView` (`GET .../code`): `codes: { typed, qrSvg, startsInMs, endsInMs
    }[]` (three entries), `checkInClosesAt`.
  - `LearnerClass` (`GET /me/classes`): `enrollmentId`, `class: { id, name,
    courseTitle, delivery, venueAddress, timeZone }`, `blocks: { id, startsAt,
    endsAt, checkInOpen, state, flagReason, manualMark: ManualMarkView | null,
    overturn: { reasonCode, at } | null }[]`.
  - `CheckInContext` (`GET /me/classes/blocks/:blockId`): `blockId`,
    `className`, `startsAt`, `endsAt`, `timeZone`, `asksLocation`,
    `checkInOpensAt`, `checkInClosesAt`, `state`.
  - `CheckInResult` (`POST .../check-in`): `state`, `flagReason`,
    `checkedInAt`.
  - `DisputeView` (`GET classes/:id/disputes`, and the answer to a decision):
    `disputeEventId`, `markEventId`, `blockId`, `learnerName`,
    `markReasonCode`, `markReason`, `markedByName`, `markedAt`,
    `disputeReason`, `disputedAt`, `decision: { decision, reason,
    decidedByName, decidedAt } | null`.
  - `SupportClassSummary` (`GET /support/classes`): `ClassSummary` plus
    `profile: { id, displayName }`.
  - `SupportClass` (`GET /support/classes/:id`): `ClassDetail` plus `profile:
    { id, displayName }`.
  - `SupportClassBlock` (`GET /support/classes/:id/blocks/:blockId`): `class:
    SupportClass`, `block: ClassBlockView`, `attemptsByReason` (a count per
    `refusal_reason` over the last 15 minutes), `learners: (RosterRow & {
    coordinates: { lat, lng } | 'erased' | null, events: { type, at, actorName,
    reasonCode, reason }[] })[]`. `coordinates` is the location row's values;
    `'erased'` when the check-in event has an `accuracy_m` and no location row;
    `null` when no reading was sent.
  - `SupportFeatures` (`GET /support/features`): `classes` (boolean).

  No response type has a field for the code secret. Only `SupportClassBlock`
  has coordinates.
- **As built:** In `checkInSchema`, `appVersion` and `clientTime` are
  optional. The schema checks the code's length and not its characters, so a
  code with a character outside the alphabet is stored as a `code_wrong`
  refusal and counts toward the lockout; it is not a validation error.
  `ClassSummary.firstBlockStartsAt` and `lastBlockEndsAt` are `string | null`.
- **Why:** Routes validate with these and three clients type against them.

#### 1.17 `packages/core/src/domain/index.ts` and `packages/core/src/contracts/index.ts` (Modify)

- **Change:** `domain/index.ts`: export `./attendance`, `./class-code` and
  `./class-time`. `contracts/index.ts`: export `./classes`.
- **Why:** `@elevate/core` re-exports both folders.

#### 1.18 `packages/core/src/contracts/errors.ts` (Modify)

- **Change:** Add, under a new "Classes" header, the eight learner codes in the
  learner-facing error table: `check_in_not_open`, `check_in_closed`,
  `check_in_locked`, `check_in_code_wrong`, `check_in_code_expired`,
  `check_in_overturned`, `dispute_window_closed`, `already_disputed`.
- **Why:** The learner app words errors from codes.

#### 1.19 `packages/i18n/src/messages/areas/apiError.en.ts` and `apiError.zh.ts` (Modify)

- **Change:** One message per new code. The English text is in the
  learner-facing error table.
- **Why:** `catalog.test.ts` fails when a learner-visible code has no message,
  so the messages land in the same phase as the codes. The author signed
  off the Chinese text on 2026-11-24.

#### 1.20 `packages/core/test/` (Modify one, create three)

- **Change:**
  - `permissions.test.ts` (Modify): each new capability per role and profile
    type, and none before approval.
  - `attendance.test.ts` (Create): every `state` and `subState` in precedence
    order; each case under "What may follow what"; the window edges at exactly
    30 minutes before the start and after the end; the lockout at 4 and 5
    refusals, still locked one millisecond before the 5 minutes end and free
    at exactly 5 minutes, and a refusal 10 minutes and one millisecond old not
    counted; `attemptsLeft` from 4 down to 0; each of the seven location
    statuses; the dispute edge at exactly 7 days and one millisecond after;
    `checkInMix` for each state and for both kinds of flag.
  - `class-code.test.ts` (Create): the alphabet has none of `0 1 I L O U`;
    normalising; period edges; `encodeCode` output length.
  - `class-time.test.ts` (Create): Singapore conversions both ways, a zone with
    daylight saving, and each validation problem.
- **Why:** These functions decide what the record means.

### Phase 2: API

**Ends with:** `npx turbo run typecheck test` passing, with the whole API suite
running as the restricted database role.

**As built.** Where the build found an entry wrong or silent:

- **2.3:** `matchCode` returns `{ kind, period }`, because check-in stores the
  matched `code_period`. The typed code is the first 6 characters of the
  20-character link code; if a hash has too few usable bytes, it is
  rehashed with `period:counter`.
- **2.4:** Blocks are ordered by start time, not by the order they were sent.
  `too_many` cannot be reached through the API, because the request schema
  caps blocks at 60 and 61 answers 400. A repeated or unknown block id in a
  PATCH answers 404. The roster's `mix` counts only blocks whose check-in has
  opened, so future blocks do not count as "not arrived".
- **2.4, 2.5:** Audit rows are written after the transaction commits, because
  a write through `deps.db` inside a PGlite transaction blocks on its single
  connection.
- **2.5:** In a remote class a reading sent anyway is not stored (status
  `not_required`). Refused attempts also carry the location columns and the
  side-table row; a refused attempt with a reading before the venue is set
  keeps the reading with no status. `POST .../dispute` answers
  `{ class: LearnerClass }`. `supportBlock` takes coordinates from the
  check-in, or from the latest refused attempt when there is none. A second
  submit of a correction writes nothing and answers 409 (`already_present`
  or `no_check_in`).
- **2.5, not checked:** check-in and `GET /me/classes` do not check that the
  class is published, since only a published class has enrollments. The
  code route serves codes whenever the venue rule passes, also outside the
  check-in window; the design sets no limit there.
- **2.7:** The check-in rate limit, 20 a minute, is kept in each process's
  memory.
- **2.8:** `GET /support/features` answers `{ classes }` unwrapped. Other
  answers are wrapped: `{ class }`, `{ roster }`, `{ code }`, `{ context }`,
  `{ result }`, `{ block }`, `{ dispute }`, `{ items }`, and `{ ok: true }`
  for a delete.
- **2.18:** With no `DATABASE_URL`, `check-api-role` exits 2, not 1, because
  1 means the update was allowed.
- **2.21:** On profiles other than the approved one, the fixture's
  instructor is a separate `fixture-instructor-N` writer, because a route in
  the table deletes `memberId`.
- **2.22:** `class-guards.test.ts` scans Drizzle calls only, so the raw SQL in
  `check-api-role.ts` is allowed. Part 2's class checkout sets `classId` on an
  enrollment and must change this guard on purpose.

#### 2.1 `apps/api/src/env.ts` and `.env.example` (Modify)

- **Change:** `env.ts`: add `CLASSES: bool.default(false)` beside
  `COURSE_PREVIEWS`, with a comment naming ADR 012, and the optional string
  `SEED_CLASS_LEARNER_EMAILS` beside `SEED_SUPER_ADMIN_EMAIL`. `.env.example`:
  add `CLASSES=true`, and commented `SEED_CLASS_LEARNER_EMAILS`,
  `MIGRATION_DATABASE_URL`, `API_DATABASE_USER` and `API_DATABASE_PASSWORD`,
  with a note that local development runs as one database user unless the last
  three are set.
- **Why:** `CLASSES` is the one setting that turns class routes on, and a local
  API needs it on from this phase so the portals can be built against it.

#### 2.2 `apps/api/src/middleware/classes-enabled.ts` (Create)

- **Change:** `requireClasses(deps)` throws `errors.notFound()` when
  `deps.env.CLASSES` is false.
- **Why:** One guard used by all three class route files.

#### 2.3 `apps/api/src/lib/class-code.ts` (Create)

- **Change:** `newBlockSecret()` returns `randomToken()`, which is 32 random
  bytes as base64url. `codesFor(secret, period)` returns the typed and link
  codes, computed with `createHmac` from `node:crypto` and `encodeCode` from
  core. `matchCode(secret, submitted, now)` returns `current`, `previous`,
  `expired` or `none` as the Technical Plan defines, comparing with
  `timingSafeEqual` from `node:crypto` after a length check. `qrSvg(url)` uses
  the installed `qrcode` package.
- **Why:** The code must be derivable by any API process from the stored
  secret. `lib/crypto.ts` is not changed: its `hmacHex` returns hex, and this
  needs bytes.

#### 2.4 `apps/api/src/services/classes.service.ts` (Create)

- **Change:** `list(actor)`, `get(actor, id)`, `create(actor, input)`,
  `update(actor, id, input)`, `publish(actor, id)`, `setInstructor(actor, id,
  userId)`, `remove(actor, id)`, `setVenueLocation(actor, id, input)`, and
  `load(actor, id)`, the one class lookup every other method and
  `AttendanceService` use. `load` filters by `actor.profileId` in the same
  query and, for a writer, also by `instructorUserId = actor.userId`; no row
  means 404. `create` and `update` run `validateBlocks`, convert each block's
  date and times to instants with `zonedToInstant` in `CLASS_TIME_ZONE`, and
  create a code secret for each new block. `update` keeps block ids and applies
  the freeze rule. `publish` on a draft applies the publishing checks and
  reports all failed ones together; on a published class it answers the class
  unchanged. Exports `isAssignedInstructor(actor, classRow)`. Reads
  `attendance_events` to decide whether a block is frozen; never writes it.
  Calls `recordAudit` with the class audit actions above. Errors as in the
  Teach error table.
- **Why:** One lookup behind one profile filter means no route can read
  another profile's class, and a writer cannot read a class they do not
  instruct.

#### 2.5 `apps/api/src/services/attendance.service.ts` (Create)

- **Change:** The only file that inserts into `attendance_events` and
  `attendance_event_locations`. Methods:
  - `checkInContext(user, blockId)`;
  - `checkIn(user, blockId, input, requestId)`, the eight steps under Check-in;
  - `listForLearner(user)`;
  - `dispute(user, eventId, input, requestId)`;
  - `roster(actor, classId, blockId)`;
  - `codes(actor, classId, blockId)`;
  - `overturn(actor, classId, blockId, enrollmentId, input, requestId)`;
  - `manualMark(actor, classId, blockId, enrollmentId, input, requestId)`;
  - `disputes(actor, classId)`;
  - `decideDispute(actor, classId, disputeEventId, input, requestId)`;
  - `supportSearch(query)`, `supportClass(id)`, `supportBlock(classId,
    blockId)`.

  Every Teach method loads the class with `ClassesService.load`. `roster`
  then requires `can(actor, 'attendance.read')` or `isAssignedInstructor`,
  else 404. `codes`, `overturn` and `manualMark` require
  `isAssignedInstructor`, else 403. Every insert sets `createdAt: deps.now()`
  and `learnerUserId` from the enrollment. Every window, lockout and code
  period reads `deps.now()`. `overturn`, `manualMark`, `dispute` and
  `decideDispute` run in a transaction that locks the enrollment row, reads
  the learner's events for the block, applies `canOverturn`, `canManualMark`,
  `canDispute` or `canDecide` from core, and inserts. Each attempt writes one
  log line through `deps.log`. Overturn, manual mark and dispute decision call
  `recordAudit` with the attendance audit actions above.
- **Why:** One writer keeps the insert-only rule checkable, and one place
  applies the state rules.

#### 2.6 `apps/api/src/routes/teach-classes.ts` (Create)

- **Change:** The fourteen Teach routes, mounted at `/teach`. Each uses
  `requireClasses` and `requireProfile(deps, capability)`, then `uuidParam` and
  `ensureActor` from `middleware/auth` and `validate` from `lib/validate`, and
  returns `c.json(body, 200)`. The file defines its own `on` helper, since the
  one in `teach.ts` is local to that file.
- **Why:** `routes/teach.ts` is already long; a second file under the same
  mount keeps class routes together, and the route table test still sees them.

#### 2.7 `apps/api/src/routes/classes.ts` (Create)

- **Change:** The four learner routes in the Technical Plan, mounted at
  `/me/classes`, each with `requireUser()`. `GET /` answers `{ items: [] }`
  when `CLASSES` is off; the other three use `requireClasses`. The check-in
  route adds `rateLimit({ name: 'check-in', limit: 20, windowMs: 60_000 })`.
- **Why:** Class data lives on new endpoints only, so older app versions are
  not affected.

#### 2.8 `apps/api/src/routes/support.ts` (Modify)

- **Change:** Add `GET /features`, which answers `SupportFeatures` and does not
  use `requireClasses`. Add `GET /classes` (validated with
  `supportClassSearchSchema`), `GET /classes/:id` and `GET
  /classes/:id/blocks/:blockId`, each with `requireClasses`.
- **Why:** The Support view, and the signal its navigation needs. All four
  inherit `requireRole('support_agent')`.

#### 2.9 `apps/api/src/app.ts` (Modify)

- **Change:** Add `.route('/teach', teachClassRoutes(deps))` and
  `.route('/me/classes', classRoutes(deps))` to the chain.
- **Why:** `AppType` and the typed client come from this chain.

#### 2.10 `apps/api/src/services/catalog.service.ts` (Modify)

- **Change:** In `detail`, the `viewer` lookup reads
  `learnerDb.query.enrollments` in place of `db.query.enrollments`, and `db` is
  dropped from that function's destructure, where the lookup was its only use.
- **Why:** With two rows for one learner and course, the lookup on the full
  client can return either.

#### 2.11 `apps/api/src/services/certificates.service.ts` (Modify)

- **Change:** `issueForEnrollment` and `forEnrollment` read the enrollment
  through `learnerDb`. Their writes stay on the full client. Both use only the
  relations `user`, `course` and `certificate`, which the learner client has.
- **Why:** A class enrollment must not earn the self-paced certificate.

#### 2.12 `apps/api/src/services/enrollments.service.ts` (Modify)

- **Change:** `activeCourseIds` and `ensureActive` read through `learnerDb`.
  `listForUser` already does and is not changed.
- **Why:** Neither has a caller today; moving them keeps a future caller from
  reading class enrollments through them.

#### 2.13 `apps/api/src/services/payments.service.ts` (Modify)

- **Change:** In `startCheckout`, add `classId: { isNull: true }` to the
  lookup of the learner's enrollment by learner and course. No other line
  changes: every later read is by id or by Stripe session id, and inserts
  leave `classId` null.
- **Why:** "Already enrolled" and row reuse must look only at the self-paced
  row. Checkout writes enrollments, so it stays on the full client.

#### 2.14 `apps/api/src/services/analytics.service.ts` (Modify)

- **Change:** Add `class_id is null` to the enrollment totals query and to the
  join condition of the per-course query.
- **Why:** The numbers teachers and Support see today mean self-paced
  enrollments.

#### 2.15 `apps/api/src/services/people.service.ts` (Modify)

- **Change:** Add `class_id is null` to the count of a person's active
  enrollments.
- **Why:** As 2.14.

#### 2.16 `packages/core/src/contracts/teach.ts` and `apps/api/src/services/profiles.service.ts` (Modify)

- **Change:** Add `classesEnabled: boolean` to `ProfileView`, and set it from
  `deps.env.CLASSES` in `toView`. If a test compares a whole profile body, add
  the field to its expected value.
- **Why:** The Teach portal hides Classes when the setting is off. Both files
  change in the same phase so the type and its producer agree.

#### 2.17 `apps/api/src/migrate.ts` and `apps/api/src/reset-schema.ts` (Modify)

- **Change:** Both connect with `MIGRATION_DATABASE_URL` when set, else
  `DATABASE_URL`. `migrate.ts` then calls `applyApiRole` when
  `API_DATABASE_USER` and `API_DATABASE_PASSWORD` are both set, and logs that
  the role was applied; the log line leaves out the password.
- **Why:** Both need the owner, and the migration task carries the owner
  string under that name. `reset-schema.ts` reads only `DATABASE_URL` today
  and would fail there.

#### 2.18 `apps/api/src/check-api-role.ts` (Create), `apps/api/tsup.config.ts` and `apps/api/Dockerfile` (Modify)

- **Change:** `check-api-role.ts` connects with `DATABASE_URL` and never reads
  `MIGRATION_DATABASE_URL`. Using the pool directly, it runs `update
  attendance_events set request_id = request_id where false`. If Postgres
  answers with error code `42501`, it logs "refused, as intended" and exits 0.
  If the update succeeds, it exits 1. Any other error exits 2. `tsup.config.ts`:
  add the file to `entry` and to the comment above it. `Dockerfile`: add it to
  the comment that lists the entry files; the image already copies all of
  `dist`.
- **Why:** The deploy workflow needs a program it can run to confirm the
  database refuses the update; the image has no test runner.

#### 2.19 The seed: four files (Modify)

- **Change:**
  - `packages/db/src/seed/index.ts`: add three optional fields to
    `SeedOptions`: `classes` (default false), `classLearnerEmails` (default
    empty) and `now` (default the current time). Update the comment on `mode`.
    Change the existing find-or-insert of the demo learner's enrollment to
    match `classId` null. In demo mode with `classes` true:
    1. Find the newest class on the first demo profile (`seedTeachers[0]`)
       whose name starts with the demo prefix.
    2. If there is none, or none of its blocks ends after `now`, create "Demo
       class `YYYY-MM-DD`", dated in `Asia/Singapore`: published, in person, on
       that profile's first course in `seed/content.ts` order that is on sale,
       with `writer@example.com` as instructor, 30 seats, and three blocks from
       09:00 to 17:00 Singapore time on that date and the two days after. Each
       block's secret is `randomBytes(32).toString('base64url')`.
    3. Whether the class was found or created, add any missing active class
       enrollment for `learner@example.com`, for
       `class-learner-01@example.com` to `class-learner-19@example.com`, and
       for each address in `classLearnerEmails`. Change no existing row.

    The nineteen made-up learners are created with the seed's `upsertUser` and
    the names "Class Learner 01" to "Class Learner 19". A tester address is
    inserted only if no user has it, so an existing user's name is never
    overwritten.
  - `packages/db/src/seed/content.ts`: add the demo class's name prefix and
    venue address.
  - `apps/api/src/seed.ts`: pass `classes: env.CLASSES` and
    `classLearnerEmails`, split from `env.SEED_CLASS_LEARNER_EMAILS` on
    commas. Update the header comment.
  - `packages/db/scripts/seed.ts`: pass the same two, read from
    `process.env.CLASSES` and `process.env.SEED_CLASS_LEARNER_EMAILS`.
- **Why:** No route creates a class enrollment, so the seed is the only way to
  get one on staging and on a developer's machine. A fresh class once the last
  has ended keeps both usable. The email list lets real testers be in the demo
  class; on staging it is passed as an environment override on the one-off
  task, as `ALLOW_SCHEMA_RESET` is. The options are optional because three API
  tests call `seedDatabase` without them. The `classes` flag keeps class data
  out of an environment where `CLASSES` is off.

#### 2.20 `apps/api/test/helpers/test-app.ts` (Modify)

- **Change:** Call `createPgliteDb({ apiRole: 'elevate_api' })`. Default
  `CLASSES` to `'true'`. Add `createClass(profileId, courseId, options)`,
  which inserts a class directly and returns the class and block ids, with
  options for status, delivery, instructor, venue and blocks placed around the
  test clock; `enrolInClass(email, classId)`, which inserts an active class
  enrollment; and `validCodeFor(blockId, at?)`, which reads the block's secret
  and returns the typed code for that time.
- **Why:** The whole suite then runs as the restricted role, and tests can
  build classes, class learners and valid codes. No existing API test runs SQL
  that needs the owner.

#### 2.21 `apps/api/test/role-routes.test.ts` (Modify)

- **Change:**
  - **Fixture.** Add to `Fixture`: `classId`, `blockId`, `instructorUserId`,
    `flaggedEnrollmentId`, `absentEnrollmentId`, `disputeEventId` and
    `deletableClassId`. `fixture()` builds them with direct inserts: a
    published, in-person class with its venue position set and one block open
    at the test clock; a class learner with a flagged check-in; a class learner
    with no events; a third class learner with a manual mark and a dispute of
    it; and a second, draft class with no blocks. The class's instructor is
    `writer@example.com` on the profile where that user is a member, and on
    the other profiles a writer the fixture adds with `addMember`.
  - **Markers.** Add `instructor` and `roster` to the `capability` union, with
    these rules in `allowed()`: `instructor` is `can(actor, 'attendance.take')
    && actor.role === 'writer'`; `roster` is `can(actor, 'class.read') &&
    (can(actor, 'attendance.read') || actor.role === 'writer')`.
  - **Rows**, with their bodies:

    | Route                            | Capability          | Path and body                                                                         |
    | -------------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
    | `GET classes`                    | `class.read`        | none                                                                                  |
    | `POST classes`                   | `class.manage`      | a valid draft for the fixture course, instructor `f.instructorUserId`                 |
    | `GET classes/:id`                | `class.read`        | `f.classId`                                                                           |
    | `PATCH classes/:id`              | `class.manage`      | `f.classId`, body `{ name }` only                                                     |
    | `POST classes/:id/publish`       | `class.manage`      | `f.classId`, already published, so it answers 200                                     |
    | `PUT classes/:id/instructor`     | `class.manage`      | `f.classId`, body `{ userId: f.instructorUserId }`, so the instructor does not change |
    | `GET .../roster`                 | `roster`            | `f.classId`, `f.blockId`                                                              |
    | `GET .../code`                   | `instructor`        | the same                                                                              |
    | `PUT classes/:id/venue-location` | `instructor`        | a reading with accuracy 10 m                                                          |
    | `POST .../overturn`              | `instructor`        | `f.flaggedEnrollmentId`, reason `not_in_room`                                         |
    | `POST .../manual-mark`           | `instructor`        | `f.absentEnrollmentId`, reason `no_phone`, document `nric`                            |
    | `GET classes/:id/disputes`       | `attendance.review` | `f.classId`                                                                           |
    | `POST .../decision`              | `attendance.review` | `f.disputeEventId`, decision `upheld`                                                 |
    | `DELETE classes/:id`             | `class.manage`      | `f.deletableClassId`; placed last                                                     |

  - **Helper lists.** Add `INSTRUCTOR_ROUTES` (the four `instructor` rows),
    `CLASS_MANAGE_ROUTES` (the five `class.manage` rows) and `DISPUTE_ROUTES`
    (the two `attendance.review` rows).
  - **Expected refusals.** Owner: `INSTRUCTOR_ROUTES`. Manager: add
    `INSTRUCTOR_ROUTES`. Writer: add `CLASS_MANAGE_ROUTES` and
    `DISPUTE_ROUTES`. Staff: add `CLASS_MANAGE_ROUTES`, `INSTRUCTOR_ROUTES` and
    `DISPUTE_ROUTES`. The two unapproved-profile tests list the routes they
    permit, and no class route is permitted before approval, so those lists do
    not change.
  - **One new test.** A second published, in-person class with its venue set,
    whose instructor is the owner, with its own flagged learner and absent
    learner. The owner gets 200 on the four instructor routes. The writer gets
    404 on that class's detail, roster and four instructor routes.
- **Why:** The first test in this file fails for any Teach route with no row,
  and `allowed()` cannot express "assigned to this class" without a marker.
  Both markers include a capability check, so an actor on an unapproved
  profile is refused by the table as the API refuses them.

#### 2.22 New API tests in `apps/api/test/` (Create)

- **Change:**
  - `classes.test.ts`: create, edit, each block problem, each publishing
    problem, publishing twice, reassigning, a frozen block, a block with only
    refused attempts, deleting a draft, a writer getting 404 on a class they do
    not instruct, and 404 across profiles.
  - `class-code.test.ts`: `current` and `previous` are accepted; a code 2 to
    11 periods old is `expired`; a code 12 periods old and another block's
    code are `none`; a second app built with `createApp(t.deps)` over the same
    database accepts the first one's codes.
  - `check-in.test.ts`: each window edge; each refusal with its stored reason,
    status, code and details, including `attemptsLeft` falling from 4 to 0;
    the sixth attempt answering `check_in_locked`; a repeat check-in answering
    200 with one stored row; each location status; a remote class; a learner
    with no class enrollment getting 404 with nothing stored; a check-in after
    an overturn; coordinates stored in the side table and nowhere else.
  - `attendance-corrections.test.ts`: overturn of a flagged check-in; overturn
    refused for an unflagged one and in a remote class; manual mark in each
    allowed state and refused when present; a double submit writing one row;
    dispute inside and outside 7 days; uphold and void; a second decision
    refused; a new mark after a void; that no earlier row changed; each audit
    action written.
  - `class-entitlement.test.ts`: for a learner with both enrollments, `GET
    /me/enrollments`, the course page `viewer`, checkout, every learning route
    and the certificate route behave as "What a class enrollment can and
    cannot do" says.
  - `classes-setting.test.ts`: with `CLASSES` off, `GET /me/classes` answers
    an empty list, `GET /support/features` answers `classes: false`, and every
    other class route answers 404.
  - `support-classes.test.ts`: the search and its limits; the class and block
    routes; coordinates present, `'erased'` after the location row is deleted,
    and `null` when no reading was sent; a non-staff user refused; no write
    route under `/support/classes`.
  - `venue.test.ts`: the code route refuses until the venue is set; a poor
    reading needs confirming; a remote class needs no venue.
  - `seed-classes.test.ts`: a demo seed with `classes` true creates one demo
    class with 20 class enrollments; a second run on the same day creates no
    class and no enrollment; a run with a new address in `classLearnerEmails`
    adds one enrollment and renames no user; a run with `now` after the last
    block creates a second class; a run with `classes` false creates none.
  - `class-guards.test.ts`: reads every file under `apps/api/src` and fails if
    any file other than `attendance.service.ts` inserts into
    `attendanceEvents` or `attendanceEventLocations`; if any file calls
    `update` or `delete` on `attendanceEvents`; or if any file sets `classId`
    in an insert into or update of `enrollments`.
- **Why:** Each goal has a test that fails without it; see the table in the
  Verification Plan.

### Phase 3: Teach portal

**As built.** Where the build found an entry wrong or silent:

- **3.6:** `useClassActions` takes no arguments, so each action takes the
  class, block and enrollment ids. A refusal from the API is not retried, so
  `venue_not_set` shows at once. The code screen keeps polling while its
  window is hidden, so a projector window behind another does not run out of
  codes; the roster pauses while hidden, as by default.
- **3.8:** An edit sends only the fields that changed, so the
  `class.updated` audit entry names the real fields. The instructor can be
  changed from the form as well as from the detail page.
- **3.10:** The roster screen also loads the class, because `RosterView`
  has no class name, delivery, venue or `viewerIsInstructor`. "Too many wrong
  codes" is judged against the roster's `serverTime`.
- **3.11:** The code screen also loads the class, for its name and block
  time. The QR image is shown as an `<img>` data URL, which the deployed
  `img-src` allows.
- **3.12, a field added to Phase 2:** `ClassBlockView` gains `removable`, true
  when the block has no attendance event of any kind. The editor hides the
  remove button on a block that is not removable and says why, in place of a
  general note. `classes.test.ts` covers the flag.
- **3.13:** The dialogs use `NativeSelect` and `Textarea`, which already
  contain `Field`.
- The class pages are English, as the design says; only the navigation label
  is translated, as `nav.classes`. The author signed off its Chinese text
  on 2026-11-27.

**Ends with:** `npx turbo run typecheck build` passing.

#### 3.1 `packages/i18n/src/messages/areas/chrome.en.ts` and `chrome.zh.ts` (Modify)

- **Change:** Add the key `nav.classes`: "Classes" and its Chinese text.
- **Why:** Both portals' navigation is translated, and AGENTS.md forbids
  English literals there.

#### 3.2 `apps/teach/src/router.tsx` (Modify)

- **Change:** Under `p/:profileId` add `classes`, `classes/new`,
  `classes/:id`, `classes/:id/edit`, `classes/:id/blocks/:blockId` (the roster
  screen) and `classes/:id/blocks/:blockId/code` (the code screen).
- **Why:** Teach pages are reachable only through this route tree.

#### 3.3 `apps/teach/src/routes/gate.tsx` (Modify)

- **Change:** In `ProfileGate`, render a bare `<Outlet />` when the path ends
  with `/code`, as it does for the Stripe return pages.
- **Why:** The code screen must not show the portal's navigation on a
  projector.

#### 3.4 `apps/teach/src/routes/layout.tsx` (Modify)

- **Change:** Add a nav item labelled `t('nav.classes')` with the
  `CalendarDays` icon, shown when `profile.classesEnabled` and
  `can('class.read')`.
- **Why:** The entry point. Staff hold `class.read` and `attendance.read`, so
  they reach the list and the rosters too.

#### 3.5 `apps/teach/src/lib/keys.ts` (Modify)

- **Change:** Add `classKeys` with `list(profileId)`, `detail(profileId, id)`,
  `roster(profileId, id, blockId)`, `codes(profileId, id, blockId)` and
  `disputes(profileId, id)`.
- **Why:** Query keys live in this file.

#### 3.6 `apps/teach/src/lib/classes.ts` (Create)

- **Change:** Hooks `useClasses`, `useClass`, `useRoster` (`refetchInterval:
  3000`, which TanStack Query pauses in a hidden tab by default), `useCodes`
  (`refetchInterval: 20000`), `useDisputes`, and `useClassActions` with plain
  async functions that invalidate queries, as `useMemberActions` does.
- **Why:** The repo has no `useMutation`; this follows its existing pattern.

#### 3.7 `apps/teach/src/routes/classes/list.tsx` (Create)

- **Change:** A table of classes with course, dates, instructor, status and
  seats, and a "New class" button for `class.manage`.
- **Why:** The list is the only way into a class's page.

#### 3.8 `apps/teach/src/routes/classes/form.tsx` (Create)

- **Change:** Create and edit. Fields: course (courses on sale only), name,
  delivery, venue address, seats, instructor (owner and members), and the
  schedule editor. After publishing, course and delivery are read-only.
- **Why:** A class has to be set up and published before a block can be run.

#### 3.9 `apps/teach/src/routes/classes/detail.tsx` (Create)

- **Change:** The class; its blocks, each with its check-in mix and a link to
  its roster screen for the assigned instructor and anyone with
  `attendance.read`; the class's total mix; publish and delete; reassign
  instructor; and the disputes list with uphold and void for
  `attendance.review`.
- **Why:** The page the check-in mix goal is checked on, and the way into a
  roster.

#### 3.10 `apps/teach/src/routes/classes/roster.tsx` (Create)

- **Change:** The roster table, with the roster labels above. "Updated N s
  ago", computed from the query's `dataUpdatedAt`, and "not updating" after 10
  seconds. "Open code screen". "Set the venue location here", which reads
  `navigator.geolocation` and, when the API answers `venue_accuracy_poor`,
  shows the accuracy and asks to confirm. Per-row actions from `state`:
  overturn on `present_flagged` only; manual mark on `not_arrived`,
  `overturned` and `mark_voided`. When `viewerIsInstructor` is false the table
  is shown without actions and without the two buttons.
- **Why:** The screen the instructor runs a block from, and the read-only view
  for an owner, manager or staff member.

#### 3.11 `apps/teach/src/routes/classes/code-screen.tsx` (Create)

- **Change:** The class name, the block's time, the QR image, the six
  characters in large type, and a countdown. It records
  `performance.now()` when each answer arrives and switches codes by elapsed
  time against `startsInMs` and `endsInMs`; it never reads the device's wall
  clock. It shows "offline" once the last code it holds has ended, and "Set
  the venue location first" when the API answers `venue_not_set`.
- **Why:** The projector view. A device clock that is wrong must not show a
  code the server refuses.

#### 3.12 `apps/teach/src/components/class-schedule-editor.tsx` (Create)

- **Change:** A list of rows with a date and a start and end time, using
  `Input` with the browser's `date` and `time` types; "Add a day"; "Add
  another block on this day"; a message beside each row `validateBlocks`
  reports; "SGT" beside each time. Frozen blocks are read-only.
- **Why:** `@elevate/web-ui` has no date or time picker.

#### 3.13 `apps/teach/src/components/attendance-dialogs.tsx` (Create)

- **Change:** Two dialogs built from `Dialog`, `Field`, `NativeSelect` and
  `Textarea`: overturn (reason code, note) and manual mark (reason code, note,
  document type).
- **Why:** Both actions need a reason before they are sent.

### Phase 4: Support portal

**As built.** Where the build found an entry wrong or silent:

- **4.3:** The features query runs only for a user with `support_agent`, so a
  user on the "staff only" screen does not fire a request that answers 403.
- **4.4:** With no block chosen, the page opens on the block whose check-in
  window is open, else the next one, else the last (CUJ 11). Times are shown
  in the class's time zone with its short name. A learner's "last attempt"
  is their latest check-in or refused attempt. Distance and accuracy come
  from the check-in only, while coordinates fall back to the latest refused
  attempt, so a refused learner can show coordinates and no distance; the
  table says so. The corrections table also lists disputes and their
  decisions.
- **4.4, a field added to Phase 2:** each event in `SupportClassBlock` gains
  `decision` (`upheld`, `voided` or null), so the corrections table can show
  a decision's outcome. `support-classes.test.ts` covers it.

**Ends with:** `npx turbo run typecheck build` passing.

#### 4.1 `apps/support/src/router.tsx` (Modify)

- **Change:** Add `classes` and `classes/:id`.
- **Why:** Support pages are reachable only through this route tree.

#### 4.2 `apps/support/src/lib/queries.ts` (Modify)

- **Change:** Add `useSupportFeatures`, `useClassSearch`, `useSupportClass` and
  `useSupportBlock`.
- **Why:** Support's hooks live in this file.

#### 4.3 `apps/support/src/routes/layout.tsx` (Modify)

- **Change:** Add a nav item labelled `t('nav.classes')`, shown when
  `useSupportFeatures` answers `classes: true`.
- **Why:** In production `CLASSES` is off for all of Part 1, and the item must
  not lead to pages that answer 404.

#### 4.4 `apps/support/src/routes/classes.tsx` and `class-view.tsx` (Create)

- **Change:** `classes.tsx` has one search box, for a profile name, class name
  or learner email, and lists `SupportClassSummary` rows. `class-view.tsx`
  shows the class, a block picker, and for the chosen block: times and time
  zone; venue position, accuracy and radius; attempts by reason for the last
  15 minutes; each learner's state, last attempt, reason, distance and
  coordinates; every overturn and manual mark. It has a manual refresh and no
  action that writes. English text.
- **Why:** CUJ 11.

### Phase 5: Learner app

**As built.** Where the build found an entry wrong or silent:

- **5.6:** The web reader enforces its own 10-second limit, because the
  browser's `timeout` does not count the time its permission prompt is open.
  A browser without geolocation answers `unavailable`. Location needs a
  secure origin, so a walkthrough over a LAN address records `denied`.
- **5.7:** A manual mark with the reason `other` shows the instructor's note.
- **5.8:** After the emailed sign-in, the learner returns to the check-in
  screen without the link's code, which has expired by then and would count
  toward the lockout. A remote class asks for no location and sends
  `unsupported`, because the request needs a value; the API stores
  `not_required`. A link code is used only if it has 20 characters; editing
  it, or a refusal, turns the next try into a typed code. Opening, closing
  and lockout times are worded from the error's `details` with
  `learnerClass` keys, falling back to `apiError.<code>`. On the web, "Open
  the Elevate app" uses `elevate://` in the same tab; Expo Go does not
  handle it.
- **5.8, a field added to Phase 2:** `CheckInContext` gains `enrollmentId`, so
  the screen links back to the learner's class without reading their class
  list. `check-in.test.ts` covers it.
- **5.10:** `jest.setup.ts` mocks the new client paths. There is no test for
  the class screen or the dispute form; the entry lists none.
- The Chinese text in `learnerClass.zh.ts`, and the class terms added to the
  header of `zh.ts`, were signed off by the author on 2026-11-27.

**Ends with:** `npx turbo run typecheck test` passing, including
`npm -w @elevate/learner test`, and then the local walkthrough below.

#### 5.1 `packages/i18n/src/messages/areas/learnerClass.en.ts` and `learnerClass.zh.ts` (Create)

- **Change:** Keys for: the "Your classes" heading; the class screen (dates,
  each of the six states, each of the five flag reasons, "Marked present by
  your instructor", each manual-mark reason code, each overturn reason code,
  "This was not me", the dispute form, each of the four sub-states); the
  check-in screen (title, code field, the location explanation, "Check in",
  "You are checked in", "You are already checked in", "Type the code showing
  now", "Open the Elevate app and type the code", "Sign in here", "If nothing
  happens, sign in here"). Whole sentences, following ADR 008. The Chinese
  file ends with the `satisfies` check the other areas use.
- **Why:** The learner app has no English literals. The Chinese text is drafted
  with the implementation and needs the author's sign-off before merge. The
  author signed it off on 2026-11-27.

#### 5.2 `packages/i18n/src/messages/en.ts` and `zh.ts` (Modify)

- **Change:** Import the new area, add it to `enAreas` and `zhAreas`, and
  spread it into `en` and `zh`.
- **Why:** An unregistered area fails `catalog.test.ts`.

#### 5.3 `apps/learner/src/app/_layout.tsx` (Modify)

- **Change:** Add `class/[enrollmentId]` to the signed-in `Stack.Protected`
  group. Leave `class/check-in/[blockId]` outside it.
- **Why:** The class screen needs a session; the check-in screen must open
  signed out to offer the two choices in CUJ 4.

#### 5.4 `apps/learner/src/lib/sign-in-redirect.ts` (Modify)

- **Change:** Add `/^\/class\/[^/]+\/?$/` to `SIGNED_IN_ONLY`. It matches the
  class screen and not the check-in screen, whose path has one more segment.
- **Why:** This list must stay in step with the protected group, as its
  comment says.

#### 5.5 `apps/learner/src/lib/classes.ts` (Create)

- **Change:** `useMyClasses`, `useCheckInContext(blockId)`, `checkIn(blockId,
  input)` and `disputeMark(eventId, reason)`, using `api` and `unwrap` as
  `lib/catalog.ts` does.
- **Why:** The learner app's data hooks sit in `lib`.

#### 5.6 `apps/learner/src/lib/location.ts` and `location.web.ts` (Create)

- **Change:** Both export `readLocation()`. The native file returns `{ status:
  'unsupported' }`. The web file calls `navigator.geolocation` with a
  10-second limit and returns a reading, `denied` or `unavailable`.
- **Why:** No native module is added. The split follows the `.web.ts` pattern
  the app already uses.

#### 5.7 `apps/learner/src/app/class/[enrollmentId].tsx` (Create)

- **Change:** The class name, venue or "remote", and each block with its time
  and the learner's state. A "Check in" button on a block whose window is
  open. For a manual mark: the reason in the learner's language, its
  sub-state, and "This was not me" while the sub-state is `open`. For an
  overturn: the reason.
- **Why:** Where an app user starts check-in and disputes a mark. Part 3 adds
  materials to this screen.

#### 5.8 `apps/learner/src/app/class/check-in/[blockId].tsx` (Create)

- **Change:** Reads `c` from the address. Signed out on web: the two choices,
  with "Open the Elevate app" linking to
  `elevate://class/check-in/<blockId>` and "Sign in here" going to sign-in
  with `redirect` set to this address. Signed out on native: goes to sign-in
  with the same `redirect`. Signed in on web: the location explanation, then
  `readLocation()` when the learner presses "Check in". Signed in on native:
  the code field only. Sends `qr_link` when the code came from the address and
  `typed_code` otherwise. After `check_in_code_wrong` or
  `check_in_code_expired` it clears the field and shows that code's message
  with the attempts left. On success it shows "You are checked in" and a link
  to the class screen.
- **Why:** The one screen behind CUJs 2 to 5.

#### 5.9 `apps/learner/src/app/(tabs)/learning.tsx` (Modify)

- **Change:** Above the course list, a "Your classes" section from
  `useMyClasses`, shown only when it has items. Each card shows the class
  name, course title, the next block's time and a link to the class screen.
- **Why:** The entry point for an app user.

#### 5.10 Learner tests (Create two, modify one)

- **Change:**
  - `apps/learner/src/__tests__/check-in.test.tsx` (Create): the code from the
    address is prefilled; a typed code is normalised; each refusal shows its
    message; the native path sends `unsupported`; signed out on web shows both
    choices.
  - `apps/learner/src/lib/__tests__/location-web.test.ts` (Create): a reading,
    a refusal and a timeout.
  - `apps/learner/src/__tests__/sign-in-redirect.test.tsx` (Modify): a
    `/class/<id>` address needs sign-in; a `/class/check-in/<id>` address does
    not.
- **Why:** The check-in screen carries the learner-side rules.

### Phase 6: Infrastructure and deploy

**As built.** Where the build found an entry wrong or silent:

- **6.5, 6.7:** The staging root defaults `classes` to false; staging gets
  true only from its own `terraform.tfvars`, which is not tracked, so the
  line must be added there by hand.
- **6.6:** The two new output keys sit in their own commented group, so
  `terraform fmt` does not re-align the other lines.
- **6.9:** The register step stops with a clear error when
  `ECS_MIGRATE_TASK_FAMILY` is empty. If the role check fails, the new
  version is already serving, as intended; the error says so, and that exit
  1 means the update was allowed.
- **Order before the first deploy that carries this:** add `classes = true`
  to staging's `terraform.tfvars`; from a clean checkout of the commit being
  deployed, `plan` and `apply` in `envs/staging`; copy
  `github_environment_variables` into the staging GitHub environment again;
  deploy; run the demo seed. Between the apply and the deploy, run no
  one-off task from the API family: until the deploy creates `elevate_api`,
  its newest revision connects as a user that does not exist. Production
  follows after the staging rehearsal.
- `infra/README.md`'s reset and seed examples still name the API family; the
  reset must now run from the migrate family. That is entry 7.4.

**Ends with:** Terraform validated and the workflow linted, both through
Docker. Nothing is applied to AWS and no deploy branch is pushed in this
phase.

#### 6.1 `infra/terraform/modules/environment/database.tf` (Modify)

- **Change:** Add `random_password.api_db` with `length = 32` and `special =
  false`, as `random_password.db` has, and a local `database_url_api`, built
  like `database_url` with the user `elevate_api` and that password.
- **Why:** The restricted user's credential. The connection string is built
  without URL-encoding, so the password must have no special characters.

#### 6.2 `infra/terraform/modules/environment/params.tf` (Modify)

- **Change:** Add two `SecureString` parameters beside
  `aws_ssm_parameter.database_url`: `aws_ssm_parameter.database_url_api` at
  `${local.param_prefix}/DATABASE_URL_API`, and
  `aws_ssm_parameter.api_database_password` at
  `${local.param_prefix}/API_DATABASE_PASSWORD`.
- **Why:** Task definitions read secrets from SSM. The execution role already
  reads every parameter under that prefix, so it needs no change.

#### 6.3 `infra/terraform/modules/environment/api.tf` (Modify)

- **Change:** Add `CLASSES = tostring(var.classes)` to `api_environment`. Set
  the API task's `DATABASE_URL` secret to `database_url_api` when
  `var.api_uses_restricted_database_user` is true, else to `database_url`. Add
  `aws_ecs_task_definition.migrate`, family `${local.prefix}-migrate`, with
  the API task's sizing, roles, runtime platform, image and log
  configuration, the same container name `local.api_container`, no port
  mappings, the environment `API_DATABASE_USER = "elevate_api"` only, and the
  secrets `MIGRATION_DATABASE_URL` (the owner parameter) and
  `API_DATABASE_PASSWORD`.
- **Why:** The owner credential lives only on the migration task. `migrate.js`
  and `reset-schema.js` read only those three values. Keeping the container
  name means the workflow's image swap and log stream name work for both
  tasks.

#### 6.4 `infra/terraform/modules/environment/iam.tf` (Modify)

- **Change:** In the deploy role's `EcsRunMigration` statement, add the migrate
  task family to `resources`.
- **Why:** Today the deploy role may run only the API task family, so the
  migration task could not be started.

#### 6.5 `infra/terraform/modules/environment/variables.tf` (Modify)

- **Change:** Add `variable "classes"` (boolean, default false) and `variable
  "api_uses_restricted_database_user"` (boolean, default true).
- **Why:** The feature setting, and the way back for the database user split.

#### 6.6 `infra/terraform/modules/environment/outputs.tf` (Modify)

- **Change:** Add to `github_environment_variables`: `ECS_MIGRATE_TASK_FAMILY`
  and `API_USES_RESTRICTED_DATABASE_USER` (`"true"` or `"false"`).
- **Why:** The workflow reads both from the GitHub Environment.

#### 6.7 `infra/terraform/envs/staging/main.tf` and `infra/terraform/envs/production/main.tf` (Modify)

- **Change:** In each, declare `classes` and
  `api_uses_restricted_database_user` and pass both to the module.
- **Why:** Each environment sets its own values for the two variables.

#### 6.8 `infra/terraform/envs/staging/terraform.tfvars.example` and `infra/terraform/envs/production/terraform.tfvars.example` (Modify)

- **Change:** Staging: `classes = true`. Production: a commented `classes =
  false` with a note that Part 2 turns it on. Both: a commented
  `api_uses_restricted_database_user = true` with a note that false is the way
  back.
- **Why:** The examples document each setting.

#### 6.9 `.github/workflows/deploy.yml` (Modify)

- **Change:** Add `ECS_MIGRATE_TASK_FAMILY` and
  `API_USES_RESTRICTED_DATABASE_USER` to the job's environment, both from
  `vars`. In "Register the task definition", run the same describe, jq and
  register sequence a second time for `$ECS_MIGRATE_TASK_FAMILY` and output its
  ARN as `migrate_arn`. In "Run database migrations", set `TASK_DEFINITION` to
  that ARN and keep the command override `["node", "dist/migrate.js"]`. After
  "Roll the service", add a step "Check the API's database user", run only when
  `API_USES_RESTRICTED_DATABASE_USER` is `'true'`: it runs the new API task
  revision once with the command `["node", "dist/check-api-role.js"]`, waits,
  prints its log, and fails the job on a non-zero exit code, using the same
  commands as the migration step.
- **Why:** Migrations must run with the owner credential, which the API task
  no longer has, and each deploy should confirm the database still refuses a
  change to attendance rows. The deploy role may already run the API task
  family.

### Phase 7: Documents

**Ends with:** `npm run lint` passing.

**As built.** Where the documents follow the build, not the entry:

- **7.1:** `docs/spec.md` also gains short Class and Attendance entries in
  "Data Model".
- **7.4:** The first deploy follows Phase 6's order. Running
  `check-api-role.js` is not a separate step, because the deploy runs it;
  the README says how to run it by hand. The way back, setting
  `api_uses_restricted_database_user` to false, also needs the GitHub
  variables copied again before the deploy, or the deploy still runs the
  check and fails. The README notes that the demo class has no venue
  position until its instructor sets one.

#### 7.1 `docs/spec.md` (Modify)

- **Change:** Add a dated product decision, in the style of the 2026-11-11
  entry, stating that class scheduling and attendance are in scope in three
  parts, with a link to this design. In "Data Model", say attendance lives in
  `attendance_events` and that `mode` and `attendance_records` are superseded.
  In "Out of Scope", remove "class scheduling, QR/GPS attendance" and leave
  the rest of that item.
- **Why:** The spec contradicts this design.

#### 7.2 `docs/adr/012-class-records-and-attendance.md` (Create)

- **Change:** Record: a class enrollment is its own row; existing learner
  reads go through the `self_paced_enrollments` view; attendance is
  insert-only events with a restricted database user, and what that does and
  does not cover; coordinates live in a side table; the code is derived, not
  stored; and the rule that no version older than this release may be
  deployed once a class has been sold.
- **Why:** Later designs must not undo these by accident.

#### 7.3 `AGENTS.md` (Modify)

- **Change:** Add to "Rules": only `attendance.service.ts` inserts into
  `attendance_events` and `attendance_event_locations`, and nothing updates or
  deletes `attendance_events`; a learner-facing read of an enrollment goes
  through `deps.learnerDb`, whose `enrollments` is the self-paced view; a
  lookup of a class for Teach goes through `ClassesService.load`, which filters
  by the actor's profile and answers 404 when no row matches; the API runs as
  a database user that cannot own tables, so anything needing the owner runs
  from the migration task. In the existing rule that says Teach capabilities
  come from the route table in `docs/designs/teacher-profiles.md`, add that
  the class routes and their capabilities are in this design.
- **Why:** The repo's rules are enforced by being written here.

#### 7.4 `infra/README.md` (Modify)

- **Change:** Describe the two database users; the migration task definition
  and that `migrate.js`, `reset-schema.js` and nothing else run from it;
  `check-api-role.js` and its three exit codes; the `classes` and
  `api_uses_restricted_database_user` variables; the five-step first deploy,
  including copying the GitHub variables again; that the demo seed creates a
  fresh demo class when the last has ended and tops up a current one, so a
  second run adds no class within one class's dates; and how to pass
  `SEED_CLASS_LEARNER_EMAILS` to the seed task.
- **Why:** Operators run one-off tasks from these notes.

### Verification Plan

- **Compilation/Build**: `npx turbo run typecheck build`.
- **Unit Tests**: `npx turbo run test`, which runs the core, db, i18n, API and
  learner suites. The API suite runs as the restricted database role.
- **Static Analysis & Linting**: `npm run lint` (Biome, which also checks
  Markdown) and `npm run check:dupes` at the root; `npx expo-doctor` inside
  `apps/learner`.
- **Terraform**: from `infra/terraform`, `docker run --rm -v "$PWD":/w -w
  /w/envs/staging hashicorp/terraform:latest init -backend=false`, then the
  same with `validate`; repeat for `envs/production`.
- **Workflow**: from the repo root, `docker run --rm -v "$PWD":/repo -w /repo
  rhysd/actionlint:latest`.

**Goals and what proves them**

| Goal                                                        | Proved by                                                                                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An attendance record that can be audited                    | `check-in.test.ts`, `attendance-corrections.test.ts`, `api-role.test.ts`, `class-guards.test.ts`, the suite running as the restricted role, and the workflow's check step after each deploy |
| A class is its own enrollment, existing behaviour unchanged | The existing API tests passing in Phase 1; `class-entitlement.test.ts`                                                                                                                      |
| A class enrollment opens no self-paced content              | `class-entitlement.test.ts`                                                                                                                                                                 |
| The previous API version keeps working                      | By hand: staging step 12, after the forced rollback                                                                                                                                         |
| No route creates a class enrollment                         | `class-guards.test.ts`, which fails if any API file sets `classId` on an enrollment. It is a text match.                                                                                    |
| A profile can set up a class                                | `classes.test.ts`; walkthrough step 1                                                                                                                                                       |
| Check in without installing anything                        | `check-in.test.ts`, learner `check-in.test.tsx`; walkthrough steps 4 to 6                                                                                                                   |
| Location is evidence and never blocks                       | `check-in.test.ts`, core `attendance.test.ts`                                                                                                                                               |
| The class does not wait on the instructor                   | By hand: staging step 11                                                                                                                                                                    |
| The instructor can correct the record                       | `attendance-corrections.test.ts`, core `attendance.test.ts`                                                                                                                                 |
| The roster screen shows when it is out of date              | By hand: walkthrough step 2. The portals have no automated tests.                                                                                                                           |
| A deploy during a class does not break check-in             | `class-code.test.ts` (two apps, one database); staging step 10                                                                                                                              |
| Support can read one block                                  | `support-classes.test.ts`; walkthrough step 9                                                                                                                                               |
| The check-in mix is visible                                 | core `attendance.test.ts`; walkthrough step 8                                                                                                                                               |

**Local walkthrough**, after Phase 5. Run the API, the two portals and the
learner web app locally with `CLASSES=true` and `npm run db:seed`, between
08:30 and 17:30 Singapore time so the demo class has an open block. Sign-in
codes come from the API log. Use one browser profile per person.

1. As the demo owner in Teach, create a class with three blocks and publish
   it. Expect it listed as published. As a Support agent, expect "class
   created" and "class published" on the Support audit page.
2. As `writer@example.com`, open the demo class's current block. Expect a
   roster of 20 learners, all "Not arrived", and "updated N s ago". Stop the
   API process; expect "not updating" within 10 seconds. Start it again.
3. Press "Open code screen". Expect "Set the venue location first". Press "Set
   the venue location here" and allow location; expect the code and QR.
4. In a browser on the same machine, signed in as `learner@example.com`, open
   the QR link's address and allow location. Expect "You are checked in" and
   the roster row turning "Present" within 5 seconds.
5. In a signed-out browser, open the same address. Expect the two choices.
   Take "Sign in here" as `class-learner-01@example.com`, refuse location, and
   type the code. Expect "You are checked in" and a roster row "Present,
   flagged: location refused".
6. As `class-learner-02@example.com`, type a code that was showing three
   minutes earlier, five times. Expect "That code has expired. Type the code
   showing now." each time, with attempts left falling from 4 to 0. Type it a
   sixth time; expect "Too many wrong codes" and, on the roster, "too many
   wrong codes".
7. As `writer@example.com`: overturn the flagged check-in from step 5; expect
   "Overturned". Mark `class-learner-03@example.com` by hand; expect "Present,
   marked by hand". As that learner, open the class and press "This was not
   me"; expect the mark shown as disputed. As the demo owner, void it; expect
   "Mark voided".
8. Open the class page in Teach. Expect the block's check-in mix to read:
   enrolled 20, self check-in 1, flagged from the app 0, flagged other 0,
   overturned 1, marked by hand 0, not arrived 18.
9. As a Support agent, open the class and the block. Expect coordinates for
   `learner@example.com`, the overturn and the manual mark listed, and no
   action that changes anything.

**Rollout and rehearsal on staging**, after Phase 7 and with the author's
go-ahead. Staging is on the private network, so each phone must be on it.

10. Do the five-step first deploy. Expect the workflow's check step to pass.
    Then, with the code screen open and four seeded learners signed in, deploy
    a commit that changes nothing and have the learners check in one at a time
    while the service rolls. Expect every check-in to succeed and the code
    screen never to show "offline".
11. Run the demo seed with 20 testers' addresses in
    `SEED_CLASS_LEARNER_EMAILS`. With all 20 signed in beforehand, in the app
    or a browser, start a block and time it. Pass: all 20 present within five
    minutes and no form filled in by the instructor. On one phone with a
    build of this release installed (`eas build --profile preview`), signed
    out of the browser, scan the QR and take "Open the Elevate app"; expect
    the app's check-in screen, and after typing the code a row flagged
    "checked in from the app, no location".
12. Push a throwaway commit to the staging branch whose server exits with an
    error at start. Expect the deploy to fail and ECS to keep the previous
    revision. With that previous version serving, open My Learning, the course
    page and a lesson as `learner@example.com`; expect no change from before
    the release. Revert the commit.
13. Rehearse the way back: set `api_uses_restricted_database_user` to false,
    apply, copy the GitHub variables, and deploy. Expect the check step to be
    skipped, and `check-api-role.js` run by hand to exit 1. Set the variable
    back to true, apply, copy the variables, and deploy; expect the check step
    to pass.

---

_Drafted with EGM_
