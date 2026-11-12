# ADR 006 — Teaching profiles are their own record, with roles and one permission check

**Status:** accepted · 2026-11-12

The design, its alternatives and the step-by-step plan are in
[`docs/designs/teacher-profiles.md`](../designs/teacher-profiles.md). This record keeps the
decisions.

## Decision

- **A teaching profile is separate from the users who run it.** `profiles` replaces
  `teacher_profiles`. Courses, payments and course media point at a profile, never at a user.
  A profile is `personal` (an individual or sole proprietor) or `corporate` (a registered company).
- **The owner is a column, not a membership row.** `profiles.owner_user_id` is required and its
  foreign key restricts deletion, so a profile always has exactly one owner and a change of owner
  is one update. A user may own many profiles, but at most one personal profile (a partial unique
  index).
- **Roles on a profile are fixed:** owner, manager (corporate profiles only) and writer. Managers
  and writers are membership rows. Platform staff acting inside a profile are a fourth actor,
  `staff`, which is never stored on a profile.
- **Teaching is not a platform role.** `user_roles` holds only `support_agent` and `super_admin`.
  A teacher is whoever owns or belongs to a profile; the signed-in user carries `profiles`, the
  list of profiles with the user's role on each.
- **One permission check decides every Teach action.** `packages/core/src/domain/permissions.ts`
  holds the list of capabilities, the table from role and profile type to capabilities, and
  `can(actor, capability)`. The API enforces it; the Teach portal uses the same function to hide
  what the API would refuse. Until Support approves a profile, its owner and members can only
  read and edit the profile.
- **The profile is in the URL.** Every Teach route is `/teach/profiles/:profileId/...` in the API
  and `/p/:profileId/...` in the portal. `requireProfile` resolves the caller to an actor once per
  request. Every lookup of a course, lesson or artefact filters by the profile in the same query,
  and a profile or resource the caller cannot reach answers 404.
- **Staff act as a named role, and every change is recorded.** A `super_admin` opening a profile
  in Teach gets the `staff` actor: they can fix content and read the profile, and cannot set
  prices, publish, manage members or request Stripe links. Each change they make writes an audit
  entry under their own user ID with the profile ID, and Teach shows a banner.
- **Members join by invitation.** The owner invites writers and, on a corporate profile,
  managers; a manager invites writers. The emailed link holds a token that is stored only as a
  keyed hash and works for 7 days. Anyone who signs in can accept a writer invitation; a manager
  invitation accepted from another address waits for the owner to confirm. Each email sent is a
  row, and a profile may send 20 in any 24 hours, counted in the database.
- **A writer's edits to a live course are held for approval.** The first edit copies the course's
  lessons, artefacts, quizzes and prerequisite links into draft rows (a change set, one open per
  course), and the writer edits the copies. Approval by the owner or a manager applies all of it
  or none of it, and live rows keep their IDs, so learner progress and quiz attempts stay attached.
  Where the live course was changed in the meantime, the two versions are not merged: the approver
  picks one for each clash. Course details and price are not part of a change set.
- **Learners read live rows only, by construction.** Four database views leave the draft rows
  out, and learner-facing services read course content through a second database client
  (`learnerDb`) that knows the content only by those views. A test reads the source and fails if
  any file but the two that manage drafts touches the raw tables.
- **Course media belongs to the profile.** Everyone on the profile can use it whoever uploaded it,
  someone who has left cannot, and it cannot be put on another profile's course.
- **Drizzle is pinned to `1.0.0-rc.5`**, a release candidate, because relational queries over
  views need Drizzle 1.0. Both packages are pinned to the exact version and moved only on purpose.

## Built so far

Profiles, the owner column, the permission table, profile URLs, staff acting and the audit trail
are built (step 1 of the design). Memberships, invitations, held edits to live courses and
profile-owned media are built too (step 2), and so are corporate applications, the legal-name
check and owner recovery (step 3). A corporate profile always has a legal entity; the database
refuses one without.

## Consequences

- A user on two profiles cannot reach one through the other; a test calls every Teach route on
  one profile with the other profile's IDs.
- Adding a role or a capability is a change to one table in `packages/core`, and its test
  repeats the table in full. A second test calls every Teach route as each role, on a course in
  each status, and compares the answers with that table.
- Opening a change set copies the whole course. That is cheap at tens of lessons, and is the
  thing to revisit if a course grows to a few hundred items.
- An owner who edits a live course while a change set is open gets a clash to resolve for each
  item they changed, even one the writer did not touch: the draft still holds the older copy.
- Support reaches profiles directly (`/support/profiles`), and a person's page lists their
  profiles instead of holding a teacher section.
- The repo depends on a release candidate until Drizzle 1.0 is final. A move to a later version
  repeats the upgrade checks in the design (item 0.9).
- The schema change was a reset, not a migration: the two earlier migrations were squashed into
  one, and staging and production are emptied once (see `infra/README.md`).
