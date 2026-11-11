# Stage 6: Comprehension Report

*   **Target:** `docs/designs/teacher-profiles.md` (FeatureRange 1–874, DetailedRange 875–1749)
*   **Date:** 2026-11-11
*   **Reviewer:** `egm-comprehension`, fresh context, with the document alone (no standard, no other
    files).
*   **Verdict:** the document can be understood on its own. Every section could be paraphrased, so
    there are no Blockers. 5 Major and 6 Nit findings. The Majors centre on the payout-account
    lifecycle and on how change sets apply rows that point at other rows.

## What this proposes

Teaching identity moves off the user record into a separate **profile**. A profile is either
personal (an individual, paid through an individual Stripe account) or corporate (an ACRA-registered
company or LLP, paid through a company Stripe account). Each profile has exactly one owner, held in
an `owner_user_id` column. Managers (corporate profiles only) and writers join through membership
rows. One pure `can(actor, capability)` table in `packages/core` makes every Teach permission
decision. Teach routes carry the profile ID in the URL, and a `super_admin` can act in Teach as a
"staff" actor: audited, and with no Stripe links or member management.

Each Stripe connected account becomes a **payout account**. Checkout fixes the payee in Stripe
session metadata, fulfilment copies it onto the payment, and all money views group by payout account
("earnings follow the account").

Writers' edits to live courses go into a **change set**: draft copies of the content rows. Learner
code can only read them through views that exclude drafts, enforced by a learner-only Drizzle
client, which is why Drizzle is upgraded to the 1.0 RC. The change set goes live in one transaction
when an owner or manager approves it.

Corporate profiles need two Support checks before they can sell: a combined application and entity
review, and a legal-name match against Stripe. The work is Step 0 (Drizzle upgrade), then the three
slices (Structure, Helpers, Corporate). Staging and production are reset to one squashed `0000`
migration and seeded by one-off tasks.

## How the existing system works, per this document

Today a teacher is a user. `teacher_profiles` is keyed by user ID and holds the Stripe account,
commission and approval status. Courses and payments reference the user. A global `teacher` role
plus a check that the course's teacher ID equals the user's ID guards Teach. `super_admin` bypasses
everything, and `support_agent` can edit any course.

Every Stripe account is created as an individual account, and payments do not record which account
they paid. Earnings and reconciliation therefore compare all of a teacher's payments against
whatever account the profile has now, which breaks if the account ever changes. Learner reads use
nested Drizzle 0.45 relational queries over the raw content tables. The product is pre-launch, with
a pilot of 3 to 5 freelance teachers.

## Findings

### 1. Major: the `retired` payout-account state is used but never explained

*   **Where:** section 1 (`payout_accounts.status`, changeable `profile_id`), section 4, section 6,
    Goal 5, test 1.36 (`payout-accounts.test.ts`).
*   **Finding:**
    - Goal 5 and the 1.36 test depend on a profile with one retired and one active account, and on
      "the profile switched to account B". Section 6 depends on an account "moving to another
      profile later".
    - Nothing in scope says what makes an account `retired`, who can switch a profile's active
      account, or what changes `payout_accounts.profile_id`. No route or service does it. The only
      hint is promotion, which is a Non-Goal.
    - Section 4 says onboarding creates a new account only when none is in `onboarding`. It does not
      say what happens when the owner starts onboarding while an `active` account exists: is a
      second account created, and is the first retired?
*   **Effect on the reader:** they cannot tell whether `retired` is reachable in this build or
    exists only for future promotion, or what the Goal 5 fixture stands for in practice.

### 2. Major: change-set approval does not cover prerequisites or rows that point at draft copies

*   **Where:** section 8 "Approval", 2.2.
*   **Finding:**
    - The approval rules are keyed on `source_id`: update the live row in place, promote new rows,
      delete removed rows, then delete the remaining drafts.
    - `lesson_prerequisites` gets `change_set_id`, but no `source_id` and no `removed` flag (2.2).
      Read literally, every draft prerequisite row "without a `source_id`" becomes a new live row,
      which duplicates the existing links. The document never says how removing a prerequisite is
      recorded.
    - Draft prerequisite links and draft quizzes point at the *draft* IDs of copied lessons and
      artefacts (2.2 says so for quizzes). When a draft row with a `source_id` is merged into its
      live row and then deleted, those references must be repointed to the live IDs. The document
      does not describe this.
    - The conflict check does not say what happens if an owner deletes or adds live rows while a
      change set is open.

### 3. Major: references to "the brief" that the reader cannot see

*   **Where:** line 377 ("the brief's dashboard-only comparison"), line 534 ("the brief's
    `super_admin` only"), line 729 ("The accepted risks are listed in the brief"), line 1147
    ("brief, decision 4"), line 1194 (brief "Refund notices"), line 1389 (brief "Stripe link
    safety").
*   **Finding:** the brief is never linked or identified. Line 729 is the most serious: the reason
    for rejecting Alternative L rests on accepted risks the reader cannot see, so the trade-off
    cannot be judged from this document. Decision 4, "Refund notices" and "Stripe link safety" are
    cited as reasons for concrete behaviour but not summarised.
*   **Fix suggested:** link the brief, or restate the cited decisions and risks inline.

### 4. Major: the course lifecycle (draft, live, submit, Support approval) is assumed

*   **Where:** Overview roles table, Goals 9–11, section 8, 2.9, CUJs 1–3.
*   **Finding:**
    - The change-set design turns on whether a course is "draft" or "live". Writers edit draft
      courses freely, but their changes to live courses are held. "Submit for review" and Support
      course approval also appear.
    - The document never lists the course states or says which count as "live". In particular, it
      does not say what a writer can do to a course that is submitted and awaiting Support review,
      or to one that was rejected.
    - Line 500 calls the course-details rule a "Proposed rule", while 2.9 states it as decided. It
      is unclear whether it is settled.

### 5. Major: "the later promotion overlap" is not explained

*   **Where:** line 287 ("No rule ties `business_type` to the profile's type, because the later
    promotion overlap breaks any such rule"), and "Promotion, for the later brief".
*   **Finding:** promotion is only named, as a Non-Goal, and the "overlap" is never described. The
    reader has to guess that a profile being promoted to corporate may briefly hold both an
    individual and a company account. This one sentence is the only reason given for leaving out an
    integrity rule on money records, so it needs a sentence of explanation.

### 6. Nit: "ships" and "deployed"

*   **Where:** Overview ("ships as one first build in three slices"), Goal 7 ("when this slice
    ships"), line 878 ("Nothing is deployed until step 3 is done"), line 890.
*   **Finding:** "ships" seems to mean "merged", since nothing reaches staging until step 3. Say so,
    because Goal 7 reads as a deployment checkpoint.

### 7. Nit: Singapore-specific terms are not expanded

*   **Where:** Overview, Non-Goals, 3.2.
*   **Finding:** ACRA, UEN and Singpass/Corppass are never expanded or linked. The Singapore context
    is only implied ("a Singapore company account" in Open Questions).

### 8. Nit: "Support" means both a team and an app

*   **Where:** Overview and throughout.
*   **Finding:** "Support" names both the staff team and the Support portal. Phrases like "the
    Support ledger" and "Support recovery action" leave it unclear which is meant. One line naming
    the apps (Teach, Support portal, learner app) would settle it.

### 9. Nit: recovery details differ between section 11 and 3.8

*   **Where:** section 11 and 3.8.
*   **Finding:** 3.8 revokes all of the owner's sessions on recovery; section 11 does not mention
    this. In a corporate recovery, "the owner's sessions" is ambiguous: old owner or new owner?

### 10. Nit: "first-payout analytics" is defined late

*   **Where:** Goal 5, section 6.
*   **Finding:** the metric is named before it is defined. Its definition (time from profile
    approval to the first payment) appears only in 1.22.

### 11. Nit: "artefact" is never defined

*   **Where:** throughout.
*   **Finding:** it is a project-specific word for a lesson content item and needs a one-line gloss.

--------------------------------------------------------------------------------

## Overlap with Stage 5 (Elephant note)

*   **Comprehension 1 and Stage 5 B1** reach the same gap from two directions. Stage 5 asks whether
    the `retired` state is needed at all; this stage shows that the document never says how it is
    reached.
*   **Comprehension 2 and Stage 5 C1** both find holes in change-set approval. This stage adds two
    the earlier review did not name: duplicated prerequisite links, and quiz and prerequisite rows
    left pointing at deleted draft IDs. Comprehension 2 is a correctness defect in the design, not
    only a clarity gap.
