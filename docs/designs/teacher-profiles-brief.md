# Teacher profiles separate from users

* **Author:** sky
* **Date:** 2026-11-11
* **Status:** two Goldfish review rounds done. The nine blocking decisions from the second round
  are decided by the author. The author confirmed production holds no real data. The design is
  [teacher-profiles.md](teacher-profiles.md); decisions changed during
  drafting and review are listed at the end of this brief.

## Overview

Today a teacher on Elevate is a user. The teacher profile row uses the user's ID as its key. Courses
and payments point at that user. The Stripe payout account, commission rate and approval status all
sit on that one row.

The first build gives the teacher profile its own ID. Users join a profile through a membership with
a fixed role. It adds:

- **Two profile types:**
  - *Personal:* paid through an individual or sole-proprietor Stripe account. It cannot be handed
    to another person.
  - *Corporate:* for a separate legal entity registered with ACRA (a private limited company or an
    LLP, even with one director), paid through a company Stripe account.
- **A payout account record,** separate from the profile, stored on every payment.
- **Invitations,** so an owner can add helpers.
- **A Support check** on corporate profiles.

Promotion from personal to corporate, ownership transfer, custom roles and Google and Apple sign-in
are later briefs. The first build's data model must not block them.

No specific teacher or organisation has asked for this yet. Corporate profiles are in the MVP as a
market requirement (author's product decision, 2026-11-11); the rest is built before launch to
avoid migrating live data later.

## Analysis

Two rounds of seven independent reviewers read the concept against the code. Code references come
from the reviewers. Every statement about how Stripe or ACRA behave is an assumption until tested.

### Payout accounts and money

- **Today payments do not record which Stripe account was paid.** Earnings, reconciliation, the
  Support ledger and first-payout analytics all group by teacher.
  - Earnings and reconciliation: `apps/api/src/services/earnings.service.ts:49-51, 106-108, 138-157`.
  - Support ledger: `apps/api/src/services/transactions.service.ts:280-309`. It does not call
    Stripe; it shows the current account ID beside the total.
  - Analytics: `apps/api/src/services/payments.service.ts:344-358`.
- **To support promotion later without rework,** these must group by payout account from the first
  build. Reconciling per account already fits `listTransferAmountCents(account)` in
  `apps/api/src/providers/payments/stripe.ts:175-184`.
- **A profile will hold two accounts during promotion.** The Stripe account ID cannot stay a unique
  column on the profile (`packages/db/src/schema/teachers.ts:24`).
- **Checkout does not keep the payee.** The destination is fixed when the checkout starts
  (`payments.service.ts:197`). Fulfilment reads the teacher from the course at the time payment
  completes (`payments.service.ts:288`). A purchase that straddles an account switch would be
  credited to the wrong account.
- **The checkout idempotency key** (`stripe.ts:107`) does not include the destination. Assumption:
  Stripe rejects or replays a reused key with a different destination.
- **Refunds already work by payment, not by account,** using `reverse_transfer` (`stripe.ts:157-173`).
  Only `super_admin` can refund (`apps/api/src/routes/support.ts:121-126`). Today only the learner is
  emailed. Assumption: because accounts are created with the platform covering losses
  (`stripe.ts:41`), the platform covers a reversal on an empty account.
- **Stripe link webhooks** (`apps/api/src/services/connect.service.ts:87-100`) must match on the
  payout account table and keep updating retired accounts.

### Permissions

- **Authorization today is one global `teacher` role plus "is this my user ID".** 23 of the 25
  routes in `apps/api/src/routes/teach.ts` need the role. The role is granted on approval and never
  removed. An invited writer never applies, so the Teach portal would send them to the application
  page (`apps/teach/src/routes/gate.tsx:14-21`).
- **Writers could change live courses with no review.** Live courses are editable
  (`apps/api/src/services/courses.service.ts:24`), and lesson, artefact and quiz edits apply at once.
  The safeguard "a course goes live only through Support approval" does not cover later edits.
- **Price and content are saved by one route** (`courses.service.ts:245-263`). Writers cannot change
  prices, so this needs a per-field check or a separate route.
- **Lesson and artefact routes carry no course or profile ID** (`teach.ts:139-225`). Each must prove
  the resource belongs to the profile in the URL.
- **Staff bypass is inconsistent.** `super_admin` passes every role check
  (`apps/api/src/middleware/auth.ts:40-43`), and `support_agent` passes course ownership
  (`courses.service.ts:191`).
- **"Only the owner controls payouts" is limited to what Elevate does.** Elevate only creates links
  to Stripe's own dashboard (`connect.service.ts:53-62`). Assumption: who can log in to that dashboard
  is decided by the email and phone Stripe holds. Elevate sessions last 30 days and renew on use
  (`apps/api/src/services/auth.service.ts:19, 192-196`).
- **Exactly one owner** cannot be enforced with an index on memberships alone; that gives "at most
  one". A required owner column on the profile gives exactly one with no trigger.

### Corporate profiles

- **The two definitions in the earlier brief disagreed.** "Multi-person organisation" and "separate
  legal entity" place a one-director private limited company differently. Partnerships fit neither.
- **The code cannot create a company Stripe account.** The account type is fixed to individual
  (`stripe.ts:36-49`). The provider interface and its three implementations need a business-type
  input. Account creation also uses the user's email and user ID.
- **Automated tests prove nothing about company onboarding.** The fake payment provider enables any
  account in one call (`apps/api/src/providers/payments/fake.ts:64-85`).
- **What an Elevate-side check adds.** Stripe verifies the company behind the account. Nothing
  compares that company with the one Elevate recorded, or proves the Elevate user may act for it.
  Elevate keeps only three yes/no flags from the Stripe account
  (`apps/api/src/providers/payments/types.ts:1-6`).
- **Sign-in is by emailed link,** so Support has no proof the Elevate user is the person named on
  the registry document.
- **The display name is freely editable** (`apps/api/src/services/teachers.service.ts:113-121`). A
  verified name can be changed afterwards.

### Invitations

- **An invited email with no account is not a special case.** Sign-in already creates a user for an
  unknown email (`auth.service.ts:140, 154-166`) and can carry a redirect path.
- **An invitation cannot be a sign-in link.** Sign-in links last 15 minutes; an invitation must last
  days. It needs its own table.
- **Reusable parts:** token hashing, the email template with a button
  (`apps/api/src/emails/templates.ts:55-67`), the mailer and the rate limiter.
- **Matching the accepting account's email to the invited email** is simplest today. Assumption:
  Apple sign-in can hide the email behind a relay address, which will break a strict match once the
  sign-in brief lands.

### Other parts of the code the build touches

- **Media is owned by the uploading user** (`packages/db/src/schema/media.ts:10-12`), with access
  checked by user (`apps/api/src/services/media.service.ts:192-199`). Teaching samples are uploaded
  before a profile exists, and learner avatars use the same table.
- **The catalogue shows the user's avatar** (`apps/api/src/services/catalog.service.ts:173-180`). A
  corporate profile has no image of its own.
- **Emails go to the teacher as one user.** Courses do not record who submitted them.
- **The audit log has no profile column** (`packages/db/src/schema/system.ts:21-33`). Price changes
  and Stripe link requests are not audited. Unmatched webhooks are not stored.
- **The signed-in user is rebuilt on every request** (`auth.service.ts:198, 206-230`), so a removed
  member loses access on their next request without any session change.

### Wipe and reseed

The decision stands, but it cannot be run today:

- The reset script refuses to run in production mode (`packages/db/scripts/reset.ts:4-5`), which both
  environments use.
- The API image has no seed entry point (`apps/api/Dockerfile`).
- The database is reachable only from the API task.
- The seed writes thumbnails to local disk, not S3 (`packages/db/src/seed/index.ts:94-110`).
- Deploy runs migrations only (`.github/workflows/deploy.yml:84-89`).
- `infra/README.md:187-189` promises additive migrations and rollback by `git revert`. A wipe breaks
  that promise.
- A wipe leaves Stripe accounts, Mux videos and S3 files with no database rows. Their webhooks will
  arrive unmatched; the code tolerates that.

### Ideal final result

Every sale permanently names the payout account that was paid. Promotion and ownership change later
become a switch of the active account that no learner can observe.

## Goals vs. Non-Goals

* **In-Scope Goals (first build), in three slices that each leave a working system:**
  1. **Structure.** The product behaves as today after this slice.
     * Profile with its own ID; courses and payments point at it.
     * Owner column on the profile.
     * One permission function and capability table in `packages/core`, used by every Teach route.
     * The global `teacher` platform role removed.
     * Payout account record, stored on every payment and every checkout.
     * Money queries grouped by payout account.
     * Profile ID in the Teach URL.
     * Support pages keyed to the profile.
     * Migrations squashed into a fresh `0000`; staging and production schemas dropped and
       reseeded.
  2. **Helpers.**
     * Writer role and invitations.
     * Member management screens.
     * Media owned by the profile.
     * Price and submit separated from content editing.
     * Writer edits to live courses held as a change set until an owner or manager approves.
  3. **Corporate.**
     * Corporate type and legal-entity record.
     * Self-serve corporate application and its Support review queue.
     * Company Stripe account creation.
     * The Support entity check and the Stripe legal-name comparison.
     * The manager role.
  * **Across slices:** owner recovery by `super_admin`; `super_admin` acting inside Teach as a
    profile, audited; staff barred from Stripe links.
* **Out-of-Scope Non-Goals:**
  * Promotion from personal to corporate (later brief).
  * Ownership transfer, beyond a Support recovery action (later brief).
  * Custom roles (later brief).
  * Google and Apple sign-in (later brief). Company single sign-on into Teach.
  * Automated ACRA or Singpass lookup.
  * Several profiles per legal entity; per-course writer permissions; per-course instructor credit.
  * Dispute handling, GST and invoicing.

## Alternatives Weighed

- **Company single sign-on for Teach.** Rejected by author: members sign in with their own accounts.
- **Enterprise single sign-on (SAML) for Support.** Rejected by author: one staff member on Google
  Workspace; Google sign-in restricted to the Workspace domain does the same job.
- **Acting profile stored in the session.** Rejected by all reviewers: two browser tabs would act on
  the wrong profile.
- **Course-level collaborators, keeping the user as the teacher.** Rejected: cannot express a company
  owning courses.
- **Custom roles in the first build.** Deferred by author: no user has asked. Checks written against
  named capabilities make them a data change later.
- **Owner as a membership row.** Rejected in favour of an owner column: a row gives "at most one
  owner" and needs a trigger for "exactly one".
- **Promotion mechanisms** (for the later brief):
  1. Payout account as its own record; promotion switches the active one. Chosen by author.
  2. New corporate profile, courses moved. Not chosen. Under "earnings follow the account" it leaves
     the same records as option 1.
  3. Disconnect first, then re-approve. Rejected: the profile cannot sell while it waits, and old
     sales stop reconciling.
  4. Support handles promotion by a written procedure. This is the situation until the promotion
     brief is built, not a rejected option.
- **Payout account held by the person or legal entity, not by a profile.** Raised by two reviewers.
  The original person would reach the old account's history as its holder, with no extra personal
  profile created. Not chosen: the author decided the person gets a new personal profile. The
  promotion brief may revisit it.
- **Deferring the corporate type.** Raised by reviewers: it could be a single column now. Rejected by
  author: corporate profiles are a market requirement for the MVP. The corporate work is kept as
  the third slice, built before launch.

## Key Decisions & Staging for Next Steps

### Decided by the author

- Build the profile model first; sign-in follows in its own brief.
- Roles are fixed: owner, manager (corporate profiles only), writer. Custom roles are deferred.
- Personal profiles accept writers only. Sole proprietors use personal profiles.
- Writers cannot change prices, submit a course for review, or see earnings.
- Only the owner can request Stripe links or start onboarding a payout account. "Payout details"
  means exactly this.
- Corporate profiles and invitations are in the first build.
- Staging and production are wiped and reseeded; no data migration keeps old rows.
- For the later promotion brief:
  - Only Support can promote.
  - The company account onboards while the personal account keeps taking payments. The individual
    may be paid during that overlap.
  - Earnings follow the payout account. The promoted profile starts with an empty earnings history.
    The original person gets a new personal profile holding the old account and its history.

### What the first build's data model must allow, so promotion needs no rework

Revised during design review (2026-11-11, author's choice). The first build keeps what would be
costly to add after launch and leaves additive changes to the promotion brief.

**Built now:**
- A payout account is its own record, one per profile in this build.
- A payment stores its payout account permanently, plus the profile at the time of sale for audit.
- Earnings, reconciliation and the Support ledger select payments by payout account.
  First-payout analytics is counted per profile.
- Payout account states are onboarding and active.
- No database rule ties the account's business type to the profile type, because the promotion
  overlap breaks such a rule.
- One user may own more than one profile.
- Per-course revenue is built from payment rows filtered by payout account, not from the courses a
  viewer owns. Each payout account records when it became active.

**Left to the promotion brief, each an additive change:**
- a `retired` state, with retired accounts still receiving webhooks;
- a payout account's link to its profile becoming changeable;
- more than one account per profile, with at most one active;
- the profile type becoming changeable (it is fixed in this build).

### Decisions from the second review round

1. **Corporate means (decided by author):** a separate legal entity registered with ACRA, such as a
   private limited company or a limited liability partnership, even with one director. General
   partnerships and foreign entities are refused in the first build. This replaces "multi-person
   organisation", which left a one-director company with no valid profile type.
2. **Corporate profiles are self-serve (decided by author).** A signed-in user fills in a corporate
   application in Teach and becomes the owner. Support reviews it in a queue, as with teacher
   applications today. A user who already owns a personal profile may also apply for a corporate
   one. Rejected by author: Support-only creation, with or without a request form. Cost accepted: a
   corporate application form and a Support review screen are built with no organisation yet asking.
3. **Order of checks for a corporate profile (decided by author):**
   1. The applicant submits a corporate application: UEN, legal name and registry document, plus
      the bio, credentials and teaching sample of the person who will teach.
   2. Support reviews teaching quality and the entity in one review, and approves or rejects.
   3. The approved owner onboards the company Stripe account. This keeps today's rule that
      onboarding needs approval (`connect.service.ts:23-24`).
   4. Support confirms the company Stripe verified is the one Elevate recorded. Only then does the
      company payout account become active and courses become purchasable.

   Rejected by author: trusting Stripe with no comparison afterwards; and Stripe onboarding before a
   single combined review. Cost accepted: Support handles each corporate profile twice, and an
   applicant can be refused at step 4 after finishing Stripe onboarding.
4. **The Support entity check verifies (decided by author, lighter version):**
   - At the combined review: the UEN and legal name on the application match the uploaded registry
     document, and no other profile holds the same UEN.
   - At the Stripe comparison: the company on the Stripe account has the same legal name. Elevate
     reads the name from Stripe and shows it beside the recorded one; when Stripe returns no name,
     Support compares in the Stripe dashboard. (Changed by author during drafting; this first said
     dashboard only.)

   Any Support staff (`support_agent` or `super_admin`) performs the check. (Changed by author
   during drafting; this first said `super_admin` only.) States: pending, verified, rejected with a reason. The
   registry document is stored as a private `document` media file readable by Support.

   Dropped by author: the three-month age limit on the document, the check that the applicant is
   an officer of the company, and Support approval of name changes. Risks accepted:
   - An old registry document can be used for a company that has since been struck off.
   - Anyone who holds a company's registry document can apply as that company. Stripe onboarding
     and the legal-name comparison are the remaining safeguards.
   - After verification the public name can be changed freely, so it can drift from the verified
     legal name. Name changes are recorded in the audit log.
   - Elevate cannot prove the signed-in user is connected to the company at all.
5. **Owner recovery (decided by author):**
   - Personal profile: never moved to another person. When the owner has lost access to their
     email, `super_admin` changes the sign-in email on the owner's own user record.
   - Corporate profile: `super_admin` can make an existing Elevate user the owner, given a written
     authorisation from a company officer.
   - Both actions are audited, and the old and new email addresses are notified.
   - Deleting a user who owns a profile is blocked.

   Risks accepted:
   - An email change is a takeover route: Support cannot reliably confirm the requester is the
     owner, and the notice to the old address helps only if it is still read.
   - Support has nothing to check an officer's authorisation against.
   - A new corporate owner in Elevate does not change the representative on the company Stripe
     account. Assumption: Stripe dashboard login follows the representative Stripe holds.

   Rejected by author: corporate-only recovery, and no recovery feature.
6. **Writers and live courses (decided by author):** a writer's edits to a live course are held
   until the owner or a manager approves them. Owners and managers still edit live courses directly,
   as teachers do today. Rejected by author: barring writers from live courses, and letting writers
   edit live courses with only an audit trail.

   Cost accepted: the first build stores a draft copy of course content beside the live content,
   plus a screen to review and approve it. This belongs in slice 2 (Helpers) and is its largest
   item. Proposed defaults for the draft to confirm:
   - One pending change set per course, holding all of a writer's edits to lessons, artefacts and
     quizzes. Approval applies the whole set; rejection discards it.
   - If the live course changes after the change set was started, approval shows the conflict and
     the approver chooses, rather than merging automatically.
   - Quiz changes apply only to attempts started after approval.
   - Approved changes do not go back to Support review, matching how owner edits work today.
7. **What Support staff can do (decided by author):**
   - Staff can read any profile: courses, members and earnings.
   - Staff change profiles through Support routes, such as approval, commission, owner recovery and
     the entity check.
   - In addition, `super_admin` can act inside Teach as any profile, to help a teacher directly.
   - No staff role can request Stripe links, including a `super_admin` acting as a profile.
   - Every staff action on a profile is audited, recorded under the staff member's own user ID.
   - `support_agent` loses today's ability to edit any course (`courses.service.ts:191`).

   Rejected by author: no acting inside Teach at all, and keeping today's behaviour. Proposed
   defaults for the draft to confirm:
   - Acting as a profile gives content editing and read access to the profile, its members and its
     earnings; not prices, submitting or deleting courses, change-set approval, member management,
     ownership or Stripe links. (Narrowed by author during design review, 2026-11-11.)
   - Teach shows a visible banner while a staff member is acting as a profile.
   - The permission function handles staff acting as a profile as one named case, not as a
     separate exception on each route.
8. **Invitations (decided by author):**
   - Who invites: the owner invites managers and writers; a manager invites and removes writers
     only; on a personal profile the owner invites writers only. Only approved profiles can invite.
   - Record: profile, email, role, inviter, hashed single-use token, 7-day expiry. One pending
     invitation per profile and email. Resending replaces the token. At most 20 invitations per
     profile per day.
   - Acceptance: any signed-in user holding the invitation link can accept, and the inviter is
     notified.
     - A writer invitation takes effect at once, whatever the accepting account's email.
     - A manager invitation accepted from a different email waits until the inviter confirms it.
     - This works with Apple relay addresses when the sign-in brief lands.
   - An invited email with no Elevate account is not a special case: signing in creates the user.
     An invited member needs no teacher application of their own.
   - Removal: the owner removes anyone; a member may leave; the owner cannot leave. A removed
     member's uploads stay with the profile.

   Rejected by author: strict email matching, and invitations from profiles awaiting approval.
   Risk accepted: a forwarded invitation lets whoever receives it join as a writer. Limits on the
   damage: their edits to live courses are held for approval (decision 6), new courses need Support
   approval to go live, and the inviter is notified and can remove them.
9. **Wipe and reseed mechanism (decided by author):**
   - All migrations are squashed into a fresh `0000`.
   - In each environment, a one-off task drops and recreates the database schema, then the normal
     deploy applies the new `0000`. The task needs direct database access, which today only the
     API task has, so it runs as an API-image task with a separate command.
   - A seed entry point is added to the API image and run as a one-off task. Staging gets the demo
     seed; production gets the super admin only.
   - The seed must write thumbnails to S3, not local disk, before the staging demo seed is useful
     (`packages/db/src/seed/index.ts:94-110`).
   - This change is roll-forward only. `infra/README.md` is updated to say so for this one change.
   - Rejected by author: a destructive `0002` migration kept in the history.
   - Unconfirmed assumption: production holds no real data and no live-mode Stripe accounts. Confirm
     before running the drop. If live-mode accounts exist, close them in Stripe first.

### Also to settle in the draft (not blocking)

- **Refund notices:** for every refund, the holder of the paying account and the owner of the
  course's profile are emailed.
- **New personal profile after promotion:** inherits "approved", since the person was already
  reviewed. Support can see its earnings.
- **Email recipients:** the owner always; managers also get course-review emails.
- **Corporate profile image:** the profile gets its own image; the catalogue stops falling back to
  the user's avatar.
- **Audit:** price changes and Stripe link requests are recorded. Audit entries carry a profile ID.
- **Stripe link safety:** links need a sign-in within the last day (measured from the session's
  creation, which is the sign-in time), and each link request emails the owner.
- **Tests:** a role-by-route table, cross-profile access, a checkout that straddles an account
  switch, reconciliation per account, the invitation lifecycle.
- **Documents:** amend `docs/spec.md` (lines 3, 20, 30, 39, 40, 48, 49, 69) and ADR 003. Add one ADR
  for profiles and memberships, and one for payout accounts.

### Stripe tests in test mode before the first build

All are assumptions until tested:

- A Singapore company account can be created with the same settings as individual accounts, and
  hosted onboarding collects the company and its representative.
- One person or email can hold two connected accounts.
- The dashboard login link works for company accounts, and who it lets in.
- The company name can be read from the account.

### Stripe tests before the promotion brief

- Whether open checkouts can be expired.
- Where a reversed transfer lands on an empty account.

## Changes during drafting and review

Decided by the author on 2026-11-11, after this brief was written. The design
([teacher-profiles.md](teacher-profiles.md)) is the current source.

- **Corporate profiles are a market requirement for the MVP.** This is the reason they are not
  deferred. No specific company has asked yet.
- **Entity and legal-name checks:** any Support staff (`support_agent` or `super_admin`) runs them,
  not `super_admin` only. The legal name is read from Stripe and shown beside the recorded one;
  Support falls back to the Stripe dashboard when Stripe returns no name.
- **Payout accounts:** one reusable account per profile in this build; `retired` and movable
  accounts are left to the promotion brief (see the revised list above).
- **Writer edits to live courses:** kept as change sets, with an explicit approval procedure that
  rewrites draft IDs to live IDs before deleting drafts.
- **Staff acting in Teach:** narrowed to content editing and read access (decision 7).
- **ADRs:** two, one for profiles and one for payout accounts.
- **Course-review emails:** to the owner and every manager.
- **Refunds made in the Stripe dashboard** email the learner and the profile owner, the same as a
  Support refund.
- **A rejected corporate application** can be edited and resubmitted by its owner; the UEN stays
  with that profile.
- **Role changes** (writer to manager and back) are made by the owner only, on corporate profiles.
- **Unapproved profiles** (applied or rejected) give their owner and members only read and edit of
  the profile itself, as applicants have today.
