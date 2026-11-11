# Stage 5: Initial Zoom Out Report

*   **Target:** `docs/designs/teacher-profiles.md` (lines 1–1749)
*   **Date:** 2026-11-11
*   **Reviewers:** `egm-zoom-out` (zoom-out standard) and `egm-inventive-catalyst`, each in a fresh
    context.
*   **Context given to reviewers:** `docs/spec.md`, `docs/adr/003-payments-destination-charges.md`,
    and read-only access to the repository.
*   **Verdict (zoom-out):** Needs revision, for scope. The context is judged good enough.

Both reviewers read every required file, so the review is complete. The findings are below, grouped
by topic and ranked by severity within each group. Some notes say where a finding conflicts with a
decision the author already made; these notes are the Elephant's, not the reviewers'.

--------------------------------------------------------------------------------

## A. Scope

### A1. Blocker: corporate and helpers are launch scope, but the spec says otherwise (zoom-out 1)

*   **Where:** Alternative G, "Weak points", D.2, Goals 9–14.
*   **Finding:**
    - `docs/spec.md` describes a product for *freelance* teachers (line 3) with a pilot of 3 to 5
      of them (line 73). Its MVP goal is the single-teacher money loop (lines 5–7). Nothing in it
      mentions companies, helpers or roles.
    - Alternative G says corporate is "part of the MVP's launch scope", but cites no source, and D.2
      then edits the spec to add it. The reviewer reads this as the design writing its own mandate.
    - Spec line 53 says steps 1–12 must not be thinned to pay for later work. Slices 2 and 3 compete
      with that core.
*   **Ask:** either cite the product decision that puts corporate and helpers in launch scope, or
    move slices 2 and 3 out of this design.
*   **Elephant note:** the author stated during drafting that corporate is needed for the MVP. The
    reviewer did not see that. The document records it only as a rejection reason, not as a dated
    product decision with a stated reason. Writing it as one (and saying why the MVP needs it) would
    answer the "no source" half of the finding. It would not answer the spec conflict, which D.2
    resolves by changing the spec.

### A2. Major: the "cost after launch" argument only covers slice 1 (zoom-out 2)

*   **Where:** Problem point 4; Implementation Plan intro.
*   **Finding:** the argument for building now is the cost of migrating live data later. That
    applies to re-keying courses, payments and media away from `users.id` (slice 1). Slices 2 and 3
    add new tables and nullable columns. The document itself says that after the reset "later
    changes are normal additive migrations". So helpers and corporate could ship after launch with
    no data rework.
*   **Suggested reshape:** ship slice 1 now; write slices 2 and 3 as separate briefs when a real
    teacher or company asks.

### A3. Major: change sets and the Drizzle RC are heavy machinery for an unrequested need (zoom-out 3)

*   **Where:** Technical Plan sections 8 and 13; Step 0; 2.2–2.9; Alternatives N, R and S.
*   **Finding:** holding writer edits needs draft copies of four tables, four views, a second
    relations set and a separate learner client, conflict detection with a picker screen, in-place
    apply logic, an import-scan test, and an upgrade to an ORM release candidate (about 25 files,
    plus ongoing breaking-change risk). Two questions about views are still untested. Alternative N
    (writers barred from live courses) costs nothing, and its downside is how the product works
    today.
*   **Ask:** if helpers stay in scope, adopt Alternative N and drop Step 0.
*   **Elephant note:** the author chose held change sets over Alternative N in the brief's second
    review round, accepting this cost.

### A4. Major: unrequested security and recovery features (zoom-out 5)

*   **Stripe re-authentication (section 4, 1.38):** a new column, middleware, a redirect flow and a
    test. With sign-in by emailed link, the inbox is the real credential, and the document admits
    the check "stops a stolen session, not a stolen inbox". The owner email on every link request
    adds noise. *Elephant note: the author chose this check during brief reconciliation.*
*   **Owner recovery (section 11, 3.8):** two `super_admin` routes, uploads, emails and session
    revocation, for a rare event. The reviewer suggests an audited runbook for a single staff member
    during the pilot.
*   **Manager `awaiting_confirmation` (section 7, Alternative V):** justified by Apple relay
    addresses, but Apple sign-in is a later brief. If corporate is deferred, managers and this state
    go too.

### A5. Nit: the capability table is set up for future roles (zoom-out 6)

*   **Where:** section 2; 1.9.
*   **Finding:** keep `can(actor, capability)` in `packages/core`. But slice 1 uses only `owner` and
    `staff`, and 1.9 writes the `manager` and `writer` rows now. Ship only the capabilities some role
    in the current slice is refused, and add rows when roles arrive.

--------------------------------------------------------------------------------

## B. Money and payout accounts

### B1. Major: the `retired` state models a transition the design never performs (zoom-out 4)

*   **Where:** section 1 `payout_accounts`; section 6; Goal 5; 1.22; the account-switch case in
    1.36.
*   **Finding:**
    - No flow in the document retires an account or switches a profile's active account. The flows
      that would (promotion, transfer) are Non-Goals.
    - Today the account cannot change either: `ConnectService.ensureAccount` returns the existing
      Stripe ID (`apps/api/src/services/connect.service.ts:28–41`). Problem point 3 is a latent
      risk, not a live bug.
    - Goal 4 ("every sale records who was paid") only needs the paid Stripe account recorded on the
      payment.
*   **Ask:** at minimum, name the flow that retires an account. A state that only a test fixture
    can reach is a warning sign.
*   **Elephant note:** the brief's "What the first build's data model must allow" list asks for
    these states so the promotion brief needs no rework. The reviewer did not see the brief. The
    document should say this in section 1, because it is currently unexplained there.

### B2. Major: fulfilment trusts metadata, and drops paid sales when it is missing (catalyst 1)

*   **Where:** section 5; Alternatives X and Y; 1.20.
*   **Finding:**
    - Stripe already records the real payee in the money flow: the destination on the charge and
      the transfer that `retrievePaymentDetails` already fetches
      (`apps/api/src/services/payments.service.ts:267`). Metadata only repeats this, and the copy can
      be missing or wrong.
    - When metadata is missing, the design writes no payment and no enrolment, though the learner
      has paid and the money has moved. Recording an error is not recovery.
    - Session metadata already carries `enrollmentId` (`payments.service.ts:202`), so the "older
      session gives `unmatched`" case could be fixed without a new table.
*   **Proposed resolution:**
    - take the payee from the Stripe destination or transfer, look it up through
      `payout_accounts.stripe_account_id`, and use metadata only as a cross-check;
    - when the payee is unknown or the two disagree, record the payment as "unattributed" and show it
      in the Support ledger, instead of writing nothing;
    - when the latest-session match fails, find the enrolment by `metadata.enrollmentId`.
*   **New costs:** an "unattributed" state that earnings and reconciliation must leave out or flag;
    a Support queue; reading the destination from Stripe, which the fake provider must copy; and a
    guard so a stale session cannot fulfil an enrolment that is already active.

--------------------------------------------------------------------------------

## C. Writer edits to live courses

### C1. Major: two editing paths on one live course create the conflict machinery (catalyst 2)

*   **Where:** sections 8 and 13; Alternatives R and S; 2.2–2.9.
*   **Finding:**
    - Writers edit a draft copy while owners and managers keep editing live rows (2.8). That is why
      the design needs `opened_at_snapshot`, a per-item conflict check and a resolution screen.
    - The conflict check has gaps. `lesson_prerequisites` has no `updated_at`
      (`packages/db/src/schema/courses.ts:63–77`), so changes to prerequisite links go undetected. A
      live row the owner deletes while a change set is open is not caught by an "updated later"
      check, and approval then updates a row that no longer exists.
    - Because draft rows share the learner tables, hiding them needs views, and views force the
      Drizzle release candidate.
*   **Proposed resolution:** while a change set is open on a course, every editor's content edits
    go into it, owners included, and approval publishes it. With no change set open, owners edit
    live rows as today. There is then one working copy, so the snapshot check, the resolution screen
    and the missed deletions all go away.
    - *Further option:* learners read a published snapshot made at approval time, with stable
      artefact and quiz IDs. That would remove the views and the Drizzle release candidate.
*   **New costs:** owner edits made while a writer's change set is open no longer go live at once,
    and discarding the change set throws away the owner's work too (it needs per-item authors or a
    warning). The snapshot option adds storage, a publish step and careful ID mapping for progress.

### C2. Nit: too much low-level detail in the Technical Plan (zoom-out 7)

*   **Where:** the idempotency key string (section 5), column details in section 8, the UEN format
    (3.2), the token length (2.7), the file list in 0.8.
*   **Finding:** this level of detail fits the Implementation Plan. In the Technical Plan it hides
    the architecture. Section 8 mixes the approach (views over draft rows) with apply details.

### C3. Nit: the schema guard is a source-text scan (zoom-out 8)

*   **Where:** 1.37; the learner import scan in section 8.
*   **Finding:** a text scan for "a column named like a teacher reference" is brittle, which is the
    same weakness the document holds against Alternative R. Checking the generated migration or
    snapshot for foreign keys to `users` would hold up better.

--------------------------------------------------------------------------------

## D. Rollout

### D1. Major: one squashed `0000` keeps slices 1 and 2 off staging until slice 3 is done (catalyst 3)

*   **Where:** Implementation Plan intro; section 12; Open Questions; Alternative G.
*   **Finding:**
    - With one `0000` regenerated until the end, nothing reaches staging before slice 3, and slice 3
      waits on the untested Stripe company-account question. One outside unknown blocks staging
      checks for every slice.
    - Open Questions calls generating the squash twice a cost to avoid, but the plan regenerates it
      three times.
*   **Proposed resolution:**
    - either reset staging at the end of each step (the reset command is repeatable and the data is
      disposable), or freeze `0000` after step 1 and ship steps 2 and 3 as additive migrations;
    - either way, move the cheap corporate schema (`legal_entities`, the enums, the foreign key on
      `legal_entity_id`) into step 1, so step 3 is code only.
*   **New costs:** up to three manual reset runs on staging; a short migration history in place of
    one `0000`; corporate columns fixed before the Stripe test can inform them (later changes are
    still additive).

### D2. Nit: the legal-name check is manual even when the names match, and runs only once (catalyst 4)

*   **Where:** sections 4 and 9; Alternative J; 3.5–3.6.
*   **Finding:** every company account waits for Support even when Stripe's legal name equals the
    verified name. After activation, an `account.updated` that changes the legal name does not
    send the account back for review.
*   **Proposed resolution:** match automatically when the normalised names are identical (audit
    source `auto`); send Support only mismatches and missing names; re-run the comparison on every
    `account.updated`, and drop the account back to `onboarding` if the name changes.
*   **New costs:** loose normalisation could approve a near miss; a webhook-driven drop can stop
    sales without warning, so the owner needs notice. It reverses the author's choice of a human
    gate, so it is the author's call. The re-check on name change is the more valuable half.

--------------------------------------------------------------------------------

## What the reviewers confirmed

*   **No false compromise found in:** the owner column, the single capability table with staff as a
    named role, the profile in the URL, "earnings follow the account", and the recent-sign-in rule.
*   **Reused, not rebuilt:** the audit service, the `document` media kind, the existing course
    editor, ADR 003's destination charges, and the squash-and-reset approach for a pre-launch
    product.
*   **Correction to the design:** the rate limiter already accepts a custom key function
    (`apps/api/src/middleware/rate-limit.ts:22–27`). Item 2.11 needs a caller, not a limiter change.
*   **Confirmed claims:** the sign-in redirect exists (`apps/api/src/services/auth.service.ts:62–68`).
    Reconciliation works as Problem point 3 describes (`earnings.service.ts:138–157`).
