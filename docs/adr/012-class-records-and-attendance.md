# ADR 012 — A class is its own enrollment, and attendance is a record the API can only add to

**Status:** accepted · 2026-11-25

The design, its alternatives and the step-by-step plan are in
[`docs/designs/scheduled-classes-attendance.md`](../designs/scheduled-classes-attendance.md)
(Part 1 of scheduled classes). This record keeps the decisions.

## Context

Elevate sold only self-paced courses. A learner could hold one enrollment per course, and any
active enrollment opened the whole course. The enrollment row had a `mode` column that no code
read and an `attendance_records` list that was rewritten whole on every change, with no field for
who recorded an entry or why. A class needs a record of who attended each block that can support
a refund decision later, and a class seat must not open the self-paced course.

## Decision

- **A class enrollment is its own row.** `enrollments.class_id` is null for a self-paced
  enrollment and set for a class enrollment. Two partial unique indexes replace
  `enrollments_user_id_course_id_unique`: one self-paced row per learner and course, and one row
  per learner and class. A learner can hold both for the same course. `mode` and
  `attendance_records` stay in the schema, unused and never written.
- **Existing learner reads mean "self-paced", by construction.** The `self_paced_enrollments`
  view selects the rows where `class_id` is null, and `deps.learnerDb` binds its `enrollments` key
  to that view. Every learner read that went through the full client (the course page's
  `viewer`, certificates, `activeCourseIds`, `ensureActive`) now goes through `learnerDb`, so a
  class enrollment is not found by any existing route. Checkout's lookup by learner and course
  stays on the full client, because it writes, and adds `class_id is null` by hand; so do the
  raw-SQL counts in analytics and people, and the demo seed. Class data is served only by new
  routes.
- **Attendance is insert-only events.** Each refused attempt, check-in, overturn, manual mark,
  dispute and dispute decision is one row in `attendance_events`, with the actor, the actor's
  role at that moment, the method, the reason, and a time from the API's clock. A correction is a
  new row whose `refers_to_event_id` points at the row it corrects; partial unique indexes allow
  one check-in per block and enrollment and one row of each type per referred event. A learner's
  state in a block is worked out from the rows by `attendanceState` in `packages/core`.
  `AttendanceService` is the only code that inserts into `attendance_events` and
  `attendance_event_locations`, and no code updates or deletes `attendance_events`; a test that
  reads `apps/api/src` fails otherwise.
- **The API runs as its own database user.** `elevate_api` may select, insert, update and delete
  on every table, but not update, delete or truncate `attendance_events`, and not update or
  truncate `attendance_event_locations`. `applyApiRole` in `packages/db/src/roles.ts` creates the
  user and sets these grants in one transaction, run by `migrate.js` on each deploy. The owner's
  connection string is only on a separate migration task definition, from which `migrate.js` and
  `reset-schema.js` run. The whole API test suite runs as the restricted role, and each deploy runs
  `check-api-role.js` from the API's task definition and fails if the database allows the update.
- **Coordinates live in a side table.** A location reading's latitude and longitude are a row in
  `attendance_event_locations`, keyed by the event. The API's user may delete that row, which
  erases the coordinates and leaves the event, with its distance, accuracy and location status,
  as it was. The location flag is decided once, at check-in, against a copy of the venue stored
  on the event; a later change to the venue position does not change it.
- **The code is derived, not stored.** Each block has a random secret that no route returns. The
  code for a 60-second period is an HMAC-SHA256 of the period number under that secret: the link
  carries 20 characters of it and the typed code is the first 6. The current and the previous
  period are accepted. Nothing is stored per rotation and no job rotates anything, so any API
  process can check any code, including across a deploy.
- **One setting turns classes off.** With `CLASSES` off, `GET /me/classes` answers an empty list,
  every other class route answers 404, and the demo seed creates no class data. It is on in
  staging and off in production until Part 2.
- **No version older than this release may be deployed once a class has been sold.** The
  previous version reads enrollments without the view, so it would treat a class enrollment as a
  self-paced one and open the self-paced course to it. Until Part 2 sells a class, production
  holds no class enrollment and the previous version is safe against the new schema.

## What the database user does and does not cover

It covers a code path, now or later, that updates or deletes an attendance row, and an API
process that has been taken over: the running API holds no credential that can change the grants.
It does not cover:

- other tables, which the API's user can still update. Block times are protected only by the
  API's rule that a block with a check-in or manual mark is frozen;
- the migration task. The deploy role can run it with any command, so anyone who can deploy can
  act as the owner;
- creating tables. The grants do not refuse it; Postgres 15 and later does, because the `public`
  schema no longer lets every user create in it. RDS runs Postgres 17.

Each event copies `learner_user_id` from the enrollment when it is written, so a later change to
an enrollment's owner does not change who an event says attended.

## Consequences

- Removing `mode` and `attendance_records` waits for a release after this one is the oldest that
  can be deployed.
- A table added later gets the API user's full grants through default privileges. A table that
  must be insert-only needs its own revoke in `packages/db/src/roles.ts`.
- Code that reads enrollments through the full client is not covered by the view. A lookup by
  learner and course there must add `class_id is null`; a test calls every existing learner route
  for a learner who holds both enrollments.
- Part 2's class checkout is the first code that sets `class_id`, and must change the guard test
  that forbids it on purpose.
- A learner or instructor with attendance rows cannot be deleted from the database. An account
  deletion feature must anonymise instead.
- If the restricted user breaks a path in production, `api_uses_restricted_database_user = false`
  in Terraform puts the API back on the owner (see `infra/README.md`).
- Staging holds class enrollments from the demo seed, so a rollback there runs the previous
  version against them. That is accepted for staging only.
